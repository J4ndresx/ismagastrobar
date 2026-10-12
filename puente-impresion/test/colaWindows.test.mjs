// Pruebas de la vigilancia de la cola de Windows (sin Windows: estados simulados).
//   node test/colaWindows.test.mjs
import assert from 'node:assert/strict';
import { diagnosticar, verificarSalida } from '../colaWindows.js';

let n = 0;
const prueba = async (t, fn) => { await fn(); n++; console.log('✔', t); };
const est = (estado = 'Normal', trabajos = [], extra = {}) => ({ existe: true, nombre: 'POS-8360', estado, sinConexion: false, trabajos, ...extra });

await prueba('diagnóstico: lista, sin papel, apagada, sin conexión, pausada, no existe', async () => {
  assert.equal(diagnosticar(est()).estado, 'lista');
  assert.equal(diagnosticar(est('PaperOut')).estado, 'sin_papel');
  assert.equal(diagnosticar(est('Normal', [{ estado: 'Error, Printing, PaperOut', segundos: 3 }])).estado, 'sin_papel');
  assert.equal(diagnosticar(est('Offline')).estado, 'apagada');
  assert.equal(diagnosticar(est('Normal', [], { sinConexion: true })).estado, 'sin_conexion');
  assert.equal(diagnosticar(est('Paused')).estado, 'pausada');
  assert.equal(diagnosticar(est('DoorOpen')).estado, 'tapa_abierta');
  assert.equal(diagnosticar({ existe: false }).estado, 'no_encontrada');
});

await prueba('comandas viejas en cola = atascada; las ya impresas y conservadas no cuentan', async () => {
  assert.equal(diagnosticar(est('Normal', [{ estado: 'Spooling', segundos: 45 }])).estado, 'atascada');
  assert.equal(diagnosticar(est('Normal', [{ estado: 'Printed, Retained', segundos: 900 }])).estado, 'lista');
});

await prueba('verificar: la comanda sale de la cola → OK', async () => {
  const seq = [est('Normal', [{ estado: 'Printing', segundos: 1 }]), est()];
  const r = await verificarSalida('POS80', { cadaMs: 1, leer: async () => seq.shift() || est() });
  assert.deepEqual(r, { ok: true });
});

await prueba('verificar: Windows reporta sin papel → error con motivo', async () => {
  const r = await verificarSalida('POS80', { cadaMs: 1, leer: async () => est('Normal', [{ estado: 'Error, PaperOut', segundos: 2 }]) });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /sin papel/i);
});

await prueba('verificar: se queda en cola sin explicación → error por tiempo', async () => {
  const r = await verificarSalida('POS80', { maxMs: 30, cadaMs: 5, leer: async () => est('Normal', [{ estado: 'Spooling', segundos: 1 }]) });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /no salió/);
});

console.log(`\n${n} pruebas de la cola de Windows OK`);
