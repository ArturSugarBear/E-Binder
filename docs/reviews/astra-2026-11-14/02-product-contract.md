# 02 — Verbindlicher Produkt- und Interaktionsvertrag

Diese Spezifikation beschreibt das Ziel, nicht den bereits gelieferten Zustand. „MUSS“ ist ein Abnahmekriterium. Bestehende funktionierende Umsetzung zählt nach Prüfung; kein Neubau zur Erfüllung einer Überschrift.

## Produktversprechen

E-Binder macht echte Karten zu einer schönen, verlässlichen Sammlung: schnell erfassen, Ausgabe sicher bestätigen, Binder genießen, Sets vervollständigen und Werte verstehen. Erfolg ist der abgeschlossene Sammlerweg, nicht die Anzahl implementierter Features.

## Identität und gemeinsame Gestaltung

- Name und sichtbare Identität: **E-Binder**. Die spätere Rücknahme des Rare-Room-/Retro-Futurism-Rollouts hat Vorrang vor älteren Verträgen. R01 MUSS aktive Vorgaben synchronisieren. Bewährte semantische Tokens dürfen erhalten bleiben. Kein neues Logo aus dem Gedächtnis zeichnen: den letzten nachweisbar vom Owner akzeptierten E-Binder-Assetstand aus Git ermitteln und dessen Herkunft dokumentieren. Falls nicht eindeutig rekonstruierbar, zunächst die vorhandene E-Binder-Wortmarke konsistent verwenden und Asset-Frage isoliert offenhalten.
- Artwork ist der Blickfang. Keine Farbfilter, aggressive Ausschnitte, künstlichen Holo-Effekte auf Karten oder ersatzweise falschen Editionen.
- Dunkle ruhige Inhaltsflächen, klarer Text, Lime für Hauptaktion/aktive Auswahl. Datenwerte neutral; Erfolg, Fehler und Warnung mit eigener Semantik plus Text/Icon. Kein dauerndes Neonleuchten.
- Ein zentraler Satz Tokens für Typografie, Abstand, Radien, Ebenen und Motion. Ausgangsraster: 4/8/12/16/24/32 px; Body 17, sekundär 15, Metadaten 13 px aus bestehendem Vertrag. Diese Werte über rem abbilden; Large Text darf wachsen. Keine dekorativen Uppercase-Monoflächen für normale Texte.
- Pro Aufgabenbereich eine dominante Aktion. Sekundäre Werkzeuge sind sichtbar auffindbar, aber nicht gleich laut.
- Glas gezielt auf Navigation und Sheets, wo sich der Hintergrund tatsächlich bewegt. Kartenraster auf ruhigen Flächen. Deckender, kontrastreicher Fallback bei reduzierter Transparenz/fehlender Grafikfähigkeit.
- Gemeinsame Komponenten: Button, IconButton, TabBar, Segmentwahl, CardTile, CardDetail, BottomSheet, StatePanel, PriceLabel, FilterSheet, ScanStatus. Vorhandene Hilfen erweitern statt lokale Varianten kopieren.
- Tablet bekommt bewusst mehr Raum für Artwork und ausgewählte Master/Detail-Ansichten; kein hochskalierter 390px-Streifen. 3×3-Seiten behalten immer ihre neun Positionen.

## Informationsarchitektur

Fünf stabile Hauptziele: **Home | Entdecken | Scan | Sammlung | Profil**. Sammlung öffnet standardmäßig die Binderübersicht; darin **Binder | Karten | Portfolio** als eindeutige Unteransichten. Das ist eine bewusste Zielkorrektur gegenüber dem derzeitigen Tablabel „Binder“: der Oberbegriff muss alle drei Aufgaben tragen. Bestehende URLs/Deep Links kompatibel halten; keinen zweiten Bestand anlegen.

Ein aktives Hauptziel, eindeutiger Unterbereich, konsistenter Zurückpfad. Scan kehrt zum Ausgangskontext zurück. Browser-Zurück schließt zuerst das aktuelle Detail/Sheet, sofern als navigierbare Ebene geöffnet, und verliert keine Eingabe. Tabs erhalten ihren Scroll-/Filter-/Binderseitenzustand. Keine doppelte mobile/desktop Navigation zugleich.

## Bildschirmverträge

| Fläche | Reihenfolge / Hauptaktion | Verbindliche Zustände und Details |
| --- | --- | --- |
| Home, Erstbesuch | Kurzes Nutzenversprechen, echtes/als Demo markiertes Kartenmotiv, „Karte scannen“, „Demo ansehen“ sekundär | Kein Pflichtkonto, keine Pflichtpersonalisierung, Kamera erst beim Scan anfragen; keine erfundenen Bestandswerte. |
| Home, Rückkehr | Kompakter Titel, „Weiter sammeln“ mit letzter Binderseite oder jüngsten eigenen Karten, Scan-Aktion; danach begonnene Sets und kompakter Wert mit Abdeckung | Marketing-Hero entfällt. Offene Scans als kleine handlungsfähige Zeile. Zuletzt benutzte Seite persistent, mit sicherem Fallback nach Löschung. |
| Sammlung / Binderübersicht | Eigene Cover mit Name, Seitenanzahl und Vorschau; „Binder anlegen“ | Leerer Bestand mit klarer Aktion. Demo sichtbar getrennt. Umbenennen/Teilen/Entfernen im Kontextmenü. |
| Binderseite | Kompakter Bindername + Seite, große 3×3-Seite, Seitenrail, kleine Werkzeugleiste | Keine zweite gleichwertige Neun-Zeilen-Ansicht. Tap auf Slot öffnet Kontextdetail; leerer Slot bietet gezielte Zuweisung. Planung, Besitz und physisch aufgebaut bleiben unterscheidbar. |
| Sammlung / Karten | Suche, Ergebniszahl + Filter/Sortierung, Artworkraster | Filterzustand beim Detailwechsel erhalten. Menge und Preis kompakt. Bulk-Auswahl nur nach bewusstem Aktivieren; Massenlöschung mit Folgenanzeige. |
| Kartendetail, überall | Artwork, lokalisierter Name, Set/Nummer/Sprache/Variante, Preis mit Kurzquelle, Bestand; eine Kontextaktion | Technische Details, Händlerquellen und Besitzeditor sekundär. Japanisch mit lang=ja; verifizierter deutscher Name in Klammern, sonst keine erfundene Übersetzung. |
| Entdecken | Suchfeld und Sprachwahl, bildgestützte Sets, gesetzte Filter sichtbar; Setdetail mit Fortschritt | DE/EN/JA konsistent. Fehlende Assets mit ehrlichem Platzhalter, Name und Retry. Doppelte Exemplare erhöhen nicht den Fortschrittszähler eindeutiger Drucke. Variantenregel und Nenner benennen. |
| Portfolio | Bekannter Wert, Bewertungsabdeckung und Aktualität; echte Historie; danach Karten/Binder/fehlende Preise | Kein 0-Euro-Ersatz für unbekannt, keine erfundene Rendite. Quelle/Preisart bei jedem Detail. Klick auf Wert führt zu den bewerteten Karten. |
| Scan | Eine Kamerafläche, Modus Einzelkarte/Binderseite, Ecken-/Rasterfeedback, Zustandszeile, offene Queue | Kein Formular oder manueller Zuschnitt vor normalem Scan. Moduswechsel behält offene Ergebnisse. Review erreichbar, Kamera/Lebenszyklus sauber. |
| Scanprüfung | Fotoausschnitt und Top-Kandidaten, identitätsrelevante Unterschiede, gezielte Korrektur und Bestätigung | Default maximal drei sichtbare plausible Kandidaten; weitere optional. Kein Kandidat nur um Liste zu füllen. Sammelbestätigung nur für eindeutig aufgelöste/einzelbestätigte Zeilen; Rest bleibt offen. |
| Profil | Konto/Backup, Darstellung/Barrierefreiheit, Beta-Datenspende, Hilfe, Über E-Binder | Version/Commit/Updatezustand leicht kopierbar. Diagnostik optional; private Fotos nur mit Einwilligung. Installationshilfe plattformspezifisch. |

## Interaktion und Bewegung

| Ereignis | Verhalten | Reduzierte Bewegung / Alternative |
| --- | --- | --- |
| Tap | Sofortiger Pressed-Zustand; Speichern wird bei Persistenzerfolg bestätigt | Statische Zustandsänderung bleibt sichtbar |
| Tabwechsel | Inhalt ohne blockierende Einblendung; Filter und Scrollposition erhalten | Sofortiger Wechsel |
| Binder/Card-Swipe | Inhalt folgt dem Finger nach Richtungsentscheidung; Nachbarinhalt sichtbar; Schwelle/Velocity entscheidet; Abbruch federt zurück | Buttons / sofortiger diskreter Wechsel; keine erforderliche Geste |
| Sheet | Greifbarer Kopf, Drag-to-dismiss nur in geeigneter Zone; X, Escape, Backdrop konsistent; Dirty-Guard erhalten | Schließen mit Button, Fokus zurück |
| Scan läuft | Gut sichtbarer Lime-Shimmer über erkannter ROI + verständlicher tatsächlicher Arbeitsschritt | Statischer Rahmen + Text; keine endlose animierte Pflichtwartezeit |
| Karte bereit | Ein kurzer Akzentimpuls und sichtbare Queue-Erhöhung nach echtem Ergebnis | Text/Badge, optionales unterstütztes Haptiksignal |
| Fehler | Ursache am betroffenen Objekt, nächster Schritt, Retry/Alternative | Kein rotes Vollbild oder dauerhaftes Toast-Spam |

Richtwerte für Entwicklung: Pressed 80–120 ms, kleine Zustandswechsel 120–180 ms, Sheet/Page-Snap 180–280 ms. Das sind Budgets zur Messung/Abstimmung, keine gemessenen Wettbewerberwerte. Keine Animation verzögert Geschäftslogik. Bestehende Motion-Bibliothek nutzen. Kein falsches Prozent aus verstrichener Zeit.

## Daten- und Preisvertrag

Eine kanonische Druckidentität verbindet Katalog, Scan, Besitz, Binder und Preis: Provider/Quell-ID, Sprache, Set, gedruckte Nummer und verifizierte Variante; gedruckte Schreibweise für Anzeige bewahren. Besitz führt zusätzlich Exemplar-/Bestands-ID, Menge, Zustand und Zuordnung. Gleicher Name oder gleiches Artwork reicht nicht.

Preisbeobachtung MUSS Quelle, Quellprodukt, Währung, Zeitstempel, Preisart, Variante sowie bekannte/unbekannte Sprach- und Zustandsabdeckung tragen. „Cardmarket NM-Durchschnitt“ darf nur heißen, was die Quelle tatsächlich liefert. Ein Trend-/Katalogwert wird als solcher benannt. Ungeeignete/fehlende Quellen bleiben unbewertet. Umrechnung braucht datierten FX-Kurs; Raw und Graded nicht vermischen.

Überall dieselbe Quelle/Policy für dieselbe Identität und denselben Zeitpunkt. Bei bewusst anderer Basis muss die Ansicht den Unterschied erklären. Gesamtwert = Summe bewertbarer Stückpreise × bestätigter Menge. Binderzuordnung darf denselben Besitz nicht erneut zum Gesamtvermögen addieren. Historie verbindet nur vergleichbare Beobachtungen; Bestandszuwachs ist keine Marktperformance.

## Scannervertrag

Visual-first-Fusion bedeutet Bildkandidaten plus gezielte OCR zur exakten Ausgabe, keine bedingungslose Vision-Autobestätigung. OCR für Set/Nummer darf parallel laufen. Modell-/Index-Coverage, Geometriequalität, Identitätsevidenz und Besitzbestätigung sind getrennte Zustände.

Die Pipeline MUSS Kamera und Verarbeitung entkoppeln, Worker wiederverwenden, begrenzte Queue/Backpressure einsetzen, schlechte Frames früh abweisen, Multi-Frame-Wiederholung begrenzen und bei fehlender Coverage sinnvoll auf OCR/Katalog wechseln. Keine verpflichtende Roboflow-Inferenz oder kostenpflichtige Grundfunktion.

Einzelkarte und Binder verwenden dieselbe Identitäts-/Rankinglogik. Bindergeometrie bleibt eigenständig: äußere Fläche, Innenlinien, Karten-ROI, leere Plätze. Bei Restunsicherheit Korrektur anbieten statt falscher Zuordnung. Fotos sind temporär; ungeklärte Ergebnisse dürfen nicht kommentarlos verschwinden. Speichern privater Bilddaten ausschließlich nach bestehendem Einwilligungsmodell.

## Nicht Teil dieses Auftrags

Kein Frameworkwechsel, kein Marktplatz/Bezahlabo, kein Social Feed, kein Multigame-Katalog, keine neue Cloudpflicht, keine pauschalen Account-Adminrechte. Diese Erweiterungen lösen die bestehenden Qualitätslücken nicht.
