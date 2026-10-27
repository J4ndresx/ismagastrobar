// Íconos de línea de cada categoría (un solo color, heredan `currentColor`).
// Mismo estilo que los íconos del panel: trazo 1.75, esquinas redondeadas.
// Para cambiar el de una categoría, edita su entrada en TRAZOS.

const TRAZOS = {
  // Porción de pizza con pepperoni
  pizzas: (
    <>
      <path d="M12 3 3.2 19.6a.7.7 0 0 0 .8 1C6.6 19.9 9.3 19.5 12 19.5s5.4.4 8 1.1a.7.7 0 0 0 .8-1Z" />
      <path d="M5.3 15.8c2.2-.6 4.5-.9 6.7-.9s4.5.3 6.7.9" />
      <circle cx="10.5" cy="11.5" r="1.1" />
      <circle cx="13.6" cy="13.6" r="1.1" />
      <circle cx="12.4" cy="8.6" r=".8" />
    </>
  ),
  // Caja de papas
  salchipapas: (
    <>
      <path d="M5.5 10h13l-1.6 10.2a1 1 0 0 1-1 .8H8.1a1 1 0 0 1-1-.8Z" />
      <path d="M8 10 7 4.5M10.5 10V3.5M13.5 10l.5-6M16 10l1.5-5" />
      <path d="M9.5 14.5c1.6.8 3.4.8 5 0" />
    </>
  ),
  // Mazorca (inclinada, con hojas)
  mazorcadas: (
    <>
      <g transform="rotate(40 13 10)">
        <path d="M13 2.5c2.3 0 3.7 3.3 3.7 7.4s-1.4 7.1-3.7 7.1-3.7-3-3.7-7.1S10.7 2.5 13 2.5Z" />
        <path d="M9.6 6.8h6.8M9.3 10h7.4M9.7 13.2h6.6M13 2.7V17" />
      </g>
      <path d="M8.2 13.2C5.5 13.4 3.4 15.4 3 18.5c.4 1.2 1.4 2.2 2.6 2.6 3.1-.4 5.1-2.5 5.3-5.2" />
      <path d="M5.6 21.1c.3-2.4 1.6-4.3 3.5-5.4" />
    </>
  ),
  // Hamburguesa
  hamburguesas: (
    <>
      <path d="M4 11c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5Z" />
      <path d="M3 14.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
      <path d="M4.5 17.5h15v.5a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 18Z" />
      <path d="M9 8h.01M12 7h.01M15 8h.01" />
    </>
  ),
  // Perro caliente
  hot_dogs: (
    <>
      <rect x="2.5" y="8.5" width="19" height="5" rx="2.5" />
      <path d="M4 13.5c0 2.2 1.8 4 4 4h8c2.2 0 4-1.8 4-4" />
      <path d="M6 11c.8-.8 1.7-.8 2.5 0s1.7.8 2.5 0 1.7-.8 2.5 0 1.7.8 2.5 0 1.7-.8 2.5 0" />
    </>
  ),
  // Pincho
  pinchos: (
    <>
      <path d="M3 21 21 3" />
      <path d="m7.2 13.5 3.3 3.3-2.1 2.1-3.3-3.3Z" />
      <path d="m11.2 9.5 3.3 3.3-2.1 2.1-3.3-3.3Z" />
      <path d="m15.2 5.5 3.3 3.3-2.1 2.1-3.3-3.3Z" />
    </>
  ),
  // Refractaria de lasagna con vapor
  lasagna: (
    <>
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M3 12.5c1.5 0 1.5.8 3 .8s1.5-.8 3-.8 1.5.8 3 .8 1.5-.8 3-.8 1.5.8 3 .8 1.5-.8 3-.8M3 16.5h18" />
      <path d="M9 3.5c-.6.8-.6 1.7 0 2.5M12 3c-.6.8-.6 1.7 0 2.5M15 3.5c-.6.8-.6 1.7 0 2.5" />
    </>
  ),
  // Media luna (panzerotti)
  panzerotti: (
    <>
      <path d="M3 16.5C3 11.3 7 7 12 7s9 4.3 9 9.5Z" />
      <path d="M5.5 16.5v1.5M8.5 16.5v1.5M11.5 16.5v1.5M14.5 16.5v1.5M17.5 16.5v1.5" />
      <path d="M9 11.5c1.9-.9 4.1-.9 6 0" />
    </>
  ),
  // Arepa con marcas de parrilla
  arepas: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m7.5 11 4-3.5M8.5 15l6.5-6M11 17.5l5-4.5" />
    </>
  ),
  // Patacón (plátano)
  patacon: (
    <>
      <path d="M4 13.5c1.8 1.4 4 2.2 6.4 2.2 4.7 0 8.5-3.3 8.9-7.6l.7-.6-.4-1.5h-1.4c.2 5.2-4.3 8.4-8.7 7.8-2-.3-3.7-1.1-5.1-2.3Z" />
      <path d="M4 13.5c2.3 4.2 6.3 6.3 10.6 5.6 3.1-.5 5.6-2.6 6.4-5.6" />
    </>
  ),
  // Plato de arroz
  arroz_paisa: (
    <>
      <path d="M3 12.5h18c0 4.4-4 7.5-9 7.5s-9-3.1-9-7.5Z" />
      <path d="M6 12.5C6 9.2 8.7 6.8 12 6.8s6 2.4 6 5.7" />
      <path d="M10 9.5h.01M13.5 9h.01M11.5 11h.01M15 11h.01M8.5 11h.01" />
    </>
  ),
  // Plato con cubiertos
  platos: (
    <>
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M3 4v4a1.5 1.5 0 0 0 3 0V4M4.5 9.5V20" />
      <path d="M20.5 20V4c-1.7.8-2.5 3-2.5 5.5V13h2.5" />
    </>
  ),
  // Vaso con pitillo
  bebidas: (
    <>
      <path d="M5.5 8h13l-1.4 12.1a1 1 0 0 1-1 .9H7.9a1 1 0 0 1-1-.9Z" />
      <path d="M4.5 8h15M12 8l1.8-5.5H17" />
      <path d="M7 13h10" />
    </>
  ),
  // Porción de queso
  adicionales: (
    <>
      <path d="M3 17V11l13-5.5L21 11v6Z" />
      <path d="M3 11h18" />
      <circle cx="8" cy="14.2" r="1.1" />
      <circle cx="15.5" cy="14.5" r="1.4" />
      <path d="M12 8.2h.01" />
    </>
  ),
};

const GENERICO = (
  <>
    <path d="M4 3v5a2 2 0 0 0 4 0V3M6 10v11" />
    <path d="M19 21V3c-2 1-3 3.5-3 6.5V14h3" />
  </>
);

// Categorías de ISMA que reutilizan un ícono existente.
const ALIAS = { menu_del_dia: 'platos', tradicional: 'arroz_paisa', proteinas: 'pinchos', a_la_carta: 'platos', pescado: 'platos', asados: 'platos', picadas: 'patacon', parrilla_especiales: 'hamburguesas' };

export function IconoCategoria({ id, className = 'h-6 w-6', strokeWidth = 1.75 }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRAZOS[ALIAS[id] || id] || GENERICO}
    </svg>
  );
}
