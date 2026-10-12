// Impuestos de la venta (INC / IVA) — configurables desde el POS (admin →
// Configuración → Impuestos). Se guardan en restaurantes/{rid}/config/impuestos
// y los usan el POS (desglose en pedido, cobro, cuenta y caja) y la Cloud
// Function de facturación. Si el documento no existe se usa IMPUESTOS_DEFECTO.
//
// Tío Nacho (por confirmar con el contador): responsable de INC 8 % y los
// precios de la carta YA lo incluyen. El impuesto no cambia lo que se cobra:
// solo se separa la base y el impuesto.

export const IMPUESTOS_DEFECTO = {
  responsable: true,
  nombre: 'INC',
  codigo: '04', // código del tributo para la DIAN/Factus: 04 INC, 01 IVA
  tarifa: 8,
  incluido: true, // los precios de la carta ya traen el impuesto
  // Excepciones por categoría: { [categoria_id]: { modo: 'excluido' } | { modo: 'otra', nombre, codigo, tarifa } }
  categorias: {},
};

export const TRIBUTOS = [
  { codigo: '04', nombre: 'INC', largo: 'Impuesto nacional al consumo' },
  { codigo: '01', nombre: 'IVA', largo: 'Impuesto sobre las ventas' },
];

/** Mezcla lo guardado en Firestore con los valores por defecto (campos que falten). */
export function normalizarImpuestos(cfg) {
  const c = { ...IMPUESTOS_DEFECTO, ...(cfg || {}) };
  c.tarifa = Number(c.tarifa) || 0;
  c.categorias = { ...(c.categorias || {}) };
  c.incluido = true; // por ahora solo se soporta impuesto incluido en el precio
  return c;
}

/** Impuesto que aplica a una línea del pedido, o null si va sin impuesto. */
export function impuestoDeLinea(linea, cfg) {
  const c = normalizarImpuestos(cfg);
  if (!c.responsable) return null;
  const exc = c.categorias[linea.categoria_id];
  if (exc?.modo === 'excluido') return null;
  if (exc?.modo === 'otra') {
    const t = Number(exc.tarifa) || 0;
    return t > 0 ? { nombre: exc.nombre || 'IVA', codigo: exc.codigo || '01', tarifa: t } : null;
  }
  return c.tarifa > 0 ? { nombre: c.nombre, codigo: c.codigo, tarifa: c.tarifa } : null;
}

/**
 * Porcentaje de descuento de cada línea según las promos del pedido
 * (descuentos = [{ id, descuento }] que calcula el POS con PROMOS).
 * @returns Map índice de línea → porcentaje
 */
export function descuentosPorLinea(lineas, descuentos, promos) {
  const tasa = new Map();
  for (const d of descuentos || []) {
    const promo = (promos || []).find((p) => p.id === d.id);
    if (!promo) continue;
    const idx = (lineas || []).map((l, i) => (promo.items.includes(l.item_id) ? i : -1)).filter((i) => i >= 0);
    const normal = idx.reduce((s, i) => s + lineas[i].total, 0);
    if (!normal) continue;
    const rate = Math.round((d.descuento / normal) * 10000) / 100;
    idx.forEach((i) => tasa.set(i, rate));
  }
  return tasa;
}

/**
 * Desglose del impuesto incluido en lo cobrado.
 * @returns { base, valor, detalle: [{ nombre, codigo, tarifa, base, valor }], sin_impuesto }
 *          (pesos enteros; base + valor + sin_impuesto = total cobrado)
 */
export function desgloseImpuestos(lineas, descuentos, cfg, promos) {
  const tasas = descuentosPorLinea(lineas, descuentos, promos);
  const grupos = new Map();
  let sinImpuesto = 0;
  (lineas || []).forEach((l, i) => {
    const neto = l.total * (1 - (tasas.get(i) || 0) / 100);
    const imp = impuestoDeLinea(l, cfg);
    if (!imp) { sinImpuesto += neto; return; }
    const clave = `${imp.codigo}|${imp.tarifa}`;
    const g = grupos.get(clave) || { nombre: imp.nombre, codigo: imp.codigo, tarifa: imp.tarifa, total: 0 };
    g.total += neto;
    grupos.set(clave, g);
  });
  const detalle = [...grupos.values()].map((g) => {
    const total = Math.round(g.total);
    const base = Math.round(total / (1 + g.tarifa / 100));
    return { nombre: g.nombre, codigo: g.codigo, tarifa: g.tarifa, base, valor: total - base };
  });
  return {
    base: detalle.reduce((s, d) => s + d.base, 0),
    valor: detalle.reduce((s, d) => s + d.valor, 0),
    detalle,
    sin_impuesto: Math.round(sinImpuesto),
  };
}

/** Texto corto: "INC 8%". */
export const etiquetaImpuesto = (d) => `${d.nombre} ${String(d.tarifa).replace('.', ',')}%`;
