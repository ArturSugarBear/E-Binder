import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/E-Binder/',
  server: { allowedHosts: ['terminal.local'] },
  preview: { allowedHosts: ['terminal.local'] },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: { main: resolve('index.html'), archive: resolve('archive.html') },
    },
  },
});
