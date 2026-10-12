// Checkout — adaptado de Pizzeroo's para Jireh Pizza Dos.
//
// Tres pasos, uno por pantalla: 1) Contacto  2) Entrega  3) Pago y resumen.
// Reglas de negocio iguales a Pizzeroo's:
//  - Teléfono → si ya pidió antes, se recuperan nombre y direcciones.
//  - Domicilio (reglas en shared/domicilio.js): conjuntos de la lista con
//    tarifa fija; cualquier otra dirección se ubica con Google y se cobra por
//    distancia. Si no se puede ubicar, queda "por confirmar". Fuera de
//    cobertura no deja continuar (puede elegir Recoger).
//  - Pago: Efectivo (exacto, con vueltas o transferencia) o datáfono (lo lleva el domiciliario).
// Cambios frente a Pizzeroo's: estilos Tailwind de Jireh, sin tour, búsqueda
// vía services/backend.js, datos de pago en config/negocio.js y guardia
// contra doble envío con useRef.
import { useState, useEffect, useRef } from 'react';
import { Pista } from './Guia';
import { CasillaDatos, PoliticaDatos, POLITICA_DATOS_VERSION } from './PoliticaDatos';
import { calcularDomicilio, DOMICILIO, registrarFalloDomicilio } from '../services/domicilioService';
import { conjuntoPorId, normalizarDireccion } from '@shared/domicilio.js';
import { DATOS_NEGOCIO } from '@shared/comandas.js';
import { buscarPedidosPorTelefono } from '../services/clienteLocal';
import { NEGOCIO } from '../config/negocio';
import { formatCOP } from '../utils/formato';
import {
  Alert, Badge, IconChevronLeft, IconChevronRight, IconCheck, IconBike, IconStore, IconCash, IconCard, IconTransfer, IconPhone, IconPin, IconUser,
} from './ui';

const RECOGE = 'Recoge en punto de venta';
const PASOS = ['Contacto', 'Entrega', 'Pago'];

const cleanNomenclatura = (n) =>
  !n ? '' : n.trim().replace(/\s*#\s*#\s*/g, '#').replace(/\s*#\s*/g, '#').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').toUpperCase();

const NUMERO_VIA_MAXIMO_RAZONABLE = 250;
const numeroViaEsPlausible = (valor) => {
  if (!valor) return true;
  const m = valor.toString().match(/\d+/);
  return !m || parseInt(m[0], 10) <= NUMERO_VIA_MAXIMO_RAZONABLE;
};

// ─── Dirección con la nomenclatura de Bogotá ──────────────────────────
// Calle 42 # 15-34  →  vía principal (Calle 42) · cruce (Carrera 15) · placa (34 m).
// Los números van solos (teclado numérico); letras y "Bis" se eligen aparte,
// así nadie escribe el barrio en la casilla del número y Google la entiende.
const LETRAS_VIA = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Bis', 'A Bis', 'B Bis', 'C Bis', 'D Bis', 'Bis A', 'Bis B', 'Bis C'];
const TIPOS_VIA = ['Calle', 'Carrera', 'Avenida Calle', 'Avenida Carrera', 'Diagonal', 'Transversal', 'Avenida'];
const conLetra = (n, letra) => (!letra ? n : /^[A-H]( |$)/.test(letra) ? `${n}${letra}` : `${n} ${letra}`);

/**
 * "Calle 52 Sur #81-25" a partir de las casillas.
 * Sur / Este van junto al número donde el cliente lo marcó; si lo marcó en el
 * cruce, va al final ("Calle 10 #5-20 Este"), que es como se escribe en Bogotá.
 */
export function armarNomenclatura({ tipo, via, letraVia, cuadVia, cruce, letraCruce, cuadCruce, placa }) {
  if (!via) return '';
  let n = `${tipo} ${conLetra(via, letraVia)}${cuadVia ? ` ${cuadVia}` : ''}`;
  if (cruce) {
    n += ` #${conLetra(cruce, letraCruce)}${placa ? `-${placa}` : ''}`;
    if (cuadCruce && cuadCruce !== cuadVia) n += ` ${cuadCruce}`;
  }
  return normalizarDireccion(n);
}

const CUADRANTES = ['Sur', 'Este'];

/** Lista pequeña con "—" como vacío (letra, Bis, Sur/Este). */
function SelectCorto({ valor, onCambiar, opciones, etiqueta }) {
  return (
    <div className="relative">
      <select value={valor} onChange={(e) => onCambiar(e.target.value)} aria-label={etiqueta}
        className={`field appearance-none !pl-2 !pr-5 text-[14px] ${valor ? 'font-semibold text-zinc-900' : 'text-zinc-400'}`}>
        <option value="">—</option>
        {opciones.map((o) => <option key={o} value={o} className="text-zinc-900">{o}</option>)}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}

/** Casilla numérica: solo dígitos. Si escriben "82a", la letra pasa a su casilla. */
function soloNumero(valor, max, setLetra, letraActual) {
  const t = String(valor).toUpperCase();
  const letra = t.match(/^\d+([A-H])$/)?.[1]; // "82A" pegado; "6 C…" (barrio) no
  if (letra && setLetra && !letraActual) setLetra(letra);
  return t.replace(/\D/g, '').slice(0, max);
}

/** Qué se pide dentro del conjunto / hotel (torre y apto, casa o habitación). */
function unidadDe(c) {
  if (c?.hotel) return { label: '# de habitación', ejemplo: 'Habitación 204', min: 1, falta: 'Escribe el número de tu habitación.' };
  if (c?.casas) return { label: 'Número de casa', ejemplo: 'Casa 24', min: 1, falta: 'Escribe el número de tu casa.' };
  if (c?.torres) return { label: 'Torre y apartamento', ejemplo: 'Torre 3, apto 402', min: 2, falta: 'Escribe la torre y el apartamento.' };
  return { label: 'Interior o torre, y apartamento o casa', ejemplo: 'Interior 2, apto 301', min: 2, falta: 'Escribe la torre o interior y el apartamento o casa.' };
}

/**
 * Junta los conjuntos que solo cambian en el número final ("Portal de Castilla",
 * "Portal de Castilla 2", "Portal de Castilla 3" → Portal de Castilla [1][2][3]).
 * El que no tiene número es el 1. Conserva el orden de la lista.
 */
function agruparConjuntos(conjuntos) {
  const grupos = [];
  for (const c of conjuntos) {
    const m = c.nombre.match(/^(.*\S)\s+(\d+)$/);
    const base = m ? m[1] : c.nombre;
    let g = grupos.find((x) => x.base === base);
    if (!g) grupos.push((g = { base, unidades: [] }));
    g.unidades.push({ n: m ? Number(m[2]) : 1, c });
  }
  grupos.forEach((g) => g.unidades.sort((a, b) => a.n - b.n));
  return grupos;
}

/**
 * ¿Dónde vives? Los conjuntos con domicilio fijo se muestran a la vista (no
 * escondidos en una lista desplegable) para que el cliente los vea antes de
 * ponerse a escribir la dirección.
 */
function SelectorZona({ valor, onCambiar }) {
  const [filtro, setFiltro] = useState('');
  const sin = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sel = valor && valor !== 'otra' ? conjuntoPorId(valor) : null;

  if (valor) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3">
        <IconPin className="h-5 w-5 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold">{sel ? sel.nombre : 'Otra dirección'}</p>
          <p className="text-[12.5px] text-zinc-500">
            {sel ? `Domicilio fijo ${formatCOP(DOMICILIO.tarifaConjunto)}` : 'El domicilio se calcula según la distancia'}
          </p>
        </div>
        <button type="button" onClick={() => { setFiltro(''); onCambiar(''); }} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-50">Cambiar</button>
      </div>
    );
  }

  // Orden alfabético (más fácil de encontrar en el celular); los barrios al final.
  const lista = agruparConjuntos(DOMICILIO.conjuntos.filter((c) => !filtro || sin(c.nombre).includes(sin(filtro).trim())))
    .sort((x, y) => (x.unidades[0].c.barrio ? 1 : 0) - (y.unidades[0].c.barrio ? 1 : 0) || x.base.localeCompare(y.base, 'es'));
  const pill = 'grid h-9 min-w-9 place-items-center rounded-lg bg-zinc-100 px-2 text-[14px] font-bold text-zinc-800 ring-1 ring-inset ring-zinc-200 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300 active:scale-95';
  return (
    <div className="space-y-3 animate-rise">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
        <p className="text-[15px] font-bold text-emerald-950">¿Estás en alguno de estos conjuntos, hoteles o sectores?</p>
        <p className="mt-0.5 text-[13px] leading-snug text-emerald-900">
          Selecciónalo y <b>no tienes que escribir la dirección</b>. Domicilio fijo de <b>{formatCOP(DOMICILIO.tarifaConjunto)}</b>.
        </p>
      </div>
      <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Escribe el nombre (ej: Tabaku, Hotel Troya…)" className="field" />
      {/* Lista compacta con su propio scroll: no llena la pantalla del celular */}
      <div className="relative">
        <div className="max-h-[300px] divide-y divide-zinc-100 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-white">
          {lista.map((g) => g.unidades.length === 1 ? (
            <button key={g.unidades[0].c.id} type="button" onClick={() => onCambiar(g.unidades[0].c.id)}
              className="flex w-full items-center gap-2 px-3.5 py-3 text-left transition hover:bg-zinc-50 active:bg-zinc-100">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-tight">{g.unidades[0].c.nombre}</span>
                {g.unidades[0].c.barrio && <span className="block text-[11.5px] text-zinc-500">Todo el barrio · pide dirección</span>}
              </span>
              <IconChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />
            </button>
          ) : (
            // Mismo nombre con varias etapas (Terrazas de Castilla 1–4): una fila y se elige el número.
            <div key={g.base} className="flex items-center gap-2 px-3.5 py-2">
              <span className="min-w-0 flex-1 text-[14px] font-semibold leading-tight">{g.base}</span>
              <span className="flex shrink-0 gap-1.5">
                {g.unidades.map(({ n, c }) => (
                  <button key={c.id} type="button" onClick={() => onCambiar(c.id)} aria-label={c.nombre} className={pill}>{n}</button>
                ))}
              </span>
            </div>
          ))}
          {!lista.length && <p className="px-3.5 py-4 text-[13px] text-zinc-500">No encontramos ese nombre. Escribe tu dirección abajo.</p>}
        </div>
        {lista.length > 6 && <div className="pointer-events-none absolute inset-x-px bottom-px h-8 rounded-b-xl bg-gradient-to-t from-white to-transparent" />}
      </div>
      {!filtro && lista.length > 6 && <p className="-mt-1 text-center text-[12px] text-zinc-400">Desliza la lista para ver todos ({DOMICILIO.conjuntos.length})</p>}
      <div className="flex items-center gap-3 pt-1 text-[12px] font-semibold uppercase tracking-wider text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" /> ¿No estás en la lista? <span className="h-px flex-1 bg-zinc-200" />
      </div>
      <button type="button" onClick={() => onCambiar('otra')}
        className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-white px-3.5 py-3 text-left transition hover:border-brand-400">
        <IconPin className="h-5 w-5 shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-bold">Escribir mi dirección</span>
          <span className="block text-[12.5px] leading-snug text-zinc-500">Con la nomenclatura (ej: Calle 6D #80B-89) calculamos el domicilio según la distancia.</span>
        </span>
        <IconChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>
    </div>
  );
}

const renderAddressText = (addr) => {
  if (!addr) return 'No registra dirección';
  if (typeof addr === 'string') return addr;
  const parts = [addr.conjunto, addr.unidad, addr.nomenclatura, addr.conjunto ? null : addr.sector, addr.barrio, addr.ciudad].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Dirección no registrada';
};

const isValidColombianPhone = (phone) => {
  const c = phone.replace(/\s|-/g, '');
  if (c.length !== 10 || c[0] !== '3') return false;
  return [300, 301, 302, 304, 305, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 333].includes(parseInt(c.slice(0, 3), 10));
};

// ─── Piezas visuales ───────────────────────────────────────────────────
function Radio({ on }) {
  return (
    <span className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition ${on ? 'border-brand-600 bg-brand-600' : 'border-zinc-300 bg-white'}`}>
      {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </span>
  );
}

function OpcionRadio({ on, onClick, titulo, detalle, children }) {
  return (
    <div className={`choice ${on ? 'choice-on' : ''}`}>
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 p-3.5 text-left">
        <Radio on={on} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-snug text-zinc-900">{titulo}</span>
          {detalle && <span className="mt-0.5 block text-[12.5px] text-zinc-500">{detalle}</span>}
        </span>
      </button>
      {children}
    </div>
  );
}

function Segmento({ opciones, valor, onChange }) {
  return (
    <div className={`grid gap-1 rounded-xl bg-zinc-100 p-1 ${opciones.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {opciones.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-semibold transition ${opciones.length === 3 ? 'flex-col gap-1 px-1 text-[13px] sm:flex-row sm:gap-2 sm:text-[14px]' : 'text-[14px]'} ${
            valor === id ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );
}

const kmTexto = (km) => String(km).replace('.', ',');

function AvisoDomicilio({ calculando, domicilio }) {
  if (calculando) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-zinc-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" /> Calculando el valor del domicilio…
      </p>
    );
  }
  if (domicilio?.tipo === 'SECTOR' && typeof domicilio.tarifa === 'number') {
    const detalle = domicilio.metodo === 'conjunto' ? 'tarifa fija' : domicilio.km != null ? `${kmTexto(domicilio.km)} km desde la tienda` : null;
    return (
      <Alert tone="ok">
        Domicilio: <b>{formatCOP(domicilio.tarifa)}</b>{detalle ? ` · ${detalle}` : ''}. Incluido en el total.
        {domicilio.direccion_encontrada && <span className="mt-1 block text-[12px] opacity-80">Ubicamos: {domicilio.direccion_encontrada}</span>}
      </Alert>
    );
  }
  if (domicilio?.tipo === 'FUERA') {
    return (
      <Alert tone="error">
        Tu dirección está a {kmTexto(domicilio.km)} km y por ahora llevamos domicilios hasta {domicilio.maxKm} km. Puedes elegir <b>Recoger</b> en el local.
      </Alert>
    );
  }
  if (domicilio?.tipo === 'PENDIENTE_INFORMAR') {
    return (
      <Alert tone="warn">
        <b>Tu pedido llegará a la dirección que escribiste.</b> Solo que esta vez no pudimos calcular
        automáticamente el <b>costo del domicilio</b>: te lo confirmamos al aceptar tu pedido y lo pagas al recibirlo.
      </Alert>
    );
  }
  return null;
}

function Encabezado({ icon: Icon, titulo, subtitulo }) {
  return (
    <div className="mb-5">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-[22px] font-bold tracking-tight">{titulo}</h2>
      {subtitulo && <p className="mt-1 text-[14px] text-zinc-500">{subtitulo}</p>}
    </div>
  );
}

// ─── Componente ────────────────────────────────────────────────────────
export default function CompletarDatosCliente({ onConfirmar, onVolver, isSubmitting, total, items = [], onQuitarItems }) {
  const [paso, setPaso] = useState(0);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [hasSearchedCustomer, setHasSearchedCustomer] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const [customerData, setCustomerData] = useState({ names: '', lastNames: '', isNew: false });
  const [customerAddresses, setCustomerAddresses] = useState([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState('new');

  const [newAddrTipoVia, setNewAddrTipoVia] = useState('Carrera');
  const [newAddrNumeroPrincipal, setNewAddrNumeroPrincipal] = useState('');
  const [newAddrNumeroSecundario, setNewAddrNumeroSecundario] = useState('');
  const [newAddrComplemento, setNewAddrComplemento] = useState('');
  const [newAddrLetraVia, setNewAddrLetraVia] = useState(''); // A, B, Bis, A Bis…
  const [newAddrLetraCruce, setNewAddrLetraCruce] = useState('');
  const [newAddrCuadVia, setNewAddrCuadVia] = useState(''); // '' | 'Sur' | 'Este' (Bogotá)
  const [newAddrCuadCruce, setNewAddrCuadCruce] = useState('');
  const [newAddrZona, setNewAddrZona] = useState(''); // id de conjunto | 'otra'
  const [newAddrUnidad, setNewAddrUnidad] = useState(''); // torre / apto / casa
  const [newAddrBarrio, setNewAddrBarrio] = useState('');
  const [instruccionesRepartidor, setInstruccionesRepartidor] = useState('');
  const [newAddrNomenclatura, setNewAddrNomenclatura] = useState('');


  const [pickupAtStore, setPickupAtStore] = useState(false);
  const [metodoPago, setMetodoPago] = useState('');
  const [pagoEfectivo, setPagoEfectivo] = useState('completo');
  const [denominacion, setDenominacion] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isConfirmando, setIsConfirmando] = useState(false);
  const confirmandoRef = useRef(false);

  const [yaTransfirio, setYaTransfirio] = useState(false);
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [llaveCopiada, setLlaveCopiada] = useState(false);
  const [verPolitica, setVerPolitica] = useState(false);
  const [domicilioCalculado, setDomicilioCalculado] = useState(null);
  const [calculandoDomicilio, setCalculandoDomicilio] = useState(false);

  const domicilioPendiente = !pickupAtStore && domicilioCalculado?.tipo === 'PENDIENTE_INFORMAR';
  const domicilioTarifa =
    pickupAtStore || domicilioPendiente ? 0 : typeof domicilioCalculado?.tarifa === 'number' ? domicilioCalculado.tarifa : null;
  const totalFinal = typeof total === 'number' && domicilioTarifa !== null ? total + domicilioTarifa : null;
  const totalFinalTexto = totalFinal !== null ? formatCOP(totalFinal) : null;

  useEffect(() => {
    setNewAddrNomenclatura(armarNomenclatura({
      tipo: newAddrTipoVia, via: newAddrNumeroPrincipal, letraVia: newAddrLetraVia,
      cruce: newAddrNumeroSecundario, letraCruce: newAddrLetraCruce, placa: newAddrComplemento,
      cuadVia: newAddrCuadVia, cuadCruce: newAddrCuadCruce,
    }));
  }, [newAddrTipoVia, newAddrNumeroPrincipal, newAddrLetraVia, newAddrNumeroSecundario, newAddrLetraCruce, newAddrComplemento, newAddrCuadVia, newAddrCuadCruce]);

  const conjuntoSel = newAddrZona && newAddrZona !== 'otra' ? conjuntoPorId(newAddrZona) : null;
  const pideDireccion = newAddrZona === 'otra' || !!conjuntoSel?.barrio;

  // Domicilio — dirección nueva
  useEffect(() => {
    if (selectedAddressIndex !== 'new') return;
    setSubmitError(''); // el cliente cambió la dirección: el aviso anterior ya no aplica
    if (pickupAtStore || !newAddrZona) {
      setDomicilioCalculado(null);
      setCalculandoDomicilio(false);
      return;
    }
    if (conjuntoSel) {
      setCalculandoDomicilio(false);
      calcularDomicilio({ conjuntoId: conjuntoSel.id }).then(setDomicilioCalculado);
      return;
    }
    if (!/#\s*\d+/.test(newAddrNomenclatura)) {
      setDomicilioCalculado(null);
      setCalculandoDomicilio(false);
      return;
    }
    // Espera a que el cliente deje de escribir para no consultar a Google en cada tecla.
    let vigente = true;
    setCalculandoDomicilio(true);
    const t = setTimeout(async () => {
      const r = await calcularDomicilio({ nomenclatura: newAddrNomenclatura, barrio: newAddrBarrio.trim() });
      if (vigente) {
        setDomicilioCalculado(r);
        setCalculandoDomicilio(false);
      }
    }, 900);
    return () => { vigente = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newAddrZona, newAddrNomenclatura, newAddrBarrio, pickupAtStore, selectedAddressIndex]);

  // Domicilio — dirección guardada
  useEffect(() => {
    if (pickupAtStore || selectedAddressIndex === 'new' || selectedAddressIndex === null) return;
    const dir = customerAddresses[selectedAddressIndex]?.raw;
    if (!dir) return;
    let vigente = true;
    setCalculandoDomicilio(true);
    calcularDomicilio(dir).then((r) => {
      if (vigente) {
        setDomicilioCalculado(r);
        setCalculandoDomicilio(false);
      }
    });
    return () => { vigente = false; };
  }, [selectedAddressIndex, customerAddresses, pickupAtStore]);

  const handlePhoneChange = (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(d);
    setPhoneError(d.length === 10 && !isValidColombianPhone(d) ? 'Número no válido. Revisa el prefijo.' : '');
  };

  useEffect(() => {
    const tel = phoneNumber.trim();
    if (tel.length === 10 && isValidColombianPhone(tel)) {
      const t = setTimeout(() => buscarCliente(tel), 400);
      return () => clearTimeout(t);
    } else if (hasSearchedCustomer) setHasSearchedCustomer(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber]);

  const buscarCliente = async (telefono) => {
    setBuscando(true);
    try {
      const pedidos = await buscarPedidosPorTelefono(telefono);
      if (pedidos.length) {
        const ultimo = pedidos[0];
        const addrs = [];
        pedidos.forEach((p) => {
          const a = p.address;
          if (!a || a === RECOGE) return;
          if (!addrs.find((x) => renderAddressText(x.raw) === renderAddressText(a))) addrs.push({ raw: a });
        });
        setCustomerData({ names: ultimo.customer?.names || '', lastNames: ultimo.customer?.lastNames || '', isNew: false });
        setCustomerAddresses(addrs);
        setSelectedAddressIndex(addrs.length ? 0 : 'new');
      } else {
        setCustomerData({ names: '', lastNames: '', isNew: true });
        setCustomerAddresses([]);
        setSelectedAddressIndex('new');
      }
    } catch (err) {
      console.error('Error buscando cliente:', err);
    } finally {
      setBuscando(false);
      setHasSearchedCustomer(true);
    }
  };

  const nuevaDireccion = () => {
    setSelectedAddressIndex('new');
    setNewAddrTipoVia('Carrera');
    setNewAddrNumeroPrincipal('');
    setNewAddrNumeroSecundario('');
    setNewAddrComplemento('');
    setNewAddrSufijo('');
    setNewAddrZona('');
    setNewAddrUnidad('');
    setNewAddrBarrio('');
    setInstruccionesRepartidor('');
    setDomicilioCalculado(null);
  };

  const getFinalAddress = () => {
    if (pickupAtStore) return RECOGE;
    if (selectedAddressIndex === 'new') {
      const base = { ciudad: DOMICILIO.ciudad, instrucciones: instruccionesRepartidor.trim(), unidad: newAddrUnidad.trim() };
      if (conjuntoSel && !conjuntoSel.barrio) {
        return { ...base, conjuntoId: conjuntoSel.id, conjunto: conjuntoSel.nombre, ...(conjuntoSel.direccion ? { nomenclatura: cleanNomenclatura(conjuntoSel.direccion) } : {}) };
      }
      return {
        ...base,
        ...(conjuntoSel ? { conjuntoId: conjuntoSel.id, conjunto: conjuntoSel.nombre } : {}),
        nomenclatura: newAddrNomenclatura.trim(),
        barrio: conjuntoSel ? '' : newAddrBarrio.trim(),
        ...(domicilioCalculado?.ubicacion ? { ubicacion: domicilioCalculado.ubicacion } : {}),
      };
    }
    return customerAddresses[selectedAddressIndex]?.raw;
  };

  // ─── Validación por paso ─────────────────────────────────────────────
  const validarContacto = () => {
    if (phoneNumber.length !== 10 || phoneError) return 'Ingresa un número de celular válido.';
    if (!hasSearchedCustomer) return 'Espera un momento, estamos validando tu número.';
    if (!customerData.names?.trim()) return 'Escribe tu nombre.';
    return null;
  };

  // Productos que no se envían a domicilio (ej: gaseosa 350 ml en vidrio).
  const soloLocal = items.filter((l) => l.solo_local);
  const avisoSoloLocal = soloLocal.length
    ? `${[...new Set(soloLocal.map((l) => l.nombre))].join(', ')} viene en envase de vidrio y no se envía a domicilio.`
    : '';
  const quitarSoloLocal = () => { onQuitarItems?.(soloLocal.map((l) => l.uid)); setSubmitError(''); };

  const validarEntrega = async () => {
    if (pickupAtStore) return null;
    if (avisoSoloLocal) return avisoSoloLocal;
    if (selectedAddressIndex === null) return 'Selecciona una dirección.';
    if (selectedAddressIndex === 'new') {
      if (!newAddrZona) return 'Elige tu conjunto o "Otra dirección".';
      if (conjuntoSel && !conjuntoSel.barrio) {
        if (newAddrUnidad.trim().length < unidadDe(conjuntoSel).min) return unidadDe(conjuntoSel).falta;
      } else {
        if (!newAddrNomenclatura.trim()) return 'Completa la dirección (tipo de vía y números).';
        if (!/#\s*\d+/.test(newAddrNomenclatura)) return 'La dirección debe incluir el número después del "#" (ej: Calle 6D #80B-89).';
        if (!newAddrComplemento) return 'Escribe la placa: el número después del guion (ej: en Calle 6D #80B-89 es 89).';
        if (!numeroViaEsPlausible(newAddrNumeroPrincipal) || !numeroViaEsPlausible(newAddrNumeroSecundario)) {
          await registrarFalloDomicilio('DIRECCION_INVALIDA', { nomenclatura: newAddrNomenclatura });
          return 'Revisa el número de la vía, no parece una dirección válida.';
        }
      }
    }
    if (calculandoDomicilio) return 'Espera un momento, estamos calculando el domicilio.';
    if (domicilioCalculado?.tipo === 'FUERA') return `Tu dirección está fuera de nuestra zona de domicilios (${kmTexto(domicilioCalculado.km)} km). Puedes elegir "Recoger".`;
    return null;
  };

  const validarPago = () => {
    if (!metodoPago) return 'Selecciona el método de pago.';
    if (metodoPago === 'efectivo' && pagoEfectivo === 'denominacion') {
      const v = parseFloat(denominacion);
      if (!denominacion || isNaN(v) || v <= 0) return 'Ingresa el valor del billete con el que vas a pagar.';
      if (totalFinal !== null && v < totalFinal) return `El billete debe ser igual o mayor al total del pedido (${totalFinalTexto}).`;
    }
    if (metodoPago === 'transferencia' && !yaTransfirio) return 'Confirma que ya realizaste la transferencia.';
    if (!aceptaDatos) return 'Debes autorizar el tratamiento de tus datos para enviar el pedido.';
    return null;
  };

  const irA = (n) => {
    setSubmitError('');
    setPaso(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const siguiente = async () => {
    const error = paso === 0 ? validarContacto() : await validarEntrega();
    if (error) return setSubmitError(error);
    irA(paso + 1);
  };

  const handleConfirmar = async () => {
    if (confirmandoRef.current || isSubmitting) return;
    confirmandoRef.current = true;
    setIsConfirmando(true);
    setSubmitError('');
    try {
      const error = validarContacto() || (await validarEntrega()) || validarPago();
      if (error) return setSubmitError(error);

      let domicilio = domicilioCalculado;
      if (!pickupAtStore && !domicilio) {
        domicilio = await calcularDomicilio(getFinalAddress());
        setDomicilioCalculado(domicilio);
      }
      if (!pickupAtStore && domicilio?.tipo === 'FUERA') return setSubmitError('Tu dirección está fuera de nuestra zona de domicilios. Puedes elegir "Recoger".');

      await onConfirmar({
        customer: {
          names: customerData.names.trim().toUpperCase(),
          lastNames: customerData.lastNames?.trim().toUpperCase() || '',
          phone: phoneNumber.trim(),
        },
        address: getFinalAddress(),
        domicilio: pickupAtStore ? null : domicilio,
        metodoPago,
        pagoEfectivo: metodoPago === 'efectivo' ? pagoEfectivo : null,
        denominacion: metodoPago === 'efectivo' && pagoEfectivo === 'denominacion' ? parseFloat(denominacion) : null,
        autorizacionDatos: { acepta: true, version: POLITICA_DATOS_VERSION, fecha: new Date().toISOString() },
      });
    } finally {
      confirmandoRef.current = false;
      setIsConfirmando(false);
    }
  };

  const ocupado = isSubmitting || isConfirmando;

  const domicilioTexto = pickupAtStore
    ? 'Gratis'
    : domicilioCalculado?.tipo === 'SECTOR'
    ? `${formatCOP(domicilioCalculado.tarifa)}${domicilioCalculado.km != null ? ` (${kmTexto(domicilioCalculado.km)} km)` : ''}`
    : 'Por confirmar';

  return (
    <div className="min-h-screen bg-zinc-50 pb-32">
      {/* Barra superior */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button
            onClick={() => (paso === 0 ? onVolver() : irA(paso - 1))}
            aria-label="Atrás"
            className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <p className="flex-1 text-[15px] font-semibold">Finalizar pedido</p>
          <span className="text-[13px] text-zinc-500">
            {paso + 1}/{PASOS.length}
          </span>
        </div>
        {/* Stepper */}
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 pb-3">
          {PASOS.map((nombre, i) => (
            <div key={nombre} className="flex flex-1 items-center gap-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition ${
                  i < paso ? 'bg-brand-600 text-white' : i === paso ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
                }`}
              >
                {i < paso ? <IconCheck className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-[12.5px] font-semibold ${i <= paso ? 'text-zinc-900' : 'text-zinc-400'}`}>{nombre}</span>
              {i < PASOS.length - 1 && <span className={`h-px flex-1 ${i < paso ? 'bg-brand-600' : 'bg-zinc-200'}`} />}
            </div>
          ))}
        </div>
      </header>

      <main key={paso} className="mx-auto max-w-lg px-4 py-6 animate-rise">
        {/* ─── PASO 1: CONTACTO ─── */}
        {paso === 0 && (
          <>
            <Encabezado icon={IconPhone} titulo="¿Cuál es tu celular?" subtitulo="Si ya nos has pedido, recuperamos tus datos." />
            <Pista id="contacto" paso={2} className="mb-4">Escribe tu celular de 10 dígitos y tu nombre. Así el restaurante te puede llamar si hace falta. Luego toca <b>Continuar</b>.</Pista>
            <label className="label" htmlFor="tel">Número de celular</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[15px] text-zinc-400">+57</span>
              <input
                id="tel"
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder="300 123 4567"
                maxLength={10}
                inputMode="numeric"
                autoFocus
                className={`field pl-12 text-[17px] tracking-wide ${phoneError ? '!border-red-400 focus:!ring-red-100' : ''}`}
              />
              {hasSearchedCustomer && !buscando && (
                <span className="absolute inset-y-0 right-3 flex items-center text-emerald-600">
                  <IconCheck className="h-5 w-5" />
                </span>
              )}
            </div>
            <div className="mt-2 min-h-[20px] text-[13px]">
              {phoneError && <span className="text-red-600">{phoneError}</span>}
              {buscando && <span className="text-zinc-400">Buscando tus datos…</span>}
              {hasSearchedCustomer && !buscando && !customerData.isNew && (
                <Badge tone="green">¡Hola de nuevo, {customerData.names.split(' ')[0]}!</Badge>
              )}
            </div>

            {hasSearchedCustomer && (
              <div className="mt-5 animate-rise">
                <p className="label">¿A nombre de quién va el pedido?</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <input value={customerData.names} onChange={(e) => setCustomerData({ ...customerData, names: e.target.value })} placeholder="Nombre" className="field" autoComplete="given-name" />
                  <input value={customerData.lastNames} onChange={(e) => setCustomerData({ ...customerData, lastNames: e.target.value })} placeholder="Apellido" className="field" autoComplete="family-name" />
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── PASO 2: ENTREGA ─── */}
        {paso === 1 && (
          <>
            <Encabezado icon={IconPin} titulo="¿Dónde lo recibes?" />
            <Pista id="entrega" paso={3} className="mb-4">
              Elige <b>Domicilio</b> o <b>Recoger</b>. Si vives en un conjunto u hotel de la lista, solo tócalo. Si no, toca <b>Escribir mi dirección</b> y llénala por partes: en cada casilla de número van solo números.
            </Pista>
            <Segmento
              valor={pickupAtStore ? 'local' : 'domicilio'}
              onChange={(v) => setPickupAtStore(v === 'local')}
              opciones={[
                { id: 'domicilio', label: 'Domicilio', Icon: IconBike },
                { id: 'local', label: 'Recoger', Icon: IconStore },
              ]}
            />

            {pickupAtStore ? (
              <div className="mt-4">
                <Alert>
                  Recoges en <b>{DATOS_NEGOCIO.direccion}, {DATOS_NEGOCIO.lugar}</b>. Después de confirmar verás en esta página, en tiempo real, cuándo tu pedido está listo.
                </Alert>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {avisoSoloLocal && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 animate-rise">
                    <p className="text-[13.5px] font-semibold leading-snug text-red-800">{avisoSoloLocal}</p>
                    <p className="mt-0.5 text-[12.5px] text-red-700">¿Qué prefieres hacer?</p>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                      <button type="button" onClick={quitarSoloLocal} className="rounded-lg bg-red-600 px-3 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-red-700">
                        Quitarla del pedido
                      </button>
                      <button type="button" onClick={() => { quitarSoloLocal(); onVolver(); }} className="rounded-lg border border-red-200 bg-white px-3 py-2.5 text-[13.5px] font-semibold text-red-800 hover:bg-red-50">
                        Cambiar por otra bebida
                      </button>
                      <button type="button" onClick={() => { setPickupAtStore(true); setSubmitError(''); }} className="rounded-lg border border-red-200 bg-white px-3 py-2.5 text-[13.5px] font-semibold text-red-800 hover:bg-red-50">
                        Mejor la recojo
                      </button>
                    </div>
                  </div>
                )}
                {customerAddresses.length > 0 && <p className="label">Direcciones guardadas</p>}
                {customerAddresses.map((a, idx) => (
                  <OpcionRadio key={idx} on={selectedAddressIndex === idx} onClick={() => setSelectedAddressIndex(idx)} titulo={renderAddressText(a.raw)} detalle={a.raw.instrucciones}>
                    {selectedAddressIndex === idx && (
                      <div className="px-3.5 pb-3.5">
                        <AvisoDomicilio calculando={calculandoDomicilio} domicilio={domicilioCalculado} />
                      </div>
                    )}
                  </OpcionRadio>
                ))}

                <OpcionRadio
                  on={selectedAddressIndex === 'new'}
                  onClick={() => selectedAddressIndex !== 'new' && nuevaDireccion()}
                  titulo={customerAddresses.length ? 'Usar otra dirección' : 'Dirección de entrega'}
                >
                  {selectedAddressIndex === 'new' && (
                    <div className="space-y-4 border-t border-zinc-100 px-3.5 pb-4 pt-4">
                      <SelectorZona valor={newAddrZona} onCambiar={(v) => { setNewAddrZona(v); setNewAddrUnidad(''); setDomicilioCalculado(null); setSubmitError(''); }} />

                      {conjuntoSel && !conjuntoSel.barrio && (
                        <div className="animate-rise">
                          <label className="label" htmlFor="unidad">{unidadDe(conjuntoSel).label}</label>
                          <input id="unidad" value={newAddrUnidad} onChange={(e) => setNewAddrUnidad(e.target.value)} maxLength={60} placeholder={unidadDe(conjuntoSel).ejemplo} className="field" />
                          {conjuntoSel.direccion && (
                            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-[12.5px] font-semibold text-zinc-700">
                              <IconPin className="h-3.5 w-3.5" /> {conjuntoSel.direccion}
                            </p>
                          )}
                        </div>
                      )}

                      {pideDireccion && (
                        <div className="space-y-3 animate-rise">
                          <div>
                            <p className="label">Dirección</p>
                            {/* Vía principal: Calle 52 [letra] [Sur] */}
                            <div className="grid grid-cols-[1.35fr_.9fr_1.1fr_1.05fr] gap-1.5">
                              <span className="text-[11.5px] font-medium text-zinc-500">Vía</span>
                              <span className="text-[11.5px] font-medium text-zinc-500">Número</span>
                              <span className="text-[11.5px] font-medium text-zinc-500">Letra o Bis</span>
                              <span className="text-[11.5px] font-medium text-zinc-500">Sur / Este</span>
                              <select value={newAddrTipoVia} onChange={(e) => setNewAddrTipoVia(e.target.value)} aria-label="Tipo de vía" className="field !px-2">
                                {TIPOS_VIA.map((v) => <option key={v}>{v}</option>)}
                              </select>
                              <input value={newAddrNumeroPrincipal} onChange={(e) => setNewAddrNumeroPrincipal(soloNumero(e.target.value, 3, setNewAddrLetraVia, newAddrLetraVia))} inputMode="numeric" pattern="[0-9]*" maxLength={3} placeholder="52" aria-label="Número de la vía" className="field !px-2.5" />
                              <SelectCorto valor={newAddrLetraVia} onCambiar={setNewAddrLetraVia} opciones={LETRAS_VIA} etiqueta="Letra o Bis de la vía" />
                              <SelectCorto valor={newAddrCuadVia} onCambiar={setNewAddrCuadVia} opciones={CUADRANTES} etiqueta="Sur o Este de la vía" />
                            </div>
                            {/* Cruce y placa: # 81 [letra] [Sur] - 25 */}
                            <div className="mt-2.5 grid grid-cols-[auto_.9fr_1.1fr_1.05fr_auto_.9fr] items-end gap-1.5">
                              <span />
                              <span className="text-[11.5px] font-medium text-zinc-500">Número</span>
                              <span className="text-[11.5px] font-medium text-zinc-500">Letra o Bis</span>
                              <span className="text-[11.5px] font-medium text-zinc-500">Sur / Este</span>
                              <span />
                              <span className="text-[11.5px] font-medium text-zinc-500">Placa</span>
                              <span className="pb-3 text-[15px] font-semibold text-zinc-400">#</span>
                              <input value={newAddrNumeroSecundario} onChange={(e) => setNewAddrNumeroSecundario(soloNumero(e.target.value, 3, setNewAddrLetraCruce, newAddrLetraCruce))} inputMode="numeric" pattern="[0-9]*" maxLength={3} placeholder="81" aria-label="Número del cruce" className="field !px-2.5" />
                              <SelectCorto valor={newAddrLetraCruce} onCambiar={setNewAddrLetraCruce} opciones={LETRAS_VIA} etiqueta="Letra o Bis del cruce" />
                              <SelectCorto valor={newAddrCuadCruce} onCambiar={setNewAddrCuadCruce} opciones={CUADRANTES} etiqueta="Sur o Este del cruce" />
                              <span className="pb-3 text-[15px] font-semibold text-zinc-400">–</span>
                              <input value={newAddrComplemento} onChange={(e) => setNewAddrComplemento(soloNumero(e.target.value, 3))} inputMode="numeric" pattern="[0-9]*" maxLength={3} placeholder="25" aria-label="Placa" className="field !px-2.5" />
                            </div>
                            <p className="mt-1.5 text-[11.5px] leading-snug text-zinc-400">Si tu dirección no dice Sur ni Este, déjalo en “—” (en Bogotá el norte no se escribe).</p>
                            {newAddrNomenclatura && (
                              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-[12.5px] font-semibold text-zinc-700">
                                <IconPin className="h-3.5 w-3.5" /> {newAddrNomenclatura}
                              </p>
                            )}
                          </div>
                          {newAddrZona === 'otra' && (
                            <div>
                              <label className="label" htmlFor="barrio">Barrio <span className="font-normal text-zinc-400">(solo el nombre del barrio)</span></label>
                              <input id="barrio" value={newAddrBarrio} onChange={(e) => setNewAddrBarrio(e.target.value)} maxLength={60} placeholder="Ej: Castilla" className="field" />
                            </div>
                          )}
                          <div>
                            <label className="label" htmlFor="unidad2">Conjunto o edificio, torre, apto o casa <span className="font-normal text-zinc-400">(opcional)</span></label>
                            <input id="unidad2" value={newAddrUnidad} onChange={(e) => setNewAddrUnidad(e.target.value)} maxLength={80} placeholder="Ej: Conjunto Tabaku, torre 6, apto 623" className="field" />
                          </div>
                        </div>
                      )}

                      {newAddrZona && (
                        <div className="space-y-3 animate-rise">
                          <div>
                            <label className="label">Indicaciones para el domiciliario <span className="font-normal text-zinc-400">(opcional)</span></label>
                            <input value={instruccionesRepartidor} onChange={(e) => setInstruccionesRepartidor(e.target.value)} maxLength={120} placeholder="Portería, color de la puerta…" className="field" />
                          </div>
                          <AvisoDomicilio calculando={calculandoDomicilio} domicilio={domicilioCalculado} />
                        </div>
                      )}
                    </div>
                  )}
                </OpcionRadio>
              </div>
            )}
          </>
        )}

        {/* ─── PASO 3: PAGO + RESUMEN ─── */}
        {paso === 2 && (
          <>
            <Encabezado icon={IconCash} titulo="¿Cómo vas a pagar?" />
            <Pista id="pago" paso={4} className="mb-4">Revisa el resumen, elige cómo vas a pagar, marca la autorización de datos (abajo) y toca <b>Confirmar pedido</b>.</Pista>

            {/* Resumen */}
            <div className="card mb-5 overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <p className="text-[13px] font-semibold text-zinc-900">Resumen del pedido</p>
                <button onClick={onVolver} className="text-[13px] font-semibold text-brand-600 hover:text-brand-700">Editar</button>
              </div>
              <ul className="divide-y divide-zinc-100 px-4">
                {items.map((i, k) => (
                  <li key={k} className="flex justify-between gap-3 py-2.5 text-[13.5px]">
                    <span className="text-zinc-700">
                      <span className="font-semibold text-zinc-900">{i.cantidad}×</span> {i.descripcion}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatCOP(i.total)}</span>
                  </li>
                ))}
              </ul>
              <dl className="space-y-1.5 border-t border-zinc-100 bg-zinc-50/70 px-4 py-3 text-[13.5px]">
                <div className="flex justify-between text-zinc-600"><dt>Subtotal</dt><dd className="tabular-nums">{formatCOP(total)}</dd></div>
                <div className="flex justify-between text-zinc-600"><dt>Domicilio</dt><dd className="tabular-nums">{domicilioTexto}</dd></div>
                <div className="flex justify-between pt-1 text-[15px] font-bold text-zinc-900"><dt>Total</dt><dd className="tabular-nums">{totalFinalTexto}{domicilioPendiente && <span className="text-[12px] font-medium text-zinc-500"> + domicilio</span>}</dd></div>
              </dl>
              {domicilioPendiente && (
                <p className="border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] leading-snug text-amber-950">
                  <b>El domicilio no está incluido en este total.</b> Te confirmamos su valor al aceptar el pedido y lo pagas al recibirlo.
                </p>
              )}
              <div className="flex items-start gap-2 border-t border-zinc-100 px-4 py-3 text-[12.5px] text-zinc-500">
                <IconUser className="mt-px h-4 w-4 shrink-0" />
                <span>
                  {`${customerData.names} ${customerData.lastNames}`.trim()} · {phoneNumber}
                  <br />
                  {pickupAtStore ? 'Recoge en el local' : renderAddressText(getFinalAddress())}
                </span>
              </div>
            </div>

            {/* Tres formas de pago a la vista: efectivo (exacto o con vueltas), transferencia y datáfono. */}
            <Segmento
              valor={metodoPago}
              onChange={(v) => {
                setSubmitError('');
                setYaTransfirio(false);
                setDenominacion('');
                setMetodoPago(v);
                if (v === 'efectivo') setPagoEfectivo('completo');
              }}
              opciones={[
                { id: 'efectivo', label: 'Efectivo', Icon: IconCash },
                { id: 'transferencia', label: 'Transferencia', Icon: IconTransfer },
                { id: 'datafono', label: 'Datáfono', Icon: IconCard },
              ]}
            />

            {metodoPago === 'efectivo' && (
              <div className="mt-4 space-y-2.5 animate-rise">
                <OpcionRadio on={pagoEfectivo === 'completo'} onClick={() => { setPagoEfectivo('completo'); setDenominacion(''); }} titulo="Pago exacto" />
                <OpcionRadio on={pagoEfectivo === 'denominacion'} onClick={() => setPagoEfectivo('denominacion')} titulo="Necesito vueltas">
                  {metodoPago === 'efectivo' && pagoEfectivo === 'denominacion' && (
                    <div className="px-3.5 pb-3.5">
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">$</span>
                        <input type="number" inputMode="numeric" autoFocus value={denominacion} onChange={(e) => setDenominacion(e.target.value)} placeholder="¿Con cuánto pagas?" className="field pl-7" />
                      </div>
                      {denominacion && totalFinal !== null && (
                        <p className={`mt-2 text-[13px] font-medium ${parseFloat(denominacion) >= totalFinal ? 'text-emerald-700' : 'text-red-600'}`}>
                          {parseFloat(denominacion) >= totalFinal
                            ? `Vueltas: ${formatCOP(parseFloat(denominacion) - totalFinal)}`
                            : `Debe ser igual o mayor al total (${totalFinalTexto}).`}
                        </p>
                      )}
                    </div>
                  )}
                </OpcionRadio>
                {metodoPago === 'efectivo' && domicilioPendiente && <Alert tone="warn"><b>El domicilio se paga aparte</b> al domiciliario, cuando recibas tu pedido. Te confirmamos el valor al aceptarlo.</Alert>}
              </div>
            )}

            {metodoPago === 'datafono' && (
              <div className="mt-4 animate-rise">
                <Alert>
                  {pickupAtStore
                    ? 'Pagas con tarjeta débito o crédito en el datáfono del local al recoger tu pedido.'
                    : 'El domiciliario lleva el datáfono: pagas con tarjeta débito o crédito al recibir tu pedido.'}
                </Alert>
              </div>
            )}

            {metodoPago === 'transferencia' && (
              <div className="mt-3 space-y-3 animate-rise">
                <div className="card divide-y divide-zinc-100 text-[13.5px]">
                  <div className="flex justify-between gap-3 px-4 py-2.5">
                    <span className="text-zinc-500">Recibe en</span>
                    <span className="text-right font-semibold">{NEGOCIO.transferencia.medios}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-zinc-500">Número / llave</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[16px] font-bold tabular-nums tracking-wide">{NEGOCIO.transferencia.llave}</span>
                      <button
                        type="button"
                        onClick={async () => { try { await navigator.clipboard.writeText(NEGOCIO.transferencia.llave); setLlaveCopiada(true); setTimeout(() => setLlaveCopiada(false), 2000); } catch { /* sin portapapeles */ } }}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        {llaveCopiada ? 'Copiado ✓' : 'Copiar'}
                      </button>
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 px-4 py-2.5">
                    <span className="text-zinc-500">Titular</span>
                    <span className="text-right font-semibold">{NEGOCIO.transferencia.titular}</span>
                  </div>
                  <p className="bg-zinc-50/70 px-4 py-2 text-[12.5px] text-zinc-500">Con la llave puedes transferir desde cualquier banco y llega de inmediato.</p>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-zinc-500">Valor a transferir</span>
                    <span className="text-[17px] font-bold tabular-nums text-brand-600">{totalFinalTexto}</span>
                  </div>
                </div>
                {domicilioPendiente && <Alert tone="warn"><b>Transfiere solo este valor (los productos).</b> El domicilio lo pagas en efectivo al domiciliario cuando recibas tu pedido; te confirmamos el valor al aceptarlo.</Alert>}
                <Alert>Después de confirmar, envíanos el comprobante por WhatsApp.</Alert>
                <button
                  type="button"
                  onClick={() => { setYaTransfirio(!yaTransfirio); setSubmitError(''); }}
                  className={`choice flex w-full items-center gap-3 p-3.5 text-left ${yaTransfirio ? 'choice-on' : ''}`}
                >
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${yaTransfirio ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300'}`}>
                    {yaTransfirio && <IconCheck className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span className="text-[14px] font-semibold">Ya realicé la transferencia por el valor exacto</span>
                </button>
              </div>
            )}
          </>
        )}

        {submitError && submitError !== avisoSoloLocal && <div className="mt-5 animate-rise"><Alert tone="error">{submitError}</Alert></div>}
      </main>
      {verPolitica && <PoliticaDatos onCerrar={() => setVerPolitica(false)} onAceptar={() => { setAceptaDatos(true); setVerPolitica(false); }} />}

      {/* Barra inferior */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur">
        {paso === 2 && <CasillaDatos acepta={aceptaDatos} onCambiar={(v) => { setAceptaDatos(v); setSubmitError(''); }} onVer={() => setVerPolitica(true)} />}
        <div className="mx-auto flex max-w-lg items-center gap-4 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Total</p>
            <p className="text-[18px] font-bold tabular-nums leading-tight">{totalFinalTexto ?? formatCOP(total)}</p>
          </div>
          {paso < 2 ? (
            <button onClick={siguiente} disabled={(paso === 0 && !hasSearchedCustomer) || (paso === 1 && calculandoDomicilio)} className="btn-primary flex-1">
              {paso === 1 && calculandoDomicilio ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Calculando domicilio…
                </span>
              ) : 'Continuar'}
            </button>
          ) : (
            <button onClick={handleConfirmar} disabled={ocupado || !aceptaDatos} className="btn-primary flex-1">
              {ocupado ? 'Enviando…' : 'Confirmar pedido'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
