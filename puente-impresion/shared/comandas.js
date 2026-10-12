// Lógica compartida de comandas — la usan la app de la vendedora, la Cloud
// Function y el puente de impresión. Sin dependencias.
import { ZONAS } from './menu.seed.js';

export { ZONAS };
export const ZONAS_QUE_IMPRIMEN = Object.values(ZONAS).filter((z) => z.imprime).map((z) => z.id);
export const TZ = 'America/Bogota';

// ─── Líneas del pedido ─────────────────────────────────────────────────

/**
 * Convierte la selección de la vendedora en una línea de pedido
 * (copia congelada del producto: si mañana cambia el menú, el pedido no cambia).
 * @param item      documento de menu_items
 * @param grupos    mapa grupo_id → documento de grupos_opciones
 * @param sel       { cantidad, opciones: { grupo_id: [opcionId] }, modificadores: [modId], nota }
 */
export function crearLinea(item, grupos, sel) {
  const errores = validarSeleccion(item, sel);
  if (errores.length) throw new Error(errores.join(' '));

  let unitario = item.precio || 0;
  const opciones = item.grupos_opciones.map((ref) => {
    const grupo = grupos[ref.grupo_id];
    const ids = sel.opciones?.[ref.grupo_id] || [];
    const elegidas = ids.map((id) => grupo.opciones.find((o) => o.id === id));
    elegidas.forEach((o) => (unitario += o.precio_extra || 0));
    const soloPorDefecto = grupo.por_defecto && ids.length === 1 && ids[0] === grupo.por_defecto;
    return {
      grupo_id: ref.grupo_id,
      etiqueta: ref.etiqueta,
      valores: elegidas.map((o) => o.nombre),
      imprimir: !soloPorDefecto, // "Pan" en una hamburguesa no hace falta imprimirlo
    };
  });

  const modificadores = (sel.modificadores || []).map((id) => {
    const mod = item.modificadores.find((x) => x.id === id);
    unitario += mod.precio || 0;
    return { id: mod.id, nombre: mod.nombre, precio: mod.precio || 0 };
  });

  // Ingredientes que el cliente pidió quitar (solo los que el producto permite).
  const permitidos = item.ingredientes_removibles || [];
  const sin = (sel.sin || []).filter((x) => permitidos.includes(x));

  const cantidad = Math.max(1, sel.cantidad || 1);
  return {
    item_id: item.id,
    ...(item.solo_local ? { solo_local: true } : {}), // no se envía a domicilio (ej: envase de vidrio)
    nombre: item.nombre,
    nombre_comanda: item.nombre_comanda,
    categoria_id: item.categoria_id,
    zona_preparacion: item.zona_preparacion,
    cantidad,
    opciones,
    modificadores,
    sin,
    nota: (sel.nota || '').trim(),
    precio_unitario: unitario,
    total: unitario * cantidad,
  };
}

export function validarSeleccion(item, sel) {
  const errores = [];
  for (const ref of item.grupos_opciones) {
    const n = (sel.opciones?.[ref.grupo_id] || []).length;
    if (n < ref.min) errores.push(ref.min === ref.max ? `Elige ${ref.min} ${ref.etiqueta.toLowerCase()}.` : `Elige al menos ${ref.min} ${ref.etiqueta.toLowerCase()}.`);
    if (n > ref.max) errores.push(`Máximo ${ref.max} en ${ref.etiqueta.toLowerCase()}.`);
  }
  return errores;
}

/** Texto corto de las opciones/modificadores de una línea (para pantallas). */
export function resumenLinea(linea) {
  const partes = linea.opciones.filter((o) => o.imprimir).flatMap((o) => o.valores);
  linea.modificadores.forEach((mm) => partes.push(mm.nombre));
  (linea.sin || []).forEach((x) => partes.push(`Sin ${x.toLowerCase()}`));
  return partes.join(' · ');
}

export function agruparPorZona(items) {
  const grupos = {};
  for (const l of items) (grupos[l.zona_preparacion] ||= []).push(l);
  return Object.keys(grupos)
    .sort((a, b) => (ZONAS[a]?.orden ?? 9) - (ZONAS[b]?.orden ?? 9))
    .map((zona) => ({ zona, items: grupos[zona], unidades: grupos[zona].reduce((s, l) => s + l.cantidad, 0) }));
}

// ─── Trabajos de impresión ─────────────────────────────────────────────

/** Fecha del día en Bogotá (YYYY-MM-DD) para reiniciar el consecutivo. */
export function claveDia(fecha = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

/**
 * Un trabajo por cada zona que imprime. El id es {pedidoId}_{zona}:
 * si la función se ejecuta dos veces, sobrescribe el mismo documento.
 */
export function construirTrabajos(pedidoId, pedido, numero, creadoEnISO, { vendedor = '', adicion = 0 } = {}) {
  const grupos = agruparPorZona(pedido.items);
  return grupos
    .filter((gz) => ZONAS[gz.zona]?.imprime)
    .map((gz) => ({
      id: `${pedidoId}_${gz.zona}`,
      pedido_id: pedidoId,
      zona: gz.zona,
      titulo: ZONAS[gz.zona].titulo_ticket,
      numero,
      tipo_entrega: pedido.tipo_entrega || 'llevar',
      // Mesa del tablero: la comanda dice "MESA - 4 · Carlos".
      cliente: pedido.mesa ? [pedido.mesa, pedido.cliente?.nombre].filter(Boolean).join(' - ') : pedido.cliente?.nombre || '',
      vendedor,
      ...(adicion ? { adicion } : {}), // n.º de adición a una cuenta abierta: la comanda trae SOLO lo nuevo
      origen: pedido.origen || 'mostrador',
      nota_pedido: pedido.nota || '',
      lineas: gz.items.map((l) => ({
        cantidad: l.cantidad,
        nombre_comanda: l.nombre_comanda,
        detalles: [
          ...l.opciones.filter((o) => o.imprimir).flatMap((o) => o.valores.map((v) => `- ${v}`)),
          ...l.modificadores.map((mm) => `+ ${mm.nombre}`),
          ...(l.sin || []).map((x) => `SIN ${x.toUpperCase()}`),
          ...(l.nota ? [`* ${l.nota}`] : []),
        ],
      })),
      otras_zonas: grupos
        .filter((o) => o.zona !== gz.zona && ZONAS[o.zona]?.imprime)
        .map((o) => ({ titulo: ZONAS[o.zona].titulo_ticket, unidades: o.unidades })),
      pedido_creado_en: creadoEnISO,
      estado: 'pendiente',
      intentos: 0,
      reimpresiones: 0,
    }));
}

// ─── Formato del ticket ────────────────────────────────────────────────
// Modelo neutro de bloques: el puente lo convierte a ESC/POS y la app lo
// muestra como texto. Así el ticket se ve igual en pantalla y en papel.

const ENTREGA = { mesa: 'MESA', llevar: 'PARA LLEVAR', domicilio: 'DOMICILIO' };

export function fechaCorta(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CO', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

export function horaCorta(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(iso))
    .replace(/\s/g, ' ')
    .replace('a. m.', 'a.m.')
    .replace('p. m.', 'p.m.');
}

export function bloquesTicket(t, { ancho = 48 } = {}) {
  if (t.tipo === 'cuenta') return bloquesCuenta(t, { ancho });
  const b = [];
  const push = (value, o = {}) => b.push({ t: 'text', value, ...o });
  if (t.reimpresiones > 0) push('*** REIMPRESION ***', { align: 'center', bold: true });
  push(` ${t.titulo} `, { align: 'center', size: 'double', invert: true });
  if (t.adicion) {
    // Adición a una cuenta abierta: que no vuelvan a preparar lo anterior.
    push(`*** ADICION ${t.adicion} ***`, { align: 'center', size: 'double', bold: true });
    push('Solo lo nuevo de este pedido', { align: 'center' });
  }
  b.push({ t: 'feed', n: 1 });
  push(dosColumnas(`#${String(t.numero).padStart(3, '0')}`, horaCorta(t.pedido_creado_en), Math.floor(ancho / 2)), { size: 'double', bold: true });
  const cab = [ENTREGA[t.tipo_entrega] || t.tipo_entrega?.toUpperCase(), t.cliente].filter(Boolean).join(' - ');
  if (cab) push(cab, { bold: true });
  if (t.vendedor) push(`${t.origen === 'app' ? 'App - acepto' : 'Atiende'}: ${t.vendedor}`);
  b.push({ t: 'line' });
  // Letra grande para que pizzero y cocinero lean de lejos:
  //  - producto: doble alto y doble ancho (caben 24 letras por renglón)
  //  - sabores, adicionales, SIN y notas: doble alto, en negrita (48 letras)
  // Los renglones se parten aquí por palabras, para que la impresora nunca
  // corte una palabra por la mitad ni se salga del papel.
  const mitad = Math.floor(ancho / 2);
  const partir = (texto, anchoLinea, o) => envolver(texto, anchoLinea).forEach((r) => push(r, o));
  for (const [i, l] of t.lineas.entries()) {
    if (i > 0) b.push({ t: 'feed', n: 1 });
    partir(`${String(l.cantidad).padEnd(3)}${l.nombre_comanda}`, mitad, { size: 'double', bold: true });
    for (const d of l.detalles) partir(`   ${d}`, ancho, { size: 'tall', bold: true });
  }
  if (t.nota_pedido) {
    b.push({ t: 'line' });
    partir(`NOTA: ${t.nota_pedido}`, ancho, { size: 'tall', bold: true });
  }
  if (t.otras_zonas?.length) {
    b.push({ t: 'line' });
    push('Este pedido tambien tiene:');
    t.otras_zonas.forEach((o) => push(`  ${o.titulo} (${o.unidades} ${o.unidades === 1 ? 'item' : 'items'})`, { bold: true }));
  }
  b.push({ t: 'feed', n: 3 });
  b.push({ t: 'cut' });
  return b;
}

/** Texto plano del ticket (vista previa en pantalla y pruebas). */
export function ticketTexto(t, { ancho = 48 } = {}) {
  const out = [];
  for (const blk of bloquesTicket(t, { ancho })) {
    if (blk.t === 'line') out.push('-'.repeat(ancho));
    else if (blk.t === 'feed') out.push(...Array(blk.n).fill(''));
    else if (blk.t === 'cut') out.push('✂'.padStart(ancho / 2 + 1).padEnd(ancho));
    else {
      const anchoEf = blk.size === 'double' ? Math.floor(ancho / 2) : ancho;
      for (const linea of envolver(blk.value, anchoEf)) {
        let txt = blk.align === 'center' ? centrar(linea, anchoEf) : linea;
        if (blk.size === 'double') txt = txt.split('').join(' ');
        out.push(txt);
      }
    }
  }
  return out.join('\n');
}

export function envolver(texto, ancho) {
  const res = [];
  for (const parrafo of String(texto).split('\n')) {
    if (parrafo.length <= ancho) {
      res.push(parrafo);
      continue;
    }
    const sangria = parrafo.match(/^\s*/)[0];
    let linea = sangria;
    for (const palabra of parrafo.trim().split(/\s+/)) {
      const vacia = linea.trim() === '';
      if (!vacia && (linea + ' ' + palabra).length > ancho) {
        res.push(linea);
        linea = sangria + '   ' + palabra; // sangría de continuación
      } else linea += (vacia ? '' : ' ') + palabra;
    }
    res.push(linea);
  }
  return res;
}

const centrar = (s, ancho) => ' '.repeat(Math.max(0, Math.floor((ancho - s.length) / 2))) + s;
const dosColumnas = (a, b, ancho) => a + ' '.repeat(Math.max(1, ancho - a.length - b.length)) + b;

// ─── Cuenta para cobrar ────────────────────────────────────────────────
// Ticket aparte con TODO lo que pidió el cliente (bebidas incluidas), con
// precios y total. Sale solo cuando la vendedora toca "Imprimir cuenta".

export const NOMBRE_NEGOCIO = 'ISMA GASTRO-BAR';
// Encabezado de la cuenta. Va dentro de cada trabajo (lo arma la Cloud
// Function): para cambiar NIT o dirección basta publicar functions, sin tocar
// el PC del restaurante.
export const DATOS_NEGOCIO = {
  nit: '', // ⚠️ completar con el NIT real de ISMA (vacío = no se imprime)
  direccion: 'Cr 49 #127 sur 03',
  lugar: 'Barrio Olaya',
  ciudad: 'Caldas, Antioquia',
};
export const pesos = (n) => '$' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', datafono: 'Datáfono - llevar datáfono' };
const titulo = (x) => String(x || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export function construirCuenta(pedidoId, pedido, { vendedor = '' } = {}) {
  const lineas = (pedido.items || []).map((l) => ({
    cantidad: l.cantidad,
    nombre: l.nombre_pantalla || l.nombre || titulo(l.nombre_comanda),
    detalles: [
      ...l.opciones.filter((o) => o.imprimir).flatMap((o) => o.valores),
      ...l.modificadores.map((mm) => `+ ${mm.nombre}`),
      ...(l.sin || []).map((x) => `Sin ${x.toLowerCase()}`),
    ],
    total: l.total || 0,
  })).reduce((acc, l) => {
    // Todo en una sola lista: lo mismo pedido en el pedido inicial y en una
    // adición (mismo producto, opciones y precio) se suma en un renglón.
    const unitario = l.cantidad ? l.total / l.cantidad : 0;
    const igual = acc.find((x) => x.nombre === l.nombre && x.detalles.join('|') === l.detalles.join('|') && x.cantidad && x.total / x.cantidad === unitario);
    if (igual) { igual.cantidad += l.cantidad; igual.total += l.total; } else acc.push({ ...l });
    return acc;
  }, []);
  const subtotal = lineas.reduce((s, l) => s + l.total, 0);
  const domicilio = pedido.domicilio_valor || 0;
  return {
    id: `${pedidoId}_cuenta`,
    tipo: 'cuenta',
    pedido_id: pedidoId,
    zona: 'cuenta',
    titulo: 'CUENTA',
    numero: pedido.numero || 0,
    tipo_entrega: pedido.tipo_entrega || 'llevar',
    cliente: pedido.mesa ? [`Mesa ${pedido.mesa}`, pedido.cliente?.nombre].filter(Boolean).join(' - ') : pedido.cliente?.nombre || '',
    cliente_telefono: pedido.cliente?.telefono || '',
    cliente_direccion: pedido.cliente?.direccion || '',
    encabezado: [DATOS_NEGOCIO.nit && `NIT ${DATOS_NEGOCIO.nit}`, DATOS_NEGOCIO.direccion, `${DATOS_NEGOCIO.lugar} - ${DATOS_NEGOCIO.ciudad}`].filter(Boolean),
    vendedor,
    lineas,
    subtotal,
    domicilio,
    domicilio_por_confirmar: pedido.tipo_entrega === 'domicilio' && !domicilio,
    total: subtotal + domicilio,
    pago: textoPagoCuenta(pedido, domicilio),
    otras_zonas: [],
  };
}

// Si caja puso el domicilio al aceptar (la app no lo calculó) y el cliente pagó por
// transferencia, la transferencia solo cubre los productos: el domiciliario cobra
// el domicilio. Va en la línea "Pago" (letra grande) para que no se pase por alto.
function textoPagoCuenta(pedido, domicilio) {
  const base = PAGO[pedido.pago?.metodo] || '';
  if (pedido.tipo_entrega === 'domicilio' && !domicilio && pedido.pago?.metodo === 'transferencia') return `${base} (solo productos) - COBRAR DOMICILIO AL ENTREGAR`;
  if (!pedido.domicilio_confirmado || !domicilio) return base;
  if (pedido.pago?.metodo === 'transferencia') return `${base} (solo productos) - COBRAR DOMICILIO ${pesos(domicilio)} AL ENTREGAR`;
  return `${base} - incluye domicilio ${pesos(domicilio)}`;
}

function bloquesCuenta(t, { ancho = 48 } = {}) {
  const b = [];
  const push = (value, o = {}) => b.push({ t: 'text', value, ...o });
  const fila = (izq, der, o = {}) => push(dosColumnas(izq, der, o.size === 'double' ? Math.floor(ancho / 2) : ancho), o);
  push(NOMBRE_NEGOCIO, { align: 'center', size: 'double', bold: true });
  (t.encabezado || []).forEach((l) => push(l, { align: 'center' }));
  b.push({ t: 'feed', n: 1 });
  push(' CUENTA ', { align: 'center', bold: true, invert: true });
  if (t.reimpresiones > 0) push('(copia)', { align: 'center' });
  b.push({ t: 'feed', n: 1 });
  fila(`Pedido #${String(t.numero).padStart(3, '0')}`, ENTREGA[t.tipo_entrega] || t.tipo_entrega?.toUpperCase() || '', { bold: true });
  if (t.pedido_creado_en) fila(`Fecha: ${fechaCorta(t.pedido_creado_en)}`, `Hora: ${horaCorta(t.pedido_creado_en)}`);
  if (t.vendedor) push(`Atiende: ${t.vendedor}`);
  if (t.cliente || t.cliente_telefono || t.cliente_direccion) {
    b.push({ t: 'line' });
    if (t.cliente) push(`Cliente: ${t.cliente}`, { bold: true });
    // Teléfono, dirección y pago en letra grande: el domiciliario los lee de noche.
    // La dirección se parte por palabras al ancho del papel (no se desborda).
    if (t.cliente_telefono) push(`Tel: ${t.cliente_telefono}`, { size: 'double', bold: true });
    if (t.cliente_direccion) envolver(`Dir: ${t.cliente_direccion}`, ancho).forEach((d) => push(d, { size: 'tall', bold: true }));
  }
  b.push({ t: 'line' });
  const anchoNombre = ancho - 13; // espacio para el precio a la derecha
  for (const l of t.lineas) {
    const [primera, ...resto] = envolver(`${l.cantidad} ${l.nombre}`, anchoNombre);
    fila(primera, pesos(l.total), { bold: true });
    resto.forEach((r) => push(`  ${r.trim()}`, { bold: true }));
    if (l.detalles.length) envolver(`   ${l.detalles.join(', ')}`, anchoNombre).forEach((d) => push(d));
  }
  b.push({ t: 'line' });
  if (t.domicilio || t.domicilio_por_confirmar) {
    fila('Subtotal', pesos(t.subtotal));
    fila('Domicilio', t.domicilio ? pesos(t.domicilio) : 'Por confirmar');
  }
  fila('TOTAL', pesos(t.total), { size: 'double', bold: true });
  if (t.pago) envolver(`Pago: ${t.pago}`, ancho).forEach((d) => push(d, { size: 'tall', bold: true }));
  b.push({ t: 'feed', n: 1 });
  push('Gracias por su compra', { align: 'center' });
  push('Documento no valido como factura', { align: 'center' });
  b.push({ t: 'feed', n: 3 });
  b.push({ t: 'cut' });
  return b;
}
