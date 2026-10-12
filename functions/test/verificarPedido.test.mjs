// Pruebas de la verificación de precios de pedidos de la app.
import assert from 'node:assert/strict';
import { verificarPedidoApp } from '../verificarPedido.js';
import { crearLinea } from '../shared/comandas.js';
import { MENU_ITEMS, GRUPOS_OPCIONES } from './fixtures/menu.jireh.seed.js';
import { DOMICILIO } from '../shared/domicilio.js';
const TC = DOMICILIO.tarifaConjunto;

const I = Object.fromEntries(MENU_ITEMS.map((i) => [i.id, i]));
const G = Object.fromEntries(GRUPOS_OPCIONES.map((g) => [g.id, g]));
const menu = { items: I, grupos: G };
const lineaPizza = () => ({ ...crearLinea(I.pizza_mediana, G, { cantidad: 1, opciones: { sabores_pizza: ['hawaiana', 'carnes'] }, modificadores: ['adicional_queso'] }), nombre_pantalla: 'Pizza Mediana' });
const lineaSalchi = () => crearLinea(I.salchipapas_sencilla, G, { cantidad: 2, sin: ['Huevos de codorniz'] });
const pedidoHonesto = () => {
  const items = [lineaPizza(), lineaSalchi()];
  const subtotal = items.reduce((s, l) => s + l.total, 0);
  return { origen: 'app', tipo_entrega: 'domicilio', items, subtotal, domicilio_valor: TC, total: subtotal + TC,
    domicilio: { tipo: 'SECTOR', metodo: 'conjunto', tarifa: TC }, direccion_detalle: { conjuntoId: 'terra-castilla', conjunto: 'Terra Castilla' } };
};
const sinGoogle = async () => { throw new Error('no debería consultar'); };

let n = 0;
const prueba = async (t, fn) => { await fn(); n++; console.log('✔', t); };

await prueba('pedido honesto: queda igual y verificado', async () => {
  const p = pedidoHonesto();
  const { cambios, verificacion } = await verificarPedidoApp(p, { menu, cotizar: sinGoogle });
  assert.equal(verificacion.ok, true, verificacion.avisos.join());
  assert.equal(cambios.total, p.total);
  assert.equal(cambios.items[1].sin[0], 'Huevos de codorniz');
});

await prueba('precio alterado en el celular: se corrige con el menú y se avisa', async () => {
  const p = pedidoHonesto();
  const real = p.total;
  p.items[0] = { ...p.items[0], precio_unitario: 1000, total: 1000 };
  p.total = p.items.reduce((s, l) => s + l.total, 0) + TC;
  const { cambios, verificacion } = await verificarPedidoApp(p, { menu, cotizar: sinGoogle });
  assert.equal(verificacion.ok, false);
  assert.equal(cambios.total, real);
  assert.equal(verificacion.total_app, p.total);
  assert.match(verificacion.avisos[0], /la app decía \$1\.000/);
});

await prueba('opción o adicional inventado, o producto que no existe: esa línea se quita y se avisa', async () => {
  const p = pedidoHonesto();
  p.items.push({ ...lineaPizza(), modificadores: [{ id: 'gratis', nombre: 'Todo gratis', precio: -50000 }] });
  p.items.push({ item_id: 'no_existe', cantidad: 1, opciones: [], modificadores: [], total: 100 });
  p.items.push({ ...lineaPizza(), opciones: [{ grupo_id: 'sabores_pizza', valores: ['Inventada'] }] });
  const { cambios, verificacion } = await verificarPedidoApp(p, { menu, cotizar: sinGoogle });
  assert.equal(cambios.items.length, 2);
  assert.equal(verificacion.lineas_invalidas, 3);
  assert.equal(verificacion.avisos.length, 3);
});

await prueba('cantidad absurda o negativa: se rechaza la línea', async () => {
  const p = pedidoHonesto();
  p.items[1] = { ...p.items[1], cantidad: -3 };
  const { verificacion } = await verificarPedidoApp(p, { menu, cotizar: sinGoogle });
  assert.equal(verificacion.lineas_invalidas, 1);
});

await prueba('domicilio: el celular dice $0 pero la dirección está a 3,4 km → $8.000', async () => {
  const p = pedidoHonesto();
  p.direccion_detalle = { nomenclatura: 'CALLE 6D#80B-89', barrio: 'Castilla' };
  p.domicilio_valor = 0; p.total = p.subtotal;
  const { cambios, verificacion } = await verificarPedidoApp(p, { menu, cotizar: async () => ({ estado: 'ok', km: 3.4, tarifa: 8000, kmCobrados: 4 }) });
  assert.equal(cambios.domicilio_valor, 8000);
  assert.equal(cambios.total, p.subtotal + 8000);
  assert.match(verificacion.avisos.join(), /Domicilio/);
});

await prueba('para recoger: domicilio 0; fuera de cobertura: se avisa', async () => {
  const p = pedidoHonesto();
  p.tipo_entrega = 'llevar'; p.domicilio_valor = 0; p.total = p.subtotal;
  const r1 = await verificarPedidoApp(p, { menu, cotizar: sinGoogle });
  assert.equal(r1.verificacion.ok, true);
  const q = pedidoHonesto();
  q.direccion_detalle = { nomenclatura: 'CALLE 1#10-10' }; q.domicilio_valor = 10000;
  const r2 = await verificarPedidoApp(q, { menu, cotizar: async () => ({ estado: 'fuera', km: 7.2 }) });
  assert.match(r2.verificacion.avisos.join(), /fuera de cobertura/);
});


await prueba('gaseosa 350 ml (vidrio) en domicilio: se avisa; para recoger no', async () => {
  const p = pedidoHonesto();
  const g350 = { ...crearLinea(I.bebidas_frias_gaseosa_350_ml, G, { cantidad: 2, opciones: { gaseosa_350: ['pepsi'] } }) };
  p.items = [...p.items, g350]; p.subtotal += g350.total; p.total += g350.total;
  const r = await verificarPedidoApp(p, { menu, cotizar: sinGoogle });
  assert.equal(g350.solo_local, true);
  assert.match(r.verificacion.avisos.join(), /vidrio/);
  p.tipo_entrega = 'llevar'; p.domicilio_valor = 0; p.total = p.subtotal;
  const r2 = await verificarPedidoApp(p, { menu, cotizar: sinGoogle });
  assert.doesNotMatch(r2.verificacion.avisos.join(), /vidrio/);
});

console.log(`\n${n} pruebas de verificación de precios OK`);

