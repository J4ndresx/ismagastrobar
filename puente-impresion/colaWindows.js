// Vigilancia de la cola de impresión de Windows (modo "windows").
//
// `copy /b` a \\localhost\POS80 solo deja la comanda en la cola de Windows:
// si la impresora no tiene papel, tiene la tapa abierta, está apagada o
// Windows la marcó "sin conexión", la comanda se queda ahí y nadie se entera.
// Aquí se revisa la cola después de enviar: si la comanda no sale, se marca
// como ERROR en el POS (con el motivo) y se saca de la cola para que no salga
// doble cuando se arregle la impresora (la vendedora usa "Reimprimir").
import { execFile } from 'node:child_process';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function powershell(script, timeout = 12000) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, timeout }, (err, out, errOut) =>
      err ? reject(new Error((errOut || err.message || '').trim().split('\n')[0])) : resolve(out),
    );
  });
}

const comillas = (s) => String(s).replace(/'/g, "''");

/** Estado de la impresora y su cola, leído de Windows. */
export async function leerEstado(compartida) {
  const n = comillas(compartida);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$p = Get-Printer | Where-Object { $_.ShareName -eq '${n}' -or $_.Name -eq '${n}' } | Select-Object -First 1`,
    "if (-not $p) { '{\"existe\":false}'; exit }",
    '$j = @(Get-PrintJob -PrinterName $p.Name -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ id = $_.Id; estado = [string]$_.JobStatus; segundos = [int]((Get-Date) - $_.SubmittedTime).TotalSeconds } })',
    '[pscustomobject]@{ existe = $true; nombre = $p.Name; estado = [string]$p.PrinterStatus; sinConexion = [bool]$p.WorkOffline; trabajos = $j } | ConvertTo-Json -Depth 3 -Compress',
  ].join('; ');
  const r = JSON.parse((await powershell(script)).trim());
  r.trabajos = r.trabajos ? (Array.isArray(r.trabajos) ? r.trabajos : [r.trabajos]) : [];
  return r;
}

/** Saca de la cola de Windows todo lo pendiente de esa impresora. */
export async function vaciarCola(nombreImpresora) {
  await powershell(`Get-PrintJob -PrinterName '${comillas(nombreImpresora)}' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue`);
}

// Trabajos que ya terminaron (si Windows está configurado para "conservar documentos impresos").
const terminado = (t) => /Printed|Complete|Deleted/i.test(t.estado || '');
export const pendientes = (estado) => (estado?.trabajos || []).filter((t) => !terminado(t));

/**
 * Traduce el estado de Windows a algo que la vendedora entienda.
 * @returns {{ estado: 'lista'|'no_encontrada'|'sin_conexion'|'sin_papel'|'tapa_abierta'|'apagada'|'pausada'|'error'|'atascada', texto: string }}
 */
export function diagnosticar(e, { segundosAtasco = 20 } = {}) {
  if (!e?.existe) return { estado: 'no_encontrada', texto: 'Windows no encuentra la impresora POS80' };
  if (e.sinConexion) return { estado: 'sin_conexion', texto: 'Windows tiene la impresora "sin conexión"' };
  const todo = [e.estado, ...pendientes(e).map((t) => t.estado)].join(' ');
  if (/PaperOut|PaperJam|PaperProblem/i.test(todo)) return { estado: 'sin_papel', texto: 'Impresora sin papel o papel atascado' };
  if (/DoorOpen/i.test(todo)) return { estado: 'tapa_abierta', texto: 'Impresora con la tapa abierta' };
  if (/Offline|NotAvailable/i.test(todo)) return { estado: 'apagada', texto: 'Impresora apagada o desconectada' };
  if (/Paused/i.test(todo)) return { estado: 'pausada', texto: 'Impresora en pausa en Windows' };
  if (/Error|Blocked|UserIntervention/i.test(todo)) return { estado: 'error', texto: 'La impresora reporta un error: revisa papel, tapa y cable' };
  if (pendientes(e).some((t) => t.segundos > segundosAtasco)) return { estado: 'atascada', texto: 'Hay comandas atascadas en Windows' };
  return { estado: 'lista', texto: 'Lista' };
}

/**
 * Espera a que la comanda recién enviada salga de la cola de Windows.
 * @returns {{ ok: true } | { ok: false, motivo: string, impresora: string }}
 */
export async function verificarSalida(compartida, { maxMs = 20000, cadaMs = 1500, leer = leerEstado } = {}) {
  const inicio = Date.now();
  await esperar(700);
  for (;;) {
    const e = await leer(compartida);
    if (!pendientes(e).length) return { ok: true };
    const d = diagnosticar(e, { segundosAtasco: Infinity });
    if (d.estado !== 'lista') return { ok: false, motivo: d.texto, impresora: e.nombre };
    if (Date.now() - inicio > maxMs) {
      return { ok: false, motivo: `La comanda no salió de la impresora en ${Math.round(maxMs / 1000)} s: revisa papel, tapa y cable`, impresora: e.nombre };
    }
    await esperar(cadaMs);
  }
}
