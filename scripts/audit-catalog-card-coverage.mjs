/**
 * Exact-card artwork coverage across all published TCGdex sets.
 * Smoke on PRs, --full on scheduled CI (DE, EN, JA).
 * Reports failures instead of substituting artwork from a similar printing.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const full = process.argv.includes('--full');
const output = resolve('artifacts/card-artwork-coverage.json');
const index = JSON.parse(await readFile('public/catalog-art/index.json', 'utf8'));
const domains = new Set([
  'assets.tcgdex.net', 'images.pokemontcg.io', 'images.scrydex.com',
  'tcgplayer-cdn.tcgplayer.com',
]);
const sourceNames = ['primary', 'paired-english', 'secondary-index', 'verified-japanese'];
const totals = Object.fromEntries([...sourceNames, 'missing'].map((key) => [key, 0]));
const issues = [];
const sets = [];
const missing = [];
const manifests = new Map();
const probes = new Map();
const expected = new Map();
const normal = (value) => String(value).toLowerCase().replace(/^0+(?=\d)/, '');
const trusted = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && domains.has(u.hostname);
  } catch { return false; }
};
const timedFetch = (url, init = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
async function json(url) {
  const response = await timedFetch(url);
  if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + url);
  return response.json();
}
async function available(url) {
  if (!trusted(url)) return false;
  if (!probes.has(url)) {
    probes.set(url, (async () => {
      try {
        let response = await timedFetch(url, { method: 'HEAD' });
        if ([403, 405, 501].includes(response.status))
          response = await timedFetch(url, {
            method: 'GET',
            headers: { Range: 'bytes=0-1023' },
          });
        return response.ok &&
          (response.headers.get('content-type') ?? '').startsWith('image/');
      } catch { return false; }
    })());
  }
  return probes.get(url);
}
async function pool(items, size, run) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(items.length, size) }, async () => {
      while (cursor < items.length) await run(items[cursor++]);
    }),
  );
}
async function indexed(setId, cardId, number) {
  if (!cardId.startsWith(setId + '-')) return;
  const printed = cardId.slice(setId.length + 1);
  if (normal(printed) !== normal(number)) return;
  if (!manifests.has(setId)) {
    const file = index.sets[setId]?.cards;
    try {
      const data = file
        ? JSON.parse(await readFile(resolve('public/catalog-art', file), 'utf8'))
        : null;
      if (data && data.setId !== setId) throw Error('Wrong setId');
      manifests.set(setId, data);
    } catch (error) {
      issues.push({ setId, error: String(error), stage: 'manifest' });
      manifests.set(setId, null);
    }
  }
  const cards = manifests.get(setId)?.cards;
  if (!cards) return;
  const candidates = Object.entries(cards)
    .filter(([key]) => normal(key) === normal(printed));
  if (candidates.length !== 1) return;
  const art = candidates[0][1];
  return art && trusted(art.url) && art.providerId ? art.url : undefined;
}
async function japaneseImage(setId, cardId, number, official) {
  if (!/^(?:M1L|M1S)$/i.test(setId)) return;
  const card = await json(
    'https://api.tcgdex.net/v2/ja/cards/' + encodeURIComponent(cardId),
  );
  const ids = [...new Set([
    card.thirdParty?.tcgplayer,
    ...(card.variants_detailed ?? []).map((item) => item.thirdParty?.tcgplayer),
  ].filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (card.id !== cardId || card.set?.id !== setId ||
    normal(card.localId) !== normal(number) ||
    card.set?.cardCount?.official !== official || ids.length !== 1) return;
  let product;
  try {
    product = JSON.parse(await readFile(
      'public/catalog-products/tcgplayer/' + ids[0] + '.json', 'utf8',
    ));
  } catch { return; }
  if (product.productId !== ids[0] ||
    product.productLineName !== 'Pokemon Japan' ||
    product.productTypeName !== 'Cards' || product.sealed !== false ||
    product.setCode?.toUpperCase() !== setId.toUpperCase() ||
    String(product.customAttributes?.number).split('/').map(normal).join('/') !==
      [number, official].map(normal).join('/')) return;
  return 'https://tcgplayer-cdn.tcgplayer.com/product/' +
    ids[0] + '_in_1000x1000.jpg';
}
async function checkCard(language, setId, card, official) {
  const id = card.id;
  const number = card.localId;
  if (!id?.startsWith(setId + '-') || !number) {
    issues.push({ language, setId, id, stage: 'invalid-card-id' });
    return;
  }
  const candidates = [];
  if (card.image && trusted(card.image)) {
    candidates.push({
      stage: 'primary',
      url: /[.](?:webp|png|jpe?g)(?:[?]|$)/i.test(card.image) ||
        card.image.includes('images.scrydex.com/')
        ? card.image : card.image + '/high.webp',
    });
  }
  if (language === 'de' && !card.image) {
    try {
      const en = await json('https://api.tcgdex.net/v2/en/cards/' + encodeURIComponent(id));
      if (en.id === id && en.set?.id === setId &&
        normal(en.localId) === normal(number) && en.image)
        candidates.push({ stage: 'paired-english', url: en.image + '/high.webp' });
    } catch { /* A provider outage cannot verify the alternate image. */ }
  }
  const indexedUrl = await indexed(setId, id, number);
  if (indexedUrl)
    candidates.push({ stage: 'secondary-index', url: indexedUrl });
  if (language === 'ja') {
    try {
      const image = await japaneseImage(setId, id, number, official);
      if (image) candidates.push({ stage: 'verified-japanese', url: image });
    } catch { /* Failed verification is not a verified image. */ }
  }
  const tried = [];
  for (const { stage, url } of candidates) {
    if (tried.some((entry) => entry.url === url)) continue;
    const ok = await available(url);
    tried.push({ stage, url, ok });
    if (ok) {
      totals[stage]++;
      return;
    }
  }
  totals.missing++;
  missing.push({ language, setId, id, number, tried });
}
async function checkSet(language, setId) {
  try {
    const detail = await json(
      'https://api.tcgdex.net/v2/' + language + '/sets/' + encodeURIComponent(setId),
    );
    if (detail.id !== setId || !Array.isArray(detail.cards))
      throw Error('Incomplete set record');
    const checked = detail.cards.length;
    const before = totals.missing;
    const official = detail.cardCount?.official;
    if (!Number.isSafeInteger(official)) throw Error('Missing official count');
    await pool(detail.cards, 12, (card) => checkCard(language, setId, card, official));
    sets.push({
      language, setId, checked, missing: totals.missing - before,
    });
  } catch (error) {
    issues.push({ language, setId, stage: 'set-lookup', error: String(error) });
  }
}

// Every PR checks the entire committed index for invalid or unsafe entries.
for (const [setId, entry] of Object.entries(index.sets)) {
  if (!entry?.cards) continue;
  const data = JSON.parse(await readFile(
    resolve('public/catalog-art', entry.cards), 'utf8',
  ));
  if (data.setId !== setId) issues.push({ setId, stage: 'set-id-mismatch' });
  for (const [number, art] of Object.entries(data.cards ?? {})) {
    if (art && (!trusted(art.url) || !art.providerId || !number))
      issues.push({ setId, number, stage: 'unsafe-or-unverified-art' });
  }
}
if (full) {
  for (const language of ['de', 'en', 'ja']) {
    try {
      const listing = await json('https://api.tcgdex.net/v2/' + language + '/sets');
      if (!Array.isArray(listing)) throw Error('Invalid set listing');
      expected.set(language, listing.length);
      await pool(listing, 5, (set) => checkSet(language, set.id));
    } catch (error) {
      issues.push({ language, stage: 'set-list', error: String(error) });
    }
  }
} else {
  for (const [lang, setId, id] of [
    ['ja', 'M1L', 'M1L-068'],
    ['en', '30th-c', '30th-c-004'],
    ['de', 'me01', 'me01-077'],
  ]) {
    try {
      const card = await json(
        'https://api.tcgdex.net/v2/' + lang + '/cards/' + encodeURIComponent(id),
      );
      if (card.id !== id || card.set?.id !== setId)
        throw Error('Source card mismatch');
      await checkCard(lang, setId, card, card.set.cardCount.official);
    } catch (error) {
      issues.push({ lang, setId, id, stage: 'critical-card', error: String(error) });
    }
  }
}
const report = {
  mode: full ? 'full' : 'smoke',
  checkedAt: new Date().toISOString(),
  expectedSets: Object.fromEntries(expected),
  sets,
  totals,
  missing,
  issues,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  mode: report.mode, checkedSets: sets.length, totals,
  missingExamples: missing.slice(0, 12), issueExamples: issues.slice(0, 12),
}, null, 2));
// Fail release only on specific broken cards and invalid manifests; the full
// scan reports legacy gaps separately without silently declaring coverage.
if (issues.length || (!full && missing.length)) process.exitCode = 1;
