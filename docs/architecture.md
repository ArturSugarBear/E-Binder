# Architektur

E-Binder hat zwei statisch auslieferbare Vite-Einstiege: `index.html` für den lokalen persönlichen Arbeitsbereich und `archive.html` für die unveränderten Inhalte des Inspirationsarchivs. Die Darstellung verwendet natives DOM und TypeScript im Strict-Modus. Ein Frameworkwechsel ist für diesen Arbeitsablauf nicht nötig.

## Daten und Zustandsbesitz

`PersonalCard` bezeichnet eine konkrete Katalogausgabe. Ein bestätigter `Holding`-Eintrag referenziert sie zusammen mit Sprache, Druckvariante, Gesamtmenge und expliziter Tauschmenge. Ein `OwnedSlot` bezeichnet einen bestimmten Zählindex eines Exemplars. Ein `PlannedSlot` bezeichnet ein gewünschtes Motiv ohne Besitz. Wünsche sind eigene Datensätze und können auch für bereits besessene Ausgaben bestehen.

`validateState` prüft zur Laufzeit Mengen, Varianten, eindeutige Datensätze, referenzierte Exemplare und die einmalige Zuordnung eines Exemplars über alle Seiten. Die Domain kennt weder Netzwerk noch DOM. Reine Transformationen klonen den vorherigen Zustand, erhöhen die Revision und validieren das Ergebnis. Fixierte Plätze bleiben bei neuer Anordnung unverändert. Layoutänderungen und Ausgabekorrekturen setzen die Markierung des physischen Aufbaus zurück.

`WorkspaceContext` besitzt den aktuellen Zustand, Filter und Aktionen. Dialoge besitzen temporäre Eingaben und ihre laufenden Abbruchcontroller. Metadaten- und Navigationsänderungen erzeugen keine irreführenden Rückgängig-Schritte. Zwanzig Bearbeitungssnapshots bleiben in der geöffneten Sitzung verfügbar.

## Speicherung und Sicherung

IndexedDB `e-binder-personal` enthält `states` und `photos`. Demo und persönlicher Bestand haben getrennte Schlüssel und Fotoreferenzen. Das Speichern läuft geordnet in Transaktionen. Vor einem Schreibvorgang wird die im Tab geladene Revision mit der Datenbank verglichen. Ein Konflikt lässt den geöffneten Arbeitsstand exportierbar und überschreibt den anderen Tab nicht.

„Gespeichert“ erscheint erst nach erfolgreichem Transaktionsabschluss. Bei Speicherfehlern bleiben der geöffnete Stand, Wiederholen und Export verfügbar. Fehler beim initialen Laden überschreiben vorhandene Daten nicht.

JSONL ist ein versioniertes Exportformat mit Manifest, Bestands-, Binder-, Wunsch-, Erfassungs- und Kontextdatensätzen und Base64-Originalfotos. Persönliche JSONL-Dateien werden nie ins Repository geschrieben. Der Import prüft Schema, Referenzen, Mengen und alle benötigten Fotos vor der Bestätigung. Er ersetzt den aktuellen Stand ohne automatische Mengensummierung. Wiederherstellung schreibt Zustand und Fotos atomar; neue Foto-IDs erhalten alte Originale für Rückgängig.

Die erste Version begrenzt einzelne Fotos auf 12 MB und Sicherungen auf 256 MB. Es gibt keine geräteübergreifende Synchronisation. Eine öffentliche Mehrbenutzerlösung würde einen separaten Backend- und Zugriffsschutzauftrag benötigen.

## Katalog und Erkennung

Der TCGdex-Adapter validiert externe Antworten mit Zod. Die Suche lädt deutsche oder englische Ausgaben, die Detailabfrage erst deren vollständige Angaben. Bilder sind auf bekannte HTTPS-Hosts oder öffentliche lokale Kartenpfade begrenzt; Originalfotos werden über lokale Blob-URLs geladen. Gedruckte Nummern werden unter Erhalt des Trennzeichens und ohne bedeutungslose führende Nullen verglichen. Anbieter-IDs sind keine globale Kartenidentität.

Fotoerfassung und bestätigter Bestand sind getrennt. SHA-256 erkennt wiederholt importierte identische Fotos; Bestätigen setzt eine ausdrückliche Gesamtmenge. Ein Foto kann nicht zweimal übernommen werden. Eine Ausgabekorrektur behält die Bestands-ID und gültige Reservierungen.

Die OCR lädt Tesseract.js dynamisch. Das LSTM-Modell läuft im Browser. Canvas extrahiert zunächst die schmale Set-/Nummernzeile einer aufrechten, bildfüllenden Karte. Vergrößerung, Graustufen/Kontrast, Inversion, globaler Otsu-Schwellwert und lokale adaptive Binarisierung erzeugen verschiedene OCR-Eingaben. Zwei gleich gelesene Nummern beenden die schmale Prüfung vorzeitig. Ohne Wiederholung wird zusätzlich der größere untere Streifen geprüft. Ein eigener Titelstreifen ergänzt den Namen. Das Original bleibt erhalten. Abbruch und Timeout führen zurück zur manuellen Auswahl. Programm-/Sprachdaten benötigen beim ersten Start Netzwerk; Fotos bleiben lokal.

Nummern aus verschiedenen Durchläufen sind Beobachtungen, keine kalibrierten Wahrscheinlichkeiten. Mehrdeutige Nummern bleiben mehrere Kandidaten. Unterstützte Set-Abkürzungen können eine konkrete TCGdex-Abfrage eingrenzen; deren Nummer und Nenner werden erneut verglichen. Andere Fälle verwenden lokale Kandidaten oder manuelle Katalogsuche. Sprache, Variante und Menge sind vor Besitzübernahme zu bestätigen.

## Vorschläge

Die Methode verwendet verfügbare bestätigte Exemplare, explizite Evolutionsbeziehungen, bekannte Illustrator-Credits und direkt aus Bildern gemessene Farbmerkmale. Sie erzeugt bis zu drei verschiedene Vorschauen und entfernt identische Ergebnisse. Die Bildanalyse ist auf 240 geeignete Ausgaben je Durchlauf begrenzt und benennt diese Grenze. Menge, Reservierungen, Artist-Auswahl, Ausschlüsse und Fixierungen bleiben harte Regeln.

Farben, Artist-Gruppen und Evolutionsreihen sind testbare Heuristiken. Sie erkennen keine persönliche Erinnerung und beweisen keine ästhetische Präferenz. Pflichtkarte, manuelle Bearbeitung und der vorbereitete Collector-Test sind dafür relevant. Die Entscheidung des Nutzers übernimmt genau einen Entwurf; alternative Vorschauen erzeugen keine weiteren Reservierungen.

## Oberfläche und Auslieferung

Gemeinsame Farbrollen stehen in `styles.css`, Arbeitsflächen in `workspace.css`. Native Dialoge übernehmen Fokusbegrenzung und Escape. Fokus wird nach einem erneuten Rendern über stabile Elementschlüssel zurückgegeben. Ziehen ist eine zusätzliche Bedienform zum ausdrücklichen Verschieben/Tauschen.

Das Archiv erhält seine URL-Hashes, Greninja-Edition, Cardmarket-Produkte und Tastatur-/Touch-Navigation. Die neue gemeinsame Farbpalette ist ausdrücklich vom Nutzer gewünscht. Der mehrseitige Vite-Build veröffentlicht beide Einstiege unter `/E-Binder/`.

CI prüft Pull Requests und `master`; nur ein erfolgreicher Build auf `master` kann Pages veröffentlichen. Derselbe geprüfte `dist/`-Ordner wird ausgeliefert. Keine privaten Daten, Zugangsdaten oder generierten Testberichte werden eingecheckt.
