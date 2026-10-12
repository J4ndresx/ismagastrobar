// Zonificación de domicilios por barrio.
//
// Misma idea que en Pizzeroo's: el valor del domicilio SOLO se muestra y se
// cobra en el checkout cuando el barrio tiene sectores con tarifa fija. En
// cualquier otro caso queda "pendiente de informar" y se confirma con el
// domiciliario al momento de la entrega.
//
// Formato:
// ZONAS[ciudad][barrio] = {
//   sectorFallback: 'POR_KM' | null,   // muestra "Ninguna de las anteriores"
//   sectores: [{ id, nombre, tarifa, referencia? }],
// }
// Los barrios que no aparecen aquí se tratan como "pendiente de informar".
//
// ⚠️ EJEMPLO — reemplazar por los sectores y tarifas reales de Jireh.
export const ZONAS = {
  'Itagüí': {
    'Villa Paula': {
      sectorFallback: 'POR_KM',
      sectores: [
        { id: 'vp-parque', nombre: 'Villa Paula - Parque', tarifa: 4000, referencia: 'Cerca al parque principal' },
        { id: 'vp-alta', nombre: 'Villa Paula - Parte alta', tarifa: 5000 },
      ],
    },
  },
};
