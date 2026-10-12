// Codificador ESC/POS mínimo (sin dependencias) para impresoras térmicas de 80 mm.
// Convierte los bloques de shared/comandas.js → bloquesTicket() en bytes.

const ESC = 0x1b;
const GS = 0x1d;

// Tabla PC850 para los caracteres del español (la mayoría de impresoras
// genéricas de 80 mm la traen como código de página 2).
const CP850 = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8a,
  'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e, 'É': 0x90, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97,
  'Ö': 0x99, 'Ü': 0x9a, 'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6, 'º': 0xa7,
  '¿': 0xa8, '¡': 0xad, 'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7, 'Í': 0xd6, 'Ó': 0xe0, 'Ú': 0xe9, '°': 0xf8,
};
const CODEPAGE_N = { cp850: 2, cp858: 19 };

function codificar(texto, codepage) {
  const bytes = [];
  for (const ch of String(texto).normalize('NFC')) {
    const c = ch.charCodeAt(0);
    if (c < 0x80) bytes.push(c);
    else if (codepage !== 'ascii' && CP850[ch] !== undefined) bytes.push(CP850[ch]);
    else {
      // Sin equivalente: quitar tilde (é → e) o '?'
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      bytes.push(base.charCodeAt(0) < 0x80 ? base.charCodeAt(0) : 0x3f);
    }
  }
  return bytes;
}

const ALIGN = { left: 0, center: 1, right: 2 };
const SIZE = { normal: 0x00, tall: 0x01, wide: 0x10, double: 0x11 };

/**
 * @param bloques  salida de bloquesTicket()
 * @param opts     { ancho, codepage: 'cp850'|'cp858'|'ascii', cortar, pitido }
 */
export function aEscPos(bloques, { ancho = 48, codepage = 'cp850', cortar = true, pitido = false } = {}) {
  const out = [ESC, 0x40]; // inicializar
  if (codepage !== 'ascii') out.push(ESC, 0x74, CODEPAGE_N[codepage] ?? 2);

  for (const b of bloques) {
    if (b.t === 'line') {
      out.push(ESC, 0x61, 0, GS, 0x21, 0, ...codificar('-'.repeat(ancho), codepage), 0x0a);
    } else if (b.t === 'feed') {
      out.push(ESC, 0x64, b.n || 1);
    } else if (b.t === 'cut') {
      if (cortar) out.push(GS, 0x56, 0x42, 0x00); // corte parcial con avance
    } else if (b.t === 'text') {
      out.push(ESC, 0x61, ALIGN[b.align || 'left']);
      out.push(GS, 0x21, SIZE[b.size || 'normal']);
      out.push(ESC, 0x45, b.bold ? 1 : 0);
      out.push(GS, 0x42, b.invert ? 1 : 0);
      out.push(...codificar(b.value, codepage), 0x0a);
      out.push(GS, 0x42, 0, ESC, 0x45, 0, GS, 0x21, 0);
    }
  }
  if (pitido) out.push(ESC, 0x42, 2, 2); // pitido (si la impresora lo soporta)
  return Buffer.from(out);
}
