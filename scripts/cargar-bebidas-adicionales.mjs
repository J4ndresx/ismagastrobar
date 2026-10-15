// Carga SOLO Bebidas y Adicionales en Firestore: sus categorías, subcategorías (pestañas),
// grupos de opciones (sabores) y productos. No toca las demás categorías ni el Menú del Día.
//   cd scripts
//   node cargar-bebidas-adicionales.mjs            → carga (pide precios reales, ninguno en 0)
//   node cargar-bebidas-adicionales.mjs --prueba   → solo muestra lo que cargaría, sin conectarse
// Es idempotente (merge): se puede correr varias veces. Si en el POS ya marcaron algo como
// agotado, se conserva. Los productos que quites de shared/menu.seed.js NO se borran de
// Firestore: desactívalos marcándolos agotados desde el panel.
import { RID, CATEGORIAS, GRUPOS_OPCIONES, MENU_ITEMS } from '../shared/menu.seed.js';

const RAICES = ['bebidas', 'adicionales'];
const prueba = process.argv.includes('--prueba');

const categorias = CATEGORIAS.filter((c) => RAICES.includes(c.id) || RAICES.includes(c.parent_id));
const items = MENU_ITEMS.filter((i) => RAICES.includes(i.categoria_id));
const idsGrupos = new Set(items.flatMap((i) => i.grupos_opciones.map((g) => g.grupo_id)));
const grupos = GRUPOS_OPCIONES.filter((g) => idsGrupos.has(g.id));

const sinPrecio = items.filter((i) => !(i.precio > 0));
const sinSub = items.filter((i) => !i.subcategoria_id);

console.log(`restaurantes/${RID}: ${categorias.length} categorías/subcategorías, ${grupos.length} grupos, ${items.length} productos`);
for (const c of categorias.filter((x) => x.parent_id)) {
  const lista = items.filter((i) => i.subcategoria_id === c.id);
  console.log(`  ${c.parent_id} › ${c.nombre}${c.dinamica ? ' (del día)' : ''}: ${lista.map((i) => `${i.nombre} $${i.precio.toLocaleString('es-CO')}`).join(', ')}`);
}

if (sinSub.length) {
  console.error(`\n✖ Productos sin subcategoría (no se verían en la app): ${sinSub.map((i) => i.id).join(', ')}`);
  process.exit(1);
}
if (sinPrecio.length) {
  console.error(`\n✖ Faltan ${sinPrecio.length} precios en shared/menu.seed.js (PRECIOS):\n  ${sinPrecio.map((i) => i.id).join(', ')}`);
  console.error('  Pon el precio real o borra el producto (su línea en PRECIOS y en la lista beb(...) / adic(...)).');
  if (!prueba) process.exit(1);
}
if (prueba) { console.log('\n(Prueba: no se escribió nada.)'); process.exit(0); }

const { initializeApp } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
initializeApp(process.env.GCLOUD_PROJECT ? { projectId: process.env.GCLOUD_PROJECT } : undefined);
const db = getFirestore();
const base = db.doc(`restaurantes/${RID}`);

const docs = [
  ...categorias.map((c) => [base.collection('categorias').doc(c.id), c]),
  ...grupos.map((g) => [base.collection('grupos_opciones').doc(g.id), g]),
  ...items.map((i) => [base.collection('menu_items').doc(i.id), i]),
];
for (let k = 0; k < docs.length; k += 400) {
  const lote = db.batch();
  docs.slice(k, k + 400).forEach(([ref, data]) => lote.set(ref, data, { merge: true }));
  await lote.commit();
}
console.log(`\n✔ Listo: ${docs.length} documentos cargados. Recarga la app del cliente y el POS.`);
