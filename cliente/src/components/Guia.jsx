// Guía para clientes nuevos: pistas pequeñas, una por pantalla, que aparecen
// en el lugar donde el cliente está y se cierran con "Entendido".
//
//  - Solo para quien no ha hecho pedidos en este dispositivo: al enviar el
//    primer pedido la guía se apaga sola.
//  - Cada pista sale una sola vez. "¿Cómo hacer mi pedido?" (pie de página)
//    la vuelve a encender.
//  - Se guarda en el navegador (almacenamiento necesario, sin datos personales).
import { useEffect, useState } from 'react';
import { IconX } from './ui';

const CLAVE = 'isma.guia';
const oyentes = new Set();

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || { apagada: false, vistas: [] };
  } catch {
    return { apagada: false, vistas: [] };
  }
}
function guardar(e) {
  try { localStorage.setItem(CLAVE, JSON.stringify(e)); } catch { /* sin almacenamiento: la guía se muestra en esta visita */ }
  memoria = e;
  oyentes.forEach((cb) => cb(e));
}
let memoria = null;
const estado = () => memoria || (memoria = leer());

/** Ya vio esta pista. */
export const marcarVista = (id) => { const e = estado(); if (!e.vistas.includes(id)) guardar({ ...e, vistas: [...e.vistas, id] }); };
/** Ya hizo un pedido: no más guía. */
export const apagarGuia = () => guardar({ ...estado(), apagada: true });
/** "¿Cómo hacer mi pedido?": vuelve a mostrar todas las pistas. */
export const reiniciarGuia = () => guardar({ apagada: false, vistas: [] });

/** ¿Mostrar esta pista? */
export function usePista(id, siempre = false) {
  const [e, setE] = useState(estado);
  useEffect(() => { oyentes.add(setE); return () => oyentes.delete(setE); }, []);
  return (siempre || !e.apagada) && !e.vistas.includes(id);
}

/** Pista dentro de la página (no tapa nada). */
export function Pista({ id, paso, children, className = '', siempre = false }) {
  const ver = usePista(id, siempre);
  if (!ver) return null;
  return (
    <div role="note" className={`flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-3 animate-rise ${className}`}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-600 text-[13px] font-bold text-white">{paso || '?'}</span>
      <div className="min-w-0 flex-1 text-[13.5px] leading-snug text-sky-950">{children}</div>
      <button type="button" onClick={() => marcarVista(id)} aria-label="Cerrar ayuda"
        className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-sky-700 hover:bg-sky-100">
        Entendido
      </button>
    </div>
  );
}

/** Globito sobre un botón fijo (ej. "Ver mi pedido"). */
export function Globo({ id, children }) {
  const ver = usePista(id);
  if (!ver) return null;
  return (
    <div className="relative mx-auto mb-2 flex max-w-2xl items-center gap-2 rounded-xl bg-zinc-900 px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-pop animate-rise">
      <span className="flex-1">{children}</span>
      <button type="button" onClick={() => marcarVista(id)} aria-label="Cerrar ayuda" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10">
        <IconX className="h-4 w-4" />
      </button>
      <span className="absolute -bottom-1.5 left-8 h-3 w-3 rotate-45 bg-zinc-900" />
    </div>
  );
}
