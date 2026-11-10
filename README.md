# E-Binder

Deine Pokémon-Karten, dein Bestand und deine eigenen Neun-Pocket-Seiten. Mit Fotoerfassung, lokaler Texterkennung, Artist- und Seitenideen, Wunschkarten und exportierbaren Sicherungen.

Ohne Anmeldung bleiben persönliche Daten **in IndexedDB auf diesem Gerät**. Mit Nutzername und Passwort sichert Supabase Sammlung und Binder als reine Metadaten privat und stellt sie auf anderen Geräten bereit. OCR läuft immer lokal. Offizielle Kartenbilder werden nicht in Supabase Storage kopiert. Die Demo hat einen getrennten Bestand. Die bisherigen 198 Karten und 22 Themenkapitel bleiben als Inspirationsarchiv erhalten.

## Benutzen

1. **Karten entdecken:** Im eigenen Bereich „Entdecken“ Sets mit Logos durchstöbern, nach Kartenreihen eingrenzen oder nach deutschen und englischen Setnamen suchen. Deutsch, Englisch und Japanisch sind wählbar. Set, Illustrator, Seltenheit, Nummer und Sortierung lassen sich kombinieren; Katalogfilter und Trefferseite bleiben im Link erhalten. Eine Karte kann vorgemerkt oder nach Prüfung in den Bestand übernommen werden.
2. **Karten hinzufügen:** Eine genaue Ausgabe suchen oder ein eigenes Foto aufnehmen/importieren. Die Suche nach Name oder Sammlernummer verwendet den deutschen, englischen oder japanischen [TCGdex-Katalog](https://tcgdex.dev/); eine manuelle Erfassung ist ebenfalls möglich.
3. **Bestätigen:** Set, Sammlernummer, Sprache, Druckvariante und die gesamte vorhandene Menge prüfen. Ein wiederholtes Foto oder eine zweite Bestätigung erhöht die Menge nicht automatisch.
4. **Binder gestalten:** Eigene Binder und Seiten anlegen, Plätze belegen, tauschen, leeren oder festhalten. Vorlagen übernehmen; fehlende Karten bleiben geplant und erzeugen keinen Besitz.
5. **Seiten vorschlagen:** Höchstens drei Geschmacksfragen zu Zusammenhang, Pflichtkarte und Ausschlüssen. Vorschläge verwenden tatsächliche Bilder und verfügbare Exemplare. Ein Artist-Fokus füllt bei zu wenigen passenden Karten keine anderen Illustratoren auf.
6. **Konto und Teilen:** Über „Anmelden“ ein Konto anlegen. Ein vorhandener lokaler Bestand bleibt getrennt und lässt sich im Konto bewusst übernehmen. Einzelne Binder über „Binder teilen“ freigeben und wieder privat stellen.
7. **Sichern:** JSONL herunterladen, mit offenen Erkennungsergebnissen und Binderplätzen, ohne Fotos. Wiederherstellung zuerst prüfen und dann ausdrücklich übernehmen.

Ein Exemplar belegt höchstens einen angenommenen Binderplatz. Ein Entwurf reserviert Exemplare; der tatsächliche Aufbau wird gesondert vom Nutzer markiert. Besitz, Wünsche und explizite Tauschmengen sind unabhängig.

## Fotoerkennung

Die Erkennung verwendet das Open-Source-Modell **PaddleOCR PP-OCRv4** mit **ONNX Runtime Web 1.31.1** lokal in einem beendbaren Worker. Der kleine Stack benötigt ein Erkennungsmodell und gezielte Canvas-Ausschnitte; ein zusätzliches Objekterkennungsmodell und OpenCV werden nicht geladen. Nach der Aufnahme die vier Kartenecken ausrichten und bei Bedarf drehen. Eine temporär entzerrte Kopie liefert Nummer und Setcode. Bei Unklarheit folgen Graustufen/Kontrast, Inversion und Schwarzweiß sowie ein weiterer Nummernbereich. Der Kartenname dient zur Gegenprüfung. Gelesene Kennungen werden mit TCGdex abgeglichen. Sprache, Druckvariante und Gesamtmenge bleiben ausdrücklich zu bestätigen.

Das Modell und Wörterbuch stammen aus `@gutenye/ocr-models@1.4.2` und stehen unter Apache-2.0. [Herkunft, Dateigrößen und SHA-256](public/assets/ocr/model-source.json) und [Lizenz](public/assets/ocr/LICENSE-PaddleOCR.txt) liegen neben den Dateien. Das Modell umfasst rund 11 MB; beim ersten Start wird zusätzlich die WebAssembly-Laufzeit geladen. Diese Dateien sind kein Bestandteil der privaten Sammlungsdaten.

Fotografiere eine Karte aufrecht und möglichst bildfüllend, mit scharfem unteren Rand. Erstmalig werden Worker, Wasm und das Erkennungsmodell geladen. Fotos werden weder hochgeladen noch dauerhaft gespeichert. Sie bleiben nur während der geöffneten Erkennung im Arbeitsspeicher und werden danach verworfen. Die Sitzung lässt sich unterbrechen und später fortsetzen.

Das ist eine überprüfbare Erkennungshilfe mit Bestätigung, keine Zusage fehlerfreier Identifikation. Alte Sets mit Symbolen, verdeckte Ränder, spiegelnde Hüllen, Perspektive und Druckvarianten können zusätzliche Klärung verlangen. Unklare Erkennungsergebnisse bleiben als Metadaten offen; für einen erneuten OCR-Lauf ist nach dem Schließen eine neue Aufnahme nötig. Ergebnisse kleiner Prüfungen mit Katalogbildern ersetzen keine Prüfung mit realen Sammlerfotos. Der Katalog hat Setlogos, Set-/Illustrator-/Seltenheitsfilter und weitere Trefferseiten. EUR-Preisvergleich ist innerhalb eines gewählten Sets möglich, soweit Preisbeobachtungen vorliegen. Geprüfte EN-Bildfallbacks für bildlose DE-Ausgaben sind mit „Bild: EN“ gekennzeichnet; fehlende Bilder bleiben ausdrücklich erkennbar. Digitale Pokémon-TCG-Pocket-Sets gehören nicht zum physischen Binder-Katalog.

## Entwickeln

Node.js 24 (siehe `.nvmrc`):

```sh
npm ci
npm run dev
```

Den ausgegebenen Link mit `/E-Binder/` öffnen. `/E-Binder/archive.html` enthält das Inspirationsarchiv. Alte `#kapitel-N`- und `#greninja`-Links werden dorthin weitergeleitet. Für den öffentlichen Katalog ist kein API-Schlüssel erforderlich. `cloud.config.json` enthält ausschließlich die öffentliche Supabase-Clientkonfiguration dieses Deployments. Für einen eigenen Fork `.env.example` übernehmen und ein eigenes Projekt konfigurieren; niemals einen Secret-/Service-Role-Key im Frontend verwenden. Einrichtung: [Supabase](docs/backend.md).

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

[Backend, Anmeldung und RLS](docs/backend.md) · [Implementierung und Prüfgrenzen](docs/implementation.md) · [Architektur](docs/architecture.md) · [Designvertrag](docs/design.md) · [Deployment](docs/deployment.md) · [Untersuchung des einzelnen Seitenworkflows](docs/research/one-page/README.md)

## Speicherung und Grenzen

Browserdaten können gelöscht werden. Exportiere vor Gerätewechsel oder Browserbereinigung eine Sicherung. Konten synchronisieren über Supabase. Gastbestand und Kontencaches sind getrennt. Bei konkurrierenden Geräten verhindert eine serverseitige Versionsprüfung das stille Überschreiben. Nicht synchronisierte Änderungen bleiben lokal exportierbar; ein neuer Cloudstand wird erst nach bewusster Auswahl geladen. Konkurrierende Tabs werden anhand der gespeicherten Revision erkannt, statt Änderungen stillschweigend zu überschreiben. Rückgängig steht für die letzten 20 Bearbeitungen der geöffneten Sitzung zur Verfügung.

Der Online-Katalog ist ein externer Dienst. Fehlende Metadaten bleiben unbekannt. Neun geprüfte Illustrator-Credits sind im Forschungsbericht mit Publisher-Quellen belegt; weitere Artist-Angaben tragen ihre Katalog- oder manuelle Provenienz. Eine gemeinsame Illustration oder Farbe ist kein Beleg dafür, dass einem Sammler eine Seite gefällt.

## Rechte und Preise

Kartenabbildungen und Pokémon-Marken gehören den jeweiligen Rechteinhabern. TCGdex und einzelne Bilder der Pokémon TCG API liefern öffentliche Katalogabbildungen. Die Code-Lizenz überträgt keine Rechte an Bildern oder Marken. Schriftlizenzen liegen bei den lokalen Schriftdateien.

Das Inspirationsarchiv enthält datierte Preisbeobachtungen aus der ursprünglichen Vorlage und Cardmarket, keine Live-Preise und keinen persönlichen Sammlungswert. Der neue Bestandsworkflow berechnet daraus keinen Wert.

## Binderseitenscanner (9-Pocket)

In **Binder → Binderseite scannen** oder **+ Karte → Ganze Binderseite scannen** können mehrere physische 3×3-Binderseiten nacheinander aufgenommen werden. Die vier Seiten-Ecken werden zuerst ausgerichtet, danach entstehen neun lokale JPEG-Ausschnitte. PaddleOCR wird in einem wiederverwendbaren Worker pro Seite einmal geladen; TCGdex liefert optionale Kartenvorschläge, und jede Position kann separat gesucht, übersprungen oder als leer markiert werden. Druckvarianten und alle neun Positionen müssen ausdrücklich bestätigt werden. Erst danach wird die Seite **mit ihren physikalischen Kartenplätzen atomar** gespeichert. Fotos und OCR-Bilddaten werden nicht persistiert oder an Supabase übertragen.

Gleiche Fotodateien werden über SHA-256 nicht zweimal übernommen. Eine neu fotografierte Aufnahme derselben physischen Seite kann einen anderen Fingerabdruck haben – bitte vor dem Import prüfen. Bereits vorhandene, nicht platzierte Exemplare werden zuerst verwendet; es wird nur dann eine zusätzliche Menge erfasst, wenn kein freies Exemplar vorhanden ist. Noch nicht erkannte Karten können leer gelassen und später ergänzt werden. Bei einer unleserlichen Seite bleibt die manuelle Kartenauswahl möglich.

**Grenzen:** Die 3×3-Geometrie verlangt eine ausgerichtete Seite; automatisch gefundene Ecken, sichere Holo-Unterscheidung, unkontrollierte Perspektiven und vollständig automatische Zuordnung sind nicht zugesichert. Für echte Foto-Qualitätstests eigene oder nachweislich freigegebene Aufnahmen verwenden; keine fremden Verkaufsbilder ins Repository kopieren. Siehe [Scanner-Qualität und Testprotokoll](docs/scanner.md).

### Fotoqualität und realistische Tests

Der Seitenscanner zeigt jetzt neun nummerierte Taschen schon in der Ausrichtungsvorschau und danach **lokale Hinweise zu möglichen Foto-Problemen** (Dunkelheit, helle Reflexionen, niedriger Kontrast und geringe Bilddetails). Sie sind keine OCR-Wahrscheinlichkeiten und überschreiben keine Bestandsdaten. Für reproduzierbare Messungen mit **eigenen oder ausdrücklich nutzbaren realen Fotos** siehe [Scanner-Fotoqualität und Benchmark](docs/scanner-quality.md). Hierfür wird kein externer AI-Dienst benötigt.
