# Cline-Setup für E-Binder

Dieses Dokument beschreibt die Cline-Agent-Konfiguration für das E-Binder-Repository:
installierte Skills, MCP-Server und empfohlene Workflows. Die Skill-Dateien selbst
liegen lokal unter `.cline/skills/` (gitignored) und werden über
`scripts/install-cline-skills.sh` reproduzierbar installiert.

## Skills

| Skill                             | Quelle                                                                                                        | Zweck                                                                                                                                                                             | Lizenz     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `impeccable`                      | [pbakaus/impeccable](https://github.com/pbakaus/impeccable)                                                   | Design-Vokabular: `polish`, `bolder`, `critique`, `audit`, `animate`, `distill`, `harden`, … + 62-Regel-AI-Slop-Detektor. Liest `PRODUCT.md` (existiert im Repo) und `DESIGN.md`. | Apache-2.0 |
| `motion-director`                 | [frankxai/awesome-motion-design-agent-skills](https://github.com/frankxai/awesome-motion-design-agent-skills) | Motion-Konzepte, Choreografie, Easing, Stack-Wahl (CSS/Motion/GSAP/Lottie/Rive/Remotion/Three.js).                                                                                | CC0-1.0    |
| `site-motion-excellence-director` | dito                                                                                                          | Motion-Systeme, Scroll-Motion, Reduced-Motion-Planung, visuelles QA für Seiten/Apps.                                                                                              | CC0-1.0    |
| `web-motion-auditor`              | dito                                                                                                          | Review von Animationen/Transitions, Performance, A11y (`prefers-reduced-motion`).                                                                                                 | CC0-1.0    |
| `remotion-video-agent`            | dito                                                                                                          | Programmatische Videos/MP4/GIFs mit Remotion (nur bei Video-Aufgaben aktiv).                                                                                                      | CC0-1.0    |
| `generative-media-director`       | dito                                                                                                          | KI-Bild-/Video-Asset-Workflows (nur bei Media-Aufgaben aktiv).                                                                                                                    | CC0-1.0    |
| `ponytail`                        | [vgzx64/ponytail-for-cline](https://github.com/vgzx64/ponytail-for-cline)                                     | „Lazy senior dev": 6-Stufen-Leiter (YAGNI → stdlib → nativ → Dependency → One-Liner → Minimum). Intensitäten `lite                                                                | full       | ultra`. | MIT |
| `ui-taste`                        | [milad-ahmd/ui-taste](https://github.com/milad-ahmd/ui-taste)                                                 | Score für CSS/Tailwind (Type-Scale, Paletten-Duplikate, 4px-Raster, Radien, Kontrast, AI-Look) → Konsolidierung in Design-Tokens.                                                 | MIT        |

### Installation / Update

```bash
npm run skills:install            # Projekt-Scope: .cline/skills/
npm run skills:install -- --global   # Alle Projekte: ~/.cline/skills/
npm run skills:install -- --force    # Bestehende Skills ersetzen (Update)
```

Cline lädt Skills beim Start (Metadata) und bei Bedarf (Inhalt). Nach der Installation
das Cline-Panel neu laden. Nutzung: Skill über `/` im Chat erzwingen
(z. B. `/impeccable`, `/ponytail ultra`) oder automatisch über die Description triggern.

### Hinweise

- `.cline/` ist gitignored – persönliche Agent-Konfiguration, keine Veröffentlichung
  im öffentlichen Repo (siehe AGENTS.md). Wer Team-Sharing will, kann `.cline/`
  gezielt committen.
- Der `impeccable`-Skill lädt beim ersten Aufruf sein Engine-Binary nach
  (`scripts/impeccable`-Launcher, Checksum-geprüft). `impeccable` liest das bereits
  vorhandene `PRODUCT.md`; ein `DESIGN.md` wird bei Bedarf per `/impeccable document`
  erzeugt.
- `ui-taste` nutzt `python3 scripts/ui_lint.py` (siehe SKILL.md) – Python 3 wird benötigt.
- `npm run check` (Prettier/ESLint) ignoriert `.cline/` über `.prettierignore` und
  `eslint.config.js`, damit die lokalen Skill-Dateien die Qualitätsprüfung nicht stören.

## MCP-Server

Konfiguriert in `~/.cline/data/settings/cline_mcp_settings.json` (Cline-Nutzer-Scope):

| Server       | Paket                         | Zweck                                                                                                                                     |
| ------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright` | `@playwright/mcp` (npx)       | Browser-Steuerung: Screenshots, visuelle Verifikation der PWA, Klick-Pfade, A11y-Checks (passend zu den Browserprüfungen laut AGENTS.md). |
| `context7`   | `@upstash/context7-mcp` (npx) | Aktuelle API-Doku on demand (Motion, Vite, Supabase-JS, ONNX Runtime Web) ohne Web-Suche.                                                 |

Empfohlene, bewusst NICHT vorkonfigurierte Ergänzungen (brauchen persönliche Zugangsdaten
und gehören daher nicht ins Repo – in der Cline-MCP-UI hinzufügen):

- **Supabase MCP** (`@supabase/mcp-server-supabase`, stdio mit persönlichem
  Access-Token) – Schema/Migrationen/Daten der E-Binder-Supabase-Instanz direkt
  vom Agenten prüfen lassen.
- **Figma MCP** – falls Karten-/UI-Designs in Figma liegen (Design-to-Code).
- **Firecrawl** – Recherche von Kartensets/Preisen für die Katalogdaten-Pflege.

## Empfohlene App-Dev-Workflows

1. **UI-Politur vor Release**: `/impeccable critique` + `/impeccable audit` auf die
   betroffene Ansicht (Catalog/Scanner/Workspace), danach `/impeccable polish`.
2. **Animationen (motion-Abhängigkeit)**: `motion-director` für das Konzept,
   `web-motion-auditor` nach der Implementierung; Reduced-Motion-Regeln sind im
   Skill verankert.
3. **Token-Hygiene**: `ui-taste`-Lint über `src/*.css` laufen lassen und
   One-off-Werte in Design-Tokens konsolidieren (Catalog.css/Workspace.css sind
   gute erste Kandidaten).
4. **Schlanke Features**: bei kleinen Aufgaben `ponytail` aktivieren, um
   Überbau zu vermeiden – passt zur bestehenden, bewusst schlanken Codebasis.
5. **Browserprüfungen**: Playwright-MCP (oder `npm run test:e2e` mit
   `@axe-core/playwright`) für die laut AGENTS.md geforderten Browserchecks.
