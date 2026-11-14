# 03 — Umsetzungspakete für OpenCode

## Arbeitsweise

Keine vollständige Neuentwicklung und kein Big-Bang-Redesign. Jedes Paket liefert einen benutzbaren, getesteten Teil des bestehenden Produkts. Bestehende Lösungen zuerst prüfen, fehlende Teile ergänzen. Keine endgültige Produktfreigabe aus „npm test grün“ ableiten.

Zuerst lokalen Zustand und Remote prüfen: `git status --short`, `git branch --show-current`, `git fetch origin`, Diff/Log zwischen Arbeitsbranch und aktuellem master. Keine uncommittete Arbeit verwerfen, kein blindes Checkout dieses älteren Review-Standes. Für Integration nur die Review-Dateien übernehmen oder den Dokumentationscommit gezielt cherry-picken. Konflikte in eigenen laufenden Änderungen auflösen, nicht durch Reset umgehen.

R00 → R01 → R02 → R03 → R04 → R05 → R06 ist die Produktstrecke. R07/R08 hängen von R00 und dem kanonischen Datenvertrag aus R06 ab; vorhandene Scanner-Arbeit kann vorher geprüft werden. R09 baut auf fertigen Kernabläufen auf. R10 begleitet alle Pakete; R11 schließt sie ab. Mindestens R02/R03/R04 müssen sichtbar geliefert sein, bevor ein weiterer reiner Scanner-Meilenstein als Gesamtproduktfortschritt bezeichnet wird.

## R00 — Reproduzierbarer Ausgangsstand (P0)

**Problem:** Unklare Live-Versionen, laufender PR und teils fehlerhafte/übersprungene Workflows.

**Arbeit:** Tatsächlichen aktuellen master, eigenen Branch, PR #120 und aktiven Deployment-SHA erfassen. Vollständige relevante CI-Jobs und Fehler lesen. Bestehende Reproduktion für die roten Browserfälle auf unverändertem Baseline-Stand prüfen. Fixture-/Timingfehler von Produktfehlern trennen. Laufende Retention-Automation separat untersuchen; keine Aussage „alle Workflows grün“ ohne deren Prüfung.

**Lieferung:** Baseline-Tabelle mit SHAs, URLs, Node-/Browser-Versionen, reproduzierbaren Befehlen, Testdatenmodus und Ergebnis. Visuelle Ausgangsbilder der neun Kernflächen mit Demo-/synthetischem Bestand.

**Abnahme:** Jede rote Stelle ist reproduziert oder ausdrücklich extern blockiert; keine stillen Skips. PR #120 ist als separat/offen oder tatsächlich integriert dokumentiert, nicht anhand des Titels als fertig gewertet.

## R01 — Identität und UI-Grundlagen vereinheitlichen (P1, Voraussetzung für sichtbare Arbeit)

**Orte:** AGENTS.md, PRODUCT.md, docs/design.md, src/styles.css, src/workspace.css, workspace-dom.ts, collector-polish.ts, aktive Logo-/Iconreferenzen.

**Arbeit:** E-Binder-Identität gemäß 02 herstellen und aktive widersprüchliche Regeln bereinigen. Historische Berichte nicht umschreiben, sondern als historisch kennzeichnen/verlinken. Kleine gemeinsame Token- und Komponentenbasis aus vorhandenen Implementierungen ableiten. Primär-/Sekundäraktionen, Filter, Sheet, CardTile, PriceLabel und Statusflächen konsistent.

**Abnahme:** Keine Rare-Room-Nennung im aktiven Produktpfad; Herkunft verwendeter E-Binder-Assets dokumentiert. Ein Komponenten-Testbild zeigt alle Button-/Status-/Sheetzustände. Gleiche Rollen verwenden gleiche Tokens. Kein neuer Font-/Framework-/Glas-Stack.

## R02 — Home und Navigation wirklich produktorientiert (P1)

**Orte:** home-view.ts, workspace.ts, vault-tabs.ts, Navigation im HTML, pwa.ts, passende CSS.

**Arbeit:** Fünf Ziele aus 02; Sammlung als Oberbegriff mit drei Unteransichten. Returning Home mit fortsetzbarer Binderseite/jüngsten Karten zuerst; erste Nutzung mit direktem Einstieg. Status-/Installationshinweise kompakt und ohne wiederkehrende Layoutverschiebung. Scroll-/Filterzustand pro Ziel erhalten.

**Abnahme:** J01/J02/J09 aus 04. Auf 390×844 ist bei gefülltem Bestand mindestens eine eigene Karte bzw. Binder-Vorschau ohne Scrollen sichtbar. Scan startet aus Home und Scan-Tab mit einem Tap vor ggf. notwendiger Betriebssystem-Berechtigung. Genau ein aktives Hauptziel; direkte Portfolio-/Binderlinks und Zurück funktionieren.

## R03 — Binder als Hauptprodukt (P1)

**Orte:** binder-view.ts, swipe.ts, sheet-gestures.ts, domain/navigation.ts, Binder-CSS.

**Arbeit:** Titel → Seite → Rail → Werkzeuge; Seitenverwaltung ins Kontextmenü. Direkte horizontale Fingerführung als gemeinsame Primitive, mit pointercancel, Richtungsentscheidung, Grenzseiten und Unterbrechung. DOM/Fokusreihenfolge muss sichtbare Reihenfolge widerspiegeln. Slotzuordnung erklärt verfügbare Exemplare, reservierte Exemplare und Planung.

**Abnahme:** J03. Ein 20-Seiten-Binder lässt sich vor/zurück durchblättern, aktive Vorschau bleibt sichtbar; unvollständige Geste ändert keine Seite; vertikales Scrollen und Slot-Tap funktionieren. Kein Exemplar doppelt zugeordnet, keine Besitzänderung beim Blättern. Der Browser darf Systemrandgesten behalten.

## R04 — Sammlung und einheitliches Kartendetail (P1)

**Orte:** collection-view.ts, collector-card-overview.ts, card-dialog.ts, card-market.ts, catalog-browser.ts und Binder-Slotdetail.

**Arbeit:** Artwork-first-Raster und gemeinsames kompaktes Detail für dieselbe Druckidentität; nur Kontextaktion unterscheidet sich. Filter/Sortierung bleiben beim Zurück erhalten. Besitzeditor und technische Details sekundär; Preislabel gemeinsam. JA-Name mit verifiziertem DE-Namen in Klammern. Bulk-Mode klar getrennt, Undo bei reversibler Änderung oder Folgenbestätigung bei Löschung.

**Abnahme:** J04/J08. Dieselbe Karte zeigt konsistente Set-/Nummer-/Sprach-/Variantendaten in allen drei Kontexten. Suche/Sortierung/Scrollposition nach Detail unverändert. Mengenänderung bleibt nach Reload erhalten und aktualisiert verfügbare Slots/Portfolio.

## R05 — Entdecken, Bilder und Setfortschritt (P1)

**Orte:** discover-view.ts, catalog-browser.ts, card-catalog.ts, japanese-catalog.ts, bestehender Bildservice und Coverage-Audits.

**Arbeit:** Bildgestützte Setgalerie, klare Sprache/Filter/Sortierung, Setdetail mit eindeutiger Fortschrittsdefinition. Gültige Quell-ID und Bildfallback pro Druck; keine Verwechslung mit gleichnamiger oder anderssprachiger Karte. Fehlende Bilder separat von fehlenden Katalogdaten behandeln. Abdeckung für gemeldete Problemsets einschließlich Zenith der Könige, Delta Herrschaft und 30th Classic Collection prüfen; Verfügbarkeit nicht aus Namen voraussetzen.

**Abnahme:** J05. Testweise kaputte URL ergibt stabilen Platzhalter und Retry, keinen falschen Druck. Duplikate erhöhen Stückzahl, nicht eindeutigen Setfortschritt. Fehlender Katalogeintrag ist benannt und als Datenaufgabe nachverfolgbar.

## R06 — Preise und Portfolio mit nachvollziehbarer Grundlage (P0 Daten / P1 Darstellung)

**Orte:** holding-prices.ts, domain/portfolio.ts, price-integrity.ts, portfolio-history.ts, portfolio-view.ts, card-market.ts.

**Arbeit:** Vorhandene Identitätsguards erhalten; einen gemeinsamen Quote-Vertrag und Preislabel durch alle Ansichten führen. Getrennte Darstellung von Trend/Katalog/NM/Graded und bekannten/unbekannten Dimensionen. Datenquelle auf tatsächliche NM-Fähigkeit prüfen; fehlende NM-Daten transparent offenlassen statt falscher Genauigkeit. Portfolio auf Wert + Abdeckung + echte Historie konzentrieren; Erklärung/Aufschlüsselung nachgeordnet. Cache-/Quellenabweichungen gegenüber Entdecken reproduzieren.

**Abnahme:** J06, exakte Mengenarithmetik und gleiche Quelle/Basis/Identität. Regressionen für falsche Sprache, falsches Set, normal/holo/reverse, unbekannte Variante, fehlenden Preis und FX-Zeitpunkt. Kein Cent-Fallback einer anderen Karte. Historie wird bei nicht vergleichbarer Signatur nicht verbunden. Ein fehlender NM-Datenvertrag bleibt als blockierter Teil dokumentiert und verhindert die Behauptung „NM-Preise fertig“.

## R07 — Live-Scanner, Queue und Binderprüfung (P0)

**Orte:** live-scan.ts, live-page-scan.ts, add-cards.ts, page-scan.ts, scan-progress.ts, vorhandene Resolver/Worker.

**Arbeit:** PR #120 am aktuellen Head technisch und mit Tests bewerten; brauchbare Stages/Gates übernehmen statt überschreiben. Kontinuierliche Kamera, gemeinsame begrenzte Queue, sichtbarer Zustand je Aufnahme, wiederverwendete Worker. Normalpfad ohne Zuschnittzwang; optionale Korrektur für schwierige Geometrie. Einzel/Binder-UI teilen Status-/Reviewkomponenten. Kompakte Top-3 und kontrollierte Sammelbestätigung.

**Abnahme:** J07. 20 unterschiedliche aufeinanderfolgende Testaufnahmen ohne erzwungenen Kameraneustart oder verschwindende Queue; Backpressure nachvollziehbar; keine falsche Besitzübernahme. Binder erhält alle neun Positionen einschließlich leerer/unklarer Slots. Echte Kameraqualität zusätzlich in R08 abnehmen.

## R08 — Visuelle Erkennung und Datenqualität (P0)

**Orte:** visual-retrieval, visual-search/worker, scan-auto-resolve, scan-evidence-fusion, Referenzindex-/Datasetpipeline; bestehenden P0-Plan weiterverwenden.

**Arbeit:** Coverage nach Sprache/Set/Printing inventarisieren; kanonische IDs aus R06. Modell/Preprocessing/Manifest/Index versionieren. Private freigegebene Daten unabhängig labeln, Dubletten/Train-Test-Leakage vermeiden; kein Training auf unbestätigten eigenen Vorhersagen. Visuelle Kandidaten und Footer-OCR zusammenführen; irrelevante Open-Set-Treffer ablehnen. Roboflow-Bilder als zulässige Datenquelle/Referenz nach bestehendem Auftrag, keine zwingende bezahlte Inferenz.

**Abnahme:** Gehaltenes DE/EN/JA-Testset mit Sprache, Coverage und schwierigen Fällen; Top-1/3, Falschtreffer, Rejects, Geometriefehler und kalte/warme Latenz separat. Akzeptanzziele aus 04 vor Tuning festschreiben. Kein „allgemein aktiv“ mit neun Pilotkarten. Funktionierender Offline/OCR-Fallback.

## R09 — Vertrauen, Profil und Wiederkehr (P1)

**Orte:** profile-view.ts, backup-dialog.ts, PWA/Storage/Cloud-Integration.

**Arbeit:** Version/Commit und Updatepfad sichtbar im Profil. Export/Import mit Vorschau, Validierung und sicherem Umgang mit bestehendem Besitz. Demo, lokal und Cloud nicht vermischen. Berechtigungs-/Offline-/Speicherfehler mit verständlicher Erholung. Beta-Opt-in inklusive Widerruf, Aufbewahrung und nachvollziehbarem Status erhalten.

**Abnahme:** J09. Backup-Roundtrip erhält Identitäten, Mengen und Slots. Abgebrochener/ungültiger Import verändert nichts. Update behält Bestand. Keine automatische private Bildspende.

## R10 — Visuelle, barrierefreie und mobile Qualität (P1, pro Paket)

**Arbeit:** Reale Screenshots statt allein DOM-Assertions: 320/390/430 px, Tablet 800/1280 px, Landschaft, 200 % Text/Zoom, lange DE-/JA-Namen, helle Kartenbilder, Fehler-/Leer-/Ladezustände. Alle interaktiven Ziele ≥44×44 CSS px gemäß Produktvertrag; Kontrast, Fokus, Dialoge und lesbare Quelle prüfen. Material on/off auf realem iPhone und Galaxy vergleichen.

**Abnahme:** J10. Keine verdeckten CTAs, kein seitlicher Überlauf, kein Textabschneiden wichtiger Identität, keine Drei-Zeilen-Primärbuttons. Reduced Motion bleibt vollständig bedienbar. Materialfallback ohne Funktionsverlust. Reale Gerätemessung ausstehend heißt „ausstehend“, nicht „passt“.

## R11 — Integration und überprüfbarer Release (P0 Abschluss)

**Arbeit:** Aktuellen master integrieren; alle Paketnachweise auf gemeinsamem Head prüfen. `npm run check` und passende Playwright-Projekte laufen lassen. Bestehende CI-Gates/Workflows beachten. Release nur gemäß geltender Owner-Freigabe; die Review-Branch-Erstellung selbst ist kein Releaseauftrag. Ausgelieferte Version einschließlich Service Worker gegen Release-SHA verifizieren.

**Abnahme:** Keine offenen P0-Fehler, alle relevanten R01–R10-Kriterien nachgewiesen oder Releaseumfang ausdrücklich eingeschränkt. Keine übersprungenen Deployjobs als Erfolg melden. Echter Link + SHA + verbleibende Grenzen im Abschlussbericht. Keine pauschale Konkurrenzparität behaupten, solange reale Nutzungs- und Erkennungsabnahme fehlen.
