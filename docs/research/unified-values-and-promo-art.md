# Einheitliche EUR-Werte und Promo-Bilder

Stand: 12. November 2026. Folgearbeit zu PR #77 und zum mobilen Sammlerfeedback. Private Videos, Sammlungsdaten und Originalfotos bleiben außerhalb des öffentlichen Repositorys.

## Verbindliche Produktentscheidungen

Ein Kartenwert in EUR: zuerst eine verlässliche Cardmarket-Referenz, andernfalls eine passende TCGplayer-Marktbeobachtung mit datiertem USD/EUR-Kurs. Sammlung, Kartendetails und Portfolio verwenden denselben gerundeten Stückwert. Weitere Quellen bleiben mit Quelle, Variante und Datum erkennbar; USD wird nicht unkonvertiert summiert. Fehlende oder unsichere Referenzen bleiben offen, niemals 0 € oder ein erfundener Wechselkurs.

Der Wechselkurs kommt von [Frankfurter v2](https://frankfurter.dev/) mit ausdrücklich gewähltem EZB-Anbieter (`providers=ECB`). Ein geteilter Request bedient parallele Kartenabfragen. Der öffentliche Kurs wird eine Stunde zwischengespeichert, auch über Seitenneuladen; bei Ausfällen bleibt ein höchstens sieben Tage alter, datierter Referenzkurs verwendbar. Ohne geeigneten Kurs greift eine einminütige Wiederholsperre gegen Anfragefluten. Es werden keine Sammlungseinträge an den Kursanbieter übertragen. Rundung erfolgt einmal am Stückwert, anschließend werden Mengen multipliziert. Kurs- und Marktbeobachtungsdatum bleiben getrennt. Die Historie startet für die neue Bewertungsregel eine neue Reihe; frühere lokale Daten bleiben gespeichert und werden nicht als Kursgewinn verbunden.

Rückseiten, Reverse-Holo, frei bezeichnete Sonderauflagen und nicht bestätigte Druckidentitäten erhalten keinen geliehenen Standardpreis. Die Referenzen sind nicht nach Sprache und Zustand des konkreten Exemplars gefiltert und keine garantierten Verkaufserlöse. Die Preisänderung greift nicht in Besitzbestätigung, Inventarmengen, OCR oder Erkennung ein.

## Konkrete Promo-Lücke

Die geprüften TCGdex-Datensätze `mep-080` (Fynx/Fennekin) und `mep-029` (Mega-Glurak X-ex) liefern weder deutsch noch englisch eine Bild-URL. Im bisherigen Sekundärbestand fehlt das MEP-Set. Die neue Quelle ist der dokumentierte [TCGCSV-Produktexport](https://tcgcsv.com/docs) mit den zurückgegebenen TCGplayer-CDN-URLs. Keine Wettbewerberbilder werden übernommen.

| TCGdex-ID    | Produkt-ID | Prüfung                                                                                                                                   |
| ------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `mep-080`    | `694694`   | Produkt-ID aus TCGdex, MEP-Gruppe, Name, Nummer 080, Bildantwort und Sichtprüfung                                                         |
| `mep-029`    | `680639`   | Produkt-ID aus TCGdex, MEP-Gruppe, Name, Nummer 029, Bildantwort und Sichtprüfung                                                         |
| `mep-Museum` | `678659`   | Explizite Jumbo-Zuordnung in TCGdex `variants_detailed`, Jumbo-Gruppe, vollständiger Name und Sichtprüfung; keine erfundene Sammlernummer |

Der Pokémon-Center-Fynx `694695` wird nicht für `694694` eingesetzt. Standardkarten werden anhand MEP-Gruppe, Kartennummer, Name und TCGdex-Produktzuordnung verbunden. Für neun Einträge ohne TCGdex-Produkt-ID sind nach Sichtprüfung der gelieferten Bilder ausdrücklich überprüfte Zuordnungen in `scripts/promo-artwork.mjs` hinterlegt: MEP055–063 → 709969–709977. Mehrdeutige, benachbarte oder abweichend gestempelte Produkte werden nicht geraten. Diese Zuordnungen dienen ausschließlich Vorschaubildern, nicht Fotogroundtruth, Variantenbewertung oder Besitz.

Der lokale vollständige MEP-Abgleich ergab **111 erreichbare passende Bild-URLs für 112 TCGdex-Einträge**. Offen: **`mep-120`**. Hier fehlt eine sichere Zuordnung im geprüften Export; MEP028 darf nicht als Ersatz dienen. Das ist eine begrenzte MEP-Prüfung, keine Garantie, dass weltweit alle Promos dargestellt werden. Aktuelle releasebezogene Zahlen und Lücken stehen in `public/catalog-art/audit.json`. Fehlende offizielle Setlogos bleiben als neutrale Setkennung erkennbar.

Der Build erzeugt einen statischen Index; der Browser ruft keine TCGCSV-API auf. Der Anbieterstand wird zunächst über `last-updated.txt` geprüft. Der eingecheckte, auf erforderliche öffentliche Produktmetadaten reduzierte Snapshot verhindert wiederholte Exporte desselben Standes. Neue Exporte verwenden einen eigenen User-Agent und mindestens 120 ms Abstand. Im Repository liegen URLs/Metadaten, keine neu heruntergeladenen Kartenbilddateien. Vorschauen stammen aus dem zurückgegebenen 200w-Format; hochauflösende URLs werden nicht erfunden. Englische Ersatzbilder tragen „Bild: EN“ und ändern die gewählte Kartensprache nicht. Index und Bilder verwenden die vorhandenen begrenzten Browser-Caches.

## Anbieterzugang, Kosten und Rechte

TCGCSV erlaubt die Nutzung seines Dienstes laut [FAQ](https://tcgcsv.com/faq); die [Dokumentation](https://tcgcsv.com/docs) verlangt serverseitige Übernahme mit Cache statt Browser-Abfragen. Diese Dienst-Erlaubnis ist **keine umfassende Lizenz an Pokémon-Kartengrafiken**. Die FAQ benennt diese Grenze selbst. Rechte an Illustrationen verbleiben bei den jeweiligen Rechteinhabern; eine kostenpflichtige API würde sie ebenfalls nicht automatisch übertragen. Keine Verkaufsplattformen oder privaten Nutzerbilder werden hierfür gecrawlt oder weiterverbreitet.

Es wurde kein Konto eröffnet und kein Abonnement gekauft. Öffentlich geprüfte Alternativen ohne behauptete Testabdeckung:

| Anbieter                               | Öffentliches Angebot                          | Grenze der Prüfung                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Scrydex](https://scrydex.com/pricing) | Starter 29 USD/Monat, 5.000 Credits           | [FAQ](https://scrydex.com/faq): EN/JA, weitere Sprachen auf der Roadmap. Konkrete MEP-Abdeckung ohne Zugang nicht belegt; [Nutzungsbedingungen](https://scrydex.com/terms) gesondert beachten. |
| [TCGAPIs](https://tcgapis.com/pricing) | 100 einmalige Testcredits; Hobby 99 GBP/Monat | Ohne Konto keine tatsächliche Prüfung der beiden Promo-Produkte oder deutscher Bildsprache. Keine Kaufentscheidung aus Werbeangaben.                                                           |

Ein weiterer bezahlter Zugang ist für die beiden konkret gemeldeten Promos nicht nötig. MEP120 und zusätzliche weltweite Sprach-/Promo-Lücken bleiben ein expliziter Folgeauftrag für eine belegte Quelle, nicht ein versprochenes 100%-Ergebnis.

## Referenzen und Verifikation

HoloGem bleibt visuelle Referenz für klare Werthierarchie, Kartenfokus und erkennbare Navigation. Rare Room und die 3×3-Seiten bleiben erhalten. Die offizielle [FAQ](https://hologem.app/faq/) und der [Preisleitfaden](https://hologem.app/blog/pokemon-cards-value-scanner/) beschreiben Preiskontext; interne Implementierungen wurden nicht instrumentiert.

Im öffentlichen [Collectr-Katalog](https://app.getcollectr.com/) und in der [Setübersicht](https://app.getcollectr.com/sets/category/3) wurden stabile Produkt-/Gruppen-IDs, WebP und datierte Cache-Header beobachtet. Übertragen werden Wiederverwendung und stabile Identitäten. Weder Collectrs Bilder noch unbekannte Backend-Verträge werden kopiert. Die offizielle [Preiserklärung](https://getcollectr.notion.site/Everything-You-Wanted-to-Know-About-Prices-f64d490171a549a2bcd1a037e7f74602) erklärt mehrere Märkte; sie beweist keine exakte Bewertung einer anderen Sprach- oder Druckausgabe.

Reproduzierbar: `npm run audit:artwork`, `npm run check` und Browserfälle `collection-prices.spec.ts`, `portfolio.spec.ts`, `catalog-images.spec.ts`, `mobile-binder-entry.spec.ts`. Die Preisfälle prüfen Cardmarket-Priorität, gemeinsame EUR-Fallbackwerte und einen Kursausfall; die Promo-Fälle prüfen exakte Bild-URLs, Sprachkennzeichnung und ausbleibende automatische Besitzanlage. Synthetische Browserfixtures sind keine realen Preisbeobachtungen oder Trainingsdaten. Responsive Nachweise betreffen Chromium/WebKit bei 320, 390 und 430 Pixeln, keinen physischen iPhone-Test.
