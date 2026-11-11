# E-Binder price integrity policy

## Identity before value

A collection valuation must resolve the exact tuple: game, language, expansion/set ID, printed collector number (including the denominator), finish, and any exceptional stamp/edition. A card name alone is not a price key. Variant notes, reverse holo, grading, imports without a validated catalogue print and ambiguous finishes remain unpriced.

All user-facing portfolio and collection quotes use `src/data/holding-prices.ts`. The catalogue exposes the same checked Cardmarket reference through `catalogEntry`. Do not independently query price fields from UI code.

## Evidence levels

1. **Future: independently verified Near Mint market value**: requires a provider or offer ledger that explicitly supports the exact marketplace product, card language, Near Mint condition, finish, timestamp and sold/asking distinction. Do not derive this from generic Cardmarket trends.
2. **Current: checked Cardmarket EUR catalogue reference**: usable as an *unfiltered guide*, never labelled NM. It must have valid currency, date, exact card identity and no detected misassignment.
3. **Rejected / unavailable**: if a quote is missing, variant does not match, upstream product IDs collide between different prints, EUR and TCGplayer disagree grossly, or a secret print inexplicably inherits a few-cent price, show no amount. Never use zero, guess a rarity premium, convert USD to EUR as Cardmarket, or silently borrow another printing's value.

The normal Cardmarket guide series is not a Near Mint (language-specific) quote. A reverse-holo series must not be used to value the ordinary holo printing. An upstream TCGdex Cardmarket product ID is **not** a verified exact marketplace ID by itself.

## Regression fixtures

- `me06-111` Groudon (111/103) and `me06-106` Growlithe/Fukano (106/103) illustration rares must not be valued at EUR 0.04.
- `me06-053` base Groudon (053/103) may legitimately be a cheap card.
- Two cards with different collector numbers but the same Cardmarket product ID are not independently verified prices.
- A stored printing with a changed name, collector fraction, set ID or incompatible finish is not valued.
- All rejected quotes remain excluded from portfolio totals and price history. The post-fix history policy starts at v4.

## Release gate

Run `npm run check`, mobile collection/portfolio browser tests and the existing cross-browser suite. A false unknown is preferable to false collector wealth, but the long-term solution is an authenticated, licensed source of per-language, per-condition Near Mint data.
