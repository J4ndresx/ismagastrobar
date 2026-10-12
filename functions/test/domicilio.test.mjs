// Pruebas de las tarifas de domicilio y de la cotización (Google simulado).
import assert from 'node:assert/strict';
import { DOMICILIO, distanciaKm, tarifaPorDistancia, calcularDomicilio, TARIFAS_DOMICILIO, mismaDireccion } from '../shared/domicilio.js';
import { cotizarDomicilio } from '../domicilio.js';

let pruebas = 0;
const prueba = async (n, fn) => { await fn(); pruebas++; console.log('✔', n); };

// Punto a cierta distancia (km) al norte de la tienda.
const alNorte = (km) => ({ lat: DOMICILIO.origen.lat + km / 111.2, lng: DOMICILIO.origen.lng });
const google = (punto, extra = {}) => async () => ({
  status: 'OK',
  results: [{
    formatted_address: 'Cl. 6d #80b-89, Bogotá, Colombia',
    geometry: { location: punto, location_type: 'ROOFTOP' },
    types: ['street_address'],
    address_components: [{ long_name: DOMICILIO.municipiosGoogle[0], types: ['locality', 'political'] }],
    ...extra,
  }],
});

await prueba('tarifas por tramos en metros (TARIFAS_DOMICILIO); más de 5.000 m sin cobertura', async () => {
  const casos = [[0, 0], [100, 0], [100.4, 0], [100.6, 2000], [101, 2000], [400, 2000], [401, 3000], [600, 3000], [800, 4000], [1000, 5000],
    [1001, 6000], [1400, 6000], [1800, 7000], [2200, 8000], [2600, 9000], [3200, 10000], [3201, 11000], [3400, 11000], [3800, 12000],
    [4000, 13000], [4400, 14000], [4500, 15000], [4501, 16000], [5000, 16000]];
  for (const [m, precio] of casos) assert.equal(calcularDomicilio(m), precio, `${m} m`);
  assert.equal(calcularDomicilio(5001), null);
  assert.equal(calcularDomicilio(-5), null);
  assert.equal(calcularDomicilio(NaN), null);
  // Tramos continuos y ordenados
  TARIFAS_DOMICILIO.forEach((t, i) => i && assert.equal(t.min, TARIFAS_DOMICILIO[i - 1].max + 1));
  assert.deepEqual(tarifaPorDistancia(3.4), { tarifa: 11000, kmCobrados: null });
  assert.equal(tarifaPorDistancia(5.1), null);
});

await prueba('Google devuelve otra cuadra (pediste #58-123, responde #67-58) → por confirmar, no se cobra', async () => {
  const otra = google(alNorte(0.3), { formatted_address: 'Cl. 75 # 67-58, La Concepción, Barranquilla, Atlántico, Colombia' });
  const r = await cotizarDomicilio({ direccion: 'CALLE 75 #58-123' }, { geocodificar: otra });
  assert.equal(r.estado, 'no_encontrada');
  const misma = google(alNorte(0.3), { formatted_address: 'Cl. 75 #58-120, La Concepción, Barranquilla, Atlántico, Colombia' });
  assert.equal((await cotizarDomicilio({ direccion: 'CALLE 75 #58-123' }, { geocodificar: misma })).estado, 'ok', 'misma cuadra, placa aproximada: sirve');
  // Lo que quedó mal guardado en caché antes de esta validación tampoco se usa.
  const malGuardado = { estado: 'ok', km: 0.9, metros: 900, tarifa: 5000, direccion_encontrada: 'Cl. 75 # 67-58, La Concepción, Barranquilla' };
  const r3 = await cotizarDomicilio({ direccion: 'CALLE 75 #58-123' }, { geocodificar: misma, cache: { get: async () => malGuardado, set: async () => {} } });
  assert.equal(r3.estado, 'ok');
  assert.match(r3.direccion_encontrada, /#58-120/, 'se volvió a consultar a Google');
  // Comparación de nomenclaturas
  assert.equal(mismaDireccion('Cra. 66 #74-123', 'Cra. 66 #74-123, La Concepción, Barranquilla'), true);
  assert.equal(mismaDireccion('CARRERA 82 A #6-11', 'Cra. 82a #6-11, Bogotá'), true);
  assert.equal(mismaDireccion('Calle 75 #58A-10', 'Cl. 75 #58-10'), false, 'la letra cuenta');
  assert.equal(mismaDireccion('Calle 75 #58-10', 'Cra. 75 #58-10'), false, 'calle ≠ carrera');
  assert.equal(mismaDireccion('Calle 75 #58-10', 'Cl. 76 #58-10'), false);
  assert.equal(mismaDireccion('Calle 75 #58-10', 'Barrio La Concepción, Barranquilla'), false, 'sin nomenclatura en el resultado');
});

await prueba('distancia en línea recta', async () => {
  assert.ok(Math.abs(distanciaKm(DOMICILIO.origen, alNorte(3)) - 3) < 0.01);
});

await prueba('cotizar: dirección precisa a 3,4 km → tarifa del tramo', async () => {
  const r = await cotizarDomicilio({ direccion: 'Calle 6D #80B-89', barrio: 'Castilla' }, { geocodificar: google(alNorte(3.4)) });
  assert.equal(r.estado, 'ok');
  assert.equal(r.km, 3.4);
  assert.equal(r.tarifa, calcularDomicilio(r.metros));
  assert.ok(Math.abs(r.metros - 3400) <= 2);
});

await prueba('cotizar: a 6 km → fuera de cobertura', async () => {
  const r = await cotizarDomicilio({ direccion: 'Calle 6D #80B-89' }, { geocodificar: google(alNorte(6)) });
  assert.equal(r.estado, 'fuera');
});

await prueba('cotizar: Google solo encuentra el barrio o la calle → por confirmar (no cobra mal)', async () => {
  const r = await cotizarDomicilio({ direccion: 'Calle 6D #80B-89' }, { geocodificar: google(alNorte(1), { geometry: { location: alNorte(1), location_type: 'APPROXIMATE' }, types: ['neighborhood'] }) });
  assert.equal(r.estado, 'no_encontrada');
  const r2 = await cotizarDomicilio({ direccion: 'Calle 6D #80B-89' }, { geocodificar: async () => ({ status: 'ZERO_RESULTS', results: [] }) });
  assert.equal(r2.estado, 'no_encontrada');
  const r3 = await cotizarDomicilio({ direccion: 'abc' }, { geocodificar: async () => { throw new Error('no debería llamar'); } });
  assert.equal(r3.estado, 'no_encontrada');
});

await prueba('cotizar: otra ciudad (lejísimos) → por confirmar; la caché evita pagar dos veces la misma dirección', async () => {
  // ⚠️ Punto "lejísimos" = Medellín. Si el local de Panzzerotty queda en el Valle de Aburrá, cambiar por otra ciudad.
  const r = await cotizarDomicilio({ direccion: 'Calle 6D #80B-89' }, { geocodificar: google({ lat: 4.65, lng: -74.1 }) });
  assert.equal(r.estado, 'no_encontrada');
  const mem = new Map(); let llamadas = 0;
  const cache = { get: async (k) => mem.get(k), set: async (k, v) => mem.set(k, v) };
  const geo = async (...a) => { llamadas++; return google(alNorte(1))(...a); };
  await cotizarDomicilio({ direccion: 'Calle 6D #80B-89', barrio: 'Castilla' }, { geocodificar: geo, cache });
  const r2 = await cotizarDomicilio({ direccion: 'calle 6d  #80b-89', barrio: 'castilla' }, { geocodificar: geo, cache });
  assert.equal(llamadas, 1);
  assert.equal(r2.tarifa, calcularDomicilio(1000));
});

console.log(`\n${pruebas} pruebas de domicilio OK`);

// Normalización: "Ave calle 6 N° 68 - 45" debe llegar a Google como "AVENIDA CALLE 6 #68-45"
{
  const { normalizarDireccion } = await import('../shared/domicilio.js');
  const assert = (await import('node:assert/strict')).default;
  assert.equal(normalizarDireccion('ave calle 6 N° 68 - 45'), 'AVENIDA CALLE 6 #68-45');
  assert.equal(normalizarDireccion('AK 68 # 6-45'), 'AVENIDA CARRERA 68 #6-45');
  assert.equal(normalizarDireccion('Cra 80b no 6-20'), 'CARRERA 80B #6-20');
  assert.equal(normalizarDireccion('Calle 6D #80B-89 Sur'), 'CALLE 6D #80B-89 SUR');
  let pedido = '';
  const { cotizarDomicilio } = await import('../domicilio.js');
  await cotizarDomicilio({ direccion: 'ave calle 6 N° 68 - 45' }, { geocodificar: async (t) => { pedido = t; return { status: 'ZERO_RESULTS' }; } });
  assert.match(pedido, new RegExp('^AVENIDA CALLE 6 #68-45, ' + DOMICILIO.ciudad));
  const guardados = [];
  await cotizarDomicilio({ direccion: 'Calle 1 #2-3' }, { geocodificar: async () => ({ status: 'ZERO_RESULTS' }), cache: { get: async () => null, set: async (k, v) => guardados.push(v) } });
  assert.equal(guardados.length, 0, '"no encontrada" no se guarda en caché');
  console.log('✔ normaliza "Ave calle 6 N° 68 - 45" y no guarda fallos en caché');
}

// Si cambian las tarifas, una dirección ya guardada en caché se cobra con la tarifa NUEVA.
{
  const assert = (await import('node:assert/strict')).default;
  const { cotizarDomicilio } = await import('../domicilio.js');
  const { tarifaPorDistancia } = await import('../shared/domicilio.js');
  const viejo = { estado: 'ok', km: 3.4, tarifa: 999999, kmCobrados: 4, direccion_encontrada: 'Cl. 9 #70-10, Barranquilla', ubicacion: { lat: 1, lng: 2 } };
  let llamadas = 0;
  const r = await cotizarDomicilio({ direccion: 'Calle 9 #70-10' }, { geocodificar: async () => { llamadas++; return {}; }, cache: { get: async () => viejo, set: async () => {} } });
  assert.equal(llamadas, 0);
  assert.equal(r.tarifa, tarifaPorDistancia(3.4).tarifa);
  console.log('✔ caché: la tarifa se recalcula con los precios actuales');
}

// Barrio que confunde a Google ("Ciudad Techo II"): primero se busca sin barrio.
{
  const assert = (await import('node:assert/strict')).default;
  const { cotizarDomicilio } = await import('../domicilio.js');
  const { DOMICILIO } = await import('../shared/domicilio.js');
  const textos = [];
  const geo = async (t) => {
    textos.push(t);
    const conBarrio = /Techo/i.test(t);
    return {
      status: 'OK',
      results: [{
        formatted_address: 'Cra. 82a #6-11, Bogotá',
        geometry: { location: { lat: DOMICILIO.origen.lat + 0.0005, lng: DOMICILIO.origen.lng }, location_type: conBarrio ? 'APPROXIMATE' : 'ROOFTOP' },
        types: conBarrio ? ['neighborhood'] : ['street_address'],
        partial_match: conBarrio,
        address_components: [{ long_name: DOMICILIO.municipiosGoogle[0], types: ['locality', 'political'] }],
      }],
    };
  };
  const r = await cotizarDomicilio({ direccion: 'CARRERA 82 A #6-11', barrio: 'Ciudad techo II' }, { geocodificar: geo });
  assert.equal(r.estado, 'ok');
  assert.equal(textos.length, 1);
  assert.match(textos[0], new RegExp('^CARRERA 82A #6-11, ' + DOMICILIO.ciudad));
  // Si sin barrio no aparece, se intenta con el barrio.
  const textos2 = [];
  const geo2 = async (t) => { textos2.push(t); return /Castilla/.test(t) ? google(alNorte(0.05))() : { status: 'ZERO_RESULTS', results: [] }; };
  const r2 = await cotizarDomicilio({ direccion: 'Calle 6D #80B-89', barrio: 'Castilla' }, { geocodificar: geo2 });
  assert.equal(r2.estado, 'ok');
  assert.equal(textos2.length, 2);
  console.log('✔ barrio confuso: se busca primero sin barrio y luego con él');
}
