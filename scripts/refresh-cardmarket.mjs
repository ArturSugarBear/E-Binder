// Refresh only independently verified product mappings. No name-based joins.
import { readFile, writeFile } from 'node:fs/promises';
const base = new URL('../src/data/', import.meta.url);
const rows = JSON.parse(
  await readFile(new URL('cardmarket-crosswalk.json', base)),
);
const url =
  'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json';
const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`Cardmarket price guide: ${response.status}`);
const guide = await response.json();
const updated = new Date(guide.createdAt).toISOString();
if (
  Date.now() - Date.parse(updated) > 7 * 86400000 ||
  Date.parse(updated) > Date.now()
)
  throw new Error('Stale/future Cardmarket guide');
const products = new Map(guide.priceGuides.map((p) => [p.idProduct, p]));
const catalogueResponse = await fetch(
  'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json',
  { signal: AbortSignal.timeout(60000) },
);
if (!catalogueResponse.ok)
  throw new Error(`Cardmarket catalogue: ${catalogueResponse.status}`);
const catalogue = new Map(
  (await catalogueResponse.json()).products.map((p) => [p.idProduct, p]),
);
const prices = {};
for (const row of Object.values(rows)) {
  const product = catalogue.get(row.productId);
  if (
    !product ||
    product.idExpansion !== row.expansionId ||
    product.idCategory !== 51
  )
    throw new Error(`Cardmarket product identity changed: ${row.productId}`);
  if (!products.has(row.productId))
    throw new Error(`Missing mapped product ${row.productId}`);
  prices[row.productId] = products.get(row.productId);
}
await writeFile(
  new URL('cardmarket-observations.json', base),
  JSON.stringify({ updated, prices }, null, 2) + '\n',
);
console.log(
  `Verified ${Object.keys(prices).length} exact product prices; guide ${updated}`,
);
