import { afterEach, expect, it, vi } from 'vitest';
import { holdingPrice } from '../../src/data/holding-prices';
import type { Holding } from '../../src/domain/personal';

afterEach(() => vi.unstubAllGlobals());

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

it('uses the verified price for the exact Groudon DLR111 holding', async () => {
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
