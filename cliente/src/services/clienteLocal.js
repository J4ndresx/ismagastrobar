// Datos del cliente recordados EN SU PROPIO CELULAR (localStorage).
//
// En Pizzeroo's la app buscaba pedidos anteriores por teléfono directo en
// Firestore; eso permite que cualquiera vea nombre y direcciones de otra
// persona escribiendo su número. Aquí los datos solo se guardan en el
// dispositivo del cliente: la próxima vez que pida desde el mismo celular,
// se autocompletan. Misma API que antes para no tocar CompletarDatosCliente.
import { funcionalesPermitidas } from './preferenciasCookies';

const CLAVE = 'isma.cliente';

function leer() {
  if (!funcionalesPermitidas()) return null;
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || null;
  } catch {
    return null;
  }
}

/** Devuelve "pedidos" anteriores (nombre + direcciones) guardados en este dispositivo. */
export async function buscarPedidosPorTelefono(telefono) {
  const guardado = leer();
  if (!guardado || guardado.telefono !== telefono) return [];
  return (guardado.direcciones.length ? guardado.direcciones : [null]).map((address) => ({
    customer: { names: guardado.nombres, lastNames: guardado.apellidos, phone: telefono },
    address,
  }));
}

/** Guarda nombre y dirección después de un pedido exitoso. */
export function recordarCliente({ customer, address }) {
  if (!funcionalesPermitidas()) return; // el cliente eligió "Solo necesarias"
  try {
    const previo = leer();
    const mismas = previo && previo.telefono === customer.phone ? previo.direcciones : [];
    const direcciones = address && typeof address === 'object'
      ? [address, ...mismas.filter((d) => JSON.stringify(d) !== JSON.stringify(address))].slice(0, 3)
      : mismas;
    localStorage.setItem(CLAVE, JSON.stringify({
      telefono: customer.phone, nombres: customer.names, apellidos: customer.lastNames, direcciones,
    }));
  } catch {
    /* sin almacenamiento disponible: no pasa nada */
  }
}
