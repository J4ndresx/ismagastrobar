import { agruparPorZona, resumenLinea } from '@shared/comandas.js';
import { ZONA_UI, TIPOS_ENTREGA, cop } from '../lib/zonasUI';
import { IconTrash, IconMinus, IconPlus, IconBag } from './ui';
import EstadoZonas from './EstadoZonas';

/**
 * La comanda digital: la vista previa de los papelitos que van a salir,
 * separada por zona. Reemplaza el formato en papel.
 */
export default function Comanda({ lineas, setCantidad, quitar, datos, setDatos, onConfirmar, ultimoPedido, onVerPedidos }) {
  const grupos = agruparPorZona(lineas);
  const total = lineas.reduce((s, l) => s + l.total, 0);

  return (
    <div className="flex h-full flex-col">
      {ultimoPedido && (
        <button onClick={onVerPedidos} className="mx-4 mt-4 rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-sm hover:bg-zinc-50">
          <p className="mb-1.5 text-[12px] font-medium text-zinc-500">
            Último pedido <span className="font-bold text-zinc-900">{ultimoPedido.numero ? `#${String(ultimoPedido.numero).padStart(3, '0')}` : 'enviando…'}</span>
          </p>
          <EstadoZonas pedido={ultimoPedido} compacto />
        </button>
      )}

      <div className="space-y-3 border-b border-zinc-200 px-4 pb-4 pt-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
          {TIPOS_ENTREGA.map((t) => (
            <button
              key={t.id}
              onClick={() => setDatos({ ...datos, tipo_entrega: t.id })}
              className={`rounded-lg py-2 text-[13px] font-semibold transition ${datos.tipo_entrega === t.id ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500'}`}
            >
              {t.nombre}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={datos.nombre}
            onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
            placeholder={datos.tipo_entrega === 'mesa' ? 'Mesa / nombre' : 'Nombre'}
            className="field py-2 text-[14px]"
          />
          <input
            value={datos.telefono}
            onChange={(e) => setDatos({ ...datos, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            placeholder={datos.tipo_entrega === 'domicilio' ? 'Teléfono' : 'Teléfono (opcional)'}
            inputMode="numeric"
            className="field py-2 text-[14px]"
          />
        </div>
        {datos.tipo_entrega === 'domicilio' && (
          <input value={datos.direccion} onChange={(e) => setDatos({ ...datos, direccion: e.target.value })} placeholder="Dirección y barrio" className="field py-2 text-[14px] animate-rise" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!lineas.length ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-400">
            <IconBag className="mb-2 h-8 w-8" />
            <p className="text-[14px] font-medium text-zinc-500">Comanda vacía</p>
            <p className="text-[13px]">Toca los productos para agregarlos.</p>
          </div>
        ) : (
          grupos.map((g) => {
            const z = ZONA_UI[g.zona];
            return (
              <section key={g.zona} className={`border-l-4 ${z.borde} border-b border-b-zinc-100`}>
                <div className={`flex items-center justify-between px-4 py-2 ${z.suave}`}>
                  <p className={`text-[12px] font-bold uppercase tracking-wider ${z.texto}`}>{z.nombre}</p>
                  <p className="text-[11px] font-medium text-zinc-500">{z.nota} · {g.unidades}</p>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {g.items.map((l) => (
                    <li key={l.uid} className="flex items-start gap-2 px-4 py-2.5 animate-rise">
                      <div className="flex shrink-0 items-center rounded-lg border border-zinc-200">
                        <button onClick={() => (l.cantidad > 1 ? setCantidad(l.uid, l.cantidad - 1) : quitar(l.uid))} aria-label="Menos" className="grid h-8 w-7 place-items-center text-zinc-500">
                          {l.cantidad > 1 ? <IconMinus className="h-3.5 w-3.5" /> : <IconTrash className="h-3.5 w-3.5" />}
                        </button>
                        <span className="w-5 text-center text-[13px] font-bold tabular-nums">{l.cantidad}</span>
                        <button onClick={() => setCantidad(l.uid, l.cantidad + 1)} aria-label="Más" className="grid h-8 w-7 place-items-center text-zinc-500">
                          <IconPlus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold leading-tight">{l.nombre_pantalla}</p>
                        {resumenLinea(l) && <p className="text-[12.5px] leading-snug text-zinc-500">{resumenLinea(l)}</p>}
                        {l.nota && <p className="text-[12.5px] italic text-zinc-500">“{l.nota}”</p>}
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums">{cop(l.total)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      <div className="border-t border-zinc-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-[13px] text-zinc-500">Total</span>
          <span className="text-[22px] font-bold tabular-nums">{cop(total)}</span>
        </div>
        <button disabled={!lineas.length} onClick={onConfirmar} className="btn-primary w-full py-4 text-[16px]">
          Confirmar pedido
        </button>
      </div>
    </div>
  );
}
