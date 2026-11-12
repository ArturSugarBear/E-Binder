/** Build same-origin identity metadata; TCGplayer permits CORS only from its site.
 * Artwork stays on its CDN. No prices or user data are copied by this job.
 * Add verified Japanese set IDs to the argument list to extend coverage.
 */
import { mkdir, writeFile } from 'node:fs/promises';
const sets = process.argv.slice(2);
if (!sets.length) throw new Error('Supply Japanese TCGdex set IDs');
const directory = new URL(
  '../public/catalog-products/tcgplayer/',
  import.meta.url,
);
await mkdir(directory, { recursive: true });
async function json(url) {
  // Upstream TCGdex/TCGplayer occasionally responds 429/502/503 under CI
  // concurrency. Retry transient outages rather than rejecting the release
  // on the first request; still reject permanent missing/invalid identities.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (r.ok) return r.json();
      if (![429, 500, 502, 503, 504].includes(r.status) || attempt === 4)
        throw new Error(`${r.status}: ${url}`);
    } catch (error) {
      if (attempt === 4 || /^(4(?:0[0-9]|1[0-9]|2[0-8])):/.test(String(error.message)))
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1200 * 2 ** attempt));
  }
  throw new Error(`Provider unavailable: ${url}`);
}
const report = {
  checkedAt: new Date().toISOString(),
  sets,
  verified: 0,
  missing: [],
};
for (const setId of sets) {
  if (!/^[\w.+-]+$/.test(setId)) throw new Error('Invalid set');
  const set = await json(`https://api.tcgdex.net/v2/ja/sets/${setId}`);
  if (set.id !== setId) throw new Error('Set mismatch');
  let index = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (index < set.cards.length) {
        const c = set.cards[index++];
        try {
          const raw = await json(`https://api.tcgdex.net/v2/ja/cards/${c.id}`);
          const ids = [
            ...new Set(
              [
                raw.thirdParty?.tcgplayer,
                ...(raw.variants_detailed ?? []).map(
                  (v) => v.thirdParty?.tcgplayer,
                ),
              ].filter(Boolean),
            ),
          ];
          const id = ids.length === 1 ? ids[0] : undefined;
          if (!Number.isSafeInteger(id) || id <= 0) {
            report.missing.push(c.id);
            continue;
          }
          const p = await json(
            `https://mp-search-api.tcgplayer.com/v1/product/${id}/details`,
          );
          const number = `${raw.localId}/${set.cardCount.official}`;
          if (
            raw.id !== c.id ||
            raw.set.id !== setId ||
            p.productId !== id ||
            p.productLineName !== 'Pokemon Japan' ||
            p.setCode?.toUpperCase() !== setId.toUpperCase() ||
            p.customAttributes?.number?.split('/').map(Number).join('/') !==
              number.split('/').map(Number).join('/') ||
            p.sealed !== false ||
            p.productTypeName !== 'Cards'
          ) {
            report.missing.push(c.id);
            continue;
          }
          const fields = [
            'productId',
            'productLineName',
            'productTypeName',
            'sealed',
            'setCode',
            'productName',
          ];
          const record = Object.fromEntries(fields.map((k) => [k, p[k]]));
          record.customAttributes = { number: p.customAttributes.number };
          record.checkedAt = report.checkedAt;
          record.source = `https://mp-search-api.tcgplayer.com/v1/product/${id}/details`;
          await writeFile(
            new URL(`${id}.json`, directory),
            JSON.stringify(record, null, 2) + '\n',
          );
          report.verified++;
        } catch (error) {
          throw new Error(`${c.id}: ${error.message}`, { cause: error });
        }
      }
    }),
  );
}
await writeFile(
  new URL('../public/catalog-products/audit.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
