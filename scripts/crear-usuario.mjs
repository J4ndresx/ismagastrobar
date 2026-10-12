// Crea un usuario (o actualiza su clave, rol y nombre) con los custom claims { rid, rol }.
//   node crear-usuario.mjs <email> <contraseña> <admin|cajero|vendedora|impresora> [--nombre=Carlos] [rid]
// El nombre es el que sale en la comanda ("Atiende: Carlos"). Si no se da,
// se usa la parte del correo antes de la @.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const nombre = args.find((a) => a.startsWith('--nombre='))?.slice(9).trim();
const [email, password, rol, rid = 'isma'] = args.filter((a) => !a.startsWith('--'));
if (!email || !password || !['admin', 'cajero', 'vendedora', 'impresora'].includes(rol)) {
  console.error('Uso: node crear-usuario.mjs <email> <contraseña> <admin|cajero|vendedora|impresora> [--nombre=Carlos] [rid]');
  process.exit(1);
}
initializeApp(process.env.GCLOUD_PROJECT ? { projectId: process.env.GCLOUD_PROJECT } : undefined);
const auth = getAuth();
const datos = { password, ...(nombre ? { displayName: nombre } : {}) };
let user;
try {
  user = await auth.getUserByEmail(email);
  user = await auth.updateUser(user.uid, datos);
} catch {
  user = await auth.createUser({ email, ...datos });
}
await auth.setCustomUserClaims(user.uid, { rid, rol });
// Perfil para el módulo Usuarios del POS (la clave la eligió quien corre el script: no se obliga a cambiarla).
if (rol !== 'impresora') {
  const [n = '', ...a] = (user.displayName || email.split('@')[0]).split(' ');
  await getFirestore().doc(`restaurantes/${rid}/usuarios/${user.uid}`).set(
    { nombre: n, apellido: a.join(' '), usuario: email.split('@')[0], email, rol, activo: true, debe_cambiar_clave: false },
    { merge: true },
  );
}
console.log(`✔ ${email} → rol "${rol}" en ${rid}${user.displayName ? ` · nombre en comanda: ${user.displayName}` : ''}`);
