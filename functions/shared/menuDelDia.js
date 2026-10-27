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
 * Otros platos también pueden usar un grupo del Menú del Día (p. ej. los pescados
 * piden `mdd_sopa`): si no está vigente, ese grupo se les quita y se venden sin él,
 * para que no queden pidiendo una opción que no existe.
 * `menu.items` puede ser lista (apps) o mapa id → ítem (Cloud Functions).
 */
export function aplicarMenuDelDia(menu, doc, ahora = new Date()) {
  if (menuDelDiaVigente(doc, ahora)) return { ...menu, grupos: { ...menu.grupos, ...gruposDesdeMenuDelDia(doc) } };
  const sinMdd = (i) => {
    if (!i?.grupos_opciones?.some((r) => r.grupo_id in MDD_GRUPOS)) return i;
    const grupos_opciones = i.grupos_opciones.filter((r) => !(r.grupo_id in MDD_GRUPOS));
    return { ...i, grupos_opciones, tipo: grupos_opciones.length ? i.tipo : 'simple' };
  };
  const items = Array.isArray(menu.items)
    ? menu.items.filter((i) => i.id !== MDD_ITEM_ID).map(sinMdd)
    : Object.fromEntries(Object.entries(menu.items).filter(([id]) => id !== MDD_ITEM_ID).map(([id, i]) => [id, sinMdd(i)]));
  return { ...menu, items };
}

/** Un producto se muestra y se vende si está activo y no está agotado. */
export const vendible = (item) => item?.activo !== false && item?.agotado !== true;

// ─── Opciones frecuentes (para armar el menú con un toque) ───────────────
// restaurantes/{rid}/menu_del_dia/frecuentes: { sopaDelDia: ['Sancocho', …], proteinaDelDia: […], … }
// Cada vez que se publica, lo elegido pasa al principio de su lista. Solo el admin lo escribe.
export const MDD_FRECUENTES_DOC = 'frecuentes';
export const MDD_MAX_FRECUENTES = 30;

// Sugerencias de arranque mientras el restaurante no tiene historial propio.
// Las proteínas y bebidas salen de la carta de ISMA; el dueño puede quitar o sumar las que quiera.
export const MDD_SUGERENCIAS = {
  sopaDelDia: ['Sancocho', 'Frijoles', 'Lentejas', 'Sopa de verduras', 'Mondongo', 'Crema de ahuyama'],
  proteinaDelDia: ['Res', 'Cañón de cerdo', 'Pechuga', 'Chicharrón', 'Hígado encebollado', 'Res molida'],
  ensaladaDelDia: ['Ensalada fresca', 'Pico de gallo', 'Repollo con zanahoria', 'Remolacha'],
  bebidaDelDia: ['Jugo del día', 'Guandolo', 'Claro', 'Mazamorra', 'Limonada'],
};

/** Lista de nombres sin repetidos (ignora tildes y mayúsculas), con tope. */
function unirNombres(...listas) {
  const vistos = new Set();
  const salida = [];
  for (const n of listas.flat()) {
    const nombre = String(typeof n === 'string' ? n : n?.nombre || '').trim().replace(/\s+/g, ' ').slice(0, MDD_MAX_LARGO);
    const id = slugOpcion(nombre);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    salida.push(nombre);
    if (salida.length >= MDD_MAX_FRECUENTES) break;
  }
  return salida;
}

/** Frecuentes después de publicar `menu`: lo de hoy primero, luego lo anterior. */
export function actualizarFrecuentes(previos, menu) {
  return Object.fromEntries(
    Object.values(MDD_GRUPOS).map(({ campo }) => [campo, unirNombres(menu?.[campo] || [], previos?.[campo] || [])]),
  );
}

/** Chips para tocar: historial del restaurante + sugerencias de arranque. */
export function opcionesParaElegir(frecuentes, campo) {
  return unirNombres(frecuentes?.[campo] || [], MDD_SUGERENCIAS[campo] || []);
}

/** "Frijoles, lentejas" → ['Frijoles', 'lentejas'] (se puede escribir varias de una vez). */
export const separarOpciones = (texto) => String(texto).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
