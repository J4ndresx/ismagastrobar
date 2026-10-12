// Formas de enviar los bytes ESC/POS a la impresora.
import net from 'node:net';
import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import os from 'node:os';

/** Impresora de red: TCP puerto 9100 (RAW). */
function porRed({ host, puerto = 9100, timeoutMs = 8000 }, datos) {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host, port: puerto });
    const t = setTimeout(() => {
      s.destroy();
      reject(new Error(`Sin respuesta de la impresora ${host}:${puerto}`));
    }, timeoutMs);
    s.on('connect', () => s.end(datos));
    s.on('close', (hadError) => {
      clearTimeout(t);
      if (!hadError) resolve();
    });
    s.on('error', (e) => {
      clearTimeout(t);
      reject(new Error(`Impresora de red: ${e.message}`));
    });
  });
}

/**
 * Impresora USB en Windows, compartida (Panel de control → Impresoras →
 * Propiedades → Compartir). Se envía en modo RAW con `copy /b`, así el
 * corte y los tamaños de letra los interpreta la impresora directamente.
 */
function porWindowsCompartida({ compartida, equipo = 'localhost' }, datos) {
  return new Promise((resolve, reject) => {
    const tmp = join(os.tmpdir(), `comanda-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
    writeFileSync(tmp, datos);
    const destino = `\\\\${equipo}\\${compartida}`;
    execFile('cmd.exe', ['/c', 'copy', '/b', tmp, destino], { windowsHide: true, timeout: 15000 }, (err, stdout, stderr) => {
      try { unlinkSync(tmp); } catch {}
      if (err) return reject(new Error(`No se pudo enviar a ${destino}: ${(stderr || stdout || err.message).trim()}`));
      resolve();
    });
  });
}

/** Modo prueba: guarda el .bin y un .txt legible en ./salida. */
function porArchivo({ carpeta = 'salida' }, datos, textoPlano, nombre) {
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, `${nombre}.bin`), datos);
  if (textoPlano) writeFileSync(join(carpeta, `${nombre}.txt`), textoPlano);
  return Promise.resolve();
}

export function enviar(cfgImpresora, datos, { textoPlano, nombre }) {
  switch (cfgImpresora.modo) {
    case 'red':
      return porRed(cfgImpresora, datos);
    case 'windows':
      return porWindowsCompartida(cfgImpresora, datos);
    case 'archivo':
      return porArchivo(cfgImpresora, datos, textoPlano, nombre);
    default:
      return Promise.reject(new Error(`Modo de impresora desconocido: ${cfgImpresora.modo}`));
  }
}
