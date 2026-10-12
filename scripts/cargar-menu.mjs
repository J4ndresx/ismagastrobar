// Carga (o actualiza) el menú en Firestore.
//   GOOGLE_APPLICATION_CREDENTIALS=clave-servicio.json node scripts/cargar-menu.mjs
// Con el emulador: FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/cargar-menu.mjs
// Es idempotente: se puede correr las veces que haga falta.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { RID, CATEGORIAS, GRUPOS_OPCIONES, MENU_ITEMS, ZONAS } from '../shared/menu.seed.js';
import { MDD_DOC } from '../shared/menuDelDia.js';

// Guardia: no publicar el menú con precios en 0 (el cliente vería "$0").
const sinPrecio = MENU_ITEMS.filter((i) => !(i.precio > 0)).map((i) => i.id);
if (sinPrecio.length && process.env.PERMITIR_PRECIOS_PENDIENTES !== '1') {
  console.error(`✖ Faltan precios en shared/menu.seed.js (PRECIOS): ${sinPrecio.join(', ')}\n  (para cargar igual en pruebas: PERMITIR_PRECIOS_PENDIENTES=1)`);
  process.exit(1);
}

initializeApp(process.env.GCLOUD_PROJECT ? { projectId: process.env.GCLOUD_PROJECT } : undefined);
const db = getFirestore();
const base = db.doc(`restaurantes/${RID}`);

const docs = [
  [base, { nombre: 'ISMA GASTRO-BAR', zonas: ZONAS, zona_horaria: 'America/Bogota' }],
  ...CATEGORIAS.map((c) => [base.collection('categorias').doc(c.id), c]),
  ...GRUPOS_OPCIONES.map((gp) => [base.collection('grupos_opciones').doc(gp.id), gp]),
  ...MENU_ITEMS.map((i) => [base.collection('menu_items').doc(i.id), i]),
];

// Menú del Día: se crea vacío y DESACTIVADO solo si no existe (nunca pisa lo que el dueño ya publicó).
const refMdd = base.collection('menu_del_dia').doc(MDD_DOC);
if (!(await refMdd.get()).exists) {
  await refMdd.set({ sopaDelDia: [], proteinaDelDia: [], ensaladaDelDia: [], bebidaDelDia: [], fecha: '', disponible: false });
}

for (let i = 0; i < docs.length; i += 400) {
  const batch = db.batch();
  docs.slice(i, i + 400).forEach(([ref, data]) => batch.set(ref, data, { merge: true }));
  await batch.commit();
}
console.log(`Menú cargado en restaurantes/${RID}: ${CATEGORIAS.length} categorías, ${GRUPOS_OPCIONES.length} grupos, ${MENU_ITEMS.length} ítems.`);
