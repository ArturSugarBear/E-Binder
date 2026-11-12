# Beta-Fotodaten, Review und Modell-Qualität

## Datenfluss

**Gerät:** Der lokale Scanner verarbeitet Bilder für OCR, Katalogabgleich und Review wie bisher. Erst nach freiwilliger Einwilligung wird eine **zusätzliche, neu kodierte JPEG-Kopie** ohne EXIF und Standort an einen privaten Bucket gesendet. Einzelkarte maximal 1200 px lange Kante, ausgerichtete Binderseite maximal 1800 px; JPEG-Qualität und Dateigröße sind begrenzt. Keine Netzanfrage bei fehlendem Konto/Consent; Übertragungen sind best effort.

**Supabase:** Die Tabelle beta_scan_consents speichert die aktuelle Einwilligung, Version und Zeitstempel. beta_scan_samples enthält Konto-ID, Objektpfad, Quelltyp, Größe und pending-Status. RLS bindet Objektpfad und Einwilligung an den authentifizierten Nutzer. Daten- und Storage-Pfade sind getrennt vom eigentlichen Bestand.

**Reviewer:** Jede Probe benötigt unabhängige Prüfung auf Nutzungsrechte, Bildqualität, Druckauflage/Edition, Sprache und komplette Nummer. Erst ein privilegierter Reviewer darf das geprüfte Label eintragen und den Status accepted vergeben. Automatische OCR-Vorschläge sind keine Ground Truth.

**Training:** Die vorhandene PaddleOCR-ONNX-Datei lernt **nicht automatisch durch neue JPEGs**. Ein eigenes Training setzt einen reproduzierbaren Trainingsstack, Lizenzklarheit, validierte Labels und getrennte Train/Validation/Test-Gruppen voraus. Ein privater, manuell autorisierter CI-Prozess kann zunächst anonymisierte Zahlen und Freigabegrenzen kontrollieren; Nutzerbilder und Identitäten gehören nicht in öffentlich lesbare Build-Artefakte.

## Bewertungsmetriken

Primär: **Exact Printing Top-1** aus Set, Sammlernummer, vollständigem Namen, Sprache und Finish/Edition; zusätzlich Top-5 Recall, Rate falscher Selbstbestätigungen, p50/p95 Latenz, Peak Memory und Korrekturen nach Scan. Messungen nach DE/EN/JA, frühen Sets, schlechter Beleuchtung, Reflexion, Hülle, Neigung und Binderseiten gruppieren. Train/Test nach physischer Karte und Aufnahme-Session trennen, damit Near-Duplikate nicht die Genauigkeit künstlich erhöhen.

## Sicherheitsregeln

- Standardmäßig keine Foto-Uploads, Einwilligung serverseitig und versioniert.
- Ein Nutzer kann nie eine fremde private Aufnahme lesen oder ein accepted-Label selbst setzen.
- Keine Client-Service-Role-Keys und kein öffentliches Storage.
- Maximal 1,5 MB JPEG pro Objekt und ein benutzergebundener UUID-Pfad.
- Fotos nur für den erklärten Zweck, kein Verkauf oder Weitergeben ohne separate Rechteklärung.
- Retention und Widerruf müssen auch das tatsächliche Storage-Objekt erfassen; die Profil-Löschung umfasst ausstehende sowie bereits bewertete Aufnahmen.
- Produktionsgewichte erst nach erfolgreicher unabhängiger Benchmarkprüfung ändern.

## Der aktuelle Implementierungsstand

Die Upload- und RLS-Schicht stellt **unbewertete** private Samples bereit. Es gibt **keinen** automatischen Trainingslauf und noch keine verifizierten neuen Gewichte. Dieses Gate ist beabsichtigt: Aus wenigen oder falsch etikettierten Aufnahmen ohne Hold-out wäre „Training erfolgreich“ fachlich irreführend.

## Gastbeiträge und Korrekturen (November 2026)

- Auch Nutzer ohne E-Binder-Konto können im **Profil** die Foto-Teilnahme ausdrücklich aktivieren. Erst dann wird eine getrennte, pseudonyme Supabase-Anonymous-Auth-Identität angelegt. Die lokale Sammlung bleibt im `PersonalStore` und wird nicht mit dieser Auth-Identität synchronisiert.
- Vorausgesetzt wird, dass **Anonymous Sign-ins** in den Supabase-Authentifizierungseinstellungen aktiviert sind. Falls nicht, wird eine verständliche Fehlermeldung gezeigt; Scannen und OCR arbeiten lokal weiter.
- `beta_scan_samples.capture_key` verbindet den privaten gespendeten Fotoeintrag mit `beta_scan_feedback.capture_key`. Ein manuell oder nach einem Vorschlag bestätigter `tcgdex:Sprache:KartenID`-Schlüssel ist **vorläufiges Nutzerfeedback**, keine verifizierte Wahrheit. Ein fehlgeschlagener Scan bleibt ohne vermutetes Label und geht in die unabhängige Prüfung.
- Fotouploads, die keine aktive Zustimmung nachweisen können, sind durch Server-RLS und den privaten Bucket verboten. Die Bildkopie wird ohne EXIF neu kodiert, nicht in öffentliche GitHub-Artefakte geschrieben und kann vom jeweiligen Besitzer gelöscht werden.
- Widerruf stoppt **neue** Fotoübertragungen. „Alle meine Beta-Testbilder löschen“ deaktiviert zusätzlich die Einwilligung und entfernt die privaten Bilder, Sample-Metadaten und vorläufigen Korrekturen. Gastnutzer müssen dies vor dem Löschen des lokalen Browser-Speichers tun; ohne ihre anonyme Identität kann die clientseitige Löschung nicht mehr autorisiert werden.
- Die Zusatzdaten erlauben später einen **privaten OCR-/Bildmodell-Benchmark**: tatsächliches Kamerafoto versus unabhängiges, anhand von Edition/Set/Nummer/Name/Sprachvarianten geprüftes Label. Die Nutzerwahl selbst darf niemals ungeprüft Trainingsgewichtung werden.
- Vor Produktiveinsatz prüfen: Benutzerinformation und Datenschutztext, Aufbewahrungs-/Löschkonzept für verlorene Gastidentitäten, Rate-Limits für anonyme Auth und Storage, Missbrauchsschutz und getrennte A/B-Messung auf einem versiegelten Hold-out. Training bleibt bis zu diesen Prüfungen deaktiviert.
