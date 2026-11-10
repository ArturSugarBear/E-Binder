# E-Binder — Lovebrand Exploration / Brand Kit v0.1

**Status: drei vollständig definierte Markenrichtungen zur Auswahl; keine davon ist bisher auf die Live-App angewendet.**

Produktkontext: [PRODUCT.md](../PRODUCT.md). Grundlage: Impeccable v4.8.2, insbesondere **new-work → critique → typeset → colorize → craft-floor**. Die offizielle CLI ist in der Chat-Umgebung wegen blockiertem Download nicht ausführbar; das ist eine manuelle Umsetzung der offenen Designregeln, keine Behauptung eines erfolgreichen CLI-Detektorlaufs.

## Die gemeinsame Idee

**E-Binder ist kein Scanner mit angeschlossenem Inventar, sondern die Freude am Sammeln in digitaler Form.** Die Sammlung ist ein Archiv persönlicher Erinnerungen, Lieblingsillustrationen, Funde und Geschichten. Nicht das UI, sondern die Karte selbst ist das Wertstück.

Bestehenden Produktnamen **E-Binder** erhalten. Keine Pokémon-Markenbestandteile, Pokébälle oder Fremdfirmen-Icons im eigenen Zeichen. Kein technisch anmutendes 3×3-Kachellogo. Ein erkennbares App-Icon muss auch ohne Wortmarke bei 16, 32, 60 und 180 Pixeln funktionieren.

### Richtung A · Keepsake / Sammelalbum

- **Kulturelle Herkunft:** liebevoll geführte Sammelalben, Notizpapier, gefaltete Einleger, Lieblingskarte als Lesezeichen.
- **Charakter:** sanft, selbstbewusst, persönlich, warm, modern; eher Designboutique als Dashboard.
- **Logo:** eine einzelne Karte wird aus einer gefassten Albumtasche herausgezogen. Flaches, bewusst asymmetrisches Zeichen, keine Sterne und keine 9-Kachel-Grafik.
- **Farbsystem:** Canvas Porcelain `#F8F4EB`; Fläche White `#FFFFFF`; Text Album Ink `#24222D`; Sekundärtext `#635E70`; Primäraktion Plum Iris `#4B3E9C` mit Weiß; Akzent Berry Note `#DE5A76`; Detail Lavender Label `#B8A9FF`.
- **Typografie:** _Syne_ 600–700 für Marke und persönliche Albumüberschriften; _DM Sans_ 400/500/700 für App-Bedienung. Erlaubte freie Schriftfamilien (SIL OFL); konkrete Self-Hosted-Font-Dateien samt Lizenz werden erst nach Identitätsfreigabe eingebunden. Systemschriften als Fallback.
- **Brand Voice:** „Deine Karten. Deine Geschichten.“ / „Jede Lieblingskarte hat ihren Platz.“ / „Ein Album für alles, was du gern behältst.“
- **UI-Signatur:** leichter warmer Untergrund; die physische Binderseite als dunkler, ruhiger Fremdkörper; einzelne Beerenmarkierung nur für Favoriten und emotionale Momente; Aktionen in Plum Iris.
- **Risiko:** Zu viel Papierbeige kann wie eine Lifestyle-App aussehen. Die Kartenvisuals müssen die Bühne dominieren, nicht Dekoration.

### Richtung B · Rare Room / Sammlerclub

- **Kulturelle Herkunft:** unabhängige Musik-Labels, limitierte Editionssticker, Stickerbombing mit Ordnung, Sammeln als Fan-Kultur.
- **Charakter:** energiegeladen, eigenständig, dynamisch, stolz auf ungewöhnliche Funde.
- **Logo:** drei gegeneinander versetzte Archivhüllen, letzte Karte in hellem Papier. Eine klare Form ohne Glows.
- **Farbsystem:** Canvas Night Ink `#18191E`; Fläche Charcoal Sleeve `#272830`; Text Paper `#F8F4ED`; Sekundärtext `#B8B7C6`; Primäraktion Acid Lime `#DDF76B` mit Night Ink; Sekundärsignal Lilac `#BBA7FF`.
- **Typografie:** _Unbounded_ 600–700 ausschließlich für das Brand-/Editorial-Display, _Manrope_ 400/600 für alle nativen Bedienelemente. Beide SIL OFL; erst nach Freigabe selbst hosten.
- **Brand Voice:** „Dein Fund. Dein Moment.“ / „Nicht nur sammeln. Lieben.“ / „Zeig die Karten, die dir etwas bedeuten.“
- **UI-Signatur:** dunkle, matte Sammelhüllen ohne neonartige Hintergrundverläufe; kräftiger Lime-Aktionspunkt, markante plakative Seitentitel.
- **Risiko:** Das plakative Display darf Scanner, Kartenmetadaten und Einhandbedienung nicht übertönen.

### Richtung C · Folio House / Galerie

- **Kulturelle Herkunft:** Kunstkatalog, kuratierte Museumsmappe, sorgfältige Sammlungsedition, Faltblatt und Register.
- **Charakter:** langlebig, kultiviert, bewusst leise, kunstorientiert, weniger verspielt.
- **Logo:** gefaltetes Blatt mit sichtbarer Archivkarte – klarer Papierausschnitt, keine abstrakte generische 9.
- **Farbsystem:** Canvas Forest Ink `#17362F`; Fläche Deep Folio `#24453C`; Text Warm Ivory `#F7F5EC`; Sekundärtext `#C9D9CE`; Primäraktion Fresh Parchment `#DCEBAD` mit Forest Ink; Sondermarkierung Dusty Rose `#F0ABAF`.
- **Typografie:** _Newsreader_ 500 für Editorial-Titel, _Instrument Sans_ 400/600 für UI und Zahlen. Beide über die Google-Fonts-OFL-Sammlung zu verifizieren; Produktionsdateien separat lizenzieren und selbst hosten.
- **Brand Voice:** „Jede Karte erzählt etwas.“ / „Deine Sammlung verdient eine Bühne.“ / „Gesammelt mit Gefühl.“
- **UI-Signatur:** großzügige Bildräume, mattschwarze Taschen auf tiefgrüner Bühne, klare kleine Inventarangaben, galerieartige Binderansichten.
- **Risiko:** Zu gediegen für Nutzer, die dynamische Anime- und TCG-Fankultur lieben.

## Entscheidung

**Gestalterischer Favorit: A – Keepsake.** Es lässt sich zwischen hellen kuratierten Entdecken-/Sammlungsansichten und dunklen physischen Binderseiten differenzieren und trägt den emotionalen Sammlergrund am besten. Die drei Richtungen sind aber **gleichberechtigte Alternativen**, bis der Nutzer eine auswählt.

Eine Wahl gilt für Logo, Palette, Typografie und Sprache gemeinsam. Die Marken sollten nicht frei gemischt werden, weil genau das im aktuellen Produkt die visuelle Beliebigkeit erzeugt.

## Token-Rollen und Kontrast (sRGB/WCAG 2.x, berechnete Werte)

| Konzept     | Vordergrund / Canvas | Sekundär / Canvas | CTA-Text / CTA | Vordergrund / Fläche |
| ----------- | -------------------: | ----------------: | -------------: | -------------------: |
| Keepsake    |              14.26:1 |            5.68:1 |         8.51:1 |              15.65:1 |
| Rare Room   |              16.01:1 |            8.88:1 |        14.70:1 |              13.37:1 |
| Folio House |              11.98:1 |            8.91:1 |        10.30:1 |               9.65:1 |

Diese Werte prüfen **nur fest definierte Tokenpaare**, keine gesamte WCAG-Konformität, keine Fokus- oder Disabled-Zustände. Vor Produktion: rendered contrast, normale und große iPhone-Darstellung, dynamischer Text, Farbsinnvarianten, 16-/32-px-Zeichen, SVG-Sicherheitsprüfung und alte PWA-Icons ersetzen.

## Markenkonsequenz statt bloßer Farben

- **Einstieg:** eine einzelne echte (lizenzierte bzw. nutzereigene) Karte als visueller Held; Markenbotschaft statt KPI-Kacheln.
- **Sammlung:** Cover-Art führt; Sammlungsstatistik ist leise, Suchfeld sofort sichtbar; keine verschachtelten Dashboard-Karten.
- **Binder:** körperliche Tasche / Naht / Papierumdrehung bleibt das charakteristische Interface. Animationssignatur ausschließlich am tatsächlich umgeschlagenen Blatt (180–220 ms, reduced motion respektieren).
- **Scan:** sichtbarer 3×3-Erkennungspfad und maximal drei antippbare Bildkandidaten. Verarbeitungsfortschritt ist ehrlich, keine erfundene Gewissheit.
- **Favoriten:** ein einzelnes visuelles Bookmark/Collector-Label, keine zufälligen Emoticons.
- **App-Icon:** extrahierter Markenstempel auf ruhiger Vollfläche; kleine Darstellung muss ohne Text funktionieren.
- **Microcopy:** warm und konkret. Nicht „Jetzt die Power deiner Sammlung entfesseln“, sondern „Deine nächste Seite wartet“.

## Was noch nicht versprochen wird

Die Vorschau ist ein **Brand-Entscheidungsartefakt**, keine technisch abgeschlossene produktive Rebrand. Kartenbilder im Mock sind abstrakte Platzhalter, keine realen Scans und kein Produktdatensatz. Weder die bestehende Live-Palette noch Font-Dateien oder App-Icons werden durch diesen PR ausgetauscht. Danach folgen: gewählte Token in `src/styles.css` und `src/workspace.css` übertragen, rechtmäßig lizenzierte Offline-Schriften ins Projekt integrieren, SVG/PNG-App-Icon/Maskable-Icon erzeugen, Designkontrakt in `DESIGN.md` festhalten, Screenshots aus Chromium und WebKit sowie Scanner-/Binder-Regressionssuite prüfen.
