# Übergabe: E-Binder

Stand: 9. November 2026. Repository `/workspace/E-Binder`, GitHub CLI `gh-e-binder` ist autorisiert. Niemals Tokens ausgeben oder Force-Push verwenden. Nutzer wünscht geprüfte fertige Änderungen auf **master und GitHub Pages**, zusätzlich einen aktuellen Arbeitsstand auf `codex/workspace-update`. ChatGPT-Nutzungskontingent kann hier nicht ausgelesen werden; keine Zahl erfinden.

## Veröffentlicht vor dieser Änderung

`caee3ae` auf master und Arbeitszweig. Publish `42618435408` erfolgreich, 56 Unit-Tests und 133 Browserprüfungen bestanden, zwei erwartete Skips. Echter Konto-/Wiederlade-/anonymer Freigabetest auf der ausgelieferten Seite bestanden. Temporäre Testkonten abgemeldet und gelöscht; frühere private Fixturedateien nicht wiederverwenden.

## Aktuelle Aufgabe: Karten über Sets entdecken

- Eigenständiger Bereich `#entdecken`: Setlogos, DE/EN/JA, Suchbegriffe einschließlich englischer Setnamen, alle Sets schrittweise erreichbar, Reihenfilter mit tatsächlicher `/series/{id}`-Mitgliedschaft.
- Wiederverwendeter Katalogbrowser: Set/Illustrator/Seltenheit, Nummer/Name/EUR-Preistrends, Kartenvorschau, Wunschliste und Übergabe an bestehende Besitzbestätigung. URL enthält nur öffentliche Katalogfilter, keine Besitzdaten/Fotos. Zurück/Wiederladen erhält Filter und Trefferseite.
- Root behält die aktive Entdecken-Ansicht bei Bestands-/Wunschänderungen bei. Mengen und Wunschstatus werden aktualisiert. Keine Framework-/Backendänderung.
- Neue deterministische Browsertests prüfen vollständige Setnavigation, echte Reihenmitgliedschaft, URL/Paginierung, Wunsch ≠ Besitz, Bestandsbestätigung, Sprachwechsel/320px/axe und Wiederholung nach Katalogausfall.
- **Noch zu erledigen bei Erstellung dieser Notiz:** `npm run check` läuft; passende Browserprüfungen, Handprüfung der Oberfläche, anschließend master-Push, Actions und Live prüfen. Diese Notiz vor finalem Commit aktualisieren.

## Verbindliche Datenregeln

Fotos sind ausschließlich temporäre Scan-Eingaben. **Keine Foto-Bytes in Supabase, IndexedDB oder Exporten.** Lokale Dialog-Map wird beim Zuordnen/Schließen verworfen. IndexedDB v2 enthält nur Metadatenzustände; alte Fotostores werden gelöscht. `metadataOnlyState` entfernt lokale Fotoverweise, Legacy-Fotozeilen werden ohne Dekodieren verworfen. Supabase-Constraints verbieten lokale Fotoverweise und Inlinebilder. Externe Katalogbilder bleiben externe URLs. TOAST komprimiert JSONB; ein visueller Suchindex ist noch nicht implementiert. Scanning bleibt eine bestätigungspflichtige Hilfe, keine perfekte Erkennung.

## Supabase / Hosting

Projekt `hmgydjfkvehvdwvdftca`, Frankfurt, aktiv. `cloud.config.json` enthält ausschließlich öffentliche URL/Publishable Key. GitHub-App kann Repository-Secrets nicht setzen (403); sichere öffentliche Clientkonfiguration ist der bewusste Fallback. Privilegierte Schlüssel ausschließlich Supabase-Runtime. Keine erneute Login-Schleife starten.

Benutzername/Passwort über synthetischen internen E-Mail-Alias; Edge-Registrierung begrenzt. RLS, privater versionierter JSONB-Workspace, atomare Binderprojektion, Konflikterkennung implementiert. Alte Storage-Policies deaktiviert, letzter tatsächlicher Objektbestand null; keine Bild-Uploads ergänzen. Backendänderungen nur mit Supabase-Skill. Öffentliche Binder nur nach ausdrücklicher Freigabe.

## Entwicklung / Tests

Native TypeScript-/DOM-App mit Vite; kein Frameworkwechsel. `docs/design.md`: Cyan ist der neueste gewählte Primärakzent (Orange wurde ausdrücklich abgewählt). Bestehende Komponenten wiederverwenden. `npm run check` vor Veröffentlichung. Playwright Chromium und Mobile: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`; WebKit lokal mit `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` lauffähig. Das überspringt nur die falsche Host-Preflightprüfung, nicht die Ausführung. CI installiert Browserlibs normal.

Nicht während laufender Browserprüfungen `dist` neu bauen. Keine parallelen Playwright-Läufe mit demselben Ausgabeordner. CI `.github/workflows/pages.yml` prüft alle Browser vor Pages-Deploy. Nach Push Action und tatsächliche Live-Seite prüfen.

## Collectr / Evidenz

REA, Ponytail und Impeccable wurden zuvor anhand ihrer Originalquellen angewendet. `docs/research/collectr.md` dokumentiert tatsächlich beobachtete öffentliche Setnavigation; native Scanarchitektur bleibt unbekannt. Nicht aus öffentlich sichtbarer UI auf ein bestimmtes ML-Modell schließen. Diese Erweiterung verwendet die vorhandenen REA-Beobachtungen, keinen behaupteten neuen nativen App-Zugriff.

Originalfotos echter Fehlversuche fehlen weiterhin; Gerät des Nutzers: iPhone 13 Pro Max, Safari/Chrome. Automatische Lokalisierung und visueller Merkmalsindex sind offene Hypothesen. Keine erfundenen Erkennungsquoten, Sammlerstudien oder physischen Binderaufbauten. Skilloriginale und Diagnoseartefakte liegen außerhalb Repo unter `/workspace/scratch/`; persönliche Daten niemals veröffentlichen.
