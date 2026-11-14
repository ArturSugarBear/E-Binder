# Next Session — Scanner Reliability Only

Stand: 14. November 2026. This file replaces the previous broad Apple-UI
handoff. The next session works on the card scanner, not on visual polish,
motion, or new product surfaces.

## Current prompt

````text
You are a senior frontend and on-device computer-vision engineer working in
`/workspaces/E-Binder`. Your job is to make the single-card scanner reliable
end to end, starting with a known regression in the home/dock photo fallback.
Do not only plan. Reproduce the failure, fix it, add regression coverage, and
verify on the production build.

Load the `e-binder-scanner` skill before touching code. Use
`e-binder-browser-test` for browser work. Do not load `impeccable` or the
motion skills for this session; scanner correctness comes first.

## Non-negotiable outcome

A collector can open the scanner from Home or the Scan dock, either grant
camera access or choose a photo, get a reviewable capture, see an honest
recognition result or a recoverable failure, and leave without an unconfirmed
card entering the collection.

## Read first

1. `AGENTS.md` (binding working rules).
2. `PRODUCT.md` and `docs/scanner.md`.
3. `docs/scanner-quality.md` and `docs/visual-recognition.md`.
4. `docs/p08-visual-retrieval.md` and `docs/beta-diagnostics.md`.
5. `.opencode/skills/e-binder-scanner/SKILL.md`.
6. `tests/e2e/scanner-live-fallback.spec.ts` (the red test).
7. `tests/e2e/live-scan.spec.ts`, `tests/e2e/live-scan-battle.spec.ts`,
   `tests/e2e/scan-zero-match-recovery.spec.ts`,
   `tests/e2e/binder-page-scan.spec.ts`.
8. `src/ui/live-scan.ts`, `src/ui/live-page-scan.ts`, `src/ui/page-scan.ts`,
   `src/ui/add-cards.ts`, `src/data/recognize.ts`,
   `src/data/scan-auto-resolve.ts`, `src/data/scan-evidence-fusion.ts`,
   `src/data/scan-visual-shortlist.ts`, `src/domain/live-ocr-policy.ts`,
   `src/domain/scan-session-guardrails.ts`.

## Evidence already established

- `tests/e2e/scanner-live-fallback.spec.ts` is marked `test.fixme`. It encodes
  the intended contract for the Home/dock photo fallback. Verified on
  14 November 2026: with `.fixme` removed, the test fails at
  `expect(live).toBeVisible()` because the sheet has already closed; the chosen
  photo is lost.
- `openLiveScannerFlow` in `src/ui/add-cards.ts` (~line 2549) creates a hidden
  `fallbackCamera` file input and clicks it, but never attaches a `change`
  handler. Closing the live sheet calls `onClose`, which removes the input
  before the native picker returns. A selected photo is silently lost.
- The add-dialog `camera` input at `src/ui/add-cards.ts` (~line 1094) does have
  a change handler. Do not “fix” the wrong input.
- Headless Chromium has no camera. `Kamera nicht verfügbar` is an expected
  branch, not proof of a product failure. The fallback path is the bug.
- The visual pilot has only nine local reference printings and is opt-in. No
  ONNX visual model or complete index is shipped for general recognition.
- The owner’s 34 private binder photos are not in the repository. Never publish
  them or claim a recognition rate from them.

## Scanner contract

1. One scanner surface for Home, the Scan dock, and the add dialog. Choosing a
   photo from a denied/unavailable camera must keep a usable path to review.
2. Queue the capture before OCR. The camera loop must not wait for OCR, model
   warmup, or catalog requests.
3. Auto-capture only with a stable, plausible card quad. Blank scenes, squares,
   and landscape frames must not trigger a shutter.
4. Preserve the printed identity: source ID + language + set ID + collector
   number (leading zeros and printed fraction) + confirmed variant. Name or
   image similarity alone is not a printing.
5. Uncertain candidates remain candidates. Never auto-add inventory. Never turn
   a cosine score into a probability.
6. Every failure is recoverable and distinct: unreadable text, no catalog match,
   offline, model unavailable, timeout, queue full.
7. No photo bytes in IndexedDB, Supabase, or exports. No ownership without
   explicit confirmation.

## Ordered tasks

### 0. Green baseline and exact reproduction

Run `npm run check`. Then remove `.fixme` from
`tests/e2e/scanner-live-fallback.spec.ts` and run it:

```bash
npx playwright test tests/e2e/scanner-live-fallback.spec.ts --project=chromium
````

Record the exact failure. If the failure is ambiguous, use the Playwright MCP
mobile session and a `getUserMedia` mock to reproduce it manually. Do not start
by rewriting the scanner.

### 1. Fix the Home/dock photo fallback lifecycle

Choose the UX that matches the existing live scanner: keep the live sheet open,
queue the selected photo(s) as pending captures, update the review summary, and
open the add dialog only through “Ergebnisse prüfen (n)”.

Requirements:

- Attach a real `change` handler to `fallbackCamera`.
- Do not remove the input while the native picker is open.
- Reset `input.value` after reading files so the same photo can be chosen again.
- Queue each file as `{ file, aligned: false }`; the existing crop confirmation
  remains the place to correct alignment.
- Respect `MAX_PENDING_SCAN_CAPTURES`.
- Handle cancel (no files) without closing or losing the scanner.
- Make the test pass without weakening its assertions.

Acceptance: the red test is green; no ownership is created before confirmation;
the live sheet remains usable after cancel.

### 2. Cover the Home/dock live-camera lifecycle

Reuse the deterministic canvas `MediaStream` rig in
`tests/e2e/live-scan-battle.spec.ts`. Add or extend a test that opens the
scanner from `#home` (not only from the add dialog) and verifies:

- a stable card frame reaches the review queue;
- a blank/square/landscape frame does not auto-capture;
- manual capture queues one photo;
- closing the sheet stops every acquired track;
- the queue count and “Ergebnisse prüfen” stay accurate.

Keep OCR stubbed for these tests. They prove lifecycle, not accuracy.

### 3. Verify the OCR/catalog path with a real fixture

Use `public/assets/cards/*.webp` and the existing OCR worker. Verify:

- a readable card opens the review with a candidate or an explicit recovery;
- no forced nine-card visual shortlist appears when the visual pilot is off;
- if the visual pilot is on, its limited coverage is labeled and OCR/catalog
  fallback remains available;
- unreadable text and no-match states are distinct;
- the printed number, fraction, language, and set are preserved;
- no ownership is added until confirmation.

Inspect `scan-auto-resolve.ts`, `scan-evidence-fusion.ts`,
`scan-visual-shortlist.ts`, and `live-ocr-policy.ts` before changing ranking.
Do not add a new model, index, or cloud service in this session.

### 4. Real-device check

On a physical iPhone over HTTPS or the installed PWA, verify:

1. permission denied → visible photo fallback → photo selected → review opens;
2. permission granted → live preview → manual capture → review opens;
3. auto-capture on a stable card, no capture on a blank scene;
4. close the camera → tracks stop, no ownership changes;
5. confirm one card → name/number/language remain correct;
6. reject/close the review → collection unchanged.

If no physical device is available, say so explicitly and do not claim a
real-device pass.

### 5. Regression and delivery

Run:

```bash
npm run check
npx playwright test tests/e2e/scanner-live-fallback.spec.ts --project=chromium
npx playwright test tests/e2e/live-scan.spec.ts --project=chromium --project=mobile-chromium
npx playwright test tests/e2e/live-scan-battle.spec.ts --project=chromium
npx playwright test tests/e2e/scan-zero-match-recovery.spec.ts --project=chromium
npx playwright test tests/e2e/binder-page-scan.spec.ts --project=chromium
npx playwright test tests/e2e/binder-page-rail.spec.ts --project=chromium
```

Then update `docs/scanner.md` with what was actually verified and what remains
unverified. Write `docs/reviews/YYYY-MM-DD-scanner-report.md`. Overwrite this
file with the next focused prompt.

## Acceptance criteria

- The Home/dock fallback regression test passes.
- Existing scanner specs pass on Chromium and mobile Chromium; WebKit where the
  test is supported.
- `npm run check` passes.
- No photo persistence and no unconfirmed ownership.
- No forced visual shortlist and no invented confidence.
- The report distinguishes automated lifecycle tests from real recognition
  accuracy, and states whether a physical iPhone was tested.

## Do not change in this session

- The Rare Room V2 palette, typography, layout, or motion system.
- `public/E-Binder_Brand-Lab_v2.html`.
- The privacy/data model, confirmation gates, 16 px inputs, reduced motion, or
  44 px touch targets.
- The exact 3×3 pocket geometry or the no-framework decision.
- The visual-index licensing/coverage plan. This session fixes the scanner path;
  a new model or full index is a separate project.

## Session completion protocol

1. Run the commands above and report actual results.
2. Update `docs/scanner.md` and write the scanner report.
3. Stage only scanner source, tests, and docs. Never `git add -A`.
4. Commit with a clear message, fetch `origin/master`, rebase if it moved,
   re-run affected checks, and push without force.
5. Verify the GitHub Actions run and the deployed page. Name any external
   failure.
6. Print the next prompt in the final response.

```

## Why this replaces the previous prompt

The previous handoff mixed scanner recovery with a broad Apple-UI/motion
roadmap. This prompt starts from one reproducible failure, defines the scanner
contract, and sequences the work so the next session can finish a meaningful,
verifiable scanner improvement instead of producing another plan.
```
