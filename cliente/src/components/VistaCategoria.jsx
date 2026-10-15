// Lista de productos de UNA categoría (se abre al tocar una tarjeta de la Home).
// Arriba, fija, la barra "Volver al inicio" y, si la categoría tiene subcategorías
// (p. ej. Bebidas: Cervezas, Licores…), una fila de pestañas para filtrar.
// Los productos se muestran con el mismo componente de siempre (Seccion), así que el diseño
// de cada categoría (incluida Parrilla y Especiales en gris ratón) y el "Agregar" no cambian.
import { useState } from 'react';
import { Seccion } from './Menu';

const IconAtras = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const TODAS = '__todas';

/** Pestañas de subcategoría. Solo salen las que tienen productos disponibles ahora. */
function Pestanas({ grupos, activa, onElegir }) {
  const total = grupos.reduce((s, g) => s + g.items.length, 0);
  const lista = [{ id: TODAS, nombre: 'Todas', n: total }, ...grupos.map((g) => ({ id: g.id, nombre: g.nombre, n: g.items.length, dinamica: g.dinamica }))];
  return (
    <div role="tablist" aria-label="Subcategorías" className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
      {lista.map((p) => {
        const on = p.id === activa;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onElegir(p.id)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-95 ${on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'}`}
          >
            {p.dinamica && <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-white' : 'bg-brand-600'}`} aria-hidden="true" />}
            {p.nombre}
            <span className={`text-[11.5px] tabular-nums ${on ? 'text-white/60' : 'text-zinc-400'}`}>{p.n}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function VistaCategoria({ cat, bloques, nombreDe, onProducto, onArmarPizza, onVolver }) {
  const [sub, setSub] = useState(TODAS);
  const grupos = bloques?.grupos || [];
  const conSubs = grupos.length > 1 || (grupos.length === 1 && !!grupos[0].id);
  const subActiva = grupos.some((g) => g.id === sub) ? sub : TODAS; // si la elegida se quedó sin productos
  const visibles = subActiva === TODAS ? bloques : { ...bloques, grupos: grupos.filter((g) => g.id === subActiva) };

  const elegir = (id) => { setSub(id); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="animate-rise">
      {/* Barra fija bajo el encabezado de la app */}
      <div className="sticky top-[61px] z-10 -mx-4 mb-4 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2.5 backdrop-blur lg:mx-0 lg:px-0">
        <button
          type="button"
          onClick={onVolver}
          className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white py-2 pl-2.5 pr-4 text-[14px] font-semibold text-zinc-800 shadow-sm transition hover:border-brand-600 hover:text-brand-600 active:scale-95"
        >
          <IconAtras className="h-4 w-4 transition group-hover:-translate-x-0.5" />
          Volver al inicio
        </button>
        {cat && conSubs && <Pestanas grupos={grupos} activa={subActiva} onElegir={elegir} />}
      </div>

      {cat ? (
        <Seccion cat={cat} bloques={visibles} esPizza={cat.id === 'pizzas'} nombreDe={nombreDe} onProducto={onProducto} onArmarPizza={onArmarPizza} />
      ) : (
        <p className="card px-5 py-8 text-center text-[14px] text-zinc-500">Esta categoría ya no está disponible.</p>
      )}

      {/* Al final de la lista: volver sin tener que subir */}
      <button type="button" onClick={onVolver} className="btn-secondary mt-6 w-full">
        <IconAtras className="h-4 w-4" /> Ver todas las categorías
      </button>
    </div>
  );
}
