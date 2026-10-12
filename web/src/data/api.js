// Acceso a Firebase para la app de la vendedora.
// En la vista previa (PREVIEW=1) este archivo se reemplaza por api.mock.js.
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, query, where, orderBy, onSnapshot, addDoc, getDoc, updateDoc, runTransaction, serverTimestamp, Timestamp, increment, writeBatch, getDocs, setDoc } from 'firebase/firestore';
import { RID } from '@shared/menu.seed.js';
import { aplicarMenuDelDia, armarMenuDelDia, actualizarFrecuentes, vendible, MDD_DOC, MDD_FRECUENTES_DOC } from '@shared/menuDelDia.js';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
// Caché persistente: el menú abre al instante y los pedidos se guardan aunque se caiga el wifi.
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const base = `restaurantes/${RID}`;

const aISO = (v) => (v?.toDate ? v.toDate().toISOString() : v || null);

export const MODO_DEMO = false;

export function escucharSesion(cb) {
  return onAuthStateChanged(auth, async (u) => {
    if (!u) return cb(null);
    const { claims } = await u.getIdTokenResult();
    cb({ uid: u.uid, email: u.email, nombre: u.displayName || '', rid: claims.rid, rol: claims.rol });
  });
}
/** Acepta el usuario corto ("carlos.perez") o el correo completo. */
export const correoDe = (usuario) => {
  const u = String(usuario || '').trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${RID}.app`;
};
export const iniciarSesion = (usuario, password) => signInWithEmailAndPassword(auth, correoDe(usuario), password);

/** Perfil del usuario (nombre, si debe cambiar la clave, si sigue activo). null si no tiene. */
export function escucharPerfil(uid, cb) {
  return onSnapshot(doc(db, `${base}/usuarios/${uid}`), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
}

/** Cambia la contraseña. `actual` se pide cuando el cambio es voluntario (Firebase exige sesión reciente). */
export async function cambiarClave({ actual, nueva }) {
  const u = auth.currentUser;
  if (actual) await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, actual));
  await updatePassword(u, nueva);
  try {
    await updateDoc(doc(db, `${base}/usuarios/${u.uid}`), { debe_cambiar_clave: false, clave_cambiada_en: serverTimestamp() });
  } catch { /* cuentas antiguas sin perfil: no hay nada que marcar */ }
}

// Módulo Usuarios (solo administradores) → Cloud Function gestionarUsuarios.
const functions = getFunctions(app, 'us-east1');
const llamarUsuarios = httpsCallable(functions, 'gestionarUsuarios');
/** Valor del domicilio por distancia (misma función que usa la app del cliente). */
const llamarCotizar = httpsCallable(functions, 'cotizarDomicilio');
export async function cotizarDomicilio(datos) {
  try {
    return (await llamarCotizar(datos)).data;
  } catch (e) {
    console.error('cotizarDomicilio', e);
    return { estado: 'no_encontrada', motivo: 'error' };
  }
}

export async function usuarios(accion, datos = {}) {
  const r = await llamarUsuarios({ accion, ...datos });
  return r.data;
}
export const cerrarSesion = () => signOut(auth);

export function escucharMenu(cb) {
  const e = { categorias: null, items: null, grupos: null, mdd: undefined };
  const emitir = () => {
    if (!e.categorias || !e.items || !e.grupos || e.mdd === undefined) return;
    // Lo agotado no se puede tomar; el Menú del Día solo aparece si está publicado para HOY.
    cb(aplicarMenuDelDia({ categorias: e.categorias.filter((c) => c.activo), items: e.items.filter(vendible), grupos: e.grupos }, e.mdd));
  };
  const subs = [
    onSnapshot(collection(db, `${base}/categorias`), (s) => { e.categorias = s.docs.map((d) => d.data()); emitir(); }),
    onSnapshot(collection(db, `${base}/menu_items`), (s) => { e.items = s.docs.map((d) => d.data()); emitir(); }),
    onSnapshot(collection(db, `${base}/grupos_opciones`), (s) => { e.grupos = Object.fromEntries(s.docs.map((d) => [d.id, d.data()])); emitir(); }),
    onSnapshot(doc(db, `${base}/menu_del_dia/${MDD_DOC}`), (s) => { e.mdd = s.exists() ? s.data() : null; emitir(); }),
  ];
  const reloj = setInterval(emitir, 60_000); // el Menú del Día vence a medianoche
  return () => { subs.forEach((u) => u()); clearInterval(reloj); };
}

// ─── Panel del administrador: Menú del Día y Agotados ──────────────────
// (las reglas de Firestore solo dejan escribir esto al rol admin)

/** Documento del Menú del Día tal como está guardado (null si nunca se ha guardado). */
export function escucharMenuDelDia(cb) {
  return onSnapshot(doc(db, `${base}/menu_del_dia/${MDD_DOC}`), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
}

/** Opciones que el dueño ha usado antes (chips para armar el menú con un toque). */
export function escucharFrecuentesMdd(cb) {
  return onSnapshot(doc(db, `${base}/menu_del_dia/${MDD_FRECUENTES_DOC}`), (s) => cb(s.exists() ? s.data() : {}), () => cb({}));
}

/** Guarda la lista de opciones frecuentes (al agregar una opción nueva, para que no se pierda al recargar). */
export async function guardarFrecuentesMdd(frecuentes) {
  await setDoc(doc(db, `${base}/menu_del_dia/${MDD_FRECUENTES_DOC}`), { ...frecuentes, actualizado_en: serverTimestamp() });
}

/** Guarda (y publica si disponible) el Menú del Día. Lanza Error con un mensaje legible si falta algo.
 *  Lo elegido se suma a las opciones frecuentes (mismo lote), se publique o no. */
export async function guardarMenuDelDia(datos, frecuentes = {}) {
  const menu = armarMenuDelDia(datos); // valida y deja la fecha de hoy (Bogotá)
  const u = auth.currentUser;
  const lote = writeBatch(db);
  lote.set(doc(db, `${base}/menu_del_dia/${MDD_DOC}`), {
    ...menu,
    actualizado_en: serverTimestamp(),
    actualizado_por: u?.uid || null,
    actualizado_por_nombre: u?.displayName || '',
  });
  lote.set(doc(db, `${base}/menu_del_dia/${MDD_FRECUENTES_DOC}`), { ...actualizarFrecuentes(frecuentes, menu), actualizado_en: serverTimestamp() });
  await lote.commit();
}

/** Catálogo completo (incluye agotados) para el panel de Agotados. */
export function escucharCatalogo(cb) {
  const e = { categorias: null, items: null };
  const emitir = () => e.categorias && e.items && cb({ categorias: e.categorias, items: e.items });
  const subs = [
    onSnapshot(collection(db, `${base}/categorias`), (s) => { e.categorias = s.docs.map((d) => d.data()).filter((c) => c.activo); emitir(); }),
    onSnapshot(collection(db, `${base}/menu_items`), (s) => { e.items = s.docs.map((d) => d.data()).filter((i) => i.activo !== false); emitir(); }),
  ];
  return () => subs.forEach((u) => u());
}

/** Marca / desmarca un producto como agotado: desaparece de la app del cliente y del POS al instante. */
export async function marcarAgotado(itemId, agotado) {
  await updateDoc(doc(db, `${base}/menu_items/${itemId}`), { agotado: agotado === true, agotado_en: agotado ? serverTimestamp() : null });
}

/** Quita el "agotado" de varios productos a la vez (inicio del día). */
export async function limpiarAgotados(ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const lote = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => lote.update(doc(db, `${base}/menu_items/${id}`), { agotado: false, agotado_en: null }));
    await lote.commit();
  }
}

export async function crearPedido(pedido) {
  const ref = await addDoc(collection(db, `${base}/pedidos`), {
    ...pedido,
    estado: 'confirmado',
    origen: 'mostrador',
    creado_por: auth.currentUser?.uid || null,
    creado_en: serverTimestamp(),
  });
  return ref.id;
}

export function escucharPedidosHoy(cb) {
  // Desde la medianoche de Bogotá (UTC-5, sin horario de verano).
  const ahora = new Date();
  const inicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 5));
  if (inicio > ahora) inicio.setUTCDate(inicio.getUTCDate() - 1);
  const q = query(collection(db, `${base}/pedidos`), where('creado_en', '>=', Timestamp.fromDate(inicio)), orderBy('creado_en', 'desc'));
  return onSnapshot(q, (s) => cb(s.docs.map(mapearPedido)));
}

function mapearPedido(d) {
  const p = d.data();
  const impresion = Object.fromEntries(Object.entries(p.impresion || {}).map(([z, v]) => [z, { ...v, impreso_en: aISO(v.impreso_en) }]));
  const cuenta = p.cuenta ? { ...p.cuenta, impreso_en: aISO(p.cuenta.impreso_en) } : null;
  const cobro = p.cobro ? { ...p.cobro, en: aISO(p.cobro.en) } : null;
  const etapas = p.etapas ? Object.fromEntries(Object.entries(p.etapas).map(([k, v]) => [k, aISO(v)])) : null;
  return { id: d.id, ...p, impresion, cuenta, cobro, etapas, creado_en: aISO(p.creado_en) || new Date().toISOString(), pendiente_sync: d.metadata.hasPendingWrites };
}

/** Cuentas abiertas aunque sean de ayer (mesa que sigue después de medianoche). */
export function escucharCuentasAbiertas(cb) {
  const q = query(collection(db, `${base}/pedidos`), where('cobro.estado', '==', 'abierta'));
  return onSnapshot(q, (s) => cb(s.docs.map(mapearPedido)));
}

/** "Cobrar" (cajero / admin): la cuenta queda pagada con el total de ese momento. */
export async function cobrar(pedidoId, { metodo, total, liberarMesa = null }) {
  // Cobrar y liberar la mesa van juntos: o pasan los dos o ninguno.
  const lote = writeBatch(db);
  lote.update(doc(db, `${base}/pedidos/${pedidoId}`), {
    cobro: { estado: 'pagada', metodo, total, por: auth.currentUser?.uid || null, por_nombre: auth.currentUser?.displayName || '', en: serverTimestamp() },
  });
  if (liberarMesa) lote.update(doc(db, `${base}/mesas/${liberarMesa}`), { pedido_id: null, por: null, por_nombre: '', desde: null });
  await lote.commit();
}

// ─── Mesas del local ────────────────────────────────────────────────────
/** { [n]: { pedido_id, por, por_nombre, desde } } en vivo. */
export function escucharMesas(cb) {
  return onSnapshot(collection(db, `${base}/mesas`), (s) => cb(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))), () => cb({}));
}

/** Pedido nuevo en una mesa libre: el pedido y el bloqueo de la mesa se guardan juntos. */
export async function crearPedidoMesa(pedido, mesa) {
  const ref = doc(collection(db, `${base}/pedidos`));
  const lote = writeBatch(db);
  lote.set(ref, { ...pedido, mesa, estado: 'confirmado', origen: 'mostrador', creado_por: auth.currentUser?.uid || null, creado_en: serverTimestamp() });
  lote.set(doc(db, `${base}/mesas/${mesa}`), { pedido_id: ref.id, por: auth.currentUser?.uid || null, por_nombre: auth.currentUser?.displayName || '', desde: serverTimestamp() });
  try {
    await lote.commit();
  } catch (e) {
    if (e.code === 'permission-denied') throw Object.assign(new Error(`La mesa ${mesa} acaba de ser tomada por otra persona.`), { code: 'mesa-ocupada' });
    throw e;
  }
  return ref.id;
}

/** Caja / admin: pasar la mesa a otra persona del equipo. */
export async function pasarMesa(mesa, { uid, nombre }) {
  await updateDoc(doc(db, `${base}/mesas/${mesa}`), { por: uid, por_nombre: nombre });
}

/** Caja / admin: dejar la mesa libre sin cobrar (p. ej. si quedó pegada). */
export async function liberarMesa(mesa) {
  await updateDoc(doc(db, `${base}/mesas/${mesa}`), { pedido_id: null, por: null, por_nombre: '', desde: null });
}

/** Personas activas del equipo (para "Pasar mesa"). */
export async function listarEquipo() {
  const s = await getDocs(collection(db, `${base}/usuarios`));
  return s.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((u) => ['vendedora', 'cajero', 'admin'].includes(u.rol) && u.activo !== false && !u.eliminado)
    .map((u) => ({ uid: u.uid, nombre: [u.nombre, u.apellido].filter(Boolean).join(' ') || u.usuario || 'Sin nombre', rol: u.rol }));
}

// El latido trae la hora del servidor, pero este equipo compara con SU reloj: si
// el reloj del PC/celular está adelantado un minuto, el POS mostraba
// "Desconectada" aunque el puente estuviera bien. Por eso se usa la hora en que
// ESTE equipo recibió cada latido nuevo (no depende de que los relojes coincidan).
const latidosVistos = new Map(); // id → { servidor, recibido }
export function escucharImpresora(cb) {
  return onSnapshot(collection(db, `${base}/impresoras`), (s) => {
    const lista = s.docs.map((d) => {
      const servidor = d.data().ultimo_latido?.toMillis?.() ?? null;
      const antes = latidosVistos.get(d.id);
      let recibido = antes?.recibido ?? null;
      if (servidor && servidor !== antes?.servidor) recibido = antes ? Date.now() : Math.min(Date.now(), servidor);
      latidosVistos.set(d.id, { servidor, recibido });
      return { id: d.id, ...d.data(), ultimo_latido: recibido ? new Date(recibido) : null };
    });
    cb(lista.sort((a, b) => (b.ultimo_latido || 0) - (a.ultimo_latido || 0))[0] || null);
  });
}

export async function reimprimir(pedidoId, zona) {
  const ref = doc(db, `${base}/trabajos_impresion/${pedidoId}_${zona}`);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('No existe la comanda.');
    tx.update(ref, { estado: 'pendiente', reimpresiones: (s.data().reimpresiones || 0) + 1, error: null });
  });
}

/** "Imprimir cuenta": la Cloud Function arma el ticket con precios y lo manda al puente. */
export async function pedirCuenta(pedidoId) {
  await updateDoc(doc(db, `${base}/pedidos/${pedidoId}`), { cuenta_solicitudes: increment(1) });
}

export async function obtenerTrabajo(pedidoId, zona) {
  const s = await getDoc(doc(db, `${base}/trabajos_impresion/${pedidoId}_${zona}`));
  return s.exists() ? s.data() : null;
}

/** Pedido de la app del cliente → pasa a "confirmado" y la Cloud Function imprime las comandas. */
/** domicilio = { valor, subtotal } cuando caja pone el domicilio que la app no pudo calcular. */
export async function aprobarPedido(pedidoId, domicilio = null) {
  const u = auth.currentUser;
  await updateDoc(doc(db, `${base}/pedidos/${pedidoId}`), {
    estado: 'confirmado', aprobado_por: u?.uid || null, aprobado_en: serverTimestamp(),
    ...(domicilio ? {
      domicilio_valor: Math.round(domicilio.valor),
      total: domicilio.subtotal + Math.round(domicilio.valor),
      domicilio_confirmado: { valor: Math.round(domicilio.valor), por: u?.uid || null, por_nombre: u?.displayName || '', en: serverTimestamp() },
    } : {}),
  });
}

export async function rechazarPedido(pedidoId, motivo = '') {
  await updateDoc(doc(db, `${base}/pedidos/${pedidoId}`), { estado: 'rechazado', motivo_rechazo: motivo, aprobado_por: auth.currentUser?.uid || null });
}

/** Seguimiento del cliente (pedidos de la app): listo / en camino / entregado. */
export async function marcarEtapa(pedidoId, etapa) {
  await updateDoc(doc(db, `${base}/pedidos/${pedidoId}`), { etapa, [`etapas.${etapa}`]: serverTimestamp() });
}

// ─── Abrir / cerrar la app del cliente ───────────────────────────────────
/** Doc `config/tienda` en vivo ({ manual } con `hasta` en ms). */
export function escucharTienda(cb) {
  return onSnapshot(doc(db, `${base}/config/tienda`), (s) => {
    const d = s.exists() ? s.data() : {};
    cb(d.manual ? { manual: { ...d.manual, hasta: d.manual.hasta?.toMillis?.() ?? null } } : {});
  }, () => cb({}));
}
/** manual = null (volver al horario) o { estado, hasta (ms) } — ver shared/tienda.js. */
export async function cambiarTienda(manual) {
  const u = auth.currentUser;
  await setDoc(doc(db, `${base}/config/tienda`), {
    manual: manual ? { estado: manual.estado, hasta: Timestamp.fromMillis(manual.hasta), por: u?.uid || null, por_nombre: u?.displayName || '', en: serverTimestamp() } : null,
  });
}
