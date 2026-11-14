---
name: E-Binder Scanner
description: Use when changing, debugging, or verifying E-Binder's card scanner, live camera, photo fallback, OCR, capture queue, catalog resolution, or binder-page scan. Maps the scanner state machine, invariants, known regressions, fixtures, and real verification commands.
---

# E-Binder Scanner

The scanner is a confirmation-required capture and recognition aid, not proof of
ownership. Photos stay on the device. No scan may add a card to the collection
before the collector confirms it.

## Architecture map

| File                                    | Responsibility                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/ui/live-scan.ts`                   | Single-card live viewfinder: camera start/stop, corner detection, capture latch, auto/manual capture, queue, review summary. |
| `src/ui/live-page-scan.ts`              | Binder-page viewfinder and 3×3 capture.                                                                                      |
| `src/ui/page-scan.ts`                   | Page crop, nine-pocket review, atomic import.                                                                                |
| `src/ui/add-cards.ts`                   | Add dialog, gallery/camera inputs, `openLiveScannerFlow`, OCR/catalog/review.                                                |
| `src/data/recognize.ts`                 | PaddleOCR worker session, language model selection, warmup, timeout.                                                         |
| `src/data/vision-worker.ts`             | Local OCR worker entry.                                                                                                      |
| `src/data/scan-auto-resolve.ts`         | Number/fraction-first catalog discovery.                                                                                     |
| `src/data/scan-evidence-fusion.ts`      | OCR + catalog + opt-in visual evidence; no probability claims.                                                               |
| `src/data/scan-visual-shortlist.ts`     | Validates visual hits against real catalogue printings.                                                                      |
| `src/data/visual-search.ts`             | Optional visual model/index manifest; missing assets must leave OCR working.                                                 |
| `src/domain/live-ocr-policy.ts`         | OCR hot zones, budget, retry order.                                                                                          |
| `src/domain/scan-session-guardrails.ts` | Capture queue limit (`MAX_PENDING_SCAN_CAPTURES = 24`).                                                                      |
| `src/domain/card-outline.ts`            | Live card quadrilateral detection.                                                                                           |
| `src/domain/page-outline.ts`            | Binder-page outer-edge detection.                                                                                            |
| `src/domain/page-pocket-grid.ts`        | 3×3 pocket geometry.                                                                                                         |
| `src/domain/photo-geometry.ts`          | Quad types and perspective helpers.                                                                                          |

## Entry points

- Home / dock: `openLiveScannerFlow(ctx)` in `add-cards.ts`.
- Add dialog: `openAddCards(ctx, options)` with hidden `gallery` and `camera`
  inputs.
- Binder page: `ctx.openPageScan()` → `openPageScanner` in `page-scan.ts`.
- All single-card entries must use the same review and confirmation path.

## Contract

1. Camera permission denied or unavailable shows a visible fallback. Choosing a
   photo must not be a dead end.
2. A capture is queued before OCR. The camera loop must not wait for OCR,
   catalog requests, or model warmup.
3. Auto-capture requires a stable, plausible card quad. A blank scene, square,
   or landscape frame must not trigger a shutter.
4. Keep the full printed identity: source ID + language + set ID + collector
   number (leading zeros and printed fraction preserved) + confirmed variant.
   Image similarity, name, or a partial number alone is not a printing.
5. Uncertain candidates stay candidates. Never auto-add inventory. Never
   convert a cosine score into a probability.
6. Failure states are distinct and recoverable: unreadable text, no catalog
   match, offline, model unavailable, timeout, queue full.
7. No photo bytes in IndexedDB, Supabase, or exports.

## Known regression (14 November 2026)

`openLiveScannerFlow` creates a hidden `fallbackCamera` input in
`src/ui/add-cards.ts` (~line 2549) and clicks it, but never attaches a `change`
handler. Closing the live sheet also calls `onClose`, which removes the input
before the native picker returns. Choosing a photo therefore closes the scanner
and silently discards the photo.

Red test: `tests/e2e/scanner-live-fallback.spec.ts` is marked `test.fixme`.
Remove `.fixme` first, watch it fail, then fix the lifecycle. The intended
contract is in the test comment: keep the live scanner open, queue the photo as
“1 offene Aufnahme”, and open the review from “Ergebnisse prüfen (1)”.

Do not confuse this with the add-dialog `camera` input, which does have a
`change` handler at `src/ui/add-cards.ts` (~line 1094).

## Tests and fixtures

```bash
npm run check
npx playwright test tests/e2e/scanner-live-fallback.spec.ts --project=chromium
npx playwright test tests/e2e/live-scan.spec.ts --project=chromium --project=mobile-chromium
npx playwright test tests/e2e/live-scan-battle.spec.ts --project=chromium
npx playwright test tests/e2e/scan-zero-match-recovery.spec.ts --project=chromium
npx playwright test tests/e2e/binder-page-scan.spec.ts --project=chromium
npx playwright test tests/e2e/binder-page-rail.spec.ts --project=chromium
```

- `tests/e2e/live-scan-battle.spec.ts` builds a deterministic canvas
  `MediaStream` camera rig and stubs the OCR worker. Use it for capture,
  corner, queue, and camera-lifecycle tests, not recognition accuracy.
- `tests/e2e/live-scan.spec.ts` covers camera-denied fallback UI and pending
  review.
- `tests/e2e/scan-zero-match-recovery.spec.ts` covers unreadable OCR and the
  recovery path.
- `tests/e2e/binder-page-scan.spec.ts` covers the separate 3×3 page path.
- Local card fixtures live in `public/assets/cards/*.webp`.
- The owner’s 34 private binder photos are not in the repository. Never claim
  accuracy from them without a private ground-truth run.

**Resource note:** this Codespace has about 8 GB RAM. Several headless Chrome
instances can make a Playwright test fail with `Target crashed`. Close the
Playwright/Chrome DevTools MCP pages (or extra Chrome instances) before running
the full scanner suite; a clean rerun of the same test is the check.

## Browser debugging

Use `@e-binder-browser-test` and the Playwright MCP servers:

- `playwright-mobile` for the iPhone-sized UI.
- `chrome-devtools` for mobile emulation, CPU/network throttling, console,
  network, and performance traces.
- Mock `navigator.mediaDevices.getUserMedia` for permission-denied paths.
- Use a canvas `MediaStream` for a working fake camera.
- Upload `public/assets/cards/*.webp` to exercise the file fallback.

Do not treat “camera unavailable” in headless Chromium as a product failure.
Verify the fallback and the review path instead.

## Guardrails

- No invented recognition rates, confidence numbers, or real-device claims.
- No forced visual shortlist from the nine-card pilot index. If visual beta is
  enabled, label its coverage and keep OCR/catalog fallback.
- No new model, index, or cloud service without a rights/coverage audit.
- Preserve `prefers-reduced-motion`, 44 px touch targets, and the existing
  confirmation gates.
- Before publishing, run `npm run check` plus the scanner e2e specs on
  Chromium, mobile Chromium, and WebKit where applicable.
