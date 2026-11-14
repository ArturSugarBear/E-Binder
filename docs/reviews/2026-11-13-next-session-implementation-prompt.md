# Next Session — Implement the Apple UI Review

> **Living prompt:** `docs/next-session-prompt.md`. The next session must overwrite that file with the next prompt before finishing.

Copy the prompt below into the new session.

---

You are acting as a senior Apple-platform UI engineer and interaction designer in `/workspaces/E-Binder`. Implement the P0 and highest-leverage P1 findings from the critical review. Do not only plan — make the changes, verify them, and publish them according to the repository rules.

## Read first

1. `AGENTS.md` (binding working rules).
2. `docs/reviews/2026-11-13-apple-ui-critical-review.md` (the review you are implementing).
3. `PRODUCT.md`, `docs/design.md`, `docs/research/ui-usability.md`, `HANDOFF.md` (current test environment and release state).
4. Current implementation: `index.html`, `src/styles.css`, `src/workspace.css`, `src/ui/workspace.ts`, `src/ui/home-view.ts`, `src/ui/collection-view.ts`, `src/ui/binder-view.ts`, `src/ui/page-scan.ts`, `src/ui/add-cards.ts`, `src/ui/sheet-gestures.ts`, `src/ui/swipe.ts`, `src/ui/workspace-dom.ts`, `src/pwa.ts`.

## Objective

Deliver a visibly more native iPhone experience without changing the product's data ethics or native TypeScript/DOM architecture. But Create a more beautiful and fitting brand-kit with impeccable and taste skill.

## Non-negotiables

- No framework migration, no CSS framework, no new dependency unless already installed and justified.
- Preserve `public/E-Binder_Brand-Lab_v2.html` unchanged; preserve the palette, vector lockup, system fonts, 63:88 card art, exact 3×3 pocket positions.
- No invented possession, price, confidence, user study, or physical setup. Keep every confirmation gate.
- Keep `npm run check` green. Run Chromium, mobile Chromium and WebKit for touched flows. Do not rebuild `dist` while Playwright uses it; no parallel Playwright runs on the same output folder.
- Follow `AGENTS.md`: verified changes on `master` and GitHub Pages, check the Action and the live page, never force-push. If an external step fails, name it.
- If a change would compromise data integrity, stop and explain instead of guessing.

## Phase 1 — P0, in this order

### 1. One mobile IA

Choose one model and align tab label, route, page title and vault tabs:

- Either the dock is `Home | Entdecken | Scan | Binder | Profil` and "Binder" opens `Deine Binder`; or the spec's five destinations remain and Home is removed.
- The tab must not say "Sammlung" while opening "Deine Binder".
- Remove the duplicate desktop navigation: no two active `aria-current="page"` controls for the same screen.

Acceptance: one active nav item; tab label matches the landing title; `PRODUCT.md` and UI agree; e2e updated.

### 2. One scanner surface

- Home and the dock Scan action open the live scanner directly.
- The "Karten hinzufügen" dialog remains the manual/catalog/file path; it must not auto-open a second dialog.
- Closing the scanner returns to the originating screen, not to an upload dialog.

Acceptance: one tap from Home/Scan to the viewfinder; no stacked `<dialog>`; focus returns to the opener; no state change without confirmation.

### 3. One primary action on the empty collection

- Remove the duplicate "Erste Karte hinzufügen" / "Karten hinzufügen" primaries; keep one primary add action and one secondary demo action.
- Stack heading actions at ≤360px; no label wraps to three lines; equal heights.

Acceptance: one lime primary on the empty collection; no 3-line CTA at 320; no horizontal overflow; axe clean.

### 4. Touch feedback and safe dismissal

- Add a consistent `:active` state to every button/card/tab/tile; wrap hover rules in `@media (hover:hover)`.
- Guard sheet drag and backdrop close when fields are dirty; preserve drafts or ask.
- Replace `window.confirm` with the app's own confirmation sheet.

Acceptance: pressed state within 100ms; no hover styles on coarse pointers; no silent loss of typed data; tests for dirty dismissal.

### 5. Type ramp and Dynamic Type

- Body 17px; 15px secondary; 13px captions; 11px minimum for legal.
- `900 / -0.055em` only for the brand hero and first-run empty-state headline; h2/h3/dialog titles 600–700 with normal tracking.
- Replace 10px mono uppercase eyebrows with 11–12px sans or remove them.
- Add a `rem` / `-apple-system-body` path; test at 130–200% text and at 320px.

Acceptance: no fixed 15px body; heading hierarchy holds at 320; large text does not clip; screenshots refreshed.

## Phase 2 — P1 after Phase 1 passes

6. **Capture-first page scan:** shutter first; binder/name/language after; one-sentence intro.
7. **Native tab bar:** edge-to-edge or intentional dock, gray unselected, single lime selected tint, no FAB/glow.
8. **Home dashboard:** recent cards or the current binder page before marketing; onboarding only on first run.
9. **Binder:** 3×3 page first under a compact title; controls in one toolbar; remove the desktop duplicate 9-row inspector; keep the page rail.
10. **Gestures:** direct manipulation for card/page swipes or remove them; consistent sheet physics.
11. **Accent discipline:** lime = one primary + selected state; neutral segmented control; white focus ring; no glow.
12. **Platform:** left/right safe areas or portrait lock; 44px version/footer links; `prefers-contrast`; `lang="ja"`; favicon/OG/startup image; move the version chip to Profil.

## Phase 3 — only if checks and time allow

- Remove `backdrop-filter` from content panels; measure the WebGL dock on/off on iPhone; add screenshot baselines at 320/390/430 + large text + reduced motion.
- One route-change handler; focus the `h1` and announce; remove or shorten the 360ms route fade.
- Move PWA banners out of first paint; consolidate CSS tokens; split add-cards/page-scan into a state machine plus views.

## Verification and delivery

For each phase:

1. `npm run check`.
2. Targeted Playwright: chromium, mobile-chromium, webkit; axe on changed screens.
3. Inspect 320/390/430 screenshots; confirm first content, no wrapped 3-line CTA, no overlap with the dock.
4. Update `HANDOFF.md` or the relevant docs with what changed and what remains.
5. Publish to `master` per `AGENTS.md`; verify the GitHub Action and the live page.

At the end, return a short report: files changed, acceptance evidence, tests, commit hash, live URL, remaining risks, and the next prompt.

## Working method

Start by writing a short plan with the files you will touch and the acceptance checks you will run. Then implement Phase 1 completely, run the checks, and inspect the rendered UI before starting Phase 2. Do not mix a redesign of the data model or a framework migration into this work. If a finding turns out to be based on an outdated screenshot, verify against the current code and say so before changing it.

## Session completion protocol — mandatory

A session is not finished when the code compiles. It is finished when the repository, the live page, and the next session are all ready.

1. **Verify.** Run `npm run check`. Run the targeted Playwright projects. Inspect 320/390/430 screenshots. Do not claim a check you did not run.
2. **Report.** Write `docs/reviews/YYYY-MM-DD-implementation-report.md` with: what changed, acceptance evidence, commands and results, screenshots inspected, remaining P0/P1/P2 items, and every external step that failed.
3. **Write the next prompt.** Overwrite `docs/next-session-prompt.md` with a complete, copy-paste prompt for a fresh session. It must include:
   - the repository and the read-first list;
   - what is already done, including the commit hash;
   - the next ordered tasks, with acceptance criteria;
   - the verification commands and the publish rules;
   - the do-not-change list;
   - this same session completion protocol, so the loop continues.

   If the session could not finish all phases, the next prompt must focus on the remainder, not restart from scratch.

4. **Stage all task files.** Include source, tests, CSS, docs, the implementation report, and the next prompt. Never stage `dist/`, `test-results/`, `playwright-report/`, personal collections, photos, backups, or credentials. Do not use `git add -A`; inspect pre-existing modifications such as `AGENTS.md` and `package-lock.json` and include only files that belong to this task. Check `git status --short` and `git diff --cached --stat` before committing.
5. **Commit.** Use a clear conventional message, for example `ux(ui): ...` or `docs(ui): ...`. Leave the working tree clean for the next session.
6. **Push.** Fetch the current remote `master` first. If it moved, rebase, re-run the affected checks, then push. Never force-push. If the push fails, report the exact failure and do not pretend it succeeded.
7. **Verify delivery.** Check the GitHub Actions run and the actual GitHub Pages page. Name any external failure clearly.
8. **Print the next prompt** in the final response inside a fenced code block, together with the commit hash and live URL.

## Do not change

Privacy/data model, confirmation gates, source/date labels, reduced motion/transparency, native dialog focus, 16px inputs, the vector logo, the palette, the no-framework decision.
