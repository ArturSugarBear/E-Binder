/** Build an exact-print secondary artwork index and a reviewable release audit.
 * The index carries URLs, not third-party image bytes. Artwork never sets ownership.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  promoArtwork,
  promoGroup,
  jumboGroup,
  validatePromoGroup,
} from './promo-artwork.mjs';
const root = resolve('public/catalog-art');
await mkdir(root, { recursive: true });
const source =
  'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    'Bundled cards, all DE/EN set logos/symbols and the MEP promo image index. Other dynamic cards use exact-print runtime fallback. Not an exhaustive HTTP probe of every worldwide card.',
  sets: [],
  bundledCards: [],
  errors: [],
};
async function json(url, options = {}) {
  for (let attempt = 0; ; attempt++) {
    let retryable = true;
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        retryable = response.status === 429 || response.status >= 500;
        throw new Error(`${response.status}: ${url}`);
      }
      return await response.json();
    } catch (error) {
      if (!retryable || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}
const allowed = (value) => {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      [
        'images.pokemontcg.io',
        'images.scrydex.com',
        'assets.tcgdex.net',
        'tcgplayer-cdn.tcgplayer.com',
      ].includes(u.hostname)
    );
  } catch {
    return false;
  }
};
async function pool(items, run, concurrency = 8) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await run(item);
      }
    }),
  );
}
const probes = new Map();
function probe(url) {
  if (!allowed(url)) return Promise.resolve(false);
  if (!probes.has(url))
    probes.set(
      url,
      (async () => {
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
          const type = r.headers.get('content-type') || '';
          const bytes = await r.arrayBuffer();
          return r.ok && type.startsWith('image/') && bytes.byteLength > 100;
        } catch {
          return false;
        }
      })(),
    );
  return probes.get(url);
}
const [english, german, secondary] = await Promise.all([
  json('https://api.tcgdex.net/v2/en/sets'),
  json('https://api.tcgdex.net/v2/de/sets'),
  json(`${source}/sets/en.json`),
]);
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const index = { version: 1, source, sets: {} };
await pool(english, async (set) => {
  // Exact English set name AND printed count; ambiguous matches are rejected.
  const matches = secondary.filter(
    (candidate) =>
      (normalize(candidate.name) === normalize(set.name) ||
        (set.id === 'base1' && candidate.id === 'base1')) &&
      candidate.printedTotal === set.cardCount?.official,
  );
  const paired = matches.length === 1 ? matches[0] : undefined;
  let de = german.find((item) => item.id === set.id);
  let full = set;
  // List responses omit artwork metadata: audit the actual set detail records.
  const details = await Promise.allSettled([
    json(`https://api.tcgdex.net/v2/en/sets/${set.id}`),
    ...(de ? [json(`https://api.tcgdex.net/v2/de/sets/${set.id}`)] : []),
  ]);
  // An unavailable metadata request is not evidence of missing artwork. Keep
  // the release gate closed instead of silently publishing neutral set icons.
  details.forEach((detail, position) => {
    if (detail.status === 'rejected')
      report.errors.push(
        `Set metadata unavailable (${position === 0 ? 'en' : 'de'}:${set.id}): ${String(detail.reason)}`,
      );
  });
  if (details[0]?.status === 'fulfilled') full = details[0].value;
  if (details[1]?.status === 'fulfilled') de = details[1].value;

  const row = {
    id: set.id,
    name: set.name,
    primary: {},
    fallback: {},
    unresolved: [],
  };
  const entry = {
    name: set.name,
    providerSet: paired?.id,
    logo: [],
    symbol: [],
  };
  for (const kind of ['logo', 'symbol']) {
    const primaries = [
      ...new Set(
        [de?.[kind], full[kind]].filter(Boolean).map((url) => `${url}.webp`),
      ),
    ];
    const states = await Promise.all(
      primaries.map(async (url) => ({ url, available: await probe(url) })),
    );
    row.primary[kind] = states;
    entry[kind] = states.filter((r) => r.available).map((r) => r.url);
    const alternative = paired?.images?.[kind];
    if (allowed(alternative) && (await probe(alternative))) {
      entry[kind].push(alternative);
      row.fallback[kind] = alternative;
    }
    if (!entry[kind].length) row.unresolved.push(kind);
  }
  if (paired) {
    try {
      const cards = await json(`${source}/cards/en/${paired.id}.json`);
      const entries = {};
      for (const card of cards) {
        if (
          typeof card.number !== 'string' ||
          !/^[a-z0-9]+$/i.test(card.number) ||
          !allowed(card.images?.large)
        )
          continue;
        // Only unique collector numbers in the verified corresponding set.
        if (Object.hasOwn(entries, card.number)) entries[card.number] = null;
        else
          entries[card.number] = {
            url: card.images.large,
            language: 'en',
            providerId: card.id,
          };
      }
      await writeFile(
        `${root}/${set.id}.json`,
        JSON.stringify({
          setId: set.id,
          providerSet: paired.id,
          cards: entries,
        }),
      );
      entry.cards = `${set.id}.json`;
      row.indexedCards = Object.values(entries).filter(Boolean).length;
    } catch (error) {
      report.errors.push(String(error));
    }
  }
  // TCGdex does not host artwork for 30th-c (upstream issue #2341).
  // This curated mapping is keyed by its sequential 001–030 printing ID,
  // never by historical collector number: e.g. 11 and 106 occur repeatedly.
  if (set.id === '30th-c') {
    try {
      const curated = JSON.parse(
        await readFile(`${root}/30th-c.json`, 'utf8'),
      );
      const summaries = full.cards ?? [];
      const expected = summaries.map((card) => {
        if (!card.id?.startsWith('30th-c-'))
          throw new Error('Unexpected Classic Collection printing ID');
        return card.id.slice('30th-c-'.length);
      });
      const ids = Object.keys(curated.cards ?? {});
      if (
        curated.setId !== set.id ||
        curated.providerSet !== 'me55c' ||
        summaries.length !== 30 ||
        new Set(expected).size !== 30 ||
        ids.length !== 30 ||
        expected.some((id) => !Object.hasOwn(curated.cards, id))
      )
        throw new Error('Classic Collection catalogue / mapping mismatch');
      const mapped = Object.values(curated.cards);
      if (new Set(mapped.map((card) => card.providerId)).size !== 30)
        throw new Error('Classic Collection has duplicated provider IDs');
      for (const card of mapped) {
        if (
          card.language !== 'en' ||
          !/^me55c-[0-9]+[a-z]?$/.test(card.providerId) ||
          card.url !==
            `https://images.scrydex.com/pokemon/${card.providerId}/large`
        )
          throw new Error('Unverified Classic Collection art identity');
      }
      const available = await Promise.all(
        mapped.map((card) => probe(card.url)),
      );
      if (available.some((good) => !good))
        throw new Error('One or more Classic Collection images unavailable');
      entry.providerSet = 'me55c';
      entry.cards = '30th-c.json';
      row.indexedCards = 30;
      row.classicCollectionAudit = {
        source: curated.source,
        catalogueCards: summaries.length,
        verifiedImageUrls: 30,
        note: 'Exact sequential printing IDs, including distinct historical number collisions; URLs validated as image responses.',
      };
    } catch (error) {
      report.errors.push(`Classic Collection artwork audit failed: ${String(error)}`);
    }
  }
  if (set.id === 'mep') {
    try {
      const headers = {
        'User-Agent':
          'E-Binder/1.0 (catalogue artwork audit; github.com/ArturSugarBear/E-Binder)',
      };
      const timestamp = await fetch('https://tcgcsv.com/last-updated.txt', {
        headers,
        signal: AbortSignal.timeout(20000),
      });
      if (!timestamp.ok) throw new Error('Promo source revision unavailable');
      const sourceUpdated = (await timestamp.text()).trim();
      if (!Number.isFinite(Date.parse(sourceUpdated)))
        throw new Error('Invalid promo source revision');
      let cached;
      try {
        cached = JSON.parse(
          await readFile(`${root}/promo-source.json`, 'utf8'),
        );
      } catch {
        /* First build. */
      }
      if (cached?.sourceUpdated !== sourceUpdated) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        const groups = await json('https://tcgcsv.com/tcgplayer/3/groups', {
          headers,
        });
        if (!groups.success || !validatePromoGroup(groups.results))
          throw new Error('Unverified MEP provider group');
        const products = [];
        for (const group of [promoGroup, jumboGroup]) {
          if (
            !groups.results.some(
              (item) =>
                item.groupId === group.groupId &&
                item.categoryId === group.categoryId &&
                item.name === group.name,
            )
          )
            throw new Error('Unverified promo group');
          await new Promise((resolve) => setTimeout(resolve, 120));
          const result = await json(
            `https://tcgcsv.com/tcgplayer/3/${group.groupId}/products`,
            { headers },
          );
          if (!result.success || !Array.isArray(result.results))
            throw new Error('Promo products unavailable');
          products.push(
            ...result.results.filter(
              (item) => group === promoGroup || item.productId === 678659,
            ),
          );
        }
        cached = {
          sourceUpdated,
          groups: groups.results
            .filter((item) =>
              [promoGroup.groupId, jumboGroup.groupId].includes(item.groupId),
            )
            .map(({ categoryId, groupId, name, abbreviation }) => ({
              categoryId,
              groupId,
              name,
              abbreviation,
            })),
          products: products.map(
            ({
              productId,
              categoryId,
              groupId,
              name,
              imageUrl,
              extendedData,
            }) => ({
              productId,
              categoryId,
              groupId,
              name,
              imageUrl,
              extendedData,
            }),
          ),
        };
        await writeFile(`${root}/promo-source.json`, JSON.stringify(cached));
      }
      if (
        !validatePromoGroup(cached.groups) ||
        !cached.groups.some(
          (item) =>
            item.groupId === jumboGroup.groupId &&
            item.name === jumboGroup.name &&
            item.categoryId === 3,
        ) ||
        !Array.isArray(cached.products)
      )
        throw new Error('Invalid cached promo source');
      const entries = {};
      const unresolved = [];
      await pool(
        full.cards ?? [],
        async (summary) => {
          const card = await json(
            `https://api.tcgdex.net/v2/en/cards/${summary.id}`,
          );
          if (card.id !== summary.id || card.localId !== summary.localId)
            throw new Error(`Promo metadata mismatch: ${summary.id}`);
          const art = promoArtwork(card, cached.products);
          const available = art ? await probe(art.url) : false;
          entries[summary.localId] = available ? art : null;
          if (!available) unresolved.push(summary.id);
        },
        4,
      );
      const ordered = Object.fromEntries(
        Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)),
      );
      await writeFile(
        `${root}/mep.json`,
        JSON.stringify({
          setId: 'mep',
          providerSet: `tcgplayer:${promoGroup.groupId}`,
          source: 'https://tcgcsv.com/docs',
          cards: ordered,
        }),
      );
      entry.cards = 'mep.json';
      row.indexedCards = Object.values(ordered).filter(Boolean).length;
      row.promoAudit = {
        source: 'https://tcgcsv.com/docs',
        providerGroup: promoGroup.groupId,
        sourceUpdated,
        catalogueCards: full.cards?.length ?? 0,
        verifiedImageUrls: row.indexedCards,
        unresolved: unresolved.sort(),
        imageLanguage: 'en',
        note: 'TCGdex product IDs or reviewed mappings, matching provider group/name/number; one explicit unnumbered jumbo. Fetched image responses, not a worldwide coverage claim or stamp/finish certification.',
      };
    } catch (error) {
      report.errors.push(`Promo artwork audit failed: ${String(error)}`);
    }
  }
  if (
    !entry.logo.length &&
    !entry.symbol.length &&
    /^[a-z0-9.+-]+$/i.test(set.id)
  ) {
    const asset = `set-${set.id}.svg`;
    // An original neutral identifier, explicitly not an invented official set logo.
    const label = set.id.toUpperCase().slice(0, 12);
    await writeFile(
      `${root}/${asset}`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96"><rect x="1" y="1" width="158" height="94" rx="16" fill="#22242B" stroke="#4c4e56"/><path d="M20 23h25v36H20zm8 0v36" fill="none" stroke="#D8F25A" stroke-width="2"/><text x="80" y="78" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#F4F1EA">${label}</text><text x="100" y="44" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#A9A8B4">SET</text></svg>`,
    );
    entry.placeholder = asset;
    row.displayFallback = 'neutral-set-identifier';
  } else row.displayFallback = entry.logo[0] || entry.symbol[0];
  index.sets[set.id] = entry;
  report.sets.push(row);
});
const collection = JSON.parse(await readFile('public/collection.json', 'utf8'));
for (const chapter of collection)
  for (const card of chapter.cards) {
    const path = `assets/cards/${card.id}.webp`;
    try {
      const bytes = await readFile(`public/${path}`);
      if (bytes.length < 100) throw new Error('Empty asset');
      report.bundledCards.push({ id: card.id, path, available: true });
    } catch {
      report.bundledCards.push({ id: card.id, path, available: false });
      report.errors.push(`Missing bundled artwork: ${path}`);
    }
  }
report.sets.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(`${root}/index.json`, JSON.stringify(index));
await writeFile(`${root}/audit.json`, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      sets: report.sets.length,
      indexedSets: Object.values(index.sets).filter((s) => s.cards).length,
      unavailablePrimary: report.sets.filter((s) =>
        ['logo', 'symbol'].some(
          (kind) => !s.primary[kind].some((r) => r.available),
        ),
      ).length,
      unresolvedSets: report.sets
        .filter((s) => s.unresolved.length)
        .map((s) => s.id),
      bundledCards: report.bundledCards.length,
      errors: report.errors,
    },
    null,
    2,
  ),
);
if (report.errors.length) process.exitCode = 1;
