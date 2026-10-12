// Valor del domicilio (reglas en shared/domicilio.js):
//  - Conjuntos de la lista → tarifa fija.
//  - Otra dirección → la Cloud Function la ubica con Google y calcula por distancia.
// Resultado (mismo formato que usaba Pizzeroo's para no tocar el resto):
//   { tipo: 'SECTOR', tarifa, metodo: 'conjunto' | 'distancia', km?, ... }  valor conocido
//   { tipo: 'FUERA', km, maxKm }                                             fuera de cobertura
//   { tipo: 'PENDIENTE_INFORMAR' }                                            no se pudo ubicar
import { DOMICILIO, conjuntoPorId } from '@shared/domicilio.js';
import { cotizarDomicilio } from './backend';

export { DOMICILIO };

export async function calcularDomicilio(addr) {
  if (!addr || typeof addr !== 'object') return { tipo: 'PENDIENTE_INFORMAR' };
  const conjunto = addr.conjuntoId && conjuntoPorId(addr.conjuntoId);
  if (conjunto) return { tipo: 'SECTOR', metodo: 'conjunto', tarifa: DOMICILIO.tarifaConjunto, sector: conjunto.nombre };
  if (!addr.nomenclatura) return { tipo: 'PENDIENTE_INFORMAR' };
  const r = await cotizarDomicilio({ direccion: addr.nomenclatura, barrio: addr.barrio || '' });
  if (r?.estado === 'ok') return { tipo: 'SECTOR', metodo: 'distancia', tarifa: r.tarifa, km: r.km, kmCobrados: r.kmCobrados, direccion_encontrada: r.direccion_encontrada, ubicacion: r.ubicacion };
  if (r?.estado === 'fuera') return { tipo: 'FUERA', km: r.km, maxKm: r.maxKm ?? DOMICILIO.maxKm };
  return { tipo: 'PENDIENTE_INFORMAR' };
}

export async function registrarFalloDomicilio(motivo, datos) {
  console.warn('Fallo de domicilio', motivo, datos);
}
