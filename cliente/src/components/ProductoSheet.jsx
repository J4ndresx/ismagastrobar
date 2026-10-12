import { useState } from 'react';
import { validarSeleccion } from '@shared/comandas.js';
import { formatCOP } from '../utils/formato';
import { FilaOpcion } from './PizzaWizard';
import { Sheet, Stepper, IconX, IconCheck, IconNote } from './ui';

/** Ficha de producto para el cliente: opciones, adicionales, nota y cantidad. */
export default function ProductoSheet({ item, titulo, grupos, onCerrar, onAgregar }) {
  const [opciones, setOpciones] = useState(() =>
    Object.fromEntries(item.grupos_opciones.map((r) => {
      const g = grupos[r.grupo_id];
      const activas = (g?.opciones || []).filter((o) => o.activo !== false);
      // Obligatorio con una sola opción (p. ej. la única sopa del día): ya viene elegida.
      return [r.grupo_id, g?.por_defecto ? [g.por_defecto] : r.min >= 1 && r.max === 1 && activas.length === 1 ? [activas[0].id] : []];
    }))
  );
  const [mods, setMods] = useState([]);
  const [sin, setSin] = useState([]);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState('');
  const [verNota, setVerNota] = useState(false);

  const sel = { cantidad, opciones, modificadores: mods, sin, nota };
  const errores = validarSeleccion(item, sel);
  let unitario = item.precio;
  item.grupos_opciones.forEach((r) => (opciones[r.grupo_id] || []).forEach((id) => (unitario += grupos[r.grupo_id].opciones.find((o) => o.id === id)?.precio_extra || 0)));
  mods.forEach((id) => (unitario += item.modificadores.find((m) => m.id === id)?.precio || 0));

  return (
    <Sheet onClose={onCerrar}>
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-bold leading-tight tracking-tight">{titulo || item.nombre}</h2>
          {item.descripcion && <p className="mt-1 text-[14px] text-zinc-500">{item.descripcion}</p>}
          <p className="mt-2 text-[16px] font-bold tabular-nums">{formatCOP(item.precio)}</p>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100">
          <IconX className="h-4 w-4" />
        </button>
      </div>
      <div className="h-px bg-zinc-100" />

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {item.grupos_opciones.map((r) => {
          const g = grupos[r.grupo_id];
          const valor = opciones[r.grupo_id] || [];
          return (
            <div key={r.grupo_id}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[14px] font-semibold">{r.etiqueta}</p>
                {r.min > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${valor.length >= r.min ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>{valor.length >= r.min ? 'Listo' : 'Obligatorio'}</span>}
              </div>
              <div className="space-y-2">
                {g.opciones.filter((o) => o.activo !== false).map((o) => {
                  const on = valor.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOpciones({ ...opciones, [r.grupo_id]: r.max === 1 ? [o.id] : on ? valor.filter((x) => x !== o.id) : valor.length < r.max ? [...valor, o.id] : valor })}
                      className={`choice flex w-full items-center gap-3 px-3.5 py-3 text-left ${on ? 'choice-on' : ''}`}
                    >
                      <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300'}`}>
                        {on && <IconCheck className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 text-[14px] font-medium">{o.nombre}</span>
                      {o.precio_extra > 0 && <span className="text-[13px] font-semibold tabular-nums text-zinc-500">+{formatCOP(o.precio_extra)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {item.modificadores.length > 0 && (
          <div>
            <p className="mb-2 text-[14px] font-semibold">Adicionales</p>
            <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
              {item.modificadores.map((m) => (
                <FilaOpcion key={m.id} activo={mods.includes(m.id)} onClick={() => setMods(mods.includes(m.id) ? mods.filter((x) => x !== m.id) : [...mods, m.id])} titulo={m.nombre} precio={m.precio} />
              ))}
            </div>
          </div>
        )}

        {item.ingredientes_removibles?.length > 0 && (
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[14px] font-semibold">¿Quieres quitar algo?</p>
              <span className="text-[12px] text-zinc-400">Toca para quitar</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.ingredientes_removibles.map((ing) => {
                const quitado = sin.includes(ing);
                return (
                  <button
                    key={ing}
                    type="button"
                    onClick={() => setSin(quitado ? sin.filter((x) => x !== ing) : [...sin, ing])}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition active:scale-[.97] ${
                      quitado ? 'border-red-300 bg-red-50 text-red-700' : 'border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    {quitado ? <><span className="font-bold">Sin</span><span className="line-through decoration-red-400">{ing}</span></> : ing}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {verNota ? (
          <textarea autoFocus value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={80} placeholder="Ej: sin cebolla" className="field resize-none" />
        ) : (
          <button onClick={() => setVerNota(true)} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-zinc-600 hover:text-zinc-900">
            <IconNote className="h-4 w-4" /> Agregar nota para la cocina
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-zinc-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Stepper cantidad={cantidad} setCantidad={setCantidad} />
        <button disabled={errores.length > 0} onClick={() => onAgregar(item, sel)} className="btn-primary flex-1 justify-between">
          <span>{errores.length ? errores[0] : 'Agregar'}</span>
          {!errores.length && <span className="tabular-nums">{formatCOP(unitario * cantidad)}</span>}
        </button>
      </div>
    </Sheet>
  );
}
