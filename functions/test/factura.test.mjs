// Pruebas de la facturación electrónica con Factus: armado del JSON, cliente
// HTTP (con un Factus falso) y el flujo completo del botón "Facturar".
import assert from 'node:assert/strict';
import { armarFactura, clienteFactus, validarCliente, calcularDV, resumenFactura, CONSUMIDOR_FINAL } from '../shared/factura.js';
import { crearLinea, totalesPedido, construirCuenta, ticketTexto, bloquesTicket, PROMOS } from '../shared/comandas.js';
import { MENU_ITEMS, GRUPOS_OPCIONES } from './fixtures/menu.jireh.seed.js';
import { crearClienteFactus } from '../factus.js';
import { facturarPedido } from '../facturacion.js';
import { aEscPos } from '../../puente-impresion/escpos.js';
import { desgloseImpuestos, impuestoDeLinea, IMPUESTOS_DEFECTO } from '../shared/impuestos.js';

const I = Object.fromEntries(MENU_ITEMS.map((i) => [i.id, i]));
const G = Object.fromEntries(GRUPOS_OPCIONES.map((g) => [g.id, g]));
const VIERNES = new Date('2026-10-09T23:00:00Z');
const dori = crearLinea(I.dorilocos_pequeno_mixto, G, { cantidad: 1, opciones: { sabor_dorilocos: ['tradicional'], doritos: ['doritos_de_queso'], proteinas: ['carne', 'pollo'], salsas: ['chamoy', 'pina', 'cheddar', 'guacamole'] } });
const pinas = crearLinea(I.pina_colada, G, { cantidad: 2 });
const jugo = crearLinea(I.jugo_natural, G, { cantidad: 1, opciones: { sabor_jugo: ['mora'], base_jugo: ['en_agua'] } });
const items = [dori, pinas, jugo].map((l) => ({ ...l, nombre_pantalla: l.nombre }));
const t = totalesPedido(items, VIERNES);
const pedido = { estado: 'confirmado', numero: 7, dia: '2026-10-09', items, subtotal: t.subtotal, descuentos: t.descuentos, total: t.total, pago: { metodo: 'efectivo', recibido: 100000 } };

let n = 0;
const prueba = async (nombre, fn) => { await fn(); n++; console.log('✔', nombre); };

// ─── Armado del JSON ────────────────────────────────────────────────────
await prueba('precios sin INC (÷1,08) y total de Factus = lo cobrado', async () => {
  const { cuerpo, esperado } = armarFactura(pedido, 'abc123', { consumidor_final: true }, { promos: PROMOS });
  assert.equal(cuerpo.reference_code, 'TN-abc123');
  assert.equal(cuerpo.items.length, 3);
  assert.equal(cuerpo.items[0].price, (23000 / 1.08).toFixed(2));
  assert.deepEqual(cuerpo.items[0].taxes, [{ code: '04', rate: '8.00' }]);
  assert.equal(cuerpo.items[0].quantity, '1.00');
  assert.equal(cuerpo.items[0].unit_measure_code, '94');
  assert.match(cuerpo.items[0].name, /Dorilocos Pequeño Mixto \(Tradicional · Doritos de queso · Carne, Pollo · Chamoy/);
  assert.ok(Math.abs(esperado.total - pedido.total) <= 1, `Factus ${esperado.total} vs cobrado ${pedido.total}`);
  assert.equal(cuerpo.payment_details[0].amount, esperado.total.toFixed(2));
  assert.equal(cuerpo.payment_details[0].payment_method_code, '10');
});

await prueba('la promo del viernes va como descuento en las piñas coladas', async () => {
  const { cuerpo } = armarFactura(pedido, 'x', null, { promos: PROMOS });
  const pc = cuerpo.items.find((i) => i.code_reference === 'pina_colada');
  assert.equal(pc.discount_rate, '25.00', '2 × $30.000 sobre $40.000 = 25 %');
  assert.equal(cuerpo.items.find((i) => i.code_reference === 'jugo_natural').discount_rate, '0.00');
});

await prueba('consumidor final por defecto', async () => {
  assert.deepEqual(clienteFactus(null), CONSUMIDOR_FINAL);
  const { cuerpo } = armarFactura(pedido, 'x', { consumidor_final: true });
  assert.equal(cuerpo.customer.identification, '222222222222');
  assert.equal(cuerpo.send_email, false);
});

await prueba('cliente con cédula (persona natural) y con NIT (empresa, DV calculado)', async () => {
  const cc = clienteFactus({ tipo: '13', numero: '1036000111', nombre: 'Ana Gómez', email: 'ana@correo.com' });
  assert.deepEqual(cc, { identification_document_code: '13', identification: '1036000111', legal_organization_code: '2', names: 'Ana Gómez', tribute_code: 'ZZ', email: 'ana@correo.com' });
  const nit = clienteFactus({ tipo: '31', numero: '900123456', nombre: 'Empresa SAS', responsable_iva: true });
  assert.equal(nit.legal_organization_code, '1');
  assert.equal(nit.company, 'Empresa SAS');
  assert.equal(nit.dv, calcularDV('900123456'));
  assert.equal(nit.tribute_code, '01');
  assert.equal(calcularDV('800197268'), '4', 'NIT de la DIAN');
  assert.equal(calcularDV('860034313'), '7');
});

await prueba('validación del formulario', async () => {
  assert.deepEqual(validarCliente({ consumidor_final: true }), []);
  assert.ok(validarCliente({ tipo: '13', numero: '12.345', nombre: 'X' })[0].includes('solo dígitos'));
  assert.ok(validarCliente({ tipo: '13', numero: '1036000111', nombre: '' })[0].includes('nombre'));
  assert.ok(validarCliente({ tipo: '13', numero: '1036000111', nombre: 'A', email: 'malo' })[0].includes('correo'));
});

// ─── Cliente HTTP con Factus falso ──────────────────────────────────────
function factusFalso({ fallarValidate = null, pendiente = false } = {}) {
  const llamadas = [];
  let tokens = 0;
  let hayPendiente = pendiente;
  const resp = (status, j) => ({ ok: status < 300, status, json: async () => j });
  const fetchFalso = async (url, o) => {
    const ruta = url.replace(/^https?:\/\/[^/]+/, '');
    llamadas.push(`${o.method} ${ruta}`);
    if (ruta === '/oauth/token') return resp(200, { token_type: 'Bearer', expires_in: 600, access_token: `tok${++tokens}`, refresh_token: 'ref' });
    if (ruta.startsWith('/v2/bills/destroy/')) { hayPendiente = false; return resp(200, { message: 'ok' }); }
    if (ruta === '/v2/bills/validate') {
      if (hayPendiente) return resp(409, { message: 'Se encontró una factura pendiente por enviar a la DIAN' });
      if (fallarValidate) return resp(fallarValidate.status, fallarValidate.cuerpo);
      const c = JSON.parse(o.body);
      return resp(201, {
        status: 'Created',
        data: {
          number: 'SETP990000550', cufe: 'c'.repeat(96), is_validated: true, validated_at: '09-10-2026 06:00:00 PM', errors: {},
          numbering_range: { prefix: 'SETP', from: 990000001, to: 990001000, resolution_number: '18760000001', start_date: '01-01-2025', end_date: '31-12-2026' },
          company: { nit: '901234567', dv: '1', name: 'TIO NACHO SAS', establishment: { name: 'Tío Nacho', address: 'Cra 50 # 30-20', municipality: { name: 'Itagüí' } } },
          taxes: [{ tribute: { code: '04', name: 'INC' } }],
          totals: { taxable_amount: '60185.19', tax_amount: '4814.81', total: c.payment_details[0].amount },
          links: { qr: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=ccc', public_url: 'https://developers.factus.com.co/bill/ccc' },
        },
      });
    }
    return resp(404, { message: 'no' });
  };
  return { api: crearClienteFactus({ url: 'https://api-sandbox.factus.com.co', client_id: 'a', client_secret: 'b', username: 'u', password: 'p' }, fetchFalso), llamadas };
}

await prueba('cliente Factus: pide token una vez y lo reutiliza', async () => {
  const { api, llamadas } = factusFalso();
  await api.validarFactura({ reference_code: 'R1', payment_details: [{ amount: '1.00' }] });
  await api.validarFactura({ reference_code: 'R2', payment_details: [{ amount: '1.00' }] });
  assert.deepEqual(llamadas, ['POST /oauth/token', 'POST /v2/bills/validate', 'POST /v2/bills/validate']);
});

await prueba('cliente Factus: 409 (factura pendiente) → la borra y reintenta', async () => {
  const { api, llamadas } = factusFalso({ pendiente: true });
  const r = await api.validarFactura({ reference_code: 'TN-x', payment_details: [{ amount: '1.00' }] });
  assert.equal(r.data.number, 'SETP990000550');
  assert.deepEqual(llamadas.slice(1), ['POST /v2/bills/validate', 'DELETE /v2/bills/destroy/reference/TN-x', 'POST /v2/bills/validate']);
});

// ─── Flujo del botón "Facturar" ─────────────────────────────────────────
function fakeDb() {
  const data = new Map();
  const aplicar = (path, u) => { data.set(path, { ...structuredClone(data.get(path)), ...u }); };
  const ref = (path) => ({ path, update: async (u) => aplicar(path, u) });
  return {
    data,
    doc: ref,
    async runTransaction(fn) {
      const w = [];
      const r = await fn({ get: async (x) => ({ exists: data.has(x.path), data: () => structuredClone(data.get(x.path)) }), update: (x, u) => w.push(() => aplicar(x.path, u)) });
      w.forEach((f) => f());
      return r;
    },
  };
}
const P = 'restaurantes/tionacho/pedidos/p1';
const ctx = (db, factus) => ({ db, factus, rid: 'tionacho', por: 'Carolina', serverTimestamp: () => 'TS', increment: (k) => ({ inc: k }) });

await prueba('facturar: guarda número, CUFE, QR y pide imprimir la cuenta', async () => {
  const db = fakeDb();
  db.data.set(P, structuredClone(pedido));
  const { api } = factusFalso();
  const f = await facturarPedido(ctx(db, api), 'p1', { tipo: '13', numero: '1036000111', nombre: 'Ana Gómez' });
  const p = db.data.get(P);
  assert.equal(f.estado, 'emitida');
  assert.equal(p.factura.numero, 'SETP990000550');
  assert.equal(p.factura.cliente.doc, 'CC 1036000111');
  assert.ok(p.factura.qr.includes('dian'));
  assert.deepEqual(p.cuenta_solicitudes, { inc: 1 });
});

await prueba('no se factura dos veces el mismo pedido', async () => {
  const db = fakeDb();
  db.data.set(P, { ...structuredClone(pedido), factura: { estado: 'emitida', numero: 'SETP1' } });
  await assert.rejects(facturarPedido(ctx(db, factusFalso().api), 'p1', { consumidor_final: true }), /ya tiene la factura SETP1/);
  db.data.set(P, { ...structuredClone(pedido), factura: { estado: 'procesando', desde_ms: Date.now() } });
  await assert.rejects(facturarPedido(ctx(db, factusFalso().api), 'p1', { consumidor_final: true }), /se está generando/);
});

await prueba('error 422 de Factus: queda en el pedido con el detalle para corregir', async () => {
  const db = fakeDb();
  db.data.set(P, structuredClone(pedido));
  const { api } = factusFalso({ fallarValidate: { status: 422, cuerpo: { message: 'Error de validación', data: { errors: { 'customer.identification': ['El campo es inválido'] } } } } });
  await assert.rejects(facturarPedido(ctx(db, api), 'p1', { consumidor_final: true }), (e) => e.codigo === 'invalid-argument' && /customer.identification/.test(e.message));
  const p = db.data.get(P);
  assert.equal(p.factura.estado, 'error');
  assert.equal(p.factura.status, 422);
  assert.equal(p.cuenta_solicitudes, undefined, 'no imprime');
});

await prueba('cuenta abierta: no se factura hasta cobrarla', async () => {
  const db = fakeDb();
  db.data.set(P, { ...structuredClone(pedido), cuenta_abierta: true });
  const { api, llamadas } = factusFalso();
  await assert.rejects(facturarPedido(ctx(db, api), 'p1', { consumidor_final: true }), /cuenta está abierta/);
  assert.equal(llamadas.length, 0);
});

await prueba('datos del cliente inválidos: no llama a Factus', async () => {
  const db = fakeDb();
  db.data.set(P, structuredClone(pedido));
  const { api, llamadas } = factusFalso();
  await assert.rejects(facturarPedido(ctx(db, api), 'p1', { tipo: '13', numero: '', nombre: 'A' }), /número de documento/);
  assert.equal(llamadas.length, 0);
});

// ─── Cuenta impresa con la factura ──────────────────────────────────────
await prueba('la cuenta sale como factura electrónica con INC, resolución, CUFE y QR', async () => {
  const { api } = factusFalso();
  const r = await api.validarFactura(armarFactura(pedido, 'p1', null, { promos: PROMOS }).cuerpo);
  const factura = { ...resumenFactura(r.data, null), estado: 'emitida' };
  const c = construirCuenta('p1', { ...pedido, factura });
  const txt = ticketTexto({ ...c, pedido_creado_en: VIERNES.toISOString() });
  assert.match(txt, /FACTURA ELECTRONICA DE VENTA/);
  assert.match(txt, /No\. SETP990000550/);
  assert.match(txt, /NIT 901234567-1/);
  assert.match(txt, /Cliente: Consumidor final/);
  assert.match(txt, /Impuesto al consumo \(INC\)\s+\$4\.815/);
  assert.match(txt, /Resolucion DIAN No\. 18760000001/);
  assert.match(txt, /CUFE:/);
  assert.match(txt, /\[ QR DIAN \]/);
  assert.doesNotMatch(txt, /no valido como factura/);
  // ESC/POS: el QR va con GS ( k
  const bytes = aEscPos(bloquesTicket({ ...c, pedido_creado_en: VIERNES.toISOString() }));
  assert.ok(bytes.includes(Buffer.from([0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30])), 'imprime el QR');
  console.log(txt);
});

await prueba('pago mixto: dos medios de pago en la factura que suman el total', async () => {
  const mixto = { ...pedido, pago: { metodo: 'mixto', partes: [{ metodo: 'efectivo', valor: 20000 }, { metodo: 'transferencia', valor: pedido.total - 20000 }] } };
  const { cuerpo, esperado } = armarFactura(mixto, 'x', null, { promos: PROMOS });
  assert.equal(cuerpo.payment_details.length, 2);
  assert.deepEqual(cuerpo.payment_details.map((d) => d.payment_method_code), ['10', '47']);
  const suma = cuerpo.payment_details.reduce((s, d) => s + Number(d.amount), 0);
  assert.equal(Math.round(suma * 100), Math.round(esperado.total * 100));
  assert.ok(Math.abs(Number(cuerpo.payment_details[0].amount) - 20000) <= 1);
});

await prueba('pago mixto en la cuenta impresa: medios, valores y cambio de la parte en efectivo', async () => {
  const mixto = { ...pedido, pago: { metodo: 'mixto', partes: [{ metodo: 'efectivo', valor: 20000 }, { metodo: 'tarjeta', valor: pedido.total - 20000 }], recibido: 50000 } };
  const c = construirCuenta('p1', mixto);
  const txt = ticketTexto({ ...c, pedido_creado_en: VIERNES.toISOString() });
  assert.match(txt, /Pago: Efectivo \$20\.000 \+ Tarjeta \$/);
  assert.match(txt, /Cambio\s+\$30\.000/);
});

// ─── Impuestos configurables ────────────────────────────────────────────
await prueba('desglose por defecto: INC 8 % incluido, con la promo descontada', async () => {
  const d = desgloseImpuestos(items, t.descuentos, null, PROMOS);
  assert.equal(d.base + d.valor + d.sin_impuesto, pedido.total, 'base + INC = lo cobrado');
  assert.equal(d.detalle.length, 1);
  assert.equal(d.detalle[0].nombre, 'INC');
  assert.equal(d.valor, Math.round(pedido.total - pedido.total / 1.08));
  assert.deepEqual(totalesPedido(items, VIERNES).impuestos, d);
});

await prueba('categoría excluida y categoría con IVA 19 %', async () => {
  const cfg = { ...IMPUESTOS_DEFECTO, categorias: { jugos: { modo: 'excluido' }, cocteles: { modo: 'otra', nombre: 'IVA', codigo: '01', tarifa: 19 } } };
  assert.equal(impuestoDeLinea(jugo, cfg), null);
  assert.deepEqual(impuestoDeLinea(pinas, cfg), { nombre: 'IVA', codigo: '01', tarifa: 19 });
  const d = desgloseImpuestos(items, t.descuentos, cfg, PROMOS);
  assert.equal(d.detalle.length, 2);
  assert.equal(d.sin_impuesto, jugo.total);
  const { cuerpo, esperado } = armarFactura(pedido, 'x', null, { promos: PROMOS, impuestos: cfg });
  assert.deepEqual(cuerpo.items.find((i) => i.code_reference === 'jugo_natural').taxes, []);
  assert.equal(cuerpo.items.find((i) => i.code_reference === 'jugo_natural').price, '10500.00');
  assert.deepEqual(cuerpo.items.find((i) => i.code_reference === 'pina_colada').taxes, [{ code: '01', rate: '19.00' }]);
  assert.ok(Math.abs(esperado.total - pedido.total) <= 1);
});

await prueba('no responsable: sin impuestos en el desglose ni en la factura', async () => {
  const cfg = { ...IMPUESTOS_DEFECTO, responsable: false };
  const d = desgloseImpuestos(items, t.descuentos, cfg, PROMOS);
  assert.equal(d.valor, 0);
  assert.equal(d.sin_impuesto, pedido.total);
  const { cuerpo, esperado } = armarFactura(pedido, 'x', null, { promos: PROMOS, impuestos: cfg });
  assert.ok(cuerpo.items.every((i) => i.taxes.length === 0));
  assert.equal(esperado.total, pedido.total);
});

await prueba('la cuenta sin factura muestra "Incluye INC 8%"', async () => {
  const c = construirCuenta('p1', { ...pedido, impuestos: totalesPedido(items, VIERNES).impuestos });
  const txt = ticketTexto({ ...c, pedido_creado_en: VIERNES.toISOString() });
  assert.match(txt, /Incluye INC 8%\s+\$4\.\d{3}/);
  assert.match(txt, /no valido como factura/);
});

console.log(`\n${n} pruebas OK`);
