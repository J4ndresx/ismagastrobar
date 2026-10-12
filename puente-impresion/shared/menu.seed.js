// Menú de ISMA GASTRO-BAR — estructura para Firestore
// restaurantes/{rid}/categorias, /grupos_opciones, /menu_items
//
// El "Menú del Día" NO se define aquí: el dueño lo arma cada día desde el
// panel (restaurantes/{rid}/menu_del_dia/actual, ver shared/menuDelDia.js).
// Aquí solo existe el ítem `menu_dia` con sus cuatro grupos obligatorios.
//
// ⚠️ PRECIOS: el cliente no los ha entregado. Todos están en 0 en la tabla
// PRECIOS de abajo; llénalos antes de cargar (scripts/cargar-menu.mjs se
// niega a cargar mientras haya precios en 0).

import { MDD_ITEM_ID, slugOpcion as slug } from './menuDelDia.js';

export const RID = 'isma';

// ─── Precios (COP) — COMPLETAR ─────────────────────────────────────────
export const PRECIOS = {
  menu_dia: 0,
  bandejita_paisa: 0, cazuela: 0, bandeja_paisa: 0,
  res: 0, canon_de_cerdo: 0, pechuga: 0, chicharron: 0, higado_encebollado: 0, res_molida: 0,
  churrasco: 0, punta_de_anca: 0, tilapia: 0, robalo: 0, trucha: 0,
  picada_paisa: 0,
  claro: 0, guandolo: 0, mazamorra: 0, jugo_del_dia: 0,
  ensalada: 0, pico_de_gallo: 0,
  // Parrilla y Especiales (tarde/noche)
  patacon_montanero_isma: 22000, salchipapa_especial: 22000, hamburguesa_artesanal: 27000,
  chuzo_cerdo_pollo: 24000, canon_campestre: 24000, asado_premium: 38000, picada_paisa_especial: 40000,
};

// ─── Zonas de preparación (a dónde se imprime cada comanda) ────────────
export const ZONAS = {
  cocina: { id: 'cocina', nombre: 'Cocina', titulo_ticket: 'COCINA', imprime: true, orden: 1 },
  general: { id: 'general', nombre: 'General', titulo_ticket: 'GENERAL', imprime: false, orden: 2 },
};

// ─── Categorías ────────────────────────────────────────────────────────
// tipo_ui: 'subcategorias' | 'grilla'
export const CATEGORIAS = [
  { id: 'menu_del_dia', nombre: 'Menú del Día', parent_id: null, orden: 1, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  { id: 'tradicional', nombre: 'Tradicional', parent_id: null, orden: 2, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  { id: 'proteinas', nombre: 'Proteínas', parent_id: null, orden: 3, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  { id: 'a_la_carta', nombre: 'A la Carta', parent_id: null, orden: 4, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  { id: 'picadas', nombre: 'Picadas', parent_id: null, orden: 5, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  { id: 'bebidas', nombre: 'Bebidas', parent_id: null, orden: 6, zona_preparacion: 'general', tipo_ui: 'grilla' },
  { id: 'adicionales', nombre: 'Adicionales', parent_id: null, orden: 7, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  // Platos de la tarde/noche. tema 'oscuro': el POS y la app la muestran en fondo negro con precios dorados.
  // orden 5.5 = queda justo después de Picadas sin cambiar el orden de las demás.
  { id: 'parrilla_especiales', nombre: 'Parrilla y Especiales', parent_id: null, orden: 5.5, zona_preparacion: 'cocina', tipo_ui: 'grilla', tema: 'oscuro' },
].map((c) => ({ activo: true, ...c }));

// ─── Grupos de opciones (modificadores de elección) ────────────────────
// Los de Menú del Día (mdd_sopa, mdd_proteina, mdd_ensalada, mdd_bebida) NO van aquí: salen de menu_del_dia/actual.
const op = (nombre, extra = {}) => ({ id: slug(nombre), nombre, activo: true, precio_extra: 0, ...extra });

export const GRUPOS_OPCIONES = [
  { id: 'termino_carne', nombre: 'Término', opciones: [op('3/4'), op('Bien asado')] },
  { id: 'acompanamiento', nombre: 'Acompañamiento', opciones: [op('Papas'), op('Yuca'), op('Ensalada')] },
  { id: 'porcion_picada', nombre: 'Porción', opciones: [op('Para 2 personas')] },
  { id: 'corte_asado', nombre: 'Corte', opciones: [op('Punta de anca'), op('Churrasco')] },
  { id: 'carne_chuzo', nombre: 'Carne', opciones: [op('Cerdo'), op('Pollo')] },
];

// ─── Ítems ─────────────────────────────────────────────────────────────
const catById = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));
const items = [];
const ordenPorCat = {};

/** g(): referencia a un grupo de opciones (min/max = cuántas debe elegir). */
const g = (grupo_id, etiqueta, min, max) => ({ grupo_id, etiqueta, min, max });

function item(catId, nombre, extra = {}) {
  const cat = catById[catId];
  const id = extra.id || slug(nombre);
  if (!(id in PRECIOS)) throw new Error(`Falta el precio de "${id}" en PRECIOS`);
  ordenPorCat[catId] = (ordenPorCat[catId] || 0) + 1;
  const grupos = extra.grupos_opciones || [];
  items.push({
    id,
    nombre,
    nombre_comanda: (extra.nombre_comanda || nombre).toUpperCase(),
    descripcion: extra.descripcion || '',
    categoria_id: cat.id,
    subcategoria_id: null,
    ruta: [cat.id],
    zona_preparacion: extra.zona_preparacion || cat.zona_preparacion,
    tipo: grupos.length ? 'configurable' : 'simple',
    grupos_opciones: grupos,
    modificadores: extra.modificadores || [],
    precio: PRECIOS[id],
    orden: ordenPorCat[catId],
    activo: true,
    ...(extra.aviso ? { aviso: extra.aviso } : {}),
    ...(PRECIOS[id] === 0 ? { precio_por_confirmar: true } : {}),
  });
}

// MENÚ DEL DÍA — sopa, proteína, ensalada y bebida obligatorias; sus opciones las pone el dueño cada día.
item('menu_del_dia', 'Menú del Día', {
  id: MDD_ITEM_ID,
  nombre_comanda: 'MENU DEL DIA',
  descripcion: 'Sopa, proteína, ensalada y bebida del día',
  grupos_opciones: [g('mdd_sopa', 'Sopa', 1, 1), g('mdd_proteina', 'Proteína', 1, 1), g('mdd_ensalada', 'Ensalada', 1, 1), g('mdd_bebida', 'Bebida', 1, 1)],
});

// TRADICIONAL
item('tradicional', 'Bandejita paisa');
item('tradicional', 'Cazuela');
item('tradicional', 'Bandeja paisa');

// PROTEÍNAS
for (const n of ['Res', 'Cañón de cerdo', 'Pechuga', 'Chicharrón', 'Hígado encebollado', 'Res molida']) item('proteinas', n);

// A LA CARTA — término y acompañamiento obligatorios en carnes rojas de 270 g.
// ⚠️ Supuesto a confirmar con el cliente: Punta de Anca lleva lo mismo que el Churrasco.
const CARNE_270 = [g('termino_carne', 'Término', 1, 1), g('acompanamiento', 'Acompañamiento', 1, 1)];
item('a_la_carta', 'Churrasco 270g', { id: 'churrasco', nombre_comanda: 'CHURRASCO 270G', grupos_opciones: CARNE_270 });
item('a_la_carta', 'Punta de Anca 270g', { id: 'punta_de_anca', nombre_comanda: 'PUNTA ANCA 270G', grupos_opciones: CARNE_270 });
item('a_la_carta', 'Tilapia 500g', { id: 'tilapia', nombre_comanda: 'TILAPIA 500G' });
item('a_la_carta', 'Róbalo', { id: 'robalo' });
item('a_la_carta', 'Trucha');

// PICADAS
item('picadas', 'Picada Paisa', { descripcion: 'Para 2 personas', grupos_opciones: [g('porcion_picada', 'Porción', 1, 1)] });

// BEBIDAS
for (const [n, id] of [['Claro', 'claro'], ['Guandolo', 'guandolo'], ['Mazamorra', 'mazamorra'], ['Jugo del día', 'jugo_del_dia']]) item('bebidas', n, { id });

// ADICIONALES
item('adicionales', 'Ensalada');
item('adicionales', 'Pico de gallo', { id: 'pico_de_gallo' });

// PARRILLA Y ESPECIALES (tarde/noche)
const PE = 'parrilla_especiales';
item(PE, 'Patacón Montañero ISMA', { id: 'patacon_montanero_isma', nombre_comanda: 'PATACON MONTANERO',
  descripcion: 'Trozos de cerdo, trozos de chorizo de ternera, queso, maíz tierno, adición hogao y tiras de papa.' });
item(PE, 'Salchipapa Especial', { id: 'salchipapa_especial', nombre_comanda: 'SALCHIPAPA ESPECIAL',
  descripcion: 'Papas a la francesa, trozos de pechuga de cerdo, trozos de chorizo de ternera, huevo, queso y salsas.' });
item(PE, 'Hamburguesa Artesanal', { id: 'hamburguesa_artesanal', nombre_comanda: 'HAMBURGUESA ARTESANAL',
  descripcion: 'Pan artesanal, gratinada lechuga, carne 150g, tocineta, salsa de la casa, papas a la francesa.' });
item(PE, 'Chuzo de Cerdo / Pollo', { id: 'chuzo_cerdo_pollo', nombre_comanda: 'CHUZO',
  descripcion: 'Papas a la francesa, ensalada mixta y salsas.',
  grupos_opciones: [g('carne_chuzo', 'Carne', 1, 1)] });
item(PE, 'Cañón Campestre', { id: 'canon_campestre', nombre_comanda: 'CANON CAMPESTRE',
  descripcion: 'Papas a la francesa, arroz, ensalada y ensalada.' });
item(PE, 'Asado Premium', { id: 'asado_premium', nombre_comanda: 'ASADO PREMIUM 270G',
  descripcion: 'Punta de anca o churrasco a 270 gramos. (Papas a la francesa y yuca crocante / pasteles). Arepa, queso y ensalada.',
  grupos_opciones: [g('corte_asado', 'Corte', 1, 1), g('termino_carne', 'Término', 1, 1)] });
// Id distinto al de Picadas → 'picada_paisa' (esa no se toca).
item(PE, 'Picada Paisa', { id: 'picada_paisa_especial', nombre_comanda: 'PICADA PAISA',
  descripcion: 'Cerdo, chorizo, chicharrón, morcilla, patacón, arepa y hogao.', aviso: 'Para 2 personas' });

export const MENU_ITEMS = items;
