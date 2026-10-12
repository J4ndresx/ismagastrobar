import { useState } from 'react';
import { IconX } from './ui';

// Íconos del panel (trazo estilo Lucide)
const ic = (d) => ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>{d}</svg>
);
export const IconPizza = ic(<><path d="M12 2 2.5 20.5a.6.6 0 0 0 .7.8C6 20.4 9 20 12 20s6 .4 8.8 1.3a.6.6 0 0 0 .7-.8Z" /><circle cx="10" cy="13" r="1.3" /><circle cx="14" cy="16" r="1.3" /><circle cx="13" cy="10" r="1" /></>);
const IconTomar = ic(<><path d="M12 2 2.5 20.5a.6.6 0 0 0 .7.8C6 20.4 9 20 12 20s6 .4 8.8 1.3a.6.6 0 0 0 .7-.8Z" /><path d="M9 14h6" /></>);
const IconPedidos = ic(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>);
const IconCelular = ic(<><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>);
const IconDashboard = ic(<><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /></>);
const IconMenu = ic(<><path d="M4 6h16M4 12h16M4 18h10" /></>);
const IconReportes = ic(<><path d="M3 3v18h18" /><path d="M7 15v3M12 10v8M17 6v12" /></>);
const IconBell = ic(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);
const IconSearch = ic(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
const IconHamburguesa = ic(<><path d="M4 6h16M4 12h16M4 18h16" /></>);
const IconPrinter = ic(<><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></>);
const IconChevron = ic(<path d="m6 9 6 6 6-6" />);
const IconUsuarios = ic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>);
const IconLlave = ic(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>);
const IconAgotado = ic(<><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></>);
const IconSalir = ic(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>);

const NAV = [
  { id: 'tomar', nombre: 'Tomar Pedido', Icon: IconTomar, grupo: 'Operación' },
  { id: 'app', nombre: 'Pedidos App', Icon: IconCelular, grupo: 'Operación' },
  { id: 'pedidos', nombre: 'Pedidos', Icon: IconPedidos, grupo: 'Operación' },
  { id: 'menu_dia', nombre: 'Menú del Día', Icon: IconMenu, grupo: 'Administración' },
  { id: 'agotados', nombre: 'Agotados', Icon: IconAgotado, grupo: 'Administración' },
  { id: 'usuarios', nombre: 'Usuarios', Icon: IconUsuarios, grupo: 'Administración' },
];
const PRONTO = [
  { nombre: 'Dashboard', Icon: IconDashboard },
  { nombre: 'Menú y precios', Icon: IconMenu },
  { nombre: 'Reportes', Icon: IconReportes },
];

const etiqueta = 'px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400';

function Sidebar({ vista, setVista, permitidas, etiquetas = {}, badges = {}, impresoraOk, textoImpresora, extraAbajo, onNavegar }) {
  const items = NAV.filter((n) => permitidas.includes(n.id));
  const grupos = [...new Set(items.map((n) => n.grupo))];
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
          <IconPizza className="h-6 w-6" />
        </span>
        <div className="leading-tight">
          <p className="text-[15px] font-extrabold tracking-tight">ISMA GASTRO-BAR</p>
          <p className="text-[12px] font-medium text-slate-400">Panel · v1.0</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {grupos.map((g, gi) => (
          <div key={g}>
            <p className={`${etiqueta} mb-2 ${gi ? 'mt-6' : ''}`}>{g}</p>
            {items.filter((n) => n.grupo === g).map(({ id, nombre, Icon }) => {
              const on = vista === id;
              return (
                <button
                  key={id}
                  onClick={() => { setVista(id); onNavegar?.(); }}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition ${on ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1 text-left">{etiquetas[id] || nombre}</span>
                  {badges[id] > 0 && (
                    <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ${on ? 'bg-white text-slate-900' : id === 'app' ? 'animate-pulso bg-violet-600 text-white' : 'bg-amber-400 text-amber-950'}`}>{badges[id]}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {permitidas.includes('usuarios') && <p className={`${etiqueta} mb-2 mt-6`}>Próximamente</p>}
        {permitidas.includes('usuarios') && PRONTO.map(({ nombre, Icon }) => (
          <div key={nombre} className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold text-slate-300">
            <Icon className="h-5 w-5" />
            <span className="flex-1">{nombre}</span>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-slate-100 px-3 py-4">
        <p className={etiqueta}>Configuración</p>
        {extraAbajo}
        <div className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-bold uppercase tracking-wide ${impresoraOk ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <span className={`h-2 w-2 rounded-full ${impresoraOk ? 'bg-emerald-500' : 'animate-pulso bg-red-500'}`} />
          <IconPrinter className="h-4 w-4" />
          {textoImpresora}
        </div>
      </div>
    </div>
  );
}

/**
 * Panel administrativo: menú lateral (fijo en PC, hamburguesa en celular)
 * + encabezado con título, buscador, notificaciones y usuario.
 */
export default function Shell({ vista, setVista, permitidas, etiquetas, titulo, subtitulo, busqueda, setBusqueda, notificaciones, onNotificaciones, usuario, impresoraOk, textoImpresora, badges, extraAbajo, onCambiarClave, onSalir, children }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const sidebarProps = { vista, setVista, permitidas, etiquetas, badges, impresoraOk, textoImpresora, extraAbajo };
  const inicial = (usuario?.nombre || usuario?.email || '?').trim()[0].toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-[268px]">
      {/* Menú lateral PC */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] border-r border-slate-200 lg:block">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* Menú lateral celular (hamburguesa) */}
      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/40 animate-fade" onClick={() => setMenuAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 w-[82%] max-w-[300px] shadow-pop animate-[entrar_.22s_ease-out]">
            <button onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="absolute right-3 top-6 z-10 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100">
              <IconX className="h-4 w-4" />
            </button>
            <Sidebar {...sidebarProps} onNavegar={() => setMenuAbierto(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 lg:px-6 lg:py-4">
          <button onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden">
            <IconHamburguesa className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[19px] font-extrabold leading-tight tracking-tight lg:text-[21px]">{titulo}</h1>
            <p className="truncate text-[13.5px] text-slate-500">{subtitulo}</p>
          </div>
          {setBusqueda && (
            <label className="relative hidden w-[280px] md:block">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto…" className="w-full rounded-xl border border-transparent bg-slate-100 py-2.5 pl-9 pr-3 text-[14px] outline-none transition focus:border-slate-300 focus:bg-white" />
            </label>
          )}
          {onNotificaciones && (
            <button onClick={onNotificaciones} aria-label="Notificaciones" className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100">
              <IconBell className="h-5 w-5" />
              {notificaciones > 0 && (
                <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {notificaciones > 9 ? '9+' : notificaciones}
                </span>
              )}
            </button>
          )}
          <div className="relative">
            <button onClick={() => setMenuUsuario((v) => !v)} aria-label="Mi cuenta" className="flex items-center gap-1 rounded-full hover:opacity-90">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-[14px] font-bold text-white">{inicial}</span>
              <IconChevron className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
            {menuUsuario && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuUsuario(false)} />
                <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop animate-rise">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-[14.5px] font-bold">{usuario?.nombre || usuario?.email}</p>
                    <p className="truncate text-[12.5px] text-slate-500">{usuario?.rolNombre} · {usuario?.usuario}</p>
                  </div>
                  <button onClick={() => { setMenuUsuario(false); onCambiarClave(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-medium text-slate-700 hover:bg-slate-50">
                    <IconLlave className="h-[18px] w-[18px]" /> Cambiar contraseña
                  </button>
                  <button onClick={() => { setMenuUsuario(false); onSalir(); }} className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-[14px] font-medium text-red-600 hover:bg-red-50">
                    <IconSalir className="h-[18px] w-[18px]" /> Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div>{children}</div>
    </div>
  );
}
