// "Pedidos App": los pedidos que llegan desde la app del cliente, aparte de
// los del local, organizados por etapa (como un tablero de cocina).
//   Por aprobar → En preparación → Listos / En camino → Entregados
// Cada tarjeta muestra hace cuánto llegó y se pone roja si ya pasó el tiempo
// estimado que se le prometió al cliente.
import { useEffect, useState } from 'react';
import { horaCorta, resumenLinea, ticketTexto } from '@shared/comandas.js';
import { tiempoEstimado } from '@shared/seguimiento.js';
import { cop } from '../lib/zonasUI';
import EstadoZonas from './EstadoZonas';
import { TarjetaPorAprobar, BotonCuenta, EtapaCliente } from './PedidosHoy';
import { Sheet, IconX } from './ui';

const COLUMNAS = [
  { id: 'aprobar', corto: 'Nuevos', titulo: 'Por aprobar', vacio: 'Sin pedidos nuevos', tono: 'amber' },
  { id: 'preparando', corto: 'Cocina', titulo: 'En preparación', vacio: 'Nada en preparación', tono: 'sky' },
  { id: 'salida', corto: 'Salida', titulo: 'Listos / En camino', vacio: 'Nada pendiente de entregar', tono: 'violet' },
  { id: 'entregado', corto: 'Entregados', titulo: 'Entregados', vacio: 'Aún no hay entregados', tono: 'emerald' },
];
const TONO = {
  amber: 'bg-amber-500', sky: 'bg-sky-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500',
};

export const columnaDe = (p) =>
  p.estado === 'por_aprobar' ? 'aprobar'
  : p.estado === 'rechazado' ? 'rechazado'
  : p.etapa === 'entregado' ? 'entregado'
  : p.etapa === 'listo' || p.etapa === 'en_camino' ? 'salida'
  : 'preparando';

const minutosDesde = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

export default function PedidosApp({ pedidos, aprobar, rechazar, marcarEtapa, reimprimir, obtenerTrabajo, pedirCuenta, cuentaDisponible }) {
  const [, refrescar] = useState(0);
  useEffect(() => { const t = setInterval(() => refrescar((n) => n + 1), 30_000); return () => clearInterval(t); }, []); // "hace N min"
  const [tab, setTab] = useState(null); // null = la primera etapa con pedidos
  const [ticket, setTicket] = useState(null);
  const grupos = Object.fromEntries(COLUMNAS.map((c) => [c.id, []]));
  const rechazados = [];
  for (const p of pedidos) {
    const c = columnaDe(p);
    if (c === 'rechazado') rechazados.push(p);
    else grupos[c].push(p);
  }
  // Lo más urgente arriba: los más viejos primero (excepto entregados: los últimos arriba).
  for (const c of ['aprobar', 'preparando', 'salida']) grupos[c].sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
  grupos.entregado.sort((a, b) => new Date(b.etapas?.entregado || b.creado_en) - new Date(a.etapas?.entregado || a.creado_en));
  // Sin elegir: se abre en la primera etapa que tenga algo pendiente.
  const activa = tab || ['aprobar', 'preparando', 'salida'].find((c) => grupos[c].length) || 'aprobar';
  const verTicket = async (p, zona) => {
    const t = await obtenerTrabajo(p.id, zona);
    if (t) setTicket({ texto: ticketTexto(t), titulo: `#${String(p.numero).padStart(3, '0')}` });
  };
  const total = pedidos.filter((p) => p.estado !== 'rechazado' && p.estado !== 'por_aprobar').reduce((s, p) => s + (p.total || 0), 0);

  return (
    <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-500">Hoy · desde la app</p>
          <p className="text-[13px] text-zinc-500">{pedidos.length - rechazados.length - grupos.aprobar.length} aceptados · {cop(total)}{rechazados.length ? ` · ${rechazados.length} rechazado${rechazados.length > 1 ? 's' : ''}` : ''}</p>
        </div>
      </div>

      {/* Pestañas por etapa; dentro, las tarjetas en cuadrícula */}
      <div className="sticky top-[64px] z-10 -mx-4 mb-4 bg-slate-50/95 px-4 py-2 backdrop-blur lg:top-[80px] lg:-mx-6 lg:px-6">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-zinc-100 p-1">
          {COLUMNAS.map((c) => {
            const on = activa === c.id;
            const n = grupos[c.id].length;
            return (
              <button key={c.id} onClick={() => setTab(c.id)} className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 transition sm:flex-row sm:gap-2 sm:py-2.5 ${on ? 'bg-white shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-800'}`}>
                <span className="whitespace-nowrap text-[11.5px] font-semibold tracking-tight sm:text-[14px]">
                  <span className="sm:hidden">{c.corto}</span>
                  <span className="hidden sm:inline">{c.titulo}</span>
                </span>
                <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ${n ? `text-white ${TONO[c.tono]}` : 'bg-zinc-200 text-zinc-500'} ${c.id === 'aprobar' && n && !on ? 'animate-pulso' : ''}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!grupos[activa].length && (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-[14px] text-zinc-400">{COLUMNAS.find((c) => c.id === activa).vacio}</p>
      )}
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {activa === 'aprobar'
          ? grupos.aprobar.map((p) => <TarjetaPorAprobar key={p.id} p={p} aprobar={aprobar} rechazar={rechazar} compacto />)
          : grupos[activa].map((p) => (
              <TarjetaApp key={p.id} p={p} entregado={activa === 'entregado'} marcarEtapa={marcarEtapa} reimprimir={reimprimir} verTicket={verTicket} pedirCuenta={pedirCuenta} cuentaDisponible={cuentaDisponible} />
            ))}
      </div>

      {rechazados.length > 0 && (
        <details className="mt-6 text-[13px] text-zinc-500">
          <summary className="cursor-pointer font-semibold">Rechazados hoy ({rechazados.length})</summary>
          <ul className="mt-2 space-y-1">
            {rechazados.map((p) => <li key={p.id}>{horaCorta(p.creado_en)} · {p.cliente?.nombre} · {cop(p.total)}{p.motivo_rechazo ? ` · ${p.motivo_rechazo}` : ''}</li>)}
          </ul>
        </details>
      )}

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

function TarjetaApp({ p, entregado, marcarEtapa, reimprimir, verTicket, pedirCuenta, cuentaDisponible }) {
  const dom = p.tipo_entrega === 'domicilio';
  const desde = p.aprobado_en || p.creado_en;
  const min = minutosDesde(p.creado_en);
  const [, maxMin] = tiempoEstimado(p.tipo_entrega, typeof desde === 'string' ? desde : new Date().toISOString());
  const tarde = !entregado && minutosDesde(desde) > maxMin;
  const pago = { efectivo: 'Efectivo', transferencia: 'Transferencia', datafono: 'Datáfono' }[p.pago?.metodo] || '';
  return (
    <article className={`rounded-2xl border bg-white p-3.5 shadow-card ${tarde ? 'border-red-300 ring-1 ring-red-200' : 'border-zinc-200'} ${entregado ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="font-mono text-[18px] font-bold">{p.numero ? `#${String(p.numero).padStart(3, '0')}` : '#…'}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${dom ? 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200' : 'bg-zinc-100 text-zinc-700'}`}>{dom ? 'Domicilio' : 'Recoge'}</span>
          </p>
          <p className="truncate text-[13.5px] font-semibold">{p.cliente?.nombre}</p>
          {p.cliente?.telefono && <a href={`tel:${p.cliente.telefono}`} className="text-[12.5px] text-zinc-500 underline">{p.cliente.telefono}</a>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-bold tabular-nums">{cop(p.total)}</p>
          <p className="text-[11.5px] text-zinc-500">{pago}</p>
          {!entregado && <p className={`text-[11.5px] font-semibold ${tarde ? 'text-red-600' : 'text-zinc-400'}`}>hace {min} min{tarde ? ' · demorado' : ''}</p>}
          {entregado && p.etapas?.entregado && <p className="text-[11.5px] text-emerald-700">Entregado {horaCorta(p.etapas.entregado)}</p>}
        </div>
      </div>
      {dom && p.cliente?.direccion && <p className="mt-1.5 line-clamp-2 text-[12.5px] text-zinc-600">{p.cliente.direccion}</p>}
      <ul className="mt-2 space-y-0.5 border-t border-zinc-100 pt-2 text-[12.5px] leading-snug">
        {p.items.map((l, i) => (
          <li key={i}><b>{l.cantidad}</b> {l.nombre_pantalla || l.nombre}{resumenLinea(l) && <span className="text-zinc-500"> · {resumenLinea(l)}</span>}</li>
        ))}
      </ul>
      {!entregado && (
        <div className="mt-2">
          <EstadoZonas pedido={p} compacto onReimprimir={(z) => reimprimir(p.id, z)} onVerTicket={p.numero ? (z) => verTicket(p, z) : null} />
        </div>
      )}
      {!entregado && marcarEtapa && <EtapaCliente p={p} marcar={marcarEtapa} />}
      {!entregado && p.numero > 0 && pedirCuenta && cuentaDisponible && <BotonCuenta p={p} pedirCuenta={pedirCuenta} verCuenta={() => verTicket(p, 'cuenta')} />}
    </article>
  );
}
