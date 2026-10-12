// Seguimiento del pedido en vivo: estado, hora estimada y línea de tiempo.
// Lee la copia pública `seguimiento/{token}` (sin datos personales).
import { useEffect, useState } from 'react';
import { escucharSeguimiento } from '../services/backend';
import { etapasPara, tiempoEstimado } from '@shared/seguimiento.js';
import { enlaceSeguimiento, quitarActivo } from '../services/pedidosActivos';
import { formatCOP } from '../utils/formato';
import { DATOS_NEGOCIO } from '@shared/comandas.js';
import { DOMICILIO } from '@shared/domicilio.js';
import { IconCheck, IconX, IconClock, IconBike, IconStore } from './ui';
import { Pista } from './Guia';

const hora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).replace(/\s?([ap])\.?\s?m\.?/i, ' $1. m.') : '';
// "10:39 – 10:54 a. m." (sin repetir a. m. / p. m. si es el mismo)
const rango = (a, b) => {
  const [x, y] = [hora(a), hora(b)];
  const sx = x.slice(-5), sy = y.slice(-5);
  if (x === y) return y;
  return sx === sy ? `${x.slice(0, -5).trim()} – ${y}` : `${x} – ${y}`;
};
const sumar = (iso, min) => new Date(new Date(iso).getTime() + min * 60_000).toISOString();

const TITULOS = {
  recibido: 'Estamos revisando tu pedido',
  preparando: 'Tu pedido se está preparando',
  en_camino: 'Tu pedido va en camino',
  listo: 'Tu pedido está listo',
  entregado: '¡Pedido entregado!',
  rechazado: 'No pudimos tomar tu pedido',
};
const PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', datafono: 'Datáfono' };

export function useSeguimiento(token) {
  const [datos, setDatos] = useState(undefined); // undefined = cargando, null = no existe (aún)
  useEffect(() => (token ? escucharSeguimiento(token, setDatos) : undefined), [token]);
  return datos;
}

/**
 * @param token    código del enlace
 * @param inicial  vista local mientras la nube crea la copia (recién enviado)
 */
export default function Seguimiento({ token, inicial = null }) {
  const remoto = useSeguimiento(token);
  const s = remoto || inicial;
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (s?.etapa === 'entregado' || s?.etapa === 'rechazado') quitarActivo(token);
  }, [s?.etapa, token]);

  if (!s) {
    return (
      <div className="card p-6 text-center text-[14px] text-zinc-500">
        {remoto === undefined ? 'Buscando tu pedido…' : 'No encontramos este pedido. Revisa el enlace o escríbenos por WhatsApp.'}
      </div>
    );
  }

  const domicilio = s.tipo_entrega === 'domicilio';
  const etapas = etapasPara(s.tipo_entrega);
  const rechazado = s.etapa === 'rechazado';
  const idx = rechazado ? 0 : Math.max(0, etapas.findIndex((e) => e.id === s.etapa));
  const terminado = s.etapa === 'entregado';
  const desde = s.horas?.preparando || s.horas?.recibido;
  const [min, max] = tiempoEstimado(s.tipo_entrega, desde || new Date().toISOString());
  const mostrarEta = desde && !rechazado && !terminado && (domicilio ? s.etapa !== 'entregado' : ['recibido', 'preparando'].includes(s.etapa));
  const compartir = async () => {
    const url = enlaceSeguimiento(token);
    try {
      if (navigator.share) await navigator.share({ title: 'Sigue mi pedido', url });
      else { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    } catch { /* cancelado */ }
  };

  return (
    <div className="space-y-4">
      {!terminado && !rechazado && (
        <Pista id="seguimiento" paso="✓" siempre>
          <b>¡Pedido enviado!</b> Aquí ves en vivo cómo va: esta pantalla se actualiza sola, no tienes que llamar ni recargar.
        </Pista>
      )}
      {/* Estado actual */}
      <div className={`card overflow-hidden ${rechazado ? 'border-red-200' : ''}`}>
        <div className="px-5 pb-4 pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400">
              {s.numero ? `Pedido #${String(s.numero).padStart(3, '0')}` : 'Pedido enviado'} · {domicilio ? 'Domicilio' : 'Recoges en el local'}
            </p>
            {!terminado && !rechazado && (
              <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                En vivo
              </span>
            )}
          </div>
          <h2 className={`mt-1.5 text-[22px] font-extrabold leading-tight tracking-tight ${rechazado ? 'text-red-700' : ''}`}>{TITULOS[s.etapa]}</h2>
          {rechazado && <p className="mt-1 text-[14px] text-zinc-600">{s.motivo_rechazo || 'El restaurante no pudo aceptar el pedido en este momento.'} Escríbenos por WhatsApp si tienes dudas.</p>}
          {mostrarEta && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-zinc-600">
              <IconClock className="h-4 w-4 text-zinc-400" />
              {domicilio ? 'Llega' : 'Listo'} aprox. <b className="text-zinc-900">{rango(sumar(desde, min), sumar(desde, max))}</b>
            </p>
          )}
        </div>
        {s.etapa === 'en_camino' && <AvisoEnCamino s={s} />}
        {!domicilio && !rechazado && !terminado && <AvisoRecoger s={s} />}
        {!rechazado && (
          <div className="grid grid-cols-4 gap-1 px-5 pb-5" aria-hidden="true">
            {etapas.map((e, i) => (
              <span key={e.id} className={`h-1.5 rounded-full ${i < idx || terminado ? 'bg-emerald-500' : i === idx ? 'animate-pulse bg-brand-600' : 'bg-zinc-200'}`} />
            ))}
          </div>
        )}
      </div>

      {/* Línea de tiempo */}
      {!rechazado && (
        <ol className="card px-5 py-4">
          {etapas.map((e, i) => {
            const hecho = i < idx || terminado;
            const actual = i === idx && !terminado;
            const ultimo = i === etapas.length - 1;
            const Icono = e.id === 'en_camino' ? IconBike : e.id === 'listo' ? IconStore : null;
            return (
              <li key={e.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                {!ultimo && <span className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${hecho ? 'bg-emerald-500' : 'bg-zinc-200'}`} />}
                <span
                  className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    hecho ? 'bg-emerald-500 text-white' : actual ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'border-2 border-zinc-200 bg-white text-zinc-300'
                  }`}
                >
                  {hecho ? <IconCheck className="h-4 w-4" strokeWidth={3} /> : Icono ? <Icono className="h-3.5 w-3.5" /> : <span className={`h-2 w-2 rounded-full ${actual ? 'bg-white' : 'bg-zinc-300'}`} />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-[15px] font-semibold ${hecho || actual ? 'text-zinc-900' : 'text-zinc-400'}`}>{e.titulo}</p>
                    {s.horas?.[e.id] && (hecho || actual) && <span className="shrink-0 text-[12.5px] tabular-nums text-zinc-500">{hora(s.horas[e.id])}</span>}
                  </div>
                  {(actual || (terminado && ultimo)) && <p className="text-[13px] text-zinc-500">{e.detalle}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Resumen */}
      <div className="card overflow-hidden">
        <ul className="divide-y divide-zinc-100 px-5">
          {(s.items || []).map((l, i) => (
            <li key={i} className="py-2.5 text-[14px] text-zinc-700"><b className="text-zinc-900">{l.cantidad}×</b> {l.nombre}</li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-5 py-3 text-[14px]">
          <span className="text-zinc-500">{PAGO[s.pago] ? `Pago: ${PAGO[s.pago]}` : 'Total'}</span>
          <span className="font-bold tabular-nums">{formatCOP(s.total)}{s.domicilio_por_confirmar ? ' + domicilio' : ''}</span>
        </div>
        {s.domicilio_por_confirmar && !rechazado && (
          <p className="border-t border-amber-200 bg-amber-50 px-5 py-2.5 text-[13px] leading-snug text-amber-950">
            <b>Domicilio por confirmar.</b> Te mostramos aquí el valor apenas aceptemos tu pedido; lo pagas al recibirlo.
          </p>
        )}
        {s.domicilio_al_recibir && s.domicilio_valor > 0 && (
          <p className="border-t border-amber-200 bg-amber-50 px-5 py-2.5 text-[13.5px] leading-snug text-amber-950">
            <b>Domicilio confirmado: {formatCOP(s.domicilio_valor)}</b>
            {s.pago === 'transferencia' ? ' — tu transferencia cubre los productos; el domicilio lo pagas en efectivo al recibir.' : ' — ya está incluido en el total; lo pagas al recibir.'}
          </p>
        )}
      </div>

      {!terminado && !rechazado && (
        <button onClick={compartir} className="btn-secondary w-full">
          {copiado ? <><IconCheck className="h-4 w-4" /> Enlace copiado</> : 'Compartir enlace de seguimiento'}
        </button>
      )}
      {rechazado && <p className="flex items-center justify-center gap-1.5 text-[13px] text-zinc-500"><IconX className="h-4 w-4" /> Este pedido no se cobrará.</p>}
    </div>
  );
}

/** Cuando el pedido sale: qué tener listo según cómo paga. */
function AvisoEnCamino({ s }) {
  const valor = `${formatCOP(s.total)}${s.domicilio_por_confirmar ? ' más el domicilio' : ''}`;
  const pago =
    s.pago === 'datafono'
      ? <>Ten a mano tu <b>tarjeta débito o crédito</b>: el domiciliario lleva el datáfono. Total: <b>{valor}</b>.</>
      : s.pago === 'transferencia'
      ? <>Tu pago por <b>transferencia</b> ya quedó registrado.{s.domicilio_al_recibir && s.domicilio_valor > 0 ? <> Ten listo el domicilio en efectivo: <b>{formatCOP(s.domicilio_valor)}</b>.</> : s.domicilio_por_confirmar ? ' Ten listo el valor del domicilio en efectivo.' : ''}</>
      : s.paga_con
      ? <>Ten listo el efectivo: pagas con <b>{formatCOP(s.paga_con)}</b> y el domiciliario lleva tus vueltas. Total: <b>{valor}</b>.</>
      : <>Ten listo el valor exacto en efectivo: <b>{valor}</b>.</>;
  return (
    <div className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] leading-snug text-amber-950">
      <p className="flex items-center gap-2 font-bold"><IconBike className="h-4 w-4" /> Tu domiciliario va en camino</p>
      <p className="mt-1">Mantente atento al timbre o a tu celular para recibirlo.</p>
      <p className="mt-1">{pago}</p>
    </div>
  );
}

export const DIRECCION_LOCAL = `${DATOS_NEGOCIO.direccion}, ${DATOS_NEGOCIO.lugar}, ${DATOS_NEGOCIO.ciudad}`;
export const MAPA_LOCAL = `https://www.google.com/maps/search/?api=1&query=${DOMICILIO.origen.lat},${DOMICILIO.origen.lng}`;

/** Para recoger: dónde es, y cuando está listo, qué decir y cómo pagar. */
function AvisoRecoger({ s }) {
  const listo = s.etapa === 'listo';
  const num = s.numero ? `#${String(s.numero).padStart(3, '0')}` : null;
  const pago =
    s.pago === 'datafono'
      ? <>Pagas con <b>tarjeta</b> en el datáfono del local: <b>{formatCOP(s.total)}</b>.</>
      : s.pago === 'transferencia'
      ? <>Tu pago por <b>transferencia</b> ya quedó registrado.</>
      : <>Pagas en efectivo al recoger: <b>{formatCOP(s.total)}</b>.</>;
  return (
    <div className={`mx-5 mb-4 rounded-xl border px-4 py-3 text-[13.5px] leading-snug ${listo ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>
      {listo ? (
        <>
          <p className="flex items-center gap-2 font-bold"><IconStore className="h-4 w-4" /> ¡Ya puedes pasar por tu pedido!</p>
          {num && <p className="mt-1">Al llegar, di tu número de pedido: <b className="text-[15px]">{num}</b></p>}
          <p className="mt-1">{pago}</p>
        </>
      ) : (
        <p className="flex items-center gap-2 font-semibold"><IconStore className="h-4 w-4" /> Recoges en el local. Te avisamos aquí apenas esté listo.</p>
      )}
      <p className="mt-1.5 text-[13px]">{DIRECCION_LOCAL}</p>
      <a href={MAPA_LOCAL} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] font-semibold underline underline-offset-2">Cómo llegar</a>
    </div>
  );
}
