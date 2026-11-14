# OpenCode setup for E-Binder

Stand: 14. November 2026. Ziel: OpenCode bekommt dieselben Design- und
Motion-Skills wie Cline und kann E-Binder mit einem echten, klickbaren Browser
als Desktop-Web-App und als iPhone-Web-App prüfen.

## Was eingerichtet ist

### Browser (Playwright MCP)

`opencode.json` startet vier lokale MCP-Server:

| Server              | Zweck                              | Einstellung                              |
| ------------------- | ---------------------------------- | ---------------------------------------- |
| `playwright`        | Desktop-Web-App                    | Chromium, 1440 × 900, headless, isolated |
| `playwright-mobile` | Mobile Web-App                     | iPhone 13, Chromium, headless, isolated  |
| `chrome-devtools`   | Performance, Traces, Emulation     | Chromium über CDP, SwiftShader, headless |
| `context7`          | aktuelle Bibliotheks-Dokumentation | `@upstash/context7-mcp`                  |

Beide Playwright-Server blockieren den Production-Service-Worker, damit
Screenshots nicht aus einem alten PWA-Cache kommen. Für echtes Offline-/PWA-
Verhalten weiterhin `tests/e2e/pwa.spec.ts` verwenden.

Die Server stellen unter anderem `browser_navigate`, `browser_snapshot`,
`browser_click`, `browser_type`, `browser_take_screenshot`, `browser_resize`,
`browser_evaluate`, `browser_console_messages` und `browser_network_requests`
bereit. Der Agent klickt über die `ref`-Werte aus `browser_snapshot`, nicht über
geratene CSS-Selektoren.

Prüfen:

```bash
opencode mcp list
```

Erwartet:

```text
✓ chrome-devtools    connected
✓ context7           connected
✓ playwright         connected
✓ playwright-mobile  connected
```

### Performance und Motion (Chrome DevTools MCP)

Playwright fährt die App und klickt; Chrome DevTools misst, warum etwas ruckelt.
Der Server liefert `performance_start_trace`, `performance_stop_trace`,
`performance_analyze_insight`, `lighthouse_audit` und `emulate`.

In diesem Container kann `chrome-devtools-mcp` Chromium nicht zuverlässig selbst
starten. `scripts/chrome-devtools-mcp.sh` startet deshalb Playwrights Chromium
mit CDP-Port 9333, SwiftShader und headless und verbindet den MCP-Server damit.
Der Wrapper räumt den Browser beim Beenden wieder auf.

Typischer Motion-Audit:

```text
emulate:
  pageId: <id>
  viewport: "390x844x3,mobile,touch"
  prefersReducedMotion: "reduce"
  cpuThrottlingRate: 4
  networkConditions: "Slow 4G"

performance_start_trace:
  pageId: <id>
  reload: true
  autoStop: true
  ignoreCache: true
  filePath: "test-results/visual-review/motion/home-trace.json.gz"
```

`lighthouse_audit` deckt Accessibility, SEO und Best Practices ab, **nicht**
Performance. Für LCP, INP, CLS und Long Tasks den Trace verwenden.

Geprüfter Lauf auf `#home` (Produktions-Preview, iPhone-Emulation, reduzierte
Bewegung): LCP 762 ms, CLS 0.00, keine laufenden Animationen bei
`prefers-reduced-motion: reduce`. Der Trace liegt unter
`test-results/visual-review/motion/`.

### Skills

`scripts/install-opencode-skills.sh` spiegelt die von Cline installierten Skills
nach `.opencode/skills/`:

- `impeccable`
- `ui-taste`
- `motion-director`
- `site-motion-excellence-director`
- `web-motion-auditor`
- `remotion-video-agent`
- `generative-media-director`
- `ponytail`

Die vendored Skills bleiben wie `.cline/` aus dem öffentlichen Repository
heraus. Der projektspezifische Skill
`.opencode/skills/e-binder-browser-test/SKILL.md` ist eingecheckt.

Installieren bzw. aktualisieren:

```bash
npm run skills:install
```

Das führt zuerst `scripts/install-cline-skills.sh` und danach
`scripts/install-opencode-skills.sh` aus. OpenCode lädt Skills ohne Neustart.

### Cline-Plugins

In dieser Installation gibt es keine separaten Cline-Plugin-Dateien. Die
Cline-Funktionen, die OpenCode braucht, sind MCP-Server aus
`~/.cline/data/settings/cline_mcp_settings.json`:

- `playwright`
- `context7`

Beide sind übernommen. Cline-Workflows, Hooks und Rules waren leer
(`~/Documents/Cline/...`), daher gab es dort nichts zu kopieren.

## Benutzung

1. Dev-Server für visuelle Prüfungen starten:

   ```bash
   VITE_BASE_PATH=/ npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
   ```

   `http://127.0.0.1:5173/` öffnen. `VITE_BASE_PATH=/` ist wichtig: Mit dem
   Produktions-Base `/E-Binder/` verdoppelt Vite 8 in Dev die `%BASE_URL%`-
   Assets (`/E-Binder/E-Binder/brand/...`), wodurch Logo und Icons im Dev-Server
   kaputt aussehen. Der Production-Build ist korrekt.

2. Production-Parität prüfen:

   ```bash
   npm run build
   npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
   ```

   `http://127.0.0.1:4173/E-Binder/` öffnen.

3. In OpenCode den Skill nennen, zum Beispiel:

   ```text
   Use @e-binder-browser-test. Open the app on desktop and iPhone 13, click
   Home → Entdecken → Binder → Profil, and save screenshots.
   ```

4. Screenshots landen in `test-results/visual-review/desktop/` bzw.
   `test-results/visual-review/mobile/`. Der Ordner ist gitignored.

5. Für einen Gestaltungsdurchgang zusätzlich `@impeccable` laden. Für
   Konsistenz-/Token-Prüfung:

   ```bash
   python3 .opencode/skills/ui-taste/scripts/ui_lint.py src
   ```

## Geprüfter Stand

- `opencode mcp list`: alle drei Server `connected`.
- Desktop: `#home` und `#entdecken` geladen, Navigation geklickt, keine
  horizontale Überläufe bei 1440 px.
- Mobile: iPhone-13-Emulation (390 px, DPR 3, Touch), `#home` und `#binder`
  geklickt, keine horizontalen Überläufe.
- 320 px: `scrollWidth === innerWidth`, kein Überlauf.
- Production-Preview: Logo lädt (`naturalWidth` 300), Dev-Server mit
  Standard-Base zeigt den oben beschriebenen Asset-Doppelpfad.

Screenshots und Traces sind lokale Prüfmittel und gehören nicht ins öffentliche
Repository.
