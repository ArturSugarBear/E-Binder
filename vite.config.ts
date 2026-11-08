import { defineConfig } from 'vite';

export default defineConfig({
  base: '/E-Binder/',
  server: { allowedHosts: ['terminal.local'] },
  preview: { allowedHosts: ['terminal.local'] },
  build: { target: 'es2022', sourcemap: true },
});
