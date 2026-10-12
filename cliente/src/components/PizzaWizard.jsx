import { useEffect, useState } from 'react';
import { formatCOP } from '../utils/formato';
import { Sheet, PizzaGlyph, Stepper, IconChevronLeft, IconX, IconCheck, IconNote, IconChevronRight } from './ui';

/** Tamaños de pizza = ítems de la categoría pizzas que tienen grupo de sabores. */
export const esTamanoPizza = (i) => i.grupos_opciones?.some((g) => g.grupo_id === 'sabores_pizza');
export const refSabores = (i) => i.grupos_opciones.find((g) => g.grupo_id === 'sabores_pizza');
export const glyph = (i) => ({ id: i.id.replace('pizza_', '').replace('_2', '2'), maxSabores: refSabores(i).max });

/**
 * Asistente paso a paso para el cliente (bottom sheet):
 *  "tamano" → "sabor" (uno a la vez, avanza solo) → "extras".
 */
export default function PizzaWizard({ abierto, tamanoInicial, menu, onCerrar, onAgregar }) {
  const tamanos = menu.items.filter(esTamanoPizza).sort((a, b) => a.orden - b.orden);
  const sabores = (menu.grupos.sabores_pizza?.opciones || []).filter((o) => o.activo !== false);

  const [paso, setPaso] = useState('tamano');
  const [tamanoId, setTamanoId] = useState(null);
  const [elegidos, setElegidos] = useState([]);
  const [mods, setMods] = useState([]);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState('');
  const [verNota, setVerNota] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setTamanoId(tamanoInicial ?? null);
    setPaso(tamanoInicial ? 'sabor' : 'tamano');
    setElegidos([]);
    setMods([]);
    setCantidad(1);
    setNota('');
    setVerNota(false);
  }, [abierto, tamanoInicial]);

  if (!abierto) return null;

  const tamano = tamanos.find((t) => t.id === tamanoId);
  const ref = tamano && refSabores(tamano);
  const numSabor = elegidos.length + 1;
  const esOpcional = ref && elegidos.length >= ref.min;
  const unitario = tamano ? tamano.precio + mods.reduce((s, id) => s + (tamano.modificadores.find((m) => m.id === id)?.precio || 0), 0) : 0;

  const elegirTamano = (id) => {
    setTamanoId(id);
    setElegidos([]);
    setMods([]);
    setPaso('sabor');
  };
  const elegirSabor = (id) => {
    const nuevos = [...elegidos, id];
    setElegidos(nuevos);
    if (nuevos.length >= ref.max) setPaso('extras');
  };
  const atras = () => {
    if (paso === 'extras') { setElegidos((s) => s.slice(0, -1)); setPaso('sabor'); }
    else if (paso === 'sabor') { if (elegidos.length) setElegidos((s) => s.slice(0, -1)); else setPaso('tamano'); }
    else onCerrar();
  };
  const agregar = () =>
    onAgregar(tamano, { cantidad, opciones: { sabores_pizza: elegidos }, modificadores: mods, nota });

  const totalPasos = ref ? ref.max + 2 : 3;
  const pasoActual = paso === 'tamano' ? 1 : paso === 'sabor' ? 1 + numSabor : totalPasos;
  const titulo = paso === 'tamano' ? 'Elige el tamaño' : paso === 'sabor' ? (ref.max === 1 ? 'Elige el sabor' : `Sabor ${numSabor} de ${ref.max}`) : 'Personaliza tu pizza';
  const nombreSabor = (id) => sabores.find((s) => s.id === id)?.nombre;

  return (
    <Sheet onClose={onCerrar}>
      <div className="px-5 pt-3">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-zinc-200 sm:hidden" />
        <div className="flex items-center gap-3">
          <button onClick={atras} aria-label="Atrás" className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50">
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Paso {pasoActual} de {totalPasos}
              {paso === 'sabor' && esOpcional && <span className="ml-1.5 normal-case tracking-normal text-zinc-500">· opcional</span>}
            </p>
            <h2 className="truncate text-[17px] font-bold tracking-tight">{titulo}</h2>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: totalPasos }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < pasoActual ? 'bg-brand-600' : 'bg-zinc-100'}`} />
          ))}
        </div>
        {tamano && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-zinc-900 px-2 py-1 text-[12px] font-semibold text-white">{tamano.nombre.replace('Pizza ', '')}</span>
            {elegidos.map((id, i) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[12px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
                <span className="tabular-nums text-brand-500">{i + 1}.</span> {nombreSabor(id)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 h-px bg-zinc-100" />

      <div key={paso + elegidos.length} className="flex-1 overflow-y-auto px-5 py-4 animate-rise">
        {paso === 'tamano' && (
          <div className="grid grid-cols-2 gap-2.5">
            {tamanos.map((t) => <TarjetaTamano key={t.id} t={t} onClick={() => elegirTamano(t.id)} />)}
          </div>
        )}

        {paso === 'sabor' && (
          <>
            {esOpcional && (
              <button onClick={() => setPaso('extras')} className="mb-3 flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-left text-[14px] font-semibold text-zinc-700 hover:bg-zinc-100">
                <span>Continuar con {elegidos.length} sabor{elegidos.length > 1 ? 'es' : ''}</span>
                <IconChevronRight className="h-4 w-4" />
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              {sabores.map((s) => {
                const usado = elegidos.includes(s.id);
                return (
                  <button key={s.id} disabled={usado} onClick={() => elegirSabor(s.id)} className={`choice relative px-3 py-2.5 text-left active:scale-[.98] ${usado ? 'choice-on cursor-default' : ''}`}>
                    <span className="block pr-5 text-[14px] font-semibold leading-tight">{s.nombre}</span>
                    {s.detalle && <span className="mt-0.5 block truncate text-[12px] text-zinc-500">{s.detalle}</span>}
                    {usado && (
                      <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-white">
                        <IconCheck className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {paso === 'extras' && (
          <div className="space-y-5">
            {tamano.modificadores.length > 0 && (
              <div>
                <p className="label">Adicionales</p>
                <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
                  {tamano.modificadores.map((m) => (
                    <FilaOpcion key={m.id} activo={mods.includes(m.id)} onClick={() => setMods(mods.includes(m.id) ? mods.filter((x) => x !== m.id) : [...mods, m.id])} titulo={m.nombre} precio={m.precio} />
                  ))}
                </div>
              </div>
            )}
            <div>
              {verNota ? (
                <>
                  <label className="label" htmlFor="nota">Nota para la cocina</label>
                  <textarea id="nota" autoFocus value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={80} placeholder="Ej: bien tostada" className="field resize-none" />
                </>
              ) : (
                <button onClick={() => setVerNota(true)} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-zinc-600 hover:text-zinc-900">
                  <IconNote className="h-4 w-4" /> Agregar nota para la cocina
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-medium text-zinc-700">Cantidad</p>
              <Stepper cantidad={cantidad} setCantidad={setCantidad} />
            </div>
          </div>
        )}
      </div>

      {paso === 'extras' && (
        <div className="border-t border-zinc-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={agregar} className="btn-primary w-full justify-between">
            <span>Agregar al pedido</span>
            <span className="tabular-nums">{formatCOP(unitario * cantidad)}</span>
          </button>
        </div>
      )}
    </Sheet>
  );
}

export function TarjetaTamano({ t, onClick }) {
  const r = refSabores(t);
  return (
    <button onClick={onClick} className="choice group flex flex-col items-start p-3.5 text-left hover:shadow-card active:scale-[.98]">
      <PizzaGlyph tamano={glyph(t)} />
      <span className="mt-2 text-[15px] font-semibold leading-tight">{t.nombre.replace('Pizza ', '')}</span>
      <span className="mt-0.5 text-[12px] text-zinc-500">
        {t.atributos?.diametro_cm ? `${t.atributos.diametro_cm} cm · ` : ''}
        {r.min === r.max ? `${r.max} sabor${r.max > 1 ? 'es' : ''}` : `hasta ${r.max} sabores`}
      </span>
      <span className="mt-2 text-[15px] font-bold tabular-nums text-zinc-900">{formatCOP(t.precio)}</span>
    </button>
  );
}

export function FilaOpcion({ activo, onClick, titulo, precio }) {
  return (
    <button type="button" role="switch" aria-checked={activo} onClick={onClick} className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3.5 text-left hover:bg-zinc-50">
      <span className="flex items-center gap-3">
        <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${activo ? 'bg-brand-600' : 'bg-zinc-200'}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${activo ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
        <span className="text-[14px] font-medium text-zinc-800">{titulo}</span>
      </span>
      <span className="text-[14px] font-semibold tabular-nums text-zinc-500">+{formatCOP(precio)}</span>
    </button>
  );
}
