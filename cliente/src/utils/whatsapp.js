import { NEGOCIO } from '../config/negocio';
import { formatCOP } from '../utils/formato';

const textoDireccion = (addr) => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.conjunto, addr.unidad, addr.nomenclatura, addr.conjunto ? null : addr.sector, addr.barrio, addr.ciudad].filter(Boolean).join(', ');
};

/** Arma el texto del pedido para enviar por WhatsApp al negocio. */
export function armarMensajePedido({ id, items, subtotal, datos, enlace }) {
  const { customer, address, domicilio, metodoPago, pagoEfectivo, denominacion } = datos;
  const recoge = address === 'Recoge en punto de venta';
  const tarifaDom = !recoge && domicilio?.tipo === 'SECTOR' ? domicilio.tarifa : 0;
  const total = subtotal + tarifaDom;

  const l = [];
  l.push(`*Nuevo pedido — ${NEGOCIO.nombre}*`);
  if (id) l.push(`Pedido: ${id}`);
  l.push('');
  items.forEach((i) => l.push(`• ${i.cantidad}× ${i.descripcion} — ${formatCOP(i.total)}`));
  l.push('');
  l.push(`Subtotal: ${formatCOP(subtotal)}`);
  if (recoge) l.push('Entrega: *Recoge en el local*');
  else if (tarifaDom) l.push(`Domicilio: ${formatCOP(tarifaDom)}${domicilio.km != null ? ` (${String(domicilio.km).replace('.', ',')} km)` : domicilio.metodo === 'conjunto' ? ' (conjunto)' : ''}`);
  else l.push('Domicilio: pendiente por confirmar');
  l.push(`*Total: ${formatCOP(total)}*${!recoge && !tarifaDom ? ' + domicilio' : ''}`);
  l.push('');
  l.push(`Cliente: ${customer.names} ${customer.lastNames}`.trim());
  l.push(`Tel: ${customer.phone}`);
  if (!recoge) {
    l.push(`Dirección: ${textoDireccion(address)}`);
    if (address?.instrucciones) l.push(`Indicaciones: ${address.instrucciones}`);
  }
  if (metodoPago === 'efectivo') {
    l.push(
      pagoEfectivo === 'denominacion'
        ? `Pago: Efectivo — paga con ${formatCOP(denominacion)}`
        : 'Pago: Efectivo (exacto)'
    );
  } else if (metodoPago === 'datafono') {
    l.push('Pago: Datáfono (tarjeta al recibir)');
  } else {
    l.push('Pago: Transferencia (envío comprobante)');
  }
  if (enlace) {
    l.push('');
    l.push(`Seguimiento: ${enlace}`);
  }
  return l.join('\n');
}

export function linkWhatsApp(mensaje) {
  return `https://wa.me/${NEGOCIO.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}
