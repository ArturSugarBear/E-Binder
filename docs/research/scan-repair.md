# Fotoablauf und Erkennung: Reparatur vom 9. November 2026

## Ausgangslage und belegte Ursachen

Der Inhaber berichtet: Verschiedene eigene Karten wurden nicht erkannt; der Ablauf nach der Aufnahme war nicht nutzbar. Originalfotos dieser Fehlversuche liegen noch nicht vor. Die bisherigen erfolgreichen Erkennungsläufe verwendeten digitale Katalogbilder. Sie belegen keine zuverlässige Erkennung von Handyfotos.

Im Code ist die Ursache für eine wichtige Fehlerklasse nachweisbar: PP-OCR liest feste relative Bildstreifen, etwa bei 94 % der Bildhöhe. Ohne Zuschneiden, Ausrichtung und Entzerrung ist das bei Fotos mit Tischrand oder Perspektive häufig nicht die untere Textzeile der Karte. Außerdem gab es keinen Katalogabgleich für Karten ohne einen der zehn hinterlegten westlichen Setcodes. Selbst richtig gelesene ältere oder japanische Sammlernummern konnten dadurch ohne Vorschlag enden.

Der Fotoablauf ließ ältere OCR- und Detailabfragen weiterlaufen, nachdem bereits eine andere Karte oder manuelle Eingabe ausgewählt war. Diese konnten danach die sichtbare Auswahl ersetzen. Eingabefelder mit 12/14 px begünstigten außerdem den automatischen Fokuszoom unter iOS.

## Änderung

Nach der Kameraaufnahme öffnet sich die Ausrichtung: vier Kartenecken setzen, bei Bedarf drehen, dann „Ausschnitt erkennen“. Bei Galerieimport bleibt die Erkennung eine ausdrückliche Aktion je Foto. Die vier Punkte entzerren die Karte mittels projektiver Abbildung; es gibt keine automatische Kantenerkennung. Tastaturbedienung ist über Eckenauswahl und zwei Positionsregler möglich. Abbruch behält das offene Original und erzeugt keinen Besitz.

Die OCR erhält ausschließlich eine temporäre, ausgerichtete Bildkopie. Das gespeicherte Original bleibt bytegleich. Der Benutzer muss den unteren Rand vollständig einschließen. Manuelle Suche bleibt möglich. Neue Aufnahme, Auswahlwechsel, Suche und manuelle Erfassung stoppen laufende Erkennung und entwerten veraltete Detailabfragen. Die Bestätigung wird nach der Kartenauswahl in den sichtbaren Bereich gescrollt.

TCGdex-Abfragen unterstützen jetzt DE/EN/JA. Fehlt ein bekannter westlicher Setcode, werden tatsächliche Setumfänge und Kartennummern abgeglichen. Japanische IDs werden aus dem Setinventar übernommen, einschließlich Großschreibung und führender Nullen. Gleiche Nummern in mehreren Sets bleiben mehrere Kandidaten. Der Abgleich ist insgesamt auf 25 Sekunden und acht Sets je Nenner begrenzt; er behauptet keine vollständige Abdeckung aller Sondernummern/Promos. Kartenausgabe, Sprache, Variante und Gesamtmenge bleiben vor Besitzübernahme ausdrücklich zu bestätigen.

Eingabefelder verwenden mindestens 16 px. Die Viewport-Einstellung erlaubt weiterhin Benutzerzoom.

## Prüfungen und offene Evidenz

- Mathematische Tests: Perspektive, vier Eckpunkte, Identitätsabbildung, ungültige/überkreuzte Ecken.
- Katalogtest: japanische Original-ID und führende Nullen, keine Umdeutung in eine englische Ausgabe.
- Browserprüfung: Kameraimport, Ausrichtung, Drehung, Abbruch, manueller Rückweg, kein Besitz durch Scan, Wiederaufnahme nach Reload und Mindestschriftgröße.
- Synthetisches Bild mit breitem Tischrand und 90° Drehung: nach Ausrichtung korrekter Trasla-Vorschlag und keine JavaScript-Fehler. Das prüft den Bildverarbeitungspfad, kein echtes Kamerafoto. Wiederholbar über `node scripts/smoke-recognition.mjs --framed public/assets/cards/svi-211.webp`.
- Reale lokale OCR mit dem ausgerichteten digitalen Trasla-Bild: `211/198`, `SVI211/198`, `Trasla`, korrekter Vorschlag, keine JavaScript-Fehler. Kein Genauigkeitsmaß und kein Nachweis für reale Fotos.

Noch erforderlich: unveränderte Fehlversuch-Fotos des Inhabers, insbesondere unterschiedliche Rahmen, Hüllen/Reflexe, Kameradrehung und japanische Karten. Diese werden privat geprüft; sie gehören nicht in das öffentliche Repository. Collectr-Screenshots können Aufnahme, Ergebnis und Mengenbestätigung vergleichen helfen, ersetzen aber keine Originalfotos zum Testen des Erkenners. Die drei dort erfolgreich erkannten Karten sind bislang ein Bericht des Inhabers, keine hier beobachtete Vergleichsstudie.

## Abgrenzung zum Backend-Briefing

Das Supabase-Projekt wurde bereits angelegt. Auth, Tabellenmigration, Freigaben und geräteübergreifende Bestände sind noch nicht implementiert. Dieser Reparaturschritt verändert ausschließlich den lokalen Foto-/Erfassungsablauf und den Katalogabgleich. Die bestehende native Vite/TypeScript-Anwendung und Veröffentlichung auf `master` bleiben die Basis; ein Frameworkwechsel ist für diese Fehlerbehebung nicht erforderlich.

Ponytail: https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md

REA: https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md
