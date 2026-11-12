import { afterEach, expect, it, vi } from 'vitest';
import {
  holdingPrice,
  holdingMarketReference,
} from '../../src/data/holding-prices';
import type { Holding } from '../../src/domain/personal';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const holding = (
  id: string,
  name: string,
  number: string,
  finish: 'normal' | 'holo',
): Holding => ({
  id,
  card: {
    key: `tcgdex:de:${id}`,
    source: 'tcgdex',
    sourceId: id,
    name,
    setName: 'Delta-Herrschaft',
    setId: 'me06',
    number,
    language: 'de',
    image: '',
    artist: '',
    artistSource: 'unknown',
    evolvesFrom: '',
    stage: '',
    finishes: [finish],
  },
  finish,
  variantNote: '',
  quantity: 1,
  tradeQuantity: 0,
  favorite: false,
  notes: '',
  confirmed: true,
  createdAt: '2026-11-09T12:00:00Z',
  updatedAt: '2026-11-09T12:00:00Z',
});

it('uses a dated TCGplayer EUR fallback only for the exact printing and finish', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.includes('frankfurter.dev')
        ? Response.json({
            base: 'USD',
            quote: 'EUR',
            date: '2026-11-11',
            rate: 0.9,
          })
        : new Response(
            JSON.stringify({
              id: 'me06-082',
              localId: '082',
              name: 'Testkarte',
              set: {
                id: 'me06',
                name: 'Delta-Herrschaft',
                cardCount: { official: 103 },
              },
              variants: { normal: false, holo: true },
              pricing: {
                tcgplayer: {
                  unit: 'USD',
                  updated: '2026-11-10T12:00:00Z',
                  holofoil: { marketPrice: 12.5, productId: 123456 },
                },
              },
            }),
          ),
    ),
  );
  const card = holding('me06-082', 'Testkarte', '082/103', 'holo');
  expect(await holdingPrice(card)).toMatchObject({
    status: 'priced',
    quote: {
      source: 'tcgplayer',
      currency: 'EUR',
      amount: 11.25,
      conversion: { from: 'USD', amount: 12.5, rate: 0.9 },
    },
  });
  expect(await holdingMarketReference(card)).toMatchObject({
    source: 'tcgplayer',
    currency: 'USD',
    variant: 'holo',
    amount: 12.5,
    productUrl: 'https://www.tcgplayer.com/product/123456',
  });
  expect(
    await holdingMarketReference({
      ...card,
      card: { ...card.card, name: 'Andere Karte' },
    }),
  ).toBeUndefined();
  expect(
    await holdingPrice({
      ...card,
      card: { ...card.card, name: 'Andere Karte' },
    }),
  ).toEqual({ status: 'unavailable' });
  expect(
    await holdingMarketReference({ ...card, finish: 'normal' }),
  ).toBeUndefined();
  expect(
    await holdingMarketReference({ ...card, variantNote: '1st Edition' }),
  ).toBeUndefined();
});

it('uses the verified price for the exact Groudon DLR111 holding', async () => {
  // The direct-market snapshot expires in production. This test must
  // remain deterministic once it has expired.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T18:00:00Z'));
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'me06-111',
            localId: '111',
            name: 'Groudon',
            variants: { normal: true, holo: false },
            set: {
              id: 'me06',
              name: 'Delta-Herrschaft',
              cardCount: { official: 103 },
            },
            pricing: {
              cardmarket: {
                unit: 'EUR',
                updated: '2026-11-09T12:00:00Z',
                idProduct: 918876,
                trend: 0.04,
              },
            },
          }),
        ),
    ),
  );
  expect(
    await holdingPrice(holding('me06-111', 'Groudon', '111/103', 'normal')),
  ).toMatchObject({
    status: 'priced',
    quote: {
      amount: 17.81,
      source: 'cardmarket',
      variant: 'normal',
      basis: 'trend',
      provenance: 'verified-snapshot',
      productUrl:
        'https://www.cardmarket.com/en/Pokemon/Products/Singles/Delta-Reign/Groudon-V2-DLR111',
    },
  });
});

it('does not value a holding whose stored finish is not offered by its catalogue printing', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'me06-106',
            localId: '106',
            name: 'Fukano',
            variants: { normal: false, holo: true },
            set: {
              id: 'me06',
              name: 'Delta-Herrschaft',
              cardCount: { official: 103 },
            },
            pricing: {
              cardmarket: {
                unit: 'EUR',
                updated: '2026-11-09T12:00:00Z',
                trend: 15.95,
              },
            },
          }),
        ),
    ),
  );
  expect(
    await holdingPrice(holding('me06-106', 'Fukano', '106/103', 'normal')),
  ).toEqual({
    status: 'unavailable',
  });
});
