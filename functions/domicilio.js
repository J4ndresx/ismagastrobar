// Cotización de domicilio: ubica la dirección con Google y calcula el valor
// con las reglas de shared/domicilio.js (distancia en línea recta desde la tienda).
//
// Recibe el geocodificador y la caché por parámetro para poder probarla sin
// Google ni Firestore.
import { createHash } from 'node:crypto';
import { DOMICILIO, distanciaKm, calcularDomicilio, normalizarDireccion, mismaDireccion } from './shared/domicilio.js';

// Solo se confía en resultados que apuntan a una dirección concreta. Si Google
// solo encuentra el barrio o la calle, el valor queda "por confirmar" en vez
// de cobrar algo equivocado.
const PRECISOS = new Set(['ROOFTOP', 'RANGE_INTERPOLATED']);
const TIPOS_PRECISOS = ['street_address', 'premise', 'subpremise', 'establishment', 'point_of_interest'];
const KM_MAX_RAZONABLE = 40; // más lejos: Google encontró otra ciudad
// Municipios aceptados (shared/domicilio.js → municipiosGoogle). "Bogotá D.C." también cuenta como Bogotá.
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[,\s]*d\.?\s*c\.?$/, '').trim();
const MUNICIPIOS = new Set((DOMICILIO.municipiosGoogle || [DOMICILIO.ciudad]).map(sinTildes));

const limpiar = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

export function claveCache(direccion, barrio) {
  const norm = `${direccion}|${barrio}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#|-]+/g, ' ').trim();
  return createHash('sha256').update(norm).digest('hex').slice(0, 32);
}

function elegirResultado(respuesta, direccion) {
  if (respuesta?.status !== 'OK') return null;
  return (respuesta.results || []).find((r) => {
    const enCobertura = (r.address_components || []).some((c) => MUNICIPIOS.has(sinTildes(c.long_name)) && (c.types || []).some((t) => t === 'locality' || t.startsWith('administrative_area')));
    const preciso = PRECISOS.has(r.geometry?.location_type) || (r.types || []).some((t) => TIPOS_PRECISOS.includes(t));
    // Google a veces devuelve OTRA dirección cercana (pediste #58-123 y responde #67-58): esa no sirve.
    return enCobertura && preciso && !r.partial_match && mismaDireccion(direccion, r.formatted_address);
  }) || null;
}

/**
 * @param {{direccion: string, barrio?: string}} datos
 * @param {{geocodificar: (texto: string) => Promise<object>, cache?: {get, set}}} deps
 * @returns estado: 'ok' | 'fuera' | 'no_encontrada'
 */
export async function cotizarDomicilio(datos, { geocodificar, cache }) {
  const direccion = normalizarDireccion(limpiar(datos?.direccion, 120)); // "Ave calle 6 N° 68 - 45" → "AVENIDA CALLE 6 #68-45"
  const barrio = limpiar(datos?.barrio, 60);
  if (direccion.length < 5 || !/\d/.test(direccion)) return { estado: 'no_encontrada', motivo: 'direccion_incompleta' };

  const clave = claveCache(direccion, barrio);
  const guardado = await cache?.get(clave);
  // La caché guarda DÓNDE queda la dirección (km); la tarifa se calcula siempre con
  // los valores actuales de shared/domicilio.js, por si cambian los precios.
  // Una ubicación guardada antes de validar la nomenclatura puede ser de otra cuadra: esa se descarta.
  const cacheValida = guardado && guardado.estado !== 'no_encontrada' && typeof guardado.km === 'number'
    && (!guardado.direccion_encontrada || mismaDireccion(direccion, guardado.direccion_encontrada));
  if (cacheValida) return conTarifa(guardado.km, guardado); // fallos viejos se reintentan

  // En Bogotá la nomenclatura (Calle 42 #15-34) ya ubica la casa sin el barrio, y un barrio
  // mal escrito o que Google conoce con otro nombre ("Ciudad Techo II") puede dañar la
  // búsqueda. Por eso primero se busca SIN barrio y solo si no aparece se intenta con él.
  const intentos = [[direccion, DOMICILIO.ciudad, 'Colombia'], ...(barrio ? [[direccion, barrio, DOMICILIO.ciudad, 'Colombia']] : [])];
  let r = null;
  for (const partes of intentos) {
    r = elegirResultado(await geocodificar(partes.join(', ')), direccion);
    if (r && distanciaKm(DOMICILIO.origen, r.geometry.location) <= KM_MAX_RAZONABLE) break;
    r = null;
  }
  let res;
  if (!r) {
    res = { estado: 'no_encontrada' };
  } else {
    const ubicacion = { lat: r.geometry.location.lat, lng: r.geometry.location.lng };
    // Se cobra con la distancia al metro (los tramos son de 100–600 m); km con un decimal es solo para mostrar.
    const metros = Math.round(distanciaKm(DOMICILIO.origen, ubicacion) * 1000);
    res = conTarifa(Math.round(metros / 100) / 10, { direccion_encontrada: r.formatted_address, ubicacion, metros });
  }
  // "No encontrada" no se guarda: si Google mejora o la dirección se corrige, se vuelve a intentar.
  if (res.estado !== 'no_encontrada') await cache?.set(clave, res);
  return res;
}

function conTarifa(km, { direccion_encontrada, ubicacion, metros }) {
  const m = Number.isFinite(metros) ? metros : Math.round(km * 1000); // cachés viejas solo tienen km
  const tarifa = calcularDomicilio(m);
  return tarifa != null
    ? { estado: 'ok', km, metros: m, tarifa, kmCobrados: null, direccion_encontrada, ...(ubicacion ? { ubicacion } : {}) }
    : { estado: 'fuera', km, metros: m, maxKm: DOMICILIO.maxKm, direccion_encontrada };
}

/** Geocodificador real (Google Geocoding API). */
export function geocodificadorGoogle(key) {
  return async (texto) => {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', texto);
    url.searchParams.set('region', 'co');
    url.searchParams.set('language', 'es');
    url.searchParams.set('components', 'country:CO');
    if (DOMICILIO.limitesGoogle) url.searchParams.set('bounds', DOMICILIO.limitesGoogle); // shared/domicilio.js
    url.searchParams.set('key', key);
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await resp.json();
    if (json.status === 'REQUEST_DENIED' || json.status === 'OVER_QUERY_LIMIT') throw new Error(`Google: ${json.status} ${json.error_message || ''}`);
    return json;
  };
}
