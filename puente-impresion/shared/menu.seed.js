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
  // Desayunos
  desayuno_sencillo: 12000, desayuno_especial: 14000, calentado_sencillo: 14000, calentado_completo: 16000, sandwich_atun: 19000,
  menu_dia: 0,
  bandejita_paisa: 0, cazuela: 0, bandeja_paisa: 0,
  res: 0, canon_de_cerdo: 0, pechuga: 0, chicharron: 0, higado_encebollado: 0, res_molida: 0,
  churrasco: 0, punta_de_anca: 0, tilapia: 0, robalo: 0, trucha: 0,
  picada_paisa: 0,
  // ⚠️ Bebidas y Adicionales: PRECIOS DE EJEMPLO (puestos para poder cargar). Reemplazar por los reales de ISMA.
  // Bebidas (por subcategoría)
  jugo_del_dia: 6000, limonada_natural: 6000, limonada_de_coco: 9000, claro: 4000, guandolo: 4000, mazamorra: 5000,
  cerveza_aguila: 5000, cerveza_poker: 5000, cerveza_pilsen: 5000, cerveza_club_colombia: 6000, cerveza_corona: 9000,
  aguardiente_trago: 6000, aguardiente_media: 45000, aguardiente_botella: 85000, ron_trago: 7000, ron_media: 50000, ron_botella: 95000,
  coca_cola_personal: 4500, postobon_personal: 4000, gaseosa_litro: 8000, agua: 3500, agua_con_gas: 4000,
  refajo_vaso: 6000, refajo_jarra: 22000, red_bull: 9000, vive_100: 4500,
  gatorade: 6000, electrolit: 9000,
  michelada: 9000, mojito: 18000, margarita: 18000, pina_colada: 18000, cuba_libre: 15000,
  // Adicionales (por subcategoría)
  adic_res: 9000, adic_cerdo: 8000, adic_pollo: 8000, adic_chicharron: 8000, adic_chorizo: 5000,
  adic_queso: 4000, adic_tocineta: 4000, adic_huevo: 2500,
  adic_maduro: 4000, adic_patacon: 4000, adic_yuca: 4000, adic_papas: 5000, adic_arroz: 3000, adic_arepa: 2000, ensalada: 4000, pico_de_gallo: 3000,
  adic_chimichurri: 2000, adic_tartara: 2000, adic_ajo: 2000, adic_bbq: 2000, adic_hogao: 2000,
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
  // orden 0.5 = primera en el POS y en la app, sin cambiar el orden de las demás.
  { id: 'desayunos', nombre: 'Desayunos', parent_id: null, orden: 0.5, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
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

  // ── Subcategorías (parent_id = categoría madre). La app del cliente las muestra como
  //    pestañas dentro de la categoría; el POS ya las mostraba como pestañas.
  //    `dinamica: true` = su contenido cambia cada día (el admin prende/apaga los productos
  //    desde "Agotados" y el cliente lo ve al instante; si no hay ninguno, la pestaña no sale).
  ...[
    ['bebidas_del_dia', 'Jugos y Bebidas del Día', { dinamica: true }],
    ['cervezas', 'Cervezas'],
    ['licores', 'Licores y Tragos'],
    ['gaseosas', 'Gaseosas y Agua'],
    ['refajos', 'Refajos y Energizantes'],
    ['hidratantes', 'Hidratantes'],
    ['cocteles', 'Cócteles'],
  ].map(([id, nombre, extra], k) => ({ id, nombre, parent_id: 'bebidas', orden: k + 1, zona_preparacion: 'general', tipo_ui: 'grilla', ...extra })),
  ...[
    ['adic_carnes', 'Porciones de carne'],
    ['adic_extras', 'Queso, tocineta y huevo'],
    ['adic_acompanamientos', 'Acompañamientos'],
    ['adic_salsas', 'Salsas'],
  ].map(([id, nombre], k) => ({ id, nombre, parent_id: 'adicionales', orden: k + 1, zona_preparacion: 'cocina', tipo_ui: 'grilla' })),
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
  // Desayunos (listas confirmadas por ISMA el 2026-10-25). El admin apaga una opción (p. ej. "no hay chorizo") desde Agotados → Opciones.
  { id: 'proteina_desayuno', nombre: 'Proteína', opciones: [op('Res'), op('Cerdo'), op('Pechuga'), op('Chicharrón'), op('Hígado encebollado'), op('Res molida'), op('Chorizo'), op('Morcilla')] },
  // El id sigue siendo bebida_caliente para no dejar un grupo huérfano en Firestore; incluye el jugo frío.
  { id: 'bebida_caliente', nombre: 'Bebida', opciones: [op('Aromática'), op('Café'), op('Tinto'), op('Chocolate oscuro'), op('Chocolate en leche'), op('Jugo frío del día')] },
  { id: 'huevos_al_gusto', nombre: 'Huevos', opciones: [op('Fritos'), op('Revueltos'), op('Revueltos con aliños'), op('Pericos')] },
  { id: 'sabor_postobon', nombre: 'Sabor', opciones: [op('Colombiana'), op('Manzana'), op('Naranja'), op('Uva')] },
  { id: 'sabor_gatorade', nombre: 'Sabor', opciones: [op('Mandarina'), op('Tropical'), op('Uva'), op('Limón')] },
];

// ─── Ítems ─────────────────────────────────────────────────────────────
const catById = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));
const items = [];
const ordenPorCat = {};

/** g(): referencia a un grupo de opciones (min/max = cuántas debe elegir). */
const g = (grupo_id, etiqueta, min, max) => ({ grupo_id, etiqueta, min, max });

function item(catId, nombre, extra = {}) {
  const cat = catById[catId];
  const sub = extra.sub ? catById[extra.sub] : null;
  if (extra.sub && sub?.parent_id !== catId) throw new Error(`Subcategoría "${extra.sub}" no pertenece a "${catId}"`);
  const id = extra.id || slug(nombre);
  if (!(id in PRECIOS)) throw new Error(`Falta el precio de "${id}" en PRECIOS`);
  const llaveOrden = sub ? sub.id : catId;
  ordenPorCat[llaveOrden] = (ordenPorCat[llaveOrden] || 0) + 1;
  const grupos = extra.grupos_opciones || [];
  items.push({
    id,
    nombre,
    nombre_comanda: (extra.nombre_comanda || nombre).toUpperCase(),
    descripcion: extra.descripcion || '',
    categoria_id: cat.id,
    subcategoria_id: sub ? sub.id : null,
    ruta: sub ? [cat.id, sub.id] : [cat.id],
    zona_preparacion: extra.zona_preparacion || cat.zona_preparacion,
    tipo: grupos.length ? 'configurable' : 'simple',
    grupos_opciones: grupos,
    modificadores: extra.modificadores || [],
    precio: PRECIOS[id],
    orden: ordenPorCat[llaveOrden],
    activo: true,
    ...(extra.aviso ? { aviso: extra.aviso } : {}),
    ...(PRECIOS[id] === 0 ? { precio_por_confirmar: true } : {}),
  });
}

// DESAYUNOS
// "Huevos al gusto" se pide como opción obligatoria para que la cocina sepa cómo prepararlos.
const HUEVOS = g('huevos_al_gusto', 'Huevos', 1, 1);
const BEBIDA_CALIENTE = g('bebida_caliente', 'Bebida', 1, 1);
item('desayunos', 'Desayuno Sencillo', { id: 'desayuno_sencillo', nombre_comanda: 'DESAYUNO SENCILLO',
  descripcion: 'Dos huevos al gusto, arepa tela antioqueña, quesito en tajadas y bebida a elección.',
  grupos_opciones: [BEBIDA_CALIENTE, HUEVOS] });
item('desayunos', 'Desayuno Especial', { id: 'desayuno_especial', nombre_comanda: 'DESAYUNO ESPECIAL',
  descripcion: 'Dos huevos al gusto, proteína a elección, arepa tela antioqueña, quesito en tajadas y bebida a elección.',
  grupos_opciones: [g('proteina_desayuno', 'Proteína', 1, 1), BEBIDA_CALIENTE, HUEVOS] });
item('desayunos', 'Calentado Sencillo', { id: 'calentado_sencillo', nombre_comanda: 'CALENTADO SENCILLO',
  descripcion: 'Frijoles, arroz, carne molida, dos huevos al gusto, arepa tela antioqueña, quesito en tajadas y tajada de maduro.',
  grupos_opciones: [HUEVOS] });
item('desayunos', 'Calentado Completo', { id: 'calentado_completo', nombre_comanda: 'CALENTADO COMPLETO',
  descripcion: 'Frijoles, arroz, carne molida, chicharrón crocante, dos huevos al gusto, arepa tela antioqueña, quesito en tajadas y tajada de maduro.',
  grupos_opciones: [HUEVOS] });
item('desayunos', 'Sándwich Artesanal de Atún Premium', { id: 'sandwich_atun', nombre_comanda: 'SANDWICH ATUN',
  descripcion: 'Pan artesanal con queso, relleno de atún premium de alta calidad, dos huevos batidos, aguacate fresco, lechuga y tomate. Acompañado de una taza de chocolate caliente.' });

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

// BEBIDAS — ⚠️ Lista de EJEMPLO para la demo: confirmar con ISMA marcas, presentaciones y precios.
const beb = (sub, lista) => lista.forEach(([nombre, id, extra = {}]) => item('bebidas', nombre, { id, sub, ...extra }));
beb('bebidas_del_dia', [
  ['Jugo del día', 'jugo_del_dia', { descripcion: 'Pregunta el sabor de hoy' }],
  ['Limonada natural', 'limonada_natural'],
  ['Limonada de coco', 'limonada_de_coco'],
  ['Claro', 'claro'],
  ['Guandolo', 'guandolo'],
  ['Mazamorra', 'mazamorra'],
]);
beb('cervezas', [
  ['Águila', 'cerveza_aguila'], ['Poker', 'cerveza_poker'], ['Pilsen', 'cerveza_pilsen'],
  ['Club Colombia', 'cerveza_club_colombia'], ['Corona', 'cerveza_corona'],
]);
beb('licores', [
  ['Aguardiente Antioqueño · Trago', 'aguardiente_trago', { nombre_comanda: 'AGUARDIENTE TRAGO' }],
  ['Aguardiente Antioqueño · Media', 'aguardiente_media', { nombre_comanda: 'AGUARDIENTE MEDIA' }],
  ['Aguardiente Antioqueño · Botella', 'aguardiente_botella', { nombre_comanda: 'AGUARDIENTE BOTELLA' }],
  ['Ron Medellín · Trago', 'ron_trago', { nombre_comanda: 'RON TRAGO' }],
  ['Ron Medellín · Media', 'ron_media', { nombre_comanda: 'RON MEDIA' }],
  ['Ron Medellín · Botella', 'ron_botella', { nombre_comanda: 'RON BOTELLA' }],
]);
beb('gaseosas', [
  ['Coca-Cola personal', 'coca_cola_personal'],
  ['Postobón personal', 'postobon_personal', { grupos_opciones: [g('sabor_postobon', 'Sabor', 1, 1)] }],
  ['Gaseosa 1.5 L', 'gaseosa_litro', { descripcion: 'Para compartir' }],
  ['Agua', 'agua'],
  ['Agua con gas', 'agua_con_gas'],
]);
beb('refajos', [
  ['Refajo · Vaso', 'refajo_vaso', { nombre_comanda: 'REFAJO VASO' }],
  ['Refajo · Jarra', 'refajo_jarra', { nombre_comanda: 'REFAJO JARRA', descripcion: 'Para compartir' }],
  ['Red Bull', 'red_bull'],
  ['Vive 100', 'vive_100'],
]);
beb('hidratantes', [
  ['Gatorade', 'gatorade', { grupos_opciones: [g('sabor_gatorade', 'Sabor', 1, 1)] }],
  ['Electrolit', 'electrolit'],
]);
beb('cocteles', [
  ['Michelada', 'michelada'], ['Mojito', 'mojito'], ['Margarita', 'margarita'],
  ['Piña colada', 'pina_colada'], ['Cuba libre', 'cuba_libre'],
]);

// ADICIONALES — extras que el cliente suma a su pedido. ⚠️ EJEMPLO: confirmar con ISMA.
const adic = (sub, lista) => lista.forEach(([nombre, id, extra = {}]) => item('adicionales', nombre, { id, sub, ...extra }));
adic('adic_carnes', [
  ['Porción de res', 'adic_res'], ['Porción de cerdo', 'adic_cerdo'], ['Porción de pollo', 'adic_pollo'],
  ['Porción de chicharrón', 'adic_chicharron'], ['Chorizo', 'adic_chorizo'],
]);
adic('adic_extras', [['Queso', 'adic_queso'], ['Tocineta', 'adic_tocineta'], ['Huevo frito', 'adic_huevo']]);
adic('adic_acompanamientos', [
  ['Plátano maduro', 'adic_maduro'], ['Patacón', 'adic_patacon'], ['Yuca', 'adic_yuca'],
  ['Papas a la francesa', 'adic_papas'], ['Arroz', 'adic_arroz'], ['Arepa', 'adic_arepa'],
  ['Ensalada', 'ensalada'], ['Pico de gallo', 'pico_de_gallo'],
]);
adic('adic_salsas', [
  ['Chimichurri', 'adic_chimichurri'], ['Tártara', 'adic_tartara'], ['Salsa de ajo', 'adic_ajo'],
  ['BBQ', 'adic_bbq'], ['Hogao', 'adic_hogao'],
]);

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
