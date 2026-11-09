# Collectr: begrenzte Untersuchung

Untersuchung am 8./9. November 2026. Öffentliche Weboberfläche und ausgelieferte Skripte, keine Anmeldung und keine privaten Sammlungen. Quellen: https://app.getcollectr.com/, https://getcollectr.com/track, https://getcollectr.com/scan.

## Beobachtet / dokumentiert

Die öffentliche Webansicht zeigt „Find a Product“, Sortierung, Watchlist, Produkttyp und Bestandsfilter. Sie trennt Katalog und Portfolio. Die offiziellen Produktseiten beschreiben Sprachfilter EN/JP/CN, kombinierbare Filter sowie Kopieren/Verschieben/Löschen in Portfolios. Die Scan-Seite beschreibt die Auswahl von Menge, Zustand und Druckvariante vor dem Hinzufügen. Das sind Angaben des Anbieters; die native App wurde hier nicht bedient.

REA wurde auf drei ausgewählte ausgelieferte JavaScript-Dateien angewendet. Evidence-ID: `ev_d03df6c32a229d33a2487357b9149f07b735cf67d3ef3515129744e3485bb978`, Operation `analyze_javascript_application`, Artefakt-SHA256 `4e2ec5ead45cc82c4f39f0969c559d70ee7aed76e4db2bfc6ceded05c3c3dcc8`. Das Ergebnis ist statische Analyse; 44 inventarisierte Dateien wurden nicht analysiert. Weder Aufrufe noch Datenbankschreibvorgänge sind dadurch beobachtet. Arbeitskopien und vollständige Evidence liegen nur im Ausführungsarbeitsbereich `/workspace/scratch/collectr-rea/` und sind nicht als dauerhaftes Repository-Artefakt zugesichert.

## Konsequenz für E-Binder

Der kürzeste hilfreiche Ablauf ist Aufnahme → lesbarer Kartenausschnitt → konkrete Ausgabe vergleichen → Variante und Gesamtmenge bestätigen → Bestand. Eine erfolgreiche Texterkennung allein ist noch keine Kartenzuordnung. Bei fehlender Zuordnung muss die Suche direkt weiterhelfen und das Foto erhalten bleiben. Sprachwahl und Katalogfilter sind echte Funktionen, keine alleinige Übersetzung des Kartennamens.

## Unbekannt

Collectrs interne Datenbank, proprietärer Erkennungsstack, Datenanbieter und tatsächliche Erkennungsgenauigkeit sind nicht belegt. Der Nutzer berichtet drei erfolgreiche Scans in Collectr und keine erfolgreichen eigenen Scans in E-Binder. Für einen belastbaren Vergleich fehlen dieselben Originalfotos, Ergebniszustände und beobachtete Korrekturen. Screenshots des Nutzers können den nativen Aufnahme-/Ergebnisablauf weiter klären.
