# Living Next-Session Prompt

This file is the canonical handoff for the next session. It is overwritten at the end of every session.

## Current prompt

The current complete prompt is:

```text
You are acting as a senior Apple-platform UI engineer and interaction designer in `/workspaces/E-Binder`. Continue the Apple UI implementation from the previous session. Do not only plan — make the changes, verify them, and publish them according to the repository rules.

## Read first

1. `AGENTS.md` (binding working rules).
2. `docs/reviews/2026-11-13-apple-ui-critical-review.md` (the review being implemented).
3. `docs/reviews/2026-11-13-implementation-report.md` (what the previous session changed and verified).
4. `PRODUCT.md`, `docs/design.md`, `HANDOFF.md` (current release state).
5. Current implementation: `index.html`, `src/styles.css`, `src/workspace.css`, `src/ui/workspace.ts`, `src/ui/home-view.ts`, `src/ui/collection-view.ts`, `src/ui/binder-view.ts`, `src/ui/page-scan.ts`, `src/ui/add-cards.ts`, `src/ui/live-scan.ts`, `src/ui/sheet-gestures.ts`, `src/ui/swipe.ts`, `src/ui/workspace-dom.ts`, `src/pwa.ts`, and the e2e specs in `tests/e2e/` (especially `apple-ui.spec.ts`, `navigation.ts`, `pwa.spec.ts`).

## Already done (previous session)

- P0 1: One mobile IA — dock `Home | Entdecken | Scan | Binder | Profil`; Binder tab opens `Deine Binder`; vault tabs use `aria-current="true"`; desktop header has no duplicate route; `PRODUCT.md`/`docs/design.md` agree. e2e updated.
- P0 2: One scanner surface — `ctx.openLiveScan()` opens the live viewfinder directly (`openLiveScannerFlow` in `add-cards.ts`); captures are buffered and enter saved state only when review opens; closing returns to the origin screen. The in-add-dialog scanner button keeps the suspended-parent behavior deliberately (protects queued captures, P09 test).
- P0 3: One primary on the empty collection; heading actions stack at ≤360 px.
- P0 4: `:active` on every control; hover behind `(hover:hover) and (pointer:fine)`; dirty-field guard on sheet drag/backdrop/Escape via the new `confirmSheet` (`workspace-dom.ts`); `window.confirm` fully replaced.
- P0 5: Type ramp 17/15/13/≥11 px via rem tokens; `html { font: -apple-system-body }` (Dynamic Type); 900/−0.055em display voice only for home hero + first-run headline; eyebrows 12 px sans; inputs stay 16 px.
- P1 6: Capture-first page scan (shutter first, binder/name filing accordion after capture).
- P1 7: Native edge-to-edge tab bar, no FAB/glow, gray unselected, one lime tint.
- P1 8: Home shows recent cards right after the hero; onboarding first-run only.
- P1 9: Binder shows the 3×3 page first under a compact title, one toolbar, desktop 9-row inspector removed, page rail kept.
- P1 11: Accent discipline — lime = one primary + selected nav state; neutral segmented control; white focus ring.
- P1 12 (partial): side safe areas, 44 px footer links, `prefers-contrast: more`, version chip moved to Profil, favicon/OG/startup image links.

Commit hash of that work: `61f6569` (`ux(ui): implement Apple UI review P0 fixes and selected P1 refinements`), published on `master` at `83446f0` after rebasing onto `db815b3` (P0 scanner recovery plan + over-crop fixes from 14 November) and merging the agent tooling commits.

## Next ordered tasks (with acceptance criteria)

### New owner priorities (14 November)

0. **Scanner reliability first.** The owner reports the live scanner as „not working". Read `docs/plans/2026-11-14-scanner-p0-recovery-implementation.md` (now on master) and implement its P0 recovery steps before any cosmetic work: shutter capture, camera-denied fallbacks, over-crop name protection (partially merged in `c12cb94`), and a smoke e2e that actually exercises a camera frame. Acceptance: the scanner produces reviewable captures on the real device without losing the card name.
0b. **Motion/animation weak point.** The owner names animations as the app's biggest weakness. Use the `motion-director` + `web-motion-auditor` skills (already installed under `.cline/skills/`): purposeful micro-interactions (tab transitions, sheet springs, scan feedback), strict `prefers-reduced-motion`, no decorative glow, and document the motion system in `docs/design.md`.

### Phase 2 remainder (P1)

1. **Direct manipulation gestures (#10).** Card detail and binder-page swipes must follow the finger while dragging (translate with resistance), then commit or snap back on release — or remove the swipe affordances entirely. Keep pager buttons and counters as keyboard/AT alternatives. Acceptance: no jump-cut on release; swipes are cancelled on form changes inside the card sheet (existing guard preserved); `prefers-reduced-motion` keeps instant switching; existing e2e (card swipes, binder pager) stays green.
2. **`lang="ja"` on Japanese card names (#12).** Wherever `localizedCardName` is rendered (collection card captions, home recent cards, card dialog title, wish list), set `lang="ja"` when the name contains Japanese characters. Acceptance: e2e checks the attribute on a Japanese card name; German chrome remains `lang="de"` on `<html>`.

### Phase 3 (only after the above pass)

3. Remove `backdrop-filter` from content panels (`.w-glass-panel`, `.w-dialog`, `.w-navigation`) and keep it only for the tab bar; measure scrolling/paint on mobile chromium and note the result in the report. Keep `prefers-reduced-transparency` handling.
4. The liquid-glass WebGL optic for the dock is obsolete now that the dock is a native tab bar — remove `initCollectorMaterial`'s dock attachment or the whole optic if unused elsewhere; document the decision (do not remove the package blindly if archive.html uses it).
5. Add screenshot baselines at 320/390/430 px + large text + reduced motion, and inspect them.
6. One route-change handler: on `navigate`, focus the view's `h1` (`tabindex="-1"`) and announce the route via the existing status region; remove or shorten the 360 ms route fade (`revealCollectorRoute`).
7. Move PWA install/offline banners out of first paint (delay until idle, keep `isUpdateSafe` intact); consolidate duplicated CSS tokens (use ui-taste lint on `src/*.css`); optionally split `add-cards.ts`/`page-scan.ts` into a state machine plus views.
```

## Verification commands and publish rules

- `npm run check` (Prettier + ESLint + 377 unit tests + build + PWA validation).
- Targeted Playwright for every touched flow: `npx playwright test <specs> --project=chromium --project=mobile-chromium --project=webkit`. In this environment `PLAYWRIGHT_CHROMIUM_EXECUTABLE` is not available; use the installed Playwright browsers (`npx playwright install chromium webkit` already done; `install-deps` was run). Set `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` if the host preflight is wrong but the browsers actually run.
- Axe on every changed screen (see `apple-ui.spec.ts` for the pattern).
- Inspect 320/390/430 screenshots: first content, no 3-line CTA, no dock overlap, no horizontal overflow.
- Update `HANDOFF.md` and the implementation report; write the next prompt; stage only task files (never `dist/`, `test-results/`, `playwright-report/`, personal data); no `git add -A`.
- Publish: fetch remote `master`, rebase if it moved, re-run affected checks, push without force. Check the GitHub Actions run and the live GitHub Pages page; name any external failure.

## Do not change

Privacy/data model, confirmation gates, source/date labels, reduced motion/transparency, native dialog focus return, 16 px inputs, the vector logo, the Rare Room V2 palette, the no-framework decision, `public/E-Binder_Brand-Lab_v2.html` (unchanged), the 63:88 card art and exact 3×3 pocket positions, and the now-shipped P0 decisions (one IA, one scanner surface, one empty-collection primary).

## Session completion protocol — mandatory

A session is not finished when the code compiles. It is finished when the repository, the live page, and the next session are all ready.

1. **Verify.** Run `npm run check`. Run the targeted Playwright projects. Inspect 320/390/430 screenshots. Do not claim a check you did not run.
2. **Report.** Write `docs/reviews/YYYY-MM-DD-implementation-report.md` with: what changed, acceptance evidence, commands and results, screenshots inspected, remaining P0/P1/P2 items, and every external step that failed.
3. **Write the next prompt.** Overwrite `docs/next-session-prompt.md` with a complete, copy-paste prompt for a fresh session (repository + read-first list, what is already done with commit hash, next ordered tasks with acceptance criteria, verification commands, publish rules, do-not-change list, this same protocol).
4. **Stage all task files.** Include source, tests, CSS, docs, the implementation report, and the next prompt. Never stage `dist/`, `test-results/`, `playwright-report/`, personal collections, photos, backups, or credentials. Do not use `git add -A`; inspect pre-existing modifications and include only files that belong to this task. Check `git status --short` and `git diff --cached --stat` before committing.
5. **Commit.** Clear conventional message, e.g. `ux(ui): ...`. Leave the working tree clean for the next session.
6. **Push.** Fetch the current remote `master` first; if it moved, rebase, re-run affected checks, then push. Never force-push. Report any push failure exactly.
7. **Verify delivery.** Check the GitHub Actions run and the actual GitHub Pages page. Name any external failure clearly.
8. **Print the next prompt** in the final response inside a fenced code block, together with the commit hash and live URL.

## At the end of the session

Replace this file with the next complete, self-contained prompt (see the protocol inside). Do not leave a summary here. Then commit and push this file together with every other task file.
