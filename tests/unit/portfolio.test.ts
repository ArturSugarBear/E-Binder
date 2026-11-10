import { describe, expect, it } from 'vitest';
import {
  portfolioQuoteKey,
  summarizePortfolio,
  type PortfolioQuote,
} from '../../src/domain/portfolio';
import {
  emptyState,
  type Holding,
  type PersonalCard,
} from '../../src/domain/personal';

const card: PersonalCard = {
  key: 'tcgdex:de:sv01-211',
  source: 'tcgdex',
  sourceId: 'sv01-211',
  name: 'Trasla',
  setName: 'Karmesin & Purpur',
  setId: 'sv01',
  number: '211/198',
  language: 'de',
  image: '',
  artist: '',
  artistSource: 'unknown',
  evolvesFrom: '',
  stage: '',
  finishes: ['normal', 'holo', 'reverse'],
};

const holding = (id: string, quantity = 2): Holding => ({
  id,
  card,
  finish: 'normal',
  variantNote: '',
  quantity,
  tradeQuantity: 0,
  favorite: false,
  notes: '',
  confirmed: true,
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
});

const normal: PortfolioQuote = {
  source: 'cardmarket',
  variant: 'normal',
  amount: 12.5,
  updated: '2026-11-09T12:00:00.000Z',
};

describe('honest portfolio calculations', () => {
  it('keeps an empty portfolio unknown rather than inventing a price', () => {
    const result = summarizePortfolio(emptyState(), new Map());
    expect(result).toMatchObject({
      knownValue: 0,
      ownedCopies: 0,
      pricedCopies: 0,
      missingCopies: 0,
      binders: [],
    });
  });

  it('uses exactly matched price quotes and counts each owned binder slot once', () => {
    const state = emptyState();
    const own = holding('own', 3);
    state.holdings.push(own);
    state.binders.push({
      id: 'binder',
      name: 'Rare Room',
      isPublic: false,
      pages: [
        {
          id: 'p1',
          title: 'Erste Seite',
          slots: [
            { kind: 'owned', holdingId: 'own', copy: 1, locked: false },
            { kind: 'owned', holdingId: 'own', copy: 2, locked: false },
            { kind: 'planned', card, locked: false },
            null,
            null,
            null,
            null,
            null,
            null,
          ],
          assembled: false,
        },
        {
          id: 'p2',
          title: 'Zweite Seite',
          slots: [
            { kind: 'owned', holdingId: 'own', copy: 3, locked: false },
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
          assembled: false,
        },
      ],
    });
    const key = portfolioQuoteKey(own)!;
    const result = summarizePortfolio(state, new Map([[key, normal]]));
    expect(result.ownedCopies).toBe(3);
    expect(result.pricedCopies).toBe(3);
    expect(result.knownValue).toBe(37.5);
    expect(result.binders[0]).toMatchObject({
      slots: 3,
      pricedSlots: 3,
      knownValue: 37.5,
      pages: [
        { slots: 2, pricedSlots: 2, knownValue: 25 },
        { slots: 1, pricedSlots: 1, knownValue: 12.5 },
      ],
    });
  });

  it('does not silently use normal card prices for holo, reverse, graded or different printings', () => {
    expect(portfolioQuoteKey({ ...holding('h'), finish: 'holo' })).toBe(
      'de:sv01-211:holo',
    );
    expect(
      portfolioQuoteKey({ ...holding('r'), finish: 'reverse' }),
    ).toBeNull();
    expect(
      portfolioQuoteKey({ ...holding('x'), variantNote: '1. Auflage' }),
    ).toBeNull();
    expect(
      portfolioQuoteKey({
        ...holding('m'),
        card: { ...card, source: 'manual' },
      }),
    ).toBeNull();
    expect(
      portfolioQuoteKey({
        ...holding('w'),
        card: { ...card, number: '212/198' },
      }),
    ).toBeNull();
    const state = emptyState();
    state.holdings.push(holding('normal', 2), {
      ...holding('holo', 1),
      finish: 'holo',
    });
    const quotes = new Map<string, PortfolioQuote>([
      ['de:sv01-211:normal', normal],
      ['de:sv01-211:holo', { ...normal, variant: 'normal' }],
    ]);
    const result = summarizePortfolio(state, quotes);
    expect(result).toMatchObject({
      knownValue: 25,
      ownedCopies: 3,
      pricedCopies: 2,
      missingCopies: 1,
    });
  });

  it('rejects impossible quotes instead of counting them as a real market value', () => {
    const state = emptyState();
    state.holdings.push(holding('own'));
    const key = 'de:sv01-211:normal';
    const result = summarizePortfolio(
      state,
      new Map([[key, { ...normal, amount: Number.NaN }]]),
    );
    expect(result.pricedCopies).toBe(0);
    expect(result.missingCopies).toBe(2);
  });
});
