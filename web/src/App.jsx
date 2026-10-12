import { useEffect, useRef, useState } from 'react';
import * as api from './data/api';
import TomarPedido from './components/TomarPedido';
import PedidosApp from './components/PedidosApp';
import ControlTienda from './components/ControlTienda';
import MenuDelDia from './components/MenuDelDia';
import Agotados from './components/Agotados';
import PedidosHoy from './components/PedidosHoy';
import Shell from './components/Shell';
import Usuarios, { ROLES } from './components/Usuarios';
import CambiarClave from './components/CambiarClave';
import { IconCheck } from './components/ui';
import { VERSION_PUENTE, compararVersion } from '@shared/version.js';
import { calcularDomicilio, valorDomicilio, textoDireccion, conjuntoPorId, normalizarDireccion } from './lib/domicilio';

// Qué pantallas ve cada rol.
const PERMISOS = {
  vendedora: ['tomar', 'pedidos'], // "Mis pedidos": solo los que ella tomó
  cajero: ['tomar', 'app', 'pedidos'],
  admin: ['tomar', 'app', 'pedidos', 'menu_dia', 'agotados', 'usuarios'], // menú del día y agotados: solo el dueño
};

const DATOS_VACIOS = { tipo_entrega: 'llevar', nombre: '', telefono: '', direccion: '', zona: '', unidad: '', barrio: '', domicilio_manual: '', cuenta_id: '', mesa: null };
// Mesas del local (tablero en Tomar Pedido).
export const NUM_MESAS = 11;
// Cuenta abierta: mesa y para llevar tomados en el POS (domicilios y pedidos de la app no).
const ABRE_CUENTA = ['mesa', 'llevar'];

// La cuenta para cobrar necesita el puente 1.1.0 o más nuevo (el que sabe imprimir precios).
const puenteSoportaCuenta = (v) => compararVersion(v, '1.1.0') >= 0;
// Estados físicos que reporta el puente (1.3.0+) cuando la impresora no puede imprimir.
const PROBLEMAS = { sin_papel: 'Sin papel', tapa_abierta: 'Tapa abierta', apagada: 'Impresora apagada', sin_conexion: 'Impresora sin conexión', pausada: 'Impresora en pausa', error: 'Impresora con error', no_encontrada: 'Impresora no encontrada', atascada: 'Comandas atascadas' };

export default function App() {
  const [sesion, setSesion] = useState(undefined);
  const [perfil, setPerfil] = useState(undefined);
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [menu, setMenu] = useState(null);
  const [vista, setVista] = useState('tomar');
  const [lineas, setLineas] = useState([]);
  const [datos, setDatos] = useState(DATOS_VACIOS);
  const [pedidosHoy, setPedidos] = useState([]);
  const [abiertasAntes, setAbiertasAntes] = useState([]);
  const [mesas, setMesas] = useState({}); // n → { pedido_id, por, por_nombre } // cuentas abiertas de días anteriores
  const [impresora, setImpresora] = useState(null);
  const [ultimoId, setUltimoId] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [domCalc, setDomCalc] = useState(null); // domicilio calculado (conjunto / distancia)
  const [calculandoDom, setCalculandoDom] = useState(false);
  const [, forzar] = useState(0);

  useEffect(() => api.escucharSesion(setSesion), []);
  // Domicilio: se calcula solo al elegir conjunto o al terminar de escribir la dirección.
  useEffect(() => {
    if (datos.tipo_entrega !== 'domicilio' || !datos.zona) { setDomCalc(null); setCalculandoDom(false); return; }
    let vigente = true;
    setCalculandoDom(true);
    const t = setTimeout(async () => {
      const r = await calcularDomicilio(datos, api.cotizarDomicilio);
      if (vigente) { setDomCalc(r); setCalculandoDom(false); }
    }, datos.zona === 'otra' ? 900 : 0);
    return () => { vigente = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.tipo_entrega, datos.zona, datos.direccion, datos.barrio]);
  useEffect(() => {
    setPerfil(undefined);
    if (!sesion) return;
    return api.escucharPerfil(sesion.uid, setPerfil);
  }, [sesion?.uid]);
  // Si el admin desactiva o elimina la cuenta, la sesión abierta se cierra sola.
  useEffect(() => {
    if (perfil && (perfil.activo === false || perfil.eliminado)) api.cerrarSesion();
  }, [perfil]);
  useEffect(() => {
    if (!sesion || perfil === undefined || perfil?.debe_cambiar_clave) return;
    const subs = [api.escucharMenu(setMenu), api.escucharPedidosHoy(setPedidos), api.escucharCuentasAbiertas(setAbiertasAntes), api.escucharMesas(setMesas), api.escucharImpresora(setImpresora)];
    const reloj = setInterval(() => forzar((n) => n + 1), 15_000); // refresca "desconectada hace…"
    return () => { subs.forEach((u) => u()); clearInterval(reloj); };
  }, [sesion, perfil?.debe_cambiar_clave, perfil === undefined]);

  // Pedidos de hoy + cuentas que siguen abiertas desde antes de medianoche.
  const idsHoy = new Set(pedidosHoy.map((p) => p.id));
  const pedidos = [...pedidosHoy, ...abiertasAntes.filter((p) => !idsHoy.has(p.id))];
  const cuentasAbiertas = pedidos.filter((p) => p.cobro?.estado === 'abierta' && p.numero && p.estado === 'confirmado').sort((a, b) => a.numero - b.numero);
  const cuentaSel = datos.cuenta_id ? cuentasAbiertas.find((p) => p.id === datos.cuenta_id) : null;
  // Si la cuenta elegida se cobra mientras se arma la adición, se suelta.
  useEffect(() => {
    if (datos.cuenta_id && pedidos.length && !cuentaSel) setDatos((d) => ({ ...d, cuenta_id: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.cuenta_id, !!cuentaSel, pedidos.length]);

  // Aviso de pedido nuevo de la app (caja / admin): sonido + título de la pestaña.
  const idsPorAprobar = pedidos.filter((p) => p.estado === 'por_aprobar').map((p) => p.id);
  const conocidos = useRef(null);
  useEffect(() => {
    const avisa = ['cajero', 'admin'].includes(sesion?.rol);
    const nuevos = conocidos.current ? idsPorAprobar.filter((id) => !conocidos.current.has(id)) : [];
    conocidos.current = new Set(idsPorAprobar);
    if (avisa && nuevos.length) sonarAviso();
    document.title = avisa && idsPorAprobar.length ? `(${idsPorAprobar.length}) Nuevo pedido · ISMA POS` : 'ISMA POS';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsPorAprobar.join(','), sesion?.rol]);

  if (sesion === undefined) return null;
  if (!sesion) return <Login />;
  const permitidas = PERMISOS[sesion.rol] || [];
  if (!permitidas.length) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-6 text-center">
        <div className="card max-w-sm space-y-3 p-6">
          <p className="text-[15px] font-semibold">Esta cuenta no tiene acceso al panel.</p>
          <button onClick={api.cerrarSesion} className="btn-secondary w-full">Cerrar sesión</button>
        </div>
      </div>
    );
  }
  if (perfil === undefined) return <div className="grid min-h-screen place-items-center text-[14px] text-zinc-500">Cargando…</div>;
  if (perfil?.debe_cambiar_clave) {
    return <CambiarClave obligatorio nombre={sesion.nombre} onCambiar={api.cambiarClave} onSalir={api.cerrarSesion} />;
  }
  if (!menu) return <div className="grid min-h-screen place-items-center text-[14px] text-zinc-500">Cargando menú…</div>;

  const segundos = impresora?.ultimo_latido ? (Date.now() - impresora.ultimo_latido.getTime()) / 1000 : Infinity;
  const puenteVivo = segundos < 100; // latido cada 30 s; margen por si Windows tarda en responder
  const problema = puenteVivo ? PROBLEMAS[impresora?.impresora_estado] : null;
  const impresoraOk = puenteVivo && !problema;
  const actualizacionPendiente = sesion.rol === 'admin' && impresora?.version && compararVersion(impresora.version, VERSION_PUENTE) < 0;
  // El vendedor ve solo sus pedidos (y las adiciones a sus cuentas); cajero y admin ven todos.
  const esVendedor = sesion.rol === 'vendedora';
  const esCaja = ['cajero', 'admin'].includes(sesion.rol);
  // Quién atiende: en una mesa ocupada manda el bloqueo de la mesa (se puede pasar a otro); si no, quien lo creó.
  const atiende = (p) => (p.mesa && mesas[p.mesa]?.pedido_id === p.id ? mesas[p.mesa].por : p.creado_por);
  const puedeAgregar = (p) => esCaja || !p.mesa || atiende(p) === sesion.uid;
  const propios = new Set(pedidos.filter((p) => atiende(p) === sesion.uid).map((p) => p.id));
  const visibles = esVendedor ? pedidos.filter((p) => propios.has(p.id) || propios.has(p.adicion_de)) : pedidos;
  const visiblesLocal = visibles.filter((p) => p.origen !== 'app');
  const pedidosApp = pedidos.filter((p) => p.origen === 'app');
  const errores = visiblesLocal.filter((p) => Object.values(p.impresion || {}).some((i) => i.estado === 'error')).length;
  const ultimoPedido = pedidos.find((p) => p.id === ultimoId);
  const porAprobar = esVendedor ? 0 : pedidos.filter((p) => p.estado === 'por_aprobar').length;
  const puede = (v) => permitidas.includes(v);
  const vistaActual = puede(vista) ? vista : 'tomar';

  const dom = valorDomicilio(datos, domCalc);
  const enviar = async () => {
    const subtotal = lineas.reduce((s, l) => s + l.total, 0);
    const esDomicilio = datos.tipo_entrega === 'domicilio';
    const conjunto = esDomicilio && datos.zona !== 'otra' ? conjuntoPorId(datos.zona) : null;
    if (cuentaSel) {
      // Adición a una cuenta abierta: la comanda sale solo con lo nuevo y la cuenta suma todo.
      const id = await api.crearPedido({
        tipo_entrega: cuentaSel.tipo_entrega,
        ...(cuentaSel.mesa ? { mesa: cuentaSel.mesa } : {}),
        cliente: { nombre: cuentaSel.cliente?.nombre || '', telefono: cuentaSel.cliente?.telefono || '', direccion: '' },
        adicion_de: cuentaSel.id,
        items: lineas.map(({ uid, ...l }) => l),
        subtotal,
        domicilio_valor: 0,
        total: subtotal,
      });
      setUltimoId(id);
      setLineas([]);
      setDatos(DATOS_VACIOS);
      setAviso(cuentaSel.mesa ? `Adición enviada a la Mesa ${cuentaSel.mesa}` : `Adición enviada a la cuenta #${String(cuentaSel.numero).padStart(3, '0')}`);
      setTimeout(() => setAviso(null), 2500);
      return;
    }
    if (datos.tipo_entrega === 'mesa' && !datos.mesa) throw new Error('Elige la mesa.');
    const crear = datos.tipo_entrega === 'mesa' ? (p) => api.crearPedidoMesa(p, datos.mesa) : api.crearPedido;
    const id = await crear({
      tipo_entrega: datos.tipo_entrega,
      ...(ABRE_CUENTA.includes(datos.tipo_entrega) ? { cobro: { estado: 'abierta' } } : {}),
      cliente: { nombre: datos.nombre.trim().toUpperCase(), telefono: datos.telefono, direccion: esDomicilio ? textoDireccion(datos) : '' },
      ...(esDomicilio
        ? {
            direccion_detalle: {
              ...(conjunto ? { conjuntoId: conjunto.id, conjunto: conjunto.nombre } : {}),
              unidad: datos.unidad.trim(),
              nomenclatura: normalizarDireccion(datos.direccion),
              barrio: datos.barrio.trim(),
              ciudad: 'Bogotá',
            },
            domicilio: dom.domicilio,
          }
        : {}),
      items: lineas.map(({ uid, ...l }) => l),
      subtotal,
      domicilio_valor: dom.valor,
      total: subtotal + dom.valor,
    });
    setUltimoId(id);
    setLineas([]);
    setDatos(DATOS_VACIOS);
    setAviso(datos.tipo_entrega === 'mesa' ? `Mesa ${datos.mesa} abierta · pedido enviado` : 'Pedido enviado a cocina');
    setTimeout(() => setAviso(null), 2500);
  };

  const textoImpresora = problema || (impresoraOk ? 'Impresora conectada' : impresora ? `Desconectada hace ${Math.max(1, Math.round(segundos / 60))} min` : 'Impresora sin configurar');
  const titulos = {
    tomar: ['Tomar Pedido', 'Registra un pedido en el local'],
    app: ['Pedidos App', porAprobar ? `${porAprobar} por aprobar · revísalos primero` : 'Pedidos que llegan desde la app del cliente'],
    pedidos: esVendedor ? ['Mis pedidos', 'Tus pedidos de hoy · agrega productos a tus cuentas abiertas'] : ['Pedidos del local', 'Mesa, para llevar y domicilios tomados en el punto de venta'],
    menu_dia: ['Menú del Día', 'Elige la sopa, la proteína, la ensalada y la bebida de hoy · los clientes lo ven al instante'],
    agotados: ['Agotados', 'Marca lo que se acabó · desaparece de la app del cliente'],
    usuarios: ['Usuarios', 'Cuentas del equipo: crear, desactivar y restablecer contraseñas'],
  };

  return (
    <Shell
      vista={vistaActual}
      setVista={setVista}
      permitidas={permitidas}
      etiquetas={esVendedor ? { pedidos: 'Mis pedidos' } : {}}
      titulo={titulos[vistaActual][0]}
      subtitulo={titulos[vistaActual][1]}
      busqueda={busqueda}
      setBusqueda={vistaActual === 'tomar' ? setBusqueda : null}
      notificaciones={porAprobar + errores}
      onNotificaciones={puede('pedidos') ? () => setVista(porAprobar && puede('app') ? 'app' : 'pedidos') : null}
      usuario={{ nombre: sesion.nombre, email: sesion.email, usuario: (sesion.email || '').split('@')[0], rolNombre: ROLES.find((r) => r.id === sesion.rol)?.nombre }}
      onCambiarClave={() => setCambiandoClave(true)}
      onSalir={api.cerrarSesion}
      impresoraOk={impresoraOk}
      textoImpresora={textoImpresora}
      badges={{ app: porAprobar, pedidos: errores }}
      extraAbajo={
        <>
          {api.MODO_DEMO && <DemoImpresora />}
          {puede('app') && <ControlTienda />}
          {puede('app') && <CortesImpresora impresora={impresora} />}
          {actualizacionPendiente && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-900">
              <p className="font-bold uppercase tracking-wide">Actualización pendiente</p>
              <p className="mt-0.5">El PC del mostrador tiene el puente <b>{impresora.version}</b>; la versión nueva es <b>{VERSION_PUENTE}</b>. Instala la actualización de la impresora.</p>
            </div>
          )}
        </>
      }
    >
      {porAprobar > 0 && vistaActual === 'tomar' && puede('app') && (
        <button onClick={() => setVista('app')} className="flex w-full items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-[13.5px] font-bold text-amber-950 hover:bg-amber-300">
          <span className="h-2 w-2 animate-pulso rounded-full bg-amber-950" />
          {porAprobar} pedido{porAprobar > 1 ? 's' : ''} de la app por aprobar · Revisar
        </button>
      )}

      {vistaActual === 'tomar' ? (
        <TomarPedido
          menu={menu}
          lineas={lineas}
          setLineas={setLineas}
          datos={datos}
          setDatos={setDatos}
          domicilio={{ calculado: domCalc, calculando: calculandoDom, ...dom }}
          cuentasAbiertas={cuentasAbiertas}
          cuentaSel={cuentaSel}
          tablero={{ total: NUM_MESAS, mesas, pedidos: cuentasAbiertas, uid: sesion.uid, esCaja, liberar: esCaja ? api.liberarMesa : null }}
          onEnviar={enviar}
          impresoraOk={impresoraOk}
          ultimoPedido={ultimoPedido}
          irAPedidos={puede('pedidos') ? () => setVista('pedidos') : null}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
        />
      ) : vistaActual === 'menu_dia' ? (
        <MenuDelDia />
      ) : vistaActual === 'agotados' ? (
        <Agotados />
      ) : vistaActual === 'usuarios' ? (
        <Usuarios api={api} />
      ) : vistaActual === 'app' ? (
        <PedidosApp pedidos={pedidosApp} aprobar={api.aprobarPedido} rechazar={api.rechazarPedido} marcarEtapa={api.marcarEtapa} reimprimir={api.reimprimir} obtenerTrabajo={api.obtenerTrabajo} pedirCuenta={api.pedirCuenta} cuentaDisponible={puenteSoportaCuenta(impresora?.version)} />
      ) : (
        <PedidosHoy
          pedidos={visiblesLocal}
          onAgregar={(p) => { if (lineas.length && !window.confirm('Hay productos sin enviar en Tomar Pedido. ¿Descartarlos para agregar a esta cuenta?')) return; setLineas([]); setDatos({ ...DATOS_VACIOS, tipo_entrega: p.tipo_entrega, nombre: p.cliente?.nombre || '', cuenta_id: p.id, mesa: p.mesa || null }); setVista('tomar'); }}
          puedeAgregar={puedeAgregar}
          mesas={mesas}
          pasarMesa={esCaja ? api.pasarMesa : null}
          liberarMesa={esCaja ? api.liberarMesa : null}
          listarEquipo={api.listarEquipo}
          cobrar={esCaja ? (id, a) => { const p = pedidos.find((x) => x.id === id); return api.cobrar(id, { ...a, liberarMesa: p?.mesa && mesas[p.mesa]?.pedido_id === id ? p.mesa : null }); } : null}
          marcarEtapa={api.marcarEtapa}
          reimprimir={api.reimprimir} obtenerTrabajo={api.obtenerTrabajo} pedirCuenta={api.pedirCuenta} cuentaDisponible={puenteSoportaCuenta(impresora?.version)} aprobar={api.aprobarPedido} rechazar={api.rechazarPedido} />
      )}

      {cambiandoClave && <CambiarClave onCambiar={api.cambiarClave} onCerrar={() => setCambiandoClave(false)} />}

      {aviso && (
        <div className="fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-pop animate-rise">
          <IconCheck className="h-4 w-4" strokeWidth={3} /> {aviso}
        </div>
      )}
    </Shell>
  );
}

function DemoImpresora() {
  const [estado, setEstado] = useState(api.demoEstadoImpresora?.() || 'ok');
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 p-2.5">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-violet-700">Solo demo</p>
      <button onClick={() => api.demoPedidoApp()} className="w-full rounded-lg bg-white px-2.5 py-2 text-[12.5px] font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50">+ Simular pedido de la app</button>
      <label className="flex items-center justify-between gap-2 text-[12px] text-slate-600">
        Impresora
        <select value={estado} onChange={(e) => { setEstado(e.target.value); api.demoCambiarImpresora(e.target.value); }} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[12px] font-semibold outline-none">
          <option value="ok">OK</option>
          <option value="sin_papel">Sin papel</option>
          <option value="apagada">PC apagado</option>
        </select>
      </label>
    </div>
  );
}

function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-zinc-50 px-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setEntrando(true);
          try {
            await api.iniciarSesion(usuario, password);
          } catch (err) {
            setError(
              err.code === 'auth/user-disabled' ? 'Tu cuenta está desactivada. Habla con el administrador.'
              : err.code === 'auth/too-many-requests' ? 'Demasiados intentos. Espera unos minutos.'
              : err.code === 'auth/network-request-failed' ? 'Sin conexión a internet.'
              : 'Usuario o contraseña incorrectos.'
            );
          } finally {
            setEntrando(false);
          }
        }}
        className="card w-full max-w-sm space-y-4 p-6"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-[18px] font-black text-white">J</span>
          <div>
            <p className="text-[16px] font-bold">ISMA POS</p>
            <p className="text-[13px] text-zinc-500">Toma de pedidos</p>
          </div>
        </div>
        <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Usuario (ej: carlos.perez)" className="field" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="field" autoComplete="current-password" />
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <button disabled={entrando || !usuario || !password} className="btn-primary w-full">{entrando ? 'Entrando…' : 'Entrar'}</button>
        {api.MODO_DEMO && <p className="rounded-lg bg-violet-50 px-3 py-2 text-[12px] text-violet-700">Demo: <b>admin</b> / admin123 · <b>vendedora</b> / vende123</p>}
      </form>
    </div>
  );
}

/** "Ding" corto con el navegador (sin archivos de audio). */
function sonarAviso() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.4);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch { /* sin audio */ }
}

// Cortes del día que reporta el puente (1.6.1+): para saber qué pasó sin entrar por AnyDesk.
const TIPO_CORTE = { pausa: 'PC suspendido o ventana pausada', internet: 'Sin internet', impresora: 'Impresora' };
function CortesImpresora({ impresora }) {
  const hoy = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  const lista = impresora?.cortes_dia === hoy ? impresora.cortes || [] : [];
  if (!lista.length) return null;
  return (
    <details className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
      <summary className="cursor-pointer font-bold">Cortes de hoy: {lista.length}</summary>
      <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
        {[...lista].reverse().map((c, i) => (
          <li key={i} className="leading-snug">
            <b>{c.hora}</b> · {c.minutos} min · {TIPO_CORTE[c.tipo] || c.tipo}{c.detalle ? ` (${c.detalle})` : ''}
          </li>
        ))}
      </ul>
    </details>
  );
}
