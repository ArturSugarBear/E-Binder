/** Import observed Cardmarket expansion markdown exports, never ordinal product IDs.
 * Usage: node scripts/import-cardmarket-crosswalk.mjs SET_ID export1.md export2.md ...
 * Obtain all catalogue pages from the public expansion. Review the emitted diff.
 * A URL/label contradiction, duplicate printing, missing locale or provider mismatch
 * is excluded. Names alone never establish a product match.
 */
import { readFile, writeFile } from 'node:fs/promises';
const [setId, ...files] = process.argv.slice(2);
if (!/^[\w.+-]+$/.test(setId ?? '') || !files.length)
  throw new Error('Supply set ID and observed expansion exports');
const base = new URL('../src/data/', import.meta.url);
async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status}: ${url}`);
  return r.json();
}
const [de, en, catalogue] = await Promise.all([
  json(`https://api.tcgdex.net/v2/de/sets/${setId}`),
  json(`https://api.tcgdex.net/v2/en/sets/${setId}`),
  json(
    'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json',
  ),
]);
if (
  de.id !== setId ||
  en.id !== setId ||
  de.cardCount.official !== en.cardCount.official
)
  throw new Error('Set identity mismatch');
const products = new Map(catalogue.products.map((p) => [p.idProduct, p]));
const text = (await Promise.all(files.map((f) => readFile(f, 'utf8')))).join(
  '\n',
);
const pattern =
  /product-images\.s3\.cardmarket\.com\/51\/([A-Z0-9]+)\/(\d+)\/[^\n]+?\n\*\*(.*?) \(([A-Z0-9]+) (\d+)\).*?\]\((https:\/\/www\.cardmarket\.com\/[^)]+)\)/gs;
const observed = new Map();
const ambiguous = new Set();
for (const [, code, pid, , printedCode, num, url] of text.matchAll(pattern)) {
  const n = num.padStart(3, '0');
  if (code !== printedCode || !url.endsWith(`${code}${num}`)) continue;
  const productId = Number(pid);
  if (observed.has(n) && observed.get(n).productId !== productId)
    ambiguous.add(n);
  observed.set(n, { productId, url });
}
const existing = JSON.parse(
  await readFile(new URL('cardmarket-crosswalk.json', base)),
);
for (const [num, observedRow] of observed) {
  if (ambiguous.has(num)) continue;
  const english = en.cards.find((c) => c.localId === num);
  const german = de.cards.find((c) => c.localId === num);
  const product = products.get(observedRow.productId);
  if (!english || !german || !product) continue;
  // Exact numbered page is the assertion; this additional name check rejects
  // pages mixed across expansions or products during import.
  const clean = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (!clean(product.name.split(' [')[0]).startsWith(clean(english.name)))
    continue;
  const raw = await json(`https://api.tcgdex.net/v2/de/cards/${german.id}`);
  if (
    raw.id !== german.id ||
    raw.set.id !== setId ||
    raw.localId !== num ||
    raw.variants?.normal !== true
  )
    continue;
  existing[german.id] = {
    setId,
    localId: num,
    officialCount: de.cardCount.official,
    names: { de: german.name, en: english.name },
    language: ['de', 'en'],
    normal: true,
    ...observedRow,
    expansionId: product.idExpansion,
    source: observedRow.url.slice(0, observedRow.url.lastIndexOf('/')),
    checkedAt: new Date().toISOString(),
  };
}
await writeFile(
  new URL('cardmarket-crosswalk.json', base),
  JSON.stringify(existing, null, 2) + '\n',
);
console.log(
  `Imported ${observed.size - ambiguous.size} unambiguous observed printing candidates; review exact accepted rows in the diff.`,
);
