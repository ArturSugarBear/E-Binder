# E-Binder

Digitales Pokémon-Sammelalbum mit 198 Karten in 22 Themenkapiteln, inklusive zwei Greninja-Seiten.

[Binder öffnen](https://artursugarbear.github.io/E-Binder/) · [Greninja](https://artursugarbear.github.io/E-Binder/#greninja)

## Entwickeln

Voraussetzung ist Node.js 24 (siehe `.nvmrc`).

```sh
npm ci
npm run dev
```

Den von Vite ausgegebenen Link mit dem Pfad `/E-Binder/` öffnen. Der Entwicklungsserver aktualisiert die Vorschau bei Änderungen automatisch. Es werden keine Tokens oder API-Schlüssel benötigt.

## Prüfen und bauen

```sh
npm run check
npx playwright install chromium webkit
npm run test:e2e
```

`check` prüft Formatierung, Lint-Regeln, Unit-Tests, Kartendaten, Bilddateien und TypeScript und erstellt anschließend `dist/`. Die Browser-Tests starten automatisch den Produktionsbuild über `vite preview`. Unter Linux installiert `npx playwright install --with-deps chromium webkit` zusätzlich die Systembibliotheken.

| Befehl               | Zweck                                                     |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Entwicklung mit Live-Reload                               |
| `npm run build`      | Daten prüfen, Typen prüfen und Produktionsbuild erstellen |
| `npm run preview`    | Bereits gebauten Stand lokal ansehen                      |
| `npm run test`       | Unit-Tests einmal ausführen                               |
| `npm run test:watch` | Unit-Tests während der Entwicklung                        |
| `npm run test:e2e`   | Chromium Desktop, Chromium Mobil und WebKit Mobil         |
| `npm run format`     | Code einheitlich formatieren                              |
| `npm run check`      | Alle Prüfungen außer Browser-Tests                        |

## Aufbau

| Pfad                       | Verantwortung                                         |
| -------------------------- | ----------------------------------------------------- |
| `src/main.ts`              | Laden, Fehleranzeige und erneuter Versuch             |
| `src/domain/`              | Kartenschema und reine Navigationsregeln              |
| `src/data/`                | HTTP-Zugriff, Timeout und Validierung der Antwort     |
| `src/app.ts`               | Kapitelzustand und Zusammenspiel der Oberfläche       |
| `src/ui/`                  | Dialog, Kapitelübersicht, DOM-Helfer und Touch-Gesten |
| `src/styles.css`           | Gemeinsame Gestaltung und Greninja-Variante           |
| `public/collection.json`   | Redaktionelle Kartendaten                             |
| `public/assets/`           | Kartenbilder, lokale Schriften und Schriftlizenzen    |
| `tests/`                   | Unit-Tests und Browser-Regressionstests               |
| `.github/workflows/ci.yml` | Prüfung, Build und Veröffentlichung                   |

Mehr zur [Architektur](docs/architecture.md), zum [Designvertrag](docs/design.md) und zum [Veröffentlichen](docs/deployment.md). Hinweise für Änderungen stehen in [CONTRIBUTING.md](CONTRIBUTING.md).

## Veröffentlichung

Ziel ist GitHub Pages mit **GitHub Actions** als Quelle. Der Workflow prüft jeden Pull Request und veröffentlicht Änderungen an `master` erst nach erfolgreichen Prüfungen einschließlich Browser-Tests. Nur `dist/` wird hochgeladen. Abhängigkeiten werden über `package-lock.json` mit `npm ci` reproduzierbar installiert.

## Kartendaten und Preise

Die ursprünglichen Kapitel enthalten Richtpreise aus der Vorlage vom 7. November 2026. Die Greninja-Kapitel enthalten den [Cardmarket-Preistrend](https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json) mit Datumsangabe. Das sind Momentaufnahmen, keine Live-Preise.

Die Produkt-IDs wurden über englische Kartennamen, Set-IDs und Sammlernummern bei [TCGdex](https://www.tcgdex.net/) ermittelt und mit dem [Cardmarket-Katalog](https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json) abgeglichen. Die Browser-Tests prüfen die zugeordneten URLs; die Erreichbarkeit von Cardmarket selbst hängt vom Anbieter ab.

Greninja-Bilder stammen von TCGdex und für SWSH305 von der [Pokémon TCG API](https://pokemontcg.io/). Kartenbilder und Pokémon-Marken gehören ihren jeweiligen Rechteinhabern. Die Code-Lizenz überträgt keine Rechte an diesen Bildern oder Marken. Schriftlizenzen liegen bei den Schriftdateien.
