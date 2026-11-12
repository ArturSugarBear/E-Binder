import { afterEach, expect, it, vi } from 'vitest';
import ja from '../fixtures/provider/ja-M1L-088.json';
import product from '../fixtures/provider/tcgp-647197.json';
import de from '../fixtures/provider/de-me01-077.json';
import inkay from '../fixtures/provider/de-me06-113.json';
import talonflame from '../fixtures/provider/de-me06-124.json';
import growlithe from '../fixtures/provider/de-me06-106.json';
import type { Holding } from '../../src/domain/personal';
import { emptyState } from '../../src/domain/personal';
import {
  portfolioQuoteKey,
  summarizePortfolio,
} from '../../src/domain/portfolio';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([inkay, talonflame, growlithe])(
  'resolves actual provider collision $id and aggregates copies and binder slots',
  async (raw) => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(raw)),
    );
    const { catalogEntry } = await import('../../src/data/card-catalog');
    const { holdingPrice } = await import('../../src/data/holding-prices');
    const entry = await catalogEntry(raw.id, 'de', undefined, false);
    const expected = {
      'me06-113': [918952, 2.32],
      'me06-124': [918963, 7.13],
      'me06-106': [918943, 8.93],
    }[raw.id]!;
    expect(entry.cardmarketProductId).toBe(expected[0]);
    expect(entry.price?.amount).toBe(expected[1]);
    const holding = {
      id: 'owned',
      card: entry.card,
      finish: 'normal',
      variantNote: '',
      quantity: 2,
    } as Holding;
    const result = await holdingPrice(holding);
    expect(result.status).toBe('priced');
    if (result.status !== 'priced') throw new Error('Expected verified quote');
    const state = emptyState('personal');
    state.holdings = [holding];
    state.binders = [
      {
        id: 'b',
        name: 'Binder',
        isPublic: false,
        pages: [
          {
            id: 'p',
            title: 'Seite',
            assembled: false,
            slots: [
              { kind: 'owned', holdingId: 'owned', copy: 1, locked: false },
            ],
          },
        ],
      },
    ];
    const total = summarizePortfolio(
      state,
      new Map([[portfolioQuoteKey(holding)!, result.quote]]),
    );
    expect(total.knownValue).toBe(expected[1]! * 2);
    expect(total.binders[0]?.knownValue).toBe(expected[1]);
    expect(
      (await holdingPrice({ ...holding, variantNote: 'stamped' })).status,
    ).toBe('unavailable');
    expect(
      (
        await holdingPrice({
          ...holding,
          card: { ...holding.card, number: '001/103' },
        })
      ).status,
    ).toBe('unavailable');
  },
);

it('resolves Japanese artwork and a catalog-verified German name, preserving original text', async () => {
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json(
        url.includes('catalog-products/tcgplayer')
          ? product
          : url.includes('/ja/')
            ? ja
            : url.includes('/en/')
              ? [{ id: de.id, name: 'Mega Lucario ex' }]
              : de,
      ),
    ),
  );
  const { catalogEntry } = await import('../../src/data/card-catalog');
  const { germanCardName, japanesePrinting } =
    await import('../../src/data/japanese-catalog');
  const entry = await catalogEntry('M1L-088', 'ja');
  expect(entry.card.image).toBe(
    'https://tcgplayer-cdn.tcgplayer.com/product/647197_in_1000x1000.jpg',
  );
  expect(entry.card.name).toBe('メガルカリオex');
  expect(await germanCardName(entry.card)).toBe('Mega-Lucario-ex');
  expect(
    await japanesePrinting({ ...entry.card, number: '089/063' }),
  ).toBeUndefined();
  expect(
    await japanesePrinting({ ...entry.card, setId: 'M1S' }),
  ).toBeUndefined();
});

it.each(['number', 'setCode', 'productLineName'])(
  'rejects mismatched Japanese secondary artwork: %s',
  async (field) => {
    vi.resetModules();
    const wrong = {
      ...product,
      [field]: 'wrong',
      customAttributes: {
        ...product.customAttributes,
        ...(field === 'number' ? { number: '089/063' } : {}),
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json(url.includes('catalog-products/tcgplayer') ? wrong : ja),
      ),
    );
    const { catalogResumeCard } = await import('../../src/data/card-catalog');
    const { secondaryCardArt } =
      await import('../../src/data/artwork-fallbacks');
    expect(
      await secondaryCardArt(
        catalogResumeCard({ ...ja, number: '088/063', language: 'ja' }),
      ),
    ).toBeUndefined();
  },
);
