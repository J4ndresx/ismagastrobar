// Seguimiento del pedido para el cliente (app).
//
// El cliente no tiene cuenta, así que no puede leer `pedidos`. Al crear el
// pedido la app genera un código secreto largo (`seguimiento_token`) y la
// Cloud Function mantiene una copia PÚBLICA y RECORTADA en
// `seguimiento/{token}`: número, etapa, horas, productos y total. Sin
// teléfono ni dirección, porque el enlace se puede reenviar. Quien no tenga
// el código no puede encontrar el documento (no se pueden listar).

// Tiempo estimado que ve el cliente (minutos), según la demanda del día.
//  - alta: viernes, sábado, domingo y festivos (más pedidos).
//  - normal: lunes a jueves.
export const TIEMPO_ESTIMADO = {
  alta: { domicilio: [40, 55], llevar: [20, 20] },
  normal: { domicilio: [30, 45], llevar: [15, 15] }, // ⚠️ entre semana: confirmar con el restaurante
};

// Festivos de Colombia (Ley 18 de 1983 / "Ley Emiliani").
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, mes - 1, dia);
}
const DIA = 86_400_000;
const alLunes = (t) => { const w = new Date(t).getUTCDay(); return w === 1 ? t : t + ((8 - w) % 7) * DIA; };
const cacheFestivos = {};
export function festivosColombia(y) {
  if (cacheFestivos[y]) return cacheFestivos[y];
  const f = (m, d) => Date.UTC(y, m - 1, d);
  const p = pascua(y);
  const lista = [
    f(1, 1), f(5, 1), f(7, 20), f(8, 7), f(12, 8), f(12, 25), // fijos
    ...[f(1, 6), f(3, 19), f(6, 29), f(8, 15), f(10, 12), f(11, 1), f(11, 11)].map(alLunes), // se pasan al lunes
    p - 3 * DIA, p - 2 * DIA, // Jueves y Viernes Santo
    alLunes(p + 39 * DIA), alLunes(p + 60 * DIA), alLunes(p + 68 * DIA), // Ascensión, Corpus Christi, Sagrado Corazón
  ];
  return (cacheFestivos[y] = new Set(lista.map((t) => new Date(t).toISOString().slice(0, 10))));
}

/** ¿Día de alta demanda? (viernes a domingo o festivo, hora de Bogotá) */
export function esDiaAlto(iso) {
  const b = new Date(new Date(iso).getTime() - 5 * 3600_000); // Bogotá = UTC-5, sin horario de verano
  const dia = b.getUTCDay();
  return dia === 5 || dia === 6 || dia === 0 || festivosColombia(b.getUTCFullYear()).has(b.toISOString().slice(0, 10));
}

/** [min, max] en minutos para un pedido hecho en esa fecha. */
export const tiempoEstimado = (tipoEntrega, iso) => TIEMPO_ESTIMADO[esDiaAlto(iso) ? 'alta' : 'normal'][tipoEntrega === 'domicilio' ? 'domicilio' : 'llevar'];

/** Etapas visibles para el cliente, según cómo recibe el pedido. */
export function etapasPara(tipoEntrega) {
  return tipoEntrega === 'domicilio'
    ? [
        { id: 'recibido', titulo: 'Recibido', detalle: 'El restaurante está revisando tu pedido' },
        { id: 'preparando', titulo: 'En preparación', detalle: 'Tu pedido ya está en la cocina' },
        { id: 'en_camino', titulo: 'En camino', detalle: 'El domiciliario va hacia tu dirección' },
        { id: 'entregado', titulo: 'Entregado', detalle: '¡Buen provecho!' },
      ]
    : [
        { id: 'recibido', titulo: 'Recibido', detalle: 'El restaurante está revisando tu pedido' },
        { id: 'preparando', titulo: 'En preparación', detalle: 'Tu pedido ya está en la cocina' },
        { id: 'listo', titulo: 'Listo para recoger', detalle: 'Ya puedes pasar por él al local' },
        { id: 'entregado', titulo: 'Entregado', detalle: '¡Buen provecho!' },
      ];
}

/** Etapas que el personal marca a mano desde el POS (en orden). */
export const ETAPAS_MANUALES = ['listo', 'en_camino', 'entregado'];

/** Etapa actual del pedido vista por el cliente. */
export function etapaActual(p) {
  if (p.estado === 'rechazado') return 'rechazado';
  if (p.estado === 'por_aprobar') return 'recibido';
  if (p.etapa && ETAPAS_MANUALES.includes(p.etapa)) return p.etapa;
  return 'preparando';
}

const aISO = (t) => (t?.toDate ? t.toDate().toISOString() : t instanceof Date ? t.toISOString() : typeof t === 'string' ? t : null);

/** Copia pública que lee la app del cliente (sin datos personales). */
export function vistaSeguimiento(p) {
  const etapa = etapaActual(p);
  return {
    numero: p.numero || null,
    tipo_entrega: p.tipo_entrega === 'domicilio' ? 'domicilio' : 'llevar',
    etapa,
    horas: {
      recibido: aISO(p.creado_en),
      preparando: aISO(p.aprobado_en) || (p.estado === 'confirmado' ? aISO(p.creado_en) : null),
      listo: aISO(p.etapas?.listo),
      en_camino: aISO(p.etapas?.en_camino),
      entregado: aISO(p.etapas?.entregado),
    },
    motivo_rechazo: etapa === 'rechazado' ? p.motivo_rechazo || '' : '',
    items: (p.items || []).map((l) => ({ cantidad: l.cantidad, nombre: l.nombre_pantalla || l.nombre || '' })),
    total: p.total || 0,
    domicilio_por_confirmar: p.tipo_entrega === 'domicilio' && p.domicilio?.tipo !== 'SECTOR' && !p.domicilio_valor,
    // Valor que puso caja al aceptar (la app no lo pudo calcular): se paga al recibir.
    domicilio_valor: p.domicilio_valor || 0,
    domicilio_al_recibir: !!p.domicilio_confirmado,
    pago: p.pago?.metodo || '',
    paga_con: p.pago?.metodo === 'efectivo' && p.pago?.efectivo === 'denominacion' ? Number(p.pago.denominacion) || null : null,
  };
}

/** Código secreto del enlace de seguimiento (22 caracteres ≈ 130 bits). */
export function generarToken() {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(22));
  return Array.from(bytes, (b) => abc[b % 62]).join('');
}

export const tokenValido = (t) => typeof t === 'string' && /^[A-Za-z0-9]{22}$/.test(t);
