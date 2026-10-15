// Lista de productos de UNA categoría (se abre al tocar una tarjeta de la Home).
// Arriba, fija, la barra "Volver al inicio" para regresar a la cuadrícula.
// Los productos se muestran con el mismo componente de siempre (Seccion), así que el diseño
// de cada categoría (incluida Parrilla y Especiales en gris ratón) y el "Agregar" no cambian.
import { Seccion } from './Menu';

const IconAtras = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export default function VistaCategoria({ cat, bloques, nombreDe, onProducto, onArmarPizza, onVolver }) {
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
      </div>

      {cat ? (
        <Seccion cat={cat} bloques={bloques} esPizza={cat.id === 'pizzas'} nombreDe={nombreDe} onProducto={onProducto} onArmarPizza={onArmarPizza} />
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
