import { afterEach, expect, it, vi } from 'vitest';
import { catalogEntry } from '../../src/data/card-catalog';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mockCard(
  id: string,
  cardmarket: Record<string, unknown>,
  variants = { normal: true, holo: true, reverse: true },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id,
            localId: id.split('-').at(-1),
            name: 'Testkarte',
            set: {
              id: 'sv01',
              name: 'Karmesin & Purpur',
              cardCount: { official: 198 },
            },
            variants,
            pricing: { cardmarket },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ),
  );
}

it('reads a nonfoil price but never mislabels the secondary reverse series as holo', async () => {
  mockCard('sv01-007', {
    unit: 'EUR',
    updated: '2026-11-09T12:00:00Z',
    trend: null,
    avg7: 7.25,
    avg30: 6.15,
    'trend-holo': null,
    'avg7-holo': 15.75,
  });
  const entry = await catalogEntry('sv01-007', 'de', undefined, false);
  expect(entry.price).toMatchObject({ amount: 7.25, basis: 'avg7' });
  expect(entry.holoPrice).toBeUndefined();
});

it('never substitutes normal price for unpriced holo', async () => {
  mockCard('sv01-008', {
    unit: 'EUR',
    updated: '2026-11-09T12:00:00Z',
    trend: 20,
    'trend-holo': null,
    'avg-holo': null,
  });
  const entry = await catalogEntry('sv01-008', 'de', undefined, false);
  expect(entry.price).toMatchObject({ amount: 20, basis: 'trend' });
  expect(entry.holoPrice).toBeUndefined();
});

it('rejects mismatched currency despite valid timestamps', async () => {
  mockCard('sv01-009', {
    unit: 'USD',
    updated: Date.parse('2026-11-09T12:00:00Z') / 1000,
    avg: 19,
  });
  const entry = await catalogEntry('sv01-009', 'de', undefined, false);
  expect(entry.price).toBeUndefined();
  expect(entry.holoPrice).toBeUndefined();
});

it('prices a standard holo-only printing from its actual Cardmarket regular series', async () => {
  mockCard(
    'sv01-211',
    {
      unit: 'EUR',
      updated: '2026-11-09T23:49:36.460Z',
      trend: 32.36,
      'trend-holo': 0,
      'avg-holo': null,
    },
    { normal: false, holo: true, reverse: false },
  );
  const entry = await catalogEntry('sv01-211', 'de', undefined, false);
  expect(entry.price).toMatchObject({ amount: 32.36, basis: 'trend' });
  expect(entry.holoPrice).toMatchObject({ amount: 32.36, basis: 'trend' });
});

it('does not value a normal-only print as holo even when a secondary foil series exists', async () => {
  mockCard(
    'sv01-010',
    {
      unit: 'EUR',
      updated: '2026-11-09T12:00:00Z',
      trend: 3.5,
      'trend-holo': 20,
    },
    { normal: true, holo: false, reverse: true },
  );
  const entry = await catalogEntry('sv01-010', 'de', undefined, false);
  expect(entry.price).toMatchObject({ amount: 3.5 });
  expect(entry.holoPrice).toBeUndefined();
});

it('withholds unverified Delta Reign illustration rare prices and links', async () => {
  for (const [localId, name, usd] of [['106', 'Fukano', 19.3]] as const) {
    const id = `me06-${localId}`;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id,
              localId,
              name,
              rarity: 'Illustration Rare',
              set: {
                id: 'me06',
                name: 'Delta-Herrschaft',
                cardCount: { official: 103 },
              },
              variants: { normal: false, holo: true, reverse: false },
              pricing: {
                cardmarket: {
                  unit: 'EUR',
                  updated: '2026-11-09T12:00:00Z',
                  idProduct: 234567,
                  trend: 0.04,
                  avg7: 0.07,
                },
                tcgplayer: {
                  holofoil: { marketPrice: usd },
                },
              },
            }),
          ),
      ),
    );
    const entry = await catalogEntry(id, 'de', undefined, false);
    expect(entry.price).toBeUndefined();
    expect(entry.holoPrice).toBeUndefined();
    expect(entry.cardmarketUrl).toBeUndefined();
    expect(entry.priceIssue).toBe('suspect');
  }
});

it('does not block normal low priced cards in the same set', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'me06-053',
            localId: '053',
            name: 'Groudon',
            set: {
              id: 'me06',
              name: 'Delta-Herrschaft',
              cardCount: { official: 103 },
            },
            variants: { normal: true, holo: false, reverse: true },
            pricing: {
              cardmarket: {
                unit: 'EUR',
                updated: '2026-11-09T12:00:00Z',
                trend: 0.04,
              },
            },
          }),
        ),
    ),
  );
  const entry = await catalogEntry('me06-053', 'de', undefined, false);
  expect(entry.price).toMatchObject({ amount: 0.04, basis: 'trend' });
  expect(entry.priceIssue).toBeUndefined();
});

it('rejects a secretly numbered printing sharing the base card Cardmarket product ID', async () => {
  const set = {
    id: 'testprice',
    name: 'Delta-Herrschaft',
    cardCount: { official: 103 },
  };
  const products = {
    'testprice-053': {
      id: 'testprice-053',
      localId: '053',
      name: 'Groudon',
      set,
      pricing: {
        cardmarket: {
          idProduct: 777001,
          unit: 'EUR',
          updated: '2026-11-09T12:00:00Z',
          trend: 0.04,
        },
      },
    },
    'testprice-150': {
      id: 'testprice-150',
      localId: '150',
      name: 'Groudon',
      set,
      pricing: {
        cardmarket: {
          idProduct: 777001,
          unit: 'EUR',
          updated: '2026-11-09T12:00:00Z',
          trend: 4.5,
        },
      },
    },
  };
  const fetcher = vi.fn(async (url: string) => {
    const last = decodeURIComponent(url.split('/').at(-1)!);
    if (last === 'testprice') {
      return new Response(
        JSON.stringify({
          ...set,
          cards: [
            { id: 'testprice-053', localId: '053', name: 'Groudon' },
            { id: 'testprice-150', localId: '150', name: 'Groudon' },
          ],
        }),
      );
    }
    return new Response(
      JSON.stringify(products[last as keyof typeof products]),
    );
  });
  vi.stubGlobal('fetch', fetcher);
  const entry = await catalogEntry('testprice-150', 'de', undefined, false);
  expect(entry.price).toBeUndefined();
  expect(entry.priceIssue).toBe('suspect');
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('uses Groudon DLR111 only with the separately verified Cardmarket product', async () => {
  // The direct-market snapshot expires in production. This test must
  // remain deterministic once it has expired.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T18:00:00Z'));
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          id: 'me06-111',
          localId: '111',
          name: 'Groudon',
          rarity: 'Illustration Rare',
          set: {
            id: 'me06',
            name: 'Delta-Herrschaft',
            cardCount: { official: 103 },
          },
          variants: { normal: true, holo: false, reverse: false },
          pricing: {
            cardmarket: {
              unit: 'EUR',
              updated: '2026-11-10T23:49:36Z',
              idProduct: 918876,
              trend: 0.04,
              avg7: 0.07,
            },
            tcgplayer: { holofoil: { marketPrice: 22.92 } },
          },
        }),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  const result = await catalogEntry('me06-111', 'de', undefined, false);
  expect(result.price).toEqual({
    amount: 17.81,
    updated: '2026-11-11T00:00:00.000Z',
    basis: 'trend',
    provenance: 'verified-snapshot',
  });
  expect(result.priceIssue).toBeUndefined();
  expect(result.cardmarketUrl).toBe(
    'https://www.cardmarket.com/en/Pokemon/Products/Singles/Delta-Reign/Groudon-V2-DLR111',
  );
  expect(result.holoPrice).toBeUndefined();
  // The catalogue and independently generated manifest are both requested.
  // The manifest mock intentionally returns no verified rows here; the
  // legacy dated Groudon observation remains a safe outage fallback.
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('/cards/me06-111'),
    expect.anything(),
  );
});

it('prefers newly corrected provider prices when Cardmarket ID is verified', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          id: 'me06-111',
          localId: '111',
          name: 'Groudon',
          set: {
            id: 'me06',
            name: 'Delta Reign',
            cardCount: { official: 103 },
          },
          variants: { normal: true, holo: false },
          pricing: {
            cardmarket: {
              unit: 'EUR',
              updated: '2026-11-11T00:00:00Z',
              idProduct: 918949,
              trend: 19.35,
            },
          },
        }),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  const result = await catalogEntry('me06-111', 'en', undefined, false);
  expect(result.price).toMatchObject({ amount: 19.35, basis: 'trend' });
  expect(result.price?.provenance).toBeUndefined();
  expect(result.cardmarketUrl).toContain('/Groudon-V2-DLR111');
});
