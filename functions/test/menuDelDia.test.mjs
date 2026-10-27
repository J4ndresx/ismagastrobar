// Pruebas de ISMA: Menú del Día (fuente única), agotados y modificadores obligatorios.
import assert from 'node:assert/strict';
import { MENU_ITEMS, GRUPOS_OPCIONES, CATEGORIAS, PRECIOS } from '../shared/menu.seed.js';
import { crearLinea, validarSeleccion } from '../shared/comandas.js';
import { verificarPedidoApp } from '../verificarPedido.js';
import {
  hoyBogota, armarMenuDelDia, menuDelDiaVigente, aplicarMenuDelDia, gruposDesdeMenuDelDia, normalizarLista, vendible, MDD_ITEM_ID,
  actualizarFrecuentes, opcionesParaElegir, separarOpciones, MDD_MAX_FRECUENTES,
} from '../shared/menuDelDia.js';

let n = 0;
const prueba = async (t, fn) => { await fn(); n++; console.log('✔', t); };

// Con precios de mentira (en el seed real están en 0 hasta que el cliente los entregue).
const conPrecio = (i, k) => ({ ...i, precio: 10000 + k * 1000 });
const ITEMS = MENU_ITEMS.map(conPrecio);
const I = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const G = Object.fromEntries(GRUPOS_OPCIONES.map((g) => [g.id, g]));
const base = { items: I, grupos: G };
const AHORA = new Date('2026-10-08T15:00:00Z'); // 10:00 a. m. en Bogotá
const mdd = (extra = {}) => armarMenuDelDia({ sopaDelDia: ['Sancocho de gallina'], proteinaDelDia: ['Res', 'Cañón de cerdo'], ensaladaDelDia: ['Lechuga primaveral', 'Pico de gallo'], bebidaDelDia: ['Jugo de mora'], disponible: true, ...extra }, AHORA);

await prueba('seed: estructura coherente (categorías, grupos, precios, modificadores del cliente)', () => {
  const cats = new Set(CATEGORIAS.map((c) => c.id));
  assert.deepEqual(CATEGORIAS.filter((c) => !c.parent_id).map((c) => c.id), ['desayunos', 'menu_del_dia', 'tradicional', 'proteinas', 'a_la_carta', 'pescado', 'asados', 'picadas', 'bebidas', 'adicionales', 'parrilla_especiales']);
  // Subcategorías: cuelgan de una categoría raíz, y en Bebidas/Adicionales todo producto tiene la suya.
  for (const c of CATEGORIAS.filter((x) => x.parent_id)) assert.ok(cats.has(c.parent_id) && !CATEGORIAS.find((x) => x.id === c.parent_id).parent_id, c.id);
  for (const i of MENU_ITEMS.filter((x) => ['bebidas', 'adicionales'].includes(x.categoria_id))) {
    const sub = CATEGORIAS.find((c) => c.id === i.subcategoria_id);
    assert.equal(sub?.parent_id, i.categoria_id, `${i.id} sin subcategoría válida`);
  }
  // Bebidas: las 7 subcategorías de la lista real de ISMA (2026-10-25), todas con precio.
  assert.deepEqual(CATEGORIAS.filter((c) => c.parent_id === 'bebidas').map((c) => c.id), ['cervezas', 'energizantes', 'hidratantes', 'mezcladores', 'aguas', 'gaseosas', 'jugos_hit']);
  for (const i of MENU_ITEMS.filter((x) => x.categoria_id === 'bebidas')) assert.ok(i.precio > 0, `${i.id} sin precio`);
  for (const i of MENU_ITEMS) {
    assert.ok(cats.has(i.categoria_id), i.id);
    for (const r of i.grupos_opciones) assert.ok(G[r.grupo_id] || r.grupo_id.startsWith('mdd_'), `${i.id} → ${r.grupo_id}`);
  }
  assert.equal(Object.keys(PRECIOS).length, MENU_ITEMS.length, 'cada producto tiene su fila en PRECIOS');
  assert.deepEqual(G.termino_carne.opciones.map((o) => o.nombre), ['3/4', 'Bien asado']);
  assert.deepEqual(G.acompanamiento.opciones.map((o) => o.nombre), ['Papas', 'Yuca', 'Ensalada']);
  assert.deepEqual(G.porcion_picada.opciones.map((o) => o.nombre), ['Para 2 personas']);
  assert.deepEqual(MENU_ITEMS.filter((i) => i.categoria_id === 'tradicional').map((i) => i.nombre), ['Bandejita paisa', 'Cazuela', 'Bandeja paisa', 'Sancocho Trifásico', 'Sancocho de Res o Cerdo', 'Mondongo', 'Sancocho de Bagre']);
  assert.deepEqual(G.carne_sancocho.opciones.map((o) => o.nombre), ['Res', 'Cerdo']);
  // Precios reales entregados por ISMA (2026-10-25): ninguno en 0 en las categorías que ya se pueden cargar.
  for (const i of MENU_ITEMS.filter((x) => ['desayunos', 'menu_del_dia', 'tradicional', 'pescado', 'asados', 'parrilla_especiales'].includes(x.categoria_id))) assert.ok(i.precio > 0, `${i.id} sin precio`);
  assert.deepEqual(MENU_ITEMS.filter((i) => i.categoria_id === 'proteinas').map((i) => i.nombre), ['Res', 'Cañón de cerdo', 'Pechuga', 'Chicharrón', 'Hígado encebollado', 'Res molida']);
  assert.equal(I.red_bull?.nombre, 'Red Bull 269 ml');
  assert.equal(PRECIOS.red_bull, 11000);
  assert.deepEqual(G.estilo_3_cordilleras.opciones.map((o) => o.nombre), ['Mulata', 'Rosé', 'Blanca', 'Mestiza']);
  assert.equal(G.sabor_gaseosa_personal.opciones.length, 11);
  assert.equal(I.ensalada?.subcategoria_id, 'adic_acompanamientos');
  // Desayunos: Desayuno Especial exige proteína, bebida y huevos (una opción de cada uno).
  assert.deepEqual(I.desayuno_especial.grupos_opciones.map((r) => [r.grupo_id, r.min, r.max]), [['proteina_desayuno', 1, 1], ['bebida_caliente', 1, 1], ['huevos_al_gusto', 1, 1]]);
  assert.deepEqual(G.proteina_desayuno.opciones.map((o) => o.nombre), ['Res', 'Cerdo', 'Pechuga', 'Chicharrón', 'Hígado encebollado', 'Res molida', 'Chorizo', 'Morcilla']);
  assert.deepEqual(['desayuno_sencillo', 'desayuno_especial', 'calentado_sencillo', 'calentado_completo', 'sandwich_atun'].map((id) => PRECIOS[id]), [12000, 15000, 16000, 17000, 21000]);
});

await prueba('fecha de Bogotá: a las 11 p. m. todavía es "hoy", a las 12:01 a. m. ya es el día siguiente', () => {
  assert.equal(hoyBogota(new Date('2026-10-09T04:59:00Z')), '2026-10-08');
  assert.equal(hoyBogota(new Date('2026-10-09T05:01:00Z')), '2026-10-09');
});

await prueba('armarMenuDelDia: normaliza, quita repetidos y exige las 3 partes para publicar', () => {
  assert.deepEqual(normalizarLista(['  Sancocho  de gallina ', 'sancocho de gallina', '']), [{ id: 'sancocho_de_gallina', nombre: 'Sancocho de gallina' }]);
  assert.throws(() => armarMenuDelDia({ sopaDelDia: ['Ajiaco'], proteinaDelDia: [], ensaladaDelDia: [], bebidaDelDia: [], disponible: true }, AHORA), /proteína, ensalada, bebida/);
  assert.doesNotThrow(() => armarMenuDelDia({ sopaDelDia: [], proteinaDelDia: [], ensaladaDelDia: [], bebidaDelDia: [], disponible: false }, AHORA), 'se puede guardar incompleto si no se publica');
});

await prueba('vigencia: solo si está activado, es de HOY y tiene las tres partes', () => {
  assert.equal(menuDelDiaVigente(mdd(), AHORA), true);
  assert.equal(menuDelDiaVigente(mdd({ disponible: false }), AHORA), false, 'apagado');
  assert.equal(menuDelDiaVigente(mdd(), new Date('2026-10-09T15:00:00Z')), false, 'es de ayer');
  assert.equal(menuDelDiaVigente(null, AHORA), false, 'nunca se ha guardado');
});

await prueba('aplicarMenuDelDia: si no está vigente el ítem desaparece; si lo está, trae los 3 grupos', () => {
  const apagado = aplicarMenuDelDia(base, mdd({ disponible: false }), AHORA);
  assert.equal(MDD_ITEM_ID in apagado.items, false);
  const lista = aplicarMenuDelDia({ items: ITEMS, grupos: G }, null, AHORA);
  assert.equal(lista.items.some((i) => i.id === MDD_ITEM_ID), false, 'también con items en lista');
  const vivo = aplicarMenuDelDia(base, mdd(), AHORA);
  assert.ok(vivo.items[MDD_ITEM_ID]);
  assert.deepEqual(vivo.grupos.mdd_proteina.opciones.map((o) => o.nombre), ['Res', 'Cañón de cerdo']);
  assert.deepEqual(vivo.grupos.mdd_ensalada.opciones.map((o) => o.nombre), ['Lechuga primaveral', 'Pico de gallo']);
  assert.equal(base.grupos.mdd_sopa, undefined, 'no muta el menú original');
});

await prueba('Menú del Día: sopa, proteína, ensalada y bebida son obligatorias y salen de menu_del_dia', () => {
  const { items, grupos } = aplicarMenuDelDia(base, mdd(), AHORA);
  const it = items[MDD_ITEM_ID];
  assert.ok(validarSeleccion(it, { opciones: {} }).length === 4, 'faltan las cuatro');
  const l = crearLinea(it, grupos, { cantidad: 2, opciones: { mdd_sopa: ['sancocho_de_gallina'], mdd_proteina: ['canon_de_cerdo'], mdd_ensalada: ['pico_de_gallo'], mdd_bebida: ['jugo_de_mora'] } });
  assert.deepEqual(l.opciones.map((o) => o.valores), [['Sancocho de gallina'], ['Cañón de cerdo'], ['Pico de gallo'], ['Jugo de mora']]);
  assert.equal(l.total, it.precio * 2);
  assert.throws(() => crearLinea(it, grupos, { cantidad: 1, opciones: { mdd_sopa: ['sancocho_de_gallina'], mdd_proteina: ['res', 'canon_de_cerdo'], mdd_ensalada: ['pico_de_gallo'], mdd_bebida: ['jugo_de_mora'] } }), /Máximo 1/);
});

await prueba('A la carta: Churrasco exige término y acompañamiento; Picada Paisa exige porción', () => {
  assert.equal(validarSeleccion(I.churrasco, { opciones: {} }).length, 2);
  const l = crearLinea(I.churrasco, G, { cantidad: 1, opciones: { termino_carne: ['3_4'], acompanamiento: ['yuca'] } });
  assert.deepEqual(l.opciones.map((o) => o.valores), [['3/4'], ['Yuca']]);
  assert.equal(validarSeleccion(I.picada_paisa, { opciones: {} }).length, 1);
  const p = crearLinea(I.picada_paisa, G, { cantidad: 1, opciones: { porcion_picada: ['para_2_personas'] } });
  assert.equal(p.opciones[0].valores[0], 'Para 2 personas');
  assert.equal(p.opciones[0].imprimir, true, 'la porción sale impresa en la comanda');
});

await prueba('agotado: deja de ser vendible', () => {
  assert.equal(vendible(I.res), true);
  assert.equal(vendible({ ...I.res, agotado: true }), false);
  assert.equal(vendible({ ...I.res, activo: false }), false);
});

// ─── Verificación en la nube (pedidos que llegan de la app del cliente) ───
const lineaMdd = (menu, sel) => crearLinea(menu.items[MDD_ITEM_ID], menu.grupos, { cantidad: 1, opciones: { mdd_sopa: ['sancocho_de_gallina'], mdd_proteina: ['res'], mdd_ensalada: ['lechuga_primaveral'], mdd_bebida: ['jugo_de_mora'], ...sel } });
const pedido = (items) => ({ origen: 'app', tipo_entrega: 'recoger', items, subtotal: items.reduce((s, l) => s + l.total, 0), total: items.reduce((s, l) => s + l.total, 0) });

await prueba('nube: pedido de Menú del Día válido pasa limpio', async () => {
  const menu = aplicarMenuDelDia(base, mdd(), AHORA);
  const { verificacion } = await verificarPedidoApp(pedido([lineaMdd(menu), crearLinea(I.agua_cristal_600, G, { cantidad: 1 })]), { menu });
  assert.equal(verificacion.ok, true, verificacion.avisos.join());
});

await prueba('nube: el dueño cambió la sopa y el cliente trae la anterior → se avisa, no se cobra mal', async () => {
  const viejo = aplicarMenuDelDia(base, mdd(), AHORA);
  const nuevo = aplicarMenuDelDia(base, mdd({ sopaDelDia: ['Ajiaco'] }), AHORA);
  const { verificacion } = await verificarPedidoApp(pedido([lineaMdd(viejo)]), { menu: nuevo });
  assert.equal(verificacion.ok, false);
  assert.equal(verificacion.lineas_invalidas, 1);
  assert.match(verificacion.avisos[0], /Opción que no existe/);
});

await prueba('nube: Menú del Día apagado o de ayer → ya no se puede pedir', async () => {
  const vivo = aplicarMenuDelDia(base, mdd(), AHORA);
  const apagado = aplicarMenuDelDia(base, mdd({ disponible: false }), AHORA);
  const { verificacion } = await verificarPedidoApp(pedido([lineaMdd(vivo)]), { menu: apagado });
  assert.match(verificacion.avisos[0], /ya no está en el menú/);
});

await prueba('nube: producto agotado se rechaza con su nombre', async () => {
  const l = crearLinea(I.churrasco, G, { cantidad: 1, opciones: { termino_carne: ['bien_asado'], acompanamiento: ['papas'] } });
  const menu = { items: { ...I, churrasco: { ...I.churrasco, agotado: true } }, grupos: G };
  const { verificacion } = await verificarPedidoApp(pedido([l]), { menu });
  assert.match(verificacion.avisos[0], /Churrasco 270g.* agotado/);
});


await prueba('frecuentes: lo publicado va primero, sin repetidos (tildes/mayúsculas) y con tope', () => {
  const previos = { sopaDelDia: ['Sancocho', 'Ajiaco'], bebidaDelDia: Array.from({ length: 40 }, (_, k) => `Jugo ${k}`) };
  const hoy = armarMenuDelDia({ sopaDelDia: ['ajiaco', 'Mondongo'], proteinaDelDia: ['Res'], ensaladaDelDia: ['Fresca'], bebidaDelDia: ['Limonada'], disponible: true }, AHORA);
  const f = actualizarFrecuentes(previos, hoy);
  assert.deepEqual(f.sopaDelDia, ['ajiaco', 'Mondongo', 'Sancocho']);
  assert.deepEqual(f.proteinaDelDia, ['Res']);
  assert.equal(f.bebidaDelDia.length, MDD_MAX_FRECUENTES);
  assert.equal(f.bebidaDelDia[0], 'Limonada');
  // Chips: historial primero y luego sugerencias, sin duplicar "Sancocho".
  const chips = opcionesParaElegir(f, 'sopaDelDia');
  assert.deepEqual(chips.slice(0, 3), ['ajiaco', 'Mondongo', 'Sancocho']);
  assert.equal(chips.filter((c) => c.toLowerCase() === 'sancocho').length, 1);
  assert.deepEqual(separarOpciones('Frijoles, Lentejas;  ,Sopa de pasta'), ['Frijoles', 'Lentejas', 'Sopa de pasta']);
});

await prueba('desayunos: Desayuno Especial exige proteína/bebida/huevos; una opción apagada se rechaza en la nube', async () => {
  assert.equal(validarSeleccion(I.desayuno_especial, { opciones: {} }).length, 3);
  const sel = { cantidad: 1, opciones: { proteina_desayuno: ['chorizo'], bebida_caliente: ['cafe'], huevos_al_gusto: ['pericos'] } };
  assert.equal(validarSeleccion(I.desayuno_especial, sel).length, 0);
  const l = crearLinea(I.desayuno_especial, G, sel);
  assert.equal(l.total, I.desayuno_especial.precio);
  const ok = await verificarPedidoApp(pedido([l]), { menu: { items: I, grupos: G } });
  assert.equal(ok.verificacion.ok, true, ok.verificacion.avisos.join());
  // El admin apagó "Chorizo" (Agotados → Opciones): un pedido que lo traiga se marca para revisar.
  const sinChorizo = { ...G, proteina_desayuno: { ...G.proteina_desayuno, opciones: G.proteina_desayuno.opciones.map((o) => (o.id === 'chorizo' ? { ...o, activo: false } : o)) } };
  const malo = await verificarPedidoApp(pedido([l]), { menu: { items: I, grupos: sinChorizo } });
  assert.equal(malo.verificacion.ok, false);
});

await prueba('seed: Pescado y Asados separados; A la Carta inactiva y vacía', () => {
  const ids = (c) => MENU_ITEMS.filter((i) => i.categoria_id === c).map((i) => i.id).sort();
  assert.deepEqual(ids('pescado'), ['filete_tilapia', 'robalo', 'tilapia', 'trucha']);
  assert.deepEqual(ids('asados'), ['churrasco', 'punta_de_anca']);
  assert.deepEqual(ids('a_la_carta'), []);
  assert.equal(CATEGORIAS.find((c) => c.id === 'a_la_carta').activo, false);
  const p = Object.fromEntries(MENU_ITEMS.map((i) => [i.id, i.precio]));
  assert.deepEqual([p.tilapia, p.filete_tilapia, p.robalo, p.trucha, p.churrasco, p.punta_de_anca], [34000, 23000, 21000, 28000, 42000, 42000]);
});

await prueba('pescado: acompañamiento obligatorio (uno de dos) y verificado en la nube', async () => {
  for (const id of ['tilapia', 'filete_tilapia', 'robalo', 'trucha']) {
    assert.deepEqual(I[id].grupos_opciones, [{ grupo_id: 'acompanamiento_pescado', etiqueta: 'Acompañamiento', min: 1, max: 1 }]);
    assert.equal(validarSeleccion(I[id], { opciones: {} }).length, 1, `${id} debe exigir acompañamiento`);
    assert.ok(validarSeleccion(I[id], { opciones: { acompanamiento_pescado: ['con_arroz', 'con_patacon'] } }).length > 0, `${id} no admite los dos`);
  }
  assert.deepEqual(G.acompanamiento_pescado.opciones.map((o) => o.id), ['con_arroz', 'con_patacon']);
  const l = crearLinea(I.trucha, G, { cantidad: 1, opciones: { acompanamiento_pescado: ['con_patacon'] } });
  assert.equal(l.total, I.trucha.precio);
  assert.deepEqual(l.opciones.map((o) => [o.grupo_id, o.valores, o.imprimir]), [['acompanamiento_pescado', ['Sopa del menú del día, patacón, ensalada'], true]]);
  const ok = await verificarPedidoApp(pedido([l]), { menu: { items: I, grupos: G } });
  assert.equal(ok.verificacion.ok, true, ok.verificacion.avisos.join());
});

console.log(`\n${n} pruebas de ISMA OK`);
