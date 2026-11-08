# Persönlicher E-Binder: Implementierung und Prüfstand

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

Der kleine Open-Source-Stack besteht aus Tesseract.js 6.0.1, seinem LSTM-Modell in WebAssembly und eigener Canvas-Vorverarbeitung. Es läuft kein Bildklassifikator, der nur auf die 198 Vorlagen trainiert ist. Die Pipeline liest Set-/Nummernzeile, prüft mehrere Darstellungen und ergänzt den Kartenname. Gedruckte Set-Abkürzungen können den TCGdex-Abruf eingrenzen; Nummer und Nenner werden anschließend gegen die Antwort geprüft. Unterschiedliche OCR-Nummern bleiben mehrere Kandidaten. Ein fehlgeschlagener Kandidat darf einen anderen gültigen nicht verwerfen.

Eine Nummer allein bestimmt nicht immer Sprache, Finish oder Druckauflage. Diese Angaben und die Gesamtmenge sind ausdrücklich zu bestätigen. Unsichere Fotos erzeugen keinen Besitz. Der Ablauf ist auch mit manueller Auswahl vollständig nutzbar.

Tatsächlich ausgeführte erste Prüfung im Chromium-Browser, ausschließlich mit öffentlichen digitalen Kartenbildern:

| Bild                                            | Gelesene Nummer         | Beobachtetes Ergebnis                                              |
| ----------------------------------------------- | ----------------------- | ------------------------------------------------------------------ |
| Trasla, `svi-211`                               | `211/198`               | richtige Ausgabe als Vorschlag, kein Besitz erzeugt                |
| Taubsi, `obf-207`                               | `207/197`               | richtige Ausgabe als Vorschlag, kein Besitz erzeugt                |
| Espinodon, `pal-210`                            | `210/193`               | richtige Ausgabe als Vorschlag, kein Besitz erzeugt                |
| Tengulist, `sv05-163`, nicht im lokalen Katalog | keine brauchbare Nummer | keine eindeutige Karte; Foto bleibt zur manuellen Klärung erhalten |

Quelle der zusätzlichen Karte: [TCGdex sv05-163](https://api.tcgdex.net/v2/de/cards/sv05-163), zugehöriges deutsches `high.webp`. Die ersten drei Bilder liegen bereits öffentlich im Repository. Im ersten Ganzbild-OCR-Versuch blieb selbst Trasla ohne Kandidat; die Streifenverarbeitung verbessert diesen Fall nachvollziehbar. Die Ganzbild- und Streifenversuche sind kein kontrollierter Genauigkeitsbenchmark.

Der fehlgeschlagene unabhängige Tengulist-Check hat den zusätzlichen engen Nummernausschnitt und die Inversion veranlasst. Er gehört dadurch anschließend zum Entwicklungsmaterial. Auch der erneute Versuch mit enger Set-/Nummernzeile und Inversion blieb für Tengulist ohne eindeutigen Kandidaten; dieser Fehler ist weiterhin offen. Er darf bei einer erneuten Prüfung nicht als unberührter Holdout ausgegeben werden. Ein neuer unabhängiger Kartensatz und Originalfotos eines Sammlers fehlen weiterhin. Kein Prozentwert für Erkennungsgenauigkeit wird aus diesen vier Beispielen abgeleitet.

Die ersten vier Varianten brauchten unter gleichzeitig laufenden Browser-Tests auf einer auf zwei CPU-Kerne begrenzten Cloud-Umgebung etwa 24–54 Sekunden pro Bild. Das ist kein verlässlicher Mobilbenchmark und noch kein akzeptierter Nachweis schneller Stapelerfassung. Abbruch, Modell-Ladefehler und manuelle Fortsetzung gehören daher zum nutzbaren Ablauf. `scripts/smoke-recognition.mjs` wiederholt die echte OCR getrennt von den deterministischen Tests.

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

`npm run check` erfolgreich: Formatierung, Lint, 43 Unit-Tests, TypeScript, Validierung der 22 Kapitel und 198 Bilddateien sowie der mehrseitige Produktionsbuild. Die Tests prüfen insbesondere Gesamtmengen statt automatischer Addition, doppelte Erfassung, Reservierungen über Seiten, hohe Exemplarnummern, Fixierungen, Teilseiten, unbekannte Credits, Katalogkorrekturen und fehlende Originalfotos in Backups.

Die erweiterten Playwright-Tests prüfen den echten Vite-HTTP-Server: Hinzufügen, Korrektur, Reload, Rückgängig, getrennte Demo, geplante Vorlagen, Tauschkonflikte, Artist-Teilseite, festgehaltene Pflichtkarte, originale Fotos, vollständigen JSONL-Roundtrip, Tab-Konflikt, OCR-Abbruch, Tastaturfokus, 320-Pixel-Reflow und axe. Die bisherigen Kapitel-, Cardmarket-, Dialog-, Deep-Link- und Touch-Prüfungen bleiben enthalten. Insgesamt wurden 75 unterschiedliche Prüfungen in Desktop- und mobilem Chromium erfolgreich ausgeführt; eine zusätzliche Desktop-Touch-Prüfung ist erwartungsgemäß übersprungen. Zwei zunächst fehlgeschlagene OCR-Abbruchprüfungen wurden nach einer Korrektur am Worker-Start erneut ausgeführt und bestanden.

WebKit wurde heruntergeladen und ein Start tatsächlich versucht. Die Umgebung hat keine benötigten GTK-/Graphene-/Harfbuzz-ICU-/Manette-/Hyphen-/GLES-Bibliotheken; der Installationsversuch scheiterte an fehlender administrativer Ausführung. WebKit/Safari ist deshalb hier nicht erfolgreich geprüft. CI installiert die benötigten Systembibliotheken und verlangt diese Suite zusätzlich.

## Was noch nicht belegt ist

Keine Originalfotos, verifizierten privaten Besitzmengen oder Zielcollector-Sitzungen wurden bereitgestellt. Es gibt weiterhin keine beobachteten akzeptierten/abgelehnten Seiten, dokumentierten physischen Aufbau oder spätere Beibehaltung einer vorgeschlagenen Seite. Die drei Fragen sind sparsame, testbare Voreinstellungen; welche ihren Aufwand verdienen, muss der vorbereitete Blindvergleich zeigen.

Die Empfehlung für die erste nutzbare Lieferung lautet daher: bestätigten lokalen Bestand und editierbare Seiten verwenden, Vorschläge als bearbeitbare Ideen behandeln und die Erkennung als Hilfe mit klarer Korrektur anbieten. Künstlergleichheit und ähnliche Farben allein bleiben unzureichende Qualitätsnachweise. Konten, soziale Funktionen, Preise und eine breitere Roadmap sind kein Bestandteil dieses Arbeitsablaufs.
