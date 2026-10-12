// Pruebas del registro del puente (archivo diario, cortes y pausas).
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearLog, crearCortes, vigilarPausas, diaBogota } from '../registro.js';

// Archivo por día; borra los de más de 14 días.
const dir = mkdtempSync(join(tmpdir(), 'reg-'));
writeFileSync(join(dir, 'puente-2020-01-01.log'), 'viejo');
const log = crearLog(dir, { consola: () => {} });
log('hola', 'mundo');
const archivos = readdirSync(dir);
assert.deepEqual(archivos, [`puente-${diaBogota()}.log`]);
assert.match(readFileSync(join(dir, archivos[0]), 'utf8'), /\| hola mundo\r\n$/);
console.log('✔ registro en archivo por día y limpieza de los viejos');

// Cortes del día.
const c = crearCortes();
const t = Date.now();
c.agregar('pausa', t - 5 * 60_000, t);
c.agregar('internet', t - 30_000, t);
const { lista } = c.hoy();
assert.equal(lista.length, 2);
assert.equal(lista[0].minutos, 5);
assert.equal(lista[1].minutos, 1); // mínimo 1 min
console.log('✔ cortes del día con su duración');

// Pausas: si el reloj se salta más de 60 s, avisa.
let ahora = 0; const pausas = [];
const tic = vigilarPausas((d, h) => pausas.push(h - d), { ahora: () => ahora, programar: () => {} });
ahora = 10_000; tic(); ahora = 20_000; tic();
assert.equal(pausas.length, 0);
ahora = 200_000; tic();
assert.deepEqual(pausas, [180_000]);
console.log('✔ detecta cuando el puente estuvo detenido (suspensión o ventana pausada)');
