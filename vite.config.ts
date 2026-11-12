import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH || '/E-Binder/';
const basePattern = base.replace(/[\\.*+?^$()|[\]{}]/g, '\\$&');

export default defineConfig({
  base,
  define: {
    __E_BINDER_BUILD__: JSON.stringify(
      process.env.GITHUB_SHA?.slice(0, 12) ?? 'local',
    ),
  },
  server: { allowedHosts: ['terminal.local'] },
  preview: { allowedHosts: ['terminal.local'] },
  plugins: [
    VitePWA({
      base,
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/*.png'],
      manifest: {
        id: base,
        name: 'E-Binder · Dein Fund. Dein Moment.',
        short_name: 'E-Binder',
        description: 'Deine Karten, deine Sammlung und deine Binderseiten.',
        lang: 'de',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#141519',
        theme_color: '#141519',
        icons: [
          {
            src: base + 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: base + 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: base + 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cacheId: 'e-binder',
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        globPatterns: ['**/*.{html,js,css,json,woff2,svg,png,webmanifest}'],
        globIgnores: [
          '**/assets/cards/**',
          '**/catalog-art/**',
          '**/assets/ocr/**',
          '**/assets/vision/**',
          '**/*.map',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: base + 'index.html',
        navigateFallbackAllowlist: [
          new RegExp('^' + basePattern + '(?:index\\.html)?$'),
        ],
        runtimeCaching: [
          {
            urlPattern: new RegExp(basePattern + 'catalog-art/.*\\.json$'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'e-binder-artwork-index',
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern:
              /^https:\/\/(?:images\.pokemontcg\.io|images\.scrydex\.com|tcgplayer-cdn\.tcgplayer\.com)\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'e-binder-secondary-artwork',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 180,
                maxAgeSeconds: 30 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: new RegExp(basePattern + 'assets/cards/.*\\.webp$'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'e-binder-local-card-images',
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 160,
                maxAgeSeconds: 30 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern:
              /^https:\/\/assets\.tcgdex\.net\/.*\.(?:webp|png|jpg|jpeg)(?:\?.*)?$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'e-binder-tcgdex-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 180,
                maxAgeSeconds: 30 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.tcgdex\.net\/v2\/(?:de|en|ja)\/.*/i,
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'e-binder-public-catalog',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: new RegExp(
              basePattern + 'assets/vision/manifest\\.json$',
            ),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'e-binder-visual-manifest',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 30 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: new RegExp(
              basePattern +
                'assets/vision/(?:visual-model-[A-Za-z0-9_.-]+\\.onnx|index-[A-Za-z0-9_.-]+\\.i8|references-[A-Za-z0-9_.-]+\\.json)$',
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'e-binder-visual-models',
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 60 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: new RegExp(
              basePattern +
                'assets/ocr/(?:ppocrv4-rec\\.onnx|ppocr-keys\\.txt)$',
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'e-binder-on-demand-ocr',
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: { main: resolve('index.html'), archive: resolve('archive.html') },
    },
  },
});
