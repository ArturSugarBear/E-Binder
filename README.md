# E-Binder

Digitales Sammelalbum mit 180 Pokémon-Karten in 20 Themenkapiteln.

[Binder öffnen](https://artursugarbear.github.io/E-Binder/)

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
- `assets/cards/` enthält die WebP-Bilder aus der Vorlage. Die Seite lädt Kartenbilder kapitelweise.
- `assets/fonts/` enthält die lokal geladenen Schriften und ihre Lizenzen.

GitHub Pages veröffentlicht `master` aus `/(root)`. Links wie
`#kapitel-2` öffnen direkt das jeweilige Kapitel.

Die Preisangaben im Binder stammen aus der Vorlage vom 7. November 2026. Der
Cardmarket-Link öffnet die Angebote der jeweiligen Kartenausgabe. Die Produkt-IDs
wurden anhand der englischen Kartennamen, Set-IDs und Sammlernummern bei
[TCGdex](https://www.tcgdex.net/) ermittelt und mit dem
[Cardmarket-Katalog](https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json)
abgeglichen. Kartenbilder und Pokémon-Marken gehören ihren jeweiligen Rechteinhabern.
