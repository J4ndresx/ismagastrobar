// Carga UNA categoría del menú en Firestore: la categoría, sus subcategorías, los grupos de
// opciones que usan sus productos y los productos. No toca nada más.
//   cd scripts
//   node cargar-categoria.mjs desayunos            → carga (exige precios reales, ninguno en 0)
//   node cargar-categoria.mjs desayunos --prueba   → solo muestra lo que cargaría, sin conectarse
// Idempotente (merge): se puede repetir. Conserva lo que el admin cambió en "Agotados"
// (productos agotados). ⚠️ Los grupos de opciones SÍ se reescriben: si el admin había apagado
// una opción, vuelve a quedar prendida.
import { RID, CATEGORIAS, GRUPOS_OPCIONES, MENU_ITEMS } from '../shared/menu.seed.js';

const [catId] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const prueba = process.argv.includes('--prueba');
const raiz = CATEGORIAS.find((c) => c.id === catId && !c.parent_id);
if (!raiz) {
  console.error(`Uso: node cargar-categoria.mjs <categoría> [--prueba]\nCategorías: ${CATEGORIAS.filter((c) => !c.parent_id).map((c) => c.id).join(', ')}`);
  process.exit(1);
}

const categorias = CATEGORIAS.filter((c) => c.id === catId || c.parent_id === catId);
const items = MENU_ITEMS.filter((i) => i.categoria_id === catId);
const idsGrupos = new Set(items.flatMap((i) => i.grupos_opciones.map((g) => g.grupo_id)).filter((id) => !id.startsWith('mdd_')));
const grupos = GRUPOS_OPCIONES.filter((g) => idsGrupos.has(g.id));
const sinPrecio = items.filter((i) => !(i.precio > 0));

console.log(`restaurantes/${RID} › ${raiz.nombre}: ${items.length} productos, ${grupos.length} grupos de opciones`);
for (const i of items) {
  const opc = i.grupos_opciones.map((r) => `${r.etiqueta}${r.min ? ' (obligatorio)' : ''}`).join(', ');
  console.log(`  ${i.nombre.padEnd(36)} $${i.precio.toLocaleString('es-CO').padStart(7)}${opc ? `  · ${opc}` : ''}`);
}
for (const g of grupos) console.log(`  [${g.nombre}] ${g.opciones.map((o) => o.nombre).join(' / ')}`);

if (sinPrecio.length) {
  console.error(`\n✖ Faltan precios en shared/menu.seed.js (PRECIOS): ${sinPrecio.map((i) => i.id).join(', ')}`);
  if (!prueba) process.exit(1);
}
if (prueba) { console.log('\n(Prueba: no se escribió nada.)'); process.exit(0); }

const { conectarFirestore } = await import('./firebaseAdmin.mjs');
const db = await conectarFirestore();
const base = db.doc(`restaurantes/${RID}`);
const lote = db.batch();
categorias.forEach((c) => lote.set(base.collection('categorias').doc(c.id), c, { merge: true }));
grupos.forEach((g) => lote.set(base.collection('grupos_opciones').doc(g.id), g, { merge: true }));
items.forEach((i) => lote.set(base.collection('menu_items').doc(i.id), i, { merge: true }));
await lote.commit();
console.log(`\n✔ Listo: "${raiz.nombre}" cargada. Recarga la app del cliente y el POS.`);
