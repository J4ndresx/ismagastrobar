// Abrir / cerrar la app del cliente (solo caja y admin, en "Pedidos App").
// Se abre y se cierra sola con el horario; el botón la cambia a mano hasta la
// siguiente hora del horario (ver shared/tienda.js).
import { useEffect, useState } from 'react';
import { estadoTienda, cambioManual, cuandoTexto } from '@shared/tienda.js';
import * as api from '../data/api';

export default function ControlTienda() {
  const [config, setConfig] = useState(null);
  const [ahora, setAhora] = useState(Date.now());
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => api.escucharTienda(setConfig), []);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 20_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!confirmar) return; const t = setTimeout(() => setConfirmar(false), 5000); return () => clearTimeout(t); }, [confirmar]);
  if (config === null) return null;

  const e = estadoTienda(config, ahora);
  const cuando = cuandoTexto(e.hasta, ahora);
  const detalle = e.abierta
    ? `${e.manual ? `Abierta a mano${e.por_nombre ? ` por ${e.por_nombre}` : ''}. ` : ''}Recibe pedidos hasta ${cuando.replace(/^hoy a las/, 'las')}`
    : `${e.manual ? `Cerrada a mano${e.por_nombre ? ` por ${e.por_nombre}` : ''}. ` : ''}Se abre sola ${cuando}`;

  const tocar = async () => {
    if (e.abierta && !confirmar) return setConfirmar(true);
    setConfirmar(false);
    setGuardando(true);
    setError('');
    try {
      await api.cambiarTienda(cambioManual(config, Date.now()));
    } catch (err) {
      console.error(err);
      setError('No se pudo cambiar. Revisa la conexión.');
    } finally {
      setGuardando(false);
    }
  };

  // Va abajo en el menú lateral, junto al estado de la impresora.
  const tono = e.abierta ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800';
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tono}`}>
      <p className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide">
        <span className="relative flex h-2 w-2 shrink-0">
          {e.abierta && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${e.abierta ? 'bg-emerald-500' : 'bg-red-500'}`} />
        </span>
        App cliente {e.abierta ? 'abierta' : 'cerrada'}
      </p>
      <p className="mt-0.5 text-[11.5px] leading-snug opacity-90">{error || detalle}</p>
      <button
        onClick={tocar}
        disabled={guardando}
        className={`mt-2 w-full rounded-lg px-3 py-2 text-[12.5px] font-bold shadow-sm transition active:scale-[.98] disabled:opacity-60 ${
          e.abierta ? (confirmar ? 'bg-red-600 text-white' : 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50') : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
      >
        {guardando ? 'Guardando…' : e.abierta ? (confirmar ? '¿Seguro? Toca para cerrar' : 'Cerrar app del cliente') : 'Abrir app del cliente'}
      </button>
    </div>
  );
}
