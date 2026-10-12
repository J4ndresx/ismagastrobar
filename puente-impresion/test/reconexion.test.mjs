// Reconexión rápida: reintenta cada 15 s mientras no haya conexión y se detiene al volver.
import assert from 'node:assert/strict';
import { crearReconector } from '../reconexion.js';

const llamadas = [];
let tic = null;
const r = crearReconector({
  desactivar: async () => llamadas.push('off'),
  activar: async () => llamadas.push('on'),
  programar: (fn) => { tic = fn; return 1; },
  cancelar: () => { tic = null; },
});
r.iniciar();
r.iniciar(); // no duplica
assert.equal(r.activo, true);
await tic(); await tic();
assert.deepEqual(llamadas, ['off', 'on', 'off', 'on']);
assert.equal(r.detener(), 2);
assert.equal(r.activo, false);
assert.equal(tic, null);
console.log('✔ reintenta mientras no hay conexión y se detiene cuando vuelve');

// Un fallo al reintentar no tumba el puente.
const r2 = crearReconector({ desactivar: async () => { throw new Error('x'); }, activar: async () => {}, programar: () => 1, cancelar: () => {} });
await r2.ahora();
console.log('✔ un error al reintentar no detiene el servicio');
