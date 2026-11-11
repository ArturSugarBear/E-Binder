import { afterEach, expect, it, vi } from 'vitest';
import {
  officialCardmarketReference,
  resetOfficialCardmarketCacheForTest,
} from '../../src/data/official-cardmarket-prices';

const source = new Date('2026-11-11T01:45:38.000Z');
const guide = {
  schemaVersion: 1,
  currency: 'EUR',
  sourceCreatedAt: source.toISOString(),
  sets: { me06: { status: 'validated', pricedPrints: 131 } },
  cards: {
    'me06-106': [918943, 9.21, 'trend', 'Growlithe', '106'],
    'me06-111': [918949, 18.32, 'trend', 'Groudon', '111'],
  },
};

const setup = (payload = guide) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload))),
  );
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetOfficialCardmarketCacheForTest();
});

it('selects the actual illustration-rare product independently of TCGdex', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T12:00:00.000Z'));
  setup();
  const result = await officialCardmarketReference({
    id: 'me06-111',
    setId: 'me06',
    localId: '111',
    language: 'de',
  });
  expect(result).toMatchObject({
    productId: 918949,
    url: 'https://www.cardmarket.com/en/Pokemon/Products?idProduct=918949',
    price: {
      amount: 18.32,
      basis: 'trend',
      provenance: 'official-export',
    },
  });
});

it('never shares a price with another collector number or Japanese printing', async () => {
  setup();
  expect(
    await officialCardmarketReference({
      id: 'me06-111',
      setId: 'me06',
      localId: '053',
      language: 'de',
    }),
  ).toBeUndefined();
  expect(
    await officialCardmarketReference({
      id: 'me06-111',
      setId: 'me06',
      localId: '111',
      language: 'ja',
    }),
  ).toBeUndefined();
});

it('does not use a stale snapshot but retains the trusted product link', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
  setup();
  const result = await officialCardmarketReference({
    id: 'me06-106',
    setId: 'me06',
    localId: '106',
    language: 'en',
  });
  expect(result).toMatchObject({ productId: 918943 });
  expect(result?.price).toBeUndefined();
});

it('handles missing/corrupted daily source without inventing a price', async () => {
  setup({ schemaVersion: 99 } as typeof guide);
  expect(
    await officialCardmarketReference({
      id: 'me06-111',
      setId: 'me06',
      localId: '111',
      language: 'de',
    }),
  ).toBeUndefined();
});
