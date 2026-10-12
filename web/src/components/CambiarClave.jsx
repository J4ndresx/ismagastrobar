import { useState } from 'react';

const MENSAJES = {
  'auth/weak-password': 'La contraseña es muy débil. Usa al menos 6 caracteres.',
  'auth/invalid-credential': 'La contraseña actual no es correcta.',
  'auth/wrong-password': 'La contraseña actual no es correcta.',
  'auth/requires-recent-login': 'Por seguridad, cierra sesión, vuelve a entrar e inténtalo de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
};

/**
 * Cambio de contraseña.
 *  - obligatorio: primer ingreso (o clave restablecida por el admin). Pantalla completa, sin salida salvo "Cerrar sesión".
 *  - voluntario: desde el menú del usuario; pide la contraseña actual.
 */
export default function CambiarClave({ nombre, obligatorio = false, onCambiar, onCerrar, onSalir }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const problemas = [];
  if (nueva && nueva.length < 6) problemas.push('Mínimo 6 caracteres.');
  if (repetir && nueva !== repetir) problemas.push('Las contraseñas no coinciden.');
  if (!obligatorio && nueva && actual && nueva === actual) problemas.push('La nueva debe ser distinta de la actual.');
  const puede = nueva.length >= 6 && nueva === repetir && (obligatorio || actual) && !problemas.length && !enviando;

  const guardar = async (e) => {
    e.preventDefault();
    if (!puede) return;
    setError('');
    setEnviando(true);
    try {
      await onCambiar({ actual: obligatorio ? undefined : actual, nueva });
      setListo(true);
      if (!obligatorio) setTimeout(onCerrar, 1200);
    } catch (err) {
      setError(MENSAJES[err.code] || 'No se pudo cambiar la contraseña. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const tipo = ver ? 'text' : 'password';
  const formulario = (
    <form onSubmit={guardar} className="card w-full max-w-sm space-y-4 p-6">
      <div>
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </span>
        <h1 className="text-[18px] font-bold tracking-tight">{obligatorio ? `Hola${nombre ? `, ${nombre.split(' ')[0]}` : ''} 👋` : 'Cambiar contraseña'}</h1>
        <p className="mt-1 text-[13.5px] text-zinc-500">
          {obligatorio ? 'Por seguridad, antes de empezar crea tu propia contraseña. La que te dieron era temporal.' : 'Escribe tu contraseña actual y la nueva.'}
        </p>
      </div>

      {listo ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-700">✓ Contraseña cambiada.</p>
      ) : (
        <>
          {!obligatorio && (
            <input type={tipo} value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Contraseña actual" className="field" autoComplete="current-password" />
          )}
          <input type={tipo} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva contraseña" className="field" autoComplete="new-password" autoFocus={obligatorio} />
          <input type={tipo} value={repetir} onChange={(e) => setRepetir(e.target.value)} placeholder="Repite la nueva contraseña" className="field" autoComplete="new-password" />
          <label className="flex items-center gap-2 text-[13px] text-zinc-600">
            <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="h-4 w-4 accent-zinc-900" /> Mostrar contraseñas
          </label>
          {(problemas[0] || error) && <p className="text-[13px] text-red-600">{error || problemas[0]}</p>}
          <button disabled={!puede} className="btn-primary w-full">{enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
        </>
      )}

      {obligatorio ? (
        <button type="button" onClick={onSalir} className="w-full text-center text-[13px] font-semibold text-zinc-500 hover:text-zinc-800">Cerrar sesión</button>
      ) : (
        !listo && <button type="button" onClick={onCerrar} className="w-full text-center text-[13px] font-semibold text-zinc-500 hover:text-zinc-800">Cancelar</button>
      )}
    </form>
  );

  if (obligatorio) return <div className="grid min-h-screen place-items-center bg-zinc-50 px-4">{formulario}</div>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 px-4 animate-fade" onClick={onCerrar}>
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>{formulario}</div>
    </div>
  );
}
