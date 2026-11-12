# Rare Room — Retro-Futurism release kit

## Approved master artwork
- `public/brand/rare-room-mark.svg`: canonical app and favicon symbol (collectible archive, no Pokémon trademarks).
- `public/brand/rare-room-lockup.svg`: Rare Room / E-Binder product lockup.
- `public/brand/rare-room-retro-wordmark.svg`: standalone wordmark derived from the lockup.
- `*-mono.svg`, `*-positive.svg`, `*-reversed.svg`: reduced-color and light/dark application variants. They share approved master geometry.

## PWA source-of-truth
`scripts/generate-pwa-icons.mjs` rasterizes `rare-room-mark.svg` with Resvg on every production build. The checked-in 180, 192 and 512 pixel PNG artwork derives from this same vector master. The separately composed 512 maskable variant centers the complete card-sleeve signet within a conservative safe region.

Vite PWA plugin in `vite.config.ts` owns the published manifest and service worker; do not create a second competing `public/manifest.webmanifest`. The app uses `public/icons/icon-180.png` as iOS touch icon.

## Materials, performance and accessibility
`src/rare-room-materials.css` defines reusable glass tokens and material effects for Home, Discover, Vault, Portfolio, Profile, dialogs and navigation. Blur is confined to small UI surfaces. The scan camera remains unobscured. Reduced-motion and reduced-transparency users get minimal transitions or opaque surfaces. Main navigation retains the prominent central Scan action.

## Validation
`npm run check`, `npm run test:e2e`, `npm run build` and GitHub Pages deployment checks are required. `scripts/validate-pwa.mjs` compares the exported PNGs to the canonical source rendered by Resvg and validates every image dimension and manifest path. Browser screenshots are captured by `tests/e2e/rare-room-release.spec.ts` in the `rare-room-browser-qa` workflow artifact.
