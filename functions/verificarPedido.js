// Verificación de precios de los pedidos que llegan desde la app del cliente.
//
// El celular manda el pedido con sus precios y su total, pero eso se puede
// alterar. Aquí la nube vuelve a armar cada línea con el MENÚ REAL
// (crearLinea, la misma función que usan la app y el POS) y recalcula el
// domicilio con las reglas de shared/domicilio.js. El resultado del servidor
// reemplaza al del celular; si algo no coincide, queda anotado para que la
// vendedora lo vea antes de aceptar.
import { crearLinea } from './shared/comandas.js';
import { DOMICILIO, conjuntoPorId } from './shared/domicilio.js';

const MAX_UNIDADES = 50;

/** Reconstruye una línea con el menú actual. Devuelve { linea } o { error }. */
function rehacerLinea(l, menu) {
  const item = menu.items[l?.item_id];
  if (!item || item.activo === false) return { error: `"${l?.nombre_pantalla || l?.nombre || l?.item_id}" ya no está en el menú` };
  if (item.agotado === true) return { error: `"${item.nombre}" está agotado` };
  const cantidad = Math.floor(Number(l.cantidad));
  if (!(cantidad >= 1 && cantidad <= MAX_UNIDADES)) return { error: `Cantidad no válida en "${item.nombre}"` };

  // Las opciones viajan por nombre (lo que se imprime); se traducen a ids del menú.
  const opciones = {};
  for (const ref of item.grupos_opciones || []) {
    const enviada = (l.opciones || []).find((o) => o.grupo_id === ref.grupo_id);
    const grupo = menu.grupos[ref.grupo_id];
    const ids = (enviada?.valores || []).map((nombre) => grupo?.opciones.find((o) => o.nombre === nombre && o.activo !== false)?.id);
    if (ids.some((x) => !x)) return { error: `Opción que no existe en "${item.nombre}"` };
    opciones[ref.grupo_id] = ids;
  }
  const modificadores = (l.modificadores || []).map((m) => m?.id);
  if (modificadores.some((id) => !(item.modificadores || []).some((m) => m.id === id))) return { error: `Adicional que no existe en "${item.nombre}"` };

  try {
    const linea = crearLinea(item, menu.grupos, { cantidad, opciones, modificadores, sin: l.sin || [], nota: String(l.nota || '').slice(0, 120) });
    return { linea: { ...linea, ...(l.nombre_pantalla ? { nombre_pantalla: String(l.nombre_pantalla).slice(0, 80) } : {}) } };
  } catch (e) {
    return { error: `"${item.nombre}": ${e.message}` };
  }
}

/** Domicilio según las reglas del servidor. */
async function rehacerDomicilio(pedido, cotizar) {
  if (pedido.tipo_entrega !== 'domicilio') return { valor: 0, domicilio: null };
  const dir = pedido.direccion_detalle || {};
  const conjunto = dir.conjuntoId && conjuntoPorId(dir.conjuntoId);
  if (conjunto) return { valor: DOMICILIO.tarifaConjunto, domicilio: { tipo: 'SECTOR', metodo: 'conjunto', tarifa: DOMICILIO.tarifaConjunto, sector: conjunto.nombre } };
  if (dir.nomenclatura && cotizar) {
    const r = await cotizar({ direccion: dir.nomenclatura, barrio: dir.barrio || '' });
    if (r?.estado === 'ok') {
      return { valor: r.tarifa, domicilio: { tipo: 'SECTOR', metodo: 'distancia', tarifa: r.tarifa, km: r.km, kmCobrados: r.kmCobrados ?? null, direccion_encontrada: r.direccion_encontrada || null } };
    }
    if (r?.estado === 'fuera') return { valor: 0, domicilio: { tipo: 'PENDIENTE_INFORMAR', fuera: true, km: r.km }, fuera: true };
  }
  return { valor: 0, domicilio: { tipo: 'PENDIENTE_INFORMAR' } };
}

const pesos = (n) => '$' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * @param pedido   documento tal como lo creó la app
 * @param menu     { items: {id: item}, grupos: {id: grupo} }
 * @param cotizar  (datos) => resultado de cotizarDomicilio (o null para no consultar)
 * @returns { cambios, verificacion }  cambios = campos a escribir en el pedido
 */
export async function verificarPedidoApp(pedido, { menu, cotizar }) {
  const avisos = [];
  const items = [];
  for (const l of pedido.items || []) {
    const r = rehacerLinea(l, menu);
    if (r.error) { avisos.push(r.error); continue; }
    if (Math.round(r.linea.total) !== Math.round(Number(l.total) || 0)) {
      avisos.push(`${r.linea.cantidad}× ${r.linea.nombre_pantalla || r.linea.nombre}: la app decía ${pesos(l.total)}, el menú dice ${pesos(r.linea.total)}`);
    }
    items.push(r.linea);
  }

  if (pedido.tipo_entrega === 'domicilio') {
    for (const l of items.filter((x) => x.solo_local)) avisos.push(`${l.cantidad}× ${l.nombre_pantalla || l.nombre}: envase de vidrio, no se envía a domicilio. Llama al cliente para cambiarlo`);
  }
  const dom = await rehacerDomicilio(pedido, cotizar);
  const domEnviado = Number(pedido.domicilio_valor) || 0;
  if (dom.fuera) avisos.push(`La dirección está fuera de cobertura (${String(dom.domicilio.km).replace('.', ',')} km): confirma el domicilio con el cliente`);
  else if (dom.valor !== domEnviado) avisos.push(`Domicilio: la app decía ${pesos(domEnviado)}, corresponde ${dom.valor ? pesos(dom.valor) : 'por confirmar'}`);

  if (!items.length) {
    // Nada se pudo verificar: no se toca el pedido; la vendedora decide.
    return { cambios: {}, verificacion: { ok: false, avisos, total_app: Number(pedido.total) || 0, total_verificado: null, lineas_invalidas: (pedido.items || []).length } };
  }
  const subtotal = items.reduce((s, l) => s + l.total, 0);
  const total = subtotal + dom.valor;
  const totalEnviado = Number(pedido.total) || 0;

  return {
    cambios: {
      items,
      subtotal,
      domicilio_valor: dom.valor,
      domicilio: dom.domicilio,
      total,
    },
    verificacion: {
      ok: avisos.length === 0,
      avisos,
      total_app: totalEnviado,
      total_verificado: total,
      lineas_invalidas: (pedido.items || []).length - items.length,
    },
  };
}
