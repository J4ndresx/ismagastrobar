// Panel del administrador: el dueño arma el Menú del Día (sopa, proteína, ensalada y bebida)
// y lo publica. Cada opción se escribe a mano (así el dueño puede poner lo que haya ese día). Los clientes lo ven al instante en su celular (Firestore en tiempo real).
// Datos: restaurantes/{rid}/menu_del_dia/actual (ver shared/menuDelDia.js).
import { useEffect, useState } from 'react';
import { MDD_GRUPOS, MDD_MAX_OPCIONES, MDD_MAX_LARGO, hoyBogota, menuDelDiaVigente, normalizarLista, slugOpcion } from '@shared/menuDelDia.js';
import * as api from '../data/api';
import { IconPlus, IconX } from './ui';

const GRUPOS = Object.values(MDD_GRUPOS); // [{ campo, nombre }]
const VACIO = { sopaDelDia: [], proteinaDelDia: [], ensaladaDelDia: [], bebidaDelDia: [], disponible: false };

const fechaLarga = (iso) => new Date(`${iso}T12:00:00-05:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

function Selector({ titulo, ayuda, valor, onChange }) {
  const [texto, setTexto] = useState('');
  const lleno = valor.length >= MDD_MAX_OPCIONES;
  const agregar = (nombre) => {
    const nueva = normalizarLista([...valor, nombre]);
    if (nueva.length !== valor.length) onChange(nueva);
    setTexto('');
  };
  const quitar = (id) => onChange(valor.filter((o) => o.id !== id));
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[16px] font-bold tracking-tight">{titulo}</h3>
        <span className="text-[12px] text-zinc-400">{valor.length ? `${valor.length} elegida${valor.length > 1 ? 's' : ''}` : 'Falta elegir'}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-zinc-500">{ayuda}</p>

      <div className="mt-3 flex min-h-[40px] flex-wrap gap-2">
        {valor.length === 0 && <span className="self-center text-[13px] text-zinc-400">Ninguna todavía</span>}
        {valor.map((o) => (
          <span key={o.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 py-1.5 pl-3.5 pr-2 text-[13.5px] font-semibold text-white">
            {o.nombre}
            <button type="button" onClick={() => quitar(o.id)} aria-label={`Quitar ${o.nombre}`} className="grid h-5 w-5 place-items-center rounded-full bg-white/15 hover:bg-white/30">
              <IconX className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim()) agregar(texto); }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={MDD_MAX_LARGO} disabled={lleno} placeholder={`Escribe la ${titulo.toLowerCase()} y toca Agregar`} className="field" />
        <button type="submit" disabled={!texto.trim() || lleno} className="btn-secondary px-4 py-2.5 disabled:opacity-40">
          <IconPlus className="h-4 w-4" /> Agregar
        </button>
      </form>
    </section>
  );
}

export default function MenuDelDia() {
  const [guardado, setGuardado] = useState(undefined); // undefined = cargando · null = nunca guardado
  const [form, setForm] = useState(VACIO);
  const [tocado, setTocado] = useState(false);
  const [estado, setEstado] = useState({ tipo: '', texto: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => api.escucharMenuDelDia(setGuardado), []);

  // Carga lo guardado (también si lo cambió otro dispositivo) mientras no estés editando.
  useEffect(() => {
    if (guardado === undefined || tocado) return;
    const esDeHoy = guardado?.fecha === hoyBogota();
    setForm({
      sopaDelDia: guardado?.sopaDelDia || [],
      proteinaDelDia: guardado?.proteinaDelDia || [],
      ensaladaDelDia: guardado?.ensaladaDelDia || [],
      bebidaDelDia: guardado?.bebidaDelDia || [],
      disponible: esDeHoy && guardado?.disponible === true,
    });
  }, [guardado, tocado]);

  if (guardado === undefined) return <p className="py-10 text-center text-[14px] text-zinc-500">Cargando Menú del Día…</p>;

  const cambiar = (campo) => (valor) => { setTocado(true); setEstado({ tipo: '', texto: '' }); setForm((f) => ({ ...f, [campo]: valor })); };
  const faltan = GRUPOS.filter((g) => form[g.campo].length === 0).map((g) => g.nombre.toLowerCase());

  const vigente = menuDelDiaVigente(guardado);
  const esDeAyer = guardado && guardado.fecha !== hoyBogota() && guardado.fecha;
  const banner = vigente
    ? { tono: 'border-emerald-200 bg-emerald-50 text-emerald-800', t: 'Publicado para hoy', d: 'Tus clientes ya lo ven en la app.' }
    : esDeAyer
      ? { tono: 'border-amber-200 bg-amber-50 text-amber-800', t: 'El menú guardado es del ' + fechaLarga(guardado.fecha), d: 'Los clientes NO lo ven. Revísalo y publícalo para hoy.' }
      : { tono: 'border-zinc-200 bg-zinc-50 text-zinc-700', t: 'No se muestra a los clientes', d: guardado?.disponible === false && guardado?.fecha === hoyBogota() ? 'Está guardado pero apagado.' : 'Arma el menú de hoy y publícalo.' };

  const guardar = async () => {
    setGuardando(true);
    setEstado({ tipo: '', texto: '' });
    try {
      await api.guardarMenuDelDia(form);
      setTocado(false);
      setEstado(form.disponible
        ? { tipo: 'ok', texto: 'Listo: el Menú del Día ya está publicado y los clientes lo ven al instante.' }
        : { tipo: 'ok', texto: 'Guardado. Los clientes NO lo ven hasta que lo muestres.' });
    } catch (err) {
      console.error(err);
      setEstado({ tipo: 'error', texto: err?.code === 'permission-denied' ? 'Solo el administrador puede cambiar el Menú del Día.' : err?.message || 'No se pudo guardar. Revisa la conexión.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <div className={`rounded-xl border px-4 py-3 ${banner.tono}`}>
        <p className="text-[14px] font-bold">{banner.t}</p>
        <p className="text-[13px] opacity-90">{banner.d}</p>
      </div>

      <Selector titulo="Sopa" ayuda="Elige las sopas de hoy. Con una sola queda fija; con varias, el cliente escoge una." valor={form.sopaDelDia} onChange={cambiar('sopaDelDia')} />
      <Selector titulo="Proteína" ayuda="Elige las proteínas que hay hoy." valor={form.proteinaDelDia} onChange={cambiar('proteinaDelDia')} />
      <Selector titulo="Ensalada" ayuda="Elige las ensaladas de hoy. El cliente escoge una." valor={form.ensaladaDelDia} onChange={cambiar('ensaladaDelDia')} />
      <Selector titulo="Bebida" ayuda="Elige la bebida (o bebidas) del día." valor={form.bebidaDelDia} onChange={cambiar('bebidaDelDia')} />

      <section className="card flex items-center justify-between gap-4 p-4 sm:p-5">
        <div>
          <p className="text-[15px] font-bold">Mostrar a los clientes</p>
          <p className="text-[13px] text-zinc-500">{form.disponible ? 'Visible hoy en la app.' : 'Oculto: el cliente no ve el Menú del Día.'}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.disponible}
          onClick={() => { setTocado(true); setEstado({ tipo: '', texto: '' }); setForm((f) => ({ ...f, disponible: !f.disponible })); }}
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${form.disponible ? 'bg-emerald-500' : 'bg-zinc-300'}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${form.disponible ? 'left-7' : 'left-1'}`} />
        </button>
      </section>

      {estado.texto && (
        <p className={`rounded-xl border px-4 py-3 text-[13.5px] ${estado.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{estado.texto}</p>
      )}

      <div className="sticky bottom-3 z-10">
        <button onClick={guardar} disabled={guardando || (form.disponible && faltan.length > 0)} className="btn-primary w-full shadow-lg">
          {guardando ? 'Guardando…' : form.disponible ? 'Publicar Menú del Día' : 'Guardar sin mostrar'}
        </button>
        {form.disponible && faltan.length > 0 && <p className="mt-2 text-center text-[12.5px] font-medium text-red-600">Falta elegir: {faltan.join(', ')}.</p>}
      </div>
    </div>
  );
}
