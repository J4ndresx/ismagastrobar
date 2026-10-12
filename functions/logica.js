// Lógica de las Cloud Functions, separada de los triggers para poder probarla.
import { construirTrabajos, construirCuenta, claveDia, ZONAS_QUE_IMPRIMEN } from './shared/comandas.js';
import { vistaSeguimiento, tokenValido } from './shared/seguimiento.js';

/**
 * Asigna el número del día y crea un trabajo de impresión por zona.
 * Una sola transacción: si se ejecuta dos veces, la segunda sale sin hacer nada.
 * @returns {{numero:number, zonas:string[]}|null}
 */
export async function generarComandas(db, rid, pedidoId, { ahora = new Date(), serverTimestamp, vendedor = '' }) {
  const refRest = db.doc(`restaurantes/${rid}`);
  const refPedido = refRest.collection('pedidos').doc(pedidoId);
  const refContador = refRest.collection('contadores').doc('pedidos');

  return db.runTransaction(async (tx) => {
    const [snapPedido, snapContador] = await Promise.all([tx.get(refPedido), tx.get(refContador)]);
    const pedido = snapPedido.data();
    if (!pedido || pedido.estado !== 'confirmado' || pedido.comandas_generadas) return null;

    // Adición a una cuenta abierta: lleva el número de la cuenta y la comanda
    // sale marcada "ADICION n" con solo lo nuevo. No gasta número del día.
    const refPadre = pedido.adicion_de ? refRest.collection('pedidos').doc(pedido.adicion_de) : null;
    const padre = refPadre ? (await tx.get(refPadre)).data() : null;
    const esAdicion = !!(padre && padre.numero);

    const hoy = claveDia(ahora);
    const cont = snapContador.exists ? snapContador.data() : {};
    const numero = esAdicion ? padre.numero : cont.fecha === hoy ? (cont.ultimo || 0) + 1 : 1;
    const previas = esAdicion ? (padre.adiciones || []).filter((x) => x !== pedidoId) : [];
    const adicion = esAdicion ? previas.length + 1 : 0;

    const creadoISO = (pedido.creado_en?.toDate?.() || ahora).toISOString();
    const trabajos = construirTrabajos(pedidoId, pedido, numero, creadoISO, { vendedor, adicion });

    const impresion = {};
    for (const t of trabajos) {
      const { id, ...doc } = t;
      tx.set(refRest.collection('trabajos_impresion').doc(id), { ...doc, creado_en: serverTimestamp() });
      impresion[t.zona] = { estado: 'en_cola', impreso_en: null, error: null };
    }
    if (esAdicion) {
      const totalPadre = padre.total_cuenta ?? padre.total ?? 0;
      tx.update(refPadre, { adiciones: [...previas, pedidoId], total_cuenta: totalPadre + (pedido.total || 0) });
    } else {
      tx.set(refContador, { fecha: hoy, ultimo: numero }, { merge: true });
    }
    tx.update(refPedido, { numero, dia: hoy, comandas_generadas: true, zonas_impresion: trabajos.map((t) => t.zona), impresion, ...(esAdicion ? { adicion_n: adicion } : {}) });
    return { numero, adicion, zonas: trabajos.map((t) => t.zona) };
  });
}

/**
 * Copia el estado de un trabajo de impresión al pedido.
 *
 * Los eventos de Cloud Functions pueden llegar en desorden: "impreso" puede
 * procesarse antes que "imprimiendo", y el pedido quedaría pegado en
 * "Imprimiendo" aunque la comanda ya salió. Por eso NO se usa el dato del
 * evento: se lee el trabajo como está AHORA, dentro de una transacción, y
 * ese es el estado que se copia. El último en escribir siempre deja el
 * estado real.
 */
export async function reflejarEstado(db, rid, antes, despues) {
  if (antes.estado === despues.estado) return false;
  if (!ZONAS_QUE_IMPRIMEN.includes(despues.zona) && despues.zona !== 'cuenta') return false;
  const refTrabajo = db.doc(`restaurantes/${rid}/trabajos_impresion/${despues.pedido_id}_${despues.zona}`);
  const refPedido = db.doc(`restaurantes/${rid}/pedidos/${despues.pedido_id}`);
  return db.runTransaction(async (tx) => {
    const [st, sp] = await Promise.all([tx.get(refTrabajo), tx.get(refPedido)]);
    if (!st.exists || !sp.exists) return false;
    const t = st.data();
    tx.update(refPedido, {
      [t.zona === 'cuenta' ? 'cuenta' : `impresion.${t.zona}`]: {
        estado: t.estado === 'pendiente' ? 'en_cola' : t.estado,
        impreso_en: t.impreso_en || null,
        error: t.error || null,
        reimpresiones: t.reimpresiones || 0,
      },
    });
    return true;
  });
}

/**
 * Cuenta para cobrar: la vendedora sube `cuenta_solicitudes` (botón
 * "Imprimir cuenta") y aquí se crea el trabajo {pedidoId}_cuenta con los
 * precios del pedido guardado. `cuenta_impresas` evita imprimirla de más si
 * la función se ejecuta dos veces.
 */
export async function generarCuenta(db, rid, pedidoId, { serverTimestamp, vendedor = '' }) {
  const refRest = db.doc(`restaurantes/${rid}`);
  const refPedido = refRest.collection('pedidos').doc(pedidoId);
  return db.runTransaction(async (tx) => {
    const sp = await tx.get(refPedido);
    const pedido = sp.data();
    if (!pedido || pedido.estado !== 'confirmado') return null;
    const pedidas = pedido.cuenta_solicitudes || 0;
    const hechas = pedido.cuenta_impresas || 0;
    if (pedidas <= hechas) return null;
    // Cuenta abierta: suma lo de todas las adiciones en una sola lista.
    const adiciones = await Promise.all((pedido.adiciones || []).map((aid) => tx.get(refRest.collection('pedidos').doc(aid))));
    const extra = adiciones.map((s) => s.data()).filter((a) => a && a.estado === 'confirmado').flatMap((a) => a.items || []);
    const { id, ...trabajo } = construirCuenta(pedidoId, { ...pedido, items: [...(pedido.items || []), ...extra] }, { vendedor });
    tx.set(refRest.collection('trabajos_impresion').doc(id), {
      ...trabajo,
      pedido_creado_en: (pedido.creado_en?.toDate?.() || new Date()).toISOString(),
      estado: 'pendiente',
      intentos: 0,
      reimpresiones: hechas,
      creado_en: serverTimestamp(),
    });
    tx.update(refPedido, { cuenta_impresas: pedidas, cuenta: { estado: 'en_cola', impreso_en: null, error: null, reimpresiones: hechas } });
    return { total: trabajo.total };
  });
}

/**
 * Nombre corto para la comanda: el nombre del usuario (crear-usuario.mjs
 * --nombre=...) o, si no tiene, la parte del correo antes de la @.
 */
export function nombreCorto(usuario) {
  const n = (usuario?.displayName || usuario?.email?.split('@')[0] || '').trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
}

/**
 * Seguimiento del cliente: copia pública y recortada del pedido en
 * `seguimiento/{token}` (ver shared/seguimiento.js). Solo escribe si algo
 * de lo que ve el cliente cambió.
 */
export async function espejoSeguimiento(db, rid, antes, despues) {
  const token = despues?.seguimiento_token;
  if (!tokenValido(token)) return false;
  const nueva = vistaSeguimiento(despues);
  if (antes && JSON.stringify(vistaSeguimiento(antes)) === JSON.stringify(nueva)) return false;
  await db.doc(`restaurantes/${rid}/seguimiento/${token}`).set({ ...nueva, actualizado: new Date().toISOString() });
  return true;
}
