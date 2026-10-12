// Registro del puente: todo lo que se ve en la ventana negra también queda en
// un archivo por día (carpeta registro), y los "cortes" se
// cuentan para verlos desde el POS sin entrar por AnyDesk.
//
// Tipos de corte:
//  - 'pausa':     el puente dejó de correr un rato (PC suspendido o hibernando,
//                 o alguien hizo clic dentro de la ventana negra y la pausó).
//  - 'internet':  el PC no pudo hablar con la nube (Wi-Fi o internet caído).
//  - 'impresora': Windows reportó la impresora sin papel, apagada, sin conexión…
import { appendFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const BOGOTA = -5 * 3600_000;
export const diaBogota = (ms = Date.now()) => new Date(ms + BOGOTA).toISOString().slice(0, 10);
export const horaBogota = (ms = Date.now()) => new Date(ms + BOGOTA).toISOString().slice(11, 16);

/** Escribe cada línea también en registro/puente-AAAA-MM-DD.log y borra los de más de 14 días. */
export function crearLog(carpeta, { dias = 14, consola = console.log } = {}) {
  try {
    mkdirSync(carpeta, { recursive: true });
    const limite = diaBogota(Date.now() - dias * 86_400_000);
    for (const f of readdirSync(carpeta)) {
      const d = f.match(/^puente-(\d{4}-\d{2}-\d{2})\.log$/)?.[1];
      if (d && d < limite) unlinkSync(join(carpeta, f));
    }
  } catch { /* sin permiso de escritura: solo consola */ }
  return (...a) => {
    const linea = [new Date().toLocaleString('es-CO'), '|', ...a].join(' ');
    consola(linea);
    try { appendFileSync(join(carpeta, `puente-${diaBogota()}.log`), linea + '\r\n'); } catch { /* disco lleno, etc. */ }
  };
}

/** Lleva la cuenta de los cortes del día (se reinicia a medianoche, hora Bogotá). */
export function crearCortes(max = 30) {
  let dia = diaBogota();
  let lista = [];
  return {
    agregar(tipo, desdeMs, hastaMs, detalle = '') {
      if (diaBogota(hastaMs) !== dia) { dia = diaBogota(hastaMs); lista = []; }
      lista.push({ tipo, hora: horaBogota(desdeMs), minutos: Math.max(1, Math.round((hastaMs - desdeMs) / 60_000)), detalle });
      if (lista.length > max) lista = lista.slice(-max);
    },
    hoy() {
      if (diaBogota() !== dia) { dia = diaBogota(); lista = []; }
      return { dia, lista: [...lista] };
    },
  };
}

/**
 * Detecta pausas: un reloj que debería avisar cada `cadaMs`. Si entre dos
 * avisos pasa mucho más tiempo, el proceso estuvo detenido (suspensión o
 * ventana pausada) y se llama a `onPausa(desde, hasta)`.
 */
export function vigilarPausas(onPausa, { cadaMs = 10_000, umbralMs = 60_000, ahora = Date.now, programar = setInterval } = {}) {
  let ultimo = ahora();
  const tic = () => {
    const t = ahora();
    if (t - ultimo > umbralMs) onPausa(ultimo, t);
    ultimo = t;
  };
  programar(tic, cadaMs);
  return tic; // para pruebas
}
