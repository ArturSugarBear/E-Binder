# E-Binder: Produktreview und nächste Ausbaustufe

Stand: 8. November 2026. Geprüfter Commit: `46a504d758cb0ae5021553031b49b1393868d047`.

## Empfehlung

E-Binder sollte ein persönliches Werkzeug für Pokémon-Sammler werden, die ihre Karten als eigene Binderseiten organisieren und ihre nächsten Ergänzungen planen wollen. Die bestehenden Themenkapitel sind dafür wertvolle Vorlagen. Auf Wunsch des Nutzers kommen Artist-Binder und automatisch zusammengestellte Seitenvorschläge aus der eigenen, auch per Scan erfassten Sammlung als zentrale Produktfunktion hinzu.

Das Produktversprechen: **„Deine Karten. Deine Binder. Du weißt, was du hast, wo es liegt und was dir noch fehlt.“**

Der gestalterische Kern: **„Aus deinen Karten entstehen Binderseiten, die zu deinem Geschmack passen.“**

Regelmäßige Nutzung entsteht an konkreten Anlässen: Karten erhalten, einen Kauf prüfen, einen Binder planen, auf einer Börse tauschen und die Sammlung zeigen. Jeder dieser Anlässe muss mit wenigen verständlichen Schritten funktionieren.

Die Zielrichtung „Jeder Nutzer verwaltet seine eigene Sammlung“ wurde vom Nutzer bestätigt. Die aktuelle App wurde ausdrücklich als öffentliches, redaktionelles Album gebaut. Die folgenden Funktionslücken sind deshalb Anforderungen des neuen Produktziels und keine nachträglichen Vorwürfe an die bisherige Umsetzung.

## Was bereits trägt

- Die Binderhüllen, Papierfarben und unverdeckten Karten geben dem Produkt einen eigenen Charakter. Diese Gestaltung erhalten.
- Themen wie „Familienbande“, „Pokémon-Café“ und „Greninja“ bieten einen konkreten Einstieg in die Planung einer Sammlung.
- Kartendetails enthalten Ausgabe, Sammlernummer und einen zugeordneten Cardmarket-Link. Die Preisart und der Datenstand werden erklärt.
- Die technische Trennung aus Daten, Navigation und Oberfläche ist überschaubar. Ein Frameworkwechsel ist für die ersten Schritte kein Produktziel.
- Dialog, Fokus-Rückgabe, Tastaturnavigation, Ladefehler und reduzierte Bewegung sind bereits berücksichtigt.

## Befunde nach Bedeutung für das neue Ziel

| Priorität | Ort und beobachtete Evidenz                                                                                                                                     | Auswirkung                                                                                                                                                  | Kleinster sinnvoller Ansatz                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hoch      | `public/collection.json`, `src/domain/collection.ts`: ein gemeinsames redaktionelles Datenpaket mit 198 Karten, ohne persönliche Bestände oder Schreibfunktion. | Nutzer können ihre Sammlung nicht erfassen und haben keinen individuellen Arbeitsstand.                                                                     | Separaten persönlichen Bestand mit Menge und stabiler Referenz auf die konkrete Kartenausgabe einführen. Für öffentliche Mehrbenutzernutzung private Speicherung und Zugriffsschutz vorsehen. |
| Hoch      | Oberfläche und `src/app.ts`: Einstieg in „Familienbande“, Navigation über Kapitel; keine Suche oder Filter.                                                     | Eine gesuchte Karte oder ein bestimmtes Exemplar ist nur durch Stöbern auffindbar.                                                                          | Globale Suche nach Name, Set und Nummer; klar zwischen eigenem Bestand und Katalog unterscheiden. Bestand, Wunschliste und zum Tausch freigegebene Karten filtern.                            |
| Hoch      | `src/domain/collection.ts`: jedes Kapitel muss genau neun Karten und drei Cover enthalten. Bearbeitung und leere Plätze fehlen.                                 | Nutzer können keinen eigenen, noch unvollständigen Binder aufbauen.                                                                                         | Seiten mit neun Plätzen modellieren; Plätze dürfen leer oder geplant sein. Eigene Binder aus leerer Vorlage oder vorhandenen Themen erstellen.                                                |
| Mittel    | Mobiler Browser, tatsächlich gemessene Inhaltsfläche 390 × 664 CSS-Pixel: Pager beginnt bei y ≈ 702; Cardmarket-Link im geöffneten Floink-Dialog bei y ≈ 680.   | Blättern und Kaufrecherche benötigen Scrollen; schnelle Verwaltungsaktionen würden in der bestehenden Informationsreihenfolge ebenfalls zu spät erscheinen. | Suche und primäre Bestandsaktion früh erreichbar machen; beim Dialog eine gut erreichbare Aktionszeile testen. Keine Überlagerung von Text oder Tastaturfokus.                                |
| Mittel    | Kartendialog geöffnet: URL bleibt auf dem Kapitel beziehungsweise der Startseite.                                                                               | Eine einzelne Karte lässt sich nicht direkt mit dem angezeigten Zustand verlinken.                                                                          | Stabile Kartenlinks; persönliche Binder zusätzlich nur nach ausdrücklicher Freigabe teilen.                                                                                                   |
| Mittel    | `src/domain/navigation.ts`: ein Aufruf ohne Hash beginnt mit Kapitel 1; ein vorhandener Kapitel-Hash bleibt beim Reload erhalten.                               | Beim erneuten Einstieg über die Basisadresse geht der zuletzt bearbeitete Kontext verloren.                                                                 | Persönliche Startansicht mit zuletzt geöffnetem Binder und „Weiter bearbeiten“. Explizite Deep Links weiterhin vorrangig behandeln.                                                           |
| Mittel    | Preisfelder und Seitenwerte sind formatierte Texte; Preisarten unterscheiden sich zwischen Standard- und Greninja-Kapiteln.                                     | Daraus lässt sich kein belastbarer persönlicher Sammlungswert ableiten.                                                                                     | Numerische Preisbeobachtungen mit Währung, Quelle, Datum und Preisart getrennt speichern. Nur eigene Exemplare bewerten; fehlende Preise sichtbar ausweisen.                                  |

Diese Liste trennt Arbeitsabläufe und Produktlücken von Geschmacksfragen. Der Abstand des Pagers oder ein langer Dialog ist für das heutige Anschauen kein blockierender Fehler. Für häufige Bestandsarbeit ist die Reihenfolge der Inhalte jedoch zu überprüfen.

## Die drei wichtigsten Produktpakete

### 1. Eigene Karten schnell erfassen und wiederfinden

Die erste nutzbare Version braucht eine durchgängige Strecke: Karte suchen → konkrete Ausgabe erkennen → hinzufügen → Menge ändern → nach erneutem Öffnen wiederfinden.

- Suche zeigt Bild, Set und Nummer, damit gleichnamige Karten unterscheidbar sind. Sprache und Variante werden dort erfasst, wo sie für das Exemplar relevant sind.
- Hinzufügen verlangt zunächst nur die notwendige Auswahl. Kaufpreis, Zustand, Notizen und Ablageort sind ergänzbar, ohne den ersten Eintrag zu blockieren.
- Mehrere Karten können nacheinander erfasst werden, ohne jedes Mal zur Startseite zurückzukehren. Mengen lassen sich direkt anpassen; Fehlbedienungen sind rückgängig zu machen.
- Die bestehenden 198 Karten dienen als Demo und als Vorlage. Für eine breiter nutzbare Sammlungsapp muss der Katalog die Karten der Zielnutzer abdecken. Ein begrenzter Pilotkatalog ist möglich, muss aber als solcher erkennbar sein.
- CSV-Import mit Vorschau und Klärung nicht zuordenbarer Karten reduziert die Arbeit für bestehende Sammlungen. Export und Wiederherstellung gehören zur Vertrauensbasis.
- Stapelscannen wird als weiterer Erfassungsweg früh erprobt: fortlaufend einzelne Karten mit der Kamera erfassen oder vorhandene Bilder importieren, Erkennung prüfen und anschließend den bestätigten Bestand übernehmen. Die Sitzung bleibt unterbrechbar und fortsetzbar. Mehrere Karten in einem gemeinsamen Foto sind eine gesondert zu prüfende Erweiterung.

Abnahme: Eine Testperson kann mehrere eigene Karten korrekt hinzufügen, die richtige Ausgabe wiederfinden, einen Fehler korrigieren und nach erneutem Öffnen denselben Bestand sehen. Zwei Nutzer sehen und bearbeiten ausschließlich ihre eigenen privaten Bestände.

### 2. Persönliche Binder aus eigenen Ideen und deinen Vorlagen

Die bestehenden Kapitel werden zu übernehmbaren Seitenideen. Beim Übernehmen werden gewünschte Motive geplant und mit dem tatsächlichen Bestand abgeglichen. Es werden keine Karten automatisch als vorhanden eingetragen.

- Eigene Binder benennen; leere 3×3-Seiten und Themenvorlagen anbieten.
- Kartenplätze belegen, tauschen und leeren. Neben Ziehen auch „Verschieben nach …“ für Touch und Tastatur anbieten.
- Geplante, fehlende und vorhandene Karten mit Text beziehungsweise Symbolen unterscheiden. Kartenmotive sollen erkennbar bleiben.
- Fortschritt auf das gewählte Sammelziel beziehen: etwa „7 von 9 gewünschten Motiven vorhanden“. Keine pauschalen „198 fehlend“ für einen neuen Nutzer.
- Gewünschte Motive und physisch belegte Plätze unterscheiden. Eine Karte kann im Bestand sein, aber noch nicht im realen Binder liegen.

Abnahme: Eine Testperson übernimmt „Familienbande“, erkennt vorhandene und gesuchte Karten und passt die Seite an. Die Übernahme und das Verschieben verändern die Zahl ihrer besessenen Exemplare nicht.

### Erweiterung: Artist-Binder und Vorschläge aus der eigenen Sammlung

Der gewünschte Ablauf: **Karten scannen oder importieren → Erkennung bestätigen → wenige Geschmacksfragen beantworten → mehrere echte Seitenvorschauen vergleichen → Entwurf anpassen und übernehmen.** Die Vorschlagsfunktion arbeitet auch mit bereits manuell erfasstem Bestand; ein erneuter Scan ist nicht erforderlich.

#### Artist-Binder

- Nach Illustrator suchen und die zugeordneten Karten aus dem eigenen Bestand sehen. Ein eigener Einstieg kann geeignete Artists anhand der vorhandenen Karten vorschlagen.
- Einen Artist auswählen und daraus eine oder mehrere Seiten planen. Auf Wunsch mehrere Artists bewusst kombinieren.
- Zusammengehörige Bildgeschichten, wiederkehrende Motive und passende Farbwelten innerhalb der Artist-Auswahl bei der Anordnung berücksichtigen. Derselbe Künstler allein garantiert noch keine stimmige Seite.
- Bei zu wenigen eigenen Karten eine Teilseite zeigen oder weniger Seiten vorschlagen. Weitere Artists und fehlende Wunschkarten nur nach einer bewussten Auswahl ergänzen.
- Artist-Namen als strukturierte, normalisierte Katalogdaten führen. Die aktuelle Freitextangabe in `facts` kann als Ausgangsmaterial dienen, braucht aber geprüfte Zuordnungen. Unbekannte Credits bleiben unbekannt; sie werden nicht erfunden.

#### Drei kurze Fragen statt eines langen Formulars

1. **„Was soll die Seiten verbinden?“** Künstler, Farben, Pokémon/Entwicklungsreihen oder Motive und Geschichten. Wenn „Künstler“ gewählt wird, passende Artists aus dem Bestand anbieten.
2. **„Nur Karten aus deiner Sammlung?“** Standard ist der bestätigte eigene Bestand. Optional darf der Entwurf fehlende Wunschkarten enthalten; diese werden klar gekennzeichnet. Nur in diesem Modus sind ein optionales Ergänzungsbudget und Preisangaben relevant.
3. **„Welche Karten sollen unbedingt dabei sein?“** Bis zu wenige Lieblingskarten auswählen oder überspringen.

Anfangs gilt das bestehende Format mit neun Plätzen. Die gewünschte Seitenzahl ist eine kompakte Einstellung mit sinnvoller Vorbelegung anhand des geeigneten Bestands; weitere Binderformate können später ergänzt werden. Antworten und Bestand bleiben beim Zurückgehen erhalten.

#### Was die Ergebnisse leisten müssen

Zunächst drei unterscheidbare Entwürfe als vollständige Kartenraster anbieten, beispielsweise „Ruhige Farbwelt“, „Motivgeschichte“ und „Lieblingskarte im Mittelpunkt“. Bei einer festen Artist-Auswahl variieren die Anordnungen innerhalb dieser Auswahl. Es werden die tatsächlichen Kartenbilder verwendet.

Jeder Entwurf nennt kurz seinen Zusammenhang, etwa „Dieser Vorschlag verbindet Waldmotive mit ruhigen Grüntönen“. Illustrative Farbwelt, Motiv, Bildrichtung, Rahmen und Verteilung auffälliger Karten können dafür herangezogen werden. Eine gemeinsame Pokémon-Energieart allein beschreibt keine gemeinsame Bildästhetik. Begründungen dürfen nur auf tatsächlich verfügbaren oder geprüften Merkmalen beruhen.

Nutzer können einzelne Plätze festhalten, eine Karte ersetzen, Plätze tauschen und nur die freien Plätze neu vorschlagen lassen. Ein Entwurf lässt sich speichern, ohne sofort die bisherige Binderanordnung zu verändern. Bei einer späteren Ergänzung der Sammlung darf E-Binder neue Möglichkeiten anbieten; bestehende Seiten bleiben unverändert, bis der Nutzer eine Übernahme wählt.

#### Regeln für verlässliche Vorschläge

- Mengen und Verfügbarkeit sind feste Grenzen. Innerhalb eines übernommenen mehrseitigen Binders wird ein physisches Exemplar höchstens einmal zugewiesen. Drei alternative Entwürfe dürfen hingegen dieselben Exemplare zur Auswahl zeigen.
- Bereits in einem realen Binder zugeordnete Exemplare werden standardmäßig nicht stillschweigend für einen weiteren physischen Binder verplant. Geplante Alternativen und reale Belegung sind unterscheidbar.
- Festgehaltene Plätze bleiben bei erneuten Vorschlägen erhalten. Wenn damit kein vollständiger Entwurf möglich ist, wird das erklärt und eine Teilseite angeboten.
- „Nur eigene Karten“ wird niemals heimlich gelockert. Fehlende Wunschkarten erzeugen keinen Besitz und werden nicht ohne Bestätigung zur Wunschliste hinzugefügt.
- Das Ergänzungsbudget gilt nur bei ausreichend passenden Preisdaten als geprüft. Unbekannte Preise werden als offen ausgewiesen.
- Ein Scan unterscheidet Erkennungsvorschlag und bestätigten Bestand. Unsichere Set-, Nummern-, Sprach- oder Variantenzuordnungen können korrigiert oder zurückgestellt werden. Die Kamera leitet keinen verlässlichen Zustand oder Gradingwert ab.
- Wiederholtes Erfassen desselben Motivs kann ein weiteres Exemplar oder eine versehentliche Wiederholung sein. Mengen vor Übernahme bestätigen; gleiche Karten nicht pauschal zusammenwerfen oder mehrfach zählen.
- Nicht erkannte Karten bleiben in der Erfassungssitzung auffindbar. Manuelle Suche, erneuter Scan und Fortsetzen nach Unterbrechung sind vorgesehen. Über eine etwaige Verarbeitung von Fotos außerhalb des Geräts vor dem Upload verständlich informieren.

Abnahme: Eine Testperson erfasst einen Kartenstapel, korrigiert eine absichtlich falsche Ausgabe und setzt eine unterbrochene Sitzung fort. Aus dem bestätigten Bestand entstehen mehrere vergleichbare Vorschläge, darunter ein Artist-Binder. Ein fixierter Platz bleibt beim erneuten Vorschlagen unverändert; Mengen werden eingehalten. Bei weniger als neun geeigneten Karten entstehen nachvollziehbare Teilseiten. Besitz und bestehende Binder ändern sich erst durch die jeweilige bestätigte Aktion.

### 3. Einkauf und Tausch vorbereiten

Auf dem Handy sollte E-Binder die Frage „Brauche ich diese Karte noch?“ unmittelbar beantworten.

- Wunschliste mit exakter Ausgabe, optionaler Wunschmenge und Priorität.
- Filter „Fehlt für diesen Binder“; aus einer gerade erworbenen Karte kann direkt ein Bestandseintrag werden.
- Explizite Freigabe von Exemplaren zum Tausch. Eine doppelte Karte gilt nicht automatisch als abzugeben.
- Eigenen Ablageort anzeigen, falls erfasst: Binder, Seite, Platz oder Box.
- Wunsch- oder Tauschliste gezielt schreibgeschützt teilen. Einkaufspreise und private Notizen bleiben privat.
- Offlinezugriff auf die für den Termin nötigen Listen später mit klarer Speicher-, Synchronisations- und Updateanzeige ergänzen.

Abnahme: Eine Testperson kann beim simulierten Kauf prüfen, ob sie die konkrete Ausgabe besitzt oder sucht, und anschließend die Menge korrekt aktualisieren. Ein geteilter Link zeigt nur die bewusst freigegebenen Informationen.

## Vorschlag für den Einstieg

Erster Besuch: „Karten scannen“, „Sammlung importieren“ und „Mit Demo ausprobieren“ als verständliche Startmöglichkeiten. Nach bestätigter Erfassung führt „Seiten vorschlagen“ durch die drei Geschmacksfragen. Manuelles Hinzufügen, ein leerer Binder und Themenvorlagen bleiben erreichbar. Konto und Synchronisation werden beim dauerhaften Sichern verständlich eingeführt; ohne Konto muss ein eventueller lokaler Testbestand klar als lokal bezeichnet sein.

Wiederkehrender Besuch: Suchfeld und „Karten hinzufügen“ direkt sichtbar, darunter zuletzt bearbeitete Binder, zuletzt hinzugefügte Karten und die eigene Wunschliste. Aus dem Bestand ist „Seiten vorschlagen“ unmittelbar erreichbar; neue Karten können Anlass für zusätzliche Entwürfe sein. Ein großer Wertchart hat gegenüber diesen Aufgaben keine Priorität.

Navigation als Ausgangspunkt: **Sammlung · Binder · Wunschliste**. „Karten hinzufügen“ ist eine Aktion, die Tauschliste zunächst eine gefilterte Bestandsansicht. Die endgültige Anordnung mit echten Aufgaben am Handy prüfen.

Beispiel für einen persönlichen Einstieg, ausdrücklich keine vorhandenen Nutzerdaten:

> **Deine Sammlung**
>
> Karte suchen … · Karten hinzufügen
>
> Weiter mit „Familienbande“ — 7 von 9 gewünschten Motiven vorhanden
>
> Wunschliste öffnen · Zuletzt hinzugefügt

## Datenregeln, die vor der Umsetzung feststehen sollten

1. **Katalogausgabe, persönliches Exemplar und Binderplatz sind getrennte Dinge.** Ein Layout erzeugt keinen Besitz. Zwei Entwürfe erzeugen keine zwei physischen Exemplare.
2. **Besitz und Wunsch sind unabhängig.** Jemand kann eine Karte besitzen und eine weitere oder eine bessere Ausgabe suchen. Eine einzige Statusauswahl „besitze / suche / tausche“ wäre dafür zu eng.
3. **Vollständigkeit braucht ein ausdrückliches Ziel.** Ein frei gestalteter Binder und ein vollständiges Set haben unterschiedliche Fortschrittsregeln.
4. **Privater Bestand wird separat gespeichert.** Persönliche Daten gehören nicht in die öffentliche `collection.json` oder in den veröffentlichten Quellcode. Öffentliche Mehrbenutzernutzung benötigt serverseitig durchgesetzte Zugriffsregeln, verlässliches Speichern und Wiederherstellung.
5. **Preis ist eine datierte Beobachtung.** Zustand, Sprache, Variante und Preisquelle müssen bei einer Bewertung berücksichtigt oder als Einschränkung benannt werden. Unbekannt ist kein Wert von null Euro.
6. **Links brauchen stabile IDs.** Veränderbare Namen und numerische Kapitelpositionen eignen sich langfristig nicht als Identität persönlicher Binder und Seiten.

Ein lokaler Prototyp kann mit IndexedDB und Export beginnen. Er bestätigt die Bedienidee, erfüllt aber noch nicht die Erwartung einer geräteübergreifenden Mehrbenutzerapp. Backend und Konten vor der öffentlichen Einführung persönlicher Sammlungen ergänzen; die Wahl des konkreten Dienstes folgt den Anforderungen.

## Empfohlene Reihenfolge

| Schritt | Lieferbares Ergebnis                                                                                                                                                                                                 | Entscheidung danach                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A       | Durchgängiger persönlicher Ablauf: suchen, Ausgabe auswählen, hinzufügen, ändern, speichern, wiederfinden. Für den Pilot klarer Katalogumfang und Sicherungsmöglichkeit.                                             | Können Sammler ihren tatsächlichen Bestand zuverlässig erfassen?                     |
| B       | Eigene Binder und ein erster Vorschlagsablauf mit drei Geschmacksfragen, Artist-Zuordnung, mehreren Vorschauen und fixierbaren Plätzen. Zunächst mit bestätigtem manuell erfasstem oder importiertem Bestand prüfen. | Möchten Sammler die vorgeschlagenen Seiten tatsächlich in ihren Binder übernehmen?   |
| C       | Stapelscan mit Erkennungsprüfung, Mengenbestätigung und fortsetzbaren Sitzungen an den Vorschlagsablauf anschließen. Früher technischer Machbarkeitstest während A/B, bevor ein großer Scanumfang zugesagt wird.     | Lassen sich reale Karten zuverlässig und mit vertretbarem Korrekturaufwand erfassen? |
| D       | Private Konten, Synchronisation, Import/Export und Wiederherstellung für eine öffentliche Mehrbenutzerversion vervollständigen.                                                                                      | Bleiben Daten getrennt, korrekt und nach Gerätewechsel verfügbar?                    |
| E       | Gezieltes Teilen, Tauschvorbereitung und Offlinezugriff anhand realer Nutzung ausbauen.                                                                                                                              | Welche wiederkehrenden Anlässe profitieren tatsächlich?                              |

Die Schritte sind keine Zeitschätzung. Bei einem direkt öffentlichen ersten Release muss die Absicherung aus D bereits Bestandteil von A sein. Artist-Binder und Vorschläge werden mit der Nutzerergänzung Teil des Produktkerns. Scanner und Gestaltungsvorschläge werden getrennt validiert, damit Erkennungsfehler und unpassende Gestaltungsvorschläge einzeln verbessert werden können.

Automatische Preisalarme, soziale Feeds und umfangreiche Statistiken haben zunächst geringere Priorität als der verlässliche persönliche Ablauf und die persönlichen Seitenvorschläge. Eine installierbare PWA wird dann sinnvoll, wenn eine funktionierende Offline- und Updatestrategie vorliegt.

## Wie die Produktidee geprüft werden sollte

Vorschlag für eine noch nicht durchgeführte Nutzungsprüfung: fünf Pokémon-Sammler mit ihren eigenen Karten und mindestens einem echten Sammelziel einladen. Sie sollen ohne Anleitung mehrere Karten erfassen, einen Fehler korrigieren, einen Binder planen, eine fehlende Ausgabe finden und einen Kauf beziehungsweise Tausch vorbereiten.

Für den ergänzten Vorschlagsablauf sollen sie zudem drei Entwürfe vergleichen, einen Artist-Binder erstellen und einen Platz bei erneuter Gestaltung festhalten. Entscheidend sind die tatsächlich übernommenen Entwürfe, benötigte Korrekturen und die Fähigkeit, den Seitenzusammenhang mit eigenen Worten zu beschreiben. Für den Scanner unterschiedliche Beleuchtung, Hüllen, ähnliche Ausgaben, Dubletten und unbekannte Karten einbeziehen. Erkennungsqualität und Gefallen der Seiten getrennt auswerten.

Beobachten, ob die richtige Ausgabe gewählt wird, wo Hilfestellung nötig ist und ob die Listen beim nächsten tatsächlichen Sammelanlass wieder genutzt werden. Häufige Seitenaufrufe allein belegen keinen Nutzen. Automatische Nutzungsdatenerfassung wurde für dieses Review nicht eingerichtet.

## Prüfgrundlage und Grenzen

- Repository, README, Designvertrag, Architektur, Datenschema, Navigation, Dialog, Styles und vorhandene Browserprüfungen gelesen.
- Live-Seite `https://artursugarbear.github.io/E-Binder/` im Chromium-Browser geöffnet: HTTP 200, gerenderter Titel mit 198 Karten und 22 Kapiteln. Die Live-HTML verweist auf dieselben JS- und CSS-Dateinamen wie der lokale Produktionsbuild.
- `npm run build` erfolgreich: Schema, 22 Kapitel, 198 Bilddateien, zugeordnete URL-Formate, TypeScript und Produktionsbundle geprüft. Das bestätigt nicht die wirtschaftliche Richtigkeit der Preise oder die Inhalte externer Angebote.
- Lokalen Produktionsbuild in Chromium bei 1440 Pixeln, im iPhone-13-Profil und bei 320 Pixeln geprüft. Dialogöffnung, Schließen, Fokus-Rückgabe, Navigation, Wiederaufruf und die beschriebenen mobilen Positionen beobachtet. Keine JavaScript-Seitenfehler in diesen Abläufen.
- Screenshots und Messdaten liegen unter `/workspace/scratch/e-binder-review/`. Vollseitenbilder können noch nicht in den sichtbaren Bereich gescrollte Kapitelcover als Platzhalter zeigen; das allein ist kein Nachweis eines Bildfehlers.
- Vorhandene Browser-Suite gegen den echten lokalen Vite-HTTP-Server mit System-Chromium ausgeführt: **57 Prüfungen erfolgreich, eine erwartungsgemäß übersprungen** (Touch-Injektion im Desktop-Projekt). Beide Chromium-Projekte prüfen alle 22 Kapitel und ihre Karten, Links, Navigation, Ladefehler und automatisierte axe-Regeln; das Mobilprojekt prüft zusätzlich die Touch-Geste. WebKit/Safari, reale Smartphones und manuelle Screenreaderbedienung sind nicht Teil dieses Reviews.
- Es gab keine Nutzerinterviews, keine Bestandsdaten echter Nutzer und keine Auswertung von Nutzungszahlen. Aussagen über Wiederkehr sind begründete Produkthypothesen.
- Die App und ihre Veröffentlichung wurden nicht verändert. Dieser Bericht beschreibt vorgeschlagene Arbeit.
