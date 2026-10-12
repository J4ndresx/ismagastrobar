// Preferencia de cookies / almacenamiento del cliente.
//
// La app NO usa cookies de publicidad ni de seguimiento (no hay Google
// Analytics, píxeles ni similares). Lo único que guarda en el navegador es:
//  - necesario: esta misma preferencia.
//  - funcional (opcional): nombre, celular y direcciones para autocompletar
//    el próximo pedido (services/clienteLocal.js).
// Si el cliente elige "Solo necesarias", no se guarda lo funcional y se
// borra lo que hubiera.
export const COOKIES_VERSION = '2026-10-02';
const CLAVE = 'isma.cookies';
const oyentes = new Set();

export function leerPreferencia() {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE));
    return p?.version === COOKIES_VERSION ? p.eleccion : null; // 'todas' | 'necesarias' | null
  } catch {
    return null;
  }
}

export const funcionalesPermitidas = () => leerPreferencia() === 'todas';

export function guardarPreferencia(eleccion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ eleccion, version: COOKIES_VERSION, fecha: new Date().toISOString() }));
    if (eleccion !== 'todas') localStorage.removeItem('isma.cliente');
  } catch {
    /* navegador sin almacenamiento: se vuelve a preguntar la próxima vez */
  }
  oyentes.forEach((fn) => fn(eleccion));
}

export function alCambiar(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
