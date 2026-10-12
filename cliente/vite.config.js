import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// PREVIEW=1 → un solo HTML autocontenido con backend falso (sin Firebase).
const preview = !!process.env.PREVIEW;
const MOCK = fileURLToPath(new URL('./src/services/backend.mock.js', import.meta.url));

const backendFalso = {
  name: 'backend-falso',
  enforce: 'pre',
  resolveId(source) {
    if (/(^|\/)backend(\.js)?$/.test(source) && !source.includes('mock')) return MOCK;
  },
};

export default defineConfig({
  plugins: [...(preview ? [backendFalso] : []), react(), ...(preview ? [viteSingleFile()] : [])],
  resolve: { alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) } },
  server: { fs: { allow: ['..'] } },
});
