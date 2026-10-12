// Carga SOLO la sección "Parrilla y Especiales" en Firestore (categoría, grupos
// de opciones "Corte" y "Carne" y sus 7 platos). No toca las demás categorías ni productos.
//   cd scripts
//   GOOGLE_APPLICATION_CREDENTIALS=clave-servicio.json node cargar-parrilla.mjs
// Con el emulador: FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=isma-gastro-bar node cargar-parrilla.mjs
// Es idempotente (merge): se puede correr varias veces. Si en el POS ya marcaron
// un plato como agotado, ese campo se conserva.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { RID, CATEGORIAS, GRUPOS_OPCIONES, MENU_ITEMS } from '../shared/menu.seed.js';

const CAT = 'parrilla_especiales';
const categoria = CATEGORIAS.find((c) => c.id === CAT);
const items = MENU_ITEMS.filter((i) => i.categoria_id === CAT);
// Grupos que usan estos platos (corte_asado es nuevo; termino_carne ya existe y se reescribe igual).
const idsGrupos = new Set(items.flatMap((i) => i.grupos_opciones.map((g) => g.grupo_id)));
const grupos = GRUPOS_OPCIONES.filter((g) => idsGrupos.has(g.id));

const sinPrecio = items.filter((i) => !(i.precio > 0)).map((i) => i.id);
if (!categoria || !items.length || sinPrecio.length) {
  console.error('✖ Revisa shared/menu.seed.js: falta la categoría, los platos o sus precios.', sinPrecio);
  process.exit(1);
}

initializeApp(process.env.GCLOUD_PROJECT ? { projectId: process.env.GCLOUD_PROJECT } : undefined);
const db = getFirestore();
const base = db.doc(`restaurantes/${RID}`);

const batch = db.batch();
batch.set(base.collection('categorias').doc(categoria.id), categoria, { merge: true });
grupos.forEach((g) => batch.set(base.collection('grupos_opciones').doc(g.id), g, { merge: true }));
items.forEach((i) => batch.set(base.collection('menu_items').doc(i.id), i, { merge: true }));
await batch.commit();

console.log(`✔ restaurantes/${RID}: "${categoria.nombre}" con ${items.length} platos y grupos [${[...idsGrupos].join(', ')}].`);
items.forEach((i) => console.log(`   ${i.nombre.padEnd(24)} $${i.precio.toLocaleString('es-CO')}`));
