// Menú de ISMA GASTRO-BAR — estructura para Firestore
// restaurantes/{rid}/categorias, /grupos_opciones, /menu_items
//
// El "Menú del Día" NO se define aquí: el dueño lo arma cada día desde el
// panel (restaurantes/{rid}/menu_del_dia/actual, ver shared/menuDelDia.js).
// Aquí solo existe el ítem `menu_dia` con sus cuatro grupos obligatorios.
//
// ⚠️ PRECIOS: los de Desayunos, Menú del Día, Tradicional y A la Carta son
// reales (ISMA, 2026-10-25), igual que Bebidas. Adicionales tienen precios de EJEMPLO.
// Proteínas y Picadas siguen en 0: scripts/cargar-menu.mjs
// y cargar-categoria.mjs se niegan a cargar mientras haya precios en 0.

import { MDD_ITEM_ID, slugOpcion as slug } from './menuDelDia.js';

export const RID = 'isma';

// ─── Precios (COP) — COMPLETAR ─────────────────────────────────────────
export const PRECIOS = {
  // Desayunos
  desayuno_sencillo: 12000, desayuno_especial: 15000, calentado_sencillo: 16000, calentado_completo: 17000, sandwich_atun: 21000,
  menu_dia: 19000,
  // Tradicional (precios reales ISMA, 2026-10-25)
  bandejita_paisa: 21000, cazuela: 24000, bandeja_paisa: 34000,
  sancocho_trifasico: 27000, sancocho_res_cerdo: 22000, mondongo: 22000, sancocho_bagre: 25000,
  // ⚠️ Proteínas: siguen en 0 (ISMA no las incluyó en la lista del 2026-10-25)
  res: 0, canon_de_cerdo: 0, pechuga: 0, chicharron: 0, higado_encebollado: 0, res_molida: 0,
  // A la Carta (precios reales ISMA, 2026-10-25)
  churrasco: 42000, punta_de_anca: 42000, tilapia: 34000, filete_tilapia: 23000, robalo: 21000, trucha: 28000,
  // ⚠️ Picadas: sigue en 0 (pendiente con ISMA, ver duplicado con Parrilla)
  picada_paisa: 0,
  // Bebidas (lista y precios reales ISMA, 2026-10-25)
  // Cervezas
  cerveza_heineken_269: 5000, cerveza_heineken_zero_269: 5000, cerveza_heineken_473: 6000, cerveza_heineken_330: 5000,
  cerveza_andina_473: 6000, cerveza_mistica_330: 6000, cerveza_pilsen: 5000, cerveza_aguila_light: 5000, cerveza_aguila_negra: 5000,
  cerveza_poker: 5000, cerveza_costenita: 5000, cerveza_corona: 7000, cerveza_corona_zero: 6000, cerveza_club_colombia: 6000,
  cerveza_3_cordilleras: 9000,
  // Energizantes
  speed_473: 5000, speed_310: 3000, speed_250: 2500, red_bull: 11000,
  // Hidratantes
  gatorade: 5000, gatorlit: 7000,
  // Mezcladores
  bretana_1500: 6000, bretana_310: 4000, bretana_mango_lulo: 5000, mezclador_quatro_400: 4000,
  mezclador_coca_cola_400: 4000, coca_cola_1500: 7000, quatro_1500: 7000,
  // Aguas
  agua_cristal_250: 1500, agua_cristal_600: 3000, agua_cristal_aloe: 3500, agua_cristal_gas_1l: 5000,
  agua_h2o_600: 5000, agua_h2o_250: 2500, agua_acqua_600: 5000,
  // Gaseosas
  gaseosa_personal: 4000, gaseosa_1500: 6000,
  // Jugos Hit
  hit_cajita: 2000, hit_botella: 5000,
  // ⚠️ Adicionales: PRECIOS DE EJEMPLO (puestos para poder cargar). Reemplazar por los reales de ISMA.
  // Adicionales (por subcategoría)
  adic_res: 9000, adic_cerdo: 8000, adic_pollo: 8000, adic_chicharron: 8000, adic_chorizo: 5000,
  adic_queso: 4000, adic_tocineta: 4000, adic_huevo: 2500,
  adic_maduro: 4000, adic_patacon: 4000, adic_yuca: 4000, adic_papas: 5000, adic_arroz: 3000, adic_arepa: 2000, ensalada: 4000, pico_de_gallo: 3000,
  adic_chimichurri: 2000, adic_tartara: 2000, adic_ajo: 2000, adic_bbq: 2000, adic_hogao: 2000,
  // Parrilla y Especiales (tarde/noche)
  patacon_montanero_isma: 24000, salchipapa_especial: 22000, hamburguesa_artesanal: 27000,
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
  // A la Carta se partió en Pescado y Asados (tema 9). Queda inactiva y sin productos para que
  // `cargar-categoria.mjs a_la_carta` la apague en Firestore; no borrar mientras exista allá.
  { id: 'a_la_carta', nombre: 'A la Carta', parent_id: null, orden: 4, zona_preparacion: 'cocina', tipo_ui: 'grilla', activo: false },
  { id: 'pescado', nombre: 'Pescado', parent_id: null, orden: 4.1, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  { id: 'asados', nombre: 'Asados', parent_id: null, orden: 4.2, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  { id: 'picadas', nombre: 'Picadas', parent_id: null, orden: 5, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  { id: 'bebidas', nombre: 'Bebidas', parent_id: null, orden: 6, zona_preparacion: 'general', tipo_ui: 'grilla' },
  { id: 'adicionales', nombre: 'Adicionales', parent_id: null, orden: 7, zona_preparacion: 'cocina', tipo_ui: 'grilla' },
  // Platos de la tarde/noche. tema 'oscuro': el POS y la app la muestran en fondo negro con precios dorados.
  // orden 5.5 = queda justo después de Picadas sin cambiar el orden de las demás.
  { id: 'parrilla_especiales', nombre: 'Parrilla y Especiales', parent_id: null, orden: 5.5, zona_preparacion: 'cocina', tipo_ui: 'grilla', tema: 'oscuro' },

  // ── Subcategorías (parent_id = categoría madre). La app del cliente las muestra como
  //    pestañas dentro de la categoría; el POS ya las mostraba como pestañas.
  ...[
    ['cervezas', 'Cervezas'],
    ['energizantes', 'Energizantes'],
    ['hidratantes', 'Hidratantes'],
    ['mezcladores', 'Mezcladores'],
    ['aguas', 'Aguas'],
    ['gaseosas', 'Gaseosas'],
    ['jugos_hit', 'Jugos Hit'],
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
  // Pescados (tema 9): el cliente elige uno de los dos acompañamientos.
  { id: 'acompanamiento_pescado', nombre: 'Acompañamiento', opciones: [
    op('Arroz, ensalada, tajada de maduro, arepa', { id: 'con_arroz' }),
    op('Patacón, ensalada', { id: 'con_patacon' }),
  ] },
  { id: 'porcion_picada', nombre: 'Porción', opciones: [op('Para 2 personas')] },
  { id: 'corte_asado', nombre: 'Corte', opciones: [op('Punta de anca'), op('Churrasco')] },
  { id: 'carne_chuzo', nombre: 'Carne', opciones: [op('Cerdo'), op('Pollo')] },
  { id: 'carne_sancocho', nombre: 'Carne', opciones: [op('Res'), op('Cerdo')] },
  // Desayunos (listas confirmadas por ISMA el 2026-10-25). El admin apaga una opción (p. ej. "no hay chorizo") desde Agotados → Opciones.
  { id: 'proteina_desayuno', nombre: 'Proteína', opciones: [op('Res'), op('Cerdo'), op('Pechuga'), op('Chicharrón'), op('Hígado encebollado'), op('Res molida'), op('Chorizo'), op('Morcilla')] },
  // El id sigue siendo bebida_caliente para no dejar un grupo huérfano en Firestore; incluye el jugo frío.
  { id: 'bebida_caliente', nombre: 'Bebida', opciones: [op('Aromática'), op('Café'), op('Tinto'), op('Chocolate oscuro'), op('Chocolate en leche'), op('Jugo frío del día')] },
  { id: 'huevos_al_gusto', nombre: 'Huevos', opciones: [op('Fritos'), op('Revueltos'), op('Revueltos con aliños'), op('Pericos')] },
  // Bebidas: sabores/estilos (el admin apaga el que se acabe desde Agotados → Opciones).
  { id: 'estilo_3_cordilleras', nombre: 'Estilo', opciones: [op('Mulata'), op('Rosé'), op('Blanca'), op('Mestiza')] },
  { id: 'sabor_gatorade', nombre: 'Sabor', opciones: [op('Tropical'), op('Mandarina'), op('Gold'), op('Blue'), op('Maracuyá')] },
  { id: 'sabor_gatorlit', nombre: 'Sabor', opciones: [op('Uva'), op('Frambuesa')] },
  { id: 'sabor_gaseosa_personal', nombre: 'Sabor', opciones: [op('Naranja'), op('Manzana'), op('Uva'), op('Colombiana'), op('Tamarindo'), op('Pepsi'), op('Piña'), op('Coca-Cola Zero'), op('Coca-Cola Original'), op('Quatro'), op('Premium')] },
  { id: 'sabor_gaseosa_litro', nombre: 'Sabor', opciones: [op('Manzana'), op('Uva'), op('Colombiana')] },
  { id: 'sabor_hit_cajita', nombre: 'Sabor', opciones: [op('Lulo'), op('Naranja-Piña'), op('Mango'), op('Mora'), op('Tropical')] },
  { id: 'sabor_hit_botella', nombre: 'Sabor', opciones: [op('Lulo'), op('Mango'), op('Tropical')] },
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
item('tradicional', 'Sancocho Trifásico', { id: 'sancocho_trifasico', nombre_comanda: 'SANCOCHO TRIFASICO' });
item('tradicional', 'Sancocho de Res o Cerdo', { id: 'sancocho_res_cerdo', nombre_comanda: 'SANCOCHO',
  grupos_opciones: [g('carne_sancocho', 'Carne', 1, 1)] });
item('tradicional', 'Mondongo', { id: 'mondongo', nombre_comanda: 'MONDONGO' });
item('tradicional', 'Sancocho de Bagre', { id: 'sancocho_bagre', nombre_comanda: 'SANCOCHO BAGRE' });

// PROTEÍNAS
for (const n of ['Res', 'Cañón de cerdo', 'Pechuga', 'Chicharrón', 'Hígado encebollado', 'Res molida']) item('proteinas', n);

// ASADOS — término y acompañamiento obligatorios en carnes rojas de 270 g.
// ⚠️ Supuesto a confirmar con el cliente: Punta de Anca lleva lo mismo que el Churrasco.
const CARNE_270 = [g('termino_carne', 'Término', 1, 1), g('acompanamiento', 'Acompañamiento', 1, 1)];
item('asados', 'Churrasco 270g', { id: 'churrasco', nombre_comanda: 'CHURRASCO 270G', grupos_opciones: CARNE_270 });
item('asados', 'Punta de Anca 270g', { id: 'punta_de_anca', nombre_comanda: 'PUNTA ANCA 270G', grupos_opciones: CARNE_270 });

// PESCADO (mismos ids que cuando estaban en A la Carta: Firestore solo les cambia la categoría).
// Sopa: el cliente la escoge entre las sopas publicadas hoy en el Menú del Día (grupo `mdd_sopa`,
// sale de menu_del_dia/actual). Si hoy no hay Menú del Día vigente, el pescado se vende sin sopa.
// Acompañamiento obligatorio (min 1, max 1 = elegir exactamente uno).
const ACOMP_PESCADO = [g('mdd_sopa', 'Sopa', 1, 1), g('acompanamiento_pescado', 'Acompañamiento', 1, 1)];
item('pescado', 'Tilapia 500g', { id: 'tilapia', nombre_comanda: 'TILAPIA 500G', grupos_opciones: ACOMP_PESCADO });
item('pescado', 'Filete de Tilapia', { id: 'filete_tilapia', nombre_comanda: 'FILETE TILAPIA', grupos_opciones: ACOMP_PESCADO });
item('pescado', 'Róbalo Dorado', { id: 'robalo', nombre_comanda: 'ROBALO DORADO', grupos_opciones: ACOMP_PESCADO });
item('pescado', 'Trucha Mariposa', { id: 'trucha', nombre_comanda: 'TRUCHA MARIPOSA', grupos_opciones: ACOMP_PESCADO });

// PICADAS
item('picadas', 'Picada Paisa', { descripcion: 'Para 2 personas', grupos_opciones: [g('porcion_picada', 'Porción', 1, 1)] });

// BEBIDAS — lista real de ISMA (2026-10-25). Sabores y estilos van como opción obligatoria.
const beb = (sub, lista) => lista.forEach(([nombre, id, extra = {}]) => item('bebidas', nombre, { id, sub, ...extra }));
const sabor = (grupo_id, etiqueta = 'Sabor') => ({ grupos_opciones: [g(grupo_id, etiqueta, 1, 1)] });
beb('cervezas', [
  ['Heineken Lata 269 ml', 'cerveza_heineken_269'],
  ['Heineken Zero 269 ml', 'cerveza_heineken_zero_269'],
  ['Heineken Lata 473 ml', 'cerveza_heineken_473'],
  ['Heineken 330 ml', 'cerveza_heineken_330'],
  ['Andina 473 ml', 'cerveza_andina_473'],
  ['Mística 330 ml', 'cerveza_mistica_330'],
  ['Pilsen 330 ml', 'cerveza_pilsen'],
  ['Águila Light 330 ml', 'cerveza_aguila_light'],
  ['Águila Negra 330 ml', 'cerveza_aguila_negra'],
  ['Poker 330 ml', 'cerveza_poker'],
  ['Costeñita', 'cerveza_costenita'],
  ['Corona', 'cerveza_corona'],
  ['Corona Zero', 'cerveza_corona_zero'],
  ['Club Colombia Dorada', 'cerveza_club_colombia'],
  ['3 Cordilleras', 'cerveza_3_cordilleras', { descripcion: 'Mulata, Rosé, Blanca o Mestiza', ...sabor('estilo_3_cordilleras', 'Estilo') }],
]);
beb('energizantes', [
  ['Speed 473 ml', 'speed_473'],
  ['Speed 310 ml', 'speed_310'],
  ['Speed 250 ml', 'speed_250'],
  ['Red Bull 269 ml', 'red_bull'],
]);
beb('hidratantes', [
  ['Gatorade', 'gatorade', sabor('sabor_gatorade')],
  ['Gatorlit', 'gatorlit', sabor('sabor_gatorlit')],
]);
beb('mezcladores', [
  ['Bretaña 1.5 L', 'bretana_1500'],
  ['Bretaña 310 ml', 'bretana_310'],
  ['Bretaña Mango Lulo 269 ml', 'bretana_mango_lulo'],
  ['Quatro 400 ml', 'mezclador_quatro_400'],
  ['Coca-Cola 400 ml', 'mezclador_coca_cola_400'],
  ['Coca-Cola 1.5 L', 'coca_cola_1500'],
  ['Quatro 1.5 L', 'quatro_1500'],
]);
beb('aguas', [
  ['Cristal 250 ml', 'agua_cristal_250'],
  ['Cristal 600 ml', 'agua_cristal_600'],
  ['Cristal Aloe', 'agua_cristal_aloe'],
  ['Cristal con gas 1 L', 'agua_cristal_gas_1l'],
  ['H2O 600 ml', 'agua_h2o_600'],
  ['H2O 250 ml', 'agua_h2o_250'],
  ['Acqua 600 ml', 'agua_acqua_600'],
]);
beb('gaseosas', [
  ['Gaseosa personal 350/400 ml', 'gaseosa_personal', sabor('sabor_gaseosa_personal')],
  ['Gaseosa 1.5 L', 'gaseosa_1500', { descripcion: 'Para compartir', ...sabor('sabor_gaseosa_litro') }],
]);
beb('jugos_hit', [
  ['Hit Cajita 200 ml', 'hit_cajita', sabor('sabor_hit_cajita')],
  ['Hit Botella 500 ml', 'hit_botella', sabor('sabor_hit_botella')],
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
