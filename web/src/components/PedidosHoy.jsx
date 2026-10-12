import { useEffect, useState } from 'react';
import { agruparPorZona, horaCorta, resumenLinea, ticketTexto } from '@shared/comandas.js';
import { ZONA_UI, cop } from '../lib/zonasUI';
import { DOMICILIO } from '@shared/domicilio.js';
import EstadoZonas from './EstadoZonas';
import { Sheet, IconX } from './ui';

export default function PedidosHoy({ pedidos, reimprimir, obtenerTrabajo, pedirCuenta, cuentaDisponible, aprobar, rechazar, onAgregar, cobrar, marcarEtapa, puedeAgregar = () => true, mesas = {}, pasarMesa, liberarMesa, listarEquipo }) {
  const porAprobar = pedidos.filter((p) => p.estado === 'por_aprobar');
  const [ticket, setTicket] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [cobrando, setCobrando] = useState(null);
  const [pasando, setPasando] = useState(null);
  const lockDe = (p) => (p.mesa && mesas[p.mesa]?.pedido_id === p.id ? mesas[p.mesa] : null);
  // Las adiciones se muestran dentro de su cuenta (si la cuenta está en la lista).
  const ids = new Set(pedidos.map((p) => p.id));
  const adicionesDe = (id) => pedidos.filter((a) => a.adicion_de === id).sort((a, b) => (a.adicion_n || 0) - (b.adicion_n || 0));
  const principales = pedidos.filter((p) => !(p.adicion_de && ids.has(p.adicion_de)));
  const tieneError = (p) => Object.values(p.impresion || {}).some((i) => i.estado === 'error');
  const conError = principales.filter((p) => tieneError(p) || adicionesDe(p.id).some(tieneError));
  const abiertas = principales.filter((p) => p.cobro?.estado === 'abierta' && p.estado === 'confirmado');
  const lista = (filtro === 'errores' ? conError : filtro === 'abiertas' ? abiertas : principales).filter((p) => p.estado !== 'por_aprobar');
  const hoyConfirmados = pedidos.filter((p) => p.estado === 'confirmado' && !p.adicion_de);
  const totalDia = pedidos.filter((p) => p.estado === 'confirmado').reduce((s, p) => s + (p.total || 0), 0);
  const totalCuenta = (p) => p.total_cuenta ?? p.total;
  const porCobrar = abiertas.reduce((s, p) => s + (totalCuenta(p) || 0), 0);

  const verTicket = async (p, zona) => {
    const t = await obtenerTrabajo(p.id, zona);
    if (t) setTicket({ texto: ticketTexto(t), titulo: `#${String(p.numero).padStart(3, '0')} · ${zona === 'cuenta' ? 'Cuenta' : ZONA_UI[zona].nombre}` });
  };

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Hoy</p>
          <p className="text-[13px] text-zinc-500">{hoyConfirmados.length} pedido{hoyConfirmados.length === 1 ? '' : 's'} · {cop(totalDia)}</p>
          {abiertas.length > 0 && <p className="text-[13px] font-semibold text-amber-700">{abiertas.length} cuenta{abiertas.length > 1 ? 's' : ''} abierta{abiertas.length > 1 ? 's' : ''} · {cop(porCobrar)} por cobrar</p>}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 text-[13px] font-semibold">
          <button onClick={() => setFiltro('todos')} className={`rounded-lg px-3 py-1.5 ${filtro === 'todos' ? 'bg-white shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500'}`}>Todos</button>
          <button onClick={() => setFiltro('abiertas')} className={`rounded-lg px-3 py-1.5 ${filtro === 'abiertas' ? 'bg-white shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500'}`}>
            Abiertas {abiertas.length > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[11px] text-white">{abiertas.length}</span>}
          </button>
          <button onClick={() => setFiltro('errores')} className={`rounded-lg px-3 py-1.5 ${filtro === 'errores' ? 'bg-white shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500'}`}>
            Con error {conError.length > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[11px] text-white">{conError.length}</span>}
          </button>
        </div>
      </div>

      {porAprobar.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-amber-700">
            <span className="h-2 w-2 animate-pulso rounded-full bg-amber-500" /> Por aprobar · desde la app ({porAprobar.length})
          </h2>
          <div className="space-y-3">
            {porAprobar.map((p) => <TarjetaPorAprobar key={p.id} p={p} aprobar={aprobar} rechazar={rechazar} />)}
          </div>
        </section>
      )}

      {!lista.length && !porAprobar.length && <p className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-[14px] text-zinc-500">{filtro === 'errores' ? 'No hay comandas con error.' : filtro === 'abiertas' ? 'No hay cuentas abiertas.' : 'Aún no hay pedidos hoy.'}</p>}

      <div className="space-y-3">
        {lista.map((p) => (
          <article key={p.id} className="card p-4 animate-rise">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[20px] font-bold">{p.numero ? `#${String(p.numero).padStart(3, '0')}` : p.estado === 'rechazado' ? '—' : '#…'}</span>
                {p.origen === 'app' && <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-bold uppercase text-violet-700 ring-1 ring-inset ring-violet-200">App</span>}
                {p.adicion_de && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-800 ring-1 ring-inset ring-amber-200">Adición {p.adicion_n || ''}</span>}
                {p.cobro?.estado === 'abierta' && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-900">Cuenta abierta</span>}
                {p.cobro?.estado === 'pagada' && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold uppercase text-emerald-700 ring-1 ring-inset ring-emerald-200">Pagada · {METODOS[p.cobro.metodo] || 'Efectivo'}</span>}
                <span className="text-[13px] text-zinc-500">
                  {horaCorta(p.creado_en)} · {p.mesa ? <b className="text-zinc-800">Mesa {p.mesa}</b> : { mesa: 'Mesa', llevar: 'Para llevar', domicilio: 'Domicilio' }[p.tipo_entrega]}
                  {lockDe(p)?.por_nombre && ` · atiende ${lockDe(p).por_nombre}`}
                  {p.cliente?.nombre && ` · ${p.cliente.nombre}`}
                </span>
              </div>
              <span className="text-[15px] font-bold tabular-nums">{cop(totalCuenta(p))}</span>
            </div>
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              {agruparPorZona(p.items).map((g) => (
                <div key={g.zona} className={`rounded-lg border-l-4 ${ZONA_UI[g.zona].borde} bg-zinc-50 px-3 py-2`}>
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${ZONA_UI[g.zona].texto}`}>{ZONA_UI[g.zona].nombre}</p>
                  {g.items.map((l, i) => (
                    <p key={i} className="text-[13px] leading-snug">
                      <b>{l.cantidad}</b> {l.nombre_pantalla || l.nombre}
                      {resumenLinea(l) && <span className="text-zinc-500"> · {resumenLinea(l)}</span>}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            {p.estado === 'rechazado' ? (
              <span className="text-[12.5px] font-semibold text-zinc-500">Rechazado{p.motivo_rechazo ? ` · ${p.motivo_rechazo}` : ''}</span>
            ) : (
              <>
                <EstadoZonas pedido={p} onReimprimir={(zona) => reimprimir(p.id, zona)} onVerTicket={p.numero ? (zona) => verTicket(p, zona) : null} />
                {adicionesDe(p.id).map((a) => (
                  <div key={a.id} className="mt-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <p className="mb-2 flex items-center justify-between text-[12.5px] font-semibold text-amber-900">
                      <span>Adición {a.adicion_n || ''} · {horaCorta(a.creado_en)}</span>
                      <span className="tabular-nums">{cop(a.total)}</span>
                    </p>
                    <div className="mb-2 space-y-0.5">
                      {a.items.map((l, i) => (
                        <p key={i} className="text-[13px] leading-snug">
                          <b>{l.cantidad}</b> {l.nombre_pantalla || l.nombre}
                          {resumenLinea(l) && <span className="text-zinc-500"> · {resumenLinea(l)}</span>}
                        </p>
                      ))}
                    </div>
                    <EstadoZonas pedido={a} onReimprimir={(zona) => reimprimir(a.id, zona)} onVerTicket={a.numero ? (zona) => verTicket(a, zona) : null} />
                  </div>
                ))}
                {p.origen === 'app' && p.estado === 'confirmado' && marcarEtapa && <EtapaCliente p={p} marcar={marcarEtapa} />}
                {p.numero > 0 && pedirCuenta && cuentaDisponible && <BotonCuenta p={p} pedirCuenta={pedirCuenta} verCuenta={() => verTicket(p, 'cuenta')} />}
                {p.cobro?.estado === 'abierta' && p.numero > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onAgregar && puedeAgregar(p) && <button onClick={() => onAgregar(p)} className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-[13px] font-semibold hover:bg-zinc-50">+ Agregar productos</button>}
                    {pasarMesa && lockDe(p) && <button onClick={() => setPasando(p)} className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-[13px] font-semibold hover:bg-zinc-50">Pasar mesa</button>}
                    {cobrar && <button onClick={() => setCobrando(p)} className="rounded-xl bg-emerald-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700">Cobrar {cop(totalCuenta(p))}</button>}
                  </div>
                )}
                {p.cobro?.estado === 'pagada' && (
                  <p className="mt-3 text-[12.5px] text-emerald-700">✓ Pagada {cop(p.cobro.total)} {p.cobro.por_nombre ? `· cobró ${p.cobro.por_nombre}` : ''} {p.cobro.en ? `· ${horaCorta(p.cobro.en)}` : ''}</p>
                )}
              </>
            )}
          </article>
        ))}
      </div>

      {pasando && <DialogoPasarMesa p={pasando} lock={lockDe(pasando)} listarEquipo={listarEquipo} pasarMesa={pasarMesa} onCerrar={() => setPasando(null)} />}
      {cobrando && <DialogoCobro p={cobrando} total={totalCuenta(cobrando)} cobrar={cobrar} onCerrar={() => setCobrando(null)} />}

      {ticket && (
        <Sheet onClose={() => setTicket(null)}>
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
            <p className="text-[15px] font-bold">Ticket {ticket.titulo}</p>
            <button onClick={() => setTicket(null)} className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100"><IconX className="h-4 w-4" /></button>
          </div>
          <div className="overflow-auto bg-zinc-100 p-4">
            <pre className="mx-auto w-fit rounded-md bg-white px-4 py-5 font-['JetBrains_Mono',ui-monospace,monospace] text-[11px] leading-[1.35] text-zinc-900 shadow-card">{ticket.texto}</pre>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Caja escribe el domicilio cuando Google no ubicó la dirección. */
function ValorDomicilio({ p, valor, setValor }) {
  // Valores de la tabla: tarifa base y luego km × tarifa (3, 4, 5 km con las tarifas actuales).
  const sugeridos = [...new Set([DOMICILIO.tarifaBase, ...Array.from({ length: Math.max(0, Math.ceil(DOMICILIO.maxKm) - Math.floor(DOMICILIO.radioBaseKm)) }, (_, i) => (Math.floor(DOMICILIO.radioBaseKm) + 1 + i) * DOMICILIO.tarifaPorKm)])];
  const mapa = `https://www.google.com/maps/dir/?api=1&origin=${DOMICILIO.origen.lat},${DOMICILIO.origen.lng}&destination=${encodeURIComponent(`${p.direccion_detalle?.nomenclatura || p.cliente?.direccion || ''}, Bogotá`)}`;
  const pagoTransf = p.pago?.metodo === 'transferencia';
  return (
    <div className="mb-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-3">
      <p className="text-[13.5px] font-bold text-amber-950">Domicilio por confirmar</p>
      <p className="mt-0.5 text-[12.5px] leading-snug text-amber-900">
        La app no pudo ubicar la dirección. Escribe el valor antes de aceptar: el cliente lo verá en su seguimiento y se cobra <b>al entregar</b>
        {pagoTransf ? ' (su transferencia es solo por los productos).' : '.'}{' '}
        <a href={mapa} target="_blank" rel="noreferrer" className="font-semibold underline">Ver distancia en Maps</a>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {sugeridos.map((v) => (
          <button key={v} type="button" onClick={() => setValor(String(v))}
            className={`rounded-lg px-2.5 py-1.5 text-[13px] font-bold ring-1 ring-inset transition ${Number(valor) === v ? 'bg-amber-600 text-white ring-amber-600' : 'bg-white text-amber-900 ring-amber-300 hover:bg-amber-100'}`}>
            {cop(v)}
          </button>
        ))}
        <input value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" placeholder="Otro valor"
          className="w-28 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[13px] font-semibold outline-none focus:border-amber-600" />
      </div>
      {Number(valor) > 0 && <p className="mt-2 text-[12.5px] font-semibold text-amber-950">Nuevo total: {cop((p.subtotal ?? p.total) + Number(valor))}</p>}
    </div>
  );
}

export function TarjetaPorAprobar({ p, aprobar, rechazar, compacto = false }) {
  const [ocupado, setOcupado] = useState(false);
  // La nube verifica precios y domicilio al llegar el pedido (1–3 s). Mientras
  // tanto no se acepta; si en 20 s no hay respuesta, se deja aceptar con aviso.
  const [, refrescar] = useState(0);
  const v = p.verificacion;
  const espera = !v && Date.now() - new Date(p.creado_en).getTime() < 20_000;
  useEffect(() => {
    if (!espera) return;
    const t = setInterval(() => refrescar((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, [espera]);
  // Domicilio que la app no pudo calcular: caja escribe el valor antes de aceptar.
  const domPendiente = p.tipo_entrega === 'domicilio' && !(p.domicilio_valor > 0);
  const [domValor, setDomValor] = useState('');
  const domNum = Number(domValor) || 0;
  const accion = async (fn, extra) => { setOcupado(true); try { await fn(p.id, extra); } finally { setOcupado(false); } };
  const aceptar = () => accion(aprobar, domPendiente ? { valor: domNum, subtotal: p.subtotal ?? p.total } : undefined);
  const zonas = agruparPorZona(p.items);
  const imprimen = zonas.filter((g) => g.zona !== 'general').length;
  return (
    <article className="rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-card animate-rise">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-bold">
            {p.cliente?.nombre || 'Cliente'}
            <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-bold uppercase text-violet-700 ring-1 ring-inset ring-violet-200">App</span>
          </p>
          <p className="text-[13px] text-zinc-500">
            {horaCorta(p.creado_en)} · {p.tipo_entrega === 'domicilio' ? 'Domicilio' : 'Recoge en el local'}
            {p.cliente?.telefono && <> · <a className="font-semibold text-zinc-700 underline" href={`tel:${p.cliente.telefono}`}>{p.cliente.telefono}</a></>}
          </p>
          {p.cliente?.direccion && <p className="text-[13px] text-zinc-600">{p.cliente.direccion}</p>}
          {p.direccion_detalle?.instrucciones && <p className="text-[12.5px] italic text-zinc-500">“{p.direccion_detalle.instrucciones}”</p>}
          {p.domicilio?.direccion_encontrada && <p className="text-[12px] text-zinc-400">Google la ubicó en: {p.domicilio.direccion_encontrada}</p>}
        </div>
        <div className="text-right">
          <p className="text-[17px] font-bold tabular-nums">{cop(p.total)}</p>
          <p className="text-[12px] font-semibold text-zinc-500">
            {p.pago?.metodo === 'transferencia' ? 'Transferencia · verifica el comprobante' : p.pago?.metodo === 'datafono' ? 'Datáfono · el domiciliario lleva el datáfono' : p.pago?.efectivo === 'denominacion' ? `Efectivo · paga con ${cop(p.pago.denominacion)}` : 'Efectivo exacto'}
          </p>
          {p.domicilio?.tipo === 'PENDIENTE_INFORMAR' && <p className="text-[12px] text-amber-700">+ domicilio por confirmar</p>}
          {p.domicilio?.tipo === 'SECTOR' && (
            <p className="text-[12px] text-zinc-500">
              Incluye domicilio {cop(p.domicilio_valor)}{p.domicilio.metodo === 'conjunto' ? ' · conjunto' : p.domicilio.km != null ? ` · ${String(p.domicilio.km).replace('.', ',')} km` : ''}
            </p>
          )}
        </div>
      </div>
      <div className={`mb-3 grid gap-2 ${compacto ? '' : 'sm:grid-cols-3'}`}>
        {zonas.map((g) => (
          <div key={g.zona} className={`rounded-lg border-l-4 ${ZONA_UI[g.zona].borde} bg-zinc-50 px-3 py-2`}>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${ZONA_UI[g.zona].texto}`}>{ZONA_UI[g.zona].nombre}</p>
            {g.items.map((l, i) => (
              <p key={i} className="text-[13px] leading-snug">
                <b>{l.cantidad}</b> {l.nombre_pantalla || l.nombre}
                {resumenLinea(l) && <span className="text-zinc-500"> · {resumenLinea(l)}</span>}
                {l.nota && <span className="italic text-zinc-500"> “{l.nota}”</span>}
              </p>
            ))}
          </div>
        ))}
      </div>
      {espera && <p className="mb-3 flex items-center gap-2 text-[12.5px] text-zinc-500"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" /> Verificando precios y domicilio…</p>}
      {v?.ok && <p className="mb-3 text-[12.5px] font-semibold text-emerald-700">✓ Precios y domicilio verificados</p>}
      {v && !v.ok && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900">
          <p className="font-bold">⚠ Revisa este pedido antes de aceptar</p>
          {v.total_verificado != null && v.total_app !== v.total_verificado && (
            <p className="mt-0.5">La app envió un total de <b>{cop(v.total_app)}</b>; con los precios del menú es <b>{cop(v.total_verificado)}</b> (ya quedó corregido).</p>
          )}
          <ul className="mt-1 list-disc pl-4">{(v.avisos || []).map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
      {!v && !espera && <p className="mb-3 text-[12.5px] font-semibold text-amber-700">No se pudo verificar automáticamente: revisa los precios.</p>}
      {domPendiente && !espera && (
        <ValorDomicilio p={p} valor={domValor} setValor={setDomValor} />
      )}
      <div className="flex gap-2">
        <button disabled={ocupado} onClick={() => accion(rechazar)} className="btn-secondary px-4 text-red-600">Rechazar</button>
        <button disabled={ocupado || espera || (domPendiente && domNum <= 0)} onClick={aceptar} title={domPendiente && domNum <= 0 ? 'Primero escribe el valor del domicilio' : ''} className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
          {compacto ? 'Aceptar' : imprimen ? `Aceptar e imprimir ${imprimen} comanda${imprimen > 1 ? 's' : ''}` : 'Aceptar'}
        </button>
      </div>
    </article>
  );
}

/** "Imprimir cuenta": ticket con todo lo pedido (bebidas incluidas), precios y total. */
export function BotonCuenta({ p, pedirCuenta, verCuenta }) {
  const [enviando, setEnviando] = useState(false);
  const estado = p.cuenta?.estado;
  const ocupado = enviando || estado === 'en_cola' || estado === 'imprimiendo';
  const pedir = async () => {
    setEnviando(true);
    try { await pedirCuenta(p.id); } catch (e) { alert('No se pudo pedir la cuenta: ' + e.message); } finally { setEnviando(false); }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
      <button onClick={pedir} disabled={ocupado} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-wait disabled:bg-zinc-400">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
        {ocupado ? 'Imprimiendo cuenta…' : p.cuenta_impresas ? 'Imprimir cuenta otra vez' : 'Imprimir cuenta'}
      </button>
      {estado === 'impreso' && <span className="text-[12px] font-semibold text-emerald-700">✓ Cuenta impresa {horaCorta(p.cuenta.impreso_en)}</span>}
      {estado === 'error' && <span className="text-[12px] font-semibold text-red-600">✕ {p.cuenta.error || 'No se pudo imprimir'}</span>}
      {p.cuenta_impresas > 0 && <button onClick={verCuenta} className="rounded-full px-2 py-1 text-[12px] font-semibold text-zinc-500 hover:bg-zinc-100">Ver cuenta</button>}
    </div>
  );
}

const METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', datafono: 'Datáfono' };

/** Cobrar: marca la cuenta como pagada (solo cajero / admin). */
function DialogoCobro({ p, total, cobrar, onCerrar }) {
  const [metodo, setMetodo] = useState('efectivo');
  const [recibido, setRecibido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const vueltas = Number(recibido) - total;
  const confirmar = async () => {
    setEnviando(true);
    setError('');
    try {
      await cobrar(p.id, { metodo, total });
      onCerrar();
    } catch (e) {
      setError(e.code === 'permission-denied' ? 'No se pudo cobrar: la cuenta ya no está abierta o tu usuario no puede cobrar.' : `No se pudo cobrar: ${e.message}`);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Sheet onClose={onCerrar}>
      <div className="px-5 pb-2 pt-5">
        <h2 className="text-[18px] font-bold tracking-tight">Cobrar cuenta #{String(p.numero).padStart(3, '0')}</h2>
        <p className="text-[13px] text-zinc-500">{{ mesa: 'Mesa', llevar: 'Para llevar' }[p.tipo_entrega]}{p.cliente?.nombre && ` · ${p.cliente.nombre}`}</p>
      </div>
      <div className="space-y-4 px-5 py-3">
        <div className="rounded-xl bg-zinc-50 px-4 py-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-zinc-400">Total a cobrar</p>
          <p className="text-[28px] font-extrabold tabular-nums">{cop(total)}</p>
          {(p.adiciones || []).length > 0 && <p className="text-[12px] text-zinc-500">Incluye {p.adiciones.length} {p.adiciones.length > 1 ? 'adiciones' : 'adición'}</p>}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 text-[14px] font-semibold">
          {Object.entries(METODOS).map(([m, nombre]) => (
            <button key={m} onClick={() => setMetodo(m)} className={`rounded-lg py-2.5 ${metodo === m ? 'bg-white shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500'}`}>
              {nombre}
            </button>
          ))}
        </div>
        {metodo === 'efectivo' && (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-zinc-600">¿Con cuánto paga? (opcional, para calcular vueltas)</span>
            <input value={recibido} onChange={(e) => setRecibido(e.target.value.replace(/\D/g, '').slice(0, 7))} inputMode="numeric" placeholder={String(total)} className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-[16px] tabular-nums outline-none focus:border-zinc-400" />
            {recibido && <p className={`mt-1.5 text-[14px] font-semibold ${vueltas < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{vueltas < 0 ? `Faltan ${cop(-vueltas)}` : `Vueltas: ${cop(vueltas)}`}</p>}
          </label>
        )}
        {metodo === 'datafono' && <p className="text-[13px] text-zinc-500">Verifica que el datáfono haya aprobado el pago antes de marcar como pagada.</p>}
        {metodo === 'transferencia' && <p className="text-[13px] text-zinc-500">Verifica que la transferencia haya llegado antes de marcar como pagada.</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
      </div>
      <div className="flex gap-3 border-t border-zinc-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button onClick={onCerrar} className="btn-secondary">Volver</button>
        <button onClick={confirmar} disabled={enviando || (metodo === 'efectivo' && recibido !== '' && vueltas < 0)} className="btn-primary flex-1 !bg-emerald-600 hover:!bg-emerald-700">
          {enviando ? 'Guardando…' : `Marcar pagada ${cop(total)}`}
        </button>
      </div>
    </Sheet>
  );
}

/** Seguimiento que ve el cliente en la app: el personal avanza la etapa. */
export function EtapaCliente({ p, marcar }) {
  const [enviando, setEnviando] = useState(false);
  const dom = p.tipo_entrega === 'domicilio';
  const siguiente = !p.etapa || p.etapa === 'preparando'
    ? (dom ? { id: 'en_camino', texto: 'Salió a domicilio' } : { id: 'listo', texto: 'Listo para recoger' })
    : p.etapa !== 'entregado' ? { id: 'entregado', texto: 'Entregado' } : null;
  const actual = { en_camino: 'En camino', listo: 'Listo para recoger', entregado: 'Entregado' }[p.etapa] || 'En preparación';
  const avanzar = async () => {
    setEnviando(true);
    try { await marcar(p.id, siguiente.id); } catch (e) { alert('No se pudo actualizar: ' + e.message); } finally { setEnviando(false); }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-violet-50/60 px-3 py-2 ring-1 ring-inset ring-violet-100">
      <span className="text-[12.5px] text-violet-900">El cliente ve: <b>{actual}</b>{p.etapas?.[p.etapa] ? ` · ${horaCorta(p.etapas[p.etapa])}` : ''}</span>
      {siguiente && (
        <button onClick={avanzar} disabled={enviando} className="ml-auto rounded-lg bg-violet-700 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60">
          {enviando ? 'Guardando…' : `${siguiente.texto} →`}
        </button>
      )}
    </div>
  );
}

/** Caja / admin: pasar la mesa a otra persona (cambio de turno, ayuda). */
function DialogoPasarMesa({ p, lock, listarEquipo, pasarMesa, onCerrar }) {
  const [equipo, setEquipo] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { listarEquipo().then(setEquipo).catch((e) => setError(e.message)); }, [listarEquipo]);
  const pasar = async (u) => {
    try { await pasarMesa(p.mesa, { uid: u.uid, nombre: u.nombre }); onCerrar(); } catch (e) { setError(`No se pudo pasar la mesa: ${e.message}`); }
  };
  const ROL = { vendedora: 'Vendedor', cajero: 'Cajero', admin: 'Administrador' };
  return (
    <Sheet onClose={onCerrar}>
      <div className="px-5 pb-2 pt-5">
        <h2 className="text-[18px] font-bold tracking-tight">Pasar Mesa {p.mesa}</h2>
        <p className="text-[13px] text-zinc-500">Ahora la atiende {lock?.por_nombre || 'otra persona'}. ¿A quién se la pasas?</p>
      </div>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-3">
        {!equipo && !error && <p className="text-[13px] text-zinc-400">Cargando equipo…</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
        {equipo?.filter((u) => u.uid !== lock?.por).map((u) => (
          <button key={u.uid} onClick={() => pasar(u)} className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-left hover:bg-zinc-50">
            <span className="text-[14.5px] font-semibold">{u.nombre}</span>
            <span className="text-[12px] text-zinc-500">{ROL[u.rol] || u.rol}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-zinc-100 p-4"><button onClick={onCerrar} className="btn-secondary w-full">Cancelar</button></div>
    </Sheet>
  );
}
