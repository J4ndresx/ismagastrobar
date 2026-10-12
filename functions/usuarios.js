// Administración de usuarios del restaurante (solo rol admin).
//
// Se llama desde el POS con la función `gestionarUsuarios` (callable).
// Cuentas en Firebase Auth con custom claims { rid, rol } y, en Firestore,
// restaurantes/{rid}/usuarios/{uid} con nombre, apellido y la marca
// `debe_cambiar_clave` (el POS obliga a cambiar la clave en el primer ingreso).
//
// La lógica recibe `auth` y `db` por parámetro para poder probarla sin Firebase.

export const ROLES = {
  vendedora: 'Vendedor / Mesero',
  cajero: 'Cajero',
  admin: 'Administrador',
};

export class ErrorUsuario extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo; // códigos de HttpsError: permission-denied, invalid-argument, not-found, already-exists, failed-precondition
  }
}
const fallo = (codigo, mensaje) => { throw new ErrorUsuario(codigo, mensaje); };

const limpiar = (s, max = 40) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
const validarNombre = (s, campo) => {
  const v = limpiar(s);
  if (v.length < 2) fallo('invalid-argument', `Escribe el ${campo}.`);
  return v.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
};
const validarClave = (c) => {
  if (typeof c !== 'string' || c.length < 6) fallo('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
  if (c.length > 64) fallo('invalid-argument', 'La contraseña es demasiado larga.');
  return c;
};
const validarRol = (r) => {
  if (!ROLES[r]) fallo('invalid-argument', 'Rol no válido.');
  return r;
};
const validarUsuario = (u) => {
  const v = String(u || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(v)) fallo('invalid-argument', 'El usuario debe tener de 3 a 30 letras o números (sin tildes ni espacios). Ej: carlos.perez');
  return v;
};

/**
 * @param {object} ctx { auth, db, llamador: { uid, token }, ahora }
 * @param {object} data { accion, ... }
 */
export async function gestionarUsuarios({ auth, db, llamador, ahora = new Date() }, data = {}) {
  const token = llamador?.token || {};
  if (!llamador?.uid || token.rol !== 'admin' || !token.rid) fallo('permission-denied', 'Solo un administrador puede gestionar usuarios.');
  const rid = token.rid;
  const col = db.collection(`restaurantes/${rid}/usuarios`);

  // Usuario del mismo restaurante que se puede administrar (la cuenta de la impresora no).
  const objetivo = async (uid) => {
    if (!uid || typeof uid !== 'string') fallo('invalid-argument', 'Falta el usuario.');
    let u;
    try { u = await auth.getUser(uid); } catch { fallo('not-found', 'Ese usuario ya no existe.'); }
    if (u.customClaims?.rid !== rid) fallo('not-found', 'Ese usuario no es de este restaurante.');
    if (u.customClaims?.rol === 'impresora') fallo('failed-precondition', 'La cuenta de la impresora no se administra desde aquí.');
    return u;
  };
  const listarAuth = async () => {
    const todos = [];
    let pagina;
    do {
      const r = await auth.listUsers(1000, pagina);
      todos.push(...r.users);
      pagina = r.pageToken;
    } while (pagina);
    return todos.filter((u) => u.customClaims?.rid === rid);
  };
  // Nunca dejar el restaurante sin un administrador activo.
  const exigirOtroAdmin = async (uid) => {
    const admins = (await listarAuth()).filter((u) => u.customClaims?.rol === 'admin' && !u.disabled && u.uid !== uid);
    if (!admins.length) fallo('failed-precondition', 'Debe quedar al menos un administrador activo.');
  };
  const noEsUnoMismo = (uid, que) => { if (uid === llamador.uid) fallo('failed-precondition', `No puedes ${que} tu propia cuenta.`); };

  switch (data.accion) {
    case 'listar': {
      const [usuarios, docs] = await Promise.all([listarAuth(), col.get()]);
      const perfiles = Object.fromEntries(docs.docs.map((d) => [d.id, d.data()]));
      return {
        usuarios: usuarios
          .map((u) => {
            const p = perfiles[u.uid] || {};
            return {
              uid: u.uid,
              email: u.email,
              usuario: p.usuario || (u.email || '').split('@')[0],
              nombre: p.nombre || u.displayName || '',
              apellido: p.apellido || '',
              nombre_completo: u.displayName || [p.nombre, p.apellido].filter(Boolean).join(' '),
              rol: u.customClaims?.rol || '',
              activo: !u.disabled,
              debe_cambiar_clave: !!p.debe_cambiar_clave,
              ultimo_ingreso: u.metadata?.lastSignInTime || null,
              creado: u.metadata?.creationTime || null,
              sistema: u.customClaims?.rol === 'impresora',
              yo: u.uid === llamador.uid,
            };
          })
          .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre_completo.localeCompare(b.nombre_completo)),
      };
    }

    case 'crear': {
      const nombre = validarNombre(data.nombre, 'nombre');
      const apellido = validarNombre(data.apellido, 'apellido');
      const usuario = validarUsuario(data.usuario);
      const clave = validarClave(data.clave);
      const rol = validarRol(data.rol);
      const email = `${usuario}@${rid}.app`;
      let u;
      try {
        u = await auth.createUser({ email, password: clave, displayName: `${nombre} ${apellido}` });
      } catch (e) {
        if (String(e.code || e.message).includes('email-already-exists')) fallo('already-exists', `Ya existe el usuario "${usuario}". Elige otro.`);
        throw e;
      }
      await auth.setCustomUserClaims(u.uid, { rid, rol });
      await col.doc(u.uid).set({ nombre, apellido, usuario, email, rol, activo: true, debe_cambiar_clave: true, creado_en: ahora, creado_por: llamador.uid });
      return { uid: u.uid, usuario, email };
    }

    case 'editar': {
      const u = await objetivo(data.uid);
      const nombre = validarNombre(data.nombre, 'nombre');
      const apellido = validarNombre(data.apellido, 'apellido');
      const rol = validarRol(data.rol);
      const rolAntes = u.customClaims?.rol;
      if (rol !== rolAntes) {
        noEsUnoMismo(u.uid, 'cambiar el rol de');
        if (rolAntes === 'admin') await exigirOtroAdmin(u.uid);
        await auth.setCustomUserClaims(u.uid, { rid, rol });
        await auth.revokeRefreshTokens(u.uid); // el nuevo rol aplica al volver a entrar
      }
      await auth.updateUser(u.uid, { displayName: `${nombre} ${apellido}` });
      await col.doc(u.uid).set({ nombre, apellido, rol, usuario: (u.email || '').split('@')[0], email: u.email }, { merge: true });
      return { ok: true };
    }

    case 'estado': {
      const u = await objetivo(data.uid);
      const activo = !!data.activo;
      if (!activo) {
        noEsUnoMismo(u.uid, 'desactivar');
        if (u.customClaims?.rol === 'admin') await exigirOtroAdmin(u.uid);
      }
      await auth.updateUser(u.uid, { disabled: !activo });
      if (!activo) await auth.revokeRefreshTokens(u.uid);
      await col.doc(u.uid).set({ activo }, { merge: true }); // el POS abierto de esa persona se cierra solo
      return { ok: true };
    }

    case 'restablecer': {
      const u = await objetivo(data.uid);
      const clave = validarClave(data.clave);
      await auth.updateUser(u.uid, { password: clave });
      await auth.revokeRefreshTokens(u.uid);
      await col.doc(u.uid).set({ debe_cambiar_clave: true }, { merge: true });
      return { ok: true };
    }

    case 'eliminar': {
      const u = await objetivo(data.uid);
      noEsUnoMismo(u.uid, 'eliminar');
      if (u.customClaims?.rol === 'admin') await exigirOtroAdmin(u.uid);
      // Primero se marca (el POS abierto de esa persona se cierra), luego se borra la cuenta.
      await col.doc(u.uid).set({ activo: false, eliminado: true, eliminado_en: ahora }, { merge: true });
      await auth.deleteUser(u.uid);
      return { ok: true };
    }

    default:
      fallo('invalid-argument', 'Acción no válida.');
  }
}
