// Autorización de tratamiento de datos personales (Ley 1581 de 2012 y
// Decreto 1377 de 2013). El texto es un modelo: el dueño del negocio debe
// revisarlo y, si cambia, subir POLITICA_DATOS_VERSION para saber qué
// versión aceptó cada cliente.
import { NEGOCIO } from '../config/negocio';
import { Sheet, IconX, IconCheck } from './ui';

export const POLITICA_DATOS_VERSION = '2026-10-02';

const RESPONSABLE = {
  nit: '1233498017-9',
  direccion: 'Carrera 82A #6-16 Local 15, Tabaku Américas, Bogotá',
};

const telefonoVisible = (w) => (/^57\d{10}$/.test(w || '') ? w.slice(2).replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : null);

/** Casilla "Acepto…" con enlace para leer la política. */
export function CasillaDatos({ acepta, onCambiar, onVer }) {
  return (
    <div className={`mx-auto flex max-w-lg items-start gap-3 px-4 pt-3 ${acepta ? '' : 'animate-rise'}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={acepta}
        onClick={() => onCambiar(!acepta)}
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${acepta ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 bg-white'}`}
      >
        {acepta && <IconCheck className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <p className="text-[13px] leading-snug text-zinc-600">
        <span className="cursor-pointer" onClick={() => onCambiar(!acepta)}>Autorizo el tratamiento de mis datos personales según la </span>
        <button type="button" onClick={onVer} className="font-semibold text-brand-700 underline underline-offset-2">
          política de tratamiento de datos
        </button>
        .
      </p>
    </div>
  );
}

/** Texto de la política (hoja que sube desde abajo). */
export function PoliticaDatos({ onCerrar, onAceptar, textoBoton = 'Acepto' }) {
  const tel = telefonoVisible(NEGOCIO.whatsapp);
  return (
    <Sheet onClose={onCerrar}>
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <p className="text-[16px] font-bold">Tratamiento de datos personales</p>
        <button onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100">
          <IconX className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 overflow-y-auto px-5 py-4 text-[13.5px] leading-relaxed text-zinc-700">
        <p>
          <b>Responsable:</b> {NEGOCIO.nombre}, NIT {RESPONSABLE.nit}, {RESPONSABLE.direccion}.
        </p>
        <p>
          <b>Datos que recogemos:</b> nombre, número de celular, dirección de entrega y los detalles de tu pedido.
        </p>
        <p>
          <b>Para qué los usamos:</b> recibir, preparar, cobrar y entregar tu pedido; contactarte por llamada o WhatsApp sobre ese pedido; y recordar tus datos para que tu próximo pedido sea más rápido. No vendemos ni compartimos tus datos con terceros, salvo el servicio de mapas que ubica tu dirección para calcular el domicilio y los proveedores tecnológicos que alojan la aplicación.
        </p>
        <p>
          <b>Tus derechos:</b> conocer, actualizar, rectificar y pedir que eliminemos tus datos, revocar esta autorización y presentar quejas ante la Superintendencia de Industria y Comercio. Responder preguntas sobre datos sensibles es opcional (aquí no los pedimos).
        </p>
        <p>
          <b>Cómo ejercerlos:</b> escríbenos{tel ? ` al WhatsApp ${tel}` : ' por WhatsApp'} o acércate al local. Respondemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles.
        </p>
        <p className="text-[12px] text-zinc-400">Ley 1581 de 2012 y Decreto 1377 de 2013 · Versión {POLITICA_DATOS_VERSION}</p>
      </div>
      <div className="border-t border-zinc-100 px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <button onClick={onAceptar} className="btn-primary w-full">{textoBoton}</button>
      </div>
    </Sheet>
  );
}
