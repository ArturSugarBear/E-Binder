# OpenCode Prompt — Scanner: DINOv2-Pilot und wiederholte Kandidaten

**Auftrag (verbindlich):**
Lies `docs/plans/2026-11-14-scanner-p0-recovery-implementation.md`. Prüfe zuerst `git status`, `git diff` und bestehende uncommittete Arbeit und bewahre sie. Analysiere ausschließlich Scanner-Datenfluss, DINOv2-Pilotindex mit neun Karten sowie Ursachen wiederholter Kandidatenvorschläge. Dokumentiere reproduzierbare Fehler, arbeite auf einem Feature-Branch, führe Tests aus und erstelle einen Draft-PR. Keine Änderungen direkt auf Master, keine Supabase-Migration, kein Deployment ohne Freigabe.

> Hinweis: Diese Datei ist absichtlich noch nicht committet, damit sie kein
> Deployment auslöst. Lies sie vollständig, bevor du sie stashst. Übernimm sie
> als ersten Commit auf den Feature-Branch, damit der Handoff erhalten bleibt.

## Rolle und Ziel

Du arbeitest als Senior Frontend- und On-Device-CV-Ingenieur in
`/workspaces/E-Binder`. Ziel ist keine neue Scanner-UI und kein neues Modell,
sondern die belastbare Diagnose und minimale Korrektur des bestehenden
Scanner-Datenflusses:

1. Wo entstehen aus Kamera/Upload, OCR, Katalog und DINOv2-Pilot konkrete
   Kandidatenvorschläge?
2. Warum schlägt der Scanner wiederholt dieselben oder irrelevante Kandidaten
   vor, obwohl die Karte nicht exakt belegt ist?
3. Welche Rolle spielt der DINOv2-Pilotindex mit nur neun Referenzkarten, und
   wann wird er trotz fehlender Abdeckung als scheinbar sichere Quelle genutzt?

Arbeitediagnosegetrieben. Keine spekulative „Verbesserung“, kein neuer Index,
keine neuen Abhängigkeiten, keine UI-/Motion-Arbeit.

## Harte Leitplanken

- **Keine Änderungen direkt auf `master`.** Erstelle zuerst einen
  Feature-Branch von `origin/master`.
- **Keine Supabase-Migration**, keine Schema-, RLS- oder Datenänderungen.
- **Kein Deployment, kein Merge, kein Promote** ohne ausdrückliche Freigabe.
- **Bestehende uncommittete Arbeit bewahren.** Nichts löschen, nichts
  überschreiben, nichts mit `git add -A` einsammeln.
- **Keine erfundenen Genauigkeiten, Confidence-Werte oder Nutzerstudien.**
- **Keine Fotos** aus dem privaten Bestand in das Repository, in Supabase oder
  in öffentliche Logs schreiben.
- **Kein automatischer Besitz.** Ein visueller Treffer ist ein Kandidat, kein
  bestätigter Bestand.
- **Scope eng halten:** nur Scanner-Datenfluss, DINOv2-Pilot mit neun Karten und
  wiederholte Kandidatenvorschläge.

## Schritt 0 — Arbeitsstand prüfen und sichern

Führe zuerst aus und dokumentiere die Ausgabe:

```bash
git status --short
git diff
git diff --stat
git diff --cached
git stash list
git ls-files --others --exclude-standard
git log --oneline -5
```

Wenn es uncommittete Änderungen gibt:

- Sie gehören wahrscheinlich dem Repository-Inhaber. Nicht verwerfen.
- Sichere sie sichtbar, z. B. mit einem WIP-Commit auf einem eigenen Branch
  oder mit `git stash push -u -m "WIP vor Scanner-Diagnose"`.
- Dokumentiere im Report, was gesichert wurde und wie es wiederhergestellt
  werden kann.
- Frage nach, bevor du fremde Änderungen in deinen Branch übernimmst.

Dann:

```bash
git fetch origin
git switch -c fix/scanner-dinov2-candidates origin/master
```

Falls der Branch bereits existiert, wähle einen eindeutigen Namen und notiere
ihn. Arbeite nicht auf `master`.

## Schritt 1 — Plan und Scanner-Dokumentation lesen

Lies zuerst:

1. `docs/plans/2026-11-14-scanner-p0-recovery-implementation.md`
2. `docs/scanner.md`
3. `docs/scanner-quality.md`
4. `docs/visual-recognition.md`
5. `docs/p08-visual-retrieval.md`
6. `docs/beta-diagnostics.md`
7. `AGENTS.md` und `PRODUCT.md`

Nutze zusätzlich den Skill `e-binder-scanner`. Lade keine Design-/Motion-Skills
für diese Aufgabe.

## Schritt 2 — Scanner-Datenfluss vollständig kartieren

Erstelle im Report eine nachvollziehbare Kette vom Eingang bis zur Bestätigung.
Mindestens diese Dateien und ihre Verantwortlichkeiten prüfen:

- `src/ui/live-scan.ts` — Live-Kamera, Ecken, Capture-Latch, Queue, Review.
- `src/ui/live-page-scan.ts` — Binderseiten-Kamera.
- `src/ui/page-scan.ts` — Seitenzuschnitt, 3×3-Prüfung, Import.
- `src/ui/add-cards.ts` — Add-Dialog, Datei-/Kamera-Inputs,
  `openLiveScannerFlow`, OCR/Katalog/Review.
- `src/data/recognize.ts` — PaddleOCR-Worker, Sprachmodell, Timeout.
- `src/data/vision-worker.ts` — lokaler OCR-Worker.
- `src/data/visual-search.ts` — optionaler visueller Suchpfad/Manifest.
- `src/data/visual-worker.ts` — visueller Worker.
- `src/data/scan-visual-shortlist.ts` — Validierung visueller Treffer.
- `src/data/scan-auto-resolve.ts` — OCR-/Nummern-/Katalogauflösung.
- `src/data/scan-evidence-fusion.ts` — Fusion aus OCR, Katalog und Vision.
- `src/domain/visual-retrieval.ts` — Top-K und Kandidatenlogik.
- `src/domain/live-ocr-policy.ts` — Hot Zones, Budget, Retry-Reihenfolge.
- `src/domain/scan-session-guardrails.ts` — Queue-Limit und Zustände.
- `src/data/visual-beta.ts` — expliziter Opt-in und neun Referenzen.

Für jede Stufe dokumentieren:

- Eingabe und Ausgabe,
- Timeout und Abbruchpfad,
- Cache-/Service-Worker-Verhalten,
- Feature-Flag und Standardzustand,
- Fehlerzustand (kein Text, kein Treffer, offline, Modell fehlt),
- ob daraus ein sichtbarer Kandidat oder nur ein Hinweis wird.

Markiere jede Stelle, an der ein visueller Nähe-Treffer ohne exakte
Set-/Nummern-/Sprachbestätigung als Kandidat sichtbar werden kann.

## Schritt 3 — DINOv2-Pilotindex mit neun Karten analysieren

Beantworte mit Datei- und Zeilenbelegen:

1. Wo liegen Modell, Manifest, Index und Version/Hash-Prüfung?
2. Wie viele Referenzen sind tatsächlich enthalten, und welche Sprachen/Sets
   decken sie ab?
3. Wann wird der Pilot aktiviert? Nur über `visualBetaEnabled()`, über einen
   Default, über einen Cache oder über einen stillen Fallback?
4. Was passiert bei fehlendem, veraltetem oder nicht zusammenpassendem
   Modell/Index? Bleibt OCR funktionsfähig?
5. Wie werden Top-K-Nachbarn zu echten Printings aufgelöst? Welche Prüfungen
   erzwingt `scan-visual-shortlist.ts`?
6. Kann ein Nearest Neighbor aus den neun Karten als „Vorschlag“ erscheinen,
   obwohl die fotografierte Karte nicht im Index ist?
7. Wird die begrenzte Abdeckung für Nutzer sichtbar erklärt, oder wirkt der
   Pilot wie allgemeine Erkennung?

Wichtig: Der Pilot ist ein begrenzter, opt-in Test mit neun verifizierten
Referenzen. Seine Existenz ist kein Beweis für allgemeine Erkennungsqualität.

## Schritt 4 — Wiederholte Kandidatenvorschläge reproduzieren

Prüfe die folgenden Hypothesen, aber setze keine davon ungeprüft voraus:

- Forced Nearest Neighbor aus dem neun Karten umfassenden Pilotindex bei
  fehlender Abdeckung.
- Veralteter Service-Worker-, Manifest- oder Index-Cache.
- Default-/Fallback-Karte oder ein einmalig gesetzter Kandidatenzustand.
- Zustands-Leak zwischen Aufnahmen, Sitzungen oder Review-Schritten.
- Gleiches Artwork, gleiche Sprache, Reprints oder fehlende Druckvariante.
- Ranking ignoriert exakte Nummer, Fraktion, Sprache oder Set.
- OCR liefert keinen Text, visuelle Kandidaten werden trotzdem gezeigt.
- Doppelte Aufnahmen werden nicht als Duplikat erkannt.
- Modell-/Index-Version passt nicht zusammen, wird aber nicht verworfen.
- Der Pilot ist aktiviert, ohne dass die begrenzte Abdeckung gekennzeichnet ist.

Reproduziere mit den vorhandenen Mitteln:

- `public/assets/cards/*.webp` als lokale Kartenfixtures.
- Die deterministische Canvas-`MediaStream`-Kamera aus
  `tests/e2e/live-scan-battle.spec.ts`.
- Playwright MCP (`playwright-mobile`) für mobile Bedienung.
- Chrome DevTools MCP für Console, Network, Emulation und Performance-Spuren.
- `getUserMedia`-Mock für Kamera-verweigert/fehlt.
- Datei-Upload für den Foto-Fallback.

Für jeden reproduzierbaren Fehler eine Zeile in einer Tabelle:

| Feld          | Inhalt                       |
| ------------- | ---------------------------- |
| Build/SHA     | exakter Commit               |
| Browser/Gerät | z. B. iPhone 13 Emulation    |
| Feature-Flag  | DINOv2-Pilot an/aus          |
| Fixture       | Karten-ID/Datei              |
| Schritte      | minimaler Ablauf             |
| Erwartet      | korrektes Verhalten          |
| Tatsächlich   | beobachtetes Verhalten       |
| OCR-Text      | falls verfügbar              |
| Kandidaten    | IDs/Rangfolge                |
| Evidenz       | Screenshot/Trace/Console     |
| Ursache       | Datei:Zeile, nur wenn belegt |

Keine privaten Fotos, keine personenbezogenen Daten und keine Zugangsdaten in
den Report aufnehmen.

## Schritt 5 — Root Cause und minimale Korrektur

Wenn ein Fehler reproduzierbar und die Ursache belegt ist:

1. Schreibe zuerst einen fehlschlagenden Unit- oder E2E-Test, der genau diesen
   Fehler festhält.
2. Behebe nur die Ursache im Scanner-Datenfluss.
3. Kein neues Modell, kein neuer Index, keine neue Abhängigkeit, keine
   UI-Umgestaltung.
4. Bestehende Unsicherheit bleibt sichtbar: Kandidat bleibt Kandidat, keine
   automatische Besitzübernahme, keine erfundene Confidence.

Wenn keine sichere Korrektur möglich ist, liefere einen Diagnose-Draft-PR mit
reproduzierbaren Fehlern, Ursachen und einem konkreten, aber nicht
implementierten Vorschlag. Keine riskante „Heilung“ auf Verdacht.

## Schritt 6 — Tests

Mindestens ausführen:

```bash
npm run check
npx playwright test tests/e2e/live-scan.spec.ts --project=chromium --project=mobile-chromium
npx playwright test tests/e2e/live-scan-battle.spec.ts --project=chromium
npx playwright test tests/e2e/scan-zero-match-recovery.spec.ts --project=chromium
npx playwright test tests/e2e/scanner-live-fallback.spec.ts --project=chromium
```

Hinweise:

- `tests/e2e/scanner-live-fallback.spec.ts` ist derzeit `test.fixme` und gehört
  zu einem separaten Fallback-Bug. Nur anfassen, wenn er für die Reproduktion
  wirklich relevant ist; Scope nicht vermischen.
- `live-scan-battle.spec.ts` beweist Kamera-/Queue-Lifecycle, nicht
  Erkennungsgenauigkeit.
- Der Codespace hat ca. 8 GB RAM. Wenn Chromium mit `Target crashed` abbricht,
  zuerst überzählige Headless-Chrome-Instanzen/MCP-Seiten schließen und den
  Test sauber wiederholen.
- Neue Tests müssen vor dem Fix rot und danach grün sein. Das im Report
  belegen.

## Schritt 7 — Report und Draft-PR

Erstelle `docs/reviews/YYYY-MM-DD-scanner-dinov2-diagnosis.md` mit:

- Auftrag und Scope,
- geprüftem Build/SHA und Testumgebung,
- Datenflusskarte,
- DINOv2-Pilot-Befund (neun Referenzen, Abdeckung, Aktivierung),
- Reproduktionstabelle,
- Root Causes mit Datei:Zeile,
- minimaler Korrektur und Testbelegen,
- ausdrücklich ungeprüften Punkten,
- Risiken und offenen Fragen.

Dann:

```bash
git status --short
git diff --stat
```

Nur Scanner-Dateien, Tests und den Report stagen. Kein `git add -A`.

Commit auf dem Feature-Branch, dann Draft-PR:

```bash
gh pr create --draft --base master --head fix/scanner-dinov2-candidates \
  --title "fix(scanner): diagnose DINOv2 pilot candidate repetition" \
  --body-file docs/reviews/YYYY-MM-DD-scanner-dinov2-diagnosis.md
```

Kein Merge, kein Deployment, keine Supabase-Migration. Der PR bleibt Draft, bis
der Inhaber ausdrücklich freigibt.

## Akzeptanzkriterien

- Mindestens ein reproduzierbarer Fehler ist mit exakten Schritten, Build/SHA
  und Evidenz dokumentiert.
- Die Ursache ist mit Datei:Zeile belegt, nicht nur vermutet.
- Der DINOv2-Pilot mit neun Karten ist in seiner Abdeckung, Aktivierung und
  Fallback-Wirkung erklärt.
- Es gibt einen fehlschlagenden Regressionstest und, falls sicher, eine
  minimale Korrektur mit grünem Test.
- `npm run check` und die relevanten Scanner-Specs sind ausgeführt; Ergebnisse
  stehen im Report.
- Keine Änderung auf `master`, keine Supabase-Migration, kein Deployment.
- Ein Draft-PR existiert; er ist nicht gemerged und nicht deployed.
- Keine erfundenen Genauigkeiten, keine privaten Fotos, kein automatischer
  Besitz.

## Nicht ändern

- UI, Layout, Marke, Motion, Farbsystem.
- `public/E-Binder_Brand-Lab_v2.html`.
- Datenschutz-/Datenmodell, Bestätigungsgates, 16-px-Inputs,
  Reduced-Motion, 44-px-Touchziele.
- Exakte 3×3-Taschengeometrie, No-Framework-Entscheidung.
- Modellumfang, Indexumfang, neue Abhängigkeiten.
- Supabase-Schema, RLS, Migrationen, Deployment.

## Abschluss

Berichte am Ende:

- Branch und Commit,
- Draft-PR-URL,
- welche Fehler reproduziert wurden,
- welche Ursache belegt ist,
- welche Tests rot/grün sind,
- was ausdrücklich nicht geprüft oder nicht behoben wurde.

Keine Behauptung, der Scanner sei „fertig“ oder „rock solid“, solange keine
unabhängige, reproduzierbare Evidenz dafür vorliegt.
