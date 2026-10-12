// Acceso a Firestore desde la app del cliente.
// En la vista previa (PREVIEW=1) se reemplaza por backend.mock.js.
import { app, db } from '../firebaseConfig';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { RID } from '@shared/menu.seed.js';
import { aplicarMenuDelDia, vendible, MDD_DOC } from '@shared/menuDelDia.js';

const base = `restaurantes/${RID}`;

/**
 * Menú público en TIEMPO REAL (solo lectura): categorías, productos, opciones y
 * el Menú del Día. Si el dueño cambia la sopa, marca algo como agotado o apaga
 * el Menú del Día, la pantalla se actualiza sola, sin recargar.
 * Devuelve la función para dejar de escuchar.
 */
export function escucharMenu(cb, onError) {
  const e = { categorias: null, items: null, grupos: null, mdd: undefined };
  const emitir = () => {
    if (!e.categorias || !e.items || !e.grupos || e.mdd === undefined) return;
    cb(aplicarMenuDelDia({ categorias: e.categorias.filter((c) => c.activo), items: e.items.filter(vendible), grupos: e.grupos }, e.mdd));
  };
  const fallo = (err) => { console.error('escucharMenu', err); onError?.(err); };
  const subs = [
    onSnapshot(collection(db, `${base}/categorias`), (s) => { e.categorias = s.docs.map((d) => d.data()); emitir(); }, fallo),
    onSnapshot(collection(db, `${base}/menu_items`), (s) => { e.items = s.docs.map((d) => d.data()); emitir(); }, fallo),
    onSnapshot(collection(db, `${base}/grupos_opciones`), (s) => { e.grupos = Object.fromEntries(s.docs.map((d) => [d.id, d.data()])); emitir(); }, fallo),
    onSnapshot(doc(db, `${base}/menu_del_dia/${MDD_DOC}`), (s) => { e.mdd = s.exists() ? s.data() : null; emitir(); }, fallo),
  ];
  // El Menú del Día vence a medianoche (Bogotá) aunque no cambie ningún documento.
  const reloj = setInterval(emitir, 60_000);
  return () => { subs.forEach((u) => u()); clearInterval(reloj); };
}

/**
 * Crea el pedido como "por_aprobar": NO imprime hasta que la vendedora lo
 * acepte en el POS (evita que un pedido falso ponga a trabajar la cocina).
 */
export async function crearPedido(pedido) {
  const ref = await addDoc(collection(db, `${base}/pedidos`), {
    ...pedido,
    estado: 'por_aprobar',
    origen: 'app',
    creado_en: serverTimestamp(),
  });
  return ref.id;
}

/** Valor del domicilio por distancia (Cloud Function: Google ubica la dirección). */
const llamarCotizar = httpsCallable(getFunctions(app, 'us-east1'), 'cotizarDomicilio');
export async function cotizarDomicilio(datos) {
  try {
    return (await llamarCotizar(datos)).data;
  } catch (e) {
    console.error('cotizarDomicilio', e);
    return { estado: 'no_encontrada', motivo: 'error' };
  }
}

/** Seguimiento en vivo (copia pública del pedido que mantiene la nube). */
export function escucharSeguimiento(token, cb) {
  return onSnapshot(
    doc(db, `${base}/seguimiento/${token}`),
    (s) => cb(s.exists() ? s.data() : null),
    () => cb(null),
  );
}

/** Abierta / cerrada a mano desde el POS (el horario se calcula en shared/tienda.js). */
export function escucharTienda(cb) {
  return onSnapshot(
    doc(db, `${base}/config/tienda`),
    (s) => cb(s.exists() ? s.data() : {}),
    () => cb({}),
  );
}
