// Domicilio en el POS: mismas reglas que la app del cliente (shared/domicilio.js).
//  - Conjunto de la lista (o Barrio María Paz) → tarifa fija.
//  - Otra dirección → la Cloud Function la ubica con Google y cobra por distancia.
// Esta carpeta faltaba en la plantilla-firebase.rar; se reconstruyó desde la versión anterior
// y se agregó normalizarDireccion, que ahora usa App.jsx.
import { DOMICILIO, conjuntoPorId, normalizarDireccion } from '@shared/domicilio.js';

export { DOMICILIO, conjuntoPorId, normalizarDireccion };

/** ¿Hay suficiente dirección para consultar? (necesita el número después del #) */
export const direccionCompleta = (d) => /#\s*\d/.test(d || '');

/**
 * @returns null (faltan datos) | { tipo: 'SECTOR', tarifa, metodo, km? } | { tipo: 'FUERA', km, maxKm } | { tipo: 'PENDIENTE_INFORMAR' }
 */
export async function calcularDomicilio({ zona, direccion, barrio }, cotizar) {
  const conjunto = zona && zona !== 'otra' ? conjuntoPorId(zona) : null;
  if (conjunto) return { tipo: 'SECTOR', metodo: 'conjunto', tarifa: DOMICILIO.tarifaConjunto, sector: conjunto.nombre };
  if (zona !== 'otra' || !direccionCompleta(direccion)) return null;
  const r = await cotizar({ direccion: direccion.trim().toUpperCase(), barrio: (barrio || '').trim() });
  if (r?.estado === 'ok') return { tipo: 'SECTOR', metodo: 'distancia', tarifa: r.tarifa, km: r.km, kmCobrados: r.kmCobrados ?? null, direccion_encontrada: r.direccion_encontrada || null };
  if (r?.estado === 'fuera') return { tipo: 'FUERA', km: r.km, maxKm: r.maxKm ?? DOMICILIO.maxKm };
  return { tipo: 'PENDIENTE_INFORMAR' };
}

/** Valor final: el que escribió la vendedora (si escribió algo) o el calculado. */
export function valorDomicilio(datos, calculado) {
  if (datos.tipo_entrega !== 'domicilio') return { valor: 0, domicilio: null };
  const manual = String(datos.domicilio_manual ?? '').trim();
  if (manual !== '' && !Number.isNaN(Number(manual))) {
    const tarifa = Math.max(0, Math.round(Number(manual)));
    return { valor: tarifa, domicilio: { tipo: 'SECTOR', metodo: 'manual', tarifa, calculado: calculado?.tipo === 'SECTOR' ? calculado.tarifa : null } };
  }
  if (calculado?.tipo === 'SECTOR') return { valor: calculado.tarifa, domicilio: calculado };
  return { valor: 0, domicilio: calculado ? { ...calculado, tipo: calculado.tipo === 'FUERA' ? 'PENDIENTE_INFORMAR' : calculado.tipo, ...(calculado.tipo === 'FUERA' ? { fuera: true } : {}) } : { tipo: 'PENDIENTE_INFORMAR' } };
}

/** Texto de la dirección para el pedido, la cuenta y el domiciliario. */
export function textoDireccion(datos) {
  const conjunto = datos.zona && datos.zona !== 'otra' ? conjuntoPorId(datos.zona) : null;
  return [conjunto?.nombre, datos.unidad?.trim(), datos.direccion?.trim().toUpperCase(), datos.barrio?.trim(), DOMICILIO.ciudad].filter(Boolean).join(', ');
}
