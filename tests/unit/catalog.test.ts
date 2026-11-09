import { afterEach, expect, it, vi } from 'vitest';
import { fetchCatalogCard, searchCatalog } from '../../src/data/card-catalog';
import { numberKey, sameCard } from '../../src/domain/personal';

afterEach(() => vi.unstubAllGlobals());
const card = {
  id: 'sv01-211',
  localId: '211',
  name: 'Trasla',
  illustrator: 'Jiro Sasumo',
  image: 'https://assets.tcgdex.net/de/sv/sv01/211',
  set: { id: 'sv01', name: 'Karmesin & Purpur', cardCount: { official: 198 } },
  variants: { holo: true },
};
it('fetches a specific printing with its official denominator and checked illustrator provenance', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(card))),
  );
  const result = await fetchCatalogCard('sv01-211', 'de');
  expect(result.number).toBe('211/198');
  expect(result.artistSource).toBe('publisher');
  expect(result.finishes).toEqual(['holo']);
});
it('does not promote a changed third-party credit to a verified publisher credit', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ...card, illustrator: 'Different illustrator' }),
        ),
      ),
  );
  const result = await fetchCatalogCard('sv01-211', 'de');
  expect(result.artistSource).toBe('catalogue');
  expect(result.artistUrl).toBeUndefined();
});
it('uses exact collector number search, not substring matching for 21 versus 211', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([])));
  vi.stubGlobal('fetch', fetcher);
  await searchCatalog('211/198', 'de');
  const url = new URL(fetcher.mock.calls[0]![0] as string);
  expect(url.searchParams.get('localId')).toBe('eq:211');
  expect(url.searchParams.has('name')).toBe(false);
});
it('normalizes printed leading zeros while retaining the separator in collector numbers', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(card))),
  );
  const result = await fetchCatalogCard('sv01-211', 'de');
  expect(numberKey('TG01 / TG030')).toBe('tg1/tg30');
  expect(numberKey('1/23')).not.toBe(numberKey('12/3'));
  expect(
    sameCard(
      { ...result, key: 'one', number: '001/198' },
      { ...result, key: 'two', number: '1/198' },
    ),
  ).toBe(true);
  expect(
    sameCard(
      { ...result, key: 'one', number: '1/23' },
      { ...result, key: 'two', number: '12/3' },
    ),
  ).toBe(false);
});

it('reads footer identifiers as candidates, preserves ambiguous numbers and checks the denominator against the catalog', async () => {
  const { recognitionClues, fetchRecognizedCards } =
    await import('../../src/data/card-catalog');
  const clues = recognitionClues(
    'SVIde 211/198\nSVI de 2I1/198\nSVI de 217/198',
  );
  expect(clues[0]).toMatchObject({
    setId: 'sv01',
    language: 'de',
    number: '211/198',
    observations: 2,
  });
  expect(clues).toHaveLength(2);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(card))),
  );
  expect(await fetchRecognizedCards('SVI de 211/198', 'en')).toHaveLength(1);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(card))),
  );
  expect(await fetchRecognizedCards('SVI de 211/999', 'en')).toHaveLength(0);
});

it('keeps a valid candidate when another uncertain OCR number is absent from the provider', async () => {
  const { fetchRecognizedCards } = await import('../../src/data/card-catalog');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('sv01-217')
            ? new Response('', { status: 404 })
            : new Response(JSON.stringify(card)),
        ),
      ),
  );
  const found = await fetchRecognizedCards(
    'SVI de 217/198\nSVI de 211/198',
    'de',
  );
  expect(found.map((item) => item.sourceId)).toEqual(['sv01-211']);
});

it('resolves Japanese leading-zero IDs through the actual set inventory instead of guessing an English set', async () => {
  const { fetchRecognizedCards } = await import('../../src/data/card-catalog');
  const japanese = {
    ...card,
    id: 'SV2a-001',
    localId: '001',
    name: 'フシギダネ',
    illustrator: 'Yuu Nishida',
    image: 'https://assets.tcgdex.net/ja/sv/SV2a/001',
    set: {
      id: 'SV2a',
      name: 'ポケモンカード151',
      cardCount: { official: 165 },
    },
  };
  const fetcher = vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.endsWith('/sets')
              ? [{ id: 'SV2a', cardCount: { official: 165 } }]
              : url.endsWith('/sets/SV2a')
                ? { cards: [japanese] }
                : japanese,
          ),
        ),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  const found = await fetchRecognizedCards('001/165', 'ja');
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({
    sourceId: 'SV2a-001',
    language: 'ja',
    artist: 'Yuu Nishida',
    number: '001/165',
  });
  expect(
    fetcher.mock.calls.every(([url]) => String(url).includes('/ja/')),
  ).toBe(true);
});

it('fills German missing images in one request and only uses the same exact printing ID and number', async () => {
  const { fillCatalogImages } = await import('../../src/data/card-catalog');
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          id: 'base1-4',
          localId: '4',
          name: 'Charizard',
          image: 'https://assets.tcgdex.net/en/base/base1/4',
        },
        {
          id: 'base1-2',
          localId: '9',
          name: 'Wrong number',
          image: 'https://assets.tcgdex.net/en/base/base1/2',
        },
      ]),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  const found = await fillCatalogImages([
    { id: 'base1-4', localId: '4', name: 'Glurak', language: 'de' },
    { id: 'base1-2', localId: '2', name: 'Turtok', language: 'de' },
    { id: 'SV2a-001', localId: '001', name: 'フシギダネ', language: 'ja' },
  ]);
  expect(found[0]).toMatchObject({
    name: 'Glurak',
    language: 'de',
    image: 'https://assets.tcgdex.net/en/base/base1/4',
  });
  expect(found[1]?.image).toBeUndefined();
  expect(found[2]?.image).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('keeps zero and missing price observations unknown, and retains positive dated EUR observations', async () => {
  const { catalogEntry } = await import('../../src/data/card-catalog');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      const id = url.split('/').at(-1)!;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...card,
            id,
            pricing: {
              cardmarket: {
                unit: 'EUR',
                updated: '2026-11-09T00:00:00Z',
                trend: id.endsWith('zero') ? 0 : 1.25,
              },
            },
          }),
        ),
      );
    }),
  );
  expect((await catalogEntry('test-zero', 'en')).price).toBeUndefined();
  expect((await catalogEntry('test-positive', 'en')).price).toEqual({
    amount: 1.25,
    updated: '2026-11-09T00:00:00Z',
  });
});
it('passes exact set, illustrator, rarity and pagination filters instead of sorting only the first response locally', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('[]'));
  vi.stubGlobal('fetch', fetcher);
  await searchCatalog('', 'ja', undefined, {
    setId: 'SV2a',
    artist: 'Yuu Nishida',
    rarity: 'Rare',
    page: 3,
    order: 'name',
  });
  const url = new URL(fetcher.mock.calls[0]![0]);
  expect(url.searchParams.get('set.id')).toBe('eq:SV2a');
  expect(url.searchParams.get('illustrator')).toBe('eq:Yuu Nishida');
  expect(url.searchParams.get('rarity')).toBe('eq:Rare');
  expect(url.searchParams.get('pagination:page')).toBe('3');
  expect(url.searchParams.get('sort:field')).toBe('name');
});

it('retains real Japanese plus-sign sets through catalogue listing, card search and exact detail lookup', async () => {
  vi.resetModules();
  const api = await import('../../src/data/card-catalog');
  const set = { id: 'SM1+', name: 'サン＆ムーン', cardCount: { official: 51 } };
  const resume = { id: 'SM1+-001', localId: '001', name: 'チュリネ' };
  const fetcher = vi.fn().mockImplementation((address: string) => {
    const url = new URL(address);
    const result = url.pathname.endsWith('/series/tcgp')
      ? { id: 'tcgp', sets: [] }
      : url.pathname.endsWith('/sets')
        ? [set]
        : url.pathname.endsWith('/sets/SM1%2B')
          ? { ...set, cards: [resume] }
          : url.pathname.endsWith('/cards')
            ? [resume]
            : {
                ...resume,
                set,
                illustrator: 'Example artist',
                variants: { normal: true },
              };
    return Promise.resolve(new Response(JSON.stringify(result)));
  });
  vi.stubGlobal('fetch', fetcher);
  expect(await api.catalogSets('ja')).toEqual([{ ...set, alias: undefined }]);
  expect(await api.catalogSetCards('SM1+', 'ja')).toMatchObject([
    { id: 'SM1+-001', number: '001/51' },
  ]);
  expect(
    await api.searchCatalog('', 'ja', undefined, { setId: 'SM1+' }),
  ).toMatchObject([{ id: 'SM1+-001' }]);
  expect((await api.catalogEntry('SM1+-001', 'ja')).card).toMatchObject({
    key: 'tcgdex:ja:SM1+-001',
    language: 'ja',
    setId: 'SM1+',
    number: '001/51',
  });
  expect((await api.fetchCatalogCard('SM1+-001', 'ja')).sourceId).toBe(
    'SM1+-001',
  );
  const addresses = fetcher.mock.calls.map(([address]) => String(address));
  expect(addresses.some((address) => address.includes('/sets/SM1%2B'))).toBe(
    true,
  );
  expect(
    addresses.some((address) => address.includes('/cards/SM1%2B-001')),
  ).toBe(true);
});

it('rejects catalogue path separators while allowing literal plus signs in provider identities', async () => {
  const { catalogEntry, catalogSetCards } =
    await import('../../src/data/card-catalog');
  await expect(catalogEntry('../cards', 'ja')).rejects.toThrow(
    'Ungültige Katalogreferenz',
  );
  await expect(catalogSetCards('SM1+/other', 'ja')).rejects.toThrow(
    'Ungültiges Set',
  );
});
