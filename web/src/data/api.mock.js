// Backend simulado para la vista previa: mismo contrato que api.js.
// Simula la Cloud Function (número + comandas por zona) y el puente de
// impresión (impreso / error), para poder probar todo el flujo sin Firebase.
import { RID, CATEGORIAS, GRUPOS_OPCIONES, MENU_ITEMS } from '@shared/menu.seed.js';
import { aplicarMenuDelDia, armarMenuDelDia, actualizarFrecuentes, vendible } from '@shared/menuDelDia.js';
import { construirTrabajos, construirCuenta, crearLinea } from '@shared/comandas.js';
import { VERSION_PUENTE } from '@shared/version.js';

export const MODO_DEMO = true;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const pedidos = [];
const trabajos = {};
let consecutivo = 0;
let impresoraDemo = 'ok'; // 'ok' | 'sin_papel' | 'apagada'
const subsPedidos = new Set();
const subsImpresora = new Set();

const emitirPedidos = () => subsPedidos.forEach((cb) => cb(pedidos.map((p) => structuredClone(p))));
const infoImpresora = () =>
  impresoraDemo === 'apagada'
    ? { id: 'mostrador', nombre: 'POS 80mm mostrador', version: VERSION_PUENTE, ultimo_latido: new Date(Date.now() - 5 * 60_000) }
    : { id: 'mostrador', nombre: 'POS 80mm mostrador', version: VERSION_PUENTE, ultimo_latido: new Date(),
        cortes_dia: new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10),
        cortes: [{ tipo: 'pausa', hora: '18:42', minutos: 7 }, { tipo: 'internet', hora: '20:15', minutos: 2 }, { tipo: 'impresora', hora: '21:03', minutos: 1, detalle: 'Impresora apagada o desconectada' }] };
const emitirImpresora = () => subsImpresora.forEach((cb) => cb(infoImpresora()));

// ─── Sesión y usuarios simulados ───────────────────────────────────────
// Usa la MISMA lógica que la Cloud Function (functions/usuarios.js) sobre
// un Auth y un Firestore en memoria. Cuentas demo:
//   admin / admin123 (administrador) · vendedora / vende123 (vendedor)
import { gestionarUsuarios } from '../../../functions/usuarios.js';

const cuentas = new Map([
  ['admin1', { uid: 'admin1', email: `admin@${RID}.app`, password: 'admin123', displayName: 'James Álvarez', disabled: false, customClaims: { rid: RID, rol: 'admin' }, metadata: {} }],
  ['vend1', { uid: 'vend1', email: `vendedora@${RID}.app`, password: 'vende123', displayName: 'Pepita Perez', disabled: false, customClaims: { rid: RID, rol: 'vendedora' }, metadata: {} }],
  ['imp', { uid: 'imp', email: `impresora@${RID}.app`, password: 'x', displayName: '', disabled: false, customClaims: { rid: RID, rol: 'impresora' }, metadata: {} }],
]);
const perfiles = new Map();
let sesionUid = 'admin1';
const subsSesion = new Set();
const subsPerfil = new Set();
const sesionDe = (uid) => {
  const u = cuentas.get(uid);
  return u ? { uid, email: u.email, nombre: u.displayName, rid: RID, rol: u.customClaims.rol } : null;
};
const emitirSesion = () => subsSesion.forEach((cb) => cb(sesionUid ? sesionDe(sesionUid) : null));
const emitirPerfil = () => subsPerfil.forEach(([uid, cb]) => cb(perfiles.get(uid) ? { ...perfiles.get(uid) } : null));
const errorAuth = (code) => Object.assign(new Error(code), { code });

export function escucharSesion(cb) {
  subsSesion.add(cb);
  cb(sesionUid ? sesionDe(sesionUid) : null);
  return () => subsSesion.delete(cb);
}
export const correoDe = (usuario) => {
  const u = String(usuario || '').trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${RID}.app`;
};
export async function iniciarSesion(usuario, password) {
  await espera(300);
  const u = [...cuentas.values()].find((c) => c.email === correoDe(usuario));
  if (!u || u.password !== password) throw errorAuth('auth/invalid-credential');
  if (u.disabled) throw errorAuth('auth/user-disabled');
  u.metadata.lastSignInTime = new Date().toUTCString();
  sesionUid = u.uid;
  emitirSesion();
}
export async function cerrarSesion() {
  sesionUid = null;
  emitirSesion();
}
export function escucharPerfil(uid, cb) {
  const par = [uid, cb];
  subsPerfil.add(par);
  cb(perfiles.get(uid) ? { ...perfiles.get(uid) } : null);
  return () => subsPerfil.delete(par);
}
export async function cambiarClave({ actual, nueva }) {
  await espera(300);
  const u = cuentas.get(sesionUid);
  if (actual !== undefined && actual !== u.password) throw errorAuth('auth/invalid-credential');
  if (nueva.length < 6) throw errorAuth('auth/weak-password');
  u.password = nueva;
  if (perfiles.has(u.uid)) perfiles.set(u.uid, { ...perfiles.get(u.uid), debe_cambiar_clave: false });
  emitirPerfil();
}

const authFalso = {
  async getUser(uid) { if (!cuentas.has(uid)) throw errorAuth('auth/user-not-found'); return structuredClone(cuentas.get(uid)); },
  async listUsers() { return { users: [...cuentas.values()].map((u) => structuredClone(u)) }; },
  async createUser({ email, password, displayName }) {
    if ([...cuentas.values()].some((u) => u.email === email)) throw errorAuth('auth/email-already-exists');
    const uid = 'u' + Math.random().toString(36).slice(2, 8);
    cuentas.set(uid, { uid, email, password, displayName, disabled: false, customClaims: {}, metadata: { creationTime: new Date().toUTCString() } });
    return { uid };
  },
  async setCustomUserClaims(uid, c) { cuentas.get(uid).customClaims = c; },
  async updateUser(uid, cambios) { Object.assign(cuentas.get(uid), cambios); return structuredClone(cuentas.get(uid)); },
  async revokeRefreshTokens() {},
  async deleteUser(uid) { cuentas.delete(uid); },
};
const dbFalso = {
  collection: () => ({
    doc: (id) => ({ set: async (v, o) => { perfiles.set(id, o?.merge ? { ...(perfiles.get(id) || {}), ...v } : v); emitirPerfil(); } }),
    get: async () => ({ docs: [...perfiles.entries()].map(([id, v]) => ({ id, data: () => v })) }),
  }),
};
export async function usuarios(accion, datos = {}) {
  await espera(350);
  const u = cuentas.get(sesionUid);
  const r = await gestionarUsuarios({ auth: authFalso, db: dbFalso, llamador: { uid: sesionUid, token: u?.customClaims || {} } }, { accion, ...datos });
  if (accion === 'editar' && datos.uid === sesionUid) emitirSesion();
  return structuredClone(r);
}

const oyentesMenu = new Set();
let mddDemo = null;
const itemsDemo = structuredClone(MENU_ITEMS);
const avisarMenu = () => oyentesMenu.forEach((f) => f());

export function escucharMenu(cb) {
  const grupos = Object.fromEntries(GRUPOS_OPCIONES.map((g) => [g.id, g]));
  const emitir = () => cb(aplicarMenuDelDia({ categorias: CATEGORIAS, items: itemsDemo.filter(vendible), grupos }, mddDemo));
  oyentesMenu.add(emitir);
  setTimeout(emitir, 150);
  return () => oyentesMenu.delete(emitir);
}
export function escucharMenuDelDia(cb) {
  const f = () => cb(mddDemo);
  oyentesMenu.add(f);
  setTimeout(f, 100);
  return () => oyentesMenu.delete(f);
}
let frecuentesDemo = { sopaDelDia: ['Ajiaco'], proteinaDelDia: ['Pollo sudado'] };
export function escucharFrecuentesMdd(cb) {
  const f = () => cb(frecuentesDemo);
  oyentesMenu.add(f);
  setTimeout(f, 100);
  return () => oyentesMenu.delete(f);
}
export async function guardarFrecuentesMdd(frecuentes) {
  frecuentesDemo = frecuentes;
  avisarMenu();
}
export async function guardarMenuDelDia(datos, frecuentes = {}) {
  mddDemo = armarMenuDelDia(datos);
  frecuentesDemo = actualizarFrecuentes(frecuentes, mddDemo);
  avisarMenu();
}
export function escucharCatalogo(cb) {
  const f = () => cb({ categorias: CATEGORIAS, items: itemsDemo });
  oyentesMenu.add(f);
  setTimeout(f, 100);
  return () => oyentesMenu.delete(f);
}
export async function marcarAgotado(id, agotado) {
  const it = itemsDemo.find((i) => i.id === id);
  if (it) it.agotado = agotado === true;
  avisarMenu();
}
export async function limpiarAgotados(ids) {
  itemsDemo.forEach((i) => { if (ids.includes(i.id)) i.agotado = false; });
  avisarMenu();
}

export async function crearPedido(pedido) {
  // (pedidos del mostrador: se confirman de una)
  const id = 'p' + Math.random().toString(36).slice(2, 9);
  const p = { id, ...structuredClone(pedido), estado: 'confirmado', origen: 'mostrador', creado_por: sesionUid, creado_en: new Date().toISOString(), impresion: {} };
  pedidos.unshift(p);
  emitirPedidos();
  simularFunction(p);
  return id;
}

// Cloud Function `prepararComandas`
async function simularFunction(p) {
  if (p.estado !== 'confirmado' || p.comandas_generadas) return;
  await espera(500);
  const padre = p.adicion_de && pedidos.find((x) => x.id === p.adicion_de && x.numero);
  let adicion = 0;
  if (padre) {
    padre.adiciones = [...(padre.adiciones || []), p.id];
    adicion = padre.adiciones.length;
    padre.total_cuenta = (padre.total_cuenta ?? padre.total) + p.total;
    p.numero = padre.numero;
    p.adicion_n = adicion;
  } else p.numero = ++consecutivo;
  p.comandas_generadas = true;
  const lista = construirTrabajos(p.id, p, p.numero, p.creado_en, { vendedor: 'Carolina', adicion });
  for (const t of lista) {
    trabajos[t.id] = t;
    p.impresion[t.zona] = { estado: 'en_cola', impreso_en: null, error: null };
  }
  emitirPedidos();
  for (const t of lista) simularPuente(t);
}

// Puente de impresión
let colaPuente = Promise.resolve();
function simularPuente(t) {
  colaPuente = colaPuente.then(async () => {
    if (impresoraDemo === 'apagada') return; // queda en cola hasta que "vuelva"
    const p = pedidos.find((x) => x.id === t.pedido_id);
    const poner = (v) => (t.zona === 'cuenta' ? (p.cuenta = v) : (p.impresion[t.zona] = v));
    t.estado = 'imprimiendo';
    poner({ ...(t.zona === 'cuenta' ? p.cuenta : p.impresion[t.zona]), estado: 'imprimiendo' });
    emitirPedidos();
    await espera(900);
    if (impresoraDemo === 'sin_papel') {
      t.estado = 'error';
      t.error = 'Sin papel';
    } else {
      t.estado = 'impreso';
      t.impreso_en = new Date().toISOString();
      t.error = null;
    }
    poner({ estado: t.estado, impreso_en: t.impreso_en || null, error: t.error || null, reimpresiones: t.reimpresiones });
    emitirPedidos();
  });
}

export function escucharPedidosHoy(cb) {
  subsPedidos.add(cb);
  cb(pedidos.map((p) => structuredClone(p)));
  return () => subsPedidos.delete(cb);
}

// En el demo todos los pedidos ya están en "hoy".
export function escucharCuentasAbiertas(cb) {
  cb([]);
  return () => {};
}

export async function cobrar(pedidoId, { metodo, total, liberarMesa: m = null }) {
  await espera(300);
  if (m) { mesas[m] = { pedido_id: null, por: null, por_nombre: '' }; emitirMesas(); }
  const p = pedidos.find((x) => x.id === pedidoId);
  if (p.cobro?.estado !== 'abierta') throw new Error('La cuenta ya no está abierta.');
  const u = cuentas.get(sesionUid);
  p.cobro = { estado: 'pagada', metodo, total, por: sesionUid, por_nombre: u?.displayName || '', en: new Date().toISOString() };
  emitirPedidos();
}

export function escucharImpresora(cb) {
  subsImpresora.add(cb);
  cb(infoImpresora());
  const t = setInterval(() => cb(infoImpresora()), 10_000);
  return () => { subsImpresora.delete(cb); clearInterval(t); };
}

export async function reimprimir(pedidoId, zona) {
  const t = trabajos[`${pedidoId}_${zona}`];
  if (!t) throw new Error('No existe la comanda.');
  t.reimpresiones = (t.reimpresiones || 0) + 1;
  t.estado = 'pendiente';
  const p = pedidos.find((x) => x.id === pedidoId);
  if (zona === 'cuenta') p.cuenta = { ...p.cuenta, estado: 'en_cola', error: null };
  else p.impresion[zona] = { ...p.impresion[zona], estado: 'en_cola', error: null };
  emitirPedidos();
  simularPuente(t);
}

export async function pedirCuenta(pedidoId) {
  const p = pedidos.find((x) => x.id === pedidoId);
  const hechas = p.cuenta_impresas || 0;
  const extra = (p.adiciones || []).map((a) => pedidos.find((x) => x.id === a)).filter(Boolean).flatMap((a) => a.items);
  const { id, ...t } = construirCuenta(p.id, { ...p, items: [...p.items, ...extra] }, { vendedor: 'Carolina' });
  trabajos[id] = { id, ...t, pedido_creado_en: p.creado_en, estado: 'pendiente', reimpresiones: hechas };
  p.cuenta_impresas = hechas + 1;
  p.cuenta = { estado: 'en_cola', impreso_en: null, error: null, reimpresiones: hechas };
  emitirPedidos();
  await espera(300);
  simularPuente(trabajos[id]);
}

export async function aprobarPedido(pedidoId, domicilio = null) {
  const p = pedidos.find((x) => x.id === pedidoId);
  p.estado = 'confirmado';
  if (domicilio) {
    p.domicilio_valor = domicilio.valor;
    p.total = domicilio.subtotal + domicilio.valor;
    p.domicilio_confirmado = { valor: domicilio.valor, por: sesionUid, en: new Date().toISOString() };
  }
  emitirPedidos();
  simularFunction(p);
}

export async function rechazarPedido(pedidoId) {
  const p = pedidos.find((x) => x.id === pedidoId);
  p.estado = 'rechazado';
  emitirPedidos();
}

// Solo demo: simula un pedido que llega desde la app del cliente.
export function demoPedidoApp() {
  const I = Object.fromEntries(MENU_ITEMS.map((i) => [i.id, i]));
  const G = Object.fromEntries(GRUPOS_OPCIONES.map((g) => [g.id, g]));
  const nombrar = (l, n) => ({ ...l, nombre_pantalla: n });
  const items = [
    nombrar(crearLinea(I.pizza_extragrande, G, { cantidad: 1, opciones: { sabores_pizza: ['hawaiana', 'pollo_bbq', 'mexicana'] }, modificadores: ['combo_gaseosa_15'] }), 'Pizza Extra Grande'),
    nombrar(crearLinea(I.salchipapas_mixta, G, { cantidad: 2 }), 'Salchipapa Mixta'),
    nombrar(crearLinea(I.panzerotti_panzerotti, G, { cantidad: 1, opciones: { sabor_panzerotti: ['carnes'] } }), 'Panzerotti'),
  ];
  const total = items.reduce((s, l) => s + l.total, 0);
  const p = {
    id: 'app' + Math.random().toString(36).slice(2, 7), estado: 'por_aprobar', origen: 'app', tipo_entrega: 'domicilio',
    cliente: { nombre: 'CARLOS PÉREZ', telefono: '3109998877', direccion: 'CARRERA 52#48-20, Santa María, Itagüí' },
    pago: { metodo: 'transferencia' }, domicilio: { tipo: 'PENDIENTE_INFORMAR' },
    items, subtotal: total, total, creado_en: new Date().toISOString(), impresion: {},
  };
  pedidos.unshift(p);
  emitirPedidos();
  // Simula la verificación de la nube (a veces encuentra un precio alterado).
  setTimeout(() => {
    const alterado = Math.random() < 0.5;
    p.verificacion = alterado
      ? { ok: false, total_app: total - 5000, total_verificado: total, avisos: ['1× Pizza Extra Grande: la app decía $82.500, el menú dice $87.500'] }
      : { ok: true, total_app: total, total_verificado: total, avisos: [] };
    emitirPedidos();
  }, 1800);
}

export async function obtenerTrabajo(pedidoId, zona) {
  return structuredClone(trabajos[`${pedidoId}_${zona}`] || null);
}

// Solo demo: cambiar el estado simulado de la impresora.
export function demoEstadoImpresora() {
  return impresoraDemo;
}
export function demoCambiarImpresora(estado) {
  const volvio = impresoraDemo === 'apagada' && estado !== 'apagada';
  impresoraDemo = estado;
  emitirImpresora();
  if (volvio) Object.values(trabajos).filter((t) => t.estado === 'pendiente').forEach(simularPuente);
}

// Demo: simula a Google (misma dirección → misma distancia; "xx" = no la encuentra).
import { DOMICILIO as DOM_DEMO, tarifaPorDistancia } from '@shared/domicilio.js';
export async function cotizarDomicilio({ direccion }) {
  await espera(700);
  if (/xx/i.test(direccion)) return { estado: 'no_encontrada' };
  const suma = [...direccion].reduce((s, c) => s + c.charCodeAt(0), 0);
  const km = Math.round(((suma % 62) / 10 + 0.3) * 10) / 10;
  const t = tarifaPorDistancia(km);
  return t ? { estado: 'ok', km, tarifa: t.tarifa, kmCobrados: t.kmCobrados, direccion_encontrada: `${direccion}, ${DOM_DEMO.ciudad} (demo)` } : { estado: 'fuera', km, maxKm: DOM_DEMO.maxKm };
}

export async function marcarEtapa(pedidoId, etapa) {
  await espera(250);
  const p = pedidos.find((x) => x.id === pedidoId);
  p.etapa = etapa;
  p.etapas = { ...(p.etapas || {}), [etapa]: new Date().toISOString() };
  emitirPedidos();
}

// ─── Mesas (demo) ───────────────────────────────────────────────────────
const mesas = {};
const subsMesas = new Set();
const emitirMesas = () => subsMesas.forEach((cb) => cb(structuredClone(mesas)));
export function escucharMesas(cb) {
  subsMesas.add(cb);
  cb(structuredClone(mesas));
  return () => subsMesas.delete(cb);
}
export async function crearPedidoMesa(pedido, mesa) {
  await espera(200);
  if (mesas[mesa]?.pedido_id) throw Object.assign(new Error(`La mesa ${mesa} acaba de ser tomada por otra persona.`), { code: 'mesa-ocupada' });
  const id = await crearPedido({ ...pedido, mesa });
  mesas[mesa] = { pedido_id: id, por: sesionUid, por_nombre: cuentas.get(sesionUid)?.displayName || '', desde: new Date().toISOString() };
  emitirMesas();
  return id;
}
export async function pasarMesa(mesa, { uid, nombre }) {
  await espera(200);
  mesas[mesa] = { ...mesas[mesa], por: uid, por_nombre: nombre };
  emitirMesas();
}
export async function liberarMesa(mesa) {
  await espera(200);
  mesas[mesa] = { pedido_id: null, por: null, por_nombre: '' };
  emitirMesas();
}
export async function listarEquipo() {
  return [...cuentas.values()].filter((u) => ['vendedora', 'cajero', 'admin'].includes(u.customClaims?.rol) && !u.disabled).map((u) => ({ uid: u.uid, nombre: u.displayName, rol: u.customClaims.rol }));
}
// Demo: otra vendedora (para probar mesas ocupadas por otros).
cuentas.set('vend2', { uid: 'vend2', email: `vendedora2@${RID}.app`, password: 'vende123', displayName: 'Lucía Gómez', disabled: false, customClaims: { rid: RID, rol: 'vendedora' }, metadata: {} });

// ─── Abrir / cerrar la app del cliente (demo) ────────────────────────────
let tienda = {};
const subsTienda = new Set();
export function escucharTienda(cb) {
  subsTienda.add(cb); setTimeout(() => cb(tienda), 30);
  return () => subsTienda.delete(cb);
}
export async function cambiarTienda(manual) {
  await espera(250);
  tienda = manual ? { manual: { ...manual, por: sesionUid, por_nombre: cuentas.get(sesionUid)?.displayName || '' } } : {};
  subsTienda.forEach((cb) => cb(tienda));
}
