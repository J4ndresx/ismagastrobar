// Tarifas de domicilio — Panzzerotty Pizza (Caldas).
// Lo usan la app del cliente (para mostrar el valor) y la Cloud Function
// `cotizarDomicilio` (que ubica la dirección con Google). Para cambiar
// precios, distancias o conjuntos, se edita SOLO este archivo y se publica
// (desplegar.bat).

export const DOMICILIO = {
  ciudad: 'Caldas',
  // Google: solo se aceptan direcciones que caigan en estos municipios, y la
  // búsqueda se orienta a este rectángulo (sur,oeste|norte,este) del área metropolitana.
  municipiosGoogle: ['Caldas'],
  limitesGoogle: '10.85,-74.95|11.10,-74.70',
  // Punto del local (Google Maps, 10-oct-2026).
  origen: { lat: 6.094206730855824, lng: -75.63549417643729 },

  // Tarifas por distancia: ver TARIFAS_DOMICILIO (abajo). Más lejos que maxKm no hay domicilio.
  maxKm: 5,

  // Conjuntos con tarifa fija (no se mide distancia). Vacío = el cliente siempre
  // escribe su dirección y se cobra por distancia.
  tarifaConjunto: 1000,
  conjuntos: [],
};

// Tarifas de domicilio de Panzzerotty (COP) por distancia en METROS,
// en línea recta desde el local. Más de 5.000 m: sin cobertura.
export const TARIFAS_DOMICILIO = [
  { min: 0, max: 100, precio: 0 },
  { min: 101, max: 400, precio: 2000 },
  { min: 401, max: 600, precio: 3000 },
  { min: 601, max: 800, precio: 4000 },
  { min: 801, max: 1000, precio: 5000 },
  { min: 1001, max: 1400, precio: 6000 },
  { min: 1401, max: 1800, precio: 7000 },
  { min: 1801, max: 2200, precio: 8000 },
  { min: 2201, max: 2600, precio: 9000 },
  { min: 2601, max: 3200, precio: 10000 },
  { min: 3201, max: 3400, precio: 11000 },
  { min: 3401, max: 3800, precio: 12000 },
  { min: 3801, max: 4000, precio: 13000 },
  { min: 4001, max: 4400, precio: 14000 },
  { min: 4401, max: 4500, precio: 15000 },
  { min: 4501, max: 5000, precio: 16000 },
];

/**
 * Precio del domicilio según la distancia en metros.
 * Se redondea al metro y se toma el primer tramo cuyo `max` la cubre
 * (así 100,4 m cae en 0–100 y 100,6 m en 101–400, sin huecos entre tramos).
 * @returns {number|null} precio en COP, o null si está fuera de cobertura (> 5.000 m).
 */
export function calcularDomicilio(distanciaMetros) {
  if (!Number.isFinite(distanciaMetros) || distanciaMetros < 0) return null;
  const m = Math.round(distanciaMetros);
  for (const t of TARIFAS_DOMICILIO) if (m <= t.max) return t.precio;
  return null;
}

/** Distancia en línea recta (km) entre dos puntos { lat, lng }. */
export function distanciaKm(a, b) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Valor del domicilio según la distancia en km (usa TARIFAS_DOMICILIO).
 * @returns {{ tarifa: number, kmCobrados: null } | null}  null = fuera de cobertura
 */
export function tarifaPorDistancia(km) {
  const tarifa = calcularDomicilio(km * 1000);
  return tarifa == null ? null : { tarifa, kmCobrados: null };
}

export const conjuntoPorId = (id) => DOMICILIO.conjuntos.find((c) => c.id === id) || null;

/**
 * Pone la dirección en la forma que Google entiende mejor en Bogotá.
 * Los clientes escriben "Ave calle 6 N° 68 - 45", "AC 6 # 68-45",
 * "Cra 80b no 6-20", "Cll 6D Sur #80B-89"…; todo queda como
 * "AVENIDA CALLE 6 #68-45", "CARRERA 80B #6-20", etc.
 */
/**
 * Partes de una nomenclatura colombiana: "CALLE 75 #58-123" → { tipo: 'CALLE', via: '75', cruce: '58' }.
 * Acepta también lo que devuelve Google ("Cl. 75 # 67-58, La Concepción…"). null si no se reconoce.
 */
export function partesDireccion(texto) {
  const n = normalizarDireccion(String(texto || '').split(',')[0]);
  const m = n.match(/^(?:AVENIDA )?(CALLE|CARRERA|DIAGONAL|TRANSVERSAL|AVENIDA)\s+(\d+[A-H]?)\b.*?#(\d+[A-H]?)\b/);
  return m ? { tipo: m[1], via: m[2], cruce: m[3] } : null;
}

/**
 * ¿El resultado de Google es la misma dirección que escribió el cliente?
 * Compara el número de la vía y el del cruce ("Calle 75 #58-…" ≠ "Calle 75 #67-…").
 * La placa final (el "-123") no se compara: Google la aproxima.
 * Si lo que escribió el cliente no se reconoce, no se puede validar y se acepta.
 */
export function mismaDireccion(pedida, encontrada) {
  const p = partesDireccion(pedida);
  if (!p) return true;
  const e = partesDireccion(encontrada);
  if (!e) return false;
  const tipoCompatible = p.tipo === e.tipo || p.tipo === 'AVENIDA' || e.tipo === 'AVENIDA';
  return tipoCompatible && p.via === e.via && p.cruce === e.cruce;
}

export function normalizarDireccion(texto) {
  let s = ` ${String(texto || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')} `;
  s = s
    .replace(/[°º]/g, ' ')
    .replace(/\bN\s+(?=\d)/g, '# ') // "N° 68" → "N 68"
    .replace(/\b(NO|NRO|NUM|NUMERO)\.?\s*(?=\d)/g, '# ')
    // Avenida Calle / Avenida Carrera (AC / AK)
    .replace(/\b(AV|AVE|AVDA|AVENIDA)\.?\s*(CALLE|CLL|CL)\b\.?/g, ' AVENIDA CALLE ')
    .replace(/\b(AV|AVE|AVDA|AVENIDA)\.?\s*(CARRERA|CRA|KRA|KR|CR|CRR)\b\.?/g, ' AVENIDA CARRERA ')
    .replace(/\bAC\b\.?/g, ' AVENIDA CALLE ')
    .replace(/\bAK\b\.?/g, ' AVENIDA CARRERA ')
    .replace(/\b(CLL|CL)\b\.?/g, ' CALLE ')
    .replace(/\b(CRA|KRA|KR|CR|CRR)\b\.?/g, ' CARRERA ')
    .replace(/\b(DG|DIAG)\b\.?/g, ' DIAGONAL ')
    .replace(/\b(TV|TR|TRANSV)\b\.?/g, ' TRANSVERSAL ')
    .replace(/\b(AV|AVE|AVDA)\b\.?/g, ' AVENIDA ')
        .replace(/\b(CALLE|CARRERA|DIAGONAL|TRANSVERSAL|AVENIDA)\s+\1\b/g, '$1')
    // "82 A" → "82A" (la letra va pegada al número; "6 BIS A" y "5 ESTE" no se tocan)
    .replace(/(\d)\s+([A-H])(?=\s|#|-|$)/g, '$1$2')
    .replace(/\s*#\s*(#\s*)*/g, ' #')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}
