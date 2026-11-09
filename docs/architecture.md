# Architektur

E-Binder hat zwei statisch auslieferbare Vite-Einstiege: `index.html` für den persönlichen Arbeitsbereich mit lokalem und optionalem Supabase-Speicher und `archive.html` für die unveränderten Inhalte des Inspirationsarchivs. Die Darstellung verwendet natives DOM und TypeScript im Strict-Modus. Ein Frameworkwechsel ist für diesen Arbeitsablauf nicht nötig.

## Daten und Zustandsbesitz

`PersonalCard` bezeichnet eine konkrete Katalogausgabe. Ein bestätigter `Holding`-Eintrag referenziert sie zusammen mit Sprache, Druckvariante, Gesamtmenge und expliziter Tauschmenge. Ein `OwnedSlot` bezeichnet einen bestimmten Zählindex eines Exemplars. Ein `PlannedSlot` bezeichnet ein gewünschtes Motiv ohne Besitz. Wünsche sind eigene Datensätze und können auch für bereits besessene Ausgaben bestehen.

`validateState` prüft zur Laufzeit Mengen, Varianten, eindeutige Datensätze, referenzierte Exemplare und die einmalige Zuordnung eines Exemplars über alle Seiten. Die Domain kennt weder Netzwerk noch DOM. Reine Transformationen klonen den vorherigen Zustand, erhöhen die Revision und validieren das Ergebnis. Fixierte Plätze bleiben bei neuer Anordnung unverändert. Layoutänderungen und Ausgabekorrekturen setzen die Markierung des physischen Aufbaus zurück.

`WorkspaceContext` besitzt den aktuellen Zustand, Filter und Aktionen. Dialoge besitzen temporäre Eingaben und ihre laufenden Abbruchcontroller. Metadaten- und Navigationsänderungen erzeugen keine irreführenden Rückgängig-Schritte. Zwanzig Bearbeitungssnapshots bleiben in der geöffneten Sitzung verfügbar.

## Speicherung und Sicherung

IndexedDB `e-binder-personal` enthält `states` und `photos`. Demo, Gast und Konten haben getrennte Zustandsschlüssel. IndexedDB v2 enthält nur `states`; der frühere `photos`-Store wird beim Upgrade entfernt. Fotos sind ausschließlich temporäre Eingaben im geöffneten Erkennungsdialog. Das Speichern läuft geordnet in Transaktionen. Vor einem Schreibvorgang wird die im Tab geladene Revision mit der Datenbank verglichen. Ein Konflikt lässt den geöffneten Arbeitsstand exportierbar und überschreibt den anderen Tab nicht.

„Gespeichert“ erscheint erst nach erfolgreichem Transaktionsabschluss. Bei Speicherfehlern bleiben der geöffnete Stand, Wiederholen und Export verfügbar. Fehler beim initialen Laden überschreiben vorhandene Daten nicht.

JSONL ist ein versioniertes Exportformat mit Manifest, Bestands-, Binder-, Wunsch-, Erfassungs- und Kontextdatensätzen ohne Bildbytes. Persönliche JSONL-Dateien werden nie ins Repository geschrieben. Der Import prüft Schema, Referenzen, Mengen vor der Bestätigung. Er ersetzt den aktuellen Stand ohne automatische Mengensummierung. Wiederherstellung schreibt ausschließlich Metadaten atomar. Alte Foto-Records werden ohne Decodierung verworfen.

Die erste Version begrenzt einzelne Fotos auf 12 MB und Sicherungen auf 256 MB. Angemeldete Konten verwenden `CloudStore`: zuerst lokal sichern, dann ausschließlich den versionierten Metadatenzustand über `save_workspace` atomar speichern. IndexedDB-Schlüssel enthalten die Konto-ID. Gast und Demo bleiben getrennt. Serverkonflikte erhalten die lokale Kopie. Das Backend und seine RLS-Regeln sind in [backend.md](backend.md) beschrieben.

## Katalog und Erkennung

Der TCGdex-Adapter validiert externe Antworten mit Zod. Die Suche lädt deutsche, englische oder japanische Ausgaben, die Detailabfrage erst deren vollständige Angaben. Bilder sind auf bekannte HTTPS-Hosts oder öffentliche lokale Kartenpfade begrenzt; Originalfotos werden über lokale Blob-URLs geladen. Gedruckte Nummern werden unter Erhalt des Trennzeichens und ohne bedeutungslose führende Nullen verglichen. Anbieter-IDs sind keine globale Kartenidentität.

Fotoerfassung und bestätigter Bestand sind getrennt. SHA-256 erkennt wiederholt importierte identische Fotos; Bestätigen setzt eine ausdrückliche Gesamtmenge. Ein Foto kann nicht zweimal übernommen werden. Eine Ausgabekorrektur behält die Bestands-ID und gültige Reservierungen.

Die Erkennung verwendet PaddleOCR PP-OCRv4 mit ONNX Runtime Web in einem eigenen Worker. Das ONNX-Modell und sein Wörterbuch werden lokal mit ausgeliefert; Herkunft, Version und Prüfsummen stehen in `public/assets/ocr/model-source.json`. Ein zusätzliches Textdetektionsmodell und OpenCV entfallen, weil der Nutzer zunächst die vier Kartenecken ausrichtet und eine projektive Abbildung eine temporäre aufrechte Kartenkopie erzeugt.

Der Worker nutzt OffscreenCanvas für die Set-/Nummernzeile, eine separate Nummernregion und einen Titelbereich. Eingaben werden auf 48 Pixel Höhe skaliert, als RGB/CHW auf [-1,1] normalisiert und mit dem CTC-Wörterbuch dekodiert. Bei unklarer Nummer werden Kontrast, Inversion, Schwarzweiß und ein weiterer Nummernbereich geprüft. Das sind alternative Beobachtungen, keine kalibrierten Wahrscheinlichkeiten. Abbruch oder Timeout beenden den Worker einschließlich seiner Inferenz; die Aufnahme bleibt bis zum Schließen nur temporär verfügbar. Beim ersten Start werden Modell und WebAssembly-Laufzeit geladen, die OCR selbst lädt keine Fotos hoch. auch Konten übertragen keine Bilder.

Nummern aus verschiedenen Durchläufen sind Beobachtungen, keine kalibrierten Wahrscheinlichkeiten. Mehrdeutige Nummern bleiben mehrere Kandidaten. Unterstützte Set-Abkürzungen können eine konkrete TCGdex-Abfrage eingrenzen; deren Nummer und Nenner werden erneut verglichen. Andere Fälle verwenden lokale Kandidaten oder manuelle Katalogsuche. Sprache, Variante und Menge sind vor Besitzübernahme zu bestätigen.

## Vorschläge

Die Methode verwendet verfügbare bestätigte Exemplare, explizite Evolutionsbeziehungen, bekannte Illustrator-Credits und direkt aus Bildern gemessene Farbmerkmale. Sie erzeugt bis zu drei verschiedene Vorschauen und entfernt identische Ergebnisse. Die Bildanalyse ist auf 240 geeignete Ausgaben je Durchlauf begrenzt und benennt diese Grenze. Menge, Reservierungen, Artist-Auswahl, Ausschlüsse und Fixierungen bleiben harte Regeln.

Farben, Artist-Gruppen und Evolutionsreihen sind testbare Heuristiken. Sie erkennen keine persönliche Erinnerung und beweisen keine ästhetische Präferenz. Pflichtkarte, manuelle Bearbeitung und der vorbereitete Collector-Test sind dafür relevant. Die Entscheidung des Nutzers übernimmt genau einen Entwurf; alternative Vorschauen erzeugen keine weiteren Reservierungen.

## Oberfläche und Auslieferung

Gemeinsame Farbrollen stehen in `styles.css`, Arbeitsflächen in `workspace.css`. Native Dialoge übernehmen Fokusbegrenzung und Escape. Fokus wird nach einem erneuten Rendern über stabile Elementschlüssel zurückgegeben. Ziehen ist eine zusätzliche Bedienform zum ausdrücklichen Verschieben/Tauschen.

Das Archiv erhält seine URL-Hashes, Greninja-Edition, Cardmarket-Produkte und Tastatur-/Touch-Navigation. Die neue gemeinsame Farbpalette ist ausdrücklich vom Nutzer gewünscht. Der mehrseitige Vite-Build veröffentlicht beide Einstiege unter `/E-Binder/`.

CI prüft Pull Requests und `master`; nur ein erfolgreicher Build auf `master` kann Pages veröffentlichen. Derselbe geprüfte `dist/`-Ordner wird ausgeliefert. Keine privaten Daten, Zugangsdaten oder generierten Testberichte werden eingecheckt.
