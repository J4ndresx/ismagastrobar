import { useMemo, useState, useEffect, useRef } from 'react';
import { agruparPorZona, crearLinea } from '@shared/comandas.js';
import { ZONA_UI, cop } from '../lib/zonasUI';
import ItemDialog from './ItemDialog';
import PizzaBuilder from './PizzaBuilder';
import PedidoActual, { DatosCliente, etiquetaCard } from './PedidoActual';
import { conjuntoPorId } from '../lib/domicilio';
import { Sheet, Alert, IconX, IconChevronRight } from './ui';

const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={p.className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);

const USA_NOMBRE = new Set(['menu_del_dia', 'tradicional', 'proteinas', 'a_la_carta', 'picadas', 'bebidas', 'adicionales', 'parrilla_especiales']);
// Categorías con tema 'oscuro' (Parrilla y Especiales): fondo negro y precios dorados.
const esOscura = (c) => c?.tema === 'oscuro';
const ORO = 'text-[#D4AF37]';
const titulo = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const nombrePantalla = (item) => (USA_NOMBRE.has(item.categoria_id) ? item.nombre : titulo(item.nombre_comanda));
const sinTildes = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function TomarPedido({ menu, lineas, setLineas, datos, setDatos, domicilio, cuentasAbiertas = [], cuentaSel = null, tablero = null, onEnviar, impresoraOk, ultimoPedido, irAPedidos, busqueda, setBusqueda }) {
  const raices = useMemo(() => menu.categorias.filter((c) => !c.parent_id).sort((a, b) => a.orden - b.orden), [menu]);
  const [catId, setCatId] = useState(raices[0]?.id);
  const [subPorCat, setSubPorCat] = useState({});
  const [acordeon, setAcordeon] = useState(null); // categoría abierta en celular/tablet
  const [dialogo, setDialogo] = useState(null);
  const [verPedido, setVerPedido] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [toast, setToast] = useState(null);
  const timerToast = useRef();

  const cat = raices.find((c) => c.id === catId);
  const resultados = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return q ? menu.items.filter((i) => sinTildes(`${i.nombre} ${i.nombre_comanda}`).includes(q)).slice(0, 40) : [];
  }, [menu, busqueda]);

  const itemsDe = (cId) => {
    const subs = menu.categorias.filter((c) => c.parent_id === cId).sort((a, b) => a.orden - b.orden);
    const sid = subPorCat[cId] || subs[0]?.id;
    return menu.items.filter((i) => i.categoria_id === cId && (!subs.length || i.subcategoria_id === sid)).sort((a, b) => a.orden - b.orden);
  };

  const abrirCategoria = (cId) => {
    const nueva = acordeon === cId ? null : cId;
    setAcordeon(nueva);
    if (nueva) requestAnimationFrame(() => document.getElementById(`cat-${cId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const total = lineas.reduce((s, l) => s + l.total, 0) + (domicilio?.valor || 0);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);

  // ─── Carrito ─────────────────────────────────────────────────────────
  // Dos toques al mismo producto con las mismas opciones = una línea con cantidad 2.
  const clave = (l) => `${l.item_id}|${JSON.stringify(l.opciones.map((o) => o.valores))}|${l.modificadores.map((mm) => mm.id).join(',')}|${(l.sin || []).join(',')}|${l.nota}`;
  const agregar = (item, sel) => {
    const nueva = { ...crearLinea(item, menu.grupos, sel), uid: crypto.randomUUID?.() || String(Math.random()), nombre_pantalla: nombrePantalla(item) };
    const existente = lineas.find((l) => clave(l) === clave(nueva));
    const uid = existente ? existente.uid : nueva.uid;
    setLineas((ls) =>
      existente
        ? ls.map((l) => (l.uid === uid ? { ...l, cantidad: l.cantidad + nueva.cantidad, total: l.precio_unitario * (l.cantidad + nueva.cantidad) } : l))
        : [...ls, nueva]
    );
    setDialogo(null);
    clearTimeout(timerToast.current);
    setToast({ texto: `${nueva.cantidad}× ${nueva.nombre_pantalla}`, uid, agregada: nueva.cantidad, zona: nueva.zona_preparacion });
    timerToast.current = setTimeout(() => setToast(null), 5000);
  };
  const setCantidad = (uid, c) => setLineas((ls) => ls.map((l) => (l.uid === uid ? { ...l, cantidad: c, total: l.precio_unitario * c } : l)));
  const quitar = (uid) => setLineas((ls) => ls.filter((l) => l.uid !== uid));
  const deshacer = () => {
    const l = lineas.find((x) => x.uid === toast.uid);
    if (l && l.cantidad > toast.agregada) setCantidad(l.uid, l.cantidad - toast.agregada);
    else quitar(toast.uid);
    setToast(null);
  };
  const tocarItem = (item) => (item.tipo === 'simple' ? agregar(item, { cantidad: 1, opciones: {}, modificadores: [], sin: [], nota: '' }) : setDialogo(item));
  useEffect(() => () => clearTimeout(timerToast.current), []);

  // ─── Piezas ──────────────────────────────────────────────────────────
  const BotonItem = ({ item, oscuro = false }) => {
    const z = ZONA_UI[item.zona_preparacion];
    if (oscuro) return <BotonItemOscuro item={item} />;
    const enPedido = lineas.filter((l) => l.item_id === item.id).reduce((s, l) => s + l.cantidad, 0);
    const combo = item.modificadores?.some((m) => m.id === 'combo_gaseosa_15');
    const bloqueado = item.solo_local && datos.tipo_entrega === 'domicilio';
    return (
      <button
        onClick={() => tocarItem(item)}
        disabled={bloqueado}
        title={bloqueado ? 'Envase de vidrio: no se envía a domicilio' : undefined}
        className={`relative flex min-h-[88px] flex-col justify-between rounded-xl border bg-white px-4 py-3.5 text-left transition ${bloqueado ? 'cursor-not-allowed border-dashed border-slate-200 opacity-45' : 'hover:border-slate-300 hover:shadow-card active:scale-[.98]'} ${enPedido ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}
      >
        <span className="pr-10 text-[13.5px] font-bold uppercase leading-tight tracking-tight text-slate-900">{item.nombre}</span>
        <span className="mt-2 flex items-center justify-between">
          <span className="text-[16px] font-extrabold tabular-nums">{cop(item.precio)}</span>
          <span className={`h-2 w-2 rounded-full ${z.dot}`} title={z.nombre} />
        </span>
        {enPedido > 0 ? (
          <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-slate-900 px-1.5 text-[12px] font-bold text-white ring-2 ring-white">{enPedido}</span>
        ) : combo ? (
          <span className="absolute -right-1.5 -top-2 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-950 shadow-sm">Combo</span>
        ) : bloqueado ? (
          <span className="absolute right-3 top-3 text-[10.5px] font-semibold uppercase tracking-wide text-red-500">No domicilio</span>
        ) : item.tipo === 'configurable' ? (
          <span className="absolute right-3 top-3 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">+ opc</span>
        ) : null}
      </button>
    );
  };

  const BotonItemOscuro = ({ item }) => {
    const enPedido = lineas.filter((l) => l.item_id === item.id).reduce((s, l) => s + l.cantidad, 0);
    const bloqueado = item.solo_local && datos.tipo_entrega === 'domicilio';
    return (
      <button
        onClick={() => tocarItem(item)}
        disabled={bloqueado}
        className={`relative flex min-h-[112px] flex-col justify-between rounded-xl border bg-zinc-900 px-4 py-3.5 text-left transition ${bloqueado ? 'cursor-not-allowed border-dashed border-zinc-700 opacity-45' : 'hover:border-zinc-600 hover:bg-zinc-800/80 active:scale-[.98]'} ${enPedido ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]' : 'border-zinc-800'}`}
      >
        <span className="pr-10 text-[13.5px] font-bold uppercase leading-tight tracking-tight text-white">{item.nombre}</span>
        {item.descripcion && <span className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-zinc-400">{item.descripcion}</span>}
        <span className="mt-2 flex items-center justify-between gap-2">
          <span className={`text-[16px] font-extrabold tabular-nums ${ORO}`}>{cop(item.precio)}</span>
          {item.aviso && <span className="rounded-md bg-[#D4AF37]/15 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#E8CC6E]">{item.aviso}</span>}
        </span>
        {enPedido > 0 ? (
          <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-[#D4AF37] px-1.5 text-[12px] font-bold text-zinc-950 ring-2 ring-zinc-950">{enPedido}</span>
        ) : item.tipo === 'configurable' ? (
          <span className="absolute right-3 top-3 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">+ opc</span>
        ) : null}
      </button>
    );
  };

  const Subcategorias = ({ c }) => {
    const subs = menu.categorias.filter((x) => x.parent_id === c.id).sort((a, b) => a.orden - b.orden);
    if (!subs.length) return null;
    const sid = subPorCat[c.id] || subs[0]?.id;
    return (
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-grid sm:min-w-[420px]">
        {subs.map((sc) => (
          <button key={sc.id} onClick={() => setSubPorCat({ ...subPorCat, [c.id]: sc.id })} className={`rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition ${sc.id === sid ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500'}`}>
            {sc.nombre}
          </button>
        ))}
      </div>
    );
  };

  const contenidoCategoria = (c) => (
    <>
      <Subcategorias c={c} />
      {c.tipo_ui === 'pizza_builder' ? (
        <PizzaBuilder key={c.id} items={itemsDe(c.id)} grupos={menu.grupos} onAgregar={agregar} BotonItem={BotonItem} />
      ) : esOscura(c) ? (
        <div className="rounded-2xl bg-zinc-950 p-3 sm:p-4">
          <p className={`mb-3 text-[11px] font-semibold uppercase tracking-[.18em] ${ORO}`}>Tarde y noche</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{itemsDe(c.id).map((i) => <BotonItem key={i.id} item={i} oscuro />)}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{itemsDe(c.id).map((i) => <BotonItem key={i.id} item={i} />)}</div>
      )}
    </>
  );

  const pedidoProps = {
    lineas, setCantidad, quitar, ultimoPedido, domicilio: datos.tipo_entrega === 'domicilio' ? domicilio : null,
    onVerPedidos: irAPedidos,
    onConfirmar: () => { setVerPedido(false); setConfirmar(true); },
  };

  return (
    <div className="grid gap-5 p-4 pb-32 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-6 lg:pb-6">
      <div className="min-w-0 space-y-5">
        {/* ─── PRODUCTOS ─── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className={etiquetaCard}>Productos</p>
            <div className="hidden items-center gap-3 text-[11.5px] text-slate-500 sm:flex">
              {Object.entries(ZONA_UI).map(([id, z]) => (
                <span key={id} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${z.dot}`} />{z.nombre}</span>
              ))}
            </div>
          </div>

          {/* Buscador en celular (en PC está en el encabezado) */}
          <label className="relative mb-4 block md:hidden">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-[14.5px] outline-none focus:border-slate-400 focus:bg-white" />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400"><IconX className="h-4 w-4" /></button>
            )}
          </label>

          {busqueda.trim() ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] text-slate-500">{resultados.length} resultado{resultados.length === 1 ? '' : 's'} para “{busqueda}”</p>
                <button onClick={() => setBusqueda('')} className="text-[13px] font-semibold text-slate-600 hover:text-slate-900">Limpiar</button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{resultados.map((i) => <BotonItem key={i.id} item={i} />)}</div>
            </>
          ) : (
            <>
              {/* PC: categorías visibles todas (sin scroll horizontal) */}
              <div className="hidden lg:block">
                <div className="mb-5 flex flex-wrap gap-2">
                  {raices.map((c) => {
                    const on = c.id === catId;
                    const n = lineas.filter((l) => l.categoria_id === c.id).reduce((s, l) => s + l.cantidad, 0);
                    return (
                      <button key={c.id} onClick={() => setCatId(c.id)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition ${on ? (esOscura(c) ? 'border-[#D4AF37] bg-zinc-950 text-[#E8CC6E]' : 'border-slate-900 bg-slate-900 text-white') : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                        <span className={`h-2 w-2 rounded-full ${ZONA_UI[c.zona_preparacion].dot}`} />
                        {c.nombre}
                        {n > 0 && <span className={`rounded-full px-1.5 text-[11px] font-bold ${on ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>{n}</span>}
                      </button>
                    );
                  })}
                </div>
                {cat && contenidoCategoria(cat)}
              </div>

              {/* Celular y tablet: acordeón */}
              <div className="space-y-2 lg:hidden">
                {raices.map((c) => {
                  const z = ZONA_UI[c.zona_preparacion];
                  const abierta = acordeon === c.id;
                  const n = lineas.filter((l) => l.categoria_id === c.id).reduce((s, l) => s + l.cantidad, 0);
                  const nItems = menu.items.filter((i) => i.categoria_id === c.id).length;
                  return (
                    <div key={c.id} id={`cat-${c.id}`} className={`scroll-mt-[84px] overflow-hidden rounded-xl border transition ${abierta ? 'border-slate-300' : 'border-slate-200'}`}>
                      <button onClick={() => abrirCategoria(c.id)} aria-expanded={abierta} className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${abierta ? 'bg-slate-50' : 'bg-white'}`}>
                        <span className={`h-8 w-1.5 shrink-0 rounded-full ${z.dot}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-bold uppercase tracking-tight">{c.nombre}</span>
                          <span className="text-[12px] text-slate-500">{z.nombre} · {nItems} producto{nItems === 1 ? '' : 's'}</span>
                        </span>
                        {n > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-slate-900 px-1.5 text-[12px] font-bold text-white">{n}</span>}
                        <IconChevronRight className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${abierta ? 'rotate-90' : ''}`} />
                      </button>
                      {abierta && <div className={`border-t p-3 animate-rise ${esOscura(c) ? 'border-zinc-800 bg-zinc-950' : 'border-slate-100 bg-white'}`}>{contenidoCategoria(c)}</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* ─── DATOS DEL CLIENTE ─── */}
        <DatosCliente datos={datos} setDatos={setDatos} domicilio={domicilio} cuentasAbiertas={cuentasAbiertas} cuentaSel={cuentaSel} tablero={tablero} />
      </div>

      {/* ─── PEDIDO ACTUAL (PC) ─── */}
      <aside className="hidden lg:block">
        <div className="sticky top-[100px] flex max-h-[calc(100vh-120px)] flex-col">
          <PedidoActual {...pedidoProps} />
        </div>
      </aside>

      {/* ─── Barra inferior (celular/tablet) ─── */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setVerPedido(true)} className="min-w-[88px] text-left">
            <p className="flex items-center gap-1 text-[12px] font-medium text-slate-500">
              {unidades} ítem(s) <IconChevronRight className="h-3.5 w-3.5 -rotate-90" />
            </p>
            <p className="text-[19px] font-extrabold leading-tight tabular-nums">{cop(total)}</p>
          </button>
          <button disabled={!lineas.length} onClick={() => setConfirmar(true)} className="flex-1 rounded-xl bg-brand-600 py-3.5 text-[15.5px] font-bold text-white shadow-[0_2px_0_#860B20] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
            Confirmar pedido
          </button>
        </div>
      </div>
      {verPedido && (
        <Sheet onClose={() => setVerPedido(false)} className="h-[88vh]">
          <div className="absolute right-3 top-3 z-10">
            <button onClick={() => setVerPedido(false)} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><IconX className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1"><PedidoActual {...pedidoProps} sinTarjeta /></div>
        </Sheet>
      )}

      {dialogo && <ItemDialog item={dialogo} grupos={menu.grupos} onCerrar={() => setDialogo(null)} onAgregar={(sel) => agregar(dialogo, sel)} />}

      {confirmar && (
        <ConfirmarPedido lineas={lineas} datos={datos} setDatos={setDatos} domicilio={domicilio} cuentaSel={cuentaSel} cuentasAbiertas={cuentasAbiertas} impresoraOk={impresoraOk} onCerrar={() => setConfirmar(false)} onEnviar={async () => { try { await onEnviar(); setConfirmar(false); } catch (e) { alert(e.message || 'No se pudo enviar el pedido.'); } }} />
      )}

      {toast && (
        <div className="fixed left-1/2 top-[84px] z-50 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-slate-900 py-2 pl-4 pr-2 text-[13px] text-white shadow-pop animate-rise lg:bottom-6 lg:top-auto">
          <span className={`h-2 w-2 rounded-full ${ZONA_UI[toast.zona].dot}`} />
          <span className="font-medium">Agregado: {toast.texto}</span>
          <button onClick={deshacer} className="rounded-full bg-white/10 px-3 py-1 font-semibold hover:bg-white/20">Deshacer</button>
        </div>
      )}
    </div>
  );
}

function ConfirmarPedido({ lineas, datos, setDatos, domicilio, cuentaSel, cuentasAbiertas = [], impresoraOk, onCerrar, onEnviar }) {
  const [enviando, setEnviando] = useState(false);
  const grupos = agruparPorZona(lineas);
  const imprimen = grupos.filter((g) => g.zona !== 'general');
  const general = grupos.find((g) => g.zona === 'general');
  const esDomicilio = datos.tipo_entrega === 'domicilio';
  const total = lineas.reduce((s, l) => s + l.total, 0) + (esDomicilio ? domicilio?.valor || 0 : 0);
  const conjunto = datos.zona && datos.zona !== 'otra' ? conjuntoPorId(datos.zona) : null;
  const direccionOk = conjunto && !conjunto.barrio ? datos.unidad.trim().length >= 2 : datos.direccion.trim().length >= 5;
  const faltaDomicilio = esDomicilio && (!datos.nombre.trim() || datos.telefono.length < 10 || !datos.zona || !direccionOk);
  const sinManual = String(datos.domicilio_manual ?? '').trim() === '';
  const fuera = esDomicilio && domicilio?.calculado?.tipo === 'FUERA' && sinManual;
  const calculando = esDomicilio && domicilio?.calculando;
  const soloLocal = esDomicilio ? lineas.filter((l) => l.solo_local) : [];
  const faltaMesa = datos.tipo_entrega === 'mesa' && !datos.mesa && !cuentaSel;

  return (
    <Sheet onClose={onCerrar}>
      <div className="px-5 pb-2 pt-5">
        <h2 className="text-[18px] font-bold tracking-tight">{cuentaSel ? (cuentaSel.mesa ? `Agregar a la Mesa ${cuentaSel.mesa}` : `Agregar a la cuenta #${String(cuentaSel.numero).padStart(3, '0')}`) : 'Confirmar pedido'}</h2>
        <p className="text-[13px] text-zinc-500">
          {datos.tipo_entrega === 'mesa' && datos.mesa ? `Mesa ${datos.mesa}` : { mesa: 'Mesa', llevar: 'Para llevar', domicilio: 'Domicilio' }[datos.tipo_entrega]}
          {datos.nombre && ` · ${datos.nombre}`}
          {cuentaSel && ' · las comandas salen marcadas ADICIÓN, solo con lo nuevo'}
        </p>
      </div>
      <div className="space-y-3 px-5 py-3">
        <div className="rounded-xl border border-zinc-200">
          <p className="border-b border-zinc-100 px-4 py-2.5 text-[13px] font-semibold">
            {imprimen.length ? `Se imprimirán ${imprimen.length} comanda${imprimen.length > 1 ? 's' : ''}` : 'No se imprime ninguna comanda'}
          </p>
          {grupos.map((g) => (
            <div key={g.zona} className="flex items-center justify-between px-4 py-2.5 text-[14px]">
              <span className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${ZONA_UI[g.zona].dot}`} />
                <span className="font-medium">{ZONA_UI[g.zona].nombre}</span>
                <span className="text-zinc-400">· {g.unidades} ítem{g.unidades > 1 ? 's' : ''}</span>
              </span>
              <span className="text-[12.5px] text-zinc-500">{g.zona === 'general' ? 'Lo entregas tú' : '🖨 Ticket'}</span>
            </div>
          ))}
        </div>
        {general && imprimen.length > 0 && <p className="text-[12.5px] text-zinc-500">Recuerda entregar tú los ítems de zona general (bebidas).</p>}
        {esDomicilio && !faltaDomicilio && (
          <p className="text-[13px] text-zinc-600">
            Domicilio: <b>{domicilio?.valor ? cop(domicilio.valor) : 'por confirmar'}</b>
            {domicilio?.domicilio?.metodo === 'manual' ? ' (valor escrito a mano)' : domicilio?.calculado?.km != null ? ` · ${String(domicilio.calculado.km).replace('.', ',')} km` : domicilio?.calculado?.metodo === 'conjunto' ? ' · conjunto' : ''}
          </p>
        )}
        {soloLocal.length > 0 && <Alert tone="error">{soloLocal.map((l) => l.nombre_pantalla || l.nombre).join(', ')}: envase de vidrio, no se envía a domicilio. Quítalo del pedido o cambia a “Para llevar”.</Alert>}
        {fuera && <Alert tone="error">La dirección está fuera de cobertura ({String(domicilio.calculado.km).replace('.', ',')} km). Escribe un valor de domicilio a mano o cambia a “Para llevar”.</Alert>}
        {!impresoraOk && imprimen.length > 0 && <Alert tone="warn">La impresora no está lista. El pedido queda en cola y se imprime solo apenas se arregle.</Alert>}
        {faltaMesa && <Alert tone="error">Elige la mesa en “Datos del cliente”.</Alert>}
        {faltaDomicilio && <Alert tone="error">Para domicilio completa nombre, teléfono (10 dígitos), dónde vive y la dirección (o torre/apto si es conjunto).</Alert>}
      </div>
      <div className="flex items-center gap-3 border-t border-zinc-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-400">{cuentaSel ? 'Esta adición' : 'Total'}</p>
          <p className="text-[18px] font-bold tabular-nums">{cop(total)}</p>
          {cuentaSel && <p className="text-[12px] text-zinc-500">Cuenta queda en {cop((cuentaSel.total_cuenta ?? cuentaSel.total) + total)}</p>}
        </div>
        <button onClick={onCerrar} className="btn-secondary ml-auto">Volver</button>
        <button disabled={enviando || faltaDomicilio || fuera || calculando || soloLocal.length > 0 || faltaMesa} onClick={async () => { setEnviando(true); try { await onEnviar(); } finally { setEnviando(false); } }} className="btn-primary px-6">
          {enviando ? 'Enviando…' : cuentaSel ? 'Agregar a la cuenta' : imprimen.length ? 'Enviar a cocina' : 'Registrar'}
        </button>
      </div>
    </Sheet>
  );
}
