// Menú del Día — fuente única: restaurantes/{rid}/menu_del_dia/actual
//
//   { sopaDelDia: [{id,nombre}], proteinaDelDia: [...], ensaladaDelDia: [...], bebidaDelDia: [...],
//     fecha: 'YYYY-MM-DD' (día de Bogotá), disponible: boolean,
//     actualizado_en, actualizado_por }
//
// Cada lista puede tener 1 o más opciones: con 1 queda fija, con varias el
// cliente elige. El ítem `menu_dia` (menu_items) tiene cuatro grupos obligatorios
// (mdd_sopa, mdd_proteina, mdd_ensalada, mdd_bebida) cuyas opciones SALEN DE ESTE DOCUMENTO:
// no se guardan en grupos_opciones, se inyectan con aplicarMenuDelDia(). Así
// la app del cliente, el POS y la Cloud Function que verifica precios usan
// exactamente la misma lógica y no hay dos copias que puedan desincronizarse.

export const MDD_DOC = 'actual';
export const MDD_ITEM_ID = 'menu_dia';
export const MDD_MAX_OPCIONES = 8;
export const MDD_MAX_LARGO = 40;

// grupo_id → campo del documento
export const MDD_GRUPOS = {
  mdd_sopa: { campo: 'sopaDelDia', nombre: 'Sopa' },
  mdd_proteina: { campo: 'proteinaDelDia', nombre: 'Proteína' },
  mdd_ensalada: { campo: 'ensaladaDelDia', nombre: 'Ensalada' },
  mdd_bebida: { campo: 'bebidaDelDia', nombre: 'Bebida' },
};

/** Fecha (YYYY-MM-DD) en Bogotá, UTC-5 sin horario de verano. */
export const hoyBogota = (ahora = new Date()) => new Date(ahora.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);

export function slugOpcion(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Acepta ['Sancocho'] o [{id,nombre}]; devuelve [{id,nombre}] sin repetidos, recortado y con tope. */
export function normalizarLista(valor) {
  const vistos = new Set();
  const salida = [];
  for (const v of Array.isArray(valor) ? valor : []) {
    const nombre = String(typeof v === 'string' ? v : v?.nombre || '').trim().replace(/\s+/g, ' ').slice(0, MDD_MAX_LARGO);
    const id = slugOpcion(nombre);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    salida.push({ id, nombre });
    if (salida.length >= MDD_MAX_OPCIONES) break;
  }
  return salida;
}

/** Documento listo para guardar (valida que haya al menos una opción por grupo). */
export function armarMenuDelDia({ sopaDelDia, proteinaDelDia, ensaladaDelDia, bebidaDelDia, disponible }, ahora = new Date()) {
  const doc = {
    sopaDelDia: normalizarLista(sopaDelDia),
    proteinaDelDia: normalizarLista(proteinaDelDia),
    ensaladaDelDia: normalizarLista(ensaladaDelDia),
    bebidaDelDia: normalizarLista(bebidaDelDia),
    fecha: hoyBogota(ahora),
    disponible: disponible === true,
  };
  const faltan = Object.values(MDD_GRUPOS).filter((g) => doc[g.campo].length === 0).map((g) => g.nombre.toLowerCase());
  if (doc.disponible && faltan.length) throw new Error(`Falta elegir: ${faltan.join(', ')}.`);
  return doc;
}

/** ¿El cliente puede pedirlo ahora? Debe estar activado, ser de HOY y tener las cuatro partes. */
export function menuDelDiaVigente(doc, ahora = new Date()) {
  if (!doc || doc.disponible !== true || doc.fecha !== hoyBogota(ahora)) return false;
  return Object.values(MDD_GRUPOS).every((g) => Array.isArray(doc[g.campo]) && doc[g.campo].length > 0);
}

/** Los cuatro grupos de opciones en el mismo formato que grupos_opciones. */
export function gruposDesdeMenuDelDia(doc) {
  return Object.fromEntries(
    Object.entries(MDD_GRUPOS).map(([id, { campo, nombre }]) => [
      id,
      { id, nombre, opciones: (doc?.[campo] || []).map((o) => ({ id: o.id, nombre: o.nombre, activo: true, precio_extra: 0 })) },
    ]),
  );
}

/**
 * Devuelve el menú con el Menú del Día aplicado: si no está vigente, el ítem
 * `menu_dia` desaparece; si lo está, se inyectan sus cuatro grupos.
 * `menu.items` puede ser lista (apps) o mapa id → ítem (Cloud Functions).
 */
export function aplicarMenuDelDia(menu, doc, ahora = new Date()) {
  if (menuDelDiaVigente(doc, ahora)) return { ...menu, grupos: { ...menu.grupos, ...gruposDesdeMenuDelDia(doc) } };
  const items = Array.isArray(menu.items)
    ? menu.items.filter((i) => i.id !== MDD_ITEM_ID)
    : Object.fromEntries(Object.entries(menu.items).filter(([id]) => id !== MDD_ITEM_ID));
  return { ...menu, items };
}

/** Un producto se muestra y se vende si está activo y no está agotado. */
export const vendible = (item) => item?.activo !== false && item?.agotado !== true;
