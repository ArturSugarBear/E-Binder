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
