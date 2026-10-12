// Pruebas de las reglas de precio de Tío Nacho: variantes, cupo de salsas,
// adicionales, promos por día y aviso de combos.
import assert from 'node:assert/strict';
import { crearLinea, totalesPedido, revisarCombos, diaSemana, construirCuenta, ticketTexto } from '../shared/comandas.js';
import { MENU_ITEMS, GRUPOS_OPCIONES, CATEGORIAS } from './fixtures/menu.jireh.seed.js';

const I = Object.fromEntries(MENU_ITEMS.map((i) => [i.id, i]));
const G = Object.fromEntries(GRUPOS_OPCIONES.map((g) => [g.id, g]));
const linea = (id, opciones = {}, extra = {}) => crearLinea(I[id], G, { cantidad: 1, opciones, modificadores: [], ...extra });
const dori = (id, prots, salsas = []) => linea(id, { sabor_dorilocos: ['tradicional'], doritos: ['doritos_de_queso'], proteinas: prots, salsas });

// Fechas en hora de Bogotá (UTC-5): 9-oct-2026 es viernes.
const VIERNES = new Date('2026-10-09T23:00:00Z');
const SABADO = new Date('2026-10-10T23:00:00Z');
const DOMINGO = new Date('2026-10-11T23:00:00Z');
const LUNES = new Date('2026-10-12T23:00:00Z');

let n = 0;
const prueba = (t, fn) => { fn(); n++; console.log('✔', t); };

prueba('cada ítem apunta a una categoría y a grupos que existen', () => {
  const cats = new Set(CATEGORIAS.map((c) => c.id));
  for (const i of MENU_ITEMS) {
    assert.ok(cats.has(i.categoria_id), i.id);
    for (const r of i.grupos_opciones) assert.ok(G[r.grupo_id], `${i.id} → ${r.grupo_id}`);
  }
  assert.equal(new Set(MENU_ITEMS.map((i) => i.id)).size, MENU_ITEMS.length, 'ids únicos');
});

prueba('Dorilocos: precios de la carta por tamaño y proteínas', () => {
  const carta = {
    dorilocos_pequeno_sencillo: [17500, ['carne']], dorilocos_pequeno_mixto: [21500, ['carne', 'pollo']], dorilocos_pequeno_trifasico: [25500, ['carne', 'pollo', 'tocineta']],
    dorilocos_grande_sencillo: [31500, ['carne']], dorilocos_grande_mixto: [38500, ['carne', 'pollo']], dorilocos_grande_trifasico: [45500, ['carne', 'pollo', 'tocineta']],
  };
  for (const [id, [precio, prots]] of Object.entries(carta)) assert.equal(dori(id, prots, ['chamoy']).precio_unitario, precio, id);
});

prueba('Dorilocos: el número de proteínas es obligatorio', () => {
  assert.throws(() => dori('dorilocos_pequeno_mixto', ['carne']), /Proteínas \(elige 2\) · 1\/2/);
  assert.throws(() => dori('dorilocos_pequeno_sencillo', ['carne', 'pollo']), /Máximo 1/);
});

prueba('Dorilocos: proteína adicional de pago (pequeño +$4.000, grande +$7.000 c/u), también en Trifásico', () => {
  const tri = (id, extra) => linea(id, { sabor_dorilocos: ['tradicional'], doritos: ['doritos_de_queso'], proteinas: ['carne', 'pollo', 'tocineta'], proteina_adicional: extra, salsas: [] });
  assert.equal(tri('dorilocos_pequeno_trifasico', ['chicharron_crocante']).precio_unitario, 25500 + 4000);
  assert.equal(tri('dorilocos_grande_trifasico', ['carne', 'salchicha_ranchera']).precio_unitario, 45500 + 14000);
  assert.equal(tri('dorilocos_grande_trifasico', []).precio_unitario, 45500, 'es opcional');
  const l = tri('dorilocos_pequeno_trifasico', ['carne']);
  assert.deepEqual(l.opciones.find((o) => o.grupo_id === 'proteina_adicional'), { grupo_id: 'proteina_adicional', etiqueta: 'Proteína adicional', etiqueta_comanda: 'ADICIONAL', valores: ['Carne'], imprimir: true });
  assert.equal(linea('adicional_proteina_doriloco_grande', { proteina_adicional: ['pollo'] }).precio_unitario, 7000);
});

prueba('Helado Dona Sencilla: la salsa es opcional y la comanda dice "Sin salsa"', () => {
  const sin = linea('helado_dona_sencilla', { helado_dona: ['vainilla'] });
  assert.equal(sin.precio_unitario, 13500);
  assert.deepEqual(sin.opciones.find((o) => o.grupo_id === 'salsa_dona').valores, ['Sin salsa']);
  const con = linea('helado_dona_sencilla', { helado_dona: ['vainilla'], salsa_dona: ['arequipe'] });
  assert.deepEqual(con.opciones.find((o) => o.grupo_id === 'salsa_dona').valores, ['Arequipe']);
});

prueba('salsas: 3 incluidas; la 4.ª y la 5.ª cuestan $1.500 c/u', () => {
  const base = 17500;
  assert.equal(dori('dorilocos_pequeno_sencillo', ['carne'], ['chamoy', 'pina', 'cheddar']).precio_unitario, base);
  assert.equal(dori('dorilocos_pequeno_sencillo', ['carne'], ['chamoy', 'pina', 'cheddar', 'guacamole']).precio_unitario, base + 1500);
  assert.equal(dori('dorilocos_pequeno_sencillo', ['carne'], ['chamoy', 'pina', 'cheddar', 'guacamole', 'chipotle']).precio_unitario, base + 3000);
  assert.equal(dori('dorilocos_pequeno_sencillo', ['carne'], []).precio_unitario, base, 'sin salsa también se puede');
});

prueba('jalapeños suman $2.000 aunque estén dentro del cupo', () => {
  assert.equal(dori('dorilocos_pequeno_sencillo', ['carne'], ['jalapenos']).precio_unitario, 19500);
  assert.equal(dori('dorilocos_pequeno_sencillo', ['carne'], ['jalapenos', 'chamoy', 'pina', 'cheddar']).precio_unitario, 17500 + 2000 + 1500);
});

prueba('Maicitos: 1 salsa incluida', () => {
  assert.equal(linea('maicitos_sencillo', { proteinas: ['pollo'], salsas: ['guacamole'] }).precio_unitario, 14500);
  assert.equal(linea('maicitos_mixto', { proteinas: ['pollo', 'carne'], salsas: ['guacamole', 'cheddar'] }).precio_unitario, 18500 + 1500);
  assert.equal(linea('maicitos_trifasico', { proteinas: ['pollo', 'carne', 'tocineta'], salsas: [] }).precio_unitario, 22500);
});

prueba('Burritos, Dorinachos con proteína adicional, Tacos, Jugos, Granizados', () => {
  assert.equal(linea('burrito_trifasico', { doritos_burrito: ['doritos_flamin_hot'], proteinas: ['carne', 'pollo', 'chicharron_crocante'] }).precio_unitario, 27500);
  assert.equal(linea('dorinachos', { salsas: ['chamoy', 'pina'], proteina_extra: ['carne'] }).precio_unitario, 42500 + 7500);
  assert.equal(linea('tacos_x3', { proteina_tacos: ['pollo_al_pastor'] }).precio_unitario, 28000);
  assert.equal(linea('jugo_natural', { sabor_jugo: ['lulo'], base_jugo: ['en_agua'] }).precio_unitario, 10500);
  assert.equal(linea('jugo_natural', { sabor_jugo: ['lulo'], base_jugo: ['en_leche'] }).precio_unitario, 12000);
  assert.equal(linea('granizados_mango_pasion', { tamano_granizado: ['grande'] }, { modificadores: ['pitillo_enchilado'] }).precio_unitario, 18000);
  assert.equal(linea('granizados_maracumango').precio_unitario, 12500);
});

prueba('días de la semana en hora de Bogotá', () => {
  assert.equal(diaSemana(VIERNES), 5);
  assert.equal(diaSemana(new Date('2026-10-10T03:00:00Z')), 5, 'viernes 10 p.m. en Bogotá sigue siendo viernes');
  assert.equal(diaSemana(new Date('2026-10-10T05:30:00Z')), 6);
});

prueba('promo del día: 1 × $18.000, 2 × $30.000, 3 × $48.000 (solo ese día y ese cóctel)', () => {
  const pc = (cantidad) => crearLinea(I.pina_colada, G, { cantidad });
  assert.equal(totalesPedido([pc(1)], VIERNES).total, 18000);
  assert.equal(totalesPedido([pc(2)], VIERNES).total, 30000);
  assert.equal(totalesPedido([pc(3)], VIERNES).total, 48000);
  assert.equal(totalesPedido([pc(1), { ...pc(1), nota: 'sin coco' }], VIERNES).total, 30000, 'cuenta unidades de varias líneas');
  assert.equal(totalesPedido([pc(2)], SABADO).total, 40000, 'el sábado la piña colada va a precio normal');
  const m = crearLinea(I.margarita, G, { cantidad: 2 });
  assert.equal(totalesPedido([m], SABADO).total, 30000);
  assert.equal(totalesPedido([crearLinea(I.daiquiri, G, { cantidad: 1 })], DOMINGO).total, 18000);
  assert.equal(totalesPedido([m], LUNES).descuentos.length, 0);
});

prueba('combo: avisa si hay más sodas en combo que platos', () => {
  const soda = (c) => crearLinea(I.soda_michelada_combo, G, { cantidad: c, opciones: { sabor_michelada: ['cereza'] } });
  const plato = dori('dorilocos_pequeno_sencillo', ['carne']);
  assert.deepEqual(revisarCombos([soda(1), plato]), []);
  assert.equal(revisarCombos([soda(2), plato]).length, 1);
  assert.equal(revisarCombos([soda(1)]).length, 1);
});

prueba('la cuenta muestra subtotal, promo, total y cambio', () => {
  const items = [crearLinea(I.pina_colada, G, { cantidad: 2 }), dori('dorilocos_pequeno_sencillo', ['carne'])];
  const t = totalesPedido(items, VIERNES);
  const c = construirCuenta('p', { items, numero: 3, descuentos: t.descuentos, pago: { metodo: 'efectivo', recibido: 50000 } });
  assert.equal(c.total, 30000 + 17500);
  assert.equal(c.cambio, 2500);
  const txt = ticketTexto(c);
  assert.match(txt, /Promo Viernes de Pi.a Colada\s+-\$10\.000/);
  assert.match(txt, /Cambio\s+\$2\.500/);
});

console.log(`\n${n} pruebas OK`);
