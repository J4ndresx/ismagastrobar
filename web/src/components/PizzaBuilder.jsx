import { useState } from 'react';
import { validarSeleccion } from '@shared/comandas.js';
import { cop } from '../lib/zonasUI';
import { GrupoOpciones, Modificadores, precioSeleccion } from './ItemDialog';
import { Stepper, PizzaGlyph } from './ui';

/**
 * Pizza en UNA pantalla (la vendedora necesita velocidad, no guía):
 * tamaño → sabores (contador) → combo/queso → Agregar.
 */
export default function PizzaBuilder({ items, grupos, onAgregar, BotonItem }) {
  const tamanos = items.filter((i) => i.grupos_opciones.some((g) => g.grupo_id === 'sabores_pizza')).sort((a, b) => a.orden - b.orden);
  const otros = items.filter((i) => !tamanos.includes(i));
  const [tamanoId, setTamanoId] = useState(null);
  const [sel, setSel] = useState({ cantidad: 1, opciones: { sabores_pizza: [] }, modificadores: [], nota: '' });

  const tamano = tamanos.find((t) => t.id === tamanoId);
  const ref = tamano?.grupos_opciones.find((g) => g.grupo_id === 'sabores_pizza');
  const errores = tamano ? validarSeleccion(tamano, sel) : ['Elige el tamaño.'];

  const elegirTamano = (t) => {
    const max = t.grupos_opciones[0].max;
    setTamanoId(t.id);
    setSel((s) => ({
      ...s,
      opciones: { sabores_pizza: s.opciones.sabores_pizza.slice(0, max) },
      modificadores: s.modificadores.filter((id) => t.modificadores.some((m) => m.id === id)),
    }));
  };

  const agregar = () => {
    onAgregar(tamano, sel);
    setSel({ cantidad: 1, opciones: { sabores_pizza: [] }, modificadores: [], nota: '' });
  };

  return (
    <div className="space-y-5">
      <section>
        <p className="mb-2 text-[13px] font-semibold text-zinc-800">1. Tamaño</p>
        <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
          {tamanos.map((t) => {
            const on = t.id === tamanoId;
            const g = t.grupos_opciones[0];
            return (
              <button
                key={t.id}
                onClick={() => elegirTamano(t)}
                className={`flex min-h-[92px] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition active:scale-[.98] ${
                  on ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <PizzaGlyph tamano={{ id: t.id.replace('pizza_', '').replace('_2', '2'), maxSabores: g.max }} activo={on} size={30} />
                <span className="mt-1 text-[13px] font-semibold leading-tight">{t.nombre.replace('Pizza ', '')}</span>
                <span className="text-[11px] text-zinc-500">
                  {g.min === g.max ? `${g.max} sabor${g.max > 1 ? 'es' : ''}` : `hasta ${g.max}`}
                </span>
                <span className="text-[12px] font-semibold tabular-nums">{cop(t.precio)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={tamano ? '' : 'pointer-events-none opacity-40'}>
        <GrupoOpciones
          refGrupo={ref ? { ...ref, etiqueta: `2. ${ref.etiqueta}` } : { grupo_id: 'sabores_pizza', etiqueta: '2. Sabores', min: 1, max: 1 }}
          grupo={grupos.sabores_pizza}
          valor={sel.opciones.sabores_pizza}
          onChange={(v) => setSel({ ...sel, opciones: { sabores_pizza: v } })}
          columnas="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"
        />
      </section>

      {tamano && (
        <section className="space-y-3 animate-rise">
          <p className="text-[13px] font-semibold text-zinc-800">3. Adicionales</p>
          <Modificadores item={tamano} valor={sel.modificadores} onChange={(v) => setSel({ ...sel, modificadores: v })} />
          <input value={sel.nota} onChange={(e) => setSel({ ...sel, nota: e.target.value })} maxLength={80} placeholder="Nota para el pizzero (opcional)" className="field" />
        </section>
      )}

      <div className="sticky bottom-[84px] z-10 -mx-4 flex lg:bottom-0 items-center gap-3 border-t border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <Stepper cantidad={sel.cantidad} setCantidad={(c) => setSel({ ...sel, cantidad: c })} />
        <button disabled={errores.length > 0} onClick={agregar} className="btn-primary flex-1 justify-between">
          <span className="truncate">{errores.length ? errores[0] : <>Agregar<span className="hidden sm:inline"> {tamano.nombre.replace('Pizza ', '')}</span></>}</span>
          {!errores.length && <span className="tabular-nums">{cop(precioSeleccion(tamano, grupos, sel))}</span>}
        </button>
      </div>

      {otros.length > 0 && (
        <section>
          <p className="mb-2 text-[13px] font-semibold text-zinc-800">Otros de pizzería</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{otros.map((i) => <BotonItem key={i.id} item={i} />)}</div>
        </section>
      )}
    </div>
  );
}
