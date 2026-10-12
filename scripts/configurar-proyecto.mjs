// Conecta este código con un proyecto de Firebase en un solo paso.
//
//   node scripts/configurar-proyecto.mjs config-web.txt
//   node scripts/configurar-proyecto.mjs config-web.txt --sitio-cliente=panzzerotty --sitio-pos=panzzerotty-pos
//
// config-web.txt = el bloque `const firebaseConfig = { ... }` copiado tal cual de
// Consola de Firebase → Configuración del proyecto → Tus apps → App web.
//
// Escribe:
//   .firebaserc                     id del proyecto + sitios de hosting (cliente y pos)
//   cliente/.env.local              config web para la app del cliente
//   web/.env.local                  config web para el POS
//   puente-impresion/config.json    config web para el PC del mostrador (conserva la clave si ya existía)
// No toca nada en la nube. Se puede correr otra vez sin problema.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RID } from '../shared/menu.seed.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--'));
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]?.trim();

if (!archivo || !existsSync(archivo)) {
  console.error('Uso: node scripts/configurar-proyecto.mjs <config-web.txt> [--sitio-cliente=...] [--sitio-pos=...]');
  console.error('config-web.txt = el bloque "const firebaseConfig = { ... }" de la consola de Firebase.');
  process.exit(1);
}

// Acepta el bloque JS de la consola o un JSON.
const texto = readFileSync(archivo, 'utf8');
const leer = (clave) => texto.match(new RegExp(`["']?${clave}["']?\\s*:\\s*["']([^"']+)["']`))?.[1] || '';
const cfg = {
  apiKey: leer('apiKey'),
  authDomain: leer('authDomain'),
  projectId: leer('projectId'),
  storageBucket: leer('storageBucket'),
  messagingSenderId: leer('messagingSenderId'),
  appId: leer('appId'),
};
const faltan = ['apiKey', 'authDomain', 'projectId', 'appId'].filter((k) => !cfg[k]);
if (faltan.length) {
  console.error(`✖ No encontré en ${archivo}: ${faltan.join(', ')}. Copia el bloque completo de la consola.`);
  process.exit(1);
}

const sitioCliente = opt('sitiocliente') || 'ismagastrobar';
const sitioPos = opt('sitiopos') || 'ismagastrobar-pos';
const p = cfg.projectId;

// .firebaserc — misma estructura que Jireh: dos destinos de hosting (pos y cliente).
const firebaserc = {
  projects: { default: p },
  targets: { [p]: { hosting: { pos: [sitioPos], cliente: [sitioCliente] } } },
  etags: {},
};
writeFileSync(join(raiz, '.firebaserc'), JSON.stringify(firebaserc, null, 2) + '\n');

const env = (claves) => claves.map((k) => `VITE_FIREBASE_${k.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase()}=${cfg[k]}`).join('\n') + '\n';
writeFileSync(join(raiz, 'cliente/.env.local'), env(['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']));
writeFileSync(join(raiz, 'web/.env.local'), env(['apiKey', 'authDomain', 'projectId', 'appId']));

// Puente: parte del ejemplo y conserva la cuenta/impresora si ya había config.json.
const rutaPuente = join(raiz, 'puente-impresion/config.json');
const base = JSON.parse(readFileSync(existsSync(rutaPuente) ? rutaPuente : join(raiz, 'puente-impresion/config.ejemplo.json'), 'utf8'));
const puente = {
  ...base,
  rid: RID,
  firebase: { apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId },
  cuenta: { ...base.cuenta, email: base.cuenta?.email?.includes('@' + RID) ? base.cuenta.email : `impresora@${RID}.app` },
};
writeFileSync(rutaPuente, JSON.stringify(puente, null, 2) + '\n');

console.log(`✔ Proyecto: ${p}  ·  restaurante (rid): ${RID}`);
console.log(`✔ Hosting  cliente → ${sitioCliente}.web.app   pos → ${sitioPos}.web.app`);
console.log('✔ Escritos: .firebaserc, cliente/.env.local, web/.env.local, puente-impresion/config.json');
if (puente.cuenta.password === '…' || !puente.cuenta.password) console.log('ℹ Falta la clave de la impresora en puente-impresion/config.json (cuenta.password).');
