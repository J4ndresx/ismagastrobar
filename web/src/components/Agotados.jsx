// Panel del administrador: marcar platos como "Agotados". Desaparecen al instante
// de la app del cliente (y del POS) hasta que se vuelvan a activar.
// Abajo, "Opciones de los platos": prender/apagar una opción suelta (p. ej. "no hay chorizo").
import { useEffect, useMemo, useState } from 'react';
import { MDD_ITEM_ID } from '@shared/menuDelDia.js';
import * as api from '../data/api';
import { IconX } from './ui';

const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Agotados() {
  const [cat, setCat] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [pendientes, setPendientes] = useState(() => new Set());
  const [confirmar, setConfirmar] = useState(false);
  const [opcPendiente, setOpcPendiente] = useState(null);
  useEffect(() => api.escucharCatalogo(setCat), []);
  useEffect(() => { if (!confirmar) return; const t = setTimeout(() => setConfirmar(false), 5000); return () => clearTimeout(t); }, [confirmar]);

  // El Menú del Día se maneja en su propio panel (no es un plato que se "agote").
  const items = useMemo(() => (cat?.items || []).filter((i) => i.id !== MDD_ITEM_ID), [cat]);
  const agotados = items.filter((i) => i.agotado === true);
  const secciones = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return (cat?.categorias || [])
      .filter((c) => !c.parent_id)
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({ c, lista: items.filter((i) => i.categoria_id === c.id && (!q || normalizar(i.nombre).includes(q))).sort((a, b) => a.orden - b.orden) }))
      .filter((s) => s.lista.length);
  }, [cat, items, busqueda]);

  // Grupos de opciones que usan los platos (los del Menú del Día se manejan en su panel).
  const gruposUsados = useMemo(() => {
    const usos = {};
    for (const i of items) for (const r of i.grupos_opciones || []) {
      if (r.grupo_id.startsWith('mdd_') || !cat?.grupos?.[r.grupo_id]) continue;
      (usos[r.grupo_id] ||= []).push(i.nombre);
    }
    return Object.entries(usos).map(([id, platos]) => ({ g: cat.grupos[id], platos }));
  }, [cat, items]);
  const apagadas = gruposUsados.reduce((n, { g }) => n + g.opciones.filter((o) => o.activo === false).length, 0);

  const cambiarOpcion = async (g, o) => {
    setError('');
    setOpcPendiente(`${g.id}/${o.id}`);
    try {
      await api.cambiarOpcion(g.id, o.id, o.activo === false);
    } catch (e) {
      console.error(e);
      setError(e?.code === 'permission-denied' ? 'Solo el administrador puede cambiar opciones.' : e?.message || 'No se pudo cambiar. Revisa la conexión.');
    } finally {
      setOpcPendiente(null);
    }
  };

  const marcar = async (item) => {
    setError('');
    setPendientes((p) => new Set(p).add(item.id));
    try {
      await api.marcarAgotado(item.id, !item.agotado);
    } catch (e) {
      console.error(e);
      setError(e?.code === 'permission-denied' ? 'Solo el administrador puede marcar agotados.' : 'No se pudo cambiar. Revisa la conexión.');
    } finally {
      setPendientes((p) => { const n = new Set(p); n.delete(item.id); return n; });
    }
  };
  const limpiar = async () => {
    if (!confirmar) return setConfirmar(true);
    setConfirmar(false);
    setError('');
    try { await api.limpiarAgotados(agotados.map((i) => i.id)); } catch (e) { console.error(e); setError('No se pudo limpiar. Revisa la conexión.'); }
  };

  if (!cat) return <p className="py-10 text-center text-[14px] text-zinc-500">Cargando productos…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-[15px] font-bold">{agotados.length ? `${agotados.length} producto${agotados.length > 1 ? 's' : ''} agotado${agotados.length > 1 ? 's' : ''}` : 'Nada agotado'}</p>
          <p className="text-[13px] text-zinc-500">Los agotados no se ven en la app del cliente.</p>
        </div>
        {agotados.length > 0 && (
          <button onClick={limpiar} className={confirmar ? 'btn-primary px-4 py-2.5' : 'btn-secondary px-4 py-2.5'}>
            {confirmar ? '¿Seguro? Toca para confirmar' : 'Volver a activar todos'}
          </button>
        )}
      </div>

      <div className="relative">
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto…" className="field pr-10" />
        {busqueda && (
          <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100">
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">{error}</p>}

      {secciones.map(({ c, lista }) => (
        <section key={c.id}>
          <h3 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">{c.nombre}</h3>
          <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {lista.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14.5px] font-semibold ${i.agotado ? 'text-zinc-400 line-through' : ''}`}>{i.nombre}</p>
                  {i.agotado && <p className="text-[12px] font-semibold text-red-600">Agotado · oculto para clientes</p>}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={i.agotado === true}
                  aria-label={`${i.nombre}: ${i.agotado ? 'agotado' : 'disponible'}`}
                  disabled={pendientes.has(i.id)}
                  onClick={() => marcar(i)}
                  className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-60 ${i.agotado ? 'bg-red-500' : 'bg-emerald-500'}`}
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${i.agotado ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {!secciones.length && <p className="py-8 text-center text-[14px] text-zinc-500">No hay productos con ese nombre.</p>}

      {!busqueda.trim() && gruposUsados.length > 0 && (
        <section className="pt-4">
          <div className="mb-2 px-1">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Opciones de los platos</h3>
            <p className="text-[13px] text-zinc-500">
              Toca una opción para apagarla si se acabó (p. ej. chorizo). {apagadas ? <b className="text-red-600">{apagadas} apagada{apagadas > 1 ? 's' : ''}.</b> : 'Todas disponibles.'}
            </p>
          </div>
          <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {gruposUsados.map(({ g, platos }) => {
              const activas = g.opciones.filter((o) => o.activo !== false).length;
              return (
                <div key={g.id} className="px-4 py-3">
                  <p className="text-[14px] font-semibold">{g.nombre}</p>
                  <p className="mb-2 truncate text-[12px] text-zinc-400">{platos.join(' · ')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.opciones.map((o) => {
                      const on = o.activo !== false;
                      const ultima = on && activas === 1;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          aria-pressed={on}
                          disabled={opcPendiente === `${g.id}/${o.id}` || ultima}
                          title={ultima ? 'Es la única disponible: no se puede apagar' : on ? 'Toca para apagar' : 'Toca para volver a prender'}
                          onClick={() => cambiarOpcion(g, o)}
                          className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${on ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-600 line-through'}`}
                        >
                          {o.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
