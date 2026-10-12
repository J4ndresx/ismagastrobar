import { useState } from 'react';
import { validarSeleccion } from '@shared/comandas.js';
import { ZONA_UI, cop } from '../lib/zonasUI';
import { Sheet, Stepper, IconX, IconCheck } from './ui';

/** Selección inicial: opciones por defecto (ej. "Pan", "En agua"). */
export function seleccionInicial(item, grupos) {
  const opciones = {};
  for (const ref of item.grupos_opciones) {
    const g = grupos[ref.grupo_id];
    const activas = (g?.opciones || []).filter((o) => o.activo !== false);
    // Obligatorio con una sola opción (p. ej. la única sopa del día): ya viene elegida.
    opciones[ref.grupo_id] = g?.por_defecto ? [g.por_defecto] : ref.min >= 1 && ref.max === 1 && activas.length === 1 ? [activas[0].id] : [];
  }
  return { cantidad: 1, opciones, modificadores: [], sin: [], nota: '' };
}

export function precioSeleccion(item, grupos, sel) {
  let u = item.precio || 0;
  for (const ref of item.grupos_opciones)
    for (const id of sel.opciones[ref.grupo_id] || []) u += grupos[ref.grupo_id].opciones.find((o) => o.id === id)?.precio_extra || 0;
  for (const id of sel.modificadores) u += item.modificadores.find((m) => m.id === id)?.precio || 0;
  return u * sel.cantidad;
}

/** Grupo de opciones como botones. max 1 → se comporta como radio. */
export function GrupoOpciones({ refGrupo, grupo, valor, onChange, columnas = 'grid-cols-2' }) {
  const unico = refGrupo.max === 1;
  const toggle = (id) => {
    if (unico) return onChange([id]);
    if (valor.includes(id)) return onChange(valor.filter((x) => x !== id));
    if (valor.length < refGrupo.max) onChange([...valor, id]);
  };
  const lleno = !unico && valor.length >= refGrupo.max;
  const completo = valor.length >= refGrupo.min;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-zinc-800">
          {refGrupo.etiqueta}
          {refGrupo.min > 0 && <span className="ml-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">obligatorio</span>}
        </p>
        {!unico && (
          <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${completo ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
            {valor.length}/{refGrupo.max}
          </span>
        )}
      </div>
      <div className={`grid gap-2 ${columnas}`}>
        {grupo.opciones.filter((o) => o.activo !== false).map((o) => {
          const idx = valor.indexOf(o.id);
          const on = idx !== -1;
          return (
            <button
              key={o.id}
              type="button"
              disabled={!on && lleno}
              onClick={() => toggle(o.id)}
              className={`relative flex min-h-[48px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-[14px] font-medium transition active:scale-[.98] ${
                on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 disabled:opacity-40'
              }`}
            >
              {!unico && on && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-zinc-900">{idx + 1}</span>}
              <span className="flex-1 leading-tight">{o.nombre}</span>
              {o.precio_extra > 0 && <span className={`text-[12px] ${on ? 'text-zinc-300' : 'text-zinc-400'}`}>+{cop(o.precio_extra)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Modificadores({ item, valor, onChange }) {
  if (!item.modificadores.length) return null;
  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
      {item.modificadores.map((m) => {
        const on = valor.includes(m.id);
        return (
          <button key={m.id} type="button" onClick={() => onChange(on ? valor.filter((x) => x !== m.id) : [...valor, m.id])} className="flex w-full items-center justify-between gap-3 bg-white px-3.5 py-3 text-left hover:bg-zinc-50">
            <span className="flex items-center gap-3">
              <span className={`grid h-5 w-5 place-items-center rounded-md border transition ${on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300'}`}>
                {on && <IconCheck className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span className="text-[14px] font-medium">{m.nombre}</span>
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-zinc-500">+{cop(m.precio)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** "Quitar ingredientes": cada toque marca/desmarca "Sin X". */
export function QuitarIngredientes({ item, valor, onChange }) {
  const lista = item.ingredientes_removibles || [];
  if (!lista.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-zinc-800">Quitar ingredientes <span className="ml-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">opcional</span></p>
        {valor.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-800">Limpiar</button>}
      </div>
      <div className="flex flex-wrap gap-2">
        {lista.map((ing) => {
          const quitado = valor.includes(ing);
          return (
            <button
              key={ing}
              type="button"
              onClick={() => onChange(quitado ? valor.filter((x) => x !== ing) : [...valor, ing])}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition active:scale-[.97] ${
                quitado ? 'border-red-300 bg-red-50 text-red-700' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
              }`}
            >
              {quitado ? <><span className="font-bold">Sin</span><span className="line-through decoration-red-400">{ing}</span></> : ing}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ItemDialog({ item, grupos, onCerrar, onAgregar }) {
  const [sel, setSel] = useState(() => seleccionInicial(item, grupos));
  const errores = validarSeleccion(item, sel);
  const z = ZONA_UI[item.zona_preparacion];

  return (
    <Sheet onClose={onCerrar}>
      <div className="flex items-start gap-3 border-b border-zinc-100 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <p className={`mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${z.texto}`}>
            <span className={`h-2 w-2 rounded-full ${z.dot}`} /> {z.nombre}
          </p>
          <h2 className="text-[18px] font-bold leading-tight tracking-tight">{item.nombre}</h2>
          {item.descripcion && <p className="mt-1 text-[13px] text-zinc-500">{item.descripcion}</p>}
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100">
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {item.grupos_opciones.map((ref) => (
          <GrupoOpciones
            key={ref.grupo_id}
            refGrupo={ref}
            grupo={grupos[ref.grupo_id]}
            valor={sel.opciones[ref.grupo_id] || []}
            onChange={(v) => setSel({ ...sel, opciones: { ...sel.opciones, [ref.grupo_id]: v } })}
          />
        ))}
        <Modificadores item={item} valor={sel.modificadores} onChange={(v) => setSel({ ...sel, modificadores: v })} />
        <QuitarIngredientes item={item} valor={sel.sin} onChange={(v) => setSel({ ...sel, sin: v })} />
        <input value={sel.nota} onChange={(e) => setSel({ ...sel, nota: e.target.value })} maxLength={80} placeholder="Nota para la cocina (opcional)" className="field" />
      </div>

      <div className="flex items-center gap-3 border-t border-zinc-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Stepper cantidad={sel.cantidad} setCantidad={(c) => setSel({ ...sel, cantidad: c })} />
        <button disabled={errores.length > 0} onClick={() => onAgregar(sel)} className="btn-primary flex-1 justify-between">
          <span>{errores.length ? errores[0] : 'Agregar'}</span>
          {!errores.length && <span className="tabular-nums">{cop(precioSeleccion(item, grupos, sel))}</span>}
        </button>
      </div>
    </Sheet>
  );
}
