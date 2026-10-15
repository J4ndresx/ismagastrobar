// Home de la app del cliente: el tablero del local ("ISMA GASTRO-BAR · Restaurante · Bar · Parrilla")
// pasado a pantalla. Cuadrícula 3×3 + "Adicionales" a lo ancho.
//
// Navegación: usa el mismo `irA(id)` del resto de la app (baja a la sección de esa categoría).
// No toca Firestore: cada tarjeta busca su categoría por una lista de ids, en orden. Si ninguna
// existe (o no tiene productos), la tarjeta sale como "Pronto" y se activa sola el día que el
// restaurante cree esa categoría (p. ej. id 'desayunos' o 'entradas').
import { forwardRef } from 'react';

// ─── Colores de marca ────────────────────────────────────────────────────
// Rojo ISMA (brand-600 de Tailwind), dorado y negro. Ver también tailwind.config.js.
const ORO = '#C9A227';

// ─── Íconos (trazo a mano, como el tablero) ──────────────────────────────
const Svg = ({ children, className, ancho = false }) => (
  <svg viewBox={ancho ? '0 0 48 36' : '0 0 48 48'} preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);
const ICONOS = {
  desayunos: ( // huevo frito
    <>
      <path d="M8 26c-2-7 4-12 10-11 3-4 11-5 15-1 6 0 10 6 7 11 2 6-4 10-10 9-4 4-12 4-15 0-6 1-9-3-7-8Z" />
      <circle cx="24" cy="25" r="5.5" fill="currentColor" fillOpacity=".12" />
      <path d="M22 23.5a2.5 2.5 0 0 1 3-1" />
    </>
  ),
  menu_dia: ( // plato hondo con arroz
    <>
      <path d="M7 24h34c0 9-7.6 15-17 15S7 33 7 24Z" />
      <path d="M17 39h14" />
      <path d="M13 22c1-5 5-8 11-8s10 3 11 8" />
      {[[17, 19], [21, 16.5], [26, 16], [30, 18.5], [24, 20], [19, 22], [29, 22]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r=".9" fill="currentColor" />)}
    </>
  ),
  tipicos: ( // pernil / presa de pollo
    <>
      <path d="M30 10c6 0 10 4 10 9 0 6-5 10-11 10-2 0-4 1-5 3l-6 6" />
      <path d="M30 10c-6 0-10 4-10 9 0 2 0 4 2 6" />
      <path d="M18 38c-1 3-5 3-6 1-2 0-3-3-1-4-2-1-1-5 2-5 1-2 4-1 5 1" />
      <path d="M27 15c2 0 4 1 5 3" />
    </>
  ),
  pescado: ( // pescado
    <>
      <path d="M6 24c5-8 13-12 21-12 7 0 12 5 15 12-3 7-8 12-15 12-8 0-16-4-21-12Z" />
      <path d="M6 24 2 17m4 7-4 7" />
      <circle cx="34" cy="21.5" r="1.4" fill="currentColor" />
      <path d="M22 18c-2 4-2 8 0 12" />
      <path d="M38 29c-1 1-3 1-4 0" />
    </>
  ),
  asados: ( // carne humeante
    <>
      <path d="M8 34c-2-5 2-10 9-10h15c7 0 10 4 9 8-1 5-8 7-17 6-7 0-14 0-16-4Z" />
      <path d="M15 30c3 1 7 1 10 0m2 3c3 1 6 0 8-2" />
      <path d="M16 18c-2-2 2-4 0-7m8 7c-2-2 2-4 0-7m8 7c-2-2 2-4 0-7" />
    </>
  ),
  especiales: ( // hamburguesa
    <>
      <path d="M9 21c0-7 7-11 15-11s15 4 15 11Z" />
      <path d="M7 26c3-2 6 2 9 0s6 2 9 0 6 2 9 0 5 1 7 0" />
      <path d="M9 30h30" />
      <path d="M10 34h28c0 3-2 5-5 5H15c-3 0-5-2-5-5Z" />
      {[[18, 15], [24, 13.5], [30, 15], [21, 18], [27, 18]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r=".9" fill="currentColor" />)}
    </>
  ),
  picadas: ( // bandeja con trozos
    <>
      <path d="M4 32c0 4 9 7 20 7s20-3 20-7" />
      <path d="M4 32h40" />
      <rect x="9" y="24" width="8" height="8" rx="2" />
      <rect x="18" y="20" width="8" height="12" rx="2.5" />
      <circle cx="31" cy="27" r="4.5" />
      <path d="M36 32c0-4 2-7 5-7" />
      <path d="M21 24h2m-10 4h0" />
    </>
  ),
  bebidas: ( // vaso con pitillo
    <>
      <path d="M12 16h24l-3 24H15Z" />
      <path d="M13.5 24h21" />
      <path d="M26 16l4-10 5 1" />
    </>
  ),
  entradas: ( // tajada de queso / pan
    <>
      <path d="M8 22 34 10l6 12v14L8 40Z" />
      <path d="M8 22h32" />
      {[[15, 30], [22, 34], [28, 28], [34, 33], [19, 26]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" />)}
    </>
  ),
  adicionales: ( // copa, vaso y plato humeante (como el tablero)
    <>
      <path d="M3 7h10c0 6-2.2 9-5 9s-5-3-5-9Zm5 9v12m-3.5 0h7" />
      <path d="M18 9h9l-1.2 19h-6.6Z" />
      <path d="M31 25c0-4 3-6.5 7-6.5s7 2.5 7 6.5Z" />
      <path d="M30 28h16" />
      <path d="M35 14c-1.2-1.2 1.2-2.4 0-4.6m5.5 4.6c-1.2-1.2 1.2-2.4 0-4.6" />
    </>
  ),
};

// ─── Tablero ────────────────────────────────────────────────────────────
// `ids`: categorías candidatas en orden. Hoy en Firestore existen: menu_del_dia, tradicional,
// proteinas, a_la_carta, picadas, parrilla_especiales, bebidas, adicionales.
export const TABLERO = [
  { clave: 'desayunos', nombre: 'Desayunos', ids: ['desayunos'] },
  { clave: 'menu_dia', nombre: 'Menú del Día', ids: ['menu_del_dia'], destacado: true },
  { clave: 'tipicos', nombre: 'Típicos Paisas', ids: ['tipicos_paisas', 'tradicional'] },
  { clave: 'pescado', nombre: 'Pescado', ids: ['pescado', 'a_la_carta'] },
  { clave: 'asados', nombre: 'Asados', ids: ['asados', 'a_la_carta'] },
  { clave: 'especiales', nombre: 'Especiales', ids: ['especiales', 'parrilla_especiales'] },
  { clave: 'picadas', nombre: 'Picadas', ids: ['picadas'] },
  { clave: 'bebidas', nombre: 'Bebidas', ids: ['bebidas'] },
  { clave: 'entradas', nombre: 'Entradas', ids: ['entradas'] },
];
export const ADICIONALES = { clave: 'adicionales', nombre: 'Adicionales', ids: ['adicionales'] };

/** Primera categoría candidata que el cliente puede ver ahora (existe y tiene productos). */
const destino = (t, disponibles) => t.ids.find((id) => disponibles.has(id)) || null;

function Tarjeta({ t, catId, listo, onIr, ancho = false }) {
  const activa = listo && !!catId;
  const pronto = listo && !catId;
  const aviso = pronto ? (t.clave === 'menu_dia' ? 'Aún no publicado' : 'Pronto') : null;
  return (
    <button
      type="button"
      onClick={() => activa && onIr(catId)}
      disabled={!activa}
      aria-label={aviso ? `${t.nombre} (${aviso.toLowerCase()})` : `Ver ${t.nombre}`}
      className={`group relative flex rounded-2xl border bg-white text-center transition duration-200
        ${ancho ? 'col-span-3 flex-row items-center justify-center gap-4 px-5 py-4' : 'aspect-[4/5] flex-col items-center justify-center gap-2.5 px-1.5 py-3 sm:aspect-square'}
        ${activa ? 'border-zinc-200 shadow-[0_1px_2px_rgba(16,24,40,.05),0_4px_14px_-6px_rgba(16,24,40,.12)] hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-[0_10px_24px_-10px_rgba(200,16,46,.35)] active:translate-y-0 active:scale-[.97]' : 'border-dashed border-zinc-300 bg-zinc-50/60'}
        ${!listo ? 'animate-pulse' : ''}`}
    >
      {t.destacado && activa && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">Hoy</span>
      )}
      <span
        className={`grid shrink-0 place-items-center rounded-full transition ${ancho ? 'h-14 w-[108px]' : 'h-[60px] w-[60px] sm:h-[68px] sm:w-[68px]'} ${activa ? 'text-zinc-900 group-hover:text-brand-600' : 'text-zinc-400'}`}
        style={{ background: activa ? '#FBF6E9' : '#F1F1F3', boxShadow: activa ? `inset 0 0 0 1.5px ${ORO}55` : 'none' }}
      >
        <Svg ancho={ancho} className={ancho ? 'h-10 w-[72px]' : 'h-10 w-10 sm:h-11 sm:w-11'}>{ICONOS[t.clave]}</Svg>
      </span>
      <span className="min-w-0">
        <span className={`block font-extrabold uppercase leading-tight tracking-tight ${ancho ? 'text-[15px]' : 'text-[11.5px] sm:text-[13px]'} ${activa ? 'text-zinc-900' : 'text-zinc-400'}`}>
          {t.nombre}
        </span>
        {aviso && <span className="mt-0.5 block text-[10.5px] font-semibold text-zinc-400">{aviso}</span>}
      </span>
    </button>
  );
}

/**
 * Home del cliente.
 * @param raices  categorías visibles (las mismas que usa el resto de la app: activas y con productos)
 * @param listo   false mientras carga el menú (las tarjetas se ven en espera, sin "Pronto")
 * @param onIr    navegación existente de la app: irA(categoriaId)
 * El ref se pone en la cuadrícula: App lo usa para mostrar la barra fija de categorías al bajar.
 */
const Home = forwardRef(function Home({ raices = [], listo = true, onIr }, ref) {
  const disponibles = new Set(raices.map((c) => c.id));
  return (
    <section aria-labelledby="isma-home-titulo">
      <header className="mb-5 text-center">
        <h1 id="isma-home-titulo" className="text-[28px] font-black uppercase leading-none tracking-[.04em] text-zinc-900 sm:text-[34px]">
          Isma <span className="text-brand-600">Gastro</span>-Bar
        </h1>
        <p className="mt-2 flex items-center justify-center gap-2 text-[11.5px] font-semibold uppercase tracking-[.28em] text-zinc-500 sm:text-[12.5px]">
          Restaurante <i className="h-1.5 w-1.5 rounded-full" style={{ background: ORO }} /> Bar <i className="h-1.5 w-1.5 rounded-full" style={{ background: ORO }} /> Parrilla
        </p>
        <div className="mx-auto mt-3 h-[3px] w-14 rounded-full" style={{ background: `linear-gradient(90deg, #C8102E, ${ORO})` }} />
      </header>

      <div ref={ref} className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        {TABLERO.map((t) => <Tarjeta key={t.clave} t={t} catId={destino(t, disponibles)} listo={listo} onIr={onIr} />)}
        <Tarjeta t={ADICIONALES} catId={destino(ADICIONALES, disponibles)} listo={listo} onIr={onIr} ancho />
      </div>
    </section>
  );
});

export default Home;
