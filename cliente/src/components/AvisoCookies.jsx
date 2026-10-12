// Aviso de cookies (primera visita) y hoja con la política de cookies.
import { useEffect, useState } from 'react';
import { NEGOCIO } from '../config/negocio';
import { Sheet, IconX } from './ui';
import { COOKIES_VERSION, leerPreferencia, guardarPreferencia, alCambiar } from '../services/preferenciasCookies';

/** Banner abajo, solo mientras el cliente no haya elegido. */
export function AvisoCookies({ onVerPolitica }) {
  const [eleccion, setEleccion] = useState(leerPreferencia);
  useEffect(() => alCambiar(setEleccion), []);
  if (eleccion) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] animate-rise" role="dialog" aria-label="Aviso de cookies">
      <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-pop">
        <p className="text-[14px] font-semibold">Cookies y almacenamiento</p>
        <p className="mt-1 text-[13px] leading-snug text-zinc-600">
          Usamos almacenamiento en tu navegador para que la app funcione y, si lo aceptas, para recordar tus datos y direcciones en este dispositivo. No usamos cookies de publicidad ni de seguimiento.{' '}
          <button type="button" onClick={onVerPolitica} className="font-semibold text-brand-700 underline underline-offset-2">Más información</button>
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => guardarPreferencia('necesarias')} className="btn-secondary flex-1 whitespace-nowrap !py-2.5 text-[14px]">Solo necesarias</button>
          <button type="button" onClick={() => guardarPreferencia('todas')} className="btn-primary flex-1 !py-2.5 text-[14px]">Aceptar</button>
        </div>
      </div>
    </div>
  );
}

/** Política de cookies; también deja cambiar la elección. */
export function PoliticaCookies({ onCerrar, onVerDatos }) {
  const actual = leerPreferencia();
  const elegir = (e) => { guardarPreferencia(e); onCerrar(); };
  return (
    <Sheet onClose={onCerrar}>
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <p className="text-[16px] font-bold">Política de cookies</p>
        <button onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100">
          <IconX className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 overflow-y-auto px-5 py-4 text-[13.5px] leading-relaxed text-zinc-700">
        <p>
          {NEGOCIO.nombre} guarda pequeños datos en tu navegador (almacenamiento local, que cumple la misma función que las cookies). Solo los usamos para esto:
        </p>
        <div className="rounded-xl border border-zinc-200 p-3">
          <p className="font-semibold">Necesarias <span className="font-normal text-zinc-400">· siempre activas</span></p>
          <p className="mt-0.5 text-[13px] text-zinc-600">Guardar tu elección sobre este aviso y el pedido que estás armando, para que no se pierda si la página se recarga (se borra al enviarlo o a las 6 horas), el código para seguir tus pedidos de las últimas 12 horas y si ya viste la guía de ayuda.</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3">
          <p className="font-semibold">Funcionales <span className="font-normal text-zinc-400">· opcionales</span></p>
          <p className="mt-0.5 text-[13px] text-zinc-600">Recordar tu nombre, celular y hasta 3 direcciones en este dispositivo para que tu próximo pedido sea más rápido. Esos datos se quedan en tu celular o computador.</p>
        </div>
        <p><b>No usamos</b> cookies de publicidad, de análisis ni de seguimiento, ni compartimos esta información con terceros.</p>
        <p>
          Puedes cambiar tu elección aquí cuando quieras, o borrar los datos desde la configuración de tu navegador. Los datos de tus pedidos se tratan según la{' '}
          <button type="button" onClick={onVerDatos} className="font-semibold text-brand-700 underline underline-offset-2">política de tratamiento de datos</button>.
        </p>
        <p className="text-[12px] text-zinc-400">
          Versión {COOKIES_VERSION}
          {actual ? ` · Tu elección actual: ${actual === 'todas' ? 'todas las cookies' : 'solo necesarias'}` : ''}
        </p>
      </div>
      <div className="flex gap-2 border-t border-zinc-100 px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <button onClick={() => elegir('necesarias')} className="btn-secondary flex-1">Solo necesarias</button>
        <button onClick={() => elegir('todas')} className="btn-primary flex-1">Aceptar todas</button>
      </div>
    </Sheet>
  );
}
