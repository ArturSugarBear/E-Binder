# Designvertrag

Die vom Nutzer bestätigte neue Palette ersetzt die frühere beige Papiergestaltung. Quelle: zwei im Chat bereitgestellte Screenshots (FluxEdit und Farbpalette). Übernommen werden Farben und die Trennung aus dunkler Bühne und farbigen Akzenten; das Referenzlayout ist keine E-Binder-Vorlage.

| Rolle        | Farbe                                             | Verwendung                                                    |
| ------------ | ------------------------------------------------- | ------------------------------------------------------------- |
| Grundfläche  | Midnight Black `#02070A`                          | App-Hintergrund und dunkle Schrift auf Primäraktionen         |
| Interaktion  | Electric Blue `#0297DE`                           | aktive Navigation, Fokus, Auswahl und Binderdetails           |
| Primäraktion | Cantaloupe Orange `#FC734D`                       | Hinzufügen, Bestätigen, Übernehmen und einzelne Markenakzente |
| Fläche       | `#0C151E`, erhöht `#132331`                       | Dialoge, Eingaben und Arbeitsbereiche                         |
| Text         | `#F2F6FA`, sekundär `#B6C5D1`, Hinweise `#92A5B5` | lesbare Hierarchie auf dunklen Flächen                        |

- Gemeinsame Farbrollen in `src/styles.css`, persönliche Arbeitsflächen in `src/workspace.css`. Keine separaten Themes je Funktion. Beide HTML-Einstiege verwenden das dunkle Farbschema.
- Lokale Bricolage-Grotesque- und JetBrains-Mono-Schriften bleiben erhalten. Sichtbare Typografie, Buttons, Icons und Felder folgen gemeinsamen Regeln.
- Karten bleiben vollständig sichtbar, im Raster 3 × 3 und Verhältnis 63 : 88. Kein Beschnitt, keine Farbfilter und keine generierten Ersatzkarten in der Sammlungsansicht. Bildvorverarbeitung ist ausschließlich Teil der OCR; das Original bleibt erhalten.
- Die dunklen Hüllen mit gestanztem Rand sind das Produktmotiv. Die neue Palette betrifft Arbeitsfläche und Bedienelemente. Greninja behält Wasser-Shuriken und seine blaue Sonderedition.
- Ein zurückhaltender blauer und oranger Lichtschein ist auf den leeren Sammlungsauftakt begrenzt. Keine flächigen dekorativen Verläufe hinter Arbeitsformularen, kein Glühen jedes Buttons.
- Neutrale Textrollen dürfen nicht als Fehlermeldungen dienen. Erfolg und Fehler haben sichtbaren Text. Destruktive Aktionen verwenden separate Rot-/Rosa-Rollen und eine ausdrückliche Bezeichnung.
- Auf breiten Bildschirmen stehen Seitenauswahl und Kartenliste neben dem Binder. Auf kleinen Bildschirmen lassen sich Verwaltungsaktionen einklappen. Ab 320 CSS-Pixeln kein horizontaler Seitenscroll.
- Karten sind Buttons mit zugänglichen Namen. Native Dialoge unterstützen Escape, Fokusbegrenzung und Fokus-Rückgabe, auch nach erneutem Rendern der Karte. Ziehen hat eine Alternative über „Verschieben / tauschen“.
- Das Inspirationsarchiv behält Pfeiltasten, Pager und horizontales Wischen. Vertikales Scrollen und Eingabefelder dürfen nicht abgefangen werden.
- Reduzierte Bewegung respektieren. Ladefehler müssen sichtbar und behebbar sein. Lokaler Speicherstatus, offene Erkennungen und fehlende Karten dürfen nicht erfolgreicher wirken als der tatsächliche Zustand.

Kontrastmessung und tatsächlich ausgeführte Browserprüfungen stehen im Implementierungsbericht. Kontrastwerte allein belegen keine vollständige WCAG-Konformität.
