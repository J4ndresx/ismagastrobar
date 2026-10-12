// Puente de impresión — corre en el PC del mostrador.
//
// Escucha restaurantes/{rid}/trabajos_impresion con estado "pendiente",
// imprime cada comanda en la impresora térmica (ESC/POS) y marca el
// resultado. La Cloud Function `reflejarImpresion` copia ese estado al
// pedido, y la vendedora lo ve en su pantalla.
//
// Uso:
//   node puente.js            → servicio normal
//   node puente.js --prueba   → imprime un ticket de prueba (sin Firebase)
//   node puente.js --estado   → muestra cómo ve Windows la impresora (papel, en línea, cola)
//   node puente.js --verificar → solo revisa que la clave del usuario impresora
//                                sirva (no imprime ni toma comandas)
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, doc, query, where, onSnapshot, runTransaction,
  updateDoc, setDoc, getDocs, serverTimestamp, disableNetwork, enableNetwork,
} from 'firebase/firestore';
import { bloquesTicket, ticketTexto, ZONAS } from './shared/comandas.js';
import { aEscPos } from './escpos.js';
import { enviar } from './transportes.js';
import { leerEstado, diagnosticar, verificarSalida, vaciarCola } from './colaWindows.js';
import { VERSION_PUENTE } from './shared/version.js';
import { fileURLToPath } from 'node:url';
import { crearLog, crearCortes, vigilarPausas } from './registro.js';
import { crearReconector } from './reconexion.js';

const VERSION = VERSION_PUENTE; // se cambia en shared/version.js
const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const imp = cfg.impresora;
// Todo lo que sale en la ventana queda también en registro\puente-AAAA-MM-DD.log
const log = crearLog(fileURLToPath(new URL('../registro', import.meta.url)));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Vigilancia de la cola de Windows ─────────────────────────────────
// Solo en modo "windows". Se puede apagar con "vigilar_cola": false en config.json.
//  - ANTES de imprimir: si la impresora no está lista (sin papel, apagada…),
//    las comandas NO se tocan: se quedan "en cola" y salen solas cuando se
//    arregle. Nada que reimprimir.
//  - DESPUÉS de enviar: si la comanda se queda atascada en Windows, se saca
//    de la cola y se marca ERROR con el motivo (la vendedora usa "Reimprimir").
const vigilaCola = imp.modo === 'windows' && imp.vigilar_cola !== false;
class ErrorDefinitivo extends Error {} // no tiene sentido reintentar
let bloqueo = null; // motivo por el que la impresora no puede imprimir ahora
let avisarBloqueo = () => {};

/** null si se puede imprimir; si no, el motivo en palabras simples. */
async function problemaActual() {
  if (!vigilaCola) return null;
  let e;
  try { e = await leerEstado(imp.compartida); } catch (err) { log('No se pudo leer la cola de Windows:', err.message); return null; }
  const d = diagnosticar(e);
  if (d.estado === 'atascada') {
    // Restos viejos en la cola de Windows: se limpian para no bloquear.
    log('Limpiando comandas viejas atascadas en Windows');
    await vaciarCola(e.nombre).catch(() => {});
    return null;
  }
  return d.estado === 'lista' ? null : d.texto;
}

async function revisarDespues() {
  if (!vigilaCola) return;
  let r;
  try { r = await verificarSalida(imp.compartida); } catch (err) { log('No se pudo verificar la cola de Windows:', err.message); return; }
  if (r.ok) return;
  // Se saca de la cola: si no, saldría sola (y doble) cuando arreglen la impresora.
  await vaciarCola(r.impresora).catch(() => {});
  throw new ErrorDefinitivo(r.motivo);
}

// ─── Imprimir un trabajo (con reintentos locales) ──────────────────────
export async function imprimirTrabajo(trabajo, { intentos = 3 } = {}) {
  const bloques = bloquesTicket(trabajo, { ancho: imp.ancho || 48 });
  const datos = aEscPos(bloques, { ancho: imp.ancho || 48, codepage: imp.codepage || 'cp850', cortar: imp.cortar !== false, pitido: !!imp.pitido });
  const textoPlano = ticketTexto(trabajo, { ancho: imp.ancho || 48 });
  let ultimoError;
  for (let i = 1; i <= intentos; i++) {
    try {
      await enviar(imp, datos, { textoPlano, nombre: `${String(trabajo.numero).padStart(3, '0')}-${trabajo.zona}` });
      await revisarDespues();
      return;
    } catch (e) {
      if (e instanceof ErrorDefinitivo) throw e;
      ultimoError = e;
      log(`Intento ${i}/${intentos} falló: ${e.message}`);
      if (i < intentos) await esperar(2000 * i);
    }
  }
  throw ultimoError;
}

// ─── Modo prueba ───────────────────────────────────────────────────────
if (process.argv.includes('--prueba')) {
  const prueba = {
    titulo: 'PRUEBA', zona: 'prueba', numero: 0, pedido_creado_en: new Date().toISOString(), tipo_entrega: 'mesa',
    cliente: 'Impresora OK', vendedor: 'Prueba', reimpresiones: 0, otras_zonas: [],
    lineas: [{ cantidad: 1, nombre_comanda: 'PIZZA MEDIUM', detalles: ['- Hawaiana', '- Pollo Champiñones', '+ Borde de queso', '* Tildes: áéíóú ñ Ñ ¿¡'] }],
  };
  problemaActual()
    .then((p) => { if (p) throw new Error(p); return imprimirTrabajo(prueba, { intentos: 1 }); })
    .then(() => { log('OK - el ticket de prueba salio de la cola de Windows'); process.exit(0); })
    .catch((e) => { log('ERROR:', e.message); process.exit(1); });
} else if (process.argv.includes('--estado')) {
  // Diagnóstico de la impresora en Windows (no imprime ni se conecta a Firebase).
  //   node puente.js --estado                 → la impresora de config.json (POS80)
  //   node puente.js --estado "Nombre impresora"
  const i = process.argv.indexOf('--estado');
  const nombre = process.argv[i + 1] || imp.compartida;
  leerEstado(nombre)
    .then((e) => {
      const d = diagnosticar(e);
      log(`Impresora "${nombre}": ${d.texto} (${d.estado})`);
      if (e.existe) log(`Windows dice: estado=${e.estado}, sin conexion=${e.sinConexion}, comandas en cola=${e.trabajos.length}`);
      process.exit(0);
    })
    .catch((e) => { log('ERROR leyendo el estado en Windows:', e.message); process.exit(1); });
} else if (process.argv.includes('--verificar')) {
  const app = initializeApp(cfg.firebase);
  signInWithEmailAndPassword(getAuth(app), cfg.cuenta.email, cfg.cuenta.password)
    .then(() => { log(`OK - la clave de ${cfg.cuenta.email} es correcta. El paquete esta listo.`); process.exit(0); })
    .catch((e) => { log(`ERROR - no se pudo entrar como ${cfg.cuenta.email}: ${e.code || e.message}`); process.exit(1); });
} else {
  iniciar().catch((e) => { log('ERROR FATAL:', e.message); process.exit(1); });
}

// ─── Servicio ──────────────────────────────────────────────────────────
async function iniciar() {
  const app = initializeApp(cfg.firebase);
  await signInWithEmailAndPassword(getAuth(app), cfg.cuenta.email, cfg.cuenta.password);
  const db = getFirestore(app);
  const base = `restaurantes/${cfg.rid}`;
  const colTrabajos = collection(db, `${base}/trabajos_impresion`);
  log(`Puente ${VERSION} conectado - restaurante ${cfg.rid} - impresora "${imp.nombre}" (${imp.modo})`);
  log('No cierres esta ventana: mientras este abierta, las comandas se imprimen solas.');

  // Latido: la vendedora ve "Impresora conectada" mientras esto corra.
  // Además reporta cómo está la impresora (papel, encendida, en línea) para que
  // el POS lo muestre aunque no haya comandas imprimiéndose, y los cortes del
  // día (pausas, internet, impresora) para poder revisar qué pasó.
  const cortes = crearCortes();
  let estadoAnterior = '';
  let impresoraMalDesde = null;
  let sinRedDesde = null;
  const min = (ms) => Math.max(1, Math.round(ms / 60_000));
  // Sin internet: forzar un intento cada 15 s para reconectar apenas vuelva.
  const reconector = crearReconector({ desactivar: () => disableNetwork(db), activar: () => enableNetwork(db), log });
  const latido = async () => {
    let fisica = { estado: 'desconocido', texto: '' };
    if (vigilaCola) {
      try { fisica = diagnosticar(await leerEstado(imp.compartida)); } catch { /* sin PowerShell: se deja "desconocido" */ }
      if (fisica.estado !== estadoAnterior && fisica.estado !== 'lista') log(`Impresora: ${fisica.texto}`);
      if (fisica.estado === 'lista' && estadoAnterior && estadoAnterior !== 'lista') log('Impresora: lista de nuevo');
      if (fisica.estado !== 'lista' && fisica.estado !== 'desconocido' && !impresoraMalDesde) impresoraMalDesde = { t: Date.now(), texto: fisica.texto };
      if (fisica.estado === 'lista' && impresoraMalDesde) { cortes.agregar('impresora', impresoraMalDesde.t, Date.now(), impresoraMalDesde.texto); impresoraMalDesde = null; }
      estadoAnterior = fisica.estado;
    }
    const { dia, lista } = cortes.hoy();
    const t0 = Date.now();
    // Si la nube no confirma en 20 s, no hay internet (el latido queda esperando y sale solo cuando vuelva).
    const alarma = setTimeout(() => {
      if (sinRedDesde) return;
      sinRedDesde = t0;
      log('AVISO: sin conexion con la nube (internet o Wi-Fi). Las comandas llegan cuando vuelva.');
      reconector.iniciar();
    }, 20_000);
    try {
      await setDoc(doc(db, `${base}/impresoras/${imp.id}`), {
        nombre: imp.nombre, modo: imp.modo, version: VERSION, ultimo_latido: serverTimestamp(),
        impresora_estado: fisica.estado, impresora_detalle: fisica.texto,
        cortes_dia: dia, cortes: lista,
      }, { merge: true });
    } catch (e) {
      log('Latido fallo:', e.message);
    } finally {
      clearTimeout(alarma);
    }
    if (sinRedDesde) {
      const desde = sinRedDesde;
      sinRedDesde = null;
      reconector.detener();
      cortes.agregar('internet', desde, Date.now());
      log(`Conexion con la nube de nuevo (estuvo caida ${min(Date.now() - desde)} min)`);
      latido(); // sube el corte al POS
    }
  };
  // Pausas: el PC se suspendió, o alguien hizo clic dentro de esta ventana (se congela hasta presionar Enter/Esc).
  vigilarPausas((desde, hasta) => {
    log(`AVISO: el puente estuvo detenido ${min(hasta - desde)} min. Causa probable: el PC se suspendio o se hizo clic dentro de esta ventana.`);
    cortes.agregar('pausa', desde, hasta);
    reconector.ahora().finally(() => latido()); // al despertar, reconectar de una vez
  });
  await latido();
  setInterval(latido, 30_000);

  // Trabajos que quedaron a medias si el PC se apagó mientras imprimía:
  // no se reimprimen solos (podrían salir dobles); se marcan para que la
  // vendedora decida con "Reimprimir".
  const colgados = await getDocs(query(colTrabajos, where('estado', '==', 'imprimiendo'), where('impresora_id', '==', imp.id)));
  for (const d of colgados.docs) {
    await updateDoc(d.ref, { estado: 'error', error: 'Impresión interrumpida. Verifica si salió y reimprime.' });
    log(`Trabajo ${d.id} interrumpido -> marcado como error`);
  }

  // Cola en orden: por hora del pedido y, dentro del pedido, pizzería antes que cocina.
  let cola = Promise.resolve();
  const enCurso = new Set();
  const encolar = (docs) => {
    const nuevos = docs
      .filter((d) => !enCurso.has(d.id))
      .sort((a, b) => {
        const x = a.data(), y = b.data();
        return (x.pedido_creado_en || '').localeCompare(y.pedido_creado_en || '') || (ZONAS[x.zona]?.orden ?? 9) - (ZONAS[y.zona]?.orden ?? 9);
      });
    for (const d of nuevos) {
      enCurso.add(d.id);
      cola = cola.then(() => procesar(db, d.ref)).catch((e) => log('Error procesando:', e.message)).finally(() => enCurso.delete(d.id));
    }
  };
  onSnapshot(query(colTrabajos, where('estado', '==', 'pendiente')), (snap) => encolar(snap.docs), (e) => log('Error escuchando la cola:', e.message));

  // Impresora no lista: las comandas esperan. Cada 10 s se revisa; apenas
  // quede lista, se imprimen las que estaban esperando.
  setInterval(async () => {
    if (!bloqueo) return;
    if (await problemaActual()) return;
    bloqueo = null;
    log('Impresora lista: imprimiendo las comandas en espera');
    latido();
    encolar((await getDocs(query(colTrabajos, where('estado', '==', 'pendiente')))).docs);
  }, 10_000);
  avisarBloqueo = () => latido();
}

async function procesar(db, ref) {
  // Si la impresora no está lista, la comanda NO se toca: sigue "en cola".
  const problema = await problemaActual();
  if (problema) {
    if (bloqueo !== problema) {
      log(`Impresora no lista (${problema}). Las comandas esperan y salen solas cuando se arregle.`);
      bloqueo = problema;
      avisarBloqueo();
    }
    return;
  }
  // Reclamar el trabajo en una transacción: si hubiera dos puentes, solo uno imprime.
  const trabajo = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists() || s.data().estado !== 'pendiente') return null;
    tx.update(ref, { estado: 'imprimiendo', impresora_id: imp.id, intentos: (s.data().intentos || 0) + 1 });
    return s.data();
  });
  if (!trabajo) return;

  try {
    await imprimirTrabajo(trabajo);
    await updateDoc(ref, { estado: 'impreso', impreso_en: serverTimestamp(), error: null });
    log(`OK     #${String(trabajo.numero).padStart(3, '0')} ${trabajo.titulo}${trabajo.reimpresiones ? ' (reimpresion)' : ''}`);
  } catch (e) {
    await updateDoc(ref, { estado: 'error', error: e.message });
    log(`ERROR  #${String(trabajo.numero).padStart(3, '0')} ${trabajo.titulo}: ${e.message}`);
  }
}
