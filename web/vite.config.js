import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// PREVIEW=1 → un solo HTML autocontenido con datos simulados (sin Firebase):
// simula la Cloud Function y el puente de impresión.
const preview = !!process.env.PREVIEW || process.argv.includes('demo');
const MOCK = fileURLToPath(new URL('./src/data/api.mock.js', import.meta.url));

const apiSimulada = {
  name: 'api-simulada',
  enforce: 'pre',
  resolveId(source) {
    if (/(^|\/)data\/api(\.js)?$/.test(source) || source === './api') return MOCK;
  },
};

export default defineConfig({
  plugins: [...(preview ? [apiSimulada] : []), react(), ...(preview ? [viteSingleFile()] : [])],
  resolve: { alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) } },
  server: { fs: { allow: ['..'] } },
  define: { __DEMO__: JSON.stringify(preview) },
});
