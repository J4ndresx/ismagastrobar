// Horario de la app del cliente (pedidos en línea).
//
// La app se abre y se cierra sola con el HORARIO. Además, caja o admin pueden
// abrirla o cerrarla a mano desde el POS ("Pedidos App"); ese cambio dura
// hasta la siguiente hora del horario, para que nunca quede olvidado:
//   - "Cerrar ahora" (estando abierta): cerrada hasta la próxima apertura
//     (mañana a las 11:00 a. m.).
//   - "Abrir ahora" (estando cerrada): abierta hasta la próxima hora del
//     horario, máximo 2 horas (ej. abrir 10:30 → sigue sola desde las 11:00;
//     abrir 11:55 p. m. → se cierra sola a la 1:55 a. m.).
// Con la app cerrada el cliente puede ver el menú, pero no enviar pedidos.
// Las reglas de Firestore hacen la misma cuenta, así que no se puede saltar.
//
// ⚠️ Si cambias el horario, cámbialo también en firestore.rules (tiendaAbierta).

export const HORARIO = {
  abre: 11 * 60, //  11:00 a. m. (minutos desde la medianoche, hora de Bogotá)
  cierra: 23 * 60 + 50, // 11:50 p. m.
};
export const MAX_ABRIR_A_MANO_MIN = 120;

const MIN = 60_000;
const DIA = 1440 * MIN;
const BOGOTA = -5 * 60 * MIN; // UTC-5, sin horario de verano

/** Minuto del día en Bogotá (0–1439). */
export const minutoBogota = (ms) => Math.floor((((ms + BOGOTA) % DIA) + DIA) % DIA / MIN);

/** ¿Abierta según el horario? */
export const abiertaPorHorario = (ms, h = HORARIO) => {
  const m = minutoBogota(ms);
  return m >= h.abre && m < h.cierra;
};

/** Próximo momento (ms) en que el reloj de Bogotá marca `minuto`. */
function proximo(ms, minuto) {
  const m = minutoBogota(ms);
  const inicioMinuto = ms - (ms % MIN);
  const faltan = (minuto - m + 1440) % 1440 || 1440;
  return inicioMinuto + faltan * MIN;
}

const aMs = (t) => (t == null ? null : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : new Date(t).getTime());

/**
 * Estado actual de la app.
 * @param config  doc `config/tienda`: { manual: { estado: 'abierta'|'cerrada', hasta, por_nombre } | null }
 * @returns { abierta, manual: bool, hasta (ms del próximo cambio), por_nombre }
 */
export function estadoTienda(config, ms = Date.now(), h = HORARIO) {
  const man = config?.manual;
  const hastaMan = aMs(man?.hasta);
  if (man && hastaMan && ms < hastaMan) {
    const abierta = man.estado === 'abierta';
    // Si al terminar lo manual el horario sigue igual (abrir 10:30 → el horario abre a las 11:00),
    // el próximo cambio real es el del horario.
    const hasta = abiertaPorHorario(hastaMan, h) === abierta ? proximo(hastaMan, abierta ? h.cierra : h.abre) : hastaMan;
    return { abierta, manual: true, hasta, por_nombre: man.por_nombre || '' };
  }
  const abierta = abiertaPorHorario(ms, h);
  return { abierta, manual: false, hasta: proximo(ms, abierta ? h.cierra : h.abre), por_nombre: '' };
}

/**
 * Qué guardar al tocar el botón del POS.
 * Devuelve `null` (volver al horario) o { estado, hasta (ms) }.
 */
export function cambioManual(config, ms = Date.now(), h = HORARIO) {
  const actual = estadoTienda(config, ms, h);
  const porHorario = abiertaPorHorario(ms, h);
  // Si el horario ya dice lo contrario de lo que está ahora, basta con volver al horario.
  if (actual.manual && porHorario !== actual.abierta) return null;
  if (actual.abierta) {
    // Cerrar: hasta la próxima apertura después del próximo cierre (mañana 11:00).
    return { estado: 'cerrada', hasta: proximo(proximo(ms, h.cierra), h.abre) };
  }
  // Abrir: hasta la próxima hora del horario, máximo 2 horas.
  const siguiente = Math.min(proximo(ms, h.abre), proximo(ms, h.cierra));
  return { estado: 'abierta', hasta: Math.min(siguiente, ms + MAX_ABRIR_A_MANO_MIN * MIN) };
}

/** "11:00 a. m." */
export function horaTexto(ms) {
  const m = minutoBogota(ms);
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** "hoy a las 11:00 a. m." / "mañana a las 11:00 a. m." */
export function cuandoTexto(ms, ahora = Date.now()) {
  const dia = (x) => Math.floor((x + BOGOTA) / DIA);
  const d = dia(ms) - dia(ahora);
  return `${d <= 0 ? 'hoy' : d === 1 ? 'mañana' : 'el ' + new Date(ms + BOGOTA).toISOString().slice(0, 10)} a las ${horaTexto(ms)}`;
}
