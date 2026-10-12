// Reconexión rápida con la nube.
//
// Cuando se cae el internet, Firestore reintenta solo, pero cada vez espera
// más (hasta ~1 minuto entre intentos). Así, aunque el internet vuelva, el
// puente podía tardar un minuto más en darse cuenta. Mientras no haya
// conexión, aquí se fuerza un intento nuevo cada 15 s (apagar y prender la
// red de Firestore reinicia esa espera). Apenas vuelve la conexión, se detiene.
export function crearReconector({ desactivar, activar, log = () => {}, cadaMs = 15_000, programar = setInterval, cancelar = clearInterval }) {
  let timer = null;
  let intentos = 0;
  const intentar = async () => {
    intentos++;
    try {
      await desactivar();
      await activar();
    } catch (e) {
      log('No se pudo reintentar la conexion:', e.message);
    }
  };
  return {
    /** Sin conexión: empieza a reintentar cada 15 s (si ya estaba, no hace nada). */
    iniciar() {
      if (timer) return;
      intentos = 0;
      log(`Reintentando la conexion con la nube cada ${Math.round(cadaMs / 1000)} s...`);
      timer = programar(intentar, cadaMs);
    },
    /** Volvió la conexión: deja de reintentar. */
    detener() {
      if (!timer) return 0;
      cancelar(timer);
      timer = null;
      return intentos;
    },
    /** Un intento inmediato (ej. al despertar el PC). */
    ahora: intentar,
    get activo() { return !!timer; },
  };
}
