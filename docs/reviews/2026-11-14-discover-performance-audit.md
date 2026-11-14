# Discover — Performance-Audit (2026-11-14)

Read-only Audit von `src/ui/catalog-browser.ts`, `src/ui/discover-view.ts`,
`src/data/card-catalog.ts`, `src/data/card-images.ts`,
`src/data/artwork-fallbacks.ts` und `vite.config.ts`. Keine Messwerte auf echten
Geräten; die Befunde sind Code-/Request-Fluss-Analyse.

## 1. Request-Fluss (heute)

- **Erstes Öffnen:** `loadMetadata()` startet sechs GETs für Deutsch
  (`/sets`, `/series/tcgp`, `/en/sets`, `/illustrators`, `/rarities`,
  `/series`) und wartet auf **alle**, bevor das Set-Raster erscheint
  (`catalog-browser.ts:529–549`). Kein `/cards`-Request, solange keine Suche
  oder Filter aktiv sind (`discover-view.ts:186–200`).
- **Set-Wechsel:** erst `loadMetadata()` (gecacht), dann
  `catalogSetFacets()` per GraphQL-POST (komplettes Set + Karten), ggf.
  `/en/sets/{id}` und lokale `catalog-art`-Manifeste; danach
  `secondaryArtworkSetIds()`. Erst dann werden Karten gerendert
  (`catalog-browser.ts:891–894`, `1052`, `1064–1067`).
- **Filterwechsel im Set:** lokal, kein Netzwerk — außer Preis-Sortierung.
- **Preis-Sortierung:** `/sets/{id}` plus ein `/cards/{id}` pro Karte, bis zu
  vier parallel (`catalog-browser.ts:926–976`). Das komplette Set wurde davor
  bereits per GraphQL geladen.
- **Kartendetail:** `/cards/{id}`, ggf. EN-Bild, JP-Zusatzdaten, Preis-Integrität
  (Set + bis zu acht Geschwisterkarten), FX-Request. Der Dialog öffnet erst
  nach Abschluss aller Schritte (`card-catalog.ts:696–758`).

## 2. Caching

| Daten                              | Memory                          | SW/HTTP                    | Lücke                                         |
| ---------------------------------- | ------------------------------- | -------------------------- | --------------------------------------------- |
| Sets/Series/Rarities/Illustratoren | 5 min, max 1500                 | NetworkFirst 5 s, 120/24 h | Kein In-Flight-Coalescing                     |
| Set-Facets (GraphQL)               | 5 min, nur validierte Antworten | **kein SW-Rule für POST**  | URL ist immer `/v2/graphql`; Body ist der Key |
| Suche/Detail/Preise                | 5 min pro URL                   | NetworkFirst               | Kein Coalescing; Detail-Fallback einzeln      |
| Preis-Scan                         | `pricing` Map, **kein TTL**     | —                          | Veraltete Preise innerhalb der Session        |
| Bilder                             | 5 min/500                       | SWR 180/30 d               | Erste sichtbare Kacheln ebenfalls lazy        |
| catalog-art                        | Promise-Cache ohne TTL          | NetworkFirst 3 s, 60/7 d   | 175 Manifeste teilen 60 Slots                 |

## 3. Blockaden des ersten mobilen Screens

1. Das Set-Raster wartet auf vier Hilfs-Endpunkte, obwohl es nur `/sets`
   braucht.
2. Kartenresults warten auf komplette Artwork-Anreicherung inkl. lokaler
   Manifeste.
3. Preis-Sortierung wartet auf einen zweiten vollständigen Set-Fetch plus
   Detail-Requests pro Karte.
4. Kartendetail bündelt Bild-Fallback, Preis und Integritätsprüfung in einem
   Promise.
5. `CardImages.artwork()` ruft `url(card)` sofort für jede Kachel auf, auch für
   nicht sichtbare Kacheln; bei Secondary-Art entstehen zusätzliche
   `/cards/{id}`-Requests.

## 4. Bilder

- Karten haben `loading="lazy"`, `width=63`, `height=88`; das `.card-art`-Frame
  reserviert 63:88. Hauptlayout springt daher nicht.
- Set-Logos sind lazy, haben aber keine intrinsischen Maße.
- Kein `srcset`, `sizes`, `fetchpriority`; die erste sichtbare Karte und das
  Detail-Hero sind ebenfalls lazy.
- Fehlende/secondary Art führt zu „Bild wird geladen …", ggf. 12-s-Timeout und
  einzelnem EN-Fallback pro Karte.

## 5. Sichere Fixes (priorisiert)

1. **Set-Raster zuerst aus `/sets` malen**, Hilfsmetadaten danach; Filter bis
   dahin deaktiviert/„lädt". `catalog-browser.ts:529–549`.
2. **Kartenliste vor Artwork-Anreicherung rendern**; reserviertes Frame sofort,
   Bilder nachhydrieren. `catalog-browser.ts:653`, `1052`, `1064–1067`.
3. **In-Flight-Coalescing** in `cachedJson()` und **Batch-Fallback** für
   fehlende Bilder. `card-catalog.ts:159–166`, `330–364`,
   `card-images.ts:192–199`.
4. **Kein doppelter Set-Fetch im Preis-Modus**; GraphQL-Kartenliste
   wiederverwenden. `catalog-browser.ts:653`, `717`.
5. **Erste sichtbare Bilder eager + `fetchpriority="high"`**, Rest lazy;
   Set-Logos mit Maßen. `card-images.ts:163–168`,
   `catalog-browser.ts:356–369`.
6. Facets mit `lang`/`setId` keyen oder per Cache Storage ablegen; Prefetch nur
   bei Annäherung. `card-catalog.ts:1121–1140`, `vite.config.ts:170–184`.
7. Statische Katalog-Metadaten im SW auf StaleWhileRevalidate umstellen;
   Artwork-Index-Cache getrennt/größer dimensionieren.
8. Set-Suche ohne Neuaufbau aller Knoten pro Tastendruck.

## 6. Korrektheitsgrenzen

- Initialer Deep-Link `?page=` darf nicht auf 1 zurückfallen; Filterwechsel
  setzen bewusst zurück.
- Set-Auswahl nutzt `pushState`, Filter `replaceState`; Prefetch darf
  `onStateChange` nicht aufrufen und `page`/`active` nicht verändern.
- `active`/`scopeKey`-Guards sind load-bearing; Prefetch braucht eigenen
  AbortSignal.
- Cache-Keys müssen Sprache, Query, Set, Artist, Rarität, Order und Page
  enthalten.
- Preis-Sortierung darf nie partial gerendert werden; `pricing` braucht TTL.
- Nur vollständig validierte Facets cachen.
- Bild-Shortcuts nur für exakt validierte Set/Nummer/Sprache; `card.image` ist
  ein Hinweis, kein Beweis.

## 7. Nicht geprüft

- Keine echten iPhone-/LTE-Messungen, kein Lighthouse/Performance-Trace.
- Keine Aussage über API-Latenz der TCGdex-Endpunkte.
- Keine Änderung implementiert; dieser Audit ist eine Grundlage für den
  Discover-Branch.
