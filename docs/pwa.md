# E-Binder als Progressive Web App

E-Binder ist eine kostenlose Progressive Web App (PWA). Es wird weder der App Store noch ein kostenpflichtiges Apple-Entwicklerkonto benötigt.

## Auf dem iPhone installieren

1. https://artursugarbear.github.io/E-Binder/ in **Safari** öffnen.
2. Auf **Teilen** tippen.
3. **Zum Home-Bildschirm** wählen (ggf. in der Teilen-Ansicht nach unten scrollen).
4. Falls angeboten, **Als Web-App öffnen** aktivieren.
5. **Hinzufügen** tippen. Danach über das E-Binder-Symbol starten.

Bereits im Standalone-Modus erscheint keine Installationshilfe mehr. Ohne Installation bleibt die normale Website funktionsfähig. Browser mit Chromium-Installationsfunktion erhalten einen eigenen Installieren-Button.

## Navigation auf dem iPhone

Die dauerhaft erreichbare untere Leiste nutzt fünf eindeutige Ziele: **Sammlung** links, **Entdecken**, **+ Karte** als hervorgehobene Hauptaktion in der Mitte, **Binder** und **Profil** rechts. Profil öffnet den vorhandenen Konto- und Anmeldedialog; angemeldete Nutzer verwalten dort ihr Konto. Die Wunschliste bleibt über das Herzsymbol im Kopfbereich erreichbar und die Sicherung über das Downloadsymbol. Auf größeren Desktop-Bildschirmen bleibt die bestehende horizontale Navigation erhalten. Auf iPhones berücksichtigt die Leiste den Home-Indikator und wird bei geöffneten Eingabefeldern oder Dialogen ausgeblendet.

## Offline-Unterstützung

Nach einem erfolgreich abgeschlossenen ersten Online-Aufruf installiert der Browser einen Service Worker. Die App-Oberfläche einschließlich Hauptanwendung, Inspirationsarchiv, Schriftdateien und lokaler Inspirationsdaten wird vorgehalten. Vorher bereits in **diesem Browser und dieser Website-Installation** gespeicherte Binder und Bestände bleiben über IndexedDB zugänglich. Das Cache-System ist **kein Backup**. Unter iOS können Safari- und Home-Screen-Web-Apps getrennte Datenspeicher haben: Bei der ersten Installation sind bestehende Safari-Gastdaten eventuell nicht automatisch verfügbar. Daher vor der Installation/bei Gerätewechsel die Sicherungsfunktion verwenden und die Daten gegebenenfalls bewusst wiederherstellen.

Bilder bereits besuchter Karten und zuvor abgerufene Katalogantworten werden in begrenztem Umfang zwischengespeichert. Nicht besuchte Karten, Online-Katalogsuche, Login, Kontoerstellung, Teilen und Cloud-Synchronisation benötigen eine Internetverbindung. Offline erstellte lokale Änderungen verbleiben auf dem Gerät; beim Cloud-Konto wird ein nicht synchronisierter Zustand wie bisher angezeigt. Bei knappen Speicherressourcen darf das Betriebssystem den Cache oder unter Umständen auch Web-App-Daten löschen. Regelmäßig eine JSONL-Sicherung exportieren.

Das OCR-Modell (~11 MB) wird **nicht** beim ersten App-Start offline gespeichert, sondern erst beim tatsächlichen Erkennungsversuch angefordert. Die WebAssembly-Laufzeit und das Modell müssen bei der ersten Verwendung online geladen werden; spätere Offline-Verfügbarkeit ist abhängig von den Browser-Caches. Die Erkennung lädt Fotos nicht in die Cloud.

## Update-Verhalten

Wenn eine neue Version veröffentlicht wird, zeigt die App einen dezenten Hinweis mit **Jetzt aktualisieren**. Das Update erfordert eine explizite Aktion; es gibt keine automatische Übernahme während der Bearbeitung. Bei einem offenen Bearbeitungsdialog, aktivem Eingabefeld, laufendem oder fehlgeschlagenem Speichern verhindert die Aktualisierungsaktion das Neuladen. Dialog schließen, Änderungen speichern bzw. bei Fehlern sichern und erneut auf **Erneut prüfen** tippen.

Die Seite startet danach mit der bestehenden URL einschließlich Seitenroute. Persistierte lokale Daten werden aus IndexedDB geöffnet. Aus Sicherheitsgründen werden persönliche Zustände, Zugangsdaten, Token und Supabase-Antworten nicht im Workbox-Cache gespeichert.

## Engineering

- Vite PWA / Workbox generiert einen versionierten Precache für die App-Shell und das Archiv. Der Gültigkeitsbereich ist auf den Vite-Basispfad /E-Binder/ beschränkt.
- Limitierte Laufzeit-Caches: lokale Kartenbilder (160/30 Tage), TCGdex-Bilder (180/30 Tage), öffentliche GET-Katalogantworten (120/24 Stunden), bedarfsweise OCR-Ressourcen (2/60 Tage).
- Keine App-Cache-Regeln für Supabase-Hosts, GraphQL-POST, private Fotos oder Authentifizierungsantworten.
- Die App-Icons (180, 192, 512 sowie 512 maskable) werden deterministisch beim Build erzeugt; keine neuen Laufzeit-Abhängigkeiten.
- Qualitätsprüfungen: npm ci, npm run check, npm run test:e2e. Der Build enthält eine Manifest-/Icon-/Pfad-/Worker-Prüfung.
- Desktop-WebKit-Tests sind kein Ersatz für einen Test auf einem echten iPhone. iOS-Home-Screen-Installation, sichere Datenübernahme aus Safari und Speicherbereinigung müssen auf einem realen Gerät geprüft werden.

Deployment bleibt auf dem bestehenden GitHub-Pages-Workflow. Eine PWA-Änderung auf einem Feature-Branch ist nicht live, bis der Pull Request ausdrücklich auf master übernommen und der Pages-Workflow erfolgreich ausgeführt wurde.
