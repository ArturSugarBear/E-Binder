# HANDOFF — Astra Review & E-Binder Fortsetzung (2026-11-14)

Dieses Dokument ist der Einstieg für die nächste Session nach einem
Codespace-Restart. Es beschreibt den tatsächlichen Stand, nicht einen Plan.

## 1. Zuerst lesen

1. `ASTRA_REVIEW.md`
2. `docs/reviews/astra-2026-11-14/01-evidence.md`
3. `docs/reviews/astra-2026-11-14/02-product-contract.md`
4. `docs/reviews/astra-2026-11-14/03-execution-plan.md`
5. `docs/reviews/astra-2026-11-14/04-acceptance.md`
6. `docs/reviews/astra-2026-11-14/STATUS.md` (Paketstatus)
7. Dieses Handoff.

**Nicht** den App-Code auf `origin/review/astra-product-2026-11-14`
zurücksetzen. Von dort wurden nur die Dokumente übernommen.

## 2. Branch und Commits

- Arbeitsbranch: `fix/scanner-dinov2-candidates`
- Basis: `origin/master@8b8a882`
- Letzter Haupt-Commit vor diesem Handoff: `bb9123c`
- Arbeitsbaum: sauber (bis auf dieses Handoff)
- PR #120: **Draft**, Head `5b1399d`, CI-Run `43587668937` **grün**
  (Chromium + WebKit, 18m56s). **Nicht gemerged, nicht deployed.**
- Live-Pages-SHA: `7e930c5b940d` (älter als der Branch)
- Retention-Run `43586330161`: failure (separate private-image automation,
  nicht der App-Build). Vercel-Runs `43582019833`, `43580000381`: skipped.

Wichtige Commits auf dem Hauptbranch:

| Commit    | Inhalt                                                                    |
| --------- | ------------------------------------------------------------------------- |
| `54a7173` | Coverage-Gate für den 9-Karten-DINOv2-Pilot                               |
| `0b2270d` | Ehrliche Live-Stages, Otsu-OCR, breiter Footer-Retry, Confirm-Sheet-Tests |
| `7976b1b` | Privater Owner-Dataset-Builder (`scripts/prepare-owner-dataset.mjs`)      |
| `5b1399d` | Stage-Rail-/Confirm-Sheet-Testnachbesserung (PR-#120-Head, CI grün)       |
| `e392ca5` | Einmaliger Bestätigungs-Reward nach menschlicher Bestätigung              |
| `bb44702` | Wettbewerbs-/Produkt-Roadmap                                              |
| `81590d6` | Discover-Performance-Audit                                                |
| `93af7df` | Astra-Review-Dokumente + R00-Baseline                                     |
| `b0a3a85` | R01–R03: E-Binder-Identität, Returning Home, page-first Binder            |
| `bb9123c` | Weitere Astra-Visuals (Binder, Scanner, Desktop-Portfolio)                |

## 3. Was bereits implementiert ist

### R00 — Ausgangsstand

- Baseline-Tabelle in `docs/reviews/astra-2026-11-14/STATUS.md`.
- CI-/Deploy-/PR-Fakten dokumentiert; Retention und App-Build getrennt.
- 14 visuelle Nachweise unter
  `docs/reviews/astra-2026-11-14/visuals/after/`:
  Home first/returning (390/320), Discover Sets/Set (390/320), Binder
  (390/1440), Collection Cards, Card Detail, Portfolio (390/1440), Profil,
  Scanner (390).
- Reproduzierbar: `scripts/capture-astra-visuals.mjs` (Demo-Daten, keine
  privaten Fotos). Der Runner ist unter Speicherdruck empfindlich; im Zweifel
  pro Viewport einen eigenen Context verwenden.

### R01 — Identität und Grundlagen

- `AGENTS.md`, `PRODUCT.md`, `docs/design.md` auf **E-Binder** synchronisiert;
  Rare Room ist historisch markiert.
- Sichtbare Eyebrows in Home/Portfolio/Profil auf E-Binder umgestellt.
- `--ink-3` von der Duplikatfarbe `#a9a8b4` auf `#9a99a6` korrigiert
  (AA-tauglich auf `--raised`); keine neue Palette, kein neues Logo.
- Bestehende Lime-/Flächentokens, Motion- und Glasbibliothek bleiben.

### R02 — Home und Navigation

- Mobile und Desktop-Hauptziel heißt jetzt **Sammlung** (Route `#binder`
  bleibt kompatibel); Vault-Untertabs bleiben Binder · Karten · Portfolio.
- Returning Home: „Weiter sammeln“ mit letzter Binder-/Seitenfortsetzung,
  eigene Karte als Vorschau, Scan + Sammlung als Aktionen. Kein Marketing-Hero
  für Rückkehrer.
- First Visit: „Karte live scannen“ primär, „Demo ansehen“ sekundär.
- `tests/e2e/navigation.ts`, `pwa.spec.ts`, `glass-shell.spec.ts` an die neue
  Bezeichnung angepasst.

### R03 — Binder

- DOM-/Fokusreihenfolge: **Titel → Seite → Seitenrail → Werkzeuge → Info**.
- `enableSwipe` verfolgt jetzt `pointermove`, zeigt gebremstes Fingertracking,
  federt zurück und bricht ohne Seitenwechsel ab. `swipeOffset` ist pure und
  getestet (`tests/unit/navigation.test.ts`).
- `binder-page-rail.spec.ts` erwartet die Werkzeugleiste unter der Seite und
  enthält einen neuen Drag-/Abbruch-Test. **Dieser E2E-Test wurde nach der
  Änderung noch nicht ausgeführt.**

### Scanner / PR #120 (separat)

- Ehrliche Stage-Leiste `Foto → Text → Motiv → Ausgabe → Bereit/Prüfen`.
- Einmaliger Reward nach Bestätigung, kein Reward vor Bestätigung.
- Otsu-Binarisierung + früher breiter Footer-ROI.
- 9-Karten-Pilot zeigt keine fremden Nachbarn ohne Nummernbeleg.
- Dataset-Builder für eigene Fotos (SHA-256, 80/20-Split, Manifest außerhalb
  des Repos): `scripts/prepare-owner-dataset.mjs`, `docs/owner-dataset.md`.

## 4. Subagent-Branches (committet, **nicht** integriert)

Alle liegen als Git-Worktrees unter
`/home/codespace/.local/share/opencode/worktree/cfbfad/` und sind sauber.

| Branch                     | Commit    | Paket      | Inhalt                                                                                          | Offen                                                                    |
| -------------------------- | --------- | ---------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `feat/discover-mobile`     | `c44c169` | R05        | Set-first, sticky Suche/Filter, Completion X/Y, Skeletons, Quick-Wishlist, Request-Coalescing   | E2E auf frischem Preview; Artwork-Hydration/Preisdetails teilweise offen |
| `feat/portfolio-dashboard` | `5e1499a` | R06        | Einstandspreis + Gewinn/Verlust, Dubletten, Set-Fortschritt, Allocation, CSV, ehrliche Coverage | Integration; Card-Detail-Gain-Line                                       |
| `feat/onboarding-simple`   | `ec1ee1f` | R09 (Teil) | Ein Primär-CTA, kürzere Empty States, progressive Startwege                                     | Integration; volle R09-Backup-Prüfung                                    |
| `feat/price-provenance`    | `a27e359` | R06        | Quelle/Währung/Basis/Datum/Stale im Preispanel, „Katalogrichtwert, kein Verkaufspreis"          | Integration; Mobile-E2E                                                  |

**Integrationsreihenfolge:** Portfolio → Price → Discover → Onboarding.
Erwartete Konflikte: `src/workspace.css`, `src/catalog.css`,
`src/ui/home-view.ts`, `src/ui/binder-view.ts`, `src/ui/collection-view.ts`,
`src/ui/discover-view.ts`, `src/ui/catalog-browser.ts`. Manuell auflösen, nicht
resetten. Danach `npm run check` + betroffene E2E + neue Screenshots.

## 5. Supabase MCP — aktueller Blocker

`opencode.json` enthält jetzt:

```json
"supabase-e-binder": {
  "type": "remote",
  "url": "https://mcp.supabase.com/mcp?project_ref=hmgydjfkvehvdwvdftca&read_only=true&features=database,docs,storage",
  "oauth": false,
  "headers": { "Authorization": "Bearer {env:SUPABASE_ACCESS_TOKEN}" }
}
```

Status: `opencode mcp list` → **401** `Format is Authorization: Bearer
[token]`. Beide Namen (`SUPABASE_ACCESS_TOKEN`, `SUBABASE_ACCESS_TOKEN`) wurden
getestet; der Token ist im OpenCode-Prozess nicht sichtbar. Die URL und der
Projekt-Ref sind korrekt.

Nach dem Codespace-Restart:

```sh
opencode mcp list
```

- `✓ supabase-e-binder connected` → Storage-Tools nutzen, Fotos nach
  `~/.e-binder-private/exports/2026-11-14` exportieren (nicht ins Repo).
- weiterhin 401 → Secret-Namen prüfen oder in `/mcps` auf OAuth umstellen
  (`oauth` entfernen/`true`, Header löschen). Token niemals in den Chat oder
  ins Repo schreiben.

Die Fotos sind laut Owner vollständig eigene Aufnahmen. Trotzdem: nicht
committen, nicht öffentlich hochladen, keine unbestätigten Labels als Ground
Truth behandeln.

## 6. Tests — Stand

- `npm run typecheck`: grün (nach R01–R03).
- `npm run lint`: grün (0 Warnungen).
- `npm run test`: grün (70 Dateien; Lauf nach R01–R03).
- `npm run build`: grün (nach R01–R03, inkl. PWA-Validierung).
- PR #120 CI: vollständige Chromium-/WebKit-Regression grün (`5b1399d`).
- Lokal: Scanner-E2E 17/17, Bestätigungs-E2E 20/20 (vor R01–R03).
- Nach R01–R03: `binder-page-rail` **2/2 grün** (inkl. Drag/Abbruch),
  `glass-shell` **4/4 grün**, `pwa` **4 passed, 1 skipped**; der schwere
  OCR-Offline-Test (`pwa.spec.ts:205`) stürzt lokal isoliert mit
  Chromium `Target crashed` ab (Speicherdruck). CI-Run `43587668937` war für
  denselben PWA-Stand grün; als Umgebungsgrenze dokumentiert, nicht als
  Produktbeweis.
- **Noch nicht gelaufen:** WebKit nach R01–R03, Mobile-Chromium nach R01–R03,
  vollständige Discover-/Portfolio-E2E nach Integration der Subagent-Branches.
- Bekannt: `tests/unit/photo-ground-truth.test.ts` kann unter Last am
  CLI-Timeout scheitern (umgebungsbedingt, nicht durch diese Änderungen).
- Chromium „Target crashed“ tritt unter Speicherdruck auf; Contexts einzeln
  schließen, keine mehreren schweren Browser-Läufe parallel.

## 7. Nächste Schritte (Reihenfolge)

1. Codespace restarten; `opencode mcp list` prüfen; Fotos exportieren.
2. Auf `fix/scanner-dinov2-candidates`:
   - `npm run check`
   - `npx playwright test tests/e2e/binder-page-rail.spec.ts tests/e2e/pwa.spec.ts tests/e2e/glass-shell.spec.ts --project=chromium --workers=1`
   - Fehler beheben, dann `docs/reviews/astra-2026-11-14/STATUS.md` aktualisieren.
3. Subagent-Branches integrieren (Portfolio → Price → Discover → Onboarding),
   Konflikte manuell lösen, Tests wiederholen.
4. R04 (Sammlung/Detail), R07/R08 (Scanner/Erkennung) und R09 (Backup/Version)
   gegen die Abnahmekriterien prüfen; R08 bleibt ohne gelabelten DE/EN/JA-Korpus
   ehrlich blockiert.
5. R10: Vorher/Nachher-Screenshots für 320/390/430/800/1280, 200 % Text,
   Reduced Motion, Offline/Fehler; echte Geräte separat ausweisen.
6. R11: Release nur mit Owner-Freigabe; Pages-SHA gegen `version.json` prüfen.
   PR #120 nicht allein aufgrund des Reviews mergen.

## 8. Wichtige Befehle

```sh
# Status
git status --short
git log --oneline -12
gh pr view 120 --json isDraft,state,headRefOid,mergeable

# Checks
npm run check
npx playwright test tests/e2e/binder-page-rail.spec.ts --project=chromium --workers=1

# Screenshots (Dev-Server muss laufen)
VITE_BASE_PATH=/ npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
node scripts/capture-astra-visuals.mjs

# Supabase MCP
opencode mcp list
```

## 9. Offene Risiken

- Die Live-Pages-Version ist veraltet; der Branch ist nicht veröffentlicht.
- R02/R03 sind implementiert, aber die betroffenen Browser-Specs sind noch
  nicht auf dem neuen Stand gelaufen.
- Die Subagent-Branches sind gut getestet, aber nicht miteinander integriert;
  CSS-/DOM-Konflikte sind wahrscheinlich.
- Ohne Supabase-Token keine Fotoidentifikation; ohne gelabelten Korpus keine
  Erkennungsquote.
- Keine echte iPhone-/Galaxy-Messung; WebKit-Emulation ist kein Gerätenachweis.
