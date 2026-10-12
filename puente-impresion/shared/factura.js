// Facturación electrónica con Factus (API v2) — lógica pura, sin red.
// La usan la Cloud Function (para armar y enviar la factura), el POS (para
// validar el formulario) y las pruebas.
//
// Documentación: https://developers.factus.com.co/facturas/crear-y-validar/
//
// Reglas de Tío Nacho:
//  - El impuesto viene de la configuración (por defecto INC 8 % INCLUIDO en los
//    precios). Factus pide el precio SIN impuesto: se divide entre 1 + tarifa.
//  - Las promos del día viajan como descuento (discount_rate) en las líneas del
//    cóctel en promo.
//  - Se factura desde "Pedidos" con un botón: a Consumidor final o con los datos
//    que dé el cliente.

import { IMPUESTOS_DEFECTO, impuestoDeLinea, descuentosPorLinea } from './impuestos.js';

// El impuesto (INC 8 % incluido, por defecto) ya no está aquí: se configura en
// el POS (admin → Configuración → Impuestos). Ver shared/impuestos.js.
export const CONFIG_FACTURA = {
  prefijo_referencia: 'TN',
  unit_measure_code: '94', // unidad
  standard_code: '999', // estándar de adopción del contribuyente
};

// Formas de pago del POS → códigos de medio de pago DIAN (tabla de Factus).
// ⚠️ "Tarjeta" no distingue débito (49) de crédito (48): se usa 48.
export const MEDIO_PAGO_DIAN = { efectivo: '10', transferencia: '47', tarjeta: '48' };

export const TIPOS_DOCUMENTO = [
  { code: '13', nombre: 'Cédula de ciudadanía', corto: 'CC' },
  { code: '31', nombre: 'NIT', corto: 'NIT' },
  { code: '22', nombre: 'Cédula de extranjería', corto: 'CE' },
  { code: '48', nombre: 'PPT', corto: 'PPT' },
  { code: '41', nombre: 'Pasaporte', corto: 'PA' },
  { code: '42', nombre: 'Documento extranjero', corto: 'DE' },
];
export const cortoDocumento = (code) => TIPOS_DOCUMENTO.find((t) => t.code === code)?.corto || code;

export const CONSUMIDOR_FINAL = {
  identification_document_code: '13',
  identification: '222222222222',
  names: 'Consumidor final',
  legal_organization_code: '2',
  tribute_code: 'ZZ',
};

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const f2 = (n) => r2(n).toFixed(2);

/**
 * Valida los datos del cliente que escribe la cajera.
 * datos = { consumidor_final: true } | { tipo, numero, dv?, nombre, email?, telefono?, direccion?, responsable_iva? }
 * @returns string[] errores (vacío = bien)
 */
export function validarCliente(datos) {
  if (!datos || datos.consumidor_final) return [];
  const e = [];
  if (!TIPOS_DOCUMENTO.some((t) => t.code === datos.tipo)) e.push('Elige el tipo de documento.');
  const num = String(datos.numero || '').trim();
  const soloDigitos = ['13', '31', '22'].includes(datos.tipo);
  if (!num) e.push('Escribe el número de documento.');
  else if (soloDigitos && !/^\d{5,15}$/.test(num)) e.push('El número de documento debe tener solo dígitos (5 a 15), sin puntos ni dígito de verificación.');
  else if (!/^[A-Za-z0-9]{3,20}$/.test(num)) e.push('Número de documento no válido.');
  if (datos.dv != null && datos.dv !== '' && !/^\d$/.test(String(datos.dv))) e.push('El dígito de verificación es un solo número.');
  if (!String(datos.nombre || '').trim()) e.push(datos.tipo === '31' ? 'Escribe la razón social.' : 'Escribe el nombre del cliente.');
  if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) e.push('El correo no es válido.');
  return e;
}

/** Dígito de verificación de un NIT (algoritmo DIAN). */
export function calcularDV(nit) {
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const d = String(nit).replace(/\D/g, '').split('').reverse();
  const s = d.reduce((acc, c, i) => acc + Number(c) * pesos[i], 0) % 11;
  return String(s > 1 ? 11 - s : s);
}

/** Objeto `customer` de Factus. */
export function clienteFactus(datos) {
  if (!datos || datos.consumidor_final) return { ...CONSUMIDOR_FINAL };
  const esNit = datos.tipo === '31';
  const juridica = datos.persona ? datos.persona === 'juridica' : esNit;
  const nombre = String(datos.nombre).trim();
  const c = {
    identification_document_code: datos.tipo,
    identification: String(datos.numero).trim(),
    ...(esNit ? { dv: String(datos.dv ?? '') !== '' ? String(datos.dv) : calcularDV(datos.numero) } : {}),
    legal_organization_code: juridica ? '1' : '2',
    ...(juridica ? { company: nombre } : { names: nombre }),
    tribute_code: datos.responsable_iva ? '01' : 'ZZ',
  };
  if (datos.email?.trim()) c.email = datos.email.trim();
  if (datos.telefono?.trim()) c.phone = datos.telefono.trim();
  if (datos.direccion?.trim()) c.address = datos.direccion.trim();
  return c;
}

/** Nombre de la línea en la factura: producto + opciones elegidas. */
function nombreLinea(l) {
  const ops = [
    ...(l.opciones || []).filter((o) => o.valores?.length && o.imprimir !== false).map((o) => o.valores.join(', ')),
    ...(l.modificadores || []).map((m) => m.nombre),
  ].join(' · ');
  const base = l.nombre_pantalla || l.nombre || l.item_id;
  return (ops ? `${base} (${ops})` : base).slice(0, 250);
}

/**
 * Arma el cuerpo de POST /v2/bills/validate.
 * @param pedido     documento del pedido (items, descuentos, pago, numero, dia)
 * @param pedidoId   id del documento (va en reference_code, que debe ser único)
 * @param cliente    datos del formulario (ver validarCliente)
 * @param opciones   { promos, numbering_range_id, impuestos (config de shared/impuestos.js), config }
 * @returns { cuerpo, esperado: { base, impuesto, total } }
 */
export function armarFactura(pedido, pedidoId, cliente, { promos = [], numbering_range_id = null, impuestos = IMPUESTOS_DEFECTO, config = CONFIG_FACTURA, referencia = null } = {}) {
  const tasas = descuentosPorLinea(pedido.items, pedido.descuentos, promos);
  let base = 0;
  let impuesto = 0;

  const items = (pedido.items || []).map((l, i) => {
    const imp = impuestoDeLinea(l, impuestos); // { nombre, codigo, tarifa } | null
    const precio = r2(l.precio_unitario / (imp ? 1 + imp.tarifa / 100 : 1));
    const rate = tasas.get(i) || 0;
    const bruto = r2(precio * l.cantidad);
    const gravable = r2(bruto - r2((bruto * rate) / 100));
    base += gravable;
    if (imp) impuesto += r2((gravable * imp.tarifa) / 100);
    return {
      code_reference: String(l.item_id).slice(0, 50),
      name: nombreLinea(l),
      quantity: f2(l.cantidad),
      discount_rate: f2(rate),
      price: f2(precio),
      unit_measure_code: config.unit_measure_code,
      standard_code: config.standard_code,
      ...(l.nota ? { note: String(l.nota).slice(0, 200) } : {}),
      taxes: imp ? [{ code: imp.codigo, rate: f2(imp.tarifa) }] : [],
    };
  });

  const total = r2(base + impuesto);
  const c = clienteFactus(cliente);
  const numero = pedido.numero ? `#${String(pedido.numero).padStart(3, '0')}` : '';
  const cuerpo = {
    // Única por factura: si el pedido se vuelve a facturar tras anular, llega `referencia` con sufijo (-2, -3…).
    reference_code: referencia || `${config.prefijo_referencia}-${pedidoId}`,
    document: '01',
    operation_type: '10',
    ...(numbering_range_id ? { numbering_range_id: Number(numbering_range_id) } : {}),
    observation: `Pedido ${numero} del ${pedido.dia || ''}`.replace(/\s+/g, ' ').trim(),
    send_email: !!c.email,
    payment_details: detallesPago(pedido, total),
    customer: c,
    items,
  };
  return { cuerpo, esperado: { base: r2(base), impuesto: r2(impuesto), total } };
}

/**
 * Medios de pago para Factus. Pago mixto → una línea por medio; la última se
 * ajusta para que la suma sea exactamente el total de la factura (centavos).
 */
function detallesPago(pedido, total) {
  const pago = pedido.pago || {};
  const partes = pago.metodo === 'mixto' ? (pago.partes || []).filter((x) => x.valor > 0) : [{ metodo: pago.metodo, valor: total }];
  const cobrado = partes.reduce((s, x) => s + x.valor, 0) || 1;
  let acumulado = 0;
  return partes.map((x, i) => {
    const amount = i === partes.length - 1 ? r2(total - acumulado) : r2((x.valor / cobrado) * total);
    acumulado += amount;
    return { payment_form: '1', payment_method_code: MEDIO_PAGO_DIAN[x.metodo] || '10', amount: f2(amount) };
  });
}

// ─── Anulación con nota crédito ────────────────────────────────────────
// DIAN: concepto de corrección 2 = "Anulación de factura electrónica";
// customization_id 20 = nota crédito que referencia una factura electrónica.
export const RESPONSABILIDAD_POR_DEFECTO = 'R-99-PN';
export const NOTA_CREDITO = { concepto_anulacion: '2', customization_id: '20', prefijo_referencia: 'NC' };

/** Referencia de la factura número n de un pedido (la 1.ª conserva la de siempre). */
export const referenciaFactura = (pedidoId, n = 1) => `${CONFIG_FACTURA.prefijo_referencia}-${pedidoId}${n > 1 ? `-${n}` : ''}`;
/** Referencia única de la nota crédito que anula una factura. */
export const referenciaNotaCredito = (numeroFactura, ahora = Date.now()) => `${NOTA_CREDITO.prefijo_referencia}-${numeroFactura}-${ahora}`;

/**
 * Cuerpo de POST /v2/credit-notes/validate para anular TODA una factura.
 * Los ítems y medios de pago se arman igual que en la factura original, así el
 * total de la nota es exactamente el de la factura. El cliente es el mismo de
 * la factura (Factus lo exige en la nota crédito, con responsabilidades fiscales).
 * @param factura  p.factura (estado 'emitida': numero, cliente_enviado, totales…)
 * @returns { cuerpo, esperado: { base, impuesto, total } }
 */
export function armarNotaCredito(pedido, pedidoId, factura, { promos = [], impuestos = IMPUESTOS_DEFECTO, numbering_range_id = null, referencia, motivo = '' } = {}) {
  const { cuerpo: fac, esperado } = armarFactura(pedido, pedidoId, factura.cliente_enviado || { consumidor_final: true }, { promos, impuestos });
  const numero = pedido.numero ? ` (pedido #${String(pedido.numero).padStart(3, '0')})` : '';
  const cuerpo = {
    reference_code: referencia,
    correction_concept_code: NOTA_CREDITO.concepto_anulacion,
    customization_id: NOTA_CREDITO.customization_id,
    bill_number: factura.numero,
    ...(numbering_range_id ? { numbering_range_id: Number(numbering_range_id) } : {}),
    observation: `Anulación total de la factura ${factura.numero}${numero}${motivo ? `. Motivo: ${String(motivo).trim()}` : ''}`.slice(0, 500),
    payment_details: fac.payment_details,
    // R-99-PN = "No aplica – Otros" (valor por defecto de Factus; lo pide en la nota crédito).
    customer: { ...fac.customer, responsibilities: fac.customer.responsibilities || RESPONSABILIDAD_POR_DEFECTO },
    // Factus marca `note` como requerido en los ítems de la nota crédito.
    items: fac.items.map((it) => ({ ...it, note: it.note || `Anulación factura ${factura.numero}` })),
  };
  return { cuerpo, esperado };
}

/** Lo que se guarda de la nota crédito (respuesta de POST /v2/credit-notes/validate). */
export function resumenNotaCredito(data) {
  const nc = data?.credit_note || data?.bill || data || {};
  return {
    numero: nc.number || '',
    cufe: nc.cufe || nc.cude || '',
    qr: nc.qr || data?.links?.qr || nc.links?.qr || '',
    url: nc.public_url || data?.links?.public_url || nc.links?.public_url || '',
    validada: (nc.is_validated ?? data?.is_validated) !== false,
    errores_dian: Object.values(nc.errors || data?.errors || {}).flat().map(String),
  };
}

/**
 * Lo que se guarda en el pedido a partir de la respuesta de Factus
 * (data de POST /v2/bills/validate o GET /v2/bills/:number).
 */
export function resumenFactura(data, cliente) {
  const rango = data?.numbering_range || {};
  const emp = data?.company || {};
  const tot = data?.totals || {};
  const imp = (data?.taxes || [])[0];
  return {
    numero: data?.number || '',
    prefijo: rango.prefix || '',
    cufe: data?.cufe || '',
    qr: data?.links?.qr || data?.qr || '',
    url: data?.links?.public_url || data?.public_url || '',
    validada: data?.is_validated !== false,
    validada_en: data?.validated_at || null,
    errores_dian: Object.values(data?.errors || {}).flat().map(String),
    resolucion: {
      numero: rango.resolution_number || '',
      prefijo: rango.prefix || '',
      desde: rango.from ?? null,
      hasta: rango.to ?? null,
      inicio: rango.start_date || '',
      fin: rango.end_date || '',
    },
    emisor: {
      nit: emp.nit || '',
      dv: emp.dv || '',
      nombre: emp.name || emp.company || emp.establishment?.name || '',
      direccion: [emp.establishment?.address, emp.establishment?.municipality?.name].filter(Boolean).join(', '),
    },
    cliente: cliente?.consumidor_final || !cliente
      ? { consumidor_final: true, doc: 'CC 222222222222', nombre: 'Consumidor final' }
      : {
          doc: `${cortoDocumento(cliente.tipo)} ${String(cliente.numero).trim()}${cliente.tipo === '31' ? `-${String(cliente.dv ?? '') !== '' ? cliente.dv : calcularDV(cliente.numero)}` : ''}`,
          nombre: String(cliente.nombre).trim(),
          email: cliente.email?.trim() || '',
        },
    totales: {
      base: Number(tot.taxable_amount ?? tot.gross_amount ?? 0),
      impuesto: Number(tot.tax_amount ?? 0),
      total: Number(tot.total ?? 0),
      impuesto_nombre: imp?.tribute?.name || '',
    },
  };
}

/** Mensajes legibles de un error de Factus (422 trae `data.errors` o `errors`). */
export function erroresFactus(cuerpo) {
  const errs = cuerpo?.data?.errors || cuerpo?.errors;
  const lista = errs && typeof errs === 'object' ? Object.entries(errs).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((m) => `${k}: ${m}`)) : [];
  return lista.length ? lista : [cuerpo?.message || 'Error desconocido de Factus'];
}
