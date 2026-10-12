// Panel del administrador: marcar platos como "Agotados". Desaparecen al instante
// de la app del cliente (y del POS) hasta que se vuelvan a activar.
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
    </div>
  );
}
