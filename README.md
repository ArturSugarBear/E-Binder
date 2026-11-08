# E-Binder

Digitales Sammelalbum mit 198 Pokémon-Karten in 22 Themenkapiteln.

[Binder öffnen](https://artursugarbear.github.io/E-Binder/)
[Greninja-Sonderedition öffnen](https://artursugarbear.github.io/E-Binder/#greninja)

## Lokal starten

```sh
python3 -m http.server 8080
```

Im Browser [http://localhost:8080/](http://localhost:8080/) öffnen. Die Webapp benötigt keinen Build-Schritt und keine Zugangsdaten.

## Projektstruktur

- `index.html` enthält das Seitengerüst und den Kartendialog.
- `src/app.js` rendert Kapitel, Karten und die Navigation.
- `src/styles.css` enthält das Layout und die Animationen.
- `src/collection.json` enthält Kapitel, Kartenmetadaten und die Cardmarket-Produktlinks.
- `assets/cards/` enthält die WebP-Kartenbilder. Die Seite lädt Kartenbilder kapitelweise.
- `assets/fonts/` enthält die lokal geladenen Schriften und ihre Lizenzen.

GitHub Pages veröffentlicht `master` aus `/(root)`. Links wie
`#kapitel-2` öffnen direkt das jeweilige Kapitel.

Die ursprünglichen Kapitel zeigen Richtpreise aus der Vorlage vom 7. November 2026.
Die Greninja-Kapitel zeigen den [Cardmarket-Preistrend](https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json) mit Datumsangabe.
Der Cardmarket-Link öffnet die Angebote der jeweiligen Kartenausgabe. Die Produkt-IDs
wurden anhand der englischen Kartennamen, Set-IDs und Sammlernummern bei
[TCGdex](https://www.tcgdex.net/) ermittelt und mit dem
[Cardmarket-Katalog](https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json)
abgeglichen. Die Greninja-Kartenbilder stammen von TCGdex und für SWSH305 von der
[Pokémon TCG API](https://pokemontcg.io/). Kartenbilder und Pokémon-Marken gehören
ihren jeweiligen Rechteinhabern.
