// Panel del administrador: el dueño arma el Menú del Día (sopa, proteína, ensalada y bebida)
// y lo publica. Lo normal es TOCAR opciones (las que ya ha usado + sugerencias); si hay algo
// nuevo lo escribe una vez y queda guardado para los próximos días.
// Los clientes lo ven al instante (Firestore en tiempo real).
// Datos: restaurantes/{rid}/menu_del_dia/actual y /frecuentes (ver shared/menuDelDia.js).
import { useEffect, useMemo, useState } from 'react';
import {
  MDD_MAX_OPCIONES, actualizarFrecuentes, hoyBogota, menuDelDiaVigente, normalizarLista, opcionesParaElegir, separarOpciones, slugOpcion,
} from '@shared/menuDelDia.js';
import * as api from '../data/api';
import { IconPlus, IconX } from './ui';

const GRUPOS = [
  { campo: 'sopaDelDia', nombre: 'Sopa', ayuda: 'Con una queda fija; con varias, el cliente escoge.' },
  { campo: 'proteinaDelDia', nombre: 'Proteína', ayuda: 'Toca todas las que hay hoy.' },
  { campo: 'ensaladaDelDia', nombre: 'Ensalada', ayuda: 'Toca las de hoy.' },
  { campo: 'bebidaDelDia', nombre: 'Bebida', ayuda: 'Toca la bebida (o bebidas) del día.' },
];
const VACIO = { sopaDelDia: [], proteinaDelDia: [], ensaladaDelDia: [], bebidaDelDia: [] };
const SIN_TEXTO = { sopaDelDia: '', proteinaDelDia: '', ensaladaDelDia: '', bebidaDelDia: '' };

const fechaLarga = (iso) => new Date(`${iso}T12:00:00-05:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const IconCheck = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="m5 12 5 5 9-10" /></svg>
);

/** Une lo elegido con lo escrito en la caja (aunque no hayan tocado "Agregar"). */
const conPendientes = (form, textos) =>
  Object.fromEntries(GRUPOS.map(({ campo }) => [campo, normalizarLista([...form[campo], ...separarOpciones(textos[campo])])]));

function Grupo({ paso, grupo, valor, opciones, texto, setTexto, onChange, onNuevas }) {
  const ids = new Set(valor.map((o) => o.id));
  const lleno = valor.length >= MDD_MAX_OPCIONES;
  // Lo escrito a mano hoy que no está en las opciones va primero, para que se vea marcado.
  const chips = [...valor.filter((o) => !opciones.some((n) => slugOpcion(n) === o.id)).map((o) => o.nombre), ...opciones];

  const tocar = (nombre) => {
    const id = slugOpcion(nombre);
    if (ids.has(id)) onChange(valor.filter((o) => o.id !== id));
    else if (!lleno) onChange(normalizarLista([...valor, nombre]));
  };
  const agregarTexto = () => {
    const nuevas = separarOpciones(texto);
    if (!nuevas.length) return;
    onChange(normalizarLista([...valor, ...nuevas]));
    onNuevas(nuevas); // queda guardada en la lista desde ya (no hay que publicar para no perderla)
    setTexto('');
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${valor.length ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {valor.length ? <IconCheck className="h-3.5 w-3.5" /> : paso}
        </span>
        <h3 className="flex-1 text-[16px] font-bold tracking-tight">{grupo.nombre}</h3>
        <span className={`text-[12px] font-medium ${valor.length ? 'text-emerald-700' : 'text-amber-600'}`}>
          {valor.length ? `${valor.length} elegida${valor.length > 1 ? 's' : ''}` : 'Toca una opción'}
        </span>
      </div>
      <p className="mt-1 pl-[38px] text-[12.5px] text-zinc-500">{grupo.ayuda}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((nombre) => {
          const on = ids.has(slugOpcion(nombre));
          return (
            <button
              key={nombre}
              type="button"
              onClick={() => tocar(nombre)}
              disabled={!on && lleno}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-semibold transition active:scale-95 disabled:opacity-40 ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
            >
              {on ? <IconCheck className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5 text-slate-400" />}
              {nombre}
            </button>
          );
        })}
      </div>

      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); agregarTexto(); }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={lleno}
          placeholder="¿Otra? Escríbela aquí"
          className="field py-2 text-[14px]"
        />
        <button type="submit" disabled={!texto.trim() || lleno} className="btn-secondary shrink-0 px-3.5 py-2 disabled:opacity-40">
          <IconPlus className="h-4 w-4" /> Agregar
        </button>
      </form>
    </section>
  );
}

export default function MenuDelDia() {
  const [guardado, setGuardado] = useState(undefined); // undefined = cargando · null = nunca guardado
  const [frecuentes, setFrecuentes] = useState({});
  const [form, setForm] = useState(VACIO);
  const [textos, setTextos] = useState(SIN_TEXTO);
  const [tocado, setTocado] = useState(false);
  const [estado, setEstado] = useState({ tipo: '', texto: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => api.escucharMenuDelDia(setGuardado), []);
  useEffect(() => api.escucharFrecuentesMdd(setFrecuentes), []);

  // Carga lo guardado (también si lo cambió otro dispositivo) mientras no estés editando.
  // Si es de otro día, igual se carga: casi siempre se repite buena parte y solo se ajusta.
  useEffect(() => {
    if (guardado === undefined || tocado) return;
    setForm({
      sopaDelDia: guardado?.sopaDelDia || [],
      proteinaDelDia: guardado?.proteinaDelDia || [],
      ensaladaDelDia: guardado?.ensaladaDelDia || [],
      bebidaDelDia: guardado?.bebidaDelDia || [],
    });
  }, [guardado, tocado]);

  const opciones = useMemo(() => Object.fromEntries(GRUPOS.map(({ campo }) => [campo, opcionesParaElegir(frecuentes, campo)])), [frecuentes]);

  if (guardado === undefined) return <p className="py-10 text-center text-[14px] text-zinc-500">Cargando Menú del Día…</p>;

  const editar = () => { setTocado(true); setEstado({ tipo: '', texto: '' }); };
  const cambiar = (campo) => (valor) => { editar(); setForm((f) => ({ ...f, [campo]: valor })); };
  const setTexto = (campo) => (t) => { editar(); setTextos((x) => ({ ...x, [campo]: t })); };
  const limpiar = () => { editar(); setForm(VACIO); setTextos(SIN_TEXTO); };
  // Opción escrita a mano: se guarda de una vez en las frecuentes de Firestore.
  const recordar = (campo) => async (nuevas) => {
    try {
      await api.guardarFrecuentesMdd(actualizarFrecuentes(frecuentes, { [campo]: nuevas }));
    } catch (err) {
      console.error(err);
      setEstado({ tipo: 'error', texto: err?.code === 'permission-denied'
        ? 'No se pudo guardar la opción en la lista. Falta publicar las reglas de Firestore (corre desplegar.bat completo).'
        : 'No se pudo guardar la opción en la lista. Revisa la conexión.' });
    }
  };

  const final = conPendientes(form, textos);
  const faltan = GRUPOS.filter((g) => final[g.campo].length === 0).map((g) => g.nombre.toLowerCase());
  const vigente = menuDelDiaVigente(guardado);
  const esDeOtroDia = guardado?.fecha && guardado.fecha !== hoyBogota();
  const hayAlgo = GRUPOS.some((g) => form[g.campo].length);

  const banner = vigente && !tocado
    ? { tono: 'border-emerald-200 bg-emerald-50 text-emerald-800', t: '✓ Publicado para hoy', d: 'Tus clientes ya lo ven en la app. Si algo se acaba, quítalo y vuelve a publicar.' }
    : vigente
      ? { tono: 'border-sky-200 bg-sky-50 text-sky-800', t: 'Tienes cambios sin publicar', d: 'Los clientes siguen viendo la versión anterior hasta que toques “Publicar”.' }
      : esDeOtroDia && hayAlgo
        ? { tono: 'border-amber-200 bg-amber-50 text-amber-800', t: `Cargamos el menú del ${fechaLarga(guardado.fecha)}`, d: 'Quita lo que no haya hoy, toca lo nuevo y publica. Los clientes todavía no lo ven.' }
        : { tono: 'border-zinc-200 bg-zinc-50 text-zinc-700', t: 'Los clientes no ven el Menú del Día', d: 'Toca una opción en cada parte y publica.' };

  const guardar = async (disponible) => {
    setGuardando(true);
    setEstado({ tipo: '', texto: '' });
    try {
      await api.guardarMenuDelDia({ ...final, disponible }, frecuentes);
      setForm(final);
      setTextos(SIN_TEXTO);
      setTocado(false);
      setEstado(disponible
        ? { tipo: 'ok', texto: 'Listo: el Menú del Día ya está publicado y los clientes lo ven al instante.' }
        : { tipo: 'ok', texto: 'Guardado. Los clientes NO lo ven hasta que lo publiques.' });
    } catch (err) {
      console.error(err);
      setEstado({ tipo: 'error', texto: err?.code === 'permission-denied' ? 'Solo el administrador puede cambiar el Menú del Día.' : err?.message || 'No se pudo guardar. Revisa la conexión.' });
    } finally {
      setGuardando(false);
    }
  };

  const resumen = GRUPOS.map((g) => final[g.campo].map((o) => o.nombre).join(' o ')).filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-36">
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${banner.tono}`}>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold first-letter:uppercase">{banner.t}</p>
          <p className="text-[13px] opacity-90">{banner.d}</p>
        </div>
        {hayAlgo && !vigente && (
          <button type="button" onClick={limpiar} className="shrink-0 rounded-lg border border-black/10 bg-white/70 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-white">Empezar de cero</button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {GRUPOS.map((g, i) => (
          <Grupo key={g.campo} paso={i + 1} grupo={g} valor={form[g.campo]} opciones={opciones[g.campo]} texto={textos[g.campo]} setTexto={setTexto(g.campo)} onChange={cambiar(g.campo)} onNuevas={recordar(g.campo)} />
        ))}
      </div>

      {estado.texto && (
        <p className={`rounded-xl border px-4 py-3 text-[13.5px] ${estado.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{estado.texto}</p>
      )}

      {/* Barra fija: lo que verá el cliente + publicar */}
      <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-pop backdrop-blur sm:p-4">
        <p className="mb-2.5 text-[12.5px] leading-snug text-slate-500">
          <span className="font-semibold text-slate-700">El cliente verá: </span>
          {resumen || 'nada todavía'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {vigente && !tocado ? (
            <>
              <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-[15px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <IconCheck className="h-4 w-4" /> Publicado para hoy
              </span>
              <button type="button" disabled={guardando} onClick={() => guardar(false)} className="btn-secondary py-3">Ocultar de la app</button>
            </>
          ) : (
            <>
              <button onClick={() => guardar(true)} disabled={guardando || faltan.length > 0} className="btn-primary flex-1 py-3 text-[15.5px]">
                {guardando ? 'Publicando…' : vigente ? 'Publicar cambios' : 'Publicar para hoy'}
              </button>
              {!vigente && hayAlgo && (
                <button type="button" disabled={guardando} onClick={() => guardar(false)} className="btn-secondary py-3 text-[13.5px]">Guardar sin publicar</button>
              )}
            </>
          )}
        </div>
        {faltan.length > 0 && (!vigente || tocado) && <p className="mt-2 text-center text-[12.5px] font-medium text-amber-700">Falta elegir: {faltan.join(', ')}.</p>}
      </div>
    </div>
  );
}
