import { formatCOP } from '../utils/formato';
import { IconoCategoria } from '../data/iconos.jsx';
import { refSabores, glyph } from './PizzaWizard';
import { PizzaGlyph, IconPlus, IconChevronRight, IconX, IconBike, IconStore, Sheet } from './ui';

export const IconSearch = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
export const IconGrid = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

// Categorías especiales (tema 'oscuro' en Firestore, p. ej. Parrilla y Especiales): se pintan en gris ratón
// en el menú de categorías y en su sección, para diferenciarlas del resto.
const esEspecial = (c) => c?.tema === 'oscuro';

/** Portada: saludo corto y cómo funciona el pedido. */
export function Portada() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-[#8f0a20] px-5 py-5 text-white shadow-pop sm:px-7 sm:py-8">
      <div className="relative z-10 max-w-[72%] sm:max-w-[65%]">
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight sm:text-[30px]">¿Qué se te antoja hoy?</h1>
        <p className="mt-1.5 text-[14px] leading-snug text-white/85 sm:text-[15px]">Pide en 3 pasos: elige, revisa tu pedido y te lo llevamos.</p>
        <div className="mt-3.5 flex flex-wrap gap-1.5 text-[12px] font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-inset ring-white/25"><IconBike className="h-3.5 w-3.5" /> Domicilio</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 ring-1 ring-inset ring-white/25"><IconStore className="h-3.5 w-3.5" /> Recoger</span>
        </div>
      </div>
      <IconoCategoria id="platos" strokeWidth={1.1} className="absolute -bottom-8 -right-6 h-40 w-40 rotate-[-12deg] text-white/20 sm:-bottom-10 sm:h-56 sm:w-56" />
    </section>
  );
}

/** Todas las categorías a la vista: nada queda escondido en un carrusel. */
export function GridCategorias({ raices, conteo, onIr }) {
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-bold tracking-tight">Categorías</h2>
      <div className="grid grid-cols-4 gap-x-1 gap-y-2 sm:grid-cols-5 lg:grid-cols-7">
        {raices.map((c) => (
          <button key={c.id} onClick={() => onIr(c.id)} className="group flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-center transition active:scale-95">
            <span className={`grid aspect-square w-full max-w-[76px] place-items-center rounded-2xl border shadow-card transition ${esEspecial(c) ? 'border-[#3A3B3F] bg-[#5C5D62] text-[#F4EEE2]' : 'border-zinc-200 bg-white text-zinc-700 group-hover:border-zinc-300 group-hover:text-brand-600'}`}>
              <IconoCategoria id={c.id} className="h-8 w-8" />
            </span>
            <span className={`-mx-1 line-clamp-2 w-[calc(100%+8px)] text-[11px] font-semibold leading-tight tracking-tight ${esEspecial(c) ? 'text-[#55565B]' : 'text-zinc-700'}`}>{c.nombre}</span>
            <span className="sr-only">{conteo[c.id]} productos</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Barra fija (celular/tablet): categoría actual resaltada + botón para ver todas. */
export function BarraCategorias({ raices, activa, onIr, onVerTodas, refFila }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <button onClick={onVerTodas} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-zinc-800 shadow-sm">
        <IconGrid className="h-4 w-4" /> Menú
      </button>
      <div ref={refFila} className="relative flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {raices.map((c) => (
          <button
            key={c.id}
            data-cat={c.id}
            onClick={() => onIr(c.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${esEspecial(c) ? (c.id === activa ? 'bg-[#5C5D62] text-[#F4EEE2]' : 'bg-[#DCDCDF] text-[#55565B] ring-1 ring-inset ring-[#9A9BA0]') : c.id === activa ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
          >
            <IconoCategoria id={c.id} className="h-4 w-4" strokeWidth={2} /> {c.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lista lateral (PC). */
export function NavLateral({ raices, activa, conteo, onIr }) {
  return (
    <nav className="space-y-0.5">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Menú</p>
      {raices.map((c) => (
        <button
          key={c.id}
          onClick={() => onIr(c.id)}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] transition ${esEspecial(c) ? (c.id === activa ? 'bg-[#5C5D62] font-semibold text-[#F4EEE2] shadow-card' : 'my-0.5 bg-[#E7E7EA] font-medium text-[#55565B] hover:bg-[#DCDCDF]') : c.id === activa ? 'bg-white font-semibold text-zinc-900 shadow-card ring-1 ring-zinc-200' : 'text-zinc-600 hover:bg-white/70'}`}
        >
          <IconoCategoria id={c.id} className={`h-[18px] w-[18px] shrink-0 ${esEspecial(c) ? (c.id === activa ? 'text-[#F4EEE2]' : 'text-[#7E7F84]') : c.id === activa ? 'text-brand-600' : 'text-zinc-400'}`} />
          <span className="flex-1 truncate">{c.nombre}</span>
          <span className={`text-[12px] tabular-nums ${esEspecial(c) && c.id === activa ? 'text-[#C7C8CC]' : 'text-zinc-400'}`}>{conteo[c.id]}</span>
        </button>
      ))}
    </nav>
  );
}

/** Hoja con todas las categorías (desde el botón "Menú" de la barra). */
export function SheetCategorias({ raices, activa, conteo, onIr, onCerrar }) {
  return (
    <Sheet onClose={onCerrar}>
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 className="text-[17px] font-bold tracking-tight">¿Qué quieres ver?</h2>
        <button onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100"><IconX className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        {raices.map((c) => (
          <button key={c.id} onClick={() => onIr(c.id)} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[.98] ${esEspecial(c) ? (c.id === activa ? 'border-[#3A3B3F] bg-[#DCDCDF]' : 'border-[#9A9BA0] bg-[#EDEDEF]') : c.id === activa ? 'border-brand-600 bg-brand-50/60' : 'border-zinc-200 bg-white'}`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${esEspecial(c) ? 'bg-[#5C5D62] text-[#F4EEE2]' : 'bg-zinc-100 text-zinc-700'}`}><IconoCategoria id={c.id} className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold leading-tight">{c.nombre}</span>
              <span className="text-[12px] text-zinc-500">{conteo[c.id]} opciones</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Una categoría del menú (con sus subcategorías como subtítulos). */
export function Seccion({ cat, bloques, esPizza, nombreDe, onProducto, onArmarPizza }) {
  if (cat.tema === 'oscuro') return <SeccionOscura cat={cat} bloques={bloques} nombreDe={nombreDe} onProducto={onProducto} />;
  return (
    <section id={`cat-${cat.id}`} data-seccion={cat.id} className="scroll-mt-[128px] lg:scroll-mt-[88px]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white"><IconoCategoria id={cat.id} className="h-5 w-5" /></span>
        <h2 className="text-[21px] font-extrabold tracking-tight">{cat.nombre}</h2>
      </div>
      {esPizza && <BloquePizza tamanos={bloques.tamanos} onArmar={onArmarPizza} />}
      {bloques.grupos.map((g) => (
        <div key={g.id || 'todo'} className="mt-3 first:mt-0">
          {g.nombre && <p className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wider text-zinc-400">{g.nombre}</p>}
          <div className="card divide-y divide-zinc-100 overflow-hidden">
            {g.items.map((i) => <FilaProducto key={i.id} item={i} nombre={nombreDe(i)} onClick={() => onProducto(i)} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Sección "gris ratón" (Parrilla y Especiales), con los colores del volante de ISMA. */
function SeccionOscura({ cat, bloques, nombreDe, onProducto }) {
  return (
    <section id={`cat-${cat.id}`} data-seccion={cat.id} className="scroll-mt-[128px] rounded-3xl bg-[#3A3B3F] p-4 text-[#F4EEE2] shadow-pop sm:p-5 lg:scroll-mt-[88px]">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7A1F2B] text-[#F4EEE2] ring-1 ring-inset ring-[#A3404C]"><IconoCategoria id={cat.id} className="h-5 w-5" /></span>
        <div>
          <h2 className="text-[21px] font-extrabold leading-tight tracking-tight">{cat.nombre}</h2>
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#C7C8CC]">Tardes, noches y a la carta</p>
        </div>
      </div>
      {bloques.grupos.map((g) => (
        <div key={g.id || 'todo'} className="mt-3 first:mt-0">
          {g.nombre && <p className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wider text-[#9A9BA0]">{g.nombre}</p>}
          <div className="divide-y divide-[#5A5B61] overflow-hidden rounded-2xl border border-[#5A5B61] bg-[#47484D]">
            {g.items.map((i) => <FilaProductoOscura key={i.id} item={i} nombre={nombreDe(i)} onClick={() => onProducto(i)} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

function FilaProductoOscura({ item, nombre, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#515257] active:bg-[#5A5B61]">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold uppercase leading-tight tracking-wide text-[#F4EEE2]">{nombre}</span>
        {item.descripcion && <span className="mt-0.5 block text-[13px] leading-snug text-[#C7C8CC]">{item.descripcion}</span>}
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-[#7A1F2B] px-2.5 py-0.5 text-[15px] font-bold tabular-nums text-[#F4EEE2] ring-1 ring-inset ring-[#A3404C]">{formatCOP(item.precio)}</span>
          {item.aviso && <span className="text-[11px] font-semibold uppercase tracking-wide text-[#C7C8CC]">{item.aviso}</span>}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F4EEE2] px-3.5 py-2 text-[13px] font-semibold text-[#3A3B3F] shadow-sm">
        <IconPlus className="h-3.5 w-3.5" strokeWidth={3} /> Agregar
      </span>
    </button>
  );
}

export function FilaProducto({ item, nombre, etiqueta, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left transition hover:bg-zinc-50 active:bg-zinc-100">
      <span className="min-w-0 flex-1">
        {etiqueta && <span className="mb-0.5 block text-[11.5px] font-medium text-zinc-400">{etiqueta}</span>}
        <span className="block text-[15px] font-semibold leading-tight">{nombre}</span>
        {item.descripcion && <span className="mt-0.5 block text-[13px] leading-snug text-zinc-500">{item.descripcion}</span>}
        <span className="mt-1.5 block text-[15px] font-bold tabular-nums">{formatCOP(item.precio)}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm">
        <IconPlus className="h-3.5 w-3.5" strokeWidth={3} /> Agregar
      </span>
    </button>
  );
}

/** Pizzas: un botón claro para armarla y los tamaños como lista con precio. */
function BloquePizza({ tamanos, onArmar }) {
  return (
    <div className="card overflow-hidden">
      <button onClick={() => onArmar(null)} className="flex w-full items-center gap-4 bg-zinc-50 px-4 py-4 text-left transition hover:bg-zinc-100">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm"><IconoCategoria id="pizzas" className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold leading-tight">Arma tu pizza</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-zinc-600">Elige el tamaño y hasta 4 sabores.</span>
        </span>
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-sm">
          <IconChevronRight className="h-5 w-5" strokeWidth={2.5} />
        </span>
      </button>
      <p className="border-t border-zinc-100 px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wider text-zinc-400">O elige directo el tamaño</p>
      <div className="divide-y divide-zinc-100">
        {tamanos.map((t) => {
          const r = refSabores(t);
          return (
            <button key={t.id} onClick={() => onArmar(t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 active:bg-zinc-100">
              <PizzaGlyph tamano={glyph(t)} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-tight">{t.nombre.replace('Pizza ', '')}</span>
                <span className="text-[12.5px] text-zinc-500">
                  {t.atributos?.diametro_cm ? `${t.atributos.diametro_cm} cm · ` : ''}
                  {r.min === r.max ? `${r.max} sabor${r.max > 1 ? 'es' : ''}` : `hasta ${r.max} sabores`}
                </span>
              </span>
              <span className="text-[15px] font-bold tabular-nums">{formatCOP(t.precio)}</span>
              <IconChevronRight className="h-4 w-4 text-zinc-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Ilustración de pizza (sin fotos todavía). */
export function PizzaArte({ className }) {
  const pep = [[38, 34], [62, 30], [70, 55], [45, 60], [30, 52], [55, 44], [60, 72], [36, 74]];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#E9A23B" />
      <circle cx="50" cy="50" r="39" fill="#F6C453" />
      <circle cx="50" cy="50" r="39" fill="#F9D77E" opacity=".6" />
      {pep.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill="#C8102E" />)}
      {pep.map(([x, y], i) => <circle key={'b' + i} cx={x - 1.5} cy={y - 1.5} r="1.6" fill="#fff" opacity=".35" />)}
      <path d="M50 50 L50 4 M50 50 L90 73 M50 50 L10 73" stroke="#D08A2A" strokeWidth="1.2" opacity=".55" />
      {[[44, 44], [66, 40], [52, 66], [28, 40], [72, 64]].map(([x, y], i) => <ellipse key={'h' + i} cx={x} cy={y} rx="2.4" ry="1.2" fill="#3F7D32" transform={`rotate(${i * 40} ${x} ${y})`} />)}
    </svg>
  );
}
