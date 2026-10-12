import { agruparPorZona, resumenLinea } from '@shared/comandas.js';
import { ZONA_UI, TIPOS_ENTREGA, cop } from '../lib/zonasUI';
import { DOMICILIO, conjuntoPorId } from '../lib/domicilio';
import { IconTrash, IconMinus, IconPlus } from './ui';
import EstadoZonas from './EstadoZonas';

export const etiquetaCard = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400';

const campo = 'w-full rounded-xl border border-slate-200 bg-[#FBFAF7] px-3.5 py-3 text-[15px] outline-none transition focus:border-slate-400 focus:bg-white';

/** Valor calculado del domicilio + opción de escribirlo a mano. */
function ResultadoDomicilio({ datos, setDatos, domicilio }) {
  const c = domicilio?.calculado;
  const km = (k) => String(k).replace('.', ',');
  let texto, tono;
  if (domicilio?.calculando) { texto = 'Calculando el domicilio…'; tono = 'text-slate-500'; }
  else if (c?.tipo === 'SECTOR') { texto = `Domicilio ${cop(c.tarifa)}${c.metodo === 'conjunto' ? ' · conjunto' : ` · ${km(c.km)} km`}`; tono = 'text-emerald-700'; }
  else if (c?.tipo === 'FUERA') { texto = `Fuera de cobertura (${km(c.km)} km, máximo ${c.maxKm} km)`; tono = 'text-red-600'; }
  else if (c?.tipo === 'PENDIENTE_INFORMAR') { texto = 'No se pudo ubicar la dirección: escribe el valor a mano o queda por confirmar'; tono = 'text-amber-700'; }
  else { texto = 'Escribe la dirección con # y número para calcular'; tono = 'text-slate-400'; }
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] font-semibold ${tono}`}>{texto}</p>
        {c?.direccion_encontrada && <p className="text-[12px] text-slate-400">Ubicada en: {c.direccion_encontrada}</p>}
      </div>
      <label className="w-[150px]">
        <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Ajustar valor (opcional)</span>
        <input
          value={datos.domicilio_manual}
          onChange={(e) => setDatos({ ...datos, domicilio_manual: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          inputMode="numeric"
          placeholder={c?.tipo === 'SECTOR' ? String(c.tarifa) : '$'}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] tabular-nums outline-none focus:border-slate-400"
        />
      </label>
    </div>
  );
}

/** Tarjeta "Datos del cliente". */
const num = (n) => `#${String(n).padStart(3, '0')}`;
const ENTREGA_TXT = { mesa: 'Mesa', llevar: 'Para llevar' };

export function DatosCliente({ datos, setDatos, domicilio, cuentasAbiertas = [], cuentaSel = null, tablero = null }) {
  const conjunto = datos.zona && datos.zona !== 'otra' ? conjuntoPorId(datos.zona) : null;
  if (cuentaSel) {
    return (
      <section className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5">
        <p className={`${etiquetaCard} mb-2 !text-amber-800`}>Agregando a una cuenta abierta</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[18px] font-bold">
              <span className="font-mono">{num(cuentaSel.numero)}</span> · {cuentaSel.mesa ? `Mesa ${cuentaSel.mesa}` : ENTREGA_TXT[cuentaSel.tipo_entrega]}
              {cuentaSel.cliente?.nombre && ` · ${cuentaSel.cliente.nombre}`}
            </p>
            <p className="text-[13px] text-amber-900/80">
              Lleva {cop(cuentaSel.total_cuenta ?? cuentaSel.total)}. Agrega solo lo nuevo: la comanda sale marcada ADICIÓN.
            </p>
          </div>
          <button onClick={() => setDatos({ ...datos, cuenta_id: '', nombre: '', mesa: null })} className="rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-amber-900 hover:bg-amber-100">
            Mejor un pedido nuevo
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className={`${etiquetaCard} mb-4`}>Datos del cliente</p>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {TIPOS_ENTREGA.map((t) => (
          <button
            key={t.id}
            onClick={() => setDatos({ ...datos, tipo_entrega: t.id, ...(t.id !== 'mesa' ? { mesa: null } : {}) })}
            className={`rounded-lg py-2.5 text-[13.5px] font-semibold transition ${datos.tipo_entrega === t.id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500'}`}
          >
            {t.nombre}
          </button>
        ))}
      </div>
      {datos.tipo_entrega === 'mesa' && tablero && <TableroMesas datos={datos} setDatos={setDatos} tablero={tablero} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-600">{datos.tipo_entrega === 'mesa' ? 'Nombre (opcional)' : 'Nombre'}{datos.tipo_entrega === 'domicilio' && ' *'}</span>
          <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} placeholder={datos.tipo_entrega === 'mesa' ? 'Ej: Carlos' : 'Nombre del cliente'} className="w-full rounded-xl border border-slate-200 bg-[#FBFAF7] px-3.5 py-3 text-[15px] outline-none transition focus:border-slate-400 focus:bg-white" />
        </label>
        <label>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-600">Teléfono{datos.tipo_entrega === 'domicilio' ? ' *' : ''}</span>
          <input value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) })} inputMode="numeric" placeholder={datos.tipo_entrega === 'domicilio' ? '300 123 4567' : 'Opcional'} className="w-full rounded-xl border border-slate-200 bg-[#FBFAF7] px-3.5 py-3 text-[15px] outline-none transition focus:border-slate-400 focus:bg-white" />
        </label>
        {datos.tipo_entrega === 'domicilio' && (
          <div className="space-y-3 sm:col-span-2 animate-rise">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-600">¿Dónde vive? *</span>
              <select value={datos.zona} onChange={(e) => setDatos({ ...datos, zona: e.target.value, unidad: '', domicilio_manual: '' })} className={campo}>
                <option value="">Selecciona conjunto u “Otra dirección”</option>
                <optgroup label={`Conjuntos · ${cop(DOMICILIO.tarifaConjunto)}`}>
                  {DOMICILIO.conjuntos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </optgroup>
                <optgroup label="Otra">
                  <option value="otra">Otra dirección (por distancia)</option>
                </optgroup>
              </select>
            </label>
            {conjunto && !conjunto.barrio && (
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-slate-600">Torre / interior y apto o casa *</span>
                <input value={datos.unidad} onChange={(e) => setDatos({ ...datos, unidad: e.target.value })} placeholder="Ej: Torre 3, apto 402" className={campo} />
              </label>
            )}
            {(datos.zona === 'otra' || conjunto?.barrio) && (
              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-600">Dirección *</span>
                  <input value={datos.direccion} onChange={(e) => setDatos({ ...datos, direccion: e.target.value })} placeholder="Ej: Calle 6D #80B-89 Sur" className={campo} />
                </label>
                {datos.zona === 'otra' ? (
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-600">Barrio</span>
                    <input value={datos.barrio} onChange={(e) => setDatos({ ...datos, barrio: e.target.value })} placeholder="Ej: Castilla" className={campo} />
                  </label>
                ) : (
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-slate-600">Apto / casa</span>
                    <input value={datos.unidad} onChange={(e) => setDatos({ ...datos, unidad: e.target.value })} placeholder="Opcional" className={campo} />
                  </label>
                )}
              </div>
            )}
            {datos.zona && <ResultadoDomicilio datos={datos} setDatos={setDatos} domicilio={domicilio} />}
          </div>
        )}
      </div>
      {datos.tipo_entrega !== 'domicilio' && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-[#FBFAF7] px-3.5 py-2.5 text-[13px] text-slate-500">
          {datos.tipo_entrega === 'mesa' ? '🍽  Consumo en el local.' : '🏪  Recoge en el punto de venta.'} Los datos son opcionales.
        </p>
      )}
    </section>
  );
}

/** Tarjeta "Pedido actual": la comanda separada por zona + total + confirmar. */
export default function PedidoActual({ lineas, setCantidad, quitar, onConfirmar, ultimoPedido, onVerPedidos, domicilio = null, sinTarjeta = false }) {
  const grupos = agruparPorZona(lineas);
  const subtotal = lineas.reduce((s, l) => s + l.total, 0);
  const total = subtotal + (domicilio?.valor || 0);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);

  return (
    <section className={`flex min-h-0 flex-col ${sinTarjeta ? 'h-full' : 'max-h-full rounded-2xl border border-slate-200 bg-white'}`}>
      <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
        <p className={etiquetaCard}>Pedido actual</p>
        <p className="text-[12.5px] font-semibold text-slate-500">{unidades} ítem(s)</p>
      </div>

      {ultimoPedido && (
        <button onClick={onVerPedidos} className="mx-5 mb-3 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100">
          <p className="text-[12px] font-medium text-slate-500">
            Último pedido <span className="font-bold text-slate-900">{ultimoPedido.numero ? `#${String(ultimoPedido.numero).padStart(3, '0')}` : 'enviando…'}</span>
          </p>
          <EstadoZonas pedido={ultimoPedido} compacto />
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {!lineas.length ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 bg-[#FBFAF7] px-4 py-12 text-center text-[14px] text-slate-500">
            Toca un producto para empezar el pedido.
          </div>
        ) : (
          <div className="space-y-3">
            {grupos.map((g) => {
              const z = ZONA_UI[g.zona];
              return (
                <div key={g.zona} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className={`flex items-center justify-between px-3 py-2 ${z.suave}`}>
                    <p className={`flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider ${z.texto}`}>
                      <span className={`h-2 w-2 rounded-full ${z.dot}`} /> {z.nombre}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">{z.nota}</p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {g.items.map((l) => (
                      <li key={l.uid} className="flex items-start gap-2.5 px-3 py-2.5 animate-rise">
                        <div className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-white">
                          <button onClick={() => (l.cantidad > 1 ? setCantidad(l.uid, l.cantidad - 1) : quitar(l.uid))} aria-label="Menos" className="grid h-8 w-7 place-items-center text-slate-500">
                            {l.cantidad > 1 ? <IconMinus className="h-3.5 w-3.5" /> : <IconTrash className="h-3.5 w-3.5" />}
                          </button>
                          <span className="w-5 text-center text-[13px] font-bold tabular-nums">{l.cantidad}</span>
                          <button onClick={() => setCantidad(l.uid, l.cantidad + 1)} aria-label="Más" className="grid h-8 w-7 place-items-center text-slate-500">
                            <IconPlus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold leading-tight">{l.nombre_pantalla}</p>
                          {resumenLinea(l) && <p className="text-[12.5px] leading-snug text-slate-500">{resumenLinea(l)}</p>}
                          {l.nota && <p className="text-[12.5px] italic text-slate-500">“{l.nota}”</p>}
                          {domicilio && l.solo_local && <p className="text-[12px] font-semibold text-red-600">Vidrio: no va a domicilio</p>}
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums">{cop(l.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mx-5 mt-3 shrink-0 border-t border-slate-100 pb-5 pt-4">
        {domicilio && lineas.length > 0 && (
          <div className="mb-2 space-y-1 text-[13px] text-slate-500">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{cop(subtotal)}</span></div>
            <div className="flex justify-between">
              <span>Domicilio{domicilio.calculado?.km != null && domicilio.domicilio?.metodo !== 'manual' ? ` (${String(domicilio.calculado.km).replace('.', ',')} km)` : ''}</span>
              <span className="tabular-nums">{domicilio.calculando ? 'calculando…' : domicilio.valor ? cop(domicilio.valor) : 'por confirmar'}</span>
            </div>
          </div>
        )}
        <div className="flex items-end justify-between">
          <p className="text-[14px] font-semibold text-slate-700">Total</p>
          <p className="text-[28px] font-extrabold leading-none tabular-nums">{cop(total)}</p>
        </div>
        <p className="mb-4 mt-1.5 text-[11.5px] text-slate-400">Pizzería y cocina reciben su comanda impresa al confirmar.</p>
        <button disabled={!lineas.length} onClick={onConfirmar} className="w-full rounded-xl bg-brand-600 py-4 text-[16px] font-bold text-white shadow-[0_2px_0_#860B20] transition hover:bg-brand-700 active:translate-y-px disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
          Confirmar pedido en tienda
        </button>
      </div>
    </section>
  );
}

/** Tablero de mesas: libre / tuya / ocupada por otro (bloqueada). */
function TableroMesas({ datos, setDatos, tablero }) {
  const { total, mesas, pedidos, uid, esCaja, liberar } = tablero;
  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-slate-600">Mesa *</span>
        <span className="flex gap-3 text-[11.5px] text-slate-500">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" /> Libre</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Tuya</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Otro</span>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
          const lock = mesas[n];
          const ocupada = !!lock?.pedido_id;
          const pedido = ocupada ? pedidos.find((p) => p.id === lock.pedido_id) : null;
          const mia = ocupada && lock.por === uid;
          const bloqueada = ocupada && !mia && !esCaja;
          const sel = datos.mesa === n;
          const elegir = () => {
            if (!ocupada) return setDatos({ ...datos, mesa: n, cuenta_id: '' });
            if (!pedido) return; // ocupada pero sin cuenta abierta a la vista
            setDatos({ ...datos, mesa: n, cuenta_id: pedido.id, nombre: pedido.cliente?.nombre || '' });
          };
          const estilo = sel
            ? 'border-slate-900 bg-slate-900 text-white'
            : mia
            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
            : ocupada
            ? 'border-slate-200 bg-slate-100 text-slate-500'
            : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400';
          return (
            <div key={n} className="relative">
              <button
                type="button"
                onClick={elegir}
                disabled={bloqueada || (ocupada && !pedido)}
                title={ocupada ? `Atiende ${lock.por_nombre || 'otra persona'}` : 'Libre'}
                className={`flex h-[66px] w-full flex-col items-center justify-center rounded-xl border-2 px-1 transition ${estilo} ${bloqueada ? 'cursor-not-allowed' : ''}`}
              >
                <span className="text-[19px] font-extrabold leading-none">{n}</span>
                <span className="mt-1 max-w-full truncate text-[10.5px] font-semibold leading-tight">
                  {!ocupada ? 'Libre' : mia ? (pedido ? cop(pedido.total_cuenta ?? pedido.total) : 'Tuya') : (lock.por_nombre || 'Ocupada').split(' ')[0]}
                </span>
                {bloqueada && (
                  <svg viewBox="0 0 24 24" className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                )}
              </button>
              {ocupada && !pedido && esCaja && liberar && (
                <button type="button" onClick={() => window.confirm(`La mesa ${n} figura ocupada pero no tiene cuenta abierta. ¿Dejarla libre?`) && liberar(n)} className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950">
                  Liberar
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!datos.mesa && <p className="mt-2 text-[12.5px] text-slate-500">Toca una mesa libre para abrirla, o una tuya para agregarle productos.</p>}
    </div>
  );
}
