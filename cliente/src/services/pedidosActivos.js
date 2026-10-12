// Pedidos recientes de este dispositivo (solo el código de seguimiento), para
// mostrar "Tu pedido va en camino" al volver a abrir la app. Es parte del
// servicio que el cliente pidió: se guarda aunque elija "Solo necesarias".
const CLAVE = 'isma.seguimiento';
const HORAS = 12;

export function leerActivos() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE)) || [];
    return lista.filter((p) => Date.now() - p.creado < HORAS * 3600e3);
  } catch {
    return [];
  }
}

export function guardarActivo(token) {
  try {
    const lista = [{ token, creado: Date.now() }, ...leerActivos().filter((p) => p.token !== token)].slice(0, 5);
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* sin almacenamiento */
  }
}

export function quitarActivo(token) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(leerActivos().filter((p) => p.token !== token)));
  } catch {
    /* nada */
  }
}

export const enlaceSeguimiento = (token) => `${window.location.origin}${window.location.pathname}?pedido=${token}`;
