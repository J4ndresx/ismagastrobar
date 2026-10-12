// Copia ../shared a functions/shared y puente-impresion/shared.
// Cloud Functions y el puente solo empaquetan su propia carpeta.
import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const destino of ['functions/shared', 'puente-impresion/shared']) {
  mkdirSync(join(raiz, destino), { recursive: true });
  for (const f of ['menu.seed.js', 'menuDelDia.js', 'comandas.js', 'domicilio.js', 'version.js', 'seguimiento.js']) cpSync(join(raiz, 'shared', f), join(raiz, destino, f));
  console.log('shared →', destino);
}
