import { mkdir, writeFile } from 'node:fs/promises';
import {
  alignProductPrints,
  canonicalCollectorNumber,
  canonicalProductName,
} from './lib/cardmarket-print-alignment.mjs';

/**
 * P08: Builds an EXACT-printing daily reference, not a price predictor.
 * Public TCGdex + independent numbered Pokellector catalog are cross-checked
 * against Cardmarket's public product catalogue and daily price guide.
 * User data and user IDs never enter the build.
 *
 * Cardmarket's guide is NOT language-/condition-filtered; never label NM.
 */
const URLS = {
  products:
    'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json',
  guide:
    'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json',
  numbered:
    'https://raw.githubusercontent.com/ZyzyThePizi/pokemon-price-data/main/catalog/pokellector_en.json',
  tcgdex: 'https://api.tcgdex.net/v2/en',
};
const TARGETS = {
  me02: ['Phantasmal Flames'],
  me04: ['Chaos Rising'],
  me05: ['Pitch Black'],
  me06: ['Delta Reign'],
  'sv06.5': ['Shrouded Fable'],
  sv10: ['Destined Rivals'],
  '30th': ['30 Years', '30th Anniversary'],
};
const normalizeSet = (name) =>
  canonicalProductName(name).replace(/expansion$/, '');
const read = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!response.ok)
    throw new Error(
      `Source unavailable (${response.status}): ${url.split('/').at(-1)}`,
    );
  return response.json();
};
const [catalog, guide, numbered] = await Promise.all([
  read(URLS.products),
  read(URLS.guide),
  read(URLS.numbered),
]);
if (
  catalog.version !== 1 ||
  guide.version !== 1 ||
  !Array.isArray(catalog.products) ||
  catalog.products.length < 50000 ||
  !Array.isArray(guide.priceGuides) ||
  guide.priceGuides.length < 50000 ||
  !Array.isArray(numbered.sets)
)
  throw new Error(
    'Cardmarket/independent source schema changed; refusing to publish data.',
  );

const sourceDate = new Date(guide.createdAt);
if (
  !Number.isFinite(sourceDate.getTime()) ||
  Date.now() - sourceDate.getTime() > 72 * 60 * 60 * 1000 ||
  sourceDate.getTime() > Date.now() + 300000
)
  throw new Error('Daily Cardmarket guide is stale or dated in the future.');
const productsById = new Map(catalog.products.map((p) => [p.idProduct, p]));
const productByExpansion = new Map();
for (const p of catalog.products) {
  if (!productByExpansion.has(p.idExpansion))
    productByExpansion.set(p.idExpansion, []);
  productByExpansion.get(p.idExpansion).push(p);
}
const priceById = new Map(guide.priceGuides.map((p) => [p.idProduct, p]));
const records = {};
const reports = {};
const setRows = numbered.sets.map((set) => ({
  slug: set[0],
  name: set[2],
  count: Number(set[6]),
}));
const chooseProductExpansion = async (setId, cards, pokeCards) => {
  const tally = new Map();
  const vote = (productId, weight) => {
    const product = productsById.get(Number(productId));
    if (!product || !Number.isInteger(product.idExpansion)) return;
    tally.set(
      product.idExpansion,
      (tally.get(product.idExpansion) ?? 0) + weight,
    );
  };
  // Independently confirmed product references have stronger vote weight.
  for (const card of pokeCards) if (card[3] != null) vote(card[3], 3);
  // The provider may mislabel individual printing IDs, but usually knows
  // which expansion they belong to. Never use these votes for per-card prices.
  const sample = [...cards.slice(0, 7), ...cards.slice(-4)];
  await Promise.all(
    sample.map(async (card) => {
      try {
        const response = await read(`${URLS.tcgdex}/cards/${card.id}`);
        vote(response.pricing?.cardmarket?.idProduct, 1);
      } catch {
        // Missing sample cannot become a trusted mapping.
      }
    }),
  );
  return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0];
};
for (const [setId, aliases] of Object.entries(TARGETS)) {
  let detail;
  try {
    detail = await read(`${URLS.tcgdex}/sets/${setId}`);
  } catch {
    reports[setId] = { status: 'tcgdex-unavailable' };
    continue;
  }
  const eligibleSets = setRows.filter(
    (row) =>
      aliases.some((name) => normalizeSet(name) === normalizeSet(row.name)) &&
      row.count === detail.cardCount?.official,
  );
  if (eligibleSets.length !== 1) {
    reports[setId] = { status: 'ambiguous-set', matches: eligibleSets.length };
    continue;
  }
  const independentSet = eligibleSets[0];
  const numberedCards = numbered.cards[independentSet.slug] ?? [];
  const expansion = await chooseProductExpansion(
    setId,
    detail.cards ?? [],
    numberedCards,
  );
  const products = productByExpansion.get(expansion) ?? [];
  const aligned = alignProductPrints(products, numberedCards);
  if (!aligned.accepted) {
    reports[setId] = {
      status: 'rejected-alignment',
      cardCount: numberedCards.length,
      productCount: products.length,
      coverage: aligned.coverage,
    };
    continue;
  }
  const actualCards = new Map(
    detail.cards.map((card) => [canonicalCollectorNumber(card.localId), card]),
  );
  let accepted = 0;
  for (const item of aligned.matches) {
    const card = actualCards.get(canonicalCollectorNumber(item.number));
    // Exact set + printed number + English name, independently checked.
    if (
      !card ||
      card.id.slice(0, card.id.lastIndexOf('-')) !== setId ||
      canonicalProductName(card.name) !== canonicalProductName(item.cardName)
    )
      continue;
    const product = productsById.get(item.productId);
    const quote = priceById.get(item.productId);
    if (!product || product.idExpansion !== expansion || !quote) continue;
    const basis = ['trend', 'avg7', 'avg30', 'avg'].find(
      (field) => Number.isFinite(quote[field]) && quote[field] > 0,
    );
    if (!basis) continue;
    const amount = quote[basis];
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) continue;
    if (records[card.id])
      throw new Error(`Duplicate exact printing: ${card.id}`);
    records[card.id] = [
      product.idProduct,
      Math.round(amount * 100) / 100,
      basis,
      item.cardName,
      canonicalCollectorNumber(item.number),
    ];
    accepted++;
  }
  reports[setId] = {
    status: 'validated',
    cardCount: numberedCards.length,
    productCount: products.length,
    alignment: Math.round(aligned.coverage * 1000) / 10,
    pricedPrints: accepted,
  };
}
for (const [id, expected] of [
  ['me06-106', 918943],
  ['me06-111', 918949],
  ['me05-101', 895886],
]) {
  if (records[id]?.[0] !== expected)
    throw new Error(
      `Exact-product regression ${id}: expected ${expected}, found ${records[id]?.[0]}`,
    );
}
if (Object.keys(records).length < 150)
  throw new Error(
    'Verified coverage is unexpectedly low; leaving previous snapshot unchanged.',
  );
const document = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceCreatedAt: sourceDate.toISOString(),
  provenance: 'cardmarket-public-price-guide',
  currency: 'EUR',
  notes: 'Guide averages are not Near Mint or language-filtered seller offers.',
  sets: reports,
  cards: records,
};
await mkdir('public/assets/prices', { recursive: true });
await writeFile(
  'public/assets/prices/cardmarket-verified.json',
  JSON.stringify(document),
);
console.log('Verified exact products:', Object.keys(records).length);
console.log('Set coverage:', JSON.stringify(reports));
console.log(
  'Checked DLR:',
  JSON.stringify(
    Object.fromEntries(
      ['me06-106', 'me06-111', 'me06-113', 'me06-124'].map((id) => [
        id,
        records[id] ?? null,
      ]),
    ),
  ),
);
