// Backend falso para la vista previa (sin Firebase).
import { CATEGORIAS, GRUPOS_OPCIONES, MENU_ITEMS } from '@shared/menu.seed.js';
import { aplicarMenuDelDia, armarMenuDelDia, vendible } from '@shared/menuDelDia.js';

// Menú del Día de demostración (solo vista previa).
const MDD_DEMO = armarMenuDelDia({ sopaDelDia: ['Sancocho de gallina'], proteinaDelDia: ['Res', 'Cañón de cerdo'], ensaladaDelDia: ['Lechuga primaveral', 'Pico de gallo'], bebidaDelDia: ['Jugo de mora'], disponible: true });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export function escucharMenu(cb) {
  const t = setTimeout(() => cb(aplicarMenuDelDia({
    categorias: CATEGORIAS.filter((c) => c.activo),
    items: MENU_ITEMS.filter(vendible),
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
