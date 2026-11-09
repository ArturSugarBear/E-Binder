# Collectr: begrenzte Untersuchung

Untersuchung am 8./9. November 2026. Öffentliche Weboberfläche und ausgelieferte Skripte, keine Anmeldung und keine privaten Sammlungen. Quellen: https://app.getcollectr.com/, https://getcollectr.com/track, https://getcollectr.com/scan.

## Beobachtet / dokumentiert

Die öffentliche Webansicht zeigt „Find a Product“, Sortierung, Watchlist, Produkttyp und Bestandsfilter. Sie trennt Katalog und Portfolio. Die offiziellen Produktseiten beschreiben Sprachfilter EN/JP/CN, kombinierbare Filter sowie Kopieren/Verschieben/Löschen in Portfolios. Die Scan-Seite beschreibt die Auswahl von Menge, Zustand und Druckvariante vor dem Hinzufügen. Das sind Angaben des Anbieters; die native App wurde hier nicht bedient.

REA wurde auf drei ausgewählte ausgelieferte JavaScript-Dateien angewendet. Evidence-ID: `ev_d03df6c32a229d33a2487357b9149f07b735cf67d3ef3515129744e3485bb978`, Operation `analyze_javascript_application`, Artefakt-SHA256 `4e2ec5ead45cc82c4f39f0969c559d70ee7aed76e4db2bfc6ceded05c3c3dcc8`. Das Ergebnis ist statische Analyse; 44 inventarisierte Dateien wurden nicht analysiert. Weder Aufrufe noch Datenbankschreibvorgänge sind dadurch beobachtet. Arbeitskopien und vollständige Evidence liegen nur im Ausführungsarbeitsbereich `/workspace/scratch/collectr-rea/` und sind nicht als dauerhaftes Repository-Artefakt zugesichert.

## Konsequenz für E-Binder

Der kürzeste hilfreiche Ablauf ist Aufnahme → lesbarer Kartenausschnitt → konkrete Ausgabe vergleichen → Variante und Gesamtmenge bestätigen → Bestand. Eine erfolgreiche Texterkennung allein ist noch keine Kartenzuordnung. Bei fehlender Zuordnung muss die Suche direkt weiterhelfen und das Foto erhalten bleiben. Sprachwahl und Katalogfilter sind echte Funktionen, keine alleinige Übersetzung des Kartennamens.

## Unbekannt

Collectrs interne Datenbank, proprietärer Erkennungsstack, Datenanbieter und tatsächliche Erkennungsgenauigkeit sind nicht belegt. Der Nutzer berichtet drei erfolgreiche Scans in Collectr und keine erfolgreichen eigenen Scans in E-Binder. Für einen belastbaren Vergleich fehlen dieselben Originalfotos, Ergebniszustände und beobachtete Korrekturen. Screenshots des Nutzers können den nativen Aufnahme-/Ergebnisablauf weiter klären.

## Vertiefung und Umsetzung am 9. November 2026

REA hat jetzt auch öffentliche Browseraktionen ausgeführt, nicht nur ausgelieferten Code statisch gelesen:

- `ev_f62e412a63ff604ca0b7bde433830d0d0609263b4677821a6fc5baf85e555e95`: Startseite → „Sets“. Beobachtet wurden TCG-Kategorien als Bildnavigation.
- `ev_fa8e622f9ddc70f61e19d9d3865849deb050784011f81d5170a69dd2e8b586ad`: Pokémon-Setkatalog. Beobachtet wurden Setbilder, Setnamen, Veröffentlichungsdaten und Kartenanzahlen. Der zunächst gewählte Link-Selektor passte nicht: Die Sets waren Listenelemente. Dieser fehlgeschlagene Folgeschritt ist kein erfolgreicher Setaufruf.
- `ev_555241efc6943aaec48dc39e628120b02d8717266e59ab8c44c96d53b84c024f`: korrigierter Klick auf das beobachtete Listenelement „Destined Rivals“ führte zu `https://app.getcollectr.com/sets/category/3/destined-rivals?groupId=24269&cardType=cards`. Dort erschienen eine setgebundene Suche, Sortierung und „Cards Only“. Sprach- und Preisbereichsfilter waren ohne Anmeldung als PRO-Funktionen deaktiviert. Der Ergebnisbereich zeigte zum Aufnahmezeitpunkt „No Results Found“; erfolgreiche Kartentreffer sind in diesem Lauf somit nicht belegt.

Der erste direkte Browserstart scheiterte mit `net::ERR_CONNECTION_REFUSED`. Der anschließende Connect-Lauf nutzte einen eigens gestarteten Browser mit der geerbten Proxykonfiguration. REA trennte die Verbindung; der Hilfsprozess schloss seinen Browser anschließend. Es wurden keine Collectr-Konten angelegt, keine privaten Sammlungen gelesen und keine Inventaränderungen ausgeführt. Laufende Netzwerkanfragen blieben am Aufnahmeende offen (`missing_sections: events`); die Aufnahmen sind kein vollständiges Netzwerkprotokoll. Arbeitsdateien liegen unter `/workspace/scratch/collectr-rea/`.

Übertragung auf E-Binder:

| Beobachtetes Muster / eigener Befund         | Implementiert                                                                                                                                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Einstieg über erkennbare Sets                | Setbrowser mit Logos bzw. lesbarer Setkennung; Suche nach deutschem und englischem Setnamen, z. B. „Ewige Rivalen“ / „Destined Rivals“.                                                                                                            |
| Suche im gewählten Set                       | Set-, Illustrator- und Seltenheitsfilter, Nummernsuche einschließlich führender Nullen und seitenweises Laden. DE/EN/JA bleiben getrennte Ausgaben.                                                                                                |
| Sortierbare Ergebnisse                       | Nummer und Name über die dokumentierte TCGdex-Abfrage; EUR-Preisvergleich ausdrücklich nur im gewählten Set nach vollständigem Laden seiner Metadaten, mit Fortschritt und Abbruch. Fehlende oder Nullpreise bleiben unbekannt und stehen am Ende. |
| Deutsche TCGdex-Ausgaben ohne Bild           | Englische Vorschaubilder werden gesammelt für die exakten Provider-IDs und Kartennummern angefragt. Ausgabe und Name bleiben deutsch; die Vorschau trägt „Bild: EN“. Unverfügbare Bilder werden ausdrücklich benannt.                              |
| Digitale Karten in globalen Pokémon-Treffern | TCGdex listet auch TCG Pocket. Die tatsächliche `series/tcgp`-Setliste wird zum Ausschluss dieser digitalen Sets aus dem physischen Binderkatalog verwendet.                                                                                       |
| Leere Artist-Auswahl                         | Eigene Artists bleiben an bestätigte, freie Exemplare gebunden. Leerer Bestand, reservierte Exemplare und fehlende Credits werden erklärt; ein eigener Einstieg öffnet die globalen Katalog-Illustratoren.                                         |

Aktuelle Providerquellen: https://tcgdex.dev/rest/filtering-sorting-pagination, https://tcgdex.dev/rest/cards, https://tcgdex.dev/rest/other-fields. Live-Proben bestätigten: `de/cards/base1-4` hat kein Bild, `en/cards/base1-4` hat das Bild derselben Katalog-ID. `de/sets/sv10` heißt „Ewige Rivalen“. Die API-Abfrage nach `pricing.cardmarket.trend` sortierte die Treffer in einer Probe nicht nach Preis; E-Binder behauptet deshalb keine globale serverseitige Preissortierung. Preise sind datierte Cardmarket-Katalogtrends, keine zugesicherte Bewertung einer bestimmten Sprache, Druckvariante oder eines Zustands.
