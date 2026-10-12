// Asistente para configurar la impresora del mostrador (Windows).
//   node configurar-impresora.mjs   (lo llama configurar-impresora.bat)
//
// 1. Lista las impresoras instaladas en Windows.
// 2. La elegida queda compartida como POS80 (si no lo está, intenta compartirla).
// 3. Pide el ancho del papel y la clave del usuario "impresora".
// 4. Guarda config.json (conserva la config de Firebase que puso configurar.bat).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const RUTA = new URL('./config.json', import.meta.url);
const EJEMPLO = new URL('./config.ejemplo.json', import.meta.url);
const rl = createInterface({ input: stdin, terminal: false });
const lineas = rl[Symbol.asyncIterator]();
const preguntar = async (texto, defecto = '') => {
  stdout.write(defecto ? `${texto} [${defecto}]: ` : `${texto}: `);
  const { value, done } = await lineas.next();
  if (done) stdout.write('\n');
  return (value || '').trim() || defecto;
};
const ps = (comando) => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], { encoding: 'utf8', windowsHide: true });
const comillas = (s) => `'${String(s).replace(/'/g, "''")}'`;

function impresorasWindows() {
  try {
    const salida = ps('Get-Printer | Select-Object Name,ShareName,Shared,PortName,DriverName | ConvertTo-Json -Compress');
    const lista = JSON.parse(salida || '[]');
    return (Array.isArray(lista) ? lista : [lista]).filter((p) => p?.Name);
  } catch (e) {
    console.log('No se pudo leer la lista de impresoras de Windows:', e.message.split('\n')[0]);
    return [];
  }
}

const cfg = JSON.parse(readFileSync(existsSync(RUTA) ? RUTA : EJEMPLO, 'utf8'));
if (!cfg.firebase?.apiKey || cfg.firebase.apiKey.startsWith('<')) {
  console.log('\n⚠ config.json no tiene la conexión a Firebase. Corre primero configurar.bat en la carpeta del proyecto y vuelve a copiar esta carpeta.\n');
  process.exit(1);
}
cfg.impresora ||= {};
const imp = cfg.impresora;

console.log('\n=== Impresoras instaladas en este PC ===\n');
const lista = impresorasWindows();
lista.forEach((p, i) => {
  const comp = p.Shared ? `compartida como "${p.ShareName}"` : 'no compartida';
  console.log(`  ${i + 1}. ${p.Name}  (${comp}, puerto ${p.PortName})`);
});
const nRed = lista.length + 1;
const nArchivo = lista.length + 2;
console.log(`  ${nRed}. Impresora de red (por IP, puerto 9100)`);
console.log(`  ${nArchivo}. Sin impresora: guardar los tickets en archivos (solo para probar)\n`);
if (!lista.length) console.log('  (No se ven impresoras USB. Revisa que el driver de la térmica esté instalado en Windows.)\n');

const eleccion = Number(await preguntar('Número de la impresora térmica', lista.length === 1 ? '1' : ''));
if (eleccion >= 1 && eleccion <= lista.length) {
  const p = lista[eleccion - 1];
  imp.modo = 'windows';
  imp.nombre = p.Name;
  let share = p.Shared && p.ShareName ? p.ShareName : '';
  if (!share) {
    share = await preguntar('Nombre corto para compartirla (sin espacios)', 'POS80');
    try {
      ps(`Set-Printer -Name ${comillas(p.Name)} -Shared $true -ShareName ${comillas(share)}`);
      console.log(`✔ Impresora compartida como "${share}"`);
    } catch {
      console.log(`\n⚠ No se pudo compartir automáticamente (hace falta abrir el .bat como administrador).`);
      console.log(`  Hazlo a mano: Panel de control → Dispositivos e impresoras → clic derecho en "${p.Name}"`);
      console.log(`  → Propiedades de impresora → Compartir → marcar "Compartir esta impresora" → nombre: ${share}\n`);
    }
  }
  imp.compartida = share;
} else if (eleccion === nRed) {
  imp.modo = 'red';
  imp.host = await preguntar('IP de la impresora (la imprime en su hoja de autoprueba)', imp.host && !imp.host.startsWith('192.168.1.100') ? imp.host : '');
  imp.puerto = Number(await preguntar('Puerto', String(imp.puerto || 9100)));
} else if (eleccion === nArchivo) {
  imp.modo = 'archivo';
  imp.carpeta = 'salida';
  console.log('Los tickets se guardarán en la carpeta "salida" (.txt legible y .bin ESC/POS).');
} else {
  console.log('Opción no válida. No se cambió nada.');
  process.exit(1);
}

const papel = await preguntar('Ancho del papel: 1 = 80 mm, 2 = 58 mm', imp.ancho === 32 ? '2' : '1');
imp.ancho = papel === '2' ? 32 : 48;
imp.codepage ||= 'cp850';
imp.cortar = (await preguntar('¿La impresora tiene cortador automático? (s/n)', imp.cortar === false ? 'n' : 's')).toLowerCase() !== 'n';
imp.id ||= 'mostrador';

const claveActual = cfg.cuenta?.password && !cfg.cuenta.password.startsWith('<') ? cfg.cuenta.password : '';
const clave = await preguntar(`Clave del usuario ${cfg.cuenta?.email || 'impresora'}${claveActual ? ' (Enter = dejar la actual)' : ''}`);
cfg.cuenta = { ...(cfg.cuenta || {}), password: clave || claveActual || '<clave-de-la-impresora>' };

writeFileSync(RUTA, JSON.stringify(cfg, null, 2) + '\n');
rl.close();
console.log('\n✔ config.json guardado:');
console.log(`  modo ${imp.modo}${imp.modo === 'windows' ? ` → \\\\localhost\\${imp.compartida}` : imp.modo === 'red' ? ` → ${imp.host}:${imp.puerto}` : ''} · papel ${imp.ancho === 32 ? '58' : '80'} mm · corte ${imp.cortar ? 'sí' : 'no'}`);
if (cfg.cuenta.password.startsWith('<')) {
  console.log('\n⚠ Falta la clave del usuario impresora: vuelve a correr el asistente cuando la tengas.');
  process.exit(2);
}
