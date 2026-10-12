// Ícono de cada categoría en la app del cliente (se puede cambiar libremente).
export const ICONOS = {
  pizzas: '🍕',
  salchipapas: '🍟',
  mazorcadas: '🌽',
  hamburguesas: '🍔',
  hot_dogs: '🌭',
  pinchos: '🍢',
  lasagna: '🍝',
  panzerotti: '🥟',
  arepas: '🫓',
  patacon: '🍌',
  arroz_paisa: '🍚',
  platos: '🍽️',
  bebidas: '🥤',
  adicionales: '🧀',
};
export const icono = (id) => ICONOS[id] || '🍴';
