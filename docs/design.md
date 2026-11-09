# Designvertrag

Stand: 9. November 2026. Der Nutzer möchte den zu häufig eingesetzten Orange-Akzent ausdrücklich ersetzen. Die ursprüngliche FluxEdit-Referenz bleibt die Grundlage für die dunkle Bühne und klare Interaktionen; Cantaloupe Orange ist kein aktiver UI-Farbtoken mehr.

Die Sammlung ist eine Arbeitsfläche (Impeccable-Modus **Operate**): Kartenbilder tragen die Vielfalt, die Oberfläche verwendet Farbe für Aktion, Auswahl und Rückmeldung. Das dunkle Kartenatelier, seine Hüllen und die vorhandenen Schriften bleiben erhalten. Ein heller Cyan-Akzent kennzeichnet Primäraktionen; Electric Blue führt durch Navigation und Fokus. Ruhige Flächen ersetzen die dekorativen Lichtverläufe des leeren Einstiegs.

| Rolle         | Farbe                                             | Verwendung                                             |
| ------------- | ------------------------------------------------- | ------------------------------------------------------ |
| Grundfläche   | Midnight Black `#02070A`                          | App-Hintergrund und Text auf Primäraktionen            |
| Primäraktion  | Cyan `#6AD0E0`, Hover `#94E4EF`                   | Hinzufügen, Bestätigen, Übernehmen                     |
| Interaktion   | Electric Blue `#0297DE`                           | aktive Navigation, Fokus, Bildauswahl                  |
| Auswahlfläche | `#143444`, Text `#C9EDF5`                         | aktuell bearbeitete Binderseite                        |
| Fläche        | `#0C151E`, erhöht `#132331`                       | Dialoge, Eingaben und Arbeitsbereiche                  |
| Text          | `#F2F6FA`, sekundär `#B6C5D1`, Hinweise `#92A5B5` | lesbare Hierarchie auf dunklen Flächen                 |
| Erfolg        | `#8BD8B3`                                         | gespeicherter Zustand mit Text                         |
| Fehler        | `#FFB8C4` auf `#30191E`                           | Formular-, Speicher- und Ladefehler mit konkretem Text |
| Eingaberand   | `#526E82`                                         | Abgrenzung interaktiver Felder                         |

- Gemeinsame Farbrollen in `src/styles.css`, persönliche Arbeitsflächen in `src/workspace.css`. Keine separaten Themes je Funktion. Beide HTML-Einstiege verwenden das dunkle Farbschema.
- Lokale Bricolage-Grotesque- und JetBrains-Mono-Schriften bleiben erhalten. Sichtbare Typografie, Buttons, Icons und Felder folgen gemeinsamen Regeln.
- Karten bleiben vollständig sichtbar, im Raster 3 × 3 und Verhältnis 63 : 88. Kein Beschnitt, keine Farbfilter und keine generierten Ersatzkarten in der Sammlungsansicht. Bildvorverarbeitung ist ausschließlich Teil der OCR. Das Original bleibt nur im geöffneten Erfassungsdialog für weitere Zuschnitte verfügbar; Fotos werden nicht dauerhaft gespeichert.
- Die dunklen Hüllen mit gestanztem Rand sind das Produktmotiv. Die neue Palette betrifft Arbeitsfläche und Bedienelemente. Greninja behält Wasser-Shuriken und seine blaue Sonderedition.
- Der Sammlungsauftakt verwendet eine ruhige Fläche. Keine dekorativen Lichtverläufe hinter Karten oder Arbeitsformularen, kein Glühen der Buttons. Die materiellen Hüllen bleiben erkennbar.
- Neutrale Textrollen dürfen nicht als Fehlermeldungen dienen. Erfolg und Fehler haben sichtbaren Text. Destruktive Aktionen verwenden separate Rot-/Rosa-Rollen und eine ausdrückliche Bezeichnung.
- Auf breiten Bildschirmen stehen Seitenauswahl und Kartenliste neben dem Binder. Auf kleinen Bildschirmen lassen sich Verwaltungsaktionen einklappen. Ab 320 CSS-Pixeln kein horizontaler Seitenscroll.
- Karten sind Buttons mit zugänglichen Namen. Native Dialoge unterstützen Escape, Fokusbegrenzung und Fokus-Rückgabe, auch nach erneutem Rendern der Karte. Ziehen hat eine Alternative über „Verschieben / tauschen“.
- Das Inspirationsarchiv behält Pfeiltasten, Pager und horizontales Wischen. Vertikales Scrollen und Eingabefelder dürfen nicht abgefangen werden.
- Reduzierte Bewegung respektieren. Ladefehler müssen sichtbar und behebbar sein. Lokaler Speicherstatus, offene Erkennungen und fehlende Karten dürfen nicht erfolgreicher wirken als der tatsächliche Zustand.

Kontrastmessung und tatsächlich ausgeführte Browserprüfungen stehen im Implementierungsbericht. Kontrastwerte allein belegen keine vollständige WCAG-Konformität.

## Überarbeitung mit Impeccable

Verwendet wurden der [Original-Skill](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md), `colorize`, `quieter`, `operate` und `craft-floor` aus Impeccable v4.8.1. Der offizielle, checksum-geprüfte Launcher wurde außerhalb des Produkt-Repositories ausgeführt; `context --target src/workspace.css` erlaubte die gezielte Verfeinerung des vorhandenen Systems. Es wurden keine Impeccable-Laufzeitabhängigkeiten in die App eingebaut.

Das Sortierfeld erhält auf Desktop mindestens 240 px, auf kleinen Bildschirmen eine eigene volle Zeile. Mit 16 px Eingabeschrift muss „Zuletzt hinzugefügt“ vollständig lesbar bleiben; weniger Textplatz ist kein Grund, die Schrift wieder zu verkleinern. Dekorative Eyebrows direkt über den Sammlungsüberschriften werden ausgeblendet, damit die tatsächliche Überschrift führt.

Berechnete Kontrastverhältnisse der festen Tokens (sRGB/WCAG):

| Vordergrund / Hintergrund                         | Verhältnis |
| ------------------------------------------------- | ---------- |
| Primärlabel `#02070A` / Cyan `#6AD0E0`            | 11,29:1    |
| Primärlabel / Hover `#94E4EF`                     | 14,08:1    |
| Haupttext `#F2F6FA` / Fläche `#0C151E`            | 16,94:1    |
| Sekundärtext `#B6C5D1` / Fläche                   | 10,42:1    |
| Platzhalter `#92A5B5` / Fläche                    | 7,25:1     |
| Fokus `#0297DE` / Fläche                          | 5,68:1     |
| Eingaberand `#526E82` / Fläche                    | 3,43:1     |
| Fehlertext `#FFB8C4` / Fehlerfläche `#30191E`     | 10,05:1    |
| Erfolg `#8BD8B3` / Grundfläche                    | 12,12:1    |
| Sekundärtext / ausgewählte Seitenfläche `#143444` | 7,41:1     |

Die Tokenmessung ersetzt keine vollständige Prüfung aller gerenderten Zustände oder eine manuelle Bedienprüfung.

Gerenderte Prüfung dieser Farb-/Layoutänderung: Chromium bei 1405, 900, 641, 428 und 320 CSS-Pixeln. Die neuen Tokens und `workspace.css` wurden für diese isolierte Prüfung in den vorhandenen Produktionsbuild eingefügt, ohne parallel zu Backend-Arbeiten den Build zu ersetzen. Bei allen fünf Breiten entspricht die Dokumentbreite der Fensterbreite. „Zuletzt hinzugefügt“ misst mit der tatsächlichen 16-px-Schrift 144,35 px; der freie Textplatz im Sortierfeld beträgt mindestens 214 px. Desktop- und Mobilansicht wurden visuell geprüft; Karten bleiben unverändert. Der einmal ausgeführte Impeccable-Detektor meldete für die zwei geänderten CSS-Dateien keine Befunde (`[]`). Die abschließende Prüfung des integrierten Builds erfolgt zusammen mit den übrigen Änderungen.
