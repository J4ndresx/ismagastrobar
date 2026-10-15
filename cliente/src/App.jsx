import { useEffect, useMemo, useRef, useState } from 'react';
import { crearLinea, resumenLinea } from '@shared/comandas.js';
import PizzaWizard, { esTamanoPizza } from './components/PizzaWizard';
import CarritoContenido from './components/Carrito';
import Home from './components/Home';
import VistaCategoria from './components/VistaCategoria';
import { SheetCategorias, FilaProducto, IconSearch } from './components/Menu';
import ProductoSheet from './components/ProductoSheet';
import CompletarDatosCliente from './components/CompletarDatosCliente';
import { NEGOCIO } from './config/negocio';
import { escucharMenu, crearPedido, escucharTienda } from './services/backend';
import { estadoTienda, cuandoTexto, horaTexto, HORARIO } from '@shared/tienda.js';
import { recordarCliente } from './services/clienteLocal';
import { guardarCarrito, recuperarCarrito } from './services/carritoLocal';
import Seguimiento, { useSeguimiento } from './components/Seguimiento';
import { generarToken, tokenValido, vistaSeguimiento } from '@shared/seguimiento.js';
import { leerActivos, guardarActivo, enlaceSeguimiento } from './services/pedidosActivos';
import { AvisoCookies, PoliticaCookies } from './components/AvisoCookies';
import { PoliticaDatos } from './components/PoliticaDatos';
import { Pista, Globo, apagarGuia, reiniciarGuia, marcarVista } from './components/Guia';
import { armarMensajePedido, linkWhatsApp } from './utils/whatsapp';
import { formatCOP } from './utils/formato';
import { Sheet, Badge, IconBag, IconPlus, IconCheck, IconWhatsApp, IconChevronRight, IconX } from './components/ui';

const USA_NOMBRE = new Set(['menu_del_dia', 'tradicional', 'proteinas', 'a_la_carta', 'picadas', 'bebidas', 'adicionales', 'parrilla_especiales']);
const titulo = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
function nombreCliente(item) {
  if (USA_NOMBRE.has(item.categoria_id)) return item.nombre;
  return titulo(item.nombre_comanda).replace(/^Hamb Art /, 'Hamburguesa Artesanal ').replace(/^Hamb /, 'Hamburguesa ').replace(/^Perro /, 'Hot Dog ');
}
const normalizar = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Abierta / cerrada (horario + lo que marque el restaurante en el POS). Se revisa cada 20 s. */
function useTienda() {
  const [config, setConfig] = useState(null);
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => escucharTienda(setConfig), []);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 20_000); return () => clearInterval(t); }, []);
  if (config === null) return { abierta: true, cargando: true }; // mientras carga, no bloquear la vista
  const e = estadoTienda(config, ahora);
  return { ...e, aviso: e.abierta ? '' : `Volvemos a recibir pedidos ${cuandoTexto(e.hasta, ahora)}` }; // termina en "a. m." / "p. m."
}
const HORARIO_TEXTO = (() => { const d = new Date(Date.UTC(2026, 0, 1, 5)); const a = d.getTime() + HORARIO.abre * 60000, c = d.getTime() + HORARIO.cierra * 60000; return `${horaTexto(a)} a ${horaTexto(c)}`; })();

const clave = (l) => `${l.item_id}|${JSON.stringify(l.opciones.map((o) => o.valores))}|${l.modificadores.map((m) => m.id).join(',')}|${(l.sin || []).join(',')}|${l.nota}`;

export default function App() {
  const [menu, setMenu] = useState(null);
  const [legal, setLegal] = useState(null); // 'cookies' | 'datos' | null
  const [error, setError] = useState('');
  const [vista, setVista] = useState('menu');
  const [activa, setActiva] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [verCategorias, setVerCategorias] = useState(false);
  // Categoría abierta (lista de productos). null = Home (cuadrícula de categorías).
  const [catAbierta, setCatAbierta] = useState(null);
  const [verArriba, setVerArriba] = useState(false);
  // Botón "volver al inicio": aparece después de bajar un poco por el menú.
  useEffect(() => {
    const revisar = () => setVerArriba(window.scrollY > 700);
    revisar();
    window.addEventListener('scroll', revisar, { passive: true });
    return () => window.removeEventListener('scroll', revisar);
  }, []);
  const [wizard, setWizard] = useState({ abierto: false, tamano: null });
  const [producto, setProducto] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [verCarrito, setVerCarrito] = useState(false);
  const [toast, setToast] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(null);
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const tienda = useTienda();
  // Seguimiento: ?pedido=<código> abre directo la línea de tiempo.
  const [seguir, setSeguir] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('pedido');
    return tokenValido(t) ? t : null;
  });
  const abrirSeguimiento = (t) => { window.history.replaceState(null, '', `?pedido=${t}`); setSeguir(t); window.scrollTo(0, 0); };
  const cerrarSeguimiento = () => { window.history.replaceState(null, '', window.location.pathname); setSeguir(null); setConfirmado(null); setVista('menu'); };

  useEffect(() => {
    return escucharMenu(setMenu, () => setError('No pudimos cargar el menú. Revisa tu conexión.'));
  }, []);

  const raices = useMemo(() => (menu ? menu.categorias.filter((c) => !c.parent_id && menu.items.some((i) => i.categoria_id === c.id)).sort((a, b) => a.orden - b.orden) : []), [menu]);
  // Primera categoría visible como activa (el Menú del Día solo aparece cuando está publicado).
  useEffect(() => { if (activa === null && raices[0]) setActiva(raices[0].id); }, [raices, activa]);
  const conteo = useMemo(() => {
    const n = {};
    menu?.items.forEach((i) => (n[i.categoria_id] = (n[i.categoria_id] || 0) + 1));
    return n;
  }, [menu]);
  const bloquesDe = (catId) => {
    const items = menu.items.filter((i) => i.categoria_id === catId).sort((a, b) => a.orden - b.orden);
    const tamanos = items.filter(esTamanoPizza);
    const otros = items.filter((i) => !esTamanoPizza(i));
    const subs = menu.categorias.filter((c) => c.parent_id === catId).sort((a, b) => a.orden - b.orden);
    const grupos = subs.length
      ? subs.map((sc) => ({ id: sc.id, nombre: sc.nombre, items: otros.filter((i) => i.subcategoria_id === sc.id) }))
      : [{ id: null, nombre: tamanos.length && otros.length ? 'Especiales' : '', items: otros }];
    return { tamanos, grupos: grupos.filter((g) => g.items.length) };
  };

  // Botón/gesto "atrás" del celular: vuelve de la lista de productos a la Home (no cierra la app).
  useEffect(() => {
    const alVolver = (e) => { setCatAbierta(e.state?.isma_cat || null); window.scrollTo(0, 0); };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  // Abrir una categoría (desde la Home): pantalla propia con "Volver al inicio".
  const irA = (id) => {
    setVerCategorias(false);
    setBusqueda('');
    setActiva(id);
    setCatAbierta(id);
    if (window.history.state?.isma_cat) window.history.replaceState({ isma_cat: id }, '');
    else window.history.pushState({ isma_cat: id }, '');
    window.scrollTo(0, 0);
  };
  const volverInicio = () => {
    if (window.history.state?.isma_cat) window.history.back(); // el popstate cierra la categoría
    else { setCatAbierta(null); window.scrollTo(0, 0); }
  };
  const irADatos = () => { setVerCarrito(false); setCheckoutAbierto(true); setVista('datos'); window.scrollTo(0, 0); };
  const subtotal = carrito.reduce((s, l) => s + l.total, 0);
  const unidades = carrito.reduce((s, l) => s + l.cantidad, 0);

  // Línea del carrito; guarda también la selección (sel) para poder rearmarla si la página se recarga.
  const armarLinea = (item, sel) => {
    const nueva = crearLinea(item, menu.grupos, sel);
    const nombre = nombreCliente(item);
    const resumen = resumenLinea(nueva);
    return { ...nueva, sel, uid: String(Math.random()), nombre_pantalla: nombre, descripcion: resumen ? `${nombre} · ${resumen}` : nombre };
  };

  // Pedido en armado: se recupera al cargar el menú y se guarda en cada cambio.
  const carritoListo = useRef(false);
  useEffect(() => {
    if (!menu || carritoListo.current) return;
    carritoListo.current = true;
    const { lineas, perdidas } = recuperarCarrito(menu, armarLinea);
    if (lineas.length) {
      setCarrito(lineas);
      setToast(perdidas ? 'Recuperamos tu pedido. Algunos productos ya no están disponibles.' : 'Recuperamos tu pedido');
      setTimeout(() => setToast(''), 3500);
    }
  }, [menu]);
  useEffect(() => {
    if (carritoListo.current) guardarCarrito(carrito);
  }, [carrito]);

  // El menú cambia en vivo (Menú del Día, agotados): lo que ya no se pueda pedir sale del carrito, con aviso.
  useEffect(() => {
    if (!menu || !carritoListo.current) return;
    setCarrito((c) => {
      const vigentes = c.filter((l) => {
        const item = menu.items.find((i) => i.id === l.item_id);
        if (!item || !l.sel) return false;
        try { crearLinea(item, menu.grupos, { ...l.sel, cantidad: l.cantidad }); return true; } catch { return false; }
      });
      if (vigentes.length === c.length) return c;
      setToast('El menú cambió: quitamos de tu pedido lo que ya no está disponible.');
      setTimeout(() => setToast(''), 4000);
      return vigentes;
    });
  }, [menu]);

  const agregar = (item, sel) => {
    marcarVista('menu'); // ya sabe agregar: se quita la pista del menú
    const linea = armarLinea(item, sel);
    setCarrito((c) => {
      const ex = c.find((l) => clave(l) === clave(linea));
      return ex ? c.map((l) => (l === ex ? { ...l, cantidad: l.cantidad + linea.cantidad, total: l.precio_unitario * (l.cantidad + linea.cantidad) } : l)) : [...c, linea];
    });
    setWizard({ abierto: false, tamano: null });
    setProducto(null);
    setToast('Agregado al pedido');
    setTimeout(() => setToast(''), 1800);
  };
  const tocar = (item) => (item.tipo === 'simple' ? agregar(item, { cantidad: 1, opciones: {}, modificadores: [], sin: [], nota: '' }) : setProducto(item));
  const setCantidad = (uid, c) => setCarrito((cs) => cs.map((l) => (l.uid === uid ? { ...l, cantidad: c, total: l.precio_unitario * c } : l)));
  const quitar = (uid) => setCarrito((cs) => { const n = cs.filter((l) => l.uid !== uid); if (!n.length) setVerCarrito(false); return n; });

  const confirmarPedido = async (datos) => {
    if (!tienda.abierta) {
      alert(`Lo sentimos, en este momento no estamos recibiendo pedidos. ${tienda.aviso}`);
      return;
    }
    setEnviando(true);
    try {
      const recoge = typeof datos.address === 'string';
      const tarifa = !recoge && datos.domicilio?.tipo === 'SECTOR' ? datos.domicilio.tarifa : 0;
      const dir = recoge ? '' : [datos.address.conjunto, datos.address.unidad, datos.address.nomenclatura, datos.address.conjunto ? null : datos.address.sector, datos.address.barrio, datos.address.ciudad].filter(Boolean).join(', ');
      const token = generarToken();
      const pedido = {
        seguimiento_token: token,
        tipo_entrega: recoge ? 'llevar' : 'domicilio',
        cliente: { nombre: `${datos.customer.names} ${datos.customer.lastNames}`.trim(), telefono: datos.customer.phone, direccion: dir },
        direccion_detalle: recoge ? null : datos.address,
        domicilio: datos.domicilio || null,
        pago: { metodo: datos.metodoPago, efectivo: datos.pagoEfectivo, denominacion: datos.denominacion },
        items: carrito.map(({ uid, descripcion, sel, ...l }) => l),
        subtotal,
        domicilio_valor: tarifa,
        total: subtotal + tarifa,
        autorizacion_datos: datos.autorizacionDatos || null,
      };
      const id = await crearPedido(pedido);
      recordarCliente(datos);
      guardarActivo(token);
      apagarGuia(); // ya sabe pedir: no más pistas
      const mensaje = armarMensajePedido({ id, items: carrito, subtotal, datos, enlace: enlaceSeguimiento(token) });
      setConfirmado({ id, mensaje, datos, token, inicial: vistaSeguimiento({ ...pedido, estado: 'por_aprobar', creado_en: new Date() }) });
      setCarrito([]);
      setCheckoutAbierto(false);
      setVista('confirmado');
      abrirSeguimiento(token);
    } catch (e) {
      console.error(e);
      alert(e?.code === 'permission-denied'
        ? 'Lo sentimos, en este momento no estamos recibiendo pedidos. Tu pedido sigue guardado aquí.'
        : 'No pudimos enviar tu pedido. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (error) return <div className="grid min-h-screen place-items-center p-6 text-center text-[15px] text-zinc-600">{error}</div>;
  if (!menu) return <div className="grid min-h-screen place-items-center text-[14px] text-zinc-400">Cargando menú…</div>;

  // El formulario de datos queda montado (oculto) si el cliente vuelve al menú a
  // cambiar algo: así no tiene que escribir otra vez celular, dirección, etc.
  const checkout = checkoutAbierto && (
    <div className={vista === 'datos' ? '' : 'hidden'}>
      <CompletarDatosCliente
        total={subtotal}
        items={carrito}
        isSubmitting={enviando}
        onVolver={() => { setVista('menu'); window.scrollTo(0, 0); }}
        onConfirmar={confirmarPedido}
        onQuitarItems={(uids) => setCarrito((c) => { const n = c.filter((l) => !uids.includes(l.uid)); if (!n.length) setVista('menu'); return n; })}
      />
    </div>
  );
  if (seguir) {
    return <Confirmacion token={seguir} pedido={confirmado?.token === seguir ? confirmado : null} onNuevo={cerrarSeguimiento} />;
  }

  const q = normalizar(busqueda.trim());
  const resultados = q
    ? menu.items.filter((i) => normalizar(`${nombreCliente(i)} ${i.descripcion || ''} ${raices.find((c) => c.id === i.categoria_id)?.nombre || ''}`).includes(q))
    : [];
  const abrir = (item) => (esTamanoPizza(item) ? setWizard({ abierto: true, tamano: item.id }) : tocar(item));

  if (vista === 'datos') return checkout;
  return (
    <>
    {checkout}
    <div className="min-h-screen bg-zinc-50 pb-28 lg:pb-12">
      <TopBar abierta={tienda.abierta} />

      <div className="mx-auto max-w-3xl px-4 pt-4 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:pt-6">
        <main className="min-w-0 space-y-7">
          <BannerPedidoActivo onVer={abrirSeguimiento} />
          {!tienda.abierta && <AvisoCerrado aviso={tienda.aviso} />}
          {catAbierta ? (
            <VistaCategoria
              cat={raices.find((c) => c.id === catAbierta)}
              bloques={bloquesDe(catAbierta)}
              nombreDe={nombreCliente}
              onProducto={tocar}
              onArmarPizza={(tamano) => setWizard({ abierto: true, tamano })}
              onVolver={volverInicio}
            />
          ) : (
            <>
              <Home raices={raices} listo={!!menu} onIr={irA} />
              <Pista id="menu" paso={1}>
                <b>¿Primera vez?</b> Toca una categoría y luego <b>Agregar</b> en lo que quieras.
                Cuando termines, toca <b>Ver mi pedido</b>.
              </Pista>

              <label className="relative block">
                <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar: patacón, churrasco, jugo…" className="field h-12 rounded-2xl pl-11 pr-10 text-[15px]" />
                {busqueda && (
                  <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100"><IconX className="h-4 w-4" /></button>
                )}
              </label>

              {q && (
                <section>
                  <h2 className="mb-3 text-[15px] font-semibold text-zinc-600">{resultados.length ? `${resultados.length} resultado${resultados.length > 1 ? 's' : ''}` : 'No encontramos nada con esa palabra'}</h2>
                  {resultados.length > 0 && (
                    <div className="card divide-y divide-zinc-100 overflow-hidden">
                      {resultados.map((i) => (
                        <FilaProducto key={i.id} item={i} nombre={nombreCliente(i)} etiqueta={raices.find((c) => c.id === i.categoria_id)?.nombre} onClick={() => abrir(i)} />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          <footer className="mt-10 border-t border-zinc-200 pb-6 pt-4 text-center text-[12.5px] text-zinc-400">
            <button onClick={() => setLegal('cookies')} className="hover:text-zinc-600 hover:underline">Política de cookies</button>
            <span className="mx-2">·</span>
            <button onClick={() => setLegal('datos')} className="hover:text-zinc-600 hover:underline">Tratamiento de datos</button>
            <span className="mx-2">·</span>
            <button onClick={() => { reiniciarGuia(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-zinc-600 hover:underline">¿Cómo hacer mi pedido?</button>
          </footer>
        </main>

        {/* Pedido siempre visible en PC */}
        <aside className="hidden lg:block">
          <div className="card sticky top-[85px] flex max-h-[calc(100vh-110px)] flex-col overflow-hidden">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-[17px] font-bold tracking-tight">Tu pedido</h2>
              <p className="text-[13px] text-zinc-500">{unidades ? `${unidades} producto${unidades > 1 ? 's' : ''}` : 'Aún no has agregado nada'}</p>
            </div>
            <CarritoContenido carrito={carrito} subtotal={subtotal} setCantidad={setCantidad} quitar={quitar} onContinuar={irADatos} cerrado={tienda.abierta ? '' : tienda.aviso} />
          </div>
        </aside>
      </div>

      {!legal && <AvisoCookies onVerPolitica={() => setLegal('cookies')} />}
      {legal === 'cookies' && <PoliticaCookies onCerrar={() => setLegal(null)} onVerDatos={() => setLegal('datos')} />}
      {legal === 'datos' && <PoliticaDatos onCerrar={() => setLegal(null)} onAceptar={() => setLegal(null)} textoBoton="Entendido" />}

      {/* Volver al inicio (encima de la barra "Ver mi pedido" cuando hay productos) */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Volver al inicio"
        title="Volver al inicio"
        className={`fixed right-4 z-20 grid h-12 w-12 place-items-center rounded-full border border-zinc-200 bg-white/95 text-zinc-800 shadow-pop backdrop-blur transition-all duration-300 hover:bg-white hover:text-brand-600 active:scale-95 lg:bottom-8 lg:right-8 ${
          carrito.length > 0 ? 'bottom-[104px]' : 'bottom-6'
        } ${verArriba && vista === 'menu' && !wizard.abierto && !producto && !verCarrito && !verCategorias ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
      </button>

      {carrito.length > 0 && !wizard.abierto && !producto && !verCarrito && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-rise lg:hidden">
          <Globo id="carrito">¡Listo! Puedes seguir agregando. Cuando termines, toca aquí para revisar tu pedido y continuar.</Globo>
          <button onClick={() => setVerCarrito(true)} className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl bg-brand-600 px-4 py-3.5 text-white shadow-pop active:scale-[.99]">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-white/15">
              <IconBag className="h-5 w-5" />
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-brand-700">{unidades}</span>
            </span>
            <span className="flex-1 text-left text-[15px] font-semibold">Ver mi pedido</span>
            <span className="text-[15px] font-bold tabular-nums">{formatCOP(subtotal)}</span>
            <IconChevronRight className="h-4 w-4 text-white/70" />
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 w-max max-w-[92vw] rounded-full bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white shadow-pop animate-rise">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500"><IconCheck className="h-3 w-3" strokeWidth={3} /></span>
          {toast}
        </div>
      )}

      <PizzaWizard abierto={wizard.abierto} tamanoInicial={wizard.tamano} menu={menu} onCerrar={() => setWizard({ abierto: false, tamano: null })} onAgregar={agregar} />
      {producto && <ProductoSheet item={producto} titulo={nombreCliente(producto)} grupos={menu.grupos} onCerrar={() => setProducto(null)} onAgregar={agregar} />}
      {verCategorias && <SheetCategorias raices={raices} activa={activa} conteo={conteo} onIr={irA} onCerrar={() => setVerCategorias(false)} />}

      {verCarrito && (
        <Sheet onClose={() => setVerCarrito(false)}>
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <div>
              <h2 className="text-[17px] font-bold tracking-tight">Tu pedido</h2>
              <p className="text-[13px] text-zinc-500">{unidades} producto{unidades > 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setVerCarrito(false)} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100"><IconX className="h-4 w-4" /></button>
          </div>
          <CarritoContenido
            carrito={carrito}
            subtotal={subtotal}
            setCantidad={setCantidad}
            quitar={quitar}
            onContinuar={irADatos}
            cerrado={tienda.abierta ? '' : tienda.aviso}
            pie={<button onClick={() => setVerCarrito(false)} className="btn-secondary w-full"><IconPlus className="h-4 w-4" /> Seguir pidiendo</button>}
          />
        </Sheet>
      )}
    </div>
    </>
  );
}

function AvisoCerrado({ aviso }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 animate-rise" role="status">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-red-900">En este momento estamos cerrados</p>
        <p className="mt-0.5 text-[13.5px] leading-snug text-red-800">{aviso} Puedes ver el menú y armar tu pedido. Horario: {HORARIO_TEXTO}</p>
      </div>
    </div>
  );
}

function TopBar({ abierta = true }) {
  return (
    <header className="sticky top-0 z-20 h-[61px] border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-2xl items-center gap-3 px-4 lg:max-w-6xl">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-[17px] font-black text-white shadow-sm">J</span>
        <div className="flex-1 leading-tight">
          <p className="text-[15px] font-bold tracking-tight">{NEGOCIO.nombre}</p>
          <p className="text-[12px] text-zinc-500">Pizzería · Comidas rápidas · Domicilios</p>
        </div>
        <Badge tone={abierta ? 'green' : 'red'}>{abierta ? 'Abierto' : 'Cerrado'}</Badge>
      </div>
    </header>
  );
}

/** Pedido en curso en este dispositivo: acceso rápido al seguimiento. */
function BannerPedidoActivo({ onVer }) {
  const [token] = useState(() => leerActivos()[0]?.token || null);
  const s = useSeguimiento(token);
  if (!token || !s || s.etapa === 'entregado' || s.etapa === 'rechazado') return null;
  const textos = { recibido: 'Estamos revisando tu pedido', preparando: 'Tu pedido se está preparando', en_camino: 'Tu pedido va en camino', listo: 'Tu pedido está listo para recoger' };
  return (
    <button onClick={() => onVer(token)} className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left animate-rise">
      <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-emerald-800">{s.numero ? `Pedido #${String(s.numero).padStart(3, '0')}` : 'Tu pedido'}</span>
        <span className="block text-[14.5px] font-bold text-emerald-950">{textos[s.etapa]}</span>
      </span>
      <span className="shrink-0 text-[13px] font-semibold text-emerald-800">Ver estado</span>
      <IconChevronRight className="h-4 w-4 text-emerald-700" />
    </button>
  );
}

function Confirmacion({ token, pedido, onNuevo }) {
  const recienEnviado = !!pedido;
  return (
    <div className="min-h-screen bg-zinc-50 pb-10">
      <TopBar />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6 animate-rise">
        {recienEnviado && (
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><IconCheck className="h-5 w-5" strokeWidth={3} /></span>
            <div>
              <h1 className="text-[20px] font-extrabold tracking-tight">¡Recibimos tu pedido!</h1>
              <p className="text-[13.5px] text-zinc-500">Aquí ves cómo avanza. Puedes cerrar la página y volver cuando quieras.</p>
            </div>
          </div>
        )}
        {!recienEnviado && <h1 className="text-[20px] font-extrabold tracking-tight">Seguimiento de tu pedido</h1>}

        {recienEnviado && pedido.datos.metodoPago === 'transferencia' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-[14px] font-semibold text-emerald-900">Envíanos el comprobante</p>
            <p className="mt-0.5 text-[13.5px] text-emerald-800">Para aceptar tu pedido necesitamos el comprobante de la transferencia.</p>
            <a href={linkWhatsApp(pedido.mensaje)} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-[15px] font-semibold text-white shadow-sm hover:brightness-95">
              <IconWhatsApp className="h-5 w-5" /> Enviar por WhatsApp
            </a>
          </div>
        )}

        <Seguimiento token={token} inicial={pedido?.inicial || null} />

        <a href={linkWhatsApp(recienEnviado ? pedido.mensaje : 'Hola, quiero preguntar por mi pedido: ' + enlaceSeguimiento(token))} target="_blank" rel="noreferrer" className="btn-secondary w-full">
          <IconWhatsApp className="h-5 w-5 text-[#25D366]" /> ¿Dudas? Escríbenos por WhatsApp
        </a>
        <button onClick={onNuevo} className="btn-secondary w-full">Ir al menú</button>
      </main>
    </div>
  );
}
