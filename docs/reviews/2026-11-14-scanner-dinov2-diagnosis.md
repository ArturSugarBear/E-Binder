# Scanner — DINOv2-Pilot und wiederholte Kandidaten (Diagnose, 2026-11-14)

**Status:** Diagnose und Regressionstest. **Keine** Scanner-Korrektur, **keine**
Supabase-Migration, **kein** Deployment. Der Draft-PR bleibt bis zur
ausdrücklichen Freigabe des Inhabers offen.

- **Auftrag:** `docs/plans/2026-11-14-scanner-p0-recovery-implementation.md`
  (P0-A, P0-B Punkt 7, P0-C Punkt 4/5) sowie der Handoff in
  `docs/next-session-prompt.md`.
- **Basis:** `origin/master` @ `8b8a8823b3c69c0f30b922ec28d974f74ae61c2e`.
- **Branch:** `fix/scanner-dinov2-candidates`.
- **Arbeitsstand:** Die uncommittete Handoff-Datei `docs/next-session-prompt.md`
  wurde als erster Commit (`e172c77`) unverändert auf den Branch übernommen.
  Es gab keine weiteren uncommitteten oder ungetrackten Dateien
  (`git stash list` leer, `git diff --cached` leer).
- **Testumgebung:** Linux-Codespace, Node 24.22.2, Chromium via Playwright
  1.65.0, Python 3.12 mit `numpy 2.2.6`, `pillow 11.3.0`,
  `onnxruntime 1.23.2`.

## 1. Scope

Untersucht wurden ausschließlich:

1. der Scanner-Datenfluss von Kamera/Upload bis zur Kandidatenanzeige,
2. der opt-in DINOv2-Pilotindex mit exakt neun Referenzdrucken,
3. die Ursachen wiederholter bzw. irrelevanter Kandidatenvorschläge.

Nicht geändert wurden UI, Layout, Marke, Motion, Datenmodell,
Bestätigungsgates, Supabase-Schema, Modell- oder Indexumfang.

## 2. Datenflusskarte

| Stufe                       | Datei                                                                                      | Verhalten                                                                                                       | Fehler-/Fallbackpfad                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Live-Kamera                 | `src/ui/live-scan.ts`                                                                      | Ecken, Capture-Latch, Queue; Foto wird **vor** OCR eingereiht (`captureCard`, ~l. 460–580).                     | Keine Ecken → manueller Auslöser; Queue voll → `pauseForReview`. Kein Kandidat entsteht hier.     |
| Photo-Fallback / Add-Dialog | `src/ui/add-cards.ts:958–1080`                                                             | Datei-Input, SHA-256-Dublettensperre, Queue-Limit 24, temporäre Blobs.                                          | Ungültiger Typ/Größe → Fehlermeldung; Duplikat → kein zweiter Eintrag.                            |
| Review-Aufruf               | `add-cards.ts:1101–1151`                                                                   | Nutzt fertige Live-Ergebnisse (`liveReviewResults`) statt OCR neu zu starten.                                   | Kein Ergebnis → `resolveOcrReview`.                                                               |
| OCR                         | `src/data/recognize.ts`, `src/data/vision-worker.ts`                                       | PaddleOCR im Worker, Hot-Zones, Budget.                                                                         | Timeout/Modell fehlt → `live_ocr_timeout` / `live_model_unavailable`; Foto bleibt prüfbar.        |
| Katalogsuche                | `src/data/scan-auto-resolve.ts:102–187`                                                    | Nur vollständige Fraktion + offizielle Set-Gesamtzahl; Sprachvarianten DE/EN/JA.                                | Keine Fraktion → `[]`. Netzfehler → leere Kandidaten, kein erfundenes Printing.                   |
| Visueller Pilot             | `src/data/visual-search.ts`, `src/data/visual-worker.ts`, `src/domain/visual-retrieval.ts` | Manifest → SHA-256-Modell/Index → CLS-Embedding → Top-5-Cosinus.                                                | Manifest 404, Hash-Fehler, Warmup > 60 s, Inferenz-Timeout → `null`/`[]`; OCR bleibt unverändert. |
| Printing-Auflösung          | `src/data/scan-visual-shortlist.ts:18–77`                                                  | Validiert `sourceId`, `setId`, `number`, `language` gegen lokalen oder TCGdex-Datensatz.                        | Nicht auflösbar → Karte wird verworfen, kein erfundener Katalogeintrag.                           |
| Fusion/Ranking              | `src/data/scan-evidence-fusion.ts:51–166`                                                  | Set+Nummer (1000), Nummer+Name (600), Name (75), visueller Rang (90–105); Widersprüche erzeugen `ocr-conflict`. | Reine visuelle Treffer → `visual-review`, **kein** `suggested`.                                   |
| Review-UI                   | `src/ui/add-cards.ts:1513–1920`                                                            | Zeigt `suggested` oder `candidates[0]` als große Prüfkarte.                                                     | `visual-review` erhält den Hinweis, dass Ausgabe/Sprache unbestätigt sind.                        |

**Wichtig:** Der visuelle Pfad allein erzeugt nie `suggested` und nie Besitz.
Die Auflösung prüft echte Katalogidentitäten. Das Problem ist nicht eine
erfundene Karte, sondern die **Auswahl und Präsentation** der neun
Pilotreferenzen als allgemeine Kandidaten.

## 3. DINOv2-Pilot: Abdeckung, Aktivierung, Fallback

1. **Indexumfang:** exakt neun deutsche Drucke aus
   `src/data/verified-images.ts:8–18`, erzwungen durch
   `scripts/prepare-visual-beta-input.mjs:18–19` und
   `scripts/verify-visual-beta.mjs:32–49`:

   | Referenz      | Karte         | Nummer  |
   | ------------- | ------------- | ------- |
   | `de:sv01-211` | Trasla        | 211/198 |
   | `de:sv01-212` | Kirlia        | 212/198 |
   | `de:sv01-245` | Guardevoir-ex | 245/198 |
   | `de:sv03-207` | Taubsi        | 207/197 |
   | `de:sv03-208` | Tauboga       | 208/197 |
   | `de:sv03-225` | Tauboss-ex    | 225/197 |
   | `de:sv02-208` | Frospino      | 208/193 |
   | `de:sv02-209` | Cryospino     | 209/193 |
   | `de:sv02-210` | Espinodon     | 210/193 |

   Keine englischen, japanischen oder weiteren deutschen Drucke. Das ist eine
   Modellpfad-Demo, kein Kartenkatalog.

2. **Wo liegen die Assets?** Nicht im Repository. GitHub Actions erzeugt
   Modell, `index-*.i8`, `references-*.json` und `manifest.json` bei jedem
   Release (` .github/workflows/pages.yml:43–59`,
   `.github/workflows/vercel-production.yml:60–77`) und prüft Hashes,
   384 Dimensionen, 9×384 Byte Index und exakt neun DE-Referenzen. Lokal
   existiert `public/assets/vision/` deshalb nicht; ohne diese Assets liefert
   `createVisualSearchSession` `null` und OCR bleibt allein.

3. **Aktivierung:** ausschließlich über
   `localStorage['e-binder-visual-beta-v1'] === 'on'`
   (`src/data/visual-beta.ts:6–14`). Geprüft an drei Stellen:
   `add-cards.ts:202`, `:715`, `:836` und `visual-search.ts:16`. Es gibt
   **keinen** Default, keinen stillen Fallback und keine serverseitige
   Aktivierung. Der Live-Scanner kennzeichnet den Zustand sichtbar
   (`live-scan.ts:249–253`: „DINOv2-Pilot aktiviert · 9 Referenzkarten“).

4. **Top-K ohne Relevanzgrenze:** `searchVisualIndex` füllt immer `topK`
   Plätze, solange der Index Einträge hat (`visual-retrieval.ts:97–100`). Der
   Worker fordert fest fünf an (`visual-worker.ts:225`), die Auflösung behält
   fünf (`scan-visual-shortlist.ts:28`). Es gibt **keinen** Mindest-Cosinus,
   keinen Margin-Test und keine Coverage-Prüfung.

5. **Fallback bei fehlendem/inkompatiblem Modell:** Manifest-Timeout 1,8 s,
   Warmup 60 s, Inferenz 12 s (live) bzw. 4,7 s (foreground). Fehler →
   `null`/`[]`, `fuseScanEvidence` fällt auf OCR/Katalog zurück. Diesen Pfad
   habe ich im Code bestätigt, aber nicht mit kaputten Assets im Browser
   ausgeführt.

## 4. Reproduktion

Die Messung nutzt **die tatsächlich ausgelieferten INT8-Gewichte**
(`sha256 7cfc69bd…`, 24.427.763 Byte), die **echten Repo-Kartendateien** und
**das echte Packformat** (`int8`, 384 Dimensionen, CLS, ImageNet-Normalisierung).
Es wurden keine privaten Fotos verwendet.

```sh
# Modell exakt wie in CI laden und prüfen
curl -fsSL 'https://huggingface.co/onnx-community/dinov2-small-ONNX/resolve/08c606e/onnx/model_quantized.onnx' -o /tmp/opencode/dinov2-small.onnx
sha256sum -c <<< '7cfc69bd1874d20b9dbecdab057f21aeac7b90c2f560bd0fb66af86c78024f62  /tmp/opencode/dinov2-small.onnx'

# Identischen Pilotindex bauen
node scripts/prepare-visual-beta-input.mjs
PYTHONPATH=/tmp/opencode/pylibs python3.12 scripts/embed-card-references.py \
  visual-beta-reference-input.json /tmp/opencode/dinov2-small.onnx /tmp/opencode/visual-vectors.json
node scripts/pack-visual-index.mjs /tmp/opencode/visual-vectors.json \
  /tmp/opencode/dinov2-small.onnx /tmp/opencode/vision
rm visual-beta-reference-input.json

# Top-5 je Bild messen (neues Diagnosewerkzeug)
PYTHONPATH=/tmp/opencode/pylibs python3.12 scripts/probe-visual-pilot.py \
  /tmp/opencode/dinov2-small.onnx /tmp/opencode/vision \
  public/assets/cards/svi-211.webp public/assets/cards/chillabell.webp \
  public/assets/cards/greninja-sv06-214.webp /tmp/opencode/blank.png /tmp/opencode/noise.png
```

### Reproduktionstabelle

| #   | Build/SHA          | Umgebung                    | Fixture                                   | Erwartet                               | Tatsächlich                                                    | Evidenz                                                            | Ursache                                                                                  |
| --- | ------------------ | --------------------------- | ----------------------------------------- | -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| R1  | `8b8a882` + Branch | Python/ONNX, echte Gewichte | `svi-211.webp` (im Index)                 | Top-1 = `de:sv01-211`                  | Top-1 `de:sv01-211`, cos 1.0000                                | Probe-Ausgabe                                                      | Positivkontrolle: Index funktioniert für abgedeckte Karten.                              |
| R2  | `8b8a882` + Branch | Python/ONNX                 | `chillabell.webp` (nicht im Index)        | Kein exakter Treffer                   | 5 Pilotkarten, Top `de:sv01-245` cos **0.7404**                | Probe-Ausgabe                                                      | Top-K ohne Relevanzgrenze (`visual-retrieval.ts:97–100`).                                |
| R3  | `8b8a882` + Branch | Python/ONNX                 | `greninja-sv06-214.webp` (nicht im Index) | Kein exakter Treffer                   | 5 Pilotkarten, Top `de:sv02-210` cos **0.5621**                | Probe-Ausgabe                                                      | dito.                                                                                    |
| R4  | `8b8a882` + Branch | Python/ONNX                 | einfarbig graues Bild (kein Motiv)        | Keine Kandidaten                       | 5 Pilotkarten, cos **0.1000 … 0.0043**                         | Probe-Ausgabe                                                      | dito; selbst ohne Bildinhalt wird Top-5 aufgefüllt.                                      |
| R5  | `8b8a882` + Branch | Python/ONNX                 | Zufallsrauschen                           | Keine Kandidaten                       | 5 Pilotkarten, cos **0.2014 … 0.1107**                         | Probe-Ausgabe                                                      | dito.                                                                                    |
| R6  | `8b8a882` + Branch | Node/`tsx`                  | dieselben 5 Treffer, OCR `''`             | `candidates: []`, kein `visual-review` | `candidateCount: 5`, `basis: visual-review`, `suggested: null` | `probe-fusion.mts`                                                 | Visuelle Treffer werden mit Katalogkandidaten gemischt (`scan-auto-resolve.ts:241–247`). |
| R7  | `8b8a882` + Branch | Vitest                      | orthogonaler Query (Cosinus exakt 0)      | Kein Kandidatenvorschlag               | `state: 'visual-review'`, 5 Kandidaten                         | `tests/unit/visual-pilot-coverage.test.ts` (bewusst fehlschlagend) | `scan-evidence-fusion.ts:143` + `add-cards.ts:1897–1904`.                                |

**Wiederholung über verschiedene Karten:** R2, R3 und R5 teilen sich
`de:sv01-245`, `de:sv01-212` und `de:sv02-210`; R2 und R3 zeigen zusätzlich
`de:sv02-210` an erster Stelle. Unterschiedliche, nicht indizierte Karten
erzeugen also eine überlappende, immer gleiche Kurzliste.

**Rot-Beleg:** Wird der `it.fails`-Test temporär als normaler Test ausgeführt,
schlägt er an der ersten Zusicherung fehl:

```
AssertionError: expected 'visual-review' not to be 'visual-review'
tests/unit/__tmp-red.test.ts:119:31
```

Der Test bleibt im Branch als `it.fails` markiert, damit `npm run check` grün
bleibt. Sobald eine Coverage-Sperre implementiert ist, wird er unerwartet grün
und erzwingt die Umstellung auf einen normalen Test.

## 5. Root Causes (belegt)

1. **Kein Relevanz-/Coverage-Gate im Retrieval.**
   `src/domain/visual-retrieval.ts:97–100` nimmt jeden Kandidaten in Top-K auf;
   `src/data/visual-worker.ts:225` fordert fest fünf; es existiert keine
   Schwelle und kein `count`-Bewusstsein. Bei neun Referenzen ist Top-5 immer
   voll, unabhängig davon, ob die fotografierte Karte enthalten ist.

2. **Visuelle Nur-Treffer werden zu generischen Kandidaten.**
   `src/data/scan-auto-resolve.ts:241–247` mischt `fromVisual` mit
   `catalog` und `candidatesFromText`. `fromVisual` ist bereits durch
   `resolveVisualPrintings` auf echte Katalogdrucke eingeschränkt — aber nicht
   darauf, dass einer davon die fotografierte Karte ist. Deshalb ist
   `candidates.length > 0`, obwohl keine Evidenz für die Aufnahme existiert.

3. **Die Review-UI hebt `candidates[0]` zur Hauptprüfkarte.**
   `src/ui/add-cards.ts:1897–1904` zeigt bei `basis === 'visual-review'` die
   erste Pilotkarte als „Ausgabe mit deinem Foto vergleichen“. Der Hinweis
   „genaue Ausgabe und Sprache noch nicht bestätigt“ ist vorhanden, verhindert
   aber nicht, dass dieselbe Karte bei jeder nicht indizierten Aufnahme erneut
   als Vorschlag erscheint. Auch der Benchmark-Vertrag
   (`add-cards.ts:1536–1548`) übernimmt `candidates[0]` in `scanRankedKeys`.

4. **Kein automatischer Besitz, keine erfundene Karte.** Das ist kein Defekt:
   `suggested` bleibt bei rein visueller Evidenz `undefined`
   (`scan-evidence-fusion.ts:131–144`), und `resolveVisualPrintings` verwirft
   nicht passende Katalogdatensätze (`scan-visual-shortlist.ts:32–43`). Der
   Fehler ist die Präsentation, nicht die Identitätsprüfung.

### Geprüfte und ausgeschlossene Hypothesen

| Hypothese                                        | Befund                                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pilot standardmäßig aktiv                        | **Nein.** Nur `localStorage`-Opt-in (`visual-beta.ts:6–14`).                                                                                                                    |
| Veralteter Manifest-/Index-Cache                 | **Nicht belegt.** Manifest `no-cache` + NetworkFirst, Modell/Index versionsgebundene Dateinamen + `CacheFirst` (`vite.config.ts:186–212`). Falsche Hashes verwerfen die Assets. |
| Zustands-Leak zwischen Aufnahmen                 | **Nicht belegt.** `liveReviewResults`, `transientPhotos` usw. sind per Capture-ID geführt und werden beim Schließen/Verwerfen gelöscht (`add-cards.ts:223–250`, `:497–511`).    |
| Doppelte Aufnahmen                               | **Nicht Ursache.** SHA-256-Dublettensperre (`add-cards.ts:986–1002`).                                                                                                           |
| Modell-/Index-Mismatch                           | **Nicht Ursache.** `modelId`, Dimensionen, Byte-Länge und drei SHA-256 werden geprüft (`visual-worker.ts:45–93`, `:159–163`).                                                   |
| Gleiches Artwork/Sprache/Reprint                 | **Teilweise.** Die Auflösung trennt Sprache und Nummer korrekt; das erklärt Überlappungen, nicht die wiederholte Kurzliste.                                                     |
| OCR liefert nichts, Vision zeigt trotzdem Karten | **Belegt.** Genau R4–R7.                                                                                                                                                        |

## 6. Vorgeschlagene minimale Korrektur (nicht implementiert)

Keine spekulative „Heilung“, keine erfundene Schwelle. Zwei Varianten, beide
benötigen eine Produktentscheidung:

1. **Coverage-Gate im Datenfluss (bevorzugt):** `manifest.count` bzw. ein
   `limited-pilot`-Flag durch `VisualSearchSession` bis `resolvePhotoScan`
   reichen. Bei einem begrenzten Piloten dürfen rein visuelle Treffer nur dann
   in `candidates` gelangen, wenn zusätzlich eine gedruckte Identität
   (Set + vollständige Fraktion + Sprache) bestätigt ist. Andernfalls bleiben
   sie in einem separaten Feld (z. B. `pilotCandidates`) und werden nie als
   `candidates[0]` Hauptprüfkarte.
2. **Separate, klar gekennzeichnete Pilotliste in der UI:** Die neun
   Referenzen bleiben als „Pilot-Referenzen, keine allgemeine Erkennung“
   sichtbar, sind aber nicht der primäre Vorschlag. Das ist eine bewusste
   Abweichung von P08 („image candidate alternatives“) und braucht Freigabe.

Beide Varianten erhalten OCR/Katalog als Fallback und ändern weder Modell noch
Index. Eine Cosinus-Schwelle (absolut oder relativ) ist **erst nach**
kalibrierten, unabhängig gelabelten DE/EN/JA-Daten zulässig; sie darf nicht aus
den neun Pilotkarten abgeleitet werden.

**Reihenfolge:** zuerst Produktentscheidung, dann Test (aus `it.fails` wird ein
normaler Test), dann minimale Änderung in `scan-auto-resolve.ts` und ggf.
`add-cards.ts`.

## 7. Ausgeführte Tests

| Befehl                                                                                                                                                                     | Ergebnis                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                                                                                                                                     | grün                                                                                                                                                |
| `npm run lint`                                                                                                                                                             | grün, 0 Warnungen                                                                                                                                   |
| `npm run test`                                                                                                                                                             | 68 Dateien, **382 passed + 1 expected fail** (der neue P0-Test)                                                                                     |
| `npm run build` (in `npm run check`)                                                                                                                                       | grün, PWA-Validierung grün                                                                                                                          |
| `npx playwright test tests/e2e/live-scan.spec.ts --project=chromium --workers=1`                                                                                           | 4/4 grün                                                                                                                                            |
| `... --project=mobile-chromium --workers=1`                                                                                                                                | 3/4 im Dateilauf; der schwere 24-Foto-Test lief **isoliert** grün. Im Dateilauf `Target crashed` (bekannte 8-GB-Codespace-Grenze, kein App-Fehler). |
| `npx playwright test tests/e2e/live-scan-battle.spec.ts tests/e2e/scan-zero-match-recovery.spec.ts tests/e2e/scanner-live-fallback.spec.ts --project=chromium --workers=1` | 13 passed, 1 skipped (`scanner-live-fallback.spec.ts` ist `test.fixme`)                                                                             |
| Red-Beleg des neuen Tests                                                                                                                                                  | fehlgeschlagen wie dokumentiert, danach als `it.fails` wieder grün                                                                                  |

`npm run check` wurde mit den neuen Dateien ausgeführt. Der bekannte
`Target crashed`-Fehler trat nur unter Speicherdruck auf; nach Freigabe der
MCP-Chromium-Instanzen lief derselbe Test isoliert durch.

## 8. Ausdrücklich nicht geprüft / nicht behoben

- **Kein Browserlauf mit dem echten Pilotmodell.** `public/assets/vision/`
  wird nur in CI erzeugt und darf nicht als 24,4-MB-Binärdatei committet
  werden. Die Messung erfolgte mit denselben Gewichten und demselben
  Packformat außerhalb des Browsers; die Datenfluss-Schicht wurde per
  Node/Vitest geprüft. `tests/e2e/visual-beta.spec.ts` prüft in CI nur
  Opt-in, Manifest, Hash und „kein Besitz“, **nicht** die Kandidatenqualität.
- **Keine echten Kamera-/iPhone-Fotos.** Keine Aussage zu Erkennungsquote,
  Top-1/3/5, Falschtreffern, Latenz oder RAM auf realen Geräten.
- **Keine Supabase-Diagnose.** Keine Migration, kein Zugriff auf
  `beta_diagnostic_events`, keine Auswertung der 92 offenen Spenden.
- **WebKit** wurde nicht ausgeführt.
- **Keine Korrektur implementiert.** Der wiederholte Vorschlag ist reproduziert
  und die Ursache belegt, aber die Produktentscheidung (Pilotliste vs.
  Coverage-Gate) steht aus.
- Keine Änderungen an `public/E-Binder_Brand-Lab_v2.html`, keine
  Modell-/Index-Erweiterung, keine neuen Laufzeitabhängigkeiten.

## 9. Risiken und offene Fragen

1. **Präsentationsentscheidung:** Soll der Pilot bei nicht abgedeckten Karten
   gar keine Kandidaten zeigen, oder eine ausdrücklich getrennte
   „Pilot-Referenzen“-Liste? Beides ändert das in P08 dokumentierte Verhalten.
2. **Schwellenwert:** Ohne unabhängig gelabelte Daten ist keine kalibrierte
   Cosinus-Grenze vertretbar. Ein willkürlicher Wert würde das gemeldete
   Problem nur verschieben.
3. **Abdeckungserwartung:** Solange nur neun DE-Drucke indiziert sind, ist der
   Pilot für DE/EN/JA-Sammlungen strukturell unzureichend. Das ist eine
   Coverage-Aufgabe (P0-B/P0-C), keine Modellverbesserung.
4. **PWA-Cache:** Die versionsgebundenen Dateinamen verhindern eine
   Modell-/Index-Vermischung, aber ein alter Client kann weiterhin die alte
   Kurzliste zeigen, bis der Service Worker aktualisiert. Das ist kein
   Datenfehler, aber ein Support-Thema.
5. **Dokumentationsdrift:** `docs/visual-recognition.md` nannte an einer Stelle
   noch `preprocessing=rgb-0-1-chw-stretch` und „die drei besten“ visuellen
   Ausgaben; beides wurde in diesem Branch an den tatsächlichen Vertrag
   angeglichen (ImageNet-Normalisierung, fünf Ausgaben). Weitere historische
   Aussagen („nicht produktiv aktiviert“ vs. opt-in Pilot) bleiben bewusst
   unverändert, weil sie den Rollout-Stand beschreiben.
