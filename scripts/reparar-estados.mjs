// Vuelve a copiar el estado real de cada comanda (trabajos_impresion) a su pedido.
// Sirve para pedidos que quedaron mostrando "Imprimiendo" en el POS aunque la
// comanda ya se había enviado (eventos que llegaron en desorden, corregido en
// la Cloud Function del 29-sep). No imprime ni borra nada.
//
//   node reparar-estados.mjs
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const rid = process.argv[2] || 'isma';
initializeApp(process.env.GCLOUD_PROJECT ? { projectId: process.env.GCLOUD_PROJECT } : undefined);
const db = getFirestore();
const base = db.doc(`restaurantes/${rid}`);

const trabajos = await base.collection('trabajos_impresion').get();
let revisados = 0, corregidos = 0;
for (const d of trabajos.docs) {
  const t = d.data();
  const refPedido = base.collection('pedidos').doc(t.pedido_id);
  const p = await refPedido.get();
  if (!p.exists) continue;
  revisados++;
  const real = t.estado === 'pendiente' ? 'en_cola' : t.estado;
  const visto = p.data().impresion?.[t.zona]?.estado;
  if (visto === real) continue;
  await refPedido.update({
    [`impresion.${t.zona}`]: { estado: real, impreso_en: t.impreso_en || null, error: t.error || null, reimpresiones: t.reimpresiones || 0 },
  });
  corregidos++;
  console.log(`  #${String(t.numero).padStart(3, '0')} ${t.titulo}: el POS mostraba "${visto}", el estado real es "${real}"`);
}
console.log(`\n✔ ${revisados} comandas revisadas, ${corregidos} corregidas.`);
process.exit(0);
