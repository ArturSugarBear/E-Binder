# Architektur

## Ziel und Grenzen

E-Binder ist eine öffentliche, statisch auslieferbare Webapp zum Betrachten und Teilen einer redaktionellen Sammlung. Der Browser lädt ein validiertes Datenpaket und nur die jeweils benötigten Bilder. Alle 22 Kapitel und 198 Karten bleiben beim Umbau inhaltlich unverändert.

## Entscheidungen

- **TypeScript im Strict-Modus** macht Datenverträge und ungültige Zugriffe sichtbar. `noUncheckedIndexedAccess` erzwingt die Behandlung von Navigationsgrenzen.
- **Vite** übernimmt Entwicklungsserver, Bündelung, Minimierung, Quellkarten und den Projektpfad `/E-Binder/`. Generierte Dateien gehören nach `dist/` und nicht in die Quellcodeverwaltung.
- **Native DOM-Komponenten** passen zum begrenzten Zustand aus Kapitel, geöffneter Karte und Ladezustand. Das native `dialog` stellt Fokusbegrenzung und Escape bereit. Ein größeres UI-Framework ist erst bei wachsender Bearbeitungs- oder Kontofunktionalität neu zu bewerten.
- **Zod** ist die einzige Laufzeitabhängigkeit. Ein gemeinsames Schema validiert Inhalte beim Build und nach dem Laden. Karten-IDs können keine Dateipfade enthalten; externe Produktlinks sind auf das erwartete Cardmarket-Format beschränkt.
- **Getrennte Verantwortlichkeiten** halten reine Regeln in `domain`, Netzwerkanfragen in `data` und Browserdarstellung in `ui`. Das Domain-Modul kennt weder DOM noch Netzwerk.
- **Explizite Zustandsbesitzer** ersetzen globale veränderbare Variablen. Der Controller besitzt das aktive Kapitel, der Dialog seine Kartenauswahl, der Einstieg den Ladevorgang. Die App wird nach erfolgreichem Laden einmal montiert.
- **URL als Navigationsschnittstelle** erhält `#kapitel-N` und `#greninja`. Explizites Blättern erzeugt Verlaufseinträge; Zurück/Vorwärts rendern ohne neue Einträge. Andere Seitenanker verändern das aktuelle Kapitel nicht.
- **Ein Build für Test und Veröffentlichung** verhindert, dass ein anderer Dateistand als der geprüfte veröffentlicht wird. Der Deploy-Job hängt vom erfolgreichen Check-Job ab.

## Datenfluss

`collection.json` → HTTP mit Timeout → Laufzeitvalidierung → Kapitelcontroller → Kartenansicht oder Dialog.

Fehlerhafte HTTP-Antworten, ungültiges JSON und Schemafehler führen zu einem sichtbaren Fehlerzustand mit Wiederholungsmöglichkeit. Parallele Ladevorgänge durch Mehrfachklicks werden verhindert. Alle redaktionellen Texte werden über `textContent` ausgegeben. Nur fest definierte interne SVG-Pfeile verwenden `innerHTML`.

## Wartung

Neue Kapitel brauchen neun Karten und drei Cover aus demselben Kapitel. Karten werden über stabile IDs zu ihren WebP-Dateien zugeordnet. Vor einer Inhaltsänderung müssen Kartennummer, Set und Cardmarket-Produkt fachlich geprüft werden; Syntaxprüfung ersetzt diese Prüfung nicht.

Tests decken Eingabevalidierung, Navigationsgrenzen, Gestenerkennung und sichtbare Nutzerabläufe ab. Barrierefreiheit wird automatisch mit axe sowie manuell an Fokusführung und Darstellung geprüft. Automatische Prüfungen allein sind keine vollständige WCAG-Zertifizierung.

## Bewusste Produktgrenzen

Es gibt derzeit keine Benutzerkonten, persönliche Bestandsverwaltung, Schreib-API, Datenbank, automatischen Preisabruf oder installierbare Offline-PWA. Diese Funktionen wurden nicht beauftragt. Eine künftige persönliche Sammlung benötigt ein separates Persistenz- und Berechtigungskonzept. Ein Service Worker sollte erst mit einer geklärten Update- und Cache-Strategie ergänzt werden.
