# Cardmarket price integrity: exact-print export pipeline

**No product-name price guesses. No user or beta-account data in any
pricing build.** Source and last-observed date are always displayed.

## Problem

The TCGdex `pricing.cardmarket.idProduct` field often points to another
card of the same set (e.g., me06-106 maps to the cheap Growlithe, me06-111
maps to the cheap Groudon). The TCGdex quote is then actually a quote for
that *wrong product*, not just a price outlier. A one-card price override
was insufficient and could expire with no replacement.

## New primary pipeline

`scripts/build-cardmarket-verified.mjs` joins **three independently
sourced public catalogues**, but only publishes strongly verified matches:

1. Cardmarket public Pokémon **singles product catalogue**
   `products_singles_6.json`: official product and expansion IDs, names.
2. Cardmarket public **daily price guide**
   `price_guide_6.json`: trend/7d/30d, stamped at the original source date.
3. Independently numbered Pokéllector print manifest (from the MIT-licensed
   *code* project `ZyzyThePizi/pokemon-price-data`): English set, full
   printed collector number, name, and occasional independently captured
   Cardmarket ID. Underlying marketplace and catalogue data are third-party.

For each set, upstream provider IDs serve as **set-level votes only**, not
proof of a specific printing. A monotone sequence alignment then matches
**the entire ordered expansion**. It requires at least 75% exact normalized
name agreement, expansion size within 20%, neighbouring anchors and
uncontradicted independent IDs. Only cards independently matched on set,
printed collector number and complete English name receive a price.

### Initial coverage (2026-11-11 test build)

- Six sets passed; **829 exact printings** received a dated market reference.
- Delta Reign: 131 of 141 priced printings; verified Growlithe DLR106
  idProduct **918943** at **€9.21**, Groudon DLR111 **918949** at **€18.32**,
  Inkay DLR113 **918952** at **€2.40**, Talonflame ex DLR124 **918963**
  at **€7.96**.
- Pitch Black: 114 of 120; Phantasmal Flames: 130 of 130;
  Chaos Rising: 115 of 122; Shrouded Fable: 98 of 99;
  Destined Rivals: 241 of 244.
- The 30 Years set was **not** matched to one independent set. Cards remain
  under the existing guarded TCGdex pricing instead of inventing identities.

The user account was examined privately to choose representative release
sets; none of its data, IDs, scan photos or portfolio records is exported.

### Runtime

The PWA downloads only the compact, same-origin
`assets/prices/cardmarket-verified.json` (initially about 45 kB), not
Cardmarket's full 30 MB source exports. The file is cached in memory for
five minutes. Prices expire after 72 hours; verified product IDs remain
available so Cardmarket links still lead to the **right** product. If the
manifest is missing, malformed or stale, do not use its value. Maintain the
earlier strict fallback for non-covered sets and mark suspect mappings as
unpriced. Collector inventory is never changed by a pricing update.

The main Cardmarket price guide is **not filtered for card language or
Near Mint**. The displayed trend is an orientation, not a seller offer or a
sale/portfolio liquidation value. Reverse foil requires a separate series.
The PWA never upgrades a guess to a verified market ID.

### Daily refresh and release

`.github/workflows/cardmarket-prices.yml` starts after Cardmarket's
daily guide is published. Failed source download, changed schema, source
staleness or regression to incorrect product IDs **blocks the update**.
Only a successful rebuild commits the compact manifest. Because pushes
using GitHub Actions' token do not trigger other workflows, the scheduled
job explicitly dispatches `pages.yml` for full tests and Pages deployment.

### Data rights

Cardmarket announced free downloads of the catalog and price guide in June
2024. Public download does **not** automatically grant rights for unlimited
redistribution. The app ships a limited, derived set of market reference
values, cites the source, and avoids mirroring the whole upstream data.
Before any commercial expansion or large-scale publishing, verify the
latest marketplace data terms and secure required permission. The price
guide and external catalogue data remain their respective owners' data.

Sources:
- https://news.cardmarket.com/en/StarWarsUnlimited/were-making-the-price-guide-and-product-catalogue-available-for-download
- https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json
- https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json
- https://github.com/ZyzyThePizi/pokemon-price-data
- https://github.com/tcgdex/cards-database/issues/2517
