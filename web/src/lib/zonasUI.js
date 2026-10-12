// Colores por zona: se repiten en categorías, botones, comanda y tickets
// para que la vendedora sepa a qué cocina va cada cosa sin leer.
export const ZONA_UI = {
  pizzeria: {
    nombre: 'Pizzería', dot: 'bg-orange-500', texto: 'text-orange-700', suave: 'bg-orange-50',
    borde: 'border-orange-500', anillo: 'ring-orange-200', nota: 'Se imprime',
  },
  comidas_rapidas: {
    nombre: 'Cocina', dot: 'bg-sky-600', texto: 'text-sky-700', suave: 'bg-sky-50',
    borde: 'border-sky-600', anillo: 'ring-sky-200', nota: 'Se imprime',
  },
  general: {
    nombre: 'General', dot: 'bg-zinc-400', texto: 'text-zinc-600', suave: 'bg-zinc-100',
    borde: 'border-zinc-300', anillo: 'ring-zinc-200', nota: 'Lo entregas tú',
  },
};

export const ESTADO_IMPRESION = {
  en_cola: { texto: 'En cola', clase: 'bg-zinc-100 text-zinc-600 ring-zinc-200', animar: true },
  pendiente: { texto: 'En cola', clase: 'bg-zinc-100 text-zinc-600 ring-zinc-200', animar: true },
  imprimiendo: { texto: 'Imprimiendo', clase: 'bg-amber-50 text-amber-800 ring-amber-200', animar: true },
  impreso: { texto: 'Impreso', clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  error: { texto: 'Error', clase: 'bg-red-50 text-red-700 ring-red-200' },
};

export const TIPOS_ENTREGA = [
  { id: 'mesa', nombre: 'Mesa' },
  { id: 'llevar', nombre: 'Para llevar' },
  { id: 'domicilio', nombre: 'Domicilio' },
];

export const cop = (n) => '$' + (n || 0).toLocaleString('es-CO');

// ISMA GASTRO-BAR: zonas propias, con la misma estructura que las que ya existen.
const _base = Object.values(ZONA_UI)[0];
ZONA_UI.cocina = { ..._base, nombre: 'Cocina', dot: 'bg-orange-500', texto: 'text-orange-700', suave: 'bg-orange-50', borde: 'border-orange-400' };
ZONA_UI.general = { ..._base, nombre: 'General', dot: 'bg-sky-500', texto: 'text-sky-700', suave: 'bg-sky-50', borde: 'border-sky-400' };