// Menú de Jireh Pizza Dos — estructura para Firestore
// restaurantes/{rid}/categorias, /grupos_opciones, /menu_items
//
// Fuente: carta física (fotos del 23-sep-2026) + decisiones del cliente (25-sep-2026).
// `precio_por_confirmar: true` = precio leído de la carta que hay que validar
// (stickers movidos o foto borrosa). Pizzas: precios confirmados por el cliente.

export const RID = 'jireh2';

// ─── Zonas ─────────────────────────────────────────────────────────────
export const ZONAS = {
  pizzeria: { id: 'pizzeria', nombre: 'Pizzería', titulo_ticket: 'PIZZERIA', imprime: true, orden: 1 },
  comidas_rapidas: { id: 'comidas_rapidas', nombre: 'Cocina', titulo_ticket: 'COCINA', imprime: true, orden: 2 },
  general: { id: 'general', nombre: 'General', titulo_ticket: 'GENERAL', imprime: false, orden: 3 },
};

// ─── Categorías (orden de la comanda en papel) ─────────────────────────
// tipo_ui: 'pizza_builder' | 'subcategorias' | 'grilla'
export const CATEGORIAS = [
  { id: 'pizzas', nombre: 'Pizzas', parent_id: null, orden: 1, zona_preparacion: 'pizzeria', tipo_ui: 'pizza_builder' },
  { id: 'salchipapas', nombre: 'Salchipapas', parent_id: null, orden: 2, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'mazorcadas', nombre: 'Mazorcadas', parent_id: null, orden: 3, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'hamburguesas', nombre: 'Hamburguesas', parent_id: null, orden: 4, zona_preparacion: 'comidas_rapidas', tipo_ui: 'subcategorias' },
  { id: 'hamb_koller', nombre: 'Koller o Pollo Apanado', parent_id: 'hamburguesas', orden: 1, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'hamb_artesanal', nombre: 'Carne Artesanal', parent_id: 'hamburguesas', orden: 2, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'hot_dogs', nombre: 'Hot Dogs', parent_id: null, orden: 5, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'pinchos', nombre: 'Pinchos', parent_id: null, orden: 6, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'lasagna', nombre: 'Lasagna Mixta', parent_id: null, orden: 7, zona_preparacion: 'pizzeria', tipo_ui: 'grilla' },
  { id: 'panzerotti', nombre: 'Panzerotti', parent_id: null, orden: 8, zona_preparacion: 'pizzeria', tipo_ui: 'grilla' },
  { id: 'arepas', nombre: 'Arepas Rellenas', parent_id: null, orden: 9, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'patacon', nombre: 'Patacón', parent_id: null, orden: 10, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'arroz_paisa', nombre: 'Arroz Paisa', parent_id: null, orden: 11, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'platos', nombre: 'Platos a la Carta', parent_id: null, orden: 12, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
  { id: 'bebidas', nombre: 'Bebidas', parent_id: null, orden: 13, zona_preparacion: 'general', tipo_ui: 'subcategorias' },
  { id: 'bebidas_frias', nombre: 'Gaseosas y otras', parent_id: 'bebidas', orden: 1, zona_preparacion: 'general', tipo_ui: 'grilla' },
  { id: 'jugos', nombre: 'Jugos naturales', parent_id: 'bebidas', orden: 2, zona_preparacion: 'general', tipo_ui: 'grilla' },
  { id: 'adicionales', nombre: 'Adicionales', parent_id: null, orden: 14, zona_preparacion: 'comidas_rapidas', tipo_ui: 'grilla' },
].map((c) => ({ activo: true, ...c }));

// ─── Grupos de opciones ────────────────────────────────────────────────
const op = (nombre, extra = {}) => ({ id: slug(nombre), nombre, activo: true, precio_extra: 0, ...extra });

export const GRUPOS_OPCIONES = [
  {
    // ⚠️ Lista de la carta (18). El cliente enviará la lista oficial.
    id: 'sabores_pizza',
    nombre: 'Sabores',
    opciones: [
      op('Hawaiana', { detalle: 'Piña, jamón y queso' }),
      op('Carnes', { detalle: 'Salami, cabano y queso' }),
      op('Criolla', { detalle: 'Carne desmechada, mazorca y queso' }),
      op('Pollo Champiñón', { detalle: 'Champiñón, pollo y queso' }),
      op('Tropical', { detalle: 'Piña, duraznos, cerezas, ciruelas y queso' }),
      op('Mexicana', { detalle: 'Carne molida, jalapeño, pico de gallo y queso' }),
      op('Champiñón Tocineta', { detalle: 'Champiñón, tocineta y queso' }),
      op('Pollo BBQ', { detalle: 'Pollo, salsa BBQ, tocineta y queso' }),
      op('Pollo Miel Mostaza', { detalle: 'Pollo, salsa miel mostaza y queso' }),
      op('Napolitana', { detalle: 'Champiñón, tomate y queso' }),
      op('Vegetariana', { detalle: 'Champiñón, pico de gallo, mazorca y queso' }),
      op('Ciruela Tocineta', { detalle: 'Ciruela, tocineta y queso' }),
      op('Chicharrón', { detalle: 'Chicharrón, maduro y queso' }),
      op('Peperoni', { detalle: 'Peperoni y queso' }),
      op('Campesina', { detalle: 'Maíz, tocineta, pollo y queso' }),
      op('Española', { detalle: 'Champiñón, cabano, pollo, cebolla, pimentón y queso' }),
      op('Chocolate', { detalle: 'Nutella, fresas, chispitas y queso' }),
      op('Venezolana', { detalle: 'Jamón, maíz, tocineta y queso' }),
    ],
  },
  { id: 'carne_koller_pollo', nombre: 'Carne', opciones: [op('Koller'), op('Pollo apanado')] },
  {
    id: 'preparacion_hamburguesa',
    nombre: 'Preparación',
    por_defecto: 'pan',
    opciones: [op('Pan'), op('Arepa', { precio_extra: 2000 }), op('Patacón', { precio_extra: 2000 })],
  },
  { id: 'pan_o_arepa', nombre: 'Base', opciones: [op('Pan'), op('Arepa')] },
  { id: 'pollo_o_carne', nombre: 'Proteína', opciones: [op('Pollo'), op('Carne')] },
  {
    id: 'carne_pizza_burguer',
    nombre: 'Carne',
    por_defecto: 'hamburguesa',
    opciones: [op('Hamburguesa'), op('Koller', { precio_extra: 2000 })],
  },
  {
    id: 'sabor_panzerotti',
    nombre: 'Sabor',
    opciones: ['Hawaiano', 'Criollo', 'Mexicano', 'Carnes', 'Pollo Champiñón'].map((n) => op(n)),
  },
  { id: 'jugo_base', nombre: 'Preparación', por_defecto: 'en_agua', opciones: [op('En agua'), op('En leche', { precio_extra: 1000 })] },
  { id: 'tipo_agua', nombre: 'Tipo de agua', opciones: [op('Natural'), op('Con gas')] },
  // Sabores de gaseosa (cada tamaño trae los suyos)
  { id: 'gaseosa_250', nombre: 'Sabor', opciones: ['Naranja', 'Manzana', 'Uva', 'Colombiana', 'Tamarindo', 'Toronja'].map((n) => op(n)) },
  {
    id: 'gaseosa_350',
    nombre: 'Sabor',
    opciones: ['Natumalta', 'Manzana', 'Colombiana', 'Seven Up', 'Uva', 'Piña', 'Pepsi', 'Bretaña', 'Hit Mora', 'Hit Naranja Piña', 'Hit Mango', 'Hit Lulo', 'Hit Tropical'].map((n) => op(n)),
  },
  {
    id: 'gaseosa_400',
    nombre: 'Sabor',
    opciones: ['Naranja', 'Colombiana', 'Uva', 'Pepsi', 'Seven Up', 'Ginger', 'Manzana', 'Tropical', 'Mora', 'Mango', 'Lulo', 'Naranja Piña', 'Mr. Té Durazno', 'Mr. Té Limón'].map((n) => op(n)),
  },
  {
    id: 'gaseosa_15',
    nombre: 'Sabor',
    opciones: [
      'Naranja', 'Pepsi', 'Manzana', 'Uva', 'Colombiana', 'Hipinto', 'Seven Up', 'Ginger', 'H2O Limonata', 'H2O Manzana', 'H2O Lima Limón',
      'Mr. Té Durazno', 'Mr. Té Limón', 'Refajo Andina', 'Hit Litro Mora', 'Hit Litro Mango', 'Hit Litro Naranja Piña', 'Hit Litro Lulo', 'Hit Litro Frutas Tropicales',
    ].map((n) => op(n)),
  },
];

// ─── Ítems ─────────────────────────────────────────────────────────────
const catById = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));
const items = [];
const ordenPorCat = {};

/**
 * Agrega un ítem. La zona sale de la categoría salvo que se indique otra.
 * g(): referencia a un grupo de opciones. m(): modificador con precio.
 */
function item(catId, nombre, precio, extra = {}) {
  const cat = catById[catId];
  const raiz = cat.parent_id ? catById[cat.parent_id] : cat;
  ordenPorCat[catId] = (ordenPorCat[catId] || 0) + 1;
  const grupos = extra.grupos_opciones || [];
  const mods = extra.modificadores || [];
  items.push({
    id: extra.id || `${catId}_${slug(nombre)}`,
    nombre,
    nombre_comanda: (extra.nombre_comanda || nombre).toUpperCase(),
    descripcion: extra.descripcion || '',
    categoria_id: raiz.id,
    subcategoria_id: cat.parent_id ? cat.id : null,
    ruta: cat.parent_id ? [raiz.id, cat.id] : [cat.id],
    zona_preparacion: extra.zona_preparacion || cat.zona_preparacion,
    tipo: grupos.length || mods.length ? 'configurable' : 'simple',
    grupos_opciones: grupos,
    modificadores: mods,
    precio,
    orden: ordenPorCat[catId],
    activo: true,
    ...(extra.atributos ? { atributos: extra.atributos } : {}),
    ...(extra.precio_por_confirmar ? { precio_por_confirmar: true } : {}),
    ...(extra.solo_local ? { solo_local: true } : {}),
  });
}
const g = (grupo_id, etiqueta, min, max) => ({ grupo_id, etiqueta, min, max });
const m = (id, nombre, precio) => ({ id, nombre, precio });

// PIZZAS — Zona A (precios confirmados)
const COMBO = (precio) => m('combo_gaseosa_15', 'Con gaseosa 1.5 L', precio);
const QUESO = (precio) => m('adicional_queso', 'Adicional de queso', precio);
const BORDE = (precio) => m('borde_bocadillo', 'Borde de bocadillo', precio);
item('pizzas', 'Pizza Porción', 10000, { id: 'pizza_porcion', nombre_comanda: 'PORCION', grupos_opciones: [g('sabores_pizza', 'Sabor', 1, 1)], modificadores: [QUESO(3000)] });
item('pizzas', 'Pizza Personal', 19000, { id: 'pizza_personal', nombre_comanda: 'PERSONAL', grupos_opciones: [g('sabores_pizza', 'Sabor', 1, 1)], modificadores: [QUESO(3500), BORDE(3500)] });
item('pizzas', 'Pizza Personal 2 Sabores', 20000, { id: 'pizza_personal_2', nombre_comanda: 'PERSONAL 2 SAB', grupos_opciones: [g('sabores_pizza', 'Sabores', 2, 2)], modificadores: [QUESO(3500), BORDE(3500)] });
item('pizzas', 'Pizza Small', 40000, { id: 'pizza_small', nombre_comanda: 'SMALL', atributos: { diametro_cm: 30 }, grupos_opciones: [g('sabores_pizza', 'Sabores', 1, 2)], modificadores: [COMBO(6500), QUESO(6500), BORDE(6500)] });
item('pizzas', 'Pizza Mediana', 60000, { id: 'pizza_mediana', nombre_comanda: 'MEDIANA', atributos: { diametro_cm: 40 }, grupos_opciones: [g('sabores_pizza', 'Sabores', 1, 3)], modificadores: [COMBO(6500), QUESO(8500), BORDE(8500)] });
item('pizzas', 'Pizza Extra Grande', 80000, { id: 'pizza_extragrande', nombre_comanda: 'EXTRA GRANDE', atributos: { diametro_cm: 50 }, grupos_opciones: [g('sabores_pizza', 'Sabores', 1, 4)], modificadores: [COMBO(6500), QUESO(11000), BORDE(11000)] });
item('pizzas', 'Pizza Burguer', 22000, { id: 'pizza_burguer', zona_preparacion: 'comidas_rapidas', grupos_opciones: [g('carne_pizza_burguer', 'Carne', 1, 1)], descripcion: 'Carne de hamburguesa o Koller, pollo, champiñones, tocineta, queso, tomate, papa chip, masa de pizza' });

// SALCHIPAPAS
item('salchipapas', 'Sencilla', 20000, { nombre_comanda: 'SALCHIPAPA SENCILLA', descripcion: 'Salchicha americana, papa francesa, 2 huevos de codorniz', modificadores: [QUESO(4000)] });
item('salchipapas', 'Mixta', 24000, { nombre_comanda: 'SALCHIPAPA MIXTA', descripcion: 'Salchicha, papa, carne y pollo salteados, huevos de codorniz', modificadores: [QUESO(4000)] });
item('salchipapas', 'Mega', 28000, { nombre_comanda: 'SALCHIPAPA MEGA', descripcion: 'Mixta + chorizo y tocineta', modificadores: [QUESO(4000)] });
item('salchipapas', 'Choripapa', 20000, { nombre_comanda: 'CHORIPAPA', descripcion: 'Chorizo, papa francesa, huevos de codorniz', modificadores: [QUESO(4000)] });

// MAZORCADAS
item('mazorcadas', 'Solo Pollo o Solo Carne', 21000, { nombre_comanda: 'MAZORCADA SOLA', descripcion: 'Queso, papa chip, huevo de codorniz', grupos_opciones: [g('pollo_o_carne', 'Proteína', 1, 1)] });
item('mazorcadas', 'Mixta', 24000, { nombre_comanda: 'MAZORCADA MIXTA', descripcion: 'Mazorca, queso, carne, pollo, papa miga' });
item('mazorcadas', 'Mega', 28000, { nombre_comanda: 'MAZORCADA MEGA', descripcion: 'Mixta + chorizo, tocineta, huevo de codorniz' });
item('mazorcadas', 'Ranchera', 23000, { nombre_comanda: 'MAZORCADA RANCHERA', descripcion: 'Mazorca, queso, carne, chorizo, papa miga, huevo de codorniz' });

// HAMBURGUESAS — ⚠️ los stickers de precio en la carta parecen corridos una fila: confirmar.
const PREP = g('preparacion_hamburguesa', 'Preparación', 1, 1);
const CARNE = g('carne_koller_pollo', 'Carne', 1, 1);
const hk = (n, p, d, extra = {}) => item('hamb_koller', n, p, { nombre_comanda: `HAMB ${n}`, descripcion: d, grupos_opciones: [CARNE, PREP], precio_por_confirmar: true, ...extra });
hk('Sencilla', 22000, 'Carne, cebolla, tomate, queso, papa francesa');
hk('Especial', 23000, '+ pollo y huevo de codorniz');
hk('Super Especial', 24000, '+ pollo, huevo de codorniz y tocineta');
hk('Criolla', 24000, '+ huevo de codorniz, carne desmechada, maíz tierno');
hk('A Caballo', 23000, '+ huevo frito');
hk('Texana', 24000, '+ tocineta y aros de cebolla apanados');
hk('Mixta', 27000, 'Carne koller + carne de pollo apanado', { grupos_opciones: [PREP] });
const ha = (n, p, d) => item('hamb_artesanal', n, p, { nombre_comanda: `HAMB ART ${n}`, descripcion: d, grupos_opciones: [PREP], precio_por_confirmar: true });
ha('Sencilla', 22000, 'Carne de res artesanal, cebolla, tomate, queso, papa francesa');
ha('Especial', 23000, '+ pollo y huevo de codorniz');
ha('Super Especial', 23000, '+ pollo, huevo de codorniz y tocineta');
ha('Criolla', 22000, '+ carne desmechada y maíz tierno');
ha('A Caballo', 23000, '+ huevo frito');
ha('Texana', 26000, '+ tocineta y aros de cebolla apanados');
ha('Doble Carne', 27000, '2 carnes artesanales, tocineta, huevo de codorniz');

// HOT DOGS
const FRANCESA = m('mas_francesa', '+ Papa francesa', 4000);
const hd = (n, p, d) => item('hot_dogs', n, p, { nombre_comanda: `PERRO ${n}`, descripcion: d, modificadores: [FRANCESA] });
hd('Sencillo', 16000, 'Salchicha americana, queso, huevo de codorniz, papa miga, cebolla');
hd('Especial', 19000, '+ pollo desmechado');
hd('Super Especial', 21000, '+ pollo y tocineta');
hd('Americano', 19000, '+ carne y maíz');
hd('Americano Super', 22000, '+ tocineta, carne y maíz');
item('hot_dogs', 'Choriperro', 16000, { nombre_comanda: 'CHORIPERRO', descripcion: 'Chorizo, queso, papa miga, cebolla' });
item('hot_dogs', 'Chori Pan o Arepa', 14000, { nombre_comanda: 'CHORI', grupos_opciones: [g('pan_o_arepa', 'Base', 1, 1)] });

// PINCHOS
item('pinchos', 'Res', 23000, { nombre_comanda: 'PINCHO RES', descripcion: 'Carne de res, papa francesa' });
item('pinchos', 'Pollo', 21000, { nombre_comanda: 'PINCHO POLLO', descripcion: 'Pechuga de pollo, papa francesa' });
item('pinchos', 'Mixto', 27000, { nombre_comanda: 'PINCHO MIXTO', descripcion: 'Carne, pollo, papa francesa' });

// LASAGNA y PANZEROTTI — zona cocina (decisión del cliente 28-sep-2026)
item('lasagna', 'Lasagna Mediana', 21000, { nombre_comanda: 'LASAGNA MEDIANA', descripcion: 'Bolognesa, pollo, champiñón, pasta y queso' });
item('lasagna', 'Lasagna Grande', 23000, { nombre_comanda: 'LASAGNA GRANDE', descripcion: 'Bolognesa, pollo, champiñón, pasta y queso' });
item('panzerotti', 'Panzerotti', 19000, { nombre_comanda: 'PANZEROTTI', grupos_opciones: [g('sabor_panzerotti', 'Sabor', 1, 1)] });
item('panzerotti', 'Panzerotti Mixto', 23000, { nombre_comanda: 'PANZEROTTI MIXTO', descripcion: 'Carne, pollo, champiñón, queso' });

// AREPAS RELLENAS
item('arepas', 'Jamón y Queso', 11000, { nombre_comanda: 'AREPA JAMON QUESO', precio_por_confirmar: true });
item('arepas', 'Goulash', 19000, { nombre_comanda: 'AREPA GOULASH', descripcion: 'Carne goulash, champiñón, pollo, queso, jamón, huevo de codorniz' });
item('arepas', 'Jireh 2', 27000, { nombre_comanda: 'AREPA JIREH 2', descripcion: 'Carne, pollo, chorizo, queso, jamón, huevo de codorniz' });

// PATACÓN
item('patacon', 'Jireh 2', 22000, { nombre_comanda: 'PATACON JIREH 2', descripcion: 'Patacón, carne, pollo, maíz y queso' });
item('patacon', 'Mixto', 23000, { nombre_comanda: 'PATACON MIXTO', descripcion: 'Patacón, carne, pollo y queso' });
item('patacon', 'Mega', 28000, { nombre_comanda: 'PATACON MEGA', descripcion: 'Carne desmechada, chorizo, pollo, tocineta y queso' });
item('patacon', 'Ranchero', 24000, { nombre_comanda: 'PATACON RANCHERO', descripcion: 'Patacón, carne, chorizo y queso' });

// ARROZ PAISA
item('arroz_paisa', 'Personal', 26000, { nombre_comanda: 'ARROZ PAISA PERSONAL', descripcion: 'Pierna de cerdo y pollo salteados, chorizo mexicano, maíz, chicharrón, maduro, papa francesa y gaseosa 250 ml' });
item('arroz_paisa', 'Combo Familiar (4 personas)', 79000, { nombre_comanda: 'ARROZ PAISA FAMILIAR', descripcion: 'Pierna de cerdo y pollo salteados, chorizo, mazorca, chicharrón, maduro, papa francesa y gaseosa 1.5 L' });

// PLATOS A LA CARTA
const pl = (n, p, extra = {}) => item('platos', n, p, { nombre_comanda: n, ...extra });
// Todos llevan yuca (pedido del cliente, 4-oct-2026).
const ACOMP_D = 'Papa francesa, patacón, ensalada, yuca y arroz';
const GRATIN_D = 'Queso, papa francesa, patacón, ensalada, yuca y arroz';
pl('Pechuga Gratinada', 29000, { descripcion: GRATIN_D });
pl('Pechuga a la Plancha', 26000, { descripcion: ACOMP_D });
pl('Pechuga en Salsa de Champiñón', 31000, { nombre_comanda: 'PECHUGA SALSA CHAMPINON', descripcion: ACOMP_D });
pl('Carne a la Plancha', 26000, { descripcion: ACOMP_D });
pl('Carne Gratinada', 29000, { descripcion: GRATIN_D });
pl('Churrasco', 30000, { descripcion: ACOMP_D });
pl('Churrasco Gratinado', 35000, { descripcion: GRATIN_D });
pl('Costillas BBQ', 30000, { descripcion: ACOMP_D });
pl('Alitas BBQ', 23000, { precio_por_confirmar: true, descripcion: 'Papa francesa, patacón y yuca' });
pl('Lomo de Cerdo', 30000, { descripcion: ACOMP_D });
pl('Parrillada Mixta', 34000, { descripcion: 'Filete de carne, filete de pechuga, filete de lomo de cerdo, chorizo, costilla de cerdo, ensalada, arroz, yuca, patacón, papa francesa y criolla' });

// BEBIDAS — zona general
const bf = (n, p) => item('bebidas_frias', n, p);
const sabor = (grupo) => ({ grupos_opciones: [g(grupo, 'Sabor', 1, 1)] });
item('bebidas_frias', 'Gaseosa 250 ml', 2500, sabor('gaseosa_250'));
item('bebidas_frias', 'Gaseosa 350 ml', 3900, { ...sabor('gaseosa_350'), solo_local: true, descripcion: 'Envase de vidrio: solo en el local o para recoger' });
item('bebidas_frias', 'Gaseosa 400 ml', 4200, sabor('gaseosa_400'));
item('bebidas_frias', 'Gaseosa 1.5 L', 8000, sabor('gaseosa_15'));
bf('Refajo Andina 330 ml', 4200);
item('bebidas_frias', 'Agua Botella', 3000, { grupos_opciones: [g('tipo_agua', 'Tipo de agua', 1, 1)] });
bf('Limonada Natural', 3500);
bf('Limonada de Coco', 10000);
bf('Limonada de Hierbabuena', 8000);
bf('Cerveza en Lata', 6000);
bf('Piña Colada', 7000);
['Mora', 'Lulo', 'Fresa', 'Mango', 'Guanábana', 'Frutos Rojos', 'Maracuyá', 'Feijoa', 'Borojó', 'Tomate de Árbol'].forEach((f) =>
  item('jugos', `Jugo de ${f}`, 8000, { nombre_comanda: `JUGO ${f}`, grupos_opciones: [g('jugo_base', 'Preparación', 1, 1)] })
);

// ADICIONALES — van a la COCINA (no a "general")
item('adicionales', 'Papa Francesa', 8500);
item('adicionales', 'Papa Criolla', 8000);
item('adicionales', '5 Huevos de Codorniz', 8500);
item('adicionales', 'Patacón', 8000, { nombre_comanda: 'PATACON (ADIC)' });
item('adicionales', 'Porción de Arroz', 7500);
item('adicionales', 'Porción de Aros de Cebolla', 8500, { nombre_comanda: 'AROS DE CEBOLLA (ADIC)' });

// ─── Ingredientes que el cliente puede pedir quitar ("SIN …") ──────────
// Según la descripción de la carta. No incluye la base del producto
// (la carne de la hamburguesa, la salchicha del perro, la pasta…).
// Pizzas: por ahora no aplica.
const PF = 'Papa francesa';
const ACOMP = [PF, 'Patacón', 'Ensalada', 'Yuca', 'Arroz']; // todos los platos llevan yuca
const HAMB = ['Cebolla', 'Tomate', 'Queso'];
const PERRO = ['Queso', 'Huevo de codorniz', 'Papa miga', 'Cebolla'];
const SIN = {
  salchipapas_sencilla: ['Huevos de codorniz'],
  salchipapas_mixta: ['Carne', 'Pollo', 'Huevos de codorniz'],
  salchipapas_mega: ['Carne', 'Pollo', 'Huevos de codorniz', 'Chorizo', 'Tocineta'],
  salchipapas_choripapa: ['Huevos de codorniz'],
  mazorcadas_solo_pollo_o_solo_carne: ['Queso', 'Papa chip', 'Huevo de codorniz'],
  mazorcadas_mixta: ['Mazorca', 'Queso', 'Carne', 'Pollo', 'Papa miga'],
  mazorcadas_mega: ['Mazorca', 'Queso', 'Carne', 'Pollo', 'Chorizo', 'Tocineta', 'Papa miga', 'Huevo de codorniz'],
  mazorcadas_ranchera: ['Mazorca', 'Queso', 'Carne', 'Chorizo', 'Papa miga', 'Huevo de codorniz'],
  hamb_koller_sencilla: [...HAMB, PF],
  hamb_koller_especial: [...HAMB, 'Pollo', 'Huevo de codorniz', PF],
  hamb_koller_super_especial: [...HAMB, 'Pollo', 'Huevo de codorniz', 'Tocineta', PF],
  hamb_koller_criolla: [...HAMB, 'Huevo de codorniz', 'Carne desmechada', 'Maíz tierno', PF],
  hamb_koller_a_caballo: [...HAMB, 'Huevo frito', PF],
  hamb_koller_texana: [...HAMB, 'Tocineta', 'Aros de cebolla', PF],
  hamb_koller_mixta: [...HAMB, PF],
  hamb_artesanal_sencilla: [...HAMB, PF],
  hamb_artesanal_especial: [...HAMB, 'Pollo', 'Huevo de codorniz', PF],
  hamb_artesanal_super_especial: [...HAMB, 'Pollo', 'Huevo de codorniz', 'Tocineta', PF],
  hamb_artesanal_criolla: [...HAMB, 'Carne desmechada', 'Maíz tierno', PF],
  hamb_artesanal_a_caballo: [...HAMB, 'Huevo frito', PF],
  hamb_artesanal_texana: [...HAMB, 'Tocineta', 'Aros de cebolla', PF],
  hamb_artesanal_doble_carne: [...HAMB, 'Tocineta', 'Huevo de codorniz', PF],
  hot_dogs_sencillo: PERRO,
  hot_dogs_especial: [...PERRO, 'Pollo desmechado'],
  hot_dogs_super_especial: [...PERRO, 'Pollo', 'Tocineta'],
  hot_dogs_americano: [...PERRO, 'Carne', 'Maíz'],
  hot_dogs_americano_super: [...PERRO, 'Tocineta', 'Carne', 'Maíz'],
  hot_dogs_choriperro: ['Queso', 'Papa miga', 'Cebolla'],
  pinchos_res: [PF],
  pinchos_pollo: [PF],
  pinchos_mixto: [PF],
  lasagna_lasagna_mediana: ['Bolognesa', 'Pollo', 'Champiñón', 'Queso'],
  lasagna_lasagna_grande: ['Bolognesa', 'Pollo', 'Champiñón', 'Queso'],
  panzerotti_panzerotti_mixto: ['Carne', 'Pollo', 'Champiñón', 'Queso'],
  arepas_jamon_y_queso: ['Jamón', 'Queso'],
  arepas_goulash: ['Champiñón', 'Pollo', 'Queso', 'Jamón', 'Huevo de codorniz'],
  arepas_jireh_2: ['Carne', 'Pollo', 'Chorizo', 'Queso', 'Jamón', 'Huevo de codorniz'],
  patacon_jireh_2: ['Carne', 'Pollo', 'Maíz', 'Queso'],
  patacon_mixto: ['Carne', 'Pollo', 'Queso'],
  patacon_mega: ['Carne desmechada', 'Chorizo', 'Pollo', 'Tocineta', 'Queso'],
  patacon_ranchero: ['Carne', 'Chorizo', 'Queso'],
  arroz_paisa_personal: ['Chorizo', 'Maíz', 'Chicharrón', 'Maduro', PF],
  arroz_paisa_combo_familiar_4_personas: ['Chorizo', 'Mazorca', 'Chicharrón', 'Maduro', PF],
  platos_pechuga_gratinada: ['Queso', ...ACOMP],
  platos_pechuga_a_la_plancha: ACOMP,
  platos_pechuga_en_salsa_de_champinon: ACOMP,
  platos_carne_a_la_plancha: ACOMP,
  platos_carne_gratinada: ['Queso', ...ACOMP],
  platos_churrasco: ACOMP,
  platos_churrasco_gratinado: ['Queso', ...ACOMP],
  platos_costillas_bbq: ACOMP,
  platos_alitas_bbq: [PF, 'Patacón', 'Yuca'],
  platos_lomo_de_cerdo: ACOMP,
  platos_parrillada_mixta: ['Chorizo', 'Ensalada', 'Arroz', 'Yuca', 'Patacón', PF, 'Papa criolla'],
};
for (const [id, lista] of Object.entries(SIN)) {
  const it = items.find((i) => i.id === id);
  if (!it) throw new Error(`SIN: no existe el ítem ${id}`);
  it.ingredientes_removibles = lista;
  it.tipo = 'configurable';
}

// Adicionales: abren la ficha para poder escribir una nota (ej. "bien dorada").
for (const it of items) if (it.categoria_id === 'adicionales') it.tipo = 'configurable';

export const MENU_ITEMS = items;

// ─── util ──────────────────────────────────────────────────────────────
function slug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
