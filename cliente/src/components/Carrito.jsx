import { resumenLinea } from '@shared/comandas.js';
import { formatCOP } from '../utils/formato';
import { Stepper, IconBag, IconTrash } from './ui';

/** Contenido del pedido: se usa en la hoja del celular y en el panel lateral del PC. */
export default function CarritoContenido({ carrito, subtotal, setCantidad, quitar, onContinuar, pie, cerrado }) {
  if (!carrito.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-zinc-100 text-zinc-400"><IconBag className="h-6 w-6" /></span>
        <p className="mt-3 text-[15px] font-semibold">Tu pedido está vacío</p>
        <p className="mt-1 text-[13.5px] text-zinc-500">Agrega productos del menú y aquí verás el total.</p>
      </div>
    );
  }
  return (
    <>
      <ul className="min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto px-5">
        {carrito.map((l) => (
          <li key={l.uid} className="py-3.5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold leading-tight">{l.nombre_pantalla}</p>
                {resumenLinea(l) && <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">{resumenLinea(l)}</p>}
                {l.nota && <p className="text-[13px] italic text-zinc-500">“{l.nota}”</p>}
              </div>
              <span className="text-[14px] font-semibold tabular-nums">{formatCOP(l.total)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Stepper cantidad={l.cantidad} setCantidad={(c) => setCantidad(l.uid, c)} />
              <button onClick={() => quitar(l.uid)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-zinc-400 hover:bg-red-50 hover:text-red-600">
                <IconTrash className="h-4 w-4" /> Quitar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-2.5 border-t border-zinc-100 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] text-zinc-500">Subtotal</span>
          <span className="text-[20px] font-bold tabular-nums">{formatCOP(subtotal)}</span>
        </div>
        {cerrado ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13.5px] leading-snug text-red-800">
            <b>Estamos cerrados.</b> {cerrado}
          </div>
        ) : (
          <p className="text-[12px] text-zinc-400">El domicilio se calcula en el siguiente paso.</p>
        )}
        <button onClick={onContinuar} disabled={!!cerrado} className="btn-primary w-full disabled:opacity-50">{cerrado ? 'Pedidos cerrados por ahora' : 'Continuar con el pedido'}</button>
        {pie}
      </div>
    </>
  );
}
