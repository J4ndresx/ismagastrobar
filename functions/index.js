// Cloud Functions — ISMA GASTRO-BAR
//
// prepararComandas: cuando un pedido queda "confirmado", le asigna el número
//   del día y crea un trabajo de impresión por cada zona que imprime
//   (pizzería, cocina). La zona "general" no imprime.
// reflejarImpresion: copia el estado de cada trabajo (impreso / error) al
//   pedido, para que la vendedora lo vea en tiempo real.
//
// La lógica está en ./logica.js (con pruebas en ./test). La carpeta ./shared
// se copia desde ../shared antes de desplegar (firebase.json → predeploy).
import { onDocumentWritten, onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { generarComandas, generarCuenta, reflejarEstado, nombreCorto, espejoSeguimiento } from './logica.js';
import { gestionarUsuarios as logicaUsuarios, ErrorUsuario } from './usuarios.js';
import { cotizarDomicilio as logicaDomicilio, geocodificadorGoogle } from './domicilio.js';
import { RID } from './shared/menu.seed.js';
import { aplicarMenuDelDia, MDD_DOC } from './shared/menuDelDia.js';
import { verificarPedidoApp } from './verificarPedido.js';

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: 'us-east1', maxInstances: 10 });

export const prepararComandas = onDocumentWritten('restaurantes/{rid}/pedidos/{pedidoId}', async (event) => {
  const datos = event.data?.after?.exists ? event.data.after.data() : null;
  if (!datos || datos.estado !== 'confirmado') return;
  const { rid, pedidoId } = event.params;
  const faltanComandas = !datos.comandas_generadas;
  const faltaCuenta = (datos.cuenta_solicitudes || 0) > (datos.cuenta_impresas || 0);
  if (!faltanComandas && !faltaCuenta) return;
  // Quién atiende: el que aceptó el pedido de la app o el que lo tomó en el POS.
  // Se toma de la cuenta en Firebase Auth (no del pedido), así nadie puede
  // poner un nombre ajeno.
  const vendedor = await nombreDe(datos.aprobado_por || datos.creado_por);
  if (faltanComandas) {
    const r = await generarComandas(db, rid, pedidoId, { serverTimestamp: FieldValue.serverTimestamp, vendedor });
    if (r) logger.info(`Pedido ${pedidoId} → #${r.numero}, comandas: ${r.zonas.join(', ') || 'ninguna'}`);
  }
  if (faltaCuenta) {
    const c = await generarCuenta(db, rid, pedidoId, { serverTimestamp: FieldValue.serverTimestamp, vendedor });
    if (c) logger.info(`Pedido ${pedidoId} → cuenta por ${c.total}`);
  }
});

// Se consulta en cada pedido (sin caché) para que un cambio de nombre
// con crear-usuario.mjs se vea de inmediato en la siguiente comanda.
async function nombreDe(uid) {
  if (!uid) return '';
  try {
    return nombreCorto(await getAuth().getUser(uid));
  } catch (e) {
    logger.warn(`No se pudo leer el usuario ${uid}: ${e.message}`);
    return '';
  }
}

export const reflejarImpresion = onDocumentUpdated('restaurantes/{rid}/trabajos_impresion/{trabajoId}', async (event) => {
  await reflejarEstado(db, event.params.rid, event.data.before.data(), event.data.after.data());
});

// Módulo "Usuarios" del POS (solo administradores): crear, editar,
// activar/desactivar, restablecer clave y eliminar cuentas del restaurante.
export const gestionarUsuarios = onCall(async (req) => {
  try {
    return await logicaUsuarios({ auth: getAuth(), db, llamador: req.auth }, req.data);
  } catch (e) {
    if (e instanceof ErrorUsuario) throw new HttpsError(e.codigo, e.message);
    logger.error('gestionarUsuarios', e);
    throw new HttpsError('internal', 'No se pudo completar la acción. Intenta de nuevo.');
  }
});

// Valor del domicilio para la app del cliente: ubica la dirección con Google
// (la clave queda guardada en Secret Manager, nunca llega al navegador) y
// calcula la tarifa con shared/domicilio.js.
//   firebase functions:secrets:set GOOGLE_MAPS_KEY
const GOOGLE_MAPS_KEY = defineSecret('GOOGLE_MAPS_KEY');
const consultasPorIp = new Map();
const LIMITE_IP = 20; // consultas cada 10 minutos por IP (protege el cupo de Google)

export const cotizarDomicilio = onCall({ secrets: [GOOGLE_MAPS_KEY], maxInstances: 5 }, async (req) => {
  // El límite por IP es para la app pública; el personal del POS (con sesión) no lo tiene.
  if (!req.auth?.token?.rid) {
    const ip = req.rawRequest?.ip || 'desconocida';
    const ahora = Date.now();
    const recientes = (consultasPorIp.get(ip) || []).filter((t) => ahora - t < 10 * 60_000);
    if (recientes.length >= LIMITE_IP) throw new HttpsError('resource-exhausted', 'Demasiadas consultas. Espera unos minutos.');
    consultasPorIp.set(ip, [...recientes, ahora]);
  }

  const cache = db.collection(`restaurantes/${RID}/geocache`);
  try {
    return await logicaDomicilio(req.data, {
      geocodificar: geocodificadorGoogle(GOOGLE_MAPS_KEY.value()),
      cache: {
        get: async (k) => { const s = await cache.doc(k).get(); return s.exists ? s.data().resultado : null; },
        set: (k, resultado) => cache.doc(k).set({ resultado, creado_en: FieldValue.serverTimestamp() }),
      },
    });
  } catch (e) {
    logger.error('cotizarDomicilio', e);
    // La app trata este caso como "domicilio por confirmar": el pedido no se bloquea.
    return { estado: 'no_encontrada', motivo: 'error' };
  }
});

// Seguridad de precios: cuando entra un pedido de la app, la nube vuelve a
// calcular cada línea con el menú real y el domicilio con las reglas de
// shared/domicilio.js. Lo del servidor reemplaza lo que mandó el celular y
// las diferencias quedan en `verificacion` para que la vendedora las vea.
let menuCache = { hasta: 0, rid: null, menu: null };
async function menuActual(rid) {
  const base = db.doc(`restaurantes/${rid}`);
  // Productos y opciones: caché de 60 s. El Menú del Día se lee SIEMPRE fresco (1 lectura):
  // el dueño lo cambia en cualquier momento y el cliente ya lo vio en vivo.
  if (!(menuCache.rid === rid && menuCache.hasta > Date.now())) {
    const [items, grupos] = await Promise.all([base.collection('menu_items').get(), base.collection('grupos_opciones').get()]);
    menuCache = {
      hasta: Date.now() + 60_000,
      rid,
      menu: {
        items: Object.fromEntries(items.docs.map((d) => [d.id, d.data()])),
        grupos: Object.fromEntries(grupos.docs.map((d) => [d.id, d.data()])),
      },
    };
  }
  const mdd = await base.collection('menu_del_dia').doc(MDD_DOC).get();
  return aplicarMenuDelDia(menuCache.menu, mdd.exists ? mdd.data() : null);
}

export const verificarPedido = onDocumentCreated({ document: 'restaurantes/{rid}/pedidos/{pedidoId}', secrets: [GOOGLE_MAPS_KEY] }, async (event) => {
  const pedido = event.data?.data();
  if (!pedido || pedido.origen !== 'app') return;
  const { rid, pedidoId } = event.params;
  const ref = db.doc(`restaurantes/${rid}/pedidos/${pedidoId}`);
  try {
    const cache = db.collection(`restaurantes/${rid}/geocache`);
    const cotizar = (datos) => logicaDomicilio(datos, {
      geocodificar: geocodificadorGoogle(GOOGLE_MAPS_KEY.value()),
      cache: {
        get: async (k) => { const s = await cache.doc(k).get(); return s.exists ? s.data().resultado : null; },
        set: (k, resultado) => cache.doc(k).set({ resultado, creado_en: FieldValue.serverTimestamp() }),
      },
    }).catch(() => null);
    const { cambios, verificacion } = await verificarPedidoApp(pedido, { menu: await menuActual(rid), cotizar });
    await ref.update({ ...cambios, verificacion: { ...verificacion, en: FieldValue.serverTimestamp() } });
    if (!verificacion.ok) logger.warn(`Pedido ${pedidoId}: ${verificacion.avisos.join(' | ')}`);
  } catch (e) {
    logger.error('verificarPedido', e);
    await ref.update({ verificacion: { ok: false, avisos: ['No se pudo verificar el pedido: revisa precios antes de aceptar'], error: true, en: FieldValue.serverTimestamp() } }).catch(() => {});
  }
});

// Seguimiento del pedido para el cliente de la app: mantiene la copia
// pública `seguimiento/{token}` (sin teléfono ni dirección).
export const reflejarSeguimiento = onDocumentWritten('restaurantes/{rid}/pedidos/{pedidoId}', async (event) => {
  const antes = event.data?.before?.exists ? event.data.before.data() : null;
  const despues = event.data?.after?.exists ? event.data.after.data() : null;
  if (!despues) return;
  await espejoSeguimiento(db, event.params.rid, antes, despues);
});
