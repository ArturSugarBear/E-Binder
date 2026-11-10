import { describe, expect, it } from 'vitest';
import {
  emptyState,
  validateState,
  type Holding,
  type PersonalCard,
} from '../../src/domain/personal';
import {
  portfolioQuoteKey,
  summarizePortfolio,
  type PortfolioQuote,
} from '../../src/domain/portfolio';

const stamp = '2026-11-09T12:00:00.000Z';
function makeHolding(index: number): Holding {
  const setId = ['sv01', 'sv02', 'swsh12.5'][index % 3]!;
  const serial = Math.floor(index / 3) + 1;
  const id = `${setId}-${String(serial).padStart(3, '0')}`;
  const card: PersonalCard = {
    key: `tcgdex:de:${id}`,
    name: `Karte ${index + 1}`,
    setName: ['Karmesin & Purpur', 'Entwicklungen', 'Zenit der Könige'][index % 3]!,
    setId,
    number: `${String(serial).padStart(3, '0')}/198`,
    language: 'de',
    image: '',
    source: 'tcgdex',
    sourceId: id,
    artist: '',
    artistSource: 'unknown',
    evolvesFrom: '',
    stage: '',
    finishes: ['normal', 'holo', 'reverse'],
  };
  return {
    id: `holding-${index}`,
    card,
    finish: index % 5 === 0 ? 'reverse' : index % 3 === 0 ? 'holo' : 'normal',
    variantNote: '',
    quantity: index % 7 === 0 ? 2 : 1,
    tradeQuantity: 0,
    favorite: false,
    notes: '',
    confirmed: true,
    createdAt: stamp,
    updatedAt: stamp,
  };
}
function scenario(count: number) {
  const state = emptyState();
  state.holdings = Array.from({ length: count }, (_, i) => makeHolding(i));
  const quotes = new Map<string, PortfolioQuote>();
  let expectedTotal = 0;
  let expectedCovered = 0;
  for (const [index, holding] of state.holdings.entries()) {
    const key = portfolioQuoteKey(holding);
    if (!key || index % 4 === 0) continue;
    const amount = index % 2 === 0 ? 1.75 : 21.99;
    quotes.set(key, {
      source: 'cardmarket',
      variant: holding.finish as 'normal' | 'holo',
      basis: index % 2 === 0 ? 'avg7' : 'trend',
      amount,
      updated: stamp,
    });
    expectedTotal += amount * holding.quantity;
    expectedCovered += holding.quantity;
  }
  return { state: validateState(state), quotes, expectedCovered, expectedTotal };
}

describe.each([1, 25, 250])('%i confirmed cards in a realistic portfolio', (size) => {
  it('does not invent prices or confuse duplicates with editions', () => {
    const { state, quotes, expectedCovered, expectedTotal } = scenario(size);
    const summary = summarizePortfolio(state, quotes);
    expect(summary.holdings).toHaveLength(size);
    expect(summary.pricedCopies).toBe(expectedCovered);
    expect(summary.knownValue).toBeCloseTo(expectedTotal, 5);
    expect(summary.missingCopies).toBe(
      summary.ownedCopies - expectedCovered,
    );
    expect(summary.ownedCopies).toBeGreaterThanOrEqual(size);
    expect(summary.holdings.every((row) => row.totalValue === null || row.totalValue > 0)).toBe(true);
  });
});

it('accepts only exact publisher-verified editorial print IDs', () => {
  const official = makeHolding(1);
  official.card.source = 'editorial';
  official.card.sourceId = 'editorial-placeholder';
  official.card.artistSource = 'publisher';
  expect(portfolioQuoteKey(official)).toBe('de:sv02-001:normal');
  official.card.artistSource = 'unknown';
  expect(portfolioQuoteKey(official)).toBeNull();
});
