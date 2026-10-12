// Pruebas de la administración de usuarios con Auth y Firestore falsos.
import assert from 'node:assert/strict';
import { gestionarUsuarios } from '../usuarios.js';

function fakeAuth(iniciales = []) {
  const users = new Map(iniciales.map((u) => [u.uid, { disabled: false, metadata: {}, ...u }]));
  let n = 0;
  return {
    users,
    revocados: [],
    async getUser(uid) { if (!users.has(uid)) throw Object.assign(new Error('no'), { code: 'auth/user-not-found' }); return structuredClone(users.get(uid)); },
    async listUsers() { return { users: [...users.values()].map((u) => structuredClone(u)) }; },
    async createUser({ email, password, displayName }) {
      if ([...users.values()].some((u) => u.email === email)) throw Object.assign(new Error('x'), { code: 'auth/email-already-exists' });
      const uid = `u${++n}`;
      users.set(uid, { uid, email, password, displayName, disabled: false, customClaims: {}, metadata: {} });
      return { uid };
    },
    async setCustomUserClaims(uid, c) { users.get(uid).customClaims = c; },
    async updateUser(uid, cambios) { Object.assign(users.get(uid), cambios); return structuredClone(users.get(uid)); },
    async revokeRefreshTokens(uid) { this.revocados.push(uid); },
    async deleteUser(uid) { users.delete(uid); },
  };
}
function fakeDb() {
  const data = new Map();
  return {
    data,
    collection: (path) => ({
      doc: (id) => ({
        set: async (v, o) => data.set(`${path}/${id}`, o?.merge ? { ...(data.get(`${path}/${id}`) || {}), ...v } : v),
      }),
      get: async () => ({ docs: [...data.entries()].filter(([k]) => k.startsWith(path + '/')).map(([k, v]) => ({ id: k.slice(path.length + 1), data: () => v })) }),
    }),
  };
}

const base = () => fakeAuth([
  { uid: 'admin1', email: 'james@panzzerotty.app', displayName: 'James Álvarez', customClaims: { rid: 'panzzerotty', rol: 'admin' } },
  { uid: 'vend1', email: 'vendedora@panzzerotty.app', displayName: 'Pepita Perez', customClaims: { rid: 'panzzerotty', rol: 'vendedora' } },
  { uid: 'imp', email: 'impresora@panzzerotty.app', customClaims: { rid: 'panzzerotty', rol: 'impresora' } },
  { uid: 'otro', email: 'x@otro.app', customClaims: { rid: 'otro', rol: 'vendedora' } },
]);
const admin = { uid: 'admin1', token: { rid: 'panzzerotty', rol: 'admin' } };
const ctx = (auth, db, llamador = admin) => ({ auth, db, llamador });
const rechaza = async (p, codigo) => { await assert.rejects(p, (e) => { assert.equal(e.codigo, codigo, e.message); return true; }); };

let pruebas = 0;
const prueba = async (nombre, fn) => { await fn(); pruebas++; console.log('✔', nombre); };

await prueba('solo un administrador puede usarlo', async () => {
  const auth = base(), db = fakeDb();
  await rechaza(gestionarUsuarios(ctx(auth, db, { uid: 'vend1', token: { rid: 'panzzerotty', rol: 'vendedora' } }), { accion: 'listar' }), 'permission-denied');
  await rechaza(gestionarUsuarios(ctx(auth, db, null), { accion: 'listar' }), 'permission-denied');
});

await prueba('listar: solo usuarios de este restaurante', async () => {
  const r = await gestionarUsuarios(ctx(base(), fakeDb()), { accion: 'listar' });
  assert.deepEqual(r.usuarios.map((u) => u.uid).sort(), ['admin1', 'imp', 'vend1']);
  assert.equal(r.usuarios.find((u) => u.uid === 'imp').sistema, true);
});

await prueba('crear: nombre y apellido quedan como nombre en la comanda y pide cambiar la clave', async () => {
  const auth = base(), db = fakeDb();
  const r = await gestionarUsuarios(ctx(auth, db), { accion: 'crear', nombre: 'carlos', apellido: 'pérez', usuario: 'Carlos.Perez', clave: 'Panz1234', rol: 'vendedora' });
  const u = auth.users.get(r.uid);
  assert.equal(u.email, 'carlos.perez@panzzerotty.app');
  assert.equal(u.displayName, 'Carlos Pérez');
  assert.deepEqual(u.customClaims, { rid: 'panzzerotty', rol: 'vendedora' });
  assert.equal(db.data.get(`restaurantes/panzzerotty/usuarios/${r.uid}`).debe_cambiar_clave, true);
  await rechaza(gestionarUsuarios(ctx(auth, db), { accion: 'crear', nombre: 'Otro', apellido: 'Carlos', usuario: 'carlos.perez', clave: 'Panz1234', rol: 'vendedora' }), 'already-exists');
  await rechaza(gestionarUsuarios(ctx(auth, db), { accion: 'crear', nombre: 'A', apellido: 'B', usuario: 'ab', clave: '123', rol: 'vendedora' }), 'invalid-argument');
  await rechaza(gestionarUsuarios(ctx(auth, db), { accion: 'crear', nombre: 'Ana', apellido: 'Gómez', usuario: 'ana.gomez', clave: '123456', rol: 'impresora' }), 'invalid-argument');
});

await prueba('desactivar: cierra sesiones; no a uno mismo ni al último admin; la impresora no se toca', async () => {
  const auth = base(), db = fakeDb();
  await gestionarUsuarios(ctx(auth, db), { accion: 'estado', uid: 'vend1', activo: false });
  assert.equal(auth.users.get('vend1').disabled, true);
  assert.ok(auth.revocados.includes('vend1'));
  assert.equal(db.data.get('restaurantes/panzzerotty/usuarios/vend1').activo, false);
  await gestionarUsuarios(ctx(auth, db), { accion: 'estado', uid: 'vend1', activo: true });
  assert.equal(auth.users.get('vend1').disabled, false);
  await rechaza(gestionarUsuarios(ctx(auth, db), { accion: 'estado', uid: 'admin1', activo: false }), 'failed-precondition');
  await rechaza(gestionarUsuarios(ctx(auth, db), { accion: 'estado', uid: 'imp', activo: false }), 'failed-precondition');
  await rechaza(gestionarUsuarios(ctx(auth, db), { accion: 'eliminar', uid: 'otro' }), 'not-found');
});

await prueba('editar: cambia el nombre de la comanda y el rol; no deja el restaurante sin admin', async () => {
  const auth = base(), db = fakeDb();
  await gestionarUsuarios(ctx(auth, db), { accion: 'editar', uid: 'vend1', nombre: 'Pepita', apellido: 'Gómez', rol: 'cajero' });
  assert.equal(auth.users.get('vend1').displayName, 'Pepita Gómez');
  assert.equal(auth.users.get('vend1').customClaims.rol, 'cajero');
  await rechaza(gestionarUsuarios(ctx(auth, db), { accion: 'editar', uid: 'admin1', nombre: 'James', apellido: 'A', rol: 'vendedora' }), 'invalid-argument'); // apellido corto
  await rechaza(gestionarUsuarios(ctx(auth, db), { accion: 'editar', uid: 'admin1', nombre: 'James', apellido: 'Álvarez', rol: 'vendedora' }), 'failed-precondition');
});

await prueba('restablecer clave: vuelve a pedir el cambio en el próximo ingreso', async () => {
  const auth = base(), db = fakeDb();
  await gestionarUsuarios(ctx(auth, db), { accion: 'restablecer', uid: 'vend1', clave: 'Nueva123' });
  assert.equal(auth.users.get('vend1').password, 'Nueva123');
  assert.equal(db.data.get('restaurantes/panzzerotty/usuarios/vend1').debe_cambiar_clave, true);
});

await prueba('eliminar: borra la cuenta; no a uno mismo', async () => {
  const auth = base(), db = fakeDb();
  await gestionarUsuarios(ctx(auth, db), { accion: 'eliminar', uid: 'vend1' });
  assert.ok(!auth.users.has('vend1'));
  assert.equal(db.data.get('restaurantes/panzzerotty/usuarios/vend1').eliminado, true);
  await rechaza(gestionarUsuarios(ctx(auth, db), { accion: 'eliminar', uid: 'admin1' }), 'failed-precondition');
});

console.log(`\n${pruebas} pruebas de usuarios OK`);
