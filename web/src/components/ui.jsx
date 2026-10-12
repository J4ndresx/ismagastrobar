// Íconos (trazo estilo Lucide) y piezas visuales compartidas.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const I = (paths) =>
  function Icon({ className = 'h-5 w-5', ...p }) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base} {...p}>
        {paths}
      </svg>
    );
  };

export const IconChevronLeft = I(<path d="m15 18-6-6 6-6" />);
export const IconChevronRight = I(<path d="m9 18 6-6-6-6" />);
export const IconX = I(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const IconCheck = I(<path d="M20 6 9 17l-5-5" />);
export const IconPlus = I(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IconMinus = I(<path d="M5 12h14" />);
export const IconBag = I(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>);
export const IconTrash = I(<><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>);
export const IconBike = I(<><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" /><path d="m12 17.5 V14l-3-3 4-3 2 3h2" /></>);
export const IconStore = I(<><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M2 7h20" /><path d="M9 22v-6h6v6" /></>);
export const IconCash = I(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>);
export const IconPhone = I(<><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>);
export const IconPin = I(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>);
export const IconUser = I(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
export const IconClock = I(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>);
export const IconInfo = I(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>);
export const IconNote = I(<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></>);
export const IconWhatsApp = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 9.88 9.89c0 5.45-4.44 9.88-9.89 9.88Zm8.41-18.3A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.42Z" />
  </svg>
);

/**
 * Ilustración del tamaño: círculo proporcional al diámetro, dividido en tantas
 * partes como sabores permite. La porción se dibuja como un triángulo.
 */
export function PizzaGlyph({ tamano, activo = false, size = 44 }) {
  const escala = { porcion: 0.62, personal: 0.62, personal2: 0.62, small: 0.74, mediana: 0.87, extragrande: 1 };
  const r = 20 * (escala[tamano.id] ?? 1);
  const c = 22;
  const stroke = activo ? '#C8102E' : '#a1a1aa';
  const fill = activo ? '#FDE3E6' : '#f4f4f5';

  if (tamano.id === 'porcion') {
    return (
      <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
        <path d="M22 8 L34 34 Q22 38 10 34 Z" fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  const n = tamano.maxSabores;
  const lineas = [];
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      lineas.push(<line key={i} x1={c} y1={c} x2={c + r * Math.cos(a)} y2={c + r * Math.sin(a)} stroke={stroke} strokeWidth="1.2" />);
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill={fill} stroke={stroke} strokeWidth="1.6" />
      {lineas}
    </svg>
  );
}

export function Badge({ children, tone = 'zinc' }) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Alert({ tone = 'info', children }) {
  const tones = {
    info: 'border-zinc-200 bg-zinc-50 text-zinc-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] leading-snug ${tones[tone]}`}>
      <IconInfo className="mt-px h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Sheet({ onClose, children, className = '' }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-pop animate-sheet sm:rounded-3xl ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ cantidad, setCantidad, min = 1, max = 20 }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button type="button" aria-label="Menos" disabled={cantidad <= min} onClick={() => setCantidad(Math.max(min, cantidad - 1))} className="grid h-10 w-10 place-items-center text-zinc-700 disabled:text-zinc-300">
        <IconMinus className="h-4 w-4" />
      </button>
      <span className="w-7 text-center text-[15px] font-semibold tabular-nums">{cantidad}</span>
      <button type="button" aria-label="Más" disabled={cantidad >= max} onClick={() => setCantidad(Math.min(max, cantidad + 1))} className="grid h-10 w-10 place-items-center text-zinc-700 disabled:text-zinc-300">
        <IconPlus className="h-4 w-4" />
      </button>
    </div>
  );
}
