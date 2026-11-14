---
name: E-Binder Browser Test
description: Use when visually reviewing, clicking through, or browser-testing E-Binder as a desktop web app or mobile web app. Covers starting the Vite server, using the Playwright MCP desktop and iPhone sessions, navigation, screenshots, console and overflow checks, and combining Impeccable and UI Taste for a visual verdict.
---

# E-Binder Browser Test

Use the Playwright MCP servers configured in `opencode.json` to operate the real
app, not just read source. Take screenshots as evidence and click through the
collector journeys at desktop and iPhone sizes.

## Servers

| MCP server          | Use for         | Viewport             |
| ------------------- | --------------- | -------------------- |
| `playwright`        | Desktop web app | 1440 × 900, Chromium |
| `playwright-mobile` | Mobile web app  | iPhone 13, Chromium  |

Both servers run headless, isolated, and block the production service worker so
screenshots are not served from a stale cache. Do not use them to test PWA
offline behaviour; use the real Playwright suite for that.

In Code Mode, call the tools as `tools.playwright.*` and
`tools.playwright_mobile.*`. The core tool names are:

- `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`
- `browser_take_screenshot`, `browser_resize`, `browser_evaluate`
- `browser_console_messages`, `browser_network_requests`
- `browser_wait_for`, `browser_press_key`, `browser_hover`, `browser_tabs`

Start with `browser_snapshot`. It returns accessible roles, names, and `ref`
values. Click with the returned `ref` instead of guessing CSS selectors.

## Start the app

Run the dev server in the background and keep the URL:

```bash
VITE_BASE_PATH=/ npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://127.0.0.1:5173/`.

Use `VITE_BASE_PATH=/` for browser review. With the production base
(`/E-Binder/`), Vite 8 doubles `%BASE_URL%` assets in dev
(`/E-Binder/E-Binder/brand/...`), so the header logo and icons appear broken
even though the production build is correct.

For a production-like check, build first and use the preview server:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open `http://127.0.0.1:4173/E-Binder/`. This is the path the real GitHub Pages
build uses, and its logo and icons load correctly. Stop the server when
finished; do not leave background servers running.

## Review flow

1. Read `PRODUCT.md`, `AGENTS.md`, and the relevant `docs/` notes before judging
   visuals. The approved identity is Rare Room V2, "Dein Fund. Dein Moment.".
2. Start the app and navigate to `#home`.
3. On desktop, capture the first paint, then click through the primary
   destinations. Use these accessible names:
   - Desktop navigation: `Home`, `Entdecken`, `Meine Binder`, `Profil`
   - Mobile dock: `Home`, `Entdecken`, `Scan: Karte scannen`, `Binder`,
     `Profil und Einstellungen`
   - Vault tabs: `Binder`, `Karten`, `Portfolio`
4. On mobile, repeat the same journeys at iPhone 13 size. Check the 3 × 3 binder
   page, the bottom safe area, and one-handed reach.
5. Save evidence with `browser_take_screenshot`. Auto-named screenshots go to
   `test-results/visual-review/desktop/` and `test-results/visual-review/mobile/`.
   Use a descriptive explicit name for anything you will cite later.
6. Check the page for:
   - horizontal overflow: `document.documentElement.scrollWidth <= window.innerWidth`
   - touch targets at least 44 × 44 px on mobile
   - console errors and failed network requests
   - clipped text, overlapping controls, and double primary buttons
   - correct German copy and the five-destination information architecture
7. Also test a 320 px wide layout by resizing the desktop session to `320x800`
   and repeating the overflow check.

## Visual verdict

For a design pass, load the `impeccable` skill and follow its craft floor. For a
consistency pass, run the UI Taste linter against the source:

```bash
python3 .opencode/skills/ui-taste/scripts/ui_lint.py src
```

Compare before and after screenshots at desktop and mobile sizes. Do not claim a
visual improvement from DOM or CSS alone; the screenshot is the evidence.

## Automated checks

Use the real test suite for behaviour that the MCP session should not paper over:

```bash
npm run check
npx playwright test --project=chromium
npx playwright test --project=mobile-chromium
npx playwright test --project=webkit
npx playwright test tests/e2e/pwa.spec.ts
```

Use targeted specs while iterating, then run the full relevant project before
calling the change verified.

## Guardrails

- Never use real personal photos, real collections, or Supabase credentials.
  Work with the local demo state and temporary scan inputs only.
- Do not confirm ownership from an uncertain scan. Recognition is a
  confirmation-required aid, not proof.
- Do not invent user studies, accuracy numbers, or physical hardware claims.
- Do not change `public/E-Binder_Brand-Lab_v2.html`; it is the authoritative
  brand source and must stay byte-identical.
- Report what was actually clicked and seen. If a flow or browser is untested,
  say so explicitly.
