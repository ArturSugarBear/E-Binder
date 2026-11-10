# Übergabeprompt – vollständigen Interaktionsaudit fortsetzen

> Dieser Zweig ist absichtlich WIP und als Draft zu behandeln. Kein Merge allein aufgrund grüner Bestandstests. Der Benutzer hat die sichere Veröffentlichung des geprüften Stands autorisiert und möchte den umfassenden UX-Audit in der nächsten Sitzung fortführen.

## Auftrag für die nächste Sitzung

Arbeite im Repository `ArturSugarBear/E-Binder`. Lies zuerst `AGENTS.md`, [den bisherigen Audit](../interaction-audit-2026-11-10.md) und [die vollständige Collectr/HoloGem-Auswertung](../../benchmarks/competitors/2026-11-10/ANALYSIS.md). Verwende passende Design-Mentor-Audit-/Verify-Workflows. Rare Room V2 (B), originale Vektorpfade, native Schriften, Lime und die physische 3×3-Binderseite beibehalten. Übernimm Interaktionsprinzipien, keine Konkurrenz-Markenassets.

Der Benutzer verlangt Playwright-Prüfungen für jede erreichbare Interaktion: alle Schaltflächen, Suchfelder, Eingaben, Filter, Dialogaktionen, Gestenalternativen und Rückwege. Prüfe sinnvolle Ergebnisse, Nutzerverständnis, tatsächliche Speicherung, Reload und Schutz eigener Daten. Bestehende grüne Tests allein reichen ausdrücklich nicht. Arbeite die offenen Kontrollfamilien des Audits systematisch ab und führe eine Matrix **Kontrolle → Aufgabe → tatsächliches Ergebnis → Test → offen/bestanden**. Keine erfundene Vollständigkeitsquote.

## Bereits erledigt und nicht wiederholen

- Drive-ZIP integriert: `docs/benchmarks/competitors/2026-11-10/`; 18 Originalmedien mit SHA-256 validiert. Alle sechs Videos anhand vollständiger Zeitraster und Detailsequenzen, sechs Screenshots und sechs Kontaktbögen ausgewertet. `node scripts/verify-competitor-media.mjs` muss weiterhin 18/18 liefern.
- #39: im Scanner reale offene Anzahl und erreichbarer Review auch bei verweigerter Kamera, explizite Besitzbestätigung und wahrheitsgemäße Rückmeldungen.
- #37: Home/Entdecken/Scan/Vault/Profil; 22 Originalseiten im Binder durchsuchen, vollständig ansehen und bewusst planen; echte Original-Demoseite mit neun Positionen; expliziter Demo-Neustart und geschützter persönlicher Bestand. Wunsch-Sprachen und Duplikate, Pflichtfeld-Leerzeichen, 44-px-Schließen, Desktop-Wunschliste, Scan-Beschriftung und mobiler Glaskontrast korrigiert.
- #38: exakte geprüfte Kartengrafik, sichere Logo-/Symbolrückfälle und ehrliche kompakte Zeilen ohne verfügbare Abbildung.
- Neues `navigation.ts` bedient echte sichtbare Desktop-/Mobilwege. Auf Mobilgeräten sind Sammlung → Binder → Karten zwei History-Schritte. Bestandstests verwenden eine explizite Ausgabe über reale manuelle Eingabe; sie dürfen nicht vom ersten Live-Suchtreffer abhängen.
- Live-Katalogprobe ohne API-Mocks: Suche Pikachu lieferte in Chromium und WebKit 18 Treffer. Home, Demo-Binder und Vorlagengalerie bei 390×844/reduzierter Bewegung: sechs axe-Prüfungen ohne Befund, kein horizontaler Überlauf. Das ersetzt keine vollständige Bedienprüfung.
- Echter Supabase-Pilot getestet: Registrierung, Anmeldung, lokalen Bestand übernehmen/erneuten Import verweigern, Synchronisieren, zweiter Browser, öffentliche schreibgeschützte Seitennavigation, Widerruf, Konflikt, heruntergeladener Konfliktstand, explizit bestätigtes Cloud-Laden, gerätelokales Abmelden und anonymer Originalbestand. Genau ein künstliches Konto angelegt und anschließend anhand ID UND synthetischer E-Mail gelöscht. Nachkontrolle: null zugehörige Profile/Workspaces/Binder, wieder zwei vorhandene Konten. Zugangsdaten außerhalb des Repos wurden gelöscht. **Keine alten Zugangsdaten suchen oder bestehende Benutzerkonten verwenden.**

## Nächster konkreter UX-Befund

Die Demo ist jetzt inhaltlich belegt, ihre ersten Karten beginnen auf einem schmalen Display aber unterhalb des sichtbaren Bereichs. Demo-Banner, Vault-Tabs, Seitenüberschrift und Werkzeugleisten beanspruchen den Einstieg. Das ist eine beobachtete Layoutfrage, kein behaupteter Datenfehler. Siehe [WebKit-Aufnahme](binder-entry-webkit.png) und die beiden Messdateien neben diesem Dokument.

`E2E_BASE_URL=<preview>/E-Binder/ node scripts/probe-binder-entry.mjs` reproduziert mit einer isolierten Demo. Mit `E2E_BROWSER=webkit` die zweite Engine prüfen. Zuerst eine sinnvolle mobile Einstiegshierarchie festlegen, dann eine aussagekräftige Sichtbarkeits-/Bedienprüfung ergänzen. Besitz, Demo-Trennung, neun Plätze und erreichbare Seitenaktionen dürfen dabei nicht verschwinden.

## Danach priorisieren

1. Binderverwaltung und alle Platzaktionen, danach Such-/Filter-/Sortierfamilien von Sammlung und Wunschliste; tatsächliche Reservierungen, Tauschschutz, Sprachen, Undo und Reload prüfen.
2. **Sichtbare** Upload- und Backup-Schaltflächen mittels `filechooser` bedienen. Vorhandene Tests mit direktem `setInputFiles` beweisen den Einstieg nicht. 31 offene Aufnahmen, Mehr-Anzeigen, Entfernen/Abbrechen/Fortsetzen sowie alle neun Seitenscanpositionen ergänzen.
3. Katalogfacetten/Nulltreffer/Zurücksetzen/Preisabbruch/Paging, Portfolio-Neuabruf/weitere 40 und alle Ziele. Deterministische Fehlerfixtures und echte Dienstproben getrennt ausweisen.
4. Ungültige/erneut ausgewählte Backups, Bestätigung/Ersetzen/Undo/Reload, Kontofehler und Offline-/Update-/Installationszustände. Frühes Öffnen der Vorlagen bei noch ladendem/fehlgeschlagenem Katalog prüfen.
5. Archiv, Browser-Zurück, Tastatur/Fokus, Touch-Alternativen, 320/390 px und reduzierte Bewegung. Vorhandene plattformspezifische Skips und fehlenden physischen iPhone-Nachweis ehrlich benennen.

## Ausführung und Arbeitsstand

- Branch: `wip/interaction-audit-followup-20261110`. Der Unterschied zum ausgelieferten Master besteht aus diesem Übergabepaket und einem Diagnosewerkzeug; der vollständige Audit ist noch offen.
- Nach frischem Checkout: `npm ci`, `npm run check`, Medienverifikation und passende Browserprüfungen. Playwright installiert Chromium und WebKit. Nicht mehrere Runner mit demselben Ergebnis-/Reportverzeichnis starten.
- Nur falls die alte Cloud-Arbeitsumgebung weiterlebt: Worktrees unter `/workspace/E-Binder*`; geprüfte Vorschau des kombinierten Builds unter Port 4177. Neu starten/neu bauen, wenn Pfade oder Prozesse fehlen. Keine Abhängigkeit von Scratch-Dateien voraussetzen.
- In jener Umgebung benötigte WebKit lokal nachinstallierte Bibliotheken und `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`; CI nutzt `playwright install --with-deps`. Nicht pauschal Hostprüfungen in regulärer CI deaktivieren.
- `scripts/smoke-cloud.mjs` ist ein **expliziter** Live-Test mit einem temporären Pilotkonto, keine automatische CI-Aufgabe. Backend ist durch `cloud.config.json` tatsächlich konfiguriert; leere VITE-Variablen deaktivieren es nicht. Für Live-Anmeldung `localhost`/`127.0.0.1` Port 4173 oder die Pages-Origin verwenden (Register-CORS). 16-Konten-Limit respektieren, nur eigene neue Test-ID aufräumen; niemals bestehende Nutzerdaten ändern. Supabase-Skill vor Backend-Arbeit lesen.
- Fertige Änderungen prüfen und gemäß Benutzerauftrag sicher auf Master veröffentlichen; WIP als Draft sichern. Keine ungeprüften Merges, kein Force-Push auf Master. Eine Deployment-Erfolgsmeldung erst nach grünem Lauf und Prüfung der tatsächlich ausgelieferten Seite.

Der endgültige Merge-/Deploynachweis wird vor Ende dieser Sitzung unten ergänzt.
