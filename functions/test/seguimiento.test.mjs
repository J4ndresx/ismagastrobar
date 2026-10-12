// Seguimiento del cliente: la copia pública no lleva datos personales y
// refleja la etapa correcta.
import assert from 'node:assert/strict';
import { espejoSeguimiento } from '../logica.js';
import { etapaActual, generarToken, tokenValido, festivosColombia, tiempoEstimado } from '../shared/seguimiento.js';

const guardado = new Map();
const db = { doc: (path) => ({ set: async (v) => guardado.set(path, v) }) };
const token = generarToken();
const base = {
  seguimiento_token: token, origen: 'app', estado: 'por_aprobar', tipo_entrega: 'domicilio',
  cliente: { nombre: 'ANA', telefono: '3001234567', direccion: 'CALLE 6 #1-2' },
  items: [{ cantidad: 2, nombre_pantalla: 'Pizza Mediana', total: 50000 }], total: 52000,
  domicilio: { tipo: 'SECTOR', tarifa: 2000 }, domicilio_valor: 2000, pago: { metodo: 'datafono' },
  creado_en: new Date('2026-10-03T15:00:00Z'),
};
let n = 0;
const prueba = async (t, fn) => { await fn(); n++; console.log('✔', t); };

await prueba('token: 22 caracteres y distinto cada vez', async () => {
  assert.ok(tokenValido(token));
  assert.notEqual(generarToken(), generarToken());
  assert.ok(!tokenValido('corto'));
});

await prueba('etapas: recibido → preparando → en camino → entregado; rechazado', async () => {
  assert.equal(etapaActual(base), 'recibido');
  assert.equal(etapaActual({ ...base, estado: 'confirmado' }), 'preparando');
  assert.equal(etapaActual({ ...base, estado: 'confirmado', etapa: 'en_camino' }), 'en_camino');
  assert.equal(etapaActual({ ...base, estado: 'rechazado', etapa: 'en_camino' }), 'rechazado');
});

await prueba('copia pública sin teléfono ni dirección; solo escribe si cambia algo', async () => {
  assert.equal(await espejoSeguimiento(db, 'panzzerotty', null, base), true);
  const v = guardado.get(`restaurantes/panzzerotty/seguimiento/${token}`);
  assert.equal(v.etapa, 'recibido');
  assert.deepEqual(v.items, [{ cantidad: 2, nombre: 'Pizza Mediana' }]);
  const texto = JSON.stringify(v);
  assert.ok(!texto.includes('3001234567') && !texto.includes('CALLE 6') && !texto.includes('ANA'), 'sin datos personales');
  assert.equal(await espejoSeguimiento(db, 'panzzerotty', base, { ...base, impresion: { x: 1 } }), false, 'cambio interno: no escribe');
  const aprobado = { ...base, estado: 'confirmado', numero: 7, aprobado_en: new Date('2026-10-03T15:02:00Z') };
  assert.equal(await espejoSeguimiento(db, 'panzzerotty', base, aprobado), true);
  assert.equal(guardado.get(`restaurantes/panzzerotty/seguimiento/${token}`).numero, 7);
  assert.equal(guardado.get(`restaurantes/panzzerotty/seguimiento/${token}`).horas.preparando, '2026-10-03T15:02:00.000Z');
});

await prueba('pedidos sin código (mostrador) no crean seguimiento', async () => {
  assert.equal(await espejoSeguimiento(db, 'panzzerotty', null, { ...base, seguimiento_token: undefined }), false);
});

await prueba('tiempo estimado: viernes a domingo y festivos más largo; festivos 2026 de Colombia', async () => {
  const f = festivosColombia(2026);
  for (const d of ['2026-01-12', '2026-04-02', '2026-04-03', '2026-05-18', '2026-06-08', '2026-06-15', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16']) assert.ok(f.has(d), d);
  assert.equal(f.size, 18);
  assert.deepEqual(tiempoEstimado('domicilio', '2026-10-06T22:00:00Z'), [30, 45], 'martes');
  assert.deepEqual(tiempoEstimado('domicilio', '2026-10-09T22:00:00Z'), [40, 55], 'viernes');
  assert.deepEqual(tiempoEstimado('llevar', '2026-10-12T22:00:00Z'), [20, 20], 'lunes festivo');
  assert.deepEqual(tiempoEstimado('llevar', '2026-10-09T03:00:00Z'), [15, 15], 'jueves 10 p. m. en Bogotá (viernes en UTC)');
});

console.log(`\n${n} pruebas de seguimiento OK`);
