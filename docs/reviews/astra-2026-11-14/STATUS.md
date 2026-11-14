# Astra Review — Umsetzungsstatus

Stand: 14. November 2026. Branch: `fix/scanner-dinov2-candidates`.
Basis: `master@8b8a882` + laufende Scanner-/Produktarbeit. Der ältere
App-Stand des Review-Branches wurde **nicht** übernommen; nur die
Review-Dokumente.

| Paket                       | Status               | Nachweis                         | Offene Einschränkung                  |
| --------------------------- | -------------------- | -------------------------------- | ------------------------------------- |
| R00 Ausgangsstand           | in Arbeit            | Baseline-Tabelle unten, CI-Läufe | Visuelle Baseline wird noch gerendert |
| R01 Identität/UI-Grundlagen | offen                | —                                | Rare-Room-Reste in aktiven Verträgen  |
| R02 Home/Navigation         | offen                | —                                | Sammlung als Oberbegriff fehlt        |
| R03 Binder                  | offen                | —                                | DOM-Reihenfolge + Fingertracking      |
| R04 Sammlung/Detail         | offen                | —                                | bestehende Basis prüfen               |
| R05 Entdecken               | in Arbeit (Subagent) | Worktree `discover-mobile`       | noch nicht integriert                 |
| R06 Preise/Portfolio        | in Arbeit (Subagent) | Worktree `portfolio-dashboard`   | noch nicht integriert                 |
| R07 Scanner/Queue           | in Arbeit            | PR #120, CI grün                 | Release separat                       |
| R08 Visuelle Erkennung      | blockiert            | PR #120 + Dataset-Tool           | Kein gelabelter DE/EN/JA-Korpus       |
| R09 Profil/Wiederkehr       | offen                | —                                | Version/Backup prüfen                 |
| R10 Visuelle/A11y-Qualität  | in Arbeit            | Screenshot-Skript                | reale Geräte fehlen                   |
| R11 Integration/Release     | offen                | —                                | Owner-Freigabe ausstehend             |

## R00 — Baseline

| Fakt            | Wert                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `origin/master` | `8b8a8823b3c69c0f30b922ec28d974f74ae61c2e`                                                           |
| Arbeitsbranch   | `fix/scanner-dinov2-candidates`                                                                      |
| PR #120 Head    | `5b1399d2585af7573cf2cf9315b377dd63fc5d54` (Draft, mergeable)                                        |
| PR #120 CI      | Run `43587668937` — **success**, 18m56s (Chromium + WebKit)                                          |
| Live-Pages-SHA  | `7e930c5b940d` (älter als Branch; Deployment ausstehend)                                             |
| Retention-Run   | `43586330161` — failure (separate private-image retention automation)                                |
| Vercel-Runs     | `43582019833`, `43580000381` — skipped                                                               |
| Node            | 24.22.2                                                                                              |
| Lokale Gates    | `npm run check` grün; 410 Unit-Tests; Scanner-E2E 17/17; Bestätigungs-E2E 20/20; WebKit Apple-UI 7/7 |

Die Retention-Automation ist **nicht** der App-Build und wird separat behandelt.
PR #120 wird nicht allein aufgrund dieses Reviews gemerged; die Scanner-Lieferung
bleibt eine eigene Freigabe.
