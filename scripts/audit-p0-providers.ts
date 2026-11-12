/** Live read-only provider audit; mocks are not evidence for this command. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { verifiedCardmarketProduct } from '../src/data/verified-cardmarket';
import { germanCardName } from '../src/data/japanese-catalog';
import type { PersonalCard } from '../src/domain/personal';
const networkFetch = globalThis.fetch;
globalThis.fetch = (async (
  url: string | URL | Request,
  options?: RequestInit,
) => {
  if (String(url).startsWith('/catalog-products/'))
    return Response.json(
      JSON.parse(
        await readFile(
          new URL('../public' + String(url), import.meta.url),
          'utf8',
        ),
      ),
    );
  return networkFetch(url, options);
}) as typeof fetch;
async function json(url: string) {
  const r = await networkFetch(url, { signal: AbortSignal.timeout(60000) });
  assert.equal(r.status, 200, url);
  return r.json();
}
const guide = await json(
  'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json',
);
const records = [];
for (const number of ['106', '113', '124']) {
  const url = `https://api.tcgdex.net/v2/de/cards/me06-${number}`;
  const raw = await json(url);
  const resolved = verifiedCardmarketProduct({
    id: raw.id,
    setId: raw.set.id,
    localId: raw.localId,
    officialCount: raw.set.cardCount.official,
    name: raw.name,
    language: 'de',
    normal: raw.variants.normal,
  });
  assert.ok(resolved?.observation, `No verified price for ${raw.id}`);
  assert.equal(
    resolved.observation.amount,
    guide.priceGuides.find(
      (p: { idProduct: number }) => p.idProduct === resolved.productId,
    )?.trend,
  );
  records.push({ url, upstream: raw.pricing.cardmarket, resolved });
}
const artwork = [];
for (const setId of ['M1L', 'M1S']) {
  const raw = await json(`https://api.tcgdex.net/v2/ja/cards/${setId}-088`);
  const productIds = [
    ...new Set(
      [
        raw.thirdParty?.tcgplayer,
        ...raw.variants_detailed.map(
          (v: { thirdParty?: { tcgplayer?: number } }) =>
            v.thirdParty?.tcgplayer,
        ),
      ].filter(Boolean),
    ),
  ];
  assert.equal(productIds.length, 1);
  const p = await json(
    `https://mp-search-api.tcgplayer.com/v1/product/${productIds[0]}/details`,
  );
  assert.equal(p.setCode.toUpperCase(), setId);
  assert.equal(p.customAttributes.number, '088/063');
  const url = `https://tcgplayer-cdn.tcgplayer.com/product/${p.productId}_in_1000x1000.jpg`;
  const r = await networkFetch(url);
  assert.equal(r.status, 200);
  const size = (await r.arrayBuffer()).byteLength;
  assert.ok(size > 1000);
  const germanName = await germanCardName({
    source: 'tcgdex',
    sourceId: raw.id,
    setId,
    number: '088/063',
    name: raw.name,
    language: 'ja',
  } as PersonalCard);
  assert.ok(germanName, `No verified localized name for ${raw.id}`);
  artwork.push({
    id: raw.id,
    name: raw.name,
    germanName,
    productId: p.productId,
    url,
    status: r.status,
    bytes: size,
  });
}
for (const language of ['de', 'en']) {
  const c = await json(`https://api.tcgdex.net/v2/${language}/cards/me01-077`);
  const url = c.image + '/high.webp';
  const r = await networkFetch(url);
  assert.equal(r.status, 200);
  artwork.push({ id: c.id, language, url, status: r.status });
}
const result = {
  checkedAt: new Date().toISOString(),
  priceGuideUpdated: guide.createdAt,
  records,
  artwork,
};
if (process.argv[2])
  await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
