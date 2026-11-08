# E-Binder

Deine Pokémon-Karten, dein Bestand und deine eigenen Neun-Pocket-Seiten. Mit Fotoerfassung, lokaler Texterkennung, Artist- und Seitenideen, Wunschkarten und exportierbaren Sicherungen.

Die Anwendung speichert persönliche Daten **in IndexedDB auf diesem Gerät**. Sie überträgt keine Sammlungen oder Fotos an einen Server. Die Demo hat einen getrennten Bestand. Die bisherigen 198 Karten und 22 Themenkapitel bleiben als Inspirationsarchiv erhalten.

## Benutzen

1. **Karten hinzufügen:** Eine genaue Ausgabe suchen oder ein eigenes Foto aufnehmen/importieren. Die Suche nach Name oder Sammlernummer verwendet den deutschen oder englischen [TCGdex-Katalog](https://tcgdex.dev/); eine manuelle Erfassung ist ebenfalls möglich.
2. **Bestätigen:** Set, Sammlernummer, Sprache, Druckvariante und die gesamte vorhandene Menge prüfen. Ein wiederholtes Foto oder eine zweite Bestätigung erhöht die Menge nicht automatisch.
3. **Binder gestalten:** Eigene Binder und Seiten anlegen, Plätze belegen, tauschen, leeren oder festhalten. Vorlagen übernehmen; fehlende Karten bleiben geplant und erzeugen keinen Besitz.
4. **Seiten vorschlagen:** Höchstens drei Geschmacksfragen zu Zusammenhang, Pflichtkarte und Ausschlüssen. Vorschläge verwenden tatsächliche Bilder und verfügbare Exemplare. Ein Artist-Fokus füllt bei zu wenigen passenden Karten keine anderen Illustratoren auf.
5. **Sichern:** JSONL herunterladen, einschließlich Originalfotos, offener Erfassungen und Binderplätzen. Wiederherstellung zuerst prüfen und dann ausdrücklich übernehmen.

Ein Exemplar belegt höchstens einen angenommenen Binderplatz. Ein Entwurf reserviert Exemplare; der tatsächliche Aufbau wird gesondert vom Nutzer markiert. Besitz, Wünsche und explizite Tauschmengen sind unabhängig.

## Fotoerkennung

Die Erkennung verwendet das Open-Source-Modell **PaddleOCR PP-OCRv4** mit **ONNX Runtime Web 1.31.1** lokal in einem beendbaren Worker. Der kleine Stack benötigt ein Erkennungsmodell und gezielte Canvas-Ausschnitte; ein zusätzliches Objekterkennungsmodell und OpenCV werden nicht geladen. Nummer und Setcode werden zuerst im Original gelesen. Bei Unklarheit folgen Graustufen/Kontrast, Inversion und Schwarzweiß sowie ein weiterer Nummernbereich. Der Kartenname dient zur Gegenprüfung. Gelesene Kennungen werden mit TCGdex abgeglichen. Sprache, Druckvariante und Gesamtmenge bleiben ausdrücklich zu bestätigen.

Das Modell und Wörterbuch stammen aus `@gutenye/ocr-models@1.4.2` und stehen unter Apache-2.0. [Herkunft, Dateigrößen und SHA-256](public/assets/ocr/model-source.json) und [Lizenz](public/assets/ocr/LICENSE-PaddleOCR.txt) liegen neben den Dateien. Das Modell umfasst rund 11 MB; beim ersten Start wird zusätzlich die WebAssembly-Laufzeit geladen. Diese Dateien sind kein Bestandteil der privaten Sammlungsdaten.

Fotografiere eine Karte aufrecht und möglichst bildfüllend, mit scharfem unteren Rand. Erstmalig werden Worker, Wasm und das Erkennungsmodell geladen. Fotos werden dafür nicht hochgeladen. Originale bleiben unverändert. Die Sitzung lässt sich unterbrechen und später fortsetzen.

Das ist eine überprüfbare Erkennungshilfe mit Bestätigung, keine Zusage fehlerfreier Identifikation. Alte Sets mit Symbolen, verdeckte Ränder, spiegelnde Hüllen, Perspektive und Druckvarianten können zusätzliche Klärung verlangen. Unklare Fotos bleiben erhalten. Ergebnisse kleiner Prüfungen mit Katalogbildern ersetzen keine Prüfung mit realen Sammlerfotos. Die Online-Suche zeigt bis zu 48 Treffer je Abfrage; engere Namen oder genaue Nummern helfen bei großen Treffermengen.

## Entwickeln

Node.js 24 (siehe `.nvmrc`):

```sh
npm ci
npm run dev
```

Den ausgegebenen Link mit `/E-Binder/` öffnen. `/E-Binder/archive.html` enthält das Inspirationsarchiv. Alte `#kapitel-N`- und `#greninja`-Links werden dorthin weitergeleitet. Die App benötigt keine API-Schlüssel.

```sh
npm run check
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

`check` prüft Formatierung, Lint, Unit-Tests, Daten, Bilddateien und TypeScript und baut `dist/`. Browser-Tests verwenden den echten Vite-HTTP-Server und prüfen Desktop-Chromium, mobiles Chromium und mobiles WebKit. Ein vorhandenes Chromium lässt sich mit `PLAYWRIGHT_CHROMIUM_EXECUTABLE` verwenden. Wenn WebKit-Systembibliotheken fehlen, ist das kein abgeschlossener Safari-Test.

Eine optionale echte OCR-Prüfung gegen die laufende Vorschau:

```sh
node scripts/smoke-recognition.mjs
# alternativ eigene, aufrechte Testbilder als Argumente übergeben
```

Diese Prüfung lädt echte OCR-Modelle und nutzt den externen Katalog. Ihre Ergebnisse sind getrennt von den deterministischen Unit- und Browser-Tests zu bewerten.

## Aufbau

| Pfad                                        | Verantwortung                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `src/main.ts`, `src/ui/workspace.ts`        | persönlicher Arbeitsbereich und Speicherstatus                             |
| `src/domain/personal.ts`                    | Ausgaben, bestätigte Mengen, Exemplare und Reservierungen                  |
| `src/domain/recommend.ts`                   | einfache erklärbare Anordnungsregeln                                       |
| `src/data/personal-store.ts`                | IndexedDB, Konfliktprüfung und JSONL-Sicherung                             |
| `src/data/card-catalog.ts`                  | TCGdex-Adapter, Illustrator-Provenienz und OCR-Kandidaten                  |
| `src/data/recognize.ts`, `vision-worker.ts` | lokale OCR und Bildvorverarbeitung                                         |
| `src/ui/`                                   | Sammlung, Fotoerfassung, Binder, Vorschläge, Wünsche und Wiederherstellung |
| `src/archive-main.ts`, `src/app.ts`         | bestehendes Inspirationsarchiv                                             |
| `src/styles.css`, `src/workspace.css`       | gemeinsame dunkle Farbrollen und Oberflächen                               |
| `public/collection.json`, `public/assets/`  | öffentliche Vorlagen, Kartenbilder und lokale Schriften                    |
| `.github/workflows/pages.yml`               | Prüfungen und Veröffentlichung nach bestandenem Build                      |

[Implementierung und Prüfgrenzen](docs/implementation.md) · [Architektur](docs/architecture.md) · [Designvertrag](docs/design.md) · [Deployment](docs/deployment.md) · [Untersuchung des einzelnen Seitenworkflows](docs/research/one-page/README.md)

## Speicherung und Grenzen

Browserdaten können gelöscht werden. Exportiere vor Gerätewechsel oder Browserbereinigung eine Sicherung. Andere Geräte erhalten den Bestand ausschließlich durch eine bewusst importierte Sicherung; Konten und Synchronisation sind nicht implementiert. Konkurrierende Tabs werden anhand der gespeicherten Revision erkannt, statt Änderungen stillschweigend zu überschreiben. Rückgängig steht für die letzten 20 Bearbeitungen der geöffneten Sitzung zur Verfügung.

Der Online-Katalog ist ein externer Dienst. Fehlende Metadaten bleiben unbekannt. Neun geprüfte Illustrator-Credits sind im Forschungsbericht mit Publisher-Quellen belegt; weitere Artist-Angaben tragen ihre Katalog- oder manuelle Provenienz. Eine gemeinsame Illustration oder Farbe ist kein Beleg dafür, dass einem Sammler eine Seite gefällt.

## Rechte und Preise

Kartenabbildungen und Pokémon-Marken gehören den jeweiligen Rechteinhabern. TCGdex und einzelne Bilder der Pokémon TCG API liefern öffentliche Katalogabbildungen. Die Code-Lizenz überträgt keine Rechte an Bildern oder Marken. Schriftlizenzen liegen bei den lokalen Schriftdateien.

Das Inspirationsarchiv enthält datierte Preisbeobachtungen aus der ursprünglichen Vorlage und Cardmarket, keine Live-Preise und keinen persönlichen Sammlungswert. Der neue Bestandsworkflow berechnet daraus keinen Wert.
