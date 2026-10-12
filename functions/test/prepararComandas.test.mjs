// Pruebas de la lógica de las Cloud Functions con un Firestore en memoria.
//   cd functions && npm test
import assert from 'node:assert/strict';
import { generarComandas, generarCuenta, reflejarEstado } from '../logica.js';
import { crearLinea, ticketTexto } from '../shared/comandas.js';
import { MENU_ITEMS, GRUPOS_OPCIONES } from './fixtures/menu.jireh.seed.js';

// ─── Firestore falso (lo mínimo que usa logica.js) ──────────────────────
function fakeDb() {
  const data = new Map();
  const ref = (path) => ({
    path,
    collection: (c) => ({ doc: (id) => ref(`${path}/${c}/${id}`) }),
    update: async (u) => aplicarUpdate(path, u),
  });
  const aplicarUpdate = (path, u) => {
    const d = structuredClone(data.get(path));
    for (const [k, v] of Object.entries(u)) {
      const partes = k.split('.');
      let o = d;
      while (partes.length > 1) o = o[partes.shift()] ||= {};
      o[partes[0]] = v;
    }
    data.set(path, d);
  };
  const snap = (path) => ({ exists: data.has(path), data: () => structuredClone(data.get(path)) });
  return {
    data,
    doc: ref,
    async runTransaction(fn) {
      const escrituras = [];
      const tx = {
        get: async (r) => snap(r.path),
        set: (r, v, o) => escrituras.push(() => data.set(r.path, o?.merge ? { ...(data.get(r.path) || {}), ...v } : v)),
        update: (r, u) => escrituras.push(() => aplicarUpdate(r.path, u)),
      };
      const res = await fn(tx);
      escrituras.forEach((w) => w());
      return res;
    },
  };
}

const I = Object.fromEntries(MENU_ITEMS.map((i) => [i.id, i]));
const G = Object.fromEntries(GRUPOS_OPCIONES.map((g) => [g.id, g]));
const ts = () => 'SERVER_TS';
const P = 'restaurantes/jireh2/pedidos';
const T = 'restaurantes/jireh2/trabajos_impresion';

const pedidoMixto = {
  estado: 'confirmado',
  tipo_entrega: 'mesa',
  cliente: { nombre: 'MESA 4' },
  items: [
    crearLinea(I.pizza_mediana, G, { cantidad: 1, opciones: { sabores_pizza: ['hawaiana', 'carnes'] }, modificadores: [] }),
    crearLinea(I.hamb_koller_especial, G, { cantidad: 2, opciones: { carne_koller_pollo: ['koller'], preparacion_hamburguesa: ['pan'] } }),
    crearLinea(I.bebidas_frias_gaseosa_1_5_l, G, { cantidad: 1, opciones: { gaseosa_15: ['pepsi'] } }),
  ],
};

let pruebas = 0;
const prueba = async (nombre, fn) => { await fn(); pruebas++; console.log('✔', nombre); };

await prueba('pedido con pizzería + cocina + general → 2 comandas, número 1', async () => {
  const db = fakeDb();
  db.data.set(`${P}/a`, structuredClone(pedidoMixto));
  const r = await generarComandas(db, 'jireh2', 'a', { ahora: new Date('2026-09-25T18:00:00Z'), serverTimestamp: ts });
  assert.deepEqual(r, { numero: 1, adicion: 0, zonas: ['pizzeria', 'comidas_rapidas'] });
  assert.ok(db.data.has(`${T}/a_pizzeria`) && db.data.has(`${T}/a_comidas_rapidas`));
  assert.ok(!db.data.has(`${T}/a_general`), 'general no imprime');
  const coc = db.data.get(`${T}/a_comidas_rapidas`);
  assert.equal(coc.lineas[0].nombre_comanda, 'HAMB ESPECIAL');
  assert.deepEqual(coc.lineas[0].detalles, ['- Koller'], '"Pan" (por defecto) no se imprime');
  assert.deepEqual(coc.otras_zonas, [{ titulo: 'PIZZERIA', unidades: 1 }]);
  const ped = db.data.get(`${P}/a`);
  assert.equal(ped.numero, 1);
  assert.equal(ped.comandas_generadas, true);
  assert.deepEqual(Object.keys(ped.impresion), ['pizzeria', 'comidas_rapidas']);
});

await prueba('ejecutar dos veces no duplica ni salta números (idempotente)', async () => {
  const db = fakeDb();
  db.data.set(`${P}/a`, structuredClone(pedidoMixto));
  const opts = { ahora: new Date('2026-09-25T18:00:00Z'), serverTimestamp: ts };
  await generarComandas(db, 'jireh2', 'a', opts);
  const r2 = await generarComandas(db, 'jireh2', 'a', opts);
  assert.equal(r2, null);
  assert.equal(db.data.get('restaurantes/jireh2/contadores/pedidos').ultimo, 1);
});

await prueba('consecutivo sube en el día y se reinicia al día siguiente (hora Bogotá)', async () => {
  const db = fakeDb();
  for (const id of ['a', 'b', 'c']) db.data.set(`${P}/${id}`, structuredClone(pedidoMixto));
  const r1 = await generarComandas(db, 'jireh2', 'a', { ahora: new Date('2026-09-25T20:00:00Z'), serverTimestamp: ts });
  // 11:30 p.m. en Bogotá = 04:30 UTC del 26 → sigue siendo el 25
  const r2 = await generarComandas(db, 'jireh2', 'b', { ahora: new Date('2026-09-26T04:30:00Z'), serverTimestamp: ts });
  // 12:30 a.m. del 26 en Bogotá → reinicia
  const r3 = await generarComandas(db, 'jireh2', 'c', { ahora: new Date('2026-09-26T05:30:00Z'), serverTimestamp: ts });
  assert.deepEqual([r1.numero, r2.numero, r3.numero], [1, 2, 1]);
});

await prueba('pedido solo de zona general → sin comandas', async () => {
  const db = fakeDb();
  db.data.set(`${P}/g`, { ...structuredClone(pedidoMixto), items: [pedidoMixto.items[2]] });
  const r = await generarComandas(db, 'jireh2', 'g', { serverTimestamp: ts });
  assert.deepEqual(r.zonas, []);
  assert.deepEqual(db.data.get(`${P}/g`).impresion, {});
});

await prueba('pedido "por_aprobar" no imprime hasta que se confirme', async () => {
  const db = fakeDb();
  db.data.set(`${P}/x`, { ...structuredClone(pedidoMixto), estado: 'por_aprobar' });
  assert.equal(await generarComandas(db, 'jireh2', 'x', { serverTimestamp: ts }), null);
  assert.equal([...db.data.keys()].filter((k) => k.includes('trabajos')).length, 0);
});

await prueba('reflejarEstado copia impreso / error al pedido', async () => {
  const db = fakeDb();
  db.data.set(`${P}/a`, structuredClone(pedidoMixto));
  await generarComandas(db, 'jireh2', 'a', { serverTimestamp: ts });
  const t = db.data.get(`${T}/a_comidas_rapidas`);
  const cambiar = async (antes, despues) => { db.data.set(`${T}/a_comidas_rapidas`, despues); await reflejarEstado(db, 'jireh2', antes, despues); };
  await cambiar(t, { ...t, estado: 'error', error: 'Sin papel' });
  assert.equal(db.data.get(`${P}/a`).impresion.comidas_rapidas.estado, 'error');
  assert.equal(db.data.get(`${P}/a`).impresion.pizzeria.estado, 'en_cola', 'la otra zona no se toca');
  await cambiar({ ...t, estado: 'error' }, { ...t, estado: 'pendiente', reimpresiones: 1 });
  assert.equal(db.data.get(`${P}/a`).impresion.comidas_rapidas.estado, 'en_cola');
});

await prueba('eventos en desorden: si "imprimiendo" llega después de "impreso", el pedido queda Impreso', async () => {
  const db = fakeDb();
  db.data.set(`${P}/a`, structuredClone(pedidoMixto));
  await generarComandas(db, 'jireh2', 'a', { serverTimestamp: ts });
  const t = db.data.get(`${T}/a_pizzeria`);
  const imprimiendo = { ...t, estado: 'imprimiendo' };
  const impreso = { ...t, estado: 'impreso', impreso_en: 'TS' };
  db.data.set(`${T}/a_pizzeria`, impreso); // en Firestore ya está impreso
  await reflejarEstado(db, 'jireh2', imprimiendo, impreso); // llega primero el evento nuevo
  await reflejarEstado(db, 'jireh2', t, imprimiendo); // y después el viejo
  assert.equal(db.data.get(`${P}/a`).impresion.pizzeria.estado, 'impreso');
});

await prueba('"sin ingredientes" sale en la comanda y en el resumen; no aplica a lo que el producto no tiene', async () => {
  const l = crearLinea(I.lasagna_lasagna_grande, G, { cantidad: 1, sin: ['Champiñón', 'Tocineta'] });
  assert.deepEqual(l.sin, ['Champiñón'], 'Tocineta no está en la lasagna: se ignora');
  const db = fakeDb();
  db.data.set(`${P}/s`, { ...structuredClone(pedidoMixto), items: [
    crearLinea(I.hamb_koller_especial, G, { cantidad: 1, opciones: { carne_koller_pollo: ['koller'], preparacion_hamburguesa: ['pan'] }, sin: ['Cebolla', 'Tomate'] }),
  ] });
  await generarComandas(db, 'jireh2', 's', { serverTimestamp: ts });
  assert.deepEqual(db.data.get(`${T}/s_comidas_rapidas`).lineas[0].detalles, ['- Koller', 'SIN CEBOLLA', 'SIN TOMATE']);
});

await prueba('la comanda dice quién atiende (mostrador) o quién aceptó (app)', async () => {
  const { nombreCorto } = await import('../logica.js');
  assert.equal(nombreCorto({ displayName: 'Carlos', email: 'mesero1@jireh2.app' }), 'Carlos');
  assert.equal(nombreCorto({ email: 'vendedora@jireh2.app' }), 'Vendedora');
  const db = fakeDb();
  db.data.set(`${P}/m1`, structuredClone(pedidoMixto));
  db.data.set(`${P}/a1`, { ...structuredClone(pedidoMixto), origen: 'app', cliente: { nombre: 'Ana' } });
  await generarComandas(db, 'jireh2', 'm1', { serverTimestamp: ts, vendedor: 'Carlos' });
  await generarComandas(db, 'jireh2', 'a1', { serverTimestamp: ts, vendedor: 'Luisa' });
  const tm = db.data.get(`${T}/m1_pizzeria`), ta = db.data.get(`${T}/a1_comidas_rapidas`);
  assert.equal(tm.vendedor, 'Carlos');
  assert.match(ticketTexto(tm), /Atiende: Carlos/);
  assert.match(ticketTexto(ta), /App - acepto: Luisa/);
});

await prueba('cuenta: solo con el botón, con bebidas, precios y total; no se duplica', async () => {
  const db = fakeDb();
  db.data.set(`${P}/a`, structuredClone(pedidoMixto));
  await generarComandas(db, 'jireh2', 'a', { serverTimestamp: ts, vendedor: 'Carolina' });
  assert.equal(await generarCuenta(db, 'jireh2', 'a', { serverTimestamp: ts }), null, 'sin tocar el botón no hay cuenta');
  assert.ok(!db.data.has(`${T}/a_cuenta`));
  const ped = db.data.get(`${P}/a`);
  db.data.set(`${P}/a`, { ...ped, cuenta_solicitudes: 1 });
  const r = await generarCuenta(db, 'jireh2', 'a', { serverTimestamp: ts, vendedor: 'Carolina' });
  const esperado = pedidoMixto.items.reduce((s, l) => s + l.total, 0);
  assert.equal(r.total, esperado);
  const c = db.data.get(`${T}/a_cuenta`);
  assert.equal(c.estado, 'pendiente');
  assert.equal(c.lineas.length, 3, 'incluye la gaseosa (zona general)');
  const txt = ticketTexto(c);
  assert.match(txt, /C U E N T A|CUENTA/);
  assert.match(txt, /Gaseosa 1\.5 L/);
  assert.match(txt, /\$\d{1,3}(\.\d{3})+/);
  assert.match(txt, /Atiende: Carolina/);
  assert.equal(await generarCuenta(db, 'jireh2', 'a', { serverTimestamp: ts }), null, 'no se imprime dos veces por el mismo toque');
  assert.equal(db.data.get(`${P}/a`).cuenta.estado, 'en_cola');
  // Se refleja el estado de impresión en pedido.cuenta
  db.data.set(`${T}/a_cuenta`, { ...c, estado: 'impreso', impreso_en: 'TS' });
  await reflejarEstado(db, 'jireh2', c, { ...c, estado: 'impreso' });
  assert.equal(db.data.get(`${P}/a`).cuenta.estado, 'impreso');
  assert.equal(db.data.get(`${P}/a`).impresion.pizzeria.estado, 'en_cola', 'no toca las comandas');
  console.log(txt);
});

await prueba('cuenta abierta: adiciones con el mismo número, comanda "ADICION n" solo con lo nuevo, cuenta con todo junto', async () => {
  const db = fakeDb();
  const ahora = new Date('2026-09-25T18:00:00Z');
  db.data.set(`${P}/a`, { ...structuredClone(pedidoMixto), total: pedidoMixto.items.reduce((s, l) => s + l.total, 0), cobro: { estado: 'abierta' } });
  await generarComandas(db, 'jireh2', 'a', { ahora, serverTimestamp: ts });
  // Adición 1: otra pizza mediana igual + una gaseosa
  const pizzaIgual = crearLinea(I.pizza_mediana, G, { cantidad: 1, opciones: { sabores_pizza: ['hawaiana', 'carnes'] }, modificadores: [] });
  const ad1 = { estado: 'confirmado', tipo_entrega: 'mesa', cliente: { nombre: 'MESA 4' }, adicion_de: 'a', items: [pizzaIgual], total: pizzaIgual.total };
  db.data.set(`${P}/b`, ad1);
  const r1 = await generarComandas(db, 'jireh2', 'b', { ahora, serverTimestamp: ts, vendedor: 'Ana' });
  assert.equal(r1.numero, 1, 'la adición lleva el número de la cuenta');
  assert.equal(r1.adicion, 1);
  assert.deepEqual(r1.zonas, ['pizzeria'], 'solo imprime la zona de lo nuevo');
  const com = db.data.get(`${T}/b_pizzeria`);
  assert.equal(com.adicion, 1);
  assert.equal(com.lineas.length, 1, 'la comanda trae SOLO lo nuevo');
  assert.match(ticketTexto(com), /A D I C I O N   1/);
  assert.equal(db.data.get('restaurantes/jireh2/contadores/pedidos').ultimo, 1, 'no gasta número del día');
  const padre = db.data.get(`${P}/a`);
  assert.deepEqual(padre.adiciones, ['b']);
  assert.equal(padre.total_cuenta, padre.total + pizzaIgual.total);
  // Repetir no duplica
  assert.equal(await generarComandas(db, 'jireh2', 'b', { ahora, serverTimestamp: ts }), null);
  // Adición 2 (solo bebida: no imprime comanda)
  const gaseosa = crearLinea(I.bebidas_frias_gaseosa_1_5_l, G, { cantidad: 2, opciones: { gaseosa_15: ['uva'] } });
  db.data.set(`${P}/c`, { estado: 'confirmado', tipo_entrega: 'mesa', adicion_de: 'a', items: [gaseosa], total: gaseosa.total });
  const r2 = await generarComandas(db, 'jireh2', 'c', { ahora, serverTimestamp: ts });
  assert.equal(r2.adicion, 2);
  assert.deepEqual(r2.zonas, []);
  // Un pedido nuevo normal sigue con el #2
  db.data.set(`${P}/d`, structuredClone(pedidoMixto));
  assert.equal((await generarComandas(db, 'jireh2', 'd', { ahora, serverTimestamp: ts })).numero, 2);
  // Cuenta: todo junto, la pizza repetida se suma en un renglón
  db.data.set(`${P}/a`, { ...db.data.get(`${P}/a`), cuenta_solicitudes: 1 });
  const cuenta = await generarCuenta(db, 'jireh2', 'a', { serverTimestamp: ts });
  const c = db.data.get(`${T}/a_cuenta`);
  const totalEsperado = db.data.get(`${P}/a`).total_cuenta;
  assert.equal(cuenta.total, totalEsperado);
  const pizza = c.lineas.find((l) => /Mediana/i.test(l.nombre));
  assert.equal(pizza.cantidad, 2, 'misma pizza del pedido y de la adición → un renglón con 2');
  assert.equal(c.lineas.length, 4, 'pizza×2, hamburguesas, gaseosa pepsi, gaseosas uva');
  console.log(ticketTexto(c));
});

console.log(`\n${pruebas} pruebas OK`);
