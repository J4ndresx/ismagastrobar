import { ZONA_UI, ESTADO_IMPRESION } from '../lib/zonasUI';
import { horaCorta } from '@shared/comandas.js';
import { IconCheck, IconX } from './ui';

/** Ficha por zona: "Pizzería ✓ 2:31" · "Cocina ⏳ en cola" · "Cocina ✕ sin papel". */
export default function EstadoZonas({ pedido, compacto = false, onReimprimir, onVerTicket }) {
  const zonas = Object.keys(pedido.impresion || {});
  if (!pedido.comandas_generadas && !zonas.length) {
    return <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500"><span className="h-1.5 w-1.5 animate-pulso rounded-full bg-zinc-400" /> Generando comandas…</span>;
  }
  if (!zonas.length) return <span className="text-[12px] text-zinc-500">Sin comandas (solo zona general)</span>;

  return (
    <div className={`flex flex-wrap gap-1.5 ${compacto ? '' : 'items-center'}`}>
      {zonas.map((zona) => {
        const info = pedido.impresion[zona];
        const e = ESTADO_IMPRESION[info.estado] || ESTADO_IMPRESION.en_cola;
        const z = ZONA_UI[zona];
        return (
          <span key={zona} className="inline-flex items-center gap-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${e.clase}`}>
              <span className={`h-2 w-2 rounded-full ${z.dot}`} />
              {z.nombre}
              {info.estado === 'impreso' ? <IconCheck className="h-3.5 w-3.5" strokeWidth={3} /> : info.estado === 'error' ? <IconX className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              <span className={`font-medium ${e.animar ? 'animate-pulso' : ''}`}>
                {info.estado === 'impreso' ? horaCorta(info.impreso_en) : info.estado === 'error' ? info.error || 'Error' : e.texto}
              </span>
            </span>
            {!compacto && onReimprimir && ['impreso', 'error'].includes(info.estado) && (
              <button onClick={() => onReimprimir(zona)} className={`rounded-full px-2 py-1 text-[12px] font-semibold ${info.estado === 'error' ? 'bg-red-600 text-white hover:bg-red-700' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                Reimprimir
              </button>
            )}
            {!compacto && onVerTicket && (
              <button onClick={() => onVerTicket(zona)} className="rounded-full px-2 py-1 text-[12px] font-semibold text-zinc-500 hover:bg-zinc-100">
                Ver ticket
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
