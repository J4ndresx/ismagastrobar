// Versión del puente de impresión (PC del mostrador).
//
// REGLA: cada vez que cambie algo de la carpeta puente-impresion (o de
// shared/comandas.js, que el puente usa para armar los tickets), se sube este
// número. El POS lo compara con la versión que reporta el puente del
// restaurante y, si es más vieja, le muestra al administrador
// "Actualización pendiente de la impresora".
//
// 1.1.0  cuenta para cobrar
// 1.2.0  NIT, fecha y datos del cliente en la cuenta
// 1.3.0  vigila la cola de Windows (sin papel, apagada, sin conexión) y reporta el estado de la impresora
// 1.6.1  registro en archivo y conteo de cortes (pausas, internet, impresora) visibles en el POS
// 1.6.2  sin internet: fuerza la reconexion cada 15 s (se recupera apenas vuelve)
export const VERSION_PUENTE = '1.6.2';

/** -1 si a < b, 0 si son iguales, 1 si a > b ("1.10.0" > "1.9.0"). */
export function compararVersion(a, b) {
  const x = String(a || '0').split('.').map(Number);
  const y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
  return 0;
}
