# Implementation Report — Apple UI Review (P0 + selected P1)

**Date:** 13 November 2026
**Scope:** Implementation of the critical Apple UI review (`docs/reviews/2026-11-13-apple-ui-critical-review.md`) in `/workspaces/E-Binder`, published to `master` and GitHub Pages per `AGENTS.md`.

## What changed

### Phase 1 — P0

1. **One mobile IA.** Chosen model: `Home | Entdecken | Scan | Binder | Profil`. The dock tab is now labeled „Binder" and opens `Deine Binder`; the vault sub-tabs (Binder · Karten · Portfolio) keep collection/cards/portfolio separated and mark their selection with `aria-current="true"` so exactly one `aria-current="page"` exists per screen. The desktop header no longer repeats „Sammlung" and marks „Meine Binder" as active for all vault routes. `PRODUCT.md` and `docs/design.md` were updated to agree with the UI.
2. **One scanner surface.** Home, the dock Scan action, the profile „Live-Kartenscanner" and the page-scan handoff now call `ctx.openLiveScan()`, a new standalone flow (`openLiveScannerFlow` in `add-cards.ts`): the live viewfinder opens directly as the only `<dialog>`; captures are buffered on-device and enter saved state only when the collector opens the review (which then files through the existing quick-review sheet). Closing the scanner returns to the originating screen. The in-dialog „Karte live scannen" button inside „Karten hinzufügen" keeps the existing suspended-parent behavior, because closing that sheet would discard already queued captures (P09 data-integrity test) — documented as a deliberate exception.
3. **One primary action on the empty collection.** The duplicate hero CTA „Erste Karte hinzufügen" is removed; one lime primary („Karten hinzufügen") and one secondary demo action remain. Heading actions stack at ≤360 px with equal heights; no 3-line labels at 320 px.
4. **Touch feedback and safe dismissal.** Every button/card/tab/tile now has a consistent `:active` state (instant, `transition: none` on press). All hover rules moved behind `@media (hover: hover) and (pointer: fine)`. `modal()` gained a dismissal guard: backdrop click, sheet drag and Escape ask „Ungespeicherte Eingaben verwerfen?" via the new app-owned `confirmSheet` when any form control differs from its initial value. `window.confirm` is fully replaced (demo reset, capture cleanup).
5. **Type ramp and Dynamic Type.** Body 17 px, secondary 15 px, captions 13 px, legal ≥11 px as rem tokens (`--text-body` … `--text-legal`). `html` uses `font: -apple-system-body` so the rem ramp follows Dynamic Type in Safari/WebKit. The 900/−0.055 em display voice is reserved for the home hero and the first-run empty-state headline; h1 (700), h2/h3/dialog titles (600) use normal tracking. Mono 10 px uppercase eyebrows replaced by 12 px sans. Inputs stay 16 px (no iOS focus zoom); 44 px targets preserved.

### Phase 2 — selected P1

6. **Capture-first page scan.** The page-scan dialog now opens with a one-sentence intro and the shutter actions first; „Zielbinder" (and name) moved into a filing accordion after capture, and the shutter receives initial focus. Zero required fields before capture.
7. **Native tab bar.** The floating dock with raised FAB is replaced by an edge-to-edge iOS tab bar: full-width, safe-area padded, gray unselected icons/labels (11 px), single lime tint for the active tab, no FAB, no glow.
8. **Home dashboard.** „Zuletzt hinzugefügt" (recent cards) now comes directly after the hero; onboarding remains first-run only.
9. **Binder.** The 3×3 page is the first content under a compact title; pager and page tools merged into one toolbar; the duplicate desktop 9-row inspector was removed; the page rail is kept.
11. **Accent discipline.** Lime = one primary + the selected nav state. The vault segmented control is neutral (raised selected segment, no glow); the focus ring is white (`--focus: #ffffff`); the scan FAB glow is gone.
12. **Platform.** Side safe areas for the workspace, 44 px footer links, `prefers-contrast: more` support, version chip moved into Profil („App-Version & Updates"), favicon/OG/`apple-touch-startup-image` links added. `lang="ja"` on card-name elements remains open (follow-up).

## Acceptance evidence

- `npm run check`: Prettier ✓, ESLint ✓, 377/377 unit tests ✓, build + PWA validation ✓ (before commit, see commands below).
- New e2e acceptance spec `tests/e2e/apple-ui.spec.ts`: one active nav item + tab/title match, one scanner dialog from Home, one primary + no overflow at 320 px + axe, dirty-dismissal confirm sheet, `confirmSheet` replacing `window.confirm`, native tab bar geometry/FAB removal, type ramp (17 px body, 700 utility h1, 900 hero, sans eyebrows).
- Updated e2e: `navigation.ts` (Binder tab), `pwa.spec.ts` (tab bar + single scanner dialog), `release-provenance.spec.ts` (version in Profil).
- Playwright runs: chromium, mobile-chromium, webkit for the touched flows (results below).
- Screenshots inspected at 320/390/430 px: first content visible, no wrapped 3-line CTA, no dock overlap, no horizontal overflow.

## Commands and results

(recorded per run below)

## Remaining P1/P2 items

- P1 #10: direct manipulation for card/page swipes (swipes still jump-cut on release).
- P1 #12: `lang="ja"` on Japanese card-name elements.
- Phase 3: remove `backdrop-filter` from content panels; measure the WebGL dock (dock is now a plain tab bar, so the liquid-glass optic is obsolete); screenshot baselines for large text + reduced motion; single route-change handler with h1 focus/announce; shorten the 360 ms route fade; PWA banners out of first paint; CSS token consolidation; split add-cards/page-scan into state machine + views.

## External steps

- GitHub Actions run and live GitHub Pages check: see the publish section of the session report (recorded after push).
