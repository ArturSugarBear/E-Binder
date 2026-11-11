# E-Binder: abschließendes Produkt- und Integrationsreview

Stand: 11. November 2026. Ausgangspunkt ist der veröffentlichte `master`
`0d10b8baee99c2fbfe08a7d0bee9d9dbbad82ca7`. Die zuvor offenen PRs sind integriert;
beim abschließenden Abruf gab es keine offenen PRs. Dieses Review ersetzt die
offenen Aufgaben des [Premium-Zwischenstands](../HANDOFF-2026-11-10-premium.md).

## Ergebnis und Prüfbereich

Die geprüften Kernabläufe sind benutzbar: erster Scan, Foto-Fallback bei
verweigerter Kamera, neun prüfbare Binderfächer, ausdrückliche Besitzbestätigung,
Binder/Karten/Portfolio-Navigation, verzögertes Nachladen von Preisen sowie
Offline-Einstieg. Die Rare-Room-Identität bleibt erhalten. Das mobile Dock,
die klare Scan-Hauptaktion, Kartenmotive und aufgabenbezogene Animationen greifen
die dokumentierten HoloGem-Prinzipien auf.

Das ist eine technische und visuelle Prüfung, kein Nachweis, dass E-Binder bei
Erkennungsquote, Geschwindigkeit oder Bedienbarkeit HoloGem übertrifft. Eine
physische iPhone-Kamera wurde in diesem Review nicht getestet.

## Gefundene und behobene Fehler

| Priorität | Befund und Auswirkung                                                                                                                                    | Korrektur und Nachweis                                                                                                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hoch      | Der Portfolioverlauf lag nur unter `personal`/`demo`. Auf demselben Browser konnten Konten mit identischem Bestand fremde historische Summen übernehmen. | Neue v3-Schlüssel enthalten die stabile Konto-ID beziehungsweise einen getrennten lokalen Bereich. Nicht zuordenbare v2-Historie wird nicht übernommen; der Verlauf beginnt neu, Karten und Binder bleiben erhalten. Regression prüft zwei Konten, lokalen Bestand, Demo und Altbestand. |
| Mittel    | Der Wechsel von Cardmarket-Trend zu einem Durchschnittspreis konnte trotz anderer Berechnungsgrundlage als Wertentwicklung verbunden werden.             | Vergleichssignatur berücksichtigt zusätzlich die Preisgrundlage pro Ausgabe. Regression prüft den Wechsel von `trend` zu `avg7`.                                                                                                                                                         |
| Hoch      | Fehlgeschlagene Set-Detailabfragen wurden im Release-Audit durch `allSettled` verschluckt. Ein Quellenausfall konnte als fehlende Grafik erscheinen.     | Wiederholungsversuche für vorübergehende Fehler; dauerhaft fehlende Metadaten erzeugen einen Auditfehler und Exitcode 1. Der Deployment-Schritt bleibt gesperrt. Offline-Vertragstest führt den echten Auditbefehl mit ausgefallenem Provider aus.                                       |
| Mittel    | Bei drei Sekundärdatensätzen mit gleicher Sammlernummer konnte ein zuvor verworfener mehrdeutiger Eintrag erneut gültig werden.                          | Bereits vorhandene Schlüssel bleiben mehrdeutig, auch nach weiteren Treffern. Test mit drei Duplikaten und einer eindeutigen Nachbarkarte.                                                                                                                                               |
| Mittel    | Im mobilen Menü wurde das aktive Profil weder markiert noch als aktuelle Seite angekündigt.                                                              | Profil verwendet denselben Navigationslink und `aria-current` wie die übrigen Ziele. Browserprüfung kontrolliert Profil und anschließenden Wechsel zu Home.                                                                                                                              |
| Niedrig   | Rotierte Inspirationskarten verdeckten auf Desktop den Hinweis auf fehlenden Eigenbesitz.                                                                | Ausreichend vertikaler Raum im Desktop-Artwork; das kompakte mobile Layout bleibt bestehen. Visuelle Prüfung nach Bildladung.                                                                                                                                                            |

Betroffene Implementierung: [Portfoliohistorie](../../src/data/portfolio-history.ts),
[Portfolioauswertung](../../src/domain/portfolio.ts),
[Bilder-Audit](../../scripts/audit-catalog-art.mjs),
[Navigation](../../src/ui/workspace.ts) und [Layout](../../src/workspace.css).

## Bilder: tatsächliche Abdeckung

Der primäre Katalog im Code ist **TCGdex**. Für exakt zugeordnete Ausgaben kommt
der Sekundärindex aus `PokemonTCG/pokemon-tcg-data`; zugelassene Bildhosts sind
TCGdex, PokémonTCG und Scrydex. Englisches Ersatzartwork wird sichtbar als solches
gekennzeichnet. Es verändert weder Kartensprache noch bestätigten Besitz.

Der reale Auditlauf vom 11. November prüfte:

- 198 mitgelieferte Kartenbilder auf vorhandene, nicht leere Dateien.
- 221 englische Sets und ihre deutschen Gegenstücke. Die 156 deutschen Sets
  waren beim Abruf vollständig in dieser Setmenge enthalten.
- 170 eindeutig zugeordnete Sekundärsets mit Kartenindizes und erreichbaren
  alternativen Setgrafiken.
- 155 Sets mit erreichbarem primärem Logo. Kein primäres Symbol war in diesem
  Lauf erreichbar; fehlende primäre Symbole bedeuten nicht fehlende Logos.
- 37 Sets ohne erreichbares echtes Logo oder Symbol in den geprüften Quellen.
  Diese zeigen eine neutrale Set-Kennung, kein erfundenes offizielles Zeichen.
- Keine Auditfehler. HTTP-Fehler der Bilder und verfügbare Alternativen stehen
  pro Set im [maschinenlesbaren Bericht](../../public/catalog-art/audit.json).

Der PR-/Deployment-Job führt das Audit vor dem Build aus und archiviert seinen
Bericht. Laufzeitprüfungen decken fehlende Metadaten, HTTP-Bildfehler, eindeutige
Sekundärbilder und englische Bildhinweise ab. **Die dynamischen Kartenbilder des
gesamten weltweiten Katalogs werden nicht alle vorab heruntergeladen oder auf
HTTP-Verfügbarkeit geprüft.** Ihre Fallbacks greifen beim tatsächlichen Laden;
ohne verifizierbare Alternative bleibt eine verständliche Fehlanzeige mit
Kartenidentität. Die vollständig vorbeugende Prüfung aller Karten ist damit
weiterhin eine Abdeckungslücke gegenüber dem ursprünglichen Wunsch.

## Design, Navigation und Scanrückmeldung

Visuell geprüft: Home bei 320, 390 und 1440 Pixeln, leere Binder- und
Portfolioansicht sowie Profil. Bei diesen Breiten kein horizontaler Überlauf
und keine JavaScript-Seitenfehler. Nach vollständiger Bildladung sind die
lokalen Inspirationskarten vorhanden; frühe Ladeplatzhalter wurden nicht als
fehlende Bilder gewertet.

Visuelle Nachweise: [Home 320](../screenshots/review-2026-11-11/home-320.png),
[Home 390](../screenshots/review-2026-11-11/home-390.png),
[Home Desktop](../screenshots/review-2026-11-11/home-1440.png),
[Profil 390](../screenshots/review-2026-11-11/profile-390.png) und
[Layout-/axe-Protokoll](../screenshots/review-2026-11-11/verification.json).

Liquid Glass bleibt auf Navigation und Dialoge begrenzt. Die vorhandene dunkle
Tönung erhält die Lesbarkeit. Home priorisiert einen Scan-Einstieg; Binder,
Karten und Portfolio sind im mobilen Sammlungsbereich verbunden. Das Profil
hat jetzt denselben sichtbaren Auswahlzustand wie die übrige Navigation.

Einzelkarten zeigen Aufnahme, laufende Erkennung und anschließende Prüfung;
Binderseiten zählen tatsächlich verarbeitete Fächer. Animationen ersetzen
keine echten Fortschrittsdaten. Reduced Motion, Abbruch, Kameraablehnung,
offene Scanergebnisse, Fokus-Rückgabe und Besitzschutz sind Teil der vorhandenen
Browserregression. Die visuelle Ähnlichkeit zu Referenzen allein belegt keine
physische Scanleistung.

## Verifikation

- `npm run check`: Formatierung, ESLint, 156 Tests in 32 Dateien, TypeScript,
  Datenvalidierung, Produktionsbuild und PWA-Validierung erfolgreich.
- Auf dem veröffentlichten Ausgangsstand: 38 gezielte Chromium-/Mobile-Tests
  erfolgreich, einschließlich fehlender Primärbilder, Sekundärlogos,
  Scan-Moduswechsel, Bestätigungsvalidierung und verzögerter Portfolioantworten.
- Zusätzliche Regression des korrigierten Builds: Home/Vault/Profil,
  Portfolio, PWA/Offline, mobile Binder, Scanner und Touchgesten: 43 bestanden,
  fünf Desktop-Fälle mangels mobiler Navigation/Touchbedienung übersprungen.
- Automatischer axe-Check auf Home, Binder, Portfolio und Profil bei 320, 390
  und 1440 Pixeln: keine Befunde in den geprüften WCAG-A/AA-Regeln. Dies ist
  keine vollständige manuelle Barrierefreiheitszertifizierung.
- Die vollständige CI prüft Chromium, mobiles Chromium und WebKit vor Pages.
  Lokales WebKit war wegen fehlender Systembibliotheken nicht startbar; lokale
  Chromium-Ergebnisse werden nicht als WebKit- oder physischer iPhone-Test
  ausgegeben. Browserabhängige Simulationen bleiben ausdrücklich übersprungen.

[Deployment-Workflow und Läufe](https://github.com/ArturSugarBear/E-Binder/actions/workflows/pages.yml)
· [Veröffentlichte Anwendung](https://artursugarbear.github.io/E-Binder/)

## Verbleibende Produktvalidierung

Vor Aussagen über HoloGem-Überlegenheit fehlen echte iPhone-Scans bei Reflexion,
schlechtem Licht und vollen Binderseiten sowie gemessene Erkennungszeiten und
Trefferqualität. Auch eine neue Anmeldung mit realer Cloud-Synchronisierung
wurde hier nicht durch einen persönlichen Produktionsaccount ausgeführt.
Account-Isolation ist durch den beschriebenen Codepfad und Regressionstests
belegt. Die weltweite Bildabdeckung und die 37 neutralen Set-Kennungen bleiben
als konkrete Einschränkungen sichtbar.
