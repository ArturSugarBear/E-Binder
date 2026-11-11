/** Build an exact-print secondary artwork index and a reviewable release audit.
 * The index carries URLs, not third-party image bytes. Artwork never sets ownership.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve('public/catalog-art');
await mkdir(root, { recursive: true });
const source =
  'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    'Bundled cards and all DE/EN set logos/symbols; dynamic cards use exact-print runtime fallback. Not an exhaustive HTTP probe of every worldwide card.',
  sets: [],
  bundledCards: [],
  errors: [],
};
async function json(url) {
  for (let attempt = 0; ; attempt++) {
    let retryable = true;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
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
