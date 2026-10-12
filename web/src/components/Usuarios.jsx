import { useEffect, useState } from 'react';
import { Sheet, IconX, IconPlus, IconCheck } from './ui';

export const ROLES = [
  { id: 'vendedora', nombre: 'Vendedor / Mesero', corto: 'Vendedor', desc: 'Solo ve Tomar pedido.', color: 'bg-sky-100 text-sky-800' },
  { id: 'cajero', nombre: 'Cajero', corto: 'Cajero', desc: 'Tomar pedido y Pedidos: aprobar pedidos de la app, reimprimir e imprimir la cuenta.', color: 'bg-amber-100 text-amber-800' },
  { id: 'admin', nombre: 'Administrador', corto: 'Admin', desc: 'Todo el panel, incluido Usuarios.', color: 'bg-violet-100 text-violet-800' },
];
const rolDe = (id) => ROLES.find((r) => r.id === id) || { corto: id === 'impresora' ? 'Impresora' : id, color: 'bg-zinc-100 text-zinc-600' };

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sugerirUsuario = (nombre, apellido) => [sinTildes(nombre.split(' ')[0]), sinTildes(apellido.split(' ')[0])].filter(Boolean).join('.');
const generarClave = () => 'Isma' + String(Math.floor(1000 + Math.random() * 9000));
const iniciales = (n) => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

function haceCuanto(fecha) {
  if (!fecha) return 'Nunca ha entrado';
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 2) return 'Entró hace un momento';
  if (min < 60) return `Entró hace ${min} min`;
  if (min < 60 * 24) return `Entró hace ${Math.round(min / 60)} h`;
  return `Entró el ${new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;
}

/** Módulo Usuarios (solo administradores). */
export default function Usuarios({ api }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { modo: 'crear' | 'editar', u? }
  const [restablecer, setRestablecer] = useState(null); // usuario
  const [confirmar, setConfirmar] = useState(null); // { tipo: 'eliminar' | 'desactivar', u }
  const [credenciales, setCredenciales] = useState(null); // { nombre, usuario, clave, nuevo }
  const [aviso, setAviso] = useState('');

  const cargar = async () => {
    try {
      setError('');
      setLista((await api.usuarios('listar')).usuarios);
    } catch (e) {
      setError(e.message || 'No se pudo cargar la lista.');
    }
  };
  useEffect(() => { cargar(); }, []);
  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(''), 2500); };

  const personas = (lista || []).filter((u) => !u.sistema);
  const activos = personas.filter((u) => u.activo).length;

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Equipo</p>
          <p className="text-[13px] text-zinc-500">{lista ? `${activos} activo${activos === 1 ? '' : 's'} · ${personas.length - activos} desactivado${personas.length - activos === 1 ? '' : 's'}` : 'Cargando…'}</p>
        </div>
        <button onClick={() => setForm({ modo: 'crear' })} className="btn-primary py-2.5">
          <IconPlus className="h-4 w-4" strokeWidth={2.5} /> Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
          {error}
          <button onClick={cargar} className="font-semibold underline">Reintentar</button>
        </div>
      )}

      {!lista && !error && <div className="card p-10 text-center text-[14px] text-zinc-400">Cargando usuarios…</div>}

      {lista && (
        <div className="card divide-y divide-zinc-100 overflow-hidden">
          {personas.map((u) => (
            <FilaUsuario
              key={u.uid}
              u={u}
              onEditar={() => setForm({ modo: 'editar', u })}
              onClave={() => setRestablecer(u)}
              onActivar={async () => { await api.usuarios('estado', { uid: u.uid, activo: true }); avisar(`${u.nombre_completo} está activo de nuevo`); cargar(); }}
              onDesactivar={() => setConfirmar({ tipo: 'desactivar', u })}
              onEliminar={() => setConfirmar({ tipo: 'eliminar', u })}
            />
          ))}
          {!personas.length && <p className="p-8 text-center text-[14px] text-zinc-500">Aún no hay usuarios. Crea el primero.</p>}
        </div>
      )}

      <p className="mt-4 text-[12.5px] leading-relaxed text-zinc-500">
        El nombre y apellido es lo que sale en la comanda (“Atiende: …”). Al crear un usuario o restablecer su contraseña, la persona debe crear su propia contraseña la primera vez que entra.
        La cuenta de la impresora no aparece aquí.
      </p>

      {form && (
        <FormUsuario
          modo={form.modo}
          u={form.u}
          onCerrar={() => setForm(null)}
          onGuardar={async (datos) => {
            if (form.modo === 'crear') {
              const r = await api.usuarios('crear', datos);
              setCredenciales({ nombre: `${datos.nombre} ${datos.apellido}`, usuario: r.usuario, clave: datos.clave, nuevo: true });
            } else {
              await api.usuarios('editar', { uid: form.u.uid, ...datos });
              avisar('Cambios guardados');
            }
            setForm(null);
            cargar();
          }}
        />
      )}

      {restablecer && (
        <FormClave
          u={restablecer}
          onCerrar={() => setRestablecer(null)}
          onGuardar={async (clave) => {
            await api.usuarios('restablecer', { uid: restablecer.uid, clave });
            setCredenciales({ nombre: restablecer.nombre_completo, usuario: restablecer.usuario, clave, nuevo: false });
            setRestablecer(null);
            cargar();
          }}
        />
      )}

      {confirmar && (
        <Confirmar
          {...confirmar}
          onCerrar={() => setConfirmar(null)}
          onSi={async () => {
            if (confirmar.tipo === 'eliminar') await api.usuarios('eliminar', { uid: confirmar.u.uid });
            else await api.usuarios('estado', { uid: confirmar.u.uid, activo: false });
            avisar(confirmar.tipo === 'eliminar' ? 'Usuario eliminado' : 'Usuario desactivado');
            setConfirmar(null);
            cargar();
          }}
        />
      )}

      {credenciales && <Credenciales {...credenciales} onCerrar={() => setCredenciales(null)} />}

      {aviso && (
        <div className="fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-pop animate-rise">
          <IconCheck className="h-4 w-4" strokeWidth={3} /> {aviso}
        </div>
      )}
    </div>
  );
}

function FilaUsuario({ u, onEditar, onClave, onActivar, onDesactivar, onEliminar }) {
  const rol = rolDe(u.rol);
  const boton = 'rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition';
  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${u.activo ? '' : 'bg-zinc-50'}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-bold ${u.activo ? rol.color : 'bg-zinc-200 text-zinc-500'}`}>{iniciales(u.nombre_completo)}</span>
      <div className="min-w-0 flex-1">
        <p className={`flex flex-wrap items-center gap-1.5 text-[15px] font-semibold leading-tight ${u.activo ? '' : 'text-zinc-500'}`}>
          {u.nombre_completo || u.usuario}
          {u.yo && <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-white">Tú</span>}
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${rol.color}`}>{rol.corto}</span>
          {!u.activo && <span className="rounded-md bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold text-zinc-600">Desactivado</span>}
          {u.activo && u.debe_cambiar_clave && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">Clave temporal</span>}
        </p>
        <p className="mt-0.5 text-[12.5px] text-zinc-500">
          <span className="font-mono">{u.usuario}</span> · {haceCuanto(u.ultimo_ingreso)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button onClick={onEditar} className={`${boton} text-zinc-700 hover:bg-zinc-100`}>Editar</button>
        <button onClick={onClave} className={`${boton} text-zinc-700 hover:bg-zinc-100`}>Contraseña</button>
        {!u.yo && (u.activo
          ? <button onClick={onDesactivar} className={`${boton} text-amber-700 hover:bg-amber-50`}>Desactivar</button>
          : <button onClick={onActivar} className={`${boton} text-emerald-700 hover:bg-emerald-50`}>Activar</button>)}
        {!u.yo && <button onClick={onEliminar} className={`${boton} text-red-600 hover:bg-red-50`}>Eliminar</button>}
      </div>
    </div>
  );
}

function Encabezado({ titulo, sub, onCerrar }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
      <div>
        <h2 className="text-[17px] font-bold tracking-tight">{titulo}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-zinc-500">{sub}</p>}
      </div>
      <button onClick={onCerrar} aria-label="Cerrar" className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100"><IconX className="h-4 w-4" /></button>
    </div>
  );
}

function useEnvio(fn) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const enviar = async (...a) => {
    setError('');
    setEnviando(true);
    try { await fn(...a); } catch (e) { setError(e.message || 'No se pudo guardar.'); } finally { setEnviando(false); }
  };
  return { enviando, error, enviar };
}

function FormUsuario({ modo, u, onCerrar, onGuardar }) {
  const crear = modo === 'crear';
  const [nombre, setNombre] = useState(u?.nombre || '');
  const [apellido, setApellido] = useState(u?.apellido || '');
  const [usuario, setUsuario] = useState('');
  const [usuarioTocado, setUsuarioTocado] = useState(false);
  const [rol, setRol] = useState(u?.rol || 'vendedora');
  const [clave, setClave] = useState(() => generarClave());
  const { enviando, error, enviar } = useEnvio(onGuardar);

  const usuarioFinal = crear ? (usuarioTocado ? usuario : sugerirUsuario(nombre, apellido)) : u.usuario;
  const valido = nombre.trim().length >= 2 && apellido.trim().length >= 2 && (!crear || (/^[a-z0-9][a-z0-9._-]{2,29}$/.test(usuarioFinal) && clave.length >= 6));

  return (
    <Sheet onClose={onCerrar}>
      <Encabezado titulo={crear ? 'Nuevo usuario' : 'Editar usuario'} sub={crear ? 'El nombre y apellido salen en la comanda.' : u.usuario} onCerrar={onCerrar} />
      <form
        onSubmit={(e) => { e.preventDefault(); if (valido) enviar({ nombre, apellido, rol, ...(crear ? { usuario: usuarioFinal, clave } : {}) }); }}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="field" placeholder="Carlos" autoFocus />
          </label>
          <label className="block">
            <span className="label">Apellido</span>
            <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="field" placeholder="Pérez" />
          </label>
        </div>
        {nombre && apellido && <p className="-mt-2 text-[12.5px] text-zinc-500">En la comanda: <b className="text-zinc-800">Atiende: {`${nombre} ${apellido}`.replace(/\s+/g, ' ').trim().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}</b></p>}

        {crear && (
          <label className="block">
            <span className="label">Usuario para entrar</span>
            <input
              value={usuarioFinal}
              onChange={(e) => { setUsuarioTocado(true); setUsuario(e.target.value.toLowerCase().replace(/\s/g, '')); }}
              className="field font-mono"
              placeholder="carlos.perez"
            />
            <span className="mt-1 block text-[12px] text-zinc-500">Sin espacios ni tildes. Con esto y la contraseña entra al sistema.</span>
          </label>
        )}

        <fieldset>
          <legend className="label">Rol</legend>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <label key={r.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition ${rol === r.id ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-300'}`}>
                <input type="radio" name="rol" checked={rol === r.id} onChange={() => setRol(r.id)} className="mt-1 h-4 w-4 accent-zinc-900" />
                <span>
                  <span className="block text-[14px] font-semibold">{r.nombre}</span>
                  <span className="block text-[12.5px] leading-snug text-zinc-500">{r.desc}</span>
                </span>
              </label>
            ))}
          </div>
          {!crear && rol !== u.rol && <p className="mt-2 text-[12.5px] text-amber-700">El nuevo rol aplica la próxima vez que la persona entre.</p>}
        </fieldset>

        {crear && (
          <label className="block">
            <span className="label">Contraseña temporal</span>
            <div className="flex gap-2">
              <input value={clave} onChange={(e) => setClave(e.target.value)} className="field font-mono" />
              <button type="button" onClick={() => setClave(generarClave())} className="btn-secondary shrink-0 px-3 py-2 text-[13px]">Generar</button>
            </div>
            <span className="mt-1 block text-[12px] text-zinc-500">La persona la cambia por una propia al entrar la primera vez.</span>
          </label>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
        <button disabled={!valido || enviando} className="btn-primary w-full">{enviando ? 'Guardando…' : crear ? 'Crear usuario' : 'Guardar cambios'}</button>
      </form>
    </Sheet>
  );
}

function FormClave({ u, onCerrar, onGuardar }) {
  const [clave, setClave] = useState(() => generarClave());
  const { enviando, error, enviar } = useEnvio(onGuardar);
  return (
    <Sheet onClose={onCerrar}>
      <Encabezado titulo="Restablecer contraseña" sub={u.nombre_completo} onCerrar={onCerrar} />
      <form onSubmit={(e) => { e.preventDefault(); if (clave.length >= 6) enviar(clave); }} className="space-y-4 px-5 py-4">
        <p className="text-[13.5px] text-zinc-600">Se le asigna una contraseña temporal, se cierra su sesión en todos los equipos y al entrar deberá crear una nueva.</p>
        <div className="flex gap-2">
          <input value={clave} onChange={(e) => setClave(e.target.value)} className="field font-mono" />
          <button type="button" onClick={() => setClave(generarClave())} className="btn-secondary shrink-0 px-3 py-2 text-[13px]">Generar</button>
        </div>
        {clave.length < 6 && <p className="text-[13px] text-red-600">Mínimo 6 caracteres.</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
        <button disabled={clave.length < 6 || enviando} className="btn-primary w-full">{enviando ? 'Guardando…' : 'Restablecer'}</button>
      </form>
    </Sheet>
  );
}

function Confirmar({ tipo, u, onCerrar, onSi }) {
  const { enviando, error, enviar } = useEnvio(onSi);
  const eliminar = tipo === 'eliminar';
  return (
    <Sheet onClose={onCerrar}>
      <Encabezado titulo={eliminar ? `¿Eliminar a ${u.nombre_completo}?` : `¿Desactivar a ${u.nombre_completo}?`} onCerrar={onCerrar} />
      <div className="space-y-4 px-5 py-4">
        <p className="text-[13.5px] leading-relaxed text-zinc-600">
          {eliminar
            ? 'Se borra la cuenta y no podrá volver a entrar. Los pedidos que tomó se conservan. Esto no se puede deshacer; si solo dejó de trabajar por un tiempo, mejor desactívalo.'
            : 'No podrá entrar al sistema y su sesión abierta se cierra. Puedes activarlo de nuevo cuando quieras.'}
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCerrar} className="btn-secondary">Cancelar</button>
          <button onClick={() => enviar()} disabled={enviando} className={`btn-primary ${eliminar ? '' : 'bg-amber-600 hover:bg-amber-700'}`}>{enviando ? '…' : eliminar ? 'Eliminar' : 'Desactivar'}</button>
        </div>
      </div>
    </Sheet>
  );
}

function Credenciales({ nombre, usuario, clave, nuevo, onCerrar }) {
  const [copiado, setCopiado] = useState(false);
  const texto = [
    `Hola ${nombre.split(' ')[0]}, ${nuevo ? 'esta es tu cuenta' : 'te restablecí la contraseña'} para tomar pedidos en ISMA GASTRO-BAR:`,
    `🌐 ${typeof location !== 'undefined' && location.host && !location.protocol.startsWith('file') ? location.host : 'isma-pos.web.app'}`,
    `👤 Usuario: ${usuario}`,
    `🔑 Contraseña temporal: ${clave}`,
    'Al entrar te pedirá crear tu propia contraseña.',
  ].join('\n');
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); } catch {
      const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <Sheet onClose={onCerrar}>
      <Encabezado titulo={nuevo ? 'Usuario creado' : 'Contraseña restablecida'} sub="Entrégale estos datos. La contraseña no se vuelve a mostrar." onCerrar={onCerrar} />
      <div className="space-y-4 px-5 py-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-zinc-50 p-4 text-[14px]">
          <dt className="text-zinc-500">Usuario</dt><dd className="font-mono font-bold">{usuario}</dd>
          <dt className="text-zinc-500">Contraseña</dt><dd className="font-mono font-bold">{clave}</dd>
        </dl>
        <pre className="whitespace-pre-wrap rounded-xl border border-zinc-200 p-3 font-sans text-[13px] text-zinc-600">{texto}</pre>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copiar} className="btn-secondary">{copiado ? '✓ Copiado' : 'Copiar mensaje'}</button>
          <button onClick={onCerrar} className="btn-primary">Listo</button>
        </div>
      </div>
    </Sheet>
  );
}
