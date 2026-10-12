import { useState } from 'react';
import { METODOS_PAGO, totalesPedido } from '@shared/comandas.js';
import { cop } from '../lib/zonasUI';
import { Sheet, IconX } from './ui';
import { TextoImpuesto } from './PedidoActual';

// Billetes para "Recibido": el valor exacto y los billetes que lo cubren.
const BILLETES = [10000, 20000, 50000, 100000];
const sugerencias = (total) => {
  const s = new Set([total]);
  for (const b of BILLETES) if (b > total) s.add(b);
  const redondeo = Math.ceil(total / 10000) * 10000;
  if (redondeo > total) s.add(redondeo);
  return [...s].sort((a, b) => a - b).slice(0, 4);
};

/**
 * Estado del formulario de pago. Devuelve los campos para <FormaPago> y el
 * pago listo para guardar:
 *   { metodo: 'efectivo', recibido? } · { metodo: 'transferencia' } · { metodo: 'tarjeta' }
 *   { metodo: 'mixto', partes: [{ metodo: 'efectivo', valor }, { metodo: 'transferencia'|'tarjeta', valor }], recibido? }
 */
export function usePago(total) {
  const [metodo, setMetodo] = useState('efectivo');
  const [recibido, setRecibido] = useState('');
  const [efectivo, setEfectivo] = useState(''); // mixto: lo que paga en efectivo
  const [otro, setOtro] = useState('transferencia'); // mixto: el resto
  return { campos: { total, metodo, setMetodo, recibido, setRecibido, efectivo, setEfectivo, otro, setOtro }, ...estadoPago(total, { metodo, recibido, efectivo, otro }) };
}

export function estadoPago(total, { metodo, recibido, efectivo, otro }) {
  const valorRecibido = Number(recibido) || 0;
  if (metodo === 'mixto') {
    const enEfectivo = Number(efectivo) || 0;
    const resto = total - enEfectivo;
    const invalido = !(enEfectivo > 0 && enEfectivo < total);
    const falta = invalido || (valorRecibido > 0 && valorRecibido < enEfectivo);
    return {
      falta,
      motivo: invalido ? 'Escribe cuánto paga en efectivo (menos que el total).' : falta ? 'Lo recibido no alcanza para la parte en efectivo.' : '',
      cambio: valorRecibido >= enEfectivo && valorRecibido ? valorRecibido - enEfectivo : null,
      resto,
      pago: { metodo: 'mixto', partes: [{ metodo: 'efectivo', valor: enEfectivo }, { metodo: otro, valor: resto }], ...(valorRecibido ? { recibido: valorRecibido } : {}) },
    };
  }
  const falta = metodo === 'efectivo' && valorRecibido > 0 && valorRecibido < total;
  const cambio = metodo === 'efectivo' && valorRecibido >= total ? valorRecibido - total : null;
  return { falta, motivo: '', cambio, resto: 0, pago: { metodo, ...(metodo === 'efectivo' && valorRecibido ? { recibido: valorRecibido } : {}) } };
}

const campoNum = (set) => (e) => set(e.target.value.replace(/\D/g, '').slice(0, 7));

/** Recibido + cambio (sobre el total o sobre la parte en efectivo). */
function Recibido({ base, recibido, setRecibido, cambio, falta }) {
  const valor = Number(recibido) || 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {sugerencias(base).map((v) => (
          <button key={v} onClick={() => setRecibido(String(v))} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold tabular-nums ${valor === v ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'}`}>
            {v === base ? 'Exacto' : cop(v)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <input value={recibido} onChange={campoNum(setRecibido)} inputMode="numeric" placeholder="Recibido en efectivo (opcional)" className="field flex-1 tabular-nums" />
        <div className="min-w-[110px] text-right">
          <p className="text-[11px] uppercase tracking-wider text-zinc-400">Cambio</p>
          <p className={`text-[18px] font-bold tabular-nums ${falta ? 'text-red-600' : 'text-emerald-700'}`}>{falta && valor ? `Faltan ${cop(base - valor)}` : cambio != null ? cop(cambio) : '—'}</p>
        </div>
      </div>
    </div>
  );
}

/** Forma de pago: efectivo (con cambio), transferencia, tarjeta o mixto (efectivo + otro medio). */
export function FormaPago({ campos }) {
  const { total, metodo, setMetodo, recibido, setRecibido, efectivo, setEfectivo, otro, setOtro } = campos;
  const est = estadoPago(total, campos);
  const enEfectivo = Number(efectivo) || 0;
  const opciones = [...Object.entries(METODOS_PAGO), ['mixto', 'Mixto']];
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-zinc-800">Forma de pago</p>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1">
          {opciones.map(([id, nombre]) => (
            <button key={id} onClick={() => setMetodo(id)} className={`rounded-lg py-2.5 text-[13.5px] font-semibold transition ${metodo === id ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500'}`}>{nombre}</button>
          ))}
        </div>
      </div>
      {metodo === 'efectivo' && <div className="animate-rise"><Recibido base={total} recibido={recibido} setRecibido={setRecibido} cambio={est.cambio} falta={est.falta} /></div>}
      {metodo === 'mixto' && (
        <div className="space-y-3 rounded-xl border border-zinc-200 p-3 animate-rise">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="block">
              <span className="label">En efectivo</span>
              <input value={efectivo} onChange={campoNum(setEfectivo)} inputMode="numeric" placeholder="Ej: 20000" className="field tabular-nums" autoFocus />
            </label>
            <span className="pb-3 text-[18px] font-bold text-zinc-400">+</span>
            <div>
              <div className="mb-1.5 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-0.5 text-[12px] font-semibold">
                {['transferencia', 'tarjeta'].map((m) => (
                  <button key={m} onClick={() => setOtro(m)} className={`rounded-md py-1 ${otro === m ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>{METODOS_PAGO[m]}</button>
                ))}
              </div>
              <p className={`rounded-lg border px-3 py-2.5 text-[15px] font-bold tabular-nums ${enEfectivo > 0 && enEfectivo < total ? 'border-zinc-200 bg-zinc-50' : 'border-dashed border-zinc-300 text-zinc-400'}`}>
                {enEfectivo > 0 && enEfectivo < total ? cop(est.resto) : '—'}
              </p>
            </div>
          </div>
          {enEfectivo >= total && <p className="text-[12.5px] font-semibold text-red-600">Si paga todo en efectivo, elige "Efectivo".</p>}
          {enEfectivo > 0 && enEfectivo < total && <Recibido base={enEfectivo} recibido={recibido} setRecibido={setRecibido} cambio={est.cambio} falta={est.falta} />}
        </div>
      )}
    </div>
  );
}

/** Cobrar una cuenta abierta desde Pedidos. */
export function CobrarCuenta({ p, impuestos, onCobrar, onCerrar }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Totales con lo que tenga la cuenta ahora (promos del día incluidas).
  const { subtotal, descuentos, total, impuestos: desglose } = totalesPedido(p.items || [], new Date(), impuestos);
  const { campos, falta, pago } = usePago(total);
  const n = (p.adiciones || []).length;

  return (
    <Sheet onClose={enviando ? () => {} : onCerrar}>
      <div className="flex items-start justify-between border-b border-zinc-100 px-5 pb-3 pt-5">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight">Cobrar cuenta #{String(p.numero || 0).padStart(3, '0')}</h2>
          <p className="text-[13px] text-zinc-500">
            {p.cliente?.nombre || 'Sin nombre'} · {(p.items || []).reduce((s, l) => s + l.cantidad, 0)} ítems{n ? ` · ${n} adici${n === 1 ? 'ón' : 'ones'}` : ''}
          </p>
        </div>
        <button disabled={enviando} onClick={onCerrar} className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100"><IconX className="h-4 w-4" /></button>
      </div>
      <div className="space-y-3 overflow-y-auto px-5 py-4">
        <FormaPago campos={campos} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
      </div>
      <div className="border-t border-zinc-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {descuentos.length > 0 && (
          <div className="mb-2 space-y-0.5 text-[13px] text-zinc-500">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{cop(subtotal)}</span></div>
            {descuentos.map((d) => (
              <div key={d.id} className="flex justify-between font-semibold text-acento-600"><span>Promo {d.nombre}</span><span className="tabular-nums">−{cop(d.descuento)}</span></div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-400">Total</p>
            <p className="text-[20px] font-bold tabular-nums">{cop(total)}</p>
            <TextoImpuesto desglose={desglose} />
          </div>
          <button onClick={onCerrar} className="btn-secondary ml-auto">Volver</button>
          <button
            disabled={enviando || falta}
            onClick={async () => {
              setEnviando(true);
              setError('');
              try { await onCobrar(p.id, pago); onCerrar(); } catch (e) { setError(e.message || 'No se pudo cobrar.'); } finally { setEnviando(false); }
            }}
            className="rounded-xl bg-emerald-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:bg-zinc-300"
          >
            {enviando ? 'Cobrando…' : `Cobrar ${cop(total)}`}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
