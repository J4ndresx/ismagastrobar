// Pedido en armado guardado en el navegador, para no perderlo si la página
// se recarga. Es almacenamiento NECESARIO (lo pide el propio cliente al
// agregar productos): se guarda aunque elija "Solo necesarias".
//
// Solo se guarda QUÉ eligió (producto + opciones), nunca precios: al
// recuperarlo se vuelve a armar con el menú actual, así un precio viejo
// no se cuela y un producto apagado desaparece.
import { crearLinea } from '@shared/comandas.js';

const CLAVE = 'isma.carrito';
const HORAS = 6;

export function guardarCarrito(carrito) {
  try {
    if (!carrito.length) return localStorage.removeItem(CLAVE);
    localStorage.setItem(CLAVE, JSON.stringify({
      guardado: Date.now(),
      lineas: carrito.map((l) => ({ item_id: l.item_id, sel: l.sel, cantidad: l.cantidad })),
    }));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/**
 * @param armar (item, sel) => línea lista para el carrito (con uid, nombre…)
 * @returns { lineas, perdidas } — perdidas = cuántas ya no se pudieron armar
 */
export function recuperarCarrito(menu, armar) {
  let guardado;
  try {
    guardado = JSON.parse(localStorage.getItem(CLAVE));
  } catch {
    return { lineas: [], perdidas: 0 };
  }
  if (!guardado?.lineas?.length || Date.now() - guardado.guardado > HORAS * 3600e3) {
    try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
    return { lineas: [], perdidas: 0 };
  }
  const lineas = [];
  for (const g of guardado.lineas) {
    const item = menu.items.find((i) => i.id === g.item_id);
    if (!item || !g.sel) continue;
    try {
      crearLinea(item, menu.grupos, { ...g.sel, cantidad: g.cantidad }); // valida opciones con el menú de hoy
      lineas.push(armar(item, { ...g.sel, cantidad: g.cantidad }));
    } catch {
      /* opción que ya no existe: esa línea se descarta */
    }
  }
  return { lineas, perdidas: guardado.lineas.length - lineas.length };
}
