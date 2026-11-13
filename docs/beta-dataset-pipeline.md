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

## Offline-A/B-Benchmark der Eckenerkennung (13. November 2026)

Die neue lokale Zweistufen-Erkennung führt zuerst die bestehende strenge Kantensuche aus; nur wenn diese keinen validen Treffer liefert, folgt eine separate Low-Contrast-Prüfung. Das Ergebnis ist **kein trainiertes Modell** und wurde noch nicht an echten iPhone-Fotos gemessen.

Das neue Skript `scripts/benchmark-card-corners.mjs` vergleicht beide Verfahren **auf denselben privaten Fotos**. Es verwendet den gleichen 3:4-Mittelausschnitt und die gleiche Auflösung (192×256) wie der Live-Scanner. Die Annotationen sind normierte Eckkoordinaten im **Originalfoto**, sortiert links oben, rechts oben, rechts unten, links unten. Negative Beispiele haben `corners: null`. Jede Probe erfordert unabhängige visuelle Prüfung, Nutzungsrechte, eine physische Kartengruppe und eine Aufnahmesitzung.

Beispiel für eine Datei außerhalb des Repositories:

```text
{ "samples": [
  { "photo": "./card-sleeve.jpg",
    "corners": [[0.18,0.12],[0.82,0.12],[0.82,0.88],[0.18,0.88]],
    "rights": "Eigene Aufnahme",
    "physicalCardGroup": "physical-card-a",
    "sessionGroup": "session-a",
    "verification": { "independent": true, "evidence": "Visuelle Eckprüfung" }
  },
  { "photo": "./empty-frame.jpg", "corners": null,
    "rights": "Eigene Aufnahme",
    "physicalCardGroup": "empty-scene-b",
    "sessionGroup": "session-b",
    "verification": { "independent": true, "evidence": "Keine Karte sichtbar" }
  }
] }
```

```sh
CORNER_BENCHMARK_OUT=/private/report.json \
  node --import tsx scripts/benchmark-card-corners.mjs /private/corners.json
```

Die Ausgabe enthält nur aggregierte Fehler-, Treffer- und Laufzeitmetriken; **keine Fotos, Dateinamen, Account-IDs oder OCR-Texte**. Es werden keine privaten Daten ins öffentliche Repo geschrieben. Eine Freigabe verlangt mindestens 100 unabhängige positive Karten, zehn Negativfälle, ausreichende Sitzungs- und Kartengruppenvielfalt, mindestens gleiche Eckentreffer und keine erhöhte Fehlalarmrate. Die vorhandenen 59 freiwillig gespendeten privaten Bilder sind noch nicht unabhängig geprüft; die Roboflow-Boxen sind keine echten perspektivischen Eckmarkierungen. Darum bleibt der ML-Gewichte-Tausch gesperrt.

## Der aktuelle Implementierungsstand

Die Upload- und RLS-Schicht stellt **unbewertete** private Samples bereit. Es gibt **keinen** automatischen Trainingslauf und noch keine verifizierten neuen Gewichte. Dieses Gate ist beabsichtigt: Aus wenigen oder falsch etikettierten Aufnahmen ohne Hold-out wäre „Training erfolgreich“ fachlich irreführend.

## Reproduzierbare Offline-A/B-Freigabe

Nach schriftlich belegter Einwilligung und unabhängiger Prüfung werden die **gleichen** privaten Fotos in zwei Läufen von `scripts/benchmark-card-scans.mjs` untersucht: Beta-Schalter aus (OCR allein), danach eingeschaltet (OCR + visueller ONNX-Index). Die Ausgabe enthält nur Metadaten und Messwerte, keine Originalbilder.

```sh
CARD_SCAN_BENCHMARK_OUT=/private/baseline.json \
  node scripts/benchmark-card-scans.mjs /private/ground-truth.json

CARD_SCAN_VISUAL_BETA=1 CARD_SCAN_BENCHMARK_OUT=/private/visual.json \
  node scripts/benchmark-card-scans.mjs /private/ground-truth.json

npm run audit:beta-model -- /private/baseline.json /private/visual.json --gate
```

`scripts/compare-beta-benchmarks.mjs` lehnt abweichende Testmengen, falsch gepaarte Labels, Duplikate, unter 100 unabhängig geprüfte Kartenfotos, unter 10 Negativfälle, technische Fehler, mehr falsche automatische Vorschläge oder einen schlechteren Top-1/Top-5-Stand ab. Ein Durchlauf ist trotzdem **keine** Berechtigung, Modellgewichte ohne eigenes rechtliches, reproduzierbares Training und unabhängigen Hold-out zu ändern.

Stand 12. November: In Supabase liegen 15 private Kartenfotos zur Prüfung, alle mit `review_status=pending`, null `human_verified`; die Fotos dürfen daher aktuell weder als echte Benchmark-Ground-Truth noch für Training benutzt werden. Der autorisierte Reviewer muss sie zuerst individuell prüfen. Verschlüsselter Export und Label-Gates sind unter `scripts/export-beta-review.mjs` und `scripts/review-beta-samples.mjs` implementiert.

## Gastbeiträge und Korrekturen (November 2026)

- Auch Nutzer ohne E-Binder-Konto können im **Profil** die Foto-Teilnahme ausdrücklich aktivieren. Erst dann wird eine getrennte, pseudonyme Supabase-Anonymous-Auth-Identität angelegt. Die lokale Sammlung bleibt im `PersonalStore` und wird nicht mit dieser Auth-Identität synchronisiert.
- Vorausgesetzt wird, dass **Anonymous Sign-ins** in den Supabase-Authentifizierungseinstellungen aktiviert sind. Falls nicht, wird eine verständliche Fehlermeldung gezeigt; Scannen und OCR arbeiten lokal weiter.
- `beta_scan_samples.capture_key` verbindet den privaten gespendeten Fotoeintrag mit `beta_scan_feedback.capture_key`. Ein manuell oder nach einem Vorschlag bestätigter `tcgdex:Sprache:KartenID`-Schlüssel ist **vorläufiges Nutzerfeedback**, keine verifizierte Wahrheit. Ein fehlgeschlagener Scan bleibt ohne vermutetes Label und geht in die unabhängige Prüfung.
- Fotouploads, die keine aktive Zustimmung nachweisen können, sind durch Server-RLS und den privaten Bucket verboten. Die Bildkopie wird ohne EXIF neu kodiert, nicht in öffentliche GitHub-Artefakte geschrieben und kann vom jeweiligen Besitzer gelöscht werden.
- Widerruf stoppt **neue** Fotoübertragungen. „Alle meine Beta-Testbilder löschen“ deaktiviert zusätzlich die Einwilligung und entfernt die privaten Bilder, Sample-Metadaten und vorläufigen Korrekturen. Gastnutzer müssen dies vor dem Löschen des lokalen Browser-Speichers tun; ohne ihre anonyme Identität kann die clientseitige Löschung nicht mehr autorisiert werden.
- Die Zusatzdaten erlauben später einen **privaten OCR-/Bildmodell-Benchmark**: tatsächliches Kamerafoto versus unabhängiges, anhand von Edition/Set/Nummer/Name/Sprachvarianten geprüftes Label. Die Nutzerwahl selbst darf niemals ungeprüft Trainingsgewichtung werden.
- Vor Produktiveinsatz prüfen: Benutzerinformation und Datenschutztext, Aufbewahrungs-/Löschkonzept für verlorene Gastidentitäten, Rate-Limits für anonyme Auth und Storage, Missbrauchsschutz und getrennte A/B-Messung auf einem versiegelten Hold-out. Training bleibt bis zu diesen Prüfungen deaktiviert.
