# 04 — Abnahme, Messung und Nachweise

## Testdaten und Umgebungen

Öffentlich nur synthetische Besitzdaten und erlaubte Referenzbilder verwenden. Private Owner-Fotos bleiben in privatem Testbestand; öffentliche Reports enthalten aggregierte Ergebnisse und nicht rückführbare Fall-IDs.

Mindestens: leerer echter Bestand; bewusst aktivierte Demo; 30 bestätigte Testexemplare mit DE/EN/JA, Duplikaten, normal/holo/reverse, fehlenden Bildern/Preisen; Binder mit 20 Seiten und gemischten freien/geplanten/belegten Slots; größere synthetische Sammlung mit 1.000 Einträgen für Rendering/Filter. Diese Größen sind Testvorgaben, keine Behauptung vorhandener Nutzerdaten.

Browser: vorhandene Chromium-/WebKit-Projekte und mobile Konfiguration. Reale Geräte: iPhone 13 Pro Max Safari und installierte PWA, Galaxy Tab Chrome/installierte Web-App. Ein WebKit-Emulator ersetzt keinen iPhone-Kameratest. Kein Bericht darf manuelle Tests als durchgeführt markieren, wenn kein Gerät vorhanden war.

## Journey-Matrix

| ID | Ablauf | Bestehensbedingung / Beleg |
| --- | --- | --- |
| J01 Einstieg | Frischer lokaler Zustand → Home → Scan → Kamera verweigern → alternative Suche → Karte wählen → bestätigen | Kein Pflichtkonto; keine Sackgasse; eindeutige Ausgabe; erst Bestätigung erzeugt Besitz; Reload erhält Menge 1. |
| J02 Rückkehr | Gefüllter Bestand → App starten → letzte Binderseite → Sammlung → Detail → zurück | Eigene Karte/Bindervorschau auf 390×844 ohne Scrollen; Fortsetzung korrekt; Filter/Scrollposition erhalten; kein wiederholtes Onboarding. |
| J03 Binder | 20 Seiten → vor/zurück ziehen → Geste abbrechen → Slot öffnen → zuweisen → Reload | Fingertracking sichtbar; Abbruch ohne Seitenwechsel; neun feste Slots; keine doppelte Exemplarvergabe; aktive Rail-Seite sichtbar. |
| J04 Kartendetail | Dieselbe Ausgabe aus Entdecken, Sammlung und Binder öffnen; JA-Fall; Menge ändern | Identität und geeigneter Preis konsistent; Kontextaktion korrekt; verifizierter DE-Name oder ehrlicher fehlender Alias; Mengenänderung persistiert. |
| J05 Entdecken | Sprache/Set/Filter/Sortierung ändern → Detail → zurück; Bildfehler provozieren | Kontext bleibt; Katalogzustände unterscheiden Offline/leer/Fehler; falsche Ausgabe wird nie als Bildfallback gezeigt; Fortschritt zählt eindeutige Drucke. |
| J06 Portfolio | Feste Quotes mit 10 EUR × 2, 5 EUR × 1 und einem unbewerteten Exemplar → Binder zuordnen → Quote/Bestand ändern | 25 EUR bekannter Teilwert, 3/4 Exemplare bepreist; Zuordnung ändert Gesamtwert nicht; fehlend ist nicht null; neue nicht vergleichbare Historie nicht als Kursbewegung verbinden. |
| J07 Scanserie | 20 verschiedene Aufnahmen; darunter JA, nicht indiziert, unscharf, Wiederholung; danach Binder mit leerem Slot | Kamera bleibt nutzbar; Queue ohne Verlust; keine fremden Pilotkandidaten ohne Evidenz; eindeutige Fehler/Retry; Positionen korrekt; kein unbestätigter Besitz. |
| J08 Änderungen | Name/Notiz bearbeiten → Drag, Backdrop, Escape, Browser-Zurück, X; danach bewusst verwerfen/speichern | Kein stiller Verlust; Guard konsistent; Fokus zurück; keine doppelten Dialoge; Speichern erst nach tatsächlichem Persistenzerfolg. |
| J09 PWA/Daten | Export → Import in leeren Testbestand; ungültiger Import; offline; Update; Wiederstart | Roundtrip exakt; ungültiger Import ohne Mutation; offline ehrliche Capability; Update erhält Bestand; Build/Commit sichtbar. |
| J10 Zugriff/Optik | Tastatur und Screenreader-Grundpfade; 320/390/430/800/1280; große Schrift; Reduced Motion/Transparency | Keine verdeckten Actions; benannte Controls/aktives Ziel; Kontrast mindestens WCAG AA für relevante Texte/Controls; 44px-Produktziele; japanische Sprache ausgezeichnet. |

## Zahlen als Zielbudgets, nicht als Ergebnis

Vor Änderungen Baseline messen; nach Änderungen dieselbe Methode und Fixture verwenden. Geräte-/Browser-/Build-/Cachezustand und Anzahl Versuche dokumentieren.

- Interaktionsfeedback: sichtbarer Pressed-/Pending-Zustand innerhalb 100 ms im p95 der Messreihe, auch bei langsamer Netzwerkanfrage.
- Warmer Tabwechsel: Hauptinhalt innerhalb 200 ms im p95 ohne Netzwerkabhängigkeit; keine blockierende 360-ms-Präsentationsanimation.
- Filter/Suche in 1.000 lokal vorhandenen Einträgen: p95 ≤300 ms bis sichtbares Ergebnis. Render-/Layout-Long-Tasks getrennt erfassen.
- Scanner: erste verständliche Statusreaktion ≤200 ms nach angenommener Aufnahme; warmer Kandidatenpfad als Entwicklungsziel p95 ≤5 s auf Referenzgerät. Kalter Modellstart separat mit sichtbarer Vorbereitung messen, nicht aus der Statistik entfernen.
- 20er-Scanserie ohne Crash, Hänger oder notwendige manuelle Kameraneuöffnung. Speicher vor/nach 5/10/20 Aufnahmen erfassen; nach Cleanup kein ungebremstes Wachstum durch behaltene Bitmaps/Worker. Browser ohne Heap-API als Messgrenze benennen.
- Rendering: Ziel flüssige 60-Hz-Interaktion; Framezeiten bei Scroll/Drag mit Glas an/aus berichten. Kein dauerhaftes WebGL-/Blur-Feature allein aufgrund eines Desktop-Screenshots freigeben.

Budgets dürfen nach realer Baseline begründet angepasst werden; Änderung mit altem/neuem Wert und Ursache dokumentieren. Nicht einfach das Budget auf den gemessenen schlechten Wert setzen.

## Erkennungsabnahme getrennt von UI-Abnahme

Vor Modell-/Threshold-Tuning einen gehaltenen Testkorpus fixieren: mindestens 150 unabhängige reale Kartenaufnahmen, mindestens 50 je DE/EN/JA; zusätzlich mindestens 30 Open-Set-/Nichtkarten-/stark unlesbare Negativfälle. Unterschiedliche Drucke, Sleeves, Reflexe und Perspektiven aufnehmen. Bildduplikate, gleiche physische Aufnahme und nahe Serien nicht zwischen Training/Validierung/Test verteilen. Wenn Daten fehlen, Arbeit als begrenzte Beta ausweisen.

Entwicklungsziele für den deklarierten unterstützten Bereich:
- Exact-print Top-3 Recall ≥95 % auf lesbaren, im Referenzkatalog/Index unterstützten Karten, getrennt je Sprache berichten.
- Falsche „eindeutig erkannt“-Entscheidungen ≤1 % im gehaltenen Gesamttest; Nenner und Unsicherheit angeben. Kleine Stichprobe kann keine allgemeine 1-%-Garantie belegen.
- Keine automatische Besitzanlage ohne Bestätigung in allen Tests.
- Nicht unterstützte/unklare Karten führen zu plausibler Auswahl oder ehrlicher Suche, nicht zwangsweise zu gefüllter Top-3.
- Binder: Slotzuordnung, leere Fächer und Identität separat messen. Gute Einzelkartenerkennung ersetzt keinen Geometrienachweis.

Ziele sind vom Review gesetzte Releasekriterien, keine gemessenen HoloGem-/Collectr-Werte. Ergebnisse immer mit Rohzähler/Nenner, Coverage, ausgeschlossenen Fällen und Konfidenzintervall berichten. Nicht nur erfolgreich erkannte Karten als Nenner wählen. Absolute Cosinus-Werte nicht als kalibrierte Wahrscheinlichkeit ausgeben; Schwelle auf Validierung festlegen, erst dann Test auswerten.

## Visuelle Nachweise

Vorher/Nachher jeweils gleicher Viewport, Datenstand, Theme, Schriftgröße und Route. Mindestens: Returning Home, leere Sammlung, gefülltes Raster, Binder, kompaktes Detail, Setdetail, Portfolio mit Teilabdeckung, Scanner aktiv, Review mit Unsicherheit und Profil/Über.

Nicht nur Screenshots erzeugen: ansehen und anhand von Hierarchie, Artworkgröße, Lesbarkeit, abgeschnittenen Texten, Überlagerungen und State-Wahrheit bewerten. Keine erfundenen „9/10“-Scores. Bewegung als kurze Aufnahme oder Interaction-Trace belegen; Standbild ist kein Beleg für Fingertracking.

## Automatisierte Prüfung

Node 24 gemäß package.json. Bestehende Scripts verwenden:
- `npm run check`: Format, Lint, Unit, Datenvalidierung, TypeScript, Build und PWA-Postbuild.
- `npm run test:e2e` bzw. gezielte vorhandene Specs mit tatsächlich konfigurierten Projektnamen aus playwright.config.
- Relevante existierende Specs: apple-ui, glass-shell, portfolio, binder-page-rail, binder-page-scan, mobile-binder-entry, interaction-templates sowie die Scan-/Katalog-/PWA-Fälle.
- Neue Tests für konkrete Daten-/Interaktionsregressionen. Keine Tests, die nur kopierte Implementierungsdetails bestätigen.
- Nach zentralen Navigation-/Sheet-/Preisänderungen vollständige relevante Regression auf dem integrierten Head. Ressourcenbedingten Browsercrash dokumentieren und isoliert reproduzieren; nicht automatisch zum harmlosen Flake erklären.

## Definition „fertig“

Ein Paket ist **implementiert**, wenn Code und passende Tests vorliegen; **verifiziert**, wenn seine Journey, visuelle Prüfung und erforderlichen Geräteprüfungen belegt sind. **Veröffentlicht** ist ein anderer Zustand: grüner relevanter Deploymentlauf und tatsächlich erreichbare App mit passendem SHA.

Finale Übergabe: Paketstatus, geprüfter Commit, Testbefehle/-resultate, sichtbare Vorher/Nachher-Belege, Benchmarktabellen, Produktionslink/SHA falls autorisiert veröffentlicht, offene echte Grenzen. Ein verbliebener P0-Fehler blockiert die volle Freigabe. Ein fehlender Realgerätetest darf nicht hinter einer grünen Desktop-Suite verschwinden.
