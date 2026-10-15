// Backend falso para la vista previa (sin Firebase).
import { CATEGORIAS, GRUPOS_OPCIONES, MENU_ITEMS } from '@shared/menu.seed.js';
import { aplicarMenuDelDia, armarMenuDelDia, vendible } from '@shared/menuDelDia.js';

// Menú del Día de demostración (solo vista previa).
const MDD_DEMO = armarMenuDelDia({ sopaDelDia: ['Sancocho de gallina'], proteinaDelDia: ['Res', 'Cañón de cerdo'], ensaladaDelDia: ['Lechuga primaveral', 'Pico de gallo'], bebidaDelDia: ['Jugo de mora'], disponible: true });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ⚠️ SOLO DEMO: precios de ejemplo para que la vista previa no muestre $0.
// No se usan en producción (allá salen de Firestore, y cargar-menu.mjs exige precios reales).
const PRECIOS_DEMO = {
  jugo_del_dia: 6000, limonada_natural: 6000, limonada_de_coco: 9000, claro: 4000, guandolo: 4000, mazamorra: 5000,
  cerveza_aguila: 5000, cerveza_poker: 5000, cerveza_pilsen: 5000, cerveza_club_colombia: 6000, cerveza_corona: 9000,
  aguardiente_trago: 6000, aguardiente_media: 45000, aguardiente_botella: 85000, ron_trago: 7000, ron_media: 50000, ron_botella: 95000,
  coca_cola_personal: 4500, postobon_personal: 4000, gaseosa_litro: 8000, agua: 3500, agua_con_gas: 4000,
  refajo_vaso: 6000, refajo_jarra: 22000, red_bull: 9000, vive_100: 4500, gatorade: 6000, electrolit: 9000,
  michelada: 9000, mojito: 18000, margarita: 18000, pina_colada: 18000, cuba_libre: 15000,
  adic_res: 9000, adic_cerdo: 8000, adic_pollo: 8000, adic_chicharron: 8000, adic_chorizo: 5000,
  adic_queso: 4000, adic_tocineta: 4000, adic_huevo: 2500,
  adic_maduro: 4000, adic_patacon: 4000, adic_yuca: 4000, adic_papas: 5000, adic_arroz: 3000, adic_arepa: 2000, ensalada: 4000, pico_de_gallo: 3000,
  adic_chimichurri: 2000, adic_tartara: 2000, adic_ajo: 2000, adic_bbq: 2000, adic_hogao: 2000,
};
const conPrecioDemo = (i) => (i.precio > 0 || !PRECIOS_DEMO[i.id] ? i : { ...i, precio: PRECIOS_DEMO[i.id], precio_por_confirmar: undefined });

export function escucharMenu(cb) {
  const t = setTimeout(() => cb(aplicarMenuDelDia({
    categorias: CATEGORIAS.filter((c) => c.activo),
    items: MENU_ITEMS.map(conPrecioDemo).filter(vendible),
    grupos: Object.fromEntries(GRUPOS_OPCIONES.map((g) => [g.id, g])),
  }, MDD_DEMO)), 200);
  return () => clearTimeout(t);
}

// Demo del seguimiento: el pedido avanza solo (aprobado, en camino / listo, entregado).
import { vistaSeguimiento } from '@shared/seguimiento.js';
const seguimientos = new Map();
const oyentes = new Map();
const emitir = (t) => (oyentes.get(t) || []).forEach((cb) => cb(seguimientos.get(t) || null));

export async function crearPedido(pedido) {
  await espera(500);
  const t = pedido.seguimiento_token;
  const p = { ...pedido, estado: 'por_aprobar', creado_en: new Date() };
  const poner = (cambios) => { Object.assign(p, cambios); seguimientos.set(t, vistaSeguimiento(p)); emitir(t); };
  if (t) {
    setTimeout(() => poner({}), 800);
    const pendiente = p.tipo_entrega === 'domicilio' && !p.domicilio_valor;
    setTimeout(() => poner({ estado: 'confirmado', numero: 12, aprobado_en: new Date(),
      ...(pendiente ? { domicilio_valor: 3000, total: p.subtotal + 3000, domicilio_confirmado: { valor: 3000 } } : {}) }), 4000);
    setTimeout(() => poner({ etapa: p.tipo_entrega === 'domicilio' ? 'en_camino' : 'listo', etapas: { [p.tipo_entrega === 'domicilio' ? 'en_camino' : 'listo']: new Date() } }), 9000);
    setTimeout(() => poner({ etapa: 'entregado', etapas: { ...p.etapas, entregado: new Date() } }), 14000);
  }
  return 'DEMO-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function escucharSeguimiento(token, cb) {
  oyentes.set(token, [...(oyentes.get(token) || []), cb]);
  setTimeout(() => cb(seguimientos.get(token) || null), 100);
  return () => oyentes.set(token, (oyentes.get(token) || []).filter((x) => x !== cb));
}

// Demo: simula a Google. La distancia sale de los números de la dirección
// (misma dirección → misma distancia). Si escribes "xx" no la "encuentra".
import { DOMICILIO, tarifaPorDistancia } from '@shared/domicilio.js';
export async function cotizarDomicilio({ direccion, barrio = "" }) {
  await espera(700);
  if (/xx/i.test(`${direccion} ${barrio}`)) return { estado: "no_encontrada" };
  const suma = [...direccion].reduce((s, c) => s + c.charCodeAt(0), 0);
  const km = Math.round(((suma % 62) / 10 + 0.3) * 10) / 10;
  const t = tarifaPorDistancia(km);
  return t
    ? { estado: 'ok', km, tarifa: t.tarifa, kmCobrados: t.kmCobrados, direccion_encontrada: `${direccion}, ${DOMICILIO.ciudad} (demo)` }
    : { estado: 'fuera', km, maxKm: DOMICILIO.maxKm };
}

// Demo del horario: ?cerrado=1 simula que el restaurante la cerró a mano.
export function escucharTienda(cb) {
  const cerrado = new URLSearchParams(window.location.search).get('cerrado');
  setTimeout(() => cb(cerrado ? { manual: { estado: 'cerrada', hasta: Date.now() + 86_400_000 } } : { manual: { estado: 'abierta', hasta: Date.now() + 3_600_000 } }), 50);
  return () => {};
}
