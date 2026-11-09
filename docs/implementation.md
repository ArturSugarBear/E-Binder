# Persönlicher E-Binder: Implementierung und Prüfstand

Aktueller Ergänzungsstand vom 9. November 2026: Supabase-Konten, Cloudspeicher und Freigaben sind implementiert; Set-/Artistbrowser, DE/EN/JA und geprüfte Bildfallbacks sowie die Cyan-Palette ergänzen den lokalen Kern. [Backend und echte Integrationsprüfungen](backend.md), [Collectr/REA](research/collectr.md), [aktuelle Farbrollen](design.md). Die folgenden früheren Modellmessungen bleiben historische Prüfaufzeichnungen; sie belegen weiterhin keine fehlerfreie Erkennung echter Fotos.

Diese Lieferung macht den lokalen Kern aus der Produktreview benutzbar. Sie belegt technische Abläufe; eine bestätigte Collector-Präferenz oder fehlerfreie Kartenerkennung folgt daraus nicht. Die ursprüngliche Review und die Untersuchung unter `research/one-page/` bleiben als Hypothesen und offener Testplan erhalten.

## Umgesetzt

- Persönlicher Bestand mit genauer Ausgabe, Sprache, Variante, ausdrücklicher Gesamtmenge, Lieblingskarte, Notiz und expliziter Tauschmenge. Wunschkarten sind unabhängig vom Besitz.
- Deutscher/englischer TCGdex-Adapter und lokale Inspirationsauswahl; manuelle Erfassung und Ausgabekorrektur. Korrekturen erhalten die Bestands-ID und gültige Reservierungen.
- Mehrere lokale Originalfotos, native Kameraauswahl, SHA-256-Prüfung identischer Fotos, unterbrechbare Erfassungssitzung, echte OCR und notwendige Bestätigung vor Besitzübernahme. Wiederholung erhöht keine Menge automatisch.
- Eigene Binder mit Neun-Pocket-Seiten, freien und geplanten Plätzen, Vorlagen, Mausziehen sowie ausdrücklichem Tauschen/Verschieben. Fixierungen und Mengen sind harte Grenzen. Ein Exemplar kann nicht zwei angenommene Plätze belegen.
- Bis zu drei unterschiedliche Vorschläge mit tatsächlichen Kartenbildern. Drei Fragen: gewünschter Zusammenhang, optionale Pflichtkarte mit Platz und optionale Ausschlüsse/Wiederholungen. Artist-Auswahl ergänzt die erste Frage. Weniger als neun passende eigene Karten ergeben eine Teilseite.
- Getrennte Markierung des selbst durchgeführten physischen Aufbaus. Eine neue Anordnung setzt die Markierung zurück. Das Programm behauptet keinen beobachteten Aufbau.
- IndexedDB mit tatsächlichem Transaktionsstatus, Konflikterkennung zwischen Tabs und zwanzig Rückgängig-Schritten pro Sitzung. Vollständige JSONL-Sicherung einschließlich aller referenzierten Originale. Geprüfte, atomare Wiederherstellung ohne automatische Addition.
- Getrennte Demo, Erhalt der 198 öffentlichen Karten und 22 Kapitel in `archive.html`, Weiterleitung alter Kapitel-Links und die ausdrücklich gewünschte neue dunkle Farbpalette.

## Erkennung als eigener Prüfschritt

Der ausgelieferte Stack verwendet **PaddleOCR PP-OCRv4** über **ONNX Runtime Web 1.31.1** in einem beendbaren Worker. Modell und Wörterbuch aus `@gutenye/ocr-models@1.4.2` sind unter Apache-2.0 mit Herkunft, Größe und Prüfsummen eingecheckt. Die Inferenz benötigt kein zusätzliches Textdetektionsmodell und kein OpenCV. Canvas liefert die schmale Set-/Nummernzeile, eine eigene Nummernregion und einen Titelbereich. Bei unklaren Ergebnissen folgen Graustufen/Kontrast, Inversion, Schwarzweiß und ein weiterer Nummernbereich. Die Originalfotos bleiben unverändert.

Gelesene Nummern und unterstützte Setcodes werden gegen TCGdex geprüft. Aneinander gedruckte Felder wie `HSSPDE234/191` werden als Regulierungszeichen, Set, Sprache und Nummer zerlegt. Unterschiedliche OCR-Nummern bleiben mehrere Kandidaten. Ein fehlgeschlagener Kandidat darf einen anderen gültigen nicht verwerfen. Die übliche Verwechslung `0BF`/`OBF` wird ausschließlich zur Kandidatensuche normalisiert; Besitz entsteht weiterhin nur durch Bestätigung.

Eine Nummer allein bestimmt nicht immer Sprache, Finish oder Druckauflage. Diese Angaben und die Gesamtmenge sind ausdrücklich zu bestätigen. Unsichere Fotos erzeugen keinen Besitz. Der Ablauf ist auch mit manueller Auswahl vollständig nutzbar.

### Beobachteter Modellvergleich

Tesseract.js wurde zuerst mit Ganzbild-OCR, engeren Streifen, Graustufen, globalem/adaptivem Schwarzweiß und Inversion tatsächlich im Browser geprüft. Trasla blieb im ersten Ganzbildversuch ohne Vorschlag. Die Streifenverarbeitung las später Trasla `211/198`, Taubsi `207/197` und Espinodon `210/193` korrekt; Tengulist `163/162` blieb auch nach zusätzlichem Zuschnitt und Inversion ohne brauchbaren Kandidaten. Die Varianten benötigten unter parallel laufenden Tests auf zwei Cloud-CPU-Kernen etwa 24–57 Sekunden pro Bild. Dieser Fehler begründete den Modellwechsel.

Der direkte PaddleOCR-Erkenner las in einem isolierten Modellvergleich Tengulist `163/162` und `TEF DE` sowie Trasla `211/198` korrekt. Die vier reinen Inferenzläufe auf Nummer-/Setzeilen dauerten dort etwa 0,17–0,88 Sekunden; Modellstart, Downloads und Katalogabfrage sind darin nicht enthalten. Die Integration wurde danach durch die tatsächliche Fotooberfläche geprüft:

| Bild                                                       | Gelesene Nummer | Aufgelöste Ausgabe                 |
| ---------------------------------------------------------- | --------------- | ---------------------------------- |
| Trasla, lokales Katalogbild                                | `211/198`       | Trasla, Karmesin & Purpur          |
| Taubsi, lokales Katalogbild                                | `207/197`       | Taubsi, Obsidian Flammen           |
| Espinodon, lokales Katalogbild                             | `210/193`       | Espinodon, Entwicklungen in Paldea |
| Tengulist, Entwicklungstest außerhalb des lokalen Katalogs | `163/162`       | Tengulist, Gewalten der Zeit       |
| Mopex-ex, zusätzlicher externer Test                       | `228/191`       | Mopex-ex, Stürmische Funken        |

Xenias Aufruf wurde zunächst als `234/191` gelesen, aber wegen des anliegenden Regulierungszeichens `H` im Setcode nicht aufgelöst. Diese Beobachtung führte zur Korrektur der Feldzerlegung und zu einem eigenen Regressionstest. Xenia gehört anschließend zum Entwicklungsmaterial. Kronjuwild wurde ebenfalls korrekt gelesen, war aber bereits im lokalen Katalog und zählt deshalb nicht als unabhängiger Test.

### Vorher reservierte, bisher nicht verwendete Karten

Nach der Korrektur wurden zwei konkrete Ausgaben vor dem Test anhand ihrer Katalogmetadaten reserviert und gegen den lokalen Katalog abgeglichen. Ihre Bilder wurden erstmals im fertigen Fotoablauf gelesen, ohne danach die Erkennung an ihnen anzupassen:

| Neue Ausgabe                                                               | Ergebnis im echten Fotoablauf         | Gemessene Gesamtdauer |
| -------------------------------------------------------------------------- | ------------------------------------- | --------------------- |
| [Citros Scharfsinn, sv08-229](https://api.tcgdex.net/v2/de/cards/sv08-229) | `229/191`, `SSP DE`, richtige Ausgabe | 5,41 Sekunden         |
| [Dracena, sv08-231](https://api.tcgdex.net/v2/de/cards/sv08-231)           | `231/191`, `SSP DE`, richtige Ausgabe | 4,56 Sekunden         |

Quelle: die jeweiligen deutschen TCGdex-`high.webp`-Abbildungen. Es wurden keine originalen Sammlerfotos verwendet. In beiden Abläufen blieb der Besitz bei null. Die erste Vorschlagsausgabe entsprach der vorher festgehaltenen Ausgabe; es traten keine JavaScript-Seitenfehler auf. Diese zwei positiven Ergebnisse sind ein begrenzter technischer Check, keine allgemeine Genauigkeitsquote und keine Aussage über Hüllen, Reflexionen, Perspektive oder reale Mobilgeräte.

Die ersten integrierten Entwicklungsbeispiele benötigten einschließlich Workerstart und Katalogabfrage ungefähr 8–14 Sekunden unter parallelen Tests; die beiden späteren reservierten Beispiele etwa fünf Sekunden. Kalter Download und echtes Mobilfunknetz sind gesondert zu messen. `scripts/smoke-recognition.mjs` wiederholt die echte Erkennung getrennt von den deterministischen Tests.

## Gestaltung und Kontrast

Vom Nutzer übernommene Palette: Midnight Black `#02070A`, Electric Blue `#0297DE`, Cantaloupe Orange `#FC734D`. Orange kennzeichnet primäre Aktionen, Blau aktive Navigation und Fokus. Kartenabbildungen bleiben unverändert. Der Designvertrag dokumentiert die gemeinsame Umsetzung für Arbeitsbereich und Archiv.

Gemessene opake sRGB-Paare:

| Paar                                      | Kontrast |
| ----------------------------------------- | -------- |
| Text `#F2F6FA` auf Fläche `#0C151E`       | 16,94:1  |
| Sekundärer Text `#B6C5D1` auf Fläche      | 10,42:1  |
| Hinweise `#92A5B5` auf Fläche             | 7,25:1   |
| Dunkle Schrift `#02070A` auf Orange       | 7,42:1   |
| Dunkle Schrift auf Orange-Hover `#FF916F` | 9,19:1   |
| Electric Blue auf Midnight Black          | 6,25:1   |
| Blauer Fokus auf Fläche                   | 5,68:1   |

Die ersten gerenderten Prüfungen mit axe auf leerer Sammlung, Binder und Vorschlagsdialog fanden keine WCAG-A/AA-Verstöße. Das ist keine vollständige WCAG-Zertifizierung; Farbpaare allein prüfen keine reale Bedienung oder alle Effekte transparenter Flächen.

## Softwareprüfungen

`npm run check` erfolgreich: Formatierung, Lint, 48 Unit-Tests, TypeScript, Validierung der 22 Kapitel und 198 Bilddateien sowie der mehrseitige Produktionsbuild. Die Tests prüfen insbesondere Gesamtmengen statt automatischer Addition, doppelte Erfassung, Reservierungen über Seiten, hohe Exemplarnummern, Fixierungen, Teilseiten, unbekannte Credits, Katalogkorrekturen und fehlende Originalfotos in Backups.

Die erweiterten Playwright-Tests prüfen den echten Vite-HTTP-Server: Hinzufügen, Korrektur, Reload, Rückgängig, getrennte Demo, geplante Vorlagen, Tauschkonflikte, Artist-Teilseite, festgehaltene Pflichtkarte, originale Fotos, vollständigen JSONL-Roundtrip, Tab-Konflikt, OCR-Abbruch, Tastaturfokus, 320-Pixel-Reflow und axe. Die bisherigen Kapitel-, Cardmarket-, Dialog-, Deep-Link- und Touch-Prüfungen bleiben enthalten. Insgesamt wurden 75 unterschiedliche Prüfungen in Desktop- und mobilem Chromium erfolgreich ausgeführt; eine zusätzliche Desktop-Touch-Prüfung ist erwartungsgemäß übersprungen. Zwei zunächst fehlgeschlagene OCR-Abbruchprüfungen wurden nach einer Korrektur am Worker-Start erneut ausgeführt und bestanden.

Der erste GitHub-CI-Lauf führte auch WebKit aus und fand Fehler in der Fotoerfassung sowie einen mobilen Kontrastfehler. Die Veröffentlichung wurde dadurch gestoppt. Nach der Korrektur bestanden alle 30 persönlichen Workflow-Prüfungen lokal in Desktop-Chromium, mobilem Chromium und WebKit, einschließlich echter Modellinferenz ohne Foto-Upload. Die Fotoablage speichert deshalb unveränderte Bytes und MIME-Typ statt dateigebundener Blob-Objekte; bestehende Blob-Datensätze bleiben lesbar. Fotoerfassung, Sicherungs-Roundtrip, Abbruch und echte Modellinferenz wurden danach auch mit WebKit erfolgreich geprüft. Die mobile Kontrastprüfung wartet das Ende der Öffnungsanimation ab, und der kleine Preislabel-Hinweis verwendet eine kontrastreichere Textrolle. Reale iPhones und eine manuelle Screenreader-Prüfung bleiben unabhängig davon ungetestet.

## Was noch nicht belegt ist

Keine Originalfotos, verifizierten privaten Besitzmengen oder Zielcollector-Sitzungen wurden bereitgestellt. Es gibt weiterhin keine beobachteten akzeptierten/abgelehnten Seiten, dokumentierten physischen Aufbau oder spätere Beibehaltung einer vorgeschlagenen Seite. Die drei Fragen sind sparsame, testbare Voreinstellungen; welche ihren Aufwand verdienen, muss der vorbereitete Blindvergleich zeigen.

Die Empfehlung für die erste nutzbare Lieferung lautet daher: bestätigten lokalen Bestand und editierbare Seiten verwenden, Vorschläge als bearbeitbare Ideen behandeln und die Erkennung als Hilfe mit klarer Korrektur anbieten. Künstlergleichheit und ähnliche Farben allein bleiben unzureichende Qualitätsnachweise. Konten, soziale Funktionen, Preise und eine breitere Roadmap sind kein Bestandteil dieses Arbeitsablaufs.
