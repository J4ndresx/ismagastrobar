// Conexión de los scripts a Firestore (firebase-admin) sin tener que configurar nada a mano.
//
// Credenciales, en este orden:
//   1. La variable GOOGLE_APPLICATION_CREDENTIALS, si ya está puesta.
//   2. El archivo clave-servicio.json en la carpeta scripts/ o en la raíz del proyecto.
// Proyecto: GCLOUD_PROJECT, o el "default" de .firebaserc (isma-gastro-bar).
// La clave NUNCA se sube a GitHub (está en .gitignore).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');

export async function conectarFirestore() {
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const clave = [join(aqui, 'clave-servicio.json'), join(raiz, 'clave-servicio.json')].find(existsSync);
    if (!clave) {
      console.error(`
✖ No encontré la clave de servicio de Firebase.
  1. Firebase Console → ⚙ Configuración del proyecto → Cuentas de servicio → "Generar nueva clave privada".
  2. Guarda el archivo descargado con el nombre  clave-servicio.json  en:
       ${aqui}
  3. Vuelve a correr este comando.
  (No la compartas ni la subas a GitHub: da acceso total a la base de datos.)`);
      process.exit(1);
    }
    process.env.GOOGLE_APPLICATION_CREDENTIALS = clave;
  }

  let projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    try { projectId = JSON.parse(readFileSync(join(raiz, '.firebaserc'), 'utf8')).projects?.default; } catch { /* sin .firebaserc */ }
  }

  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp(projectId ? { projectId } : undefined);
  console.log(`(Firestore: proyecto ${projectId || '¿?'}${process.env.FIRESTORE_EMULATOR_HOST ? ' · EMULADOR' : ''})`);
  return getFirestore();
}
