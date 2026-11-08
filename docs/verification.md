# Verifikation der Webapp-Migration

Stand 8. November 2026.

## Ausgeführt

- `npm run check`: Formatierung, ESLint, 21 Unit-Tests, strenge TypeScript-Prüfung, Schema- und WebP-Validierung sowie Vite-Produktionsbuild erfolgreich.
- 57 Playwright-Prüfungen erfolgreich gegen die erzeugten Build-Dateien im Artefakt-Harness. Ein ausschließlich mobiler Swipe-Test wurde im Desktop-Projekt erwartungsgemäß übersprungen.
- Alle 22 Kapitel, 198 Kartenbilder, Kartennummern und zugeordneten Cardmarket-URLs in Chromium Desktop und Chromium mit iPhone-13-Profil geprüft.
- Deep Link, Browser Zurück/Vorwärts, Pfeiltasten, Dialogfokus und Fokus-Rückgabe, HTTP-Fehler mit erneutem Laden, ungültige Daten, Lazy Loading, 320-Pixel-Layout und reduzierte Bewegung geprüft.
- axe-Prüfung für Standard- und Greninja-Seite sowie deren Dialoge ohne gemeldete Verletzungen der geprüften WCAG-A/AA-Regeln.
- Laufende Vite-Vorschau im separaten Cloud-Browser geöffnet; Standardseite, Greninja-Gestaltung und Kartendialog visuell geprüft.
- `npm audit --omit=dev --audit-level=high` meldete keine bekannten Schwachstellen der Produktionsabhängigkeiten zum Prüfzeitpunkt.

## Noch offen vor der ersten Veröffentlichung

- GitHub-Workflow mit echter HTTP-Auslieferung und den konfigurierten Chromium- und WebKit-Projekten ausführen.
- Erfolgreiche Pages-Veröffentlichung und öffentlichen Produktionsstand kontrollieren.

Der lokale Playwright-Prozess erreicht den verwalteten Vorschauhost in dieser Umgebung nicht. Deshalb nutzen die lokalen Browser-Prüfungen die echten Build-Dateien über Playwright-Routen. Der separate Cloud-Browser erreicht die laufende Vorschau. Diese Prüfungen bestätigen nicht den späteren GitHub-Actions-Lauf oder WebKit. Die externen Cardmarket-Angebotsseiten sind nicht Bestandteil der automatischen Suite.
