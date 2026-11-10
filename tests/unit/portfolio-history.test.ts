import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  comparableHistory,
  portfolioSignature,
  readPortfolioHistory,
  recordPortfolioObservation,
} from '../../src/data/portfolio-history';
import { emptyState } from '../../src/domain/personal';
import { summarizePortfolio } from '../../src/domain/portfolio';

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

function stateWithPricedCard() {
  const state = emptyState();
  state.holdings.push({
    id: 'sample',
    card: {
      key: 'tcgdex:de:sv01-001',
      source: 'tcgdex',
      sourceId: 'sv01-001',
      name: 'Echte Karte',
      setName: 'Karmesin & Purpur',
      setId: 'sv01',
      number: '001/198',
      language: 'de',
      image: '',
      artist: '',
      artistSource: 'unknown',
      evolvesFrom: '',
      stage: '',
      finishes: ['normal'],
    },
    finish: 'normal',
    variantNote: '',
    quantity: 1,
    tradeQuantity: 0,
    favorite: false,
    notes: '',
    confirmed: true,
    createdAt: '2026-11-09T00:00:00.000Z',
    updatedAt: '2026-11-09T00:00:00.000Z',
  });
  const quote = new Map([
    [
      'de:sv01-001:normal',
      {
        source: 'cardmarket' as const,
        variant: 'normal' as const,
        amount: 15.5,
        updated: '2026-11-09T12:00:00.000Z',
      },
    ],
  ]);
  return { state, summary: summarizePortfolio(state, quote) };
}

describe('real, comparable portfolio history', () => {
  it('starts without a fake curve and records daily aggregates, not card names', () => {
    const { state, summary } = stateWithPricedCard();
    expect(readPortfolioHistory('personal')).toEqual([]);
    recordPortfolioObservation(state, summary, '2026-11-09');
    recordPortfolioObservation(state, summary, '2026-11-10');
    const points = comparableHistory(state, summary, 30);
    expect(points).toHaveLength(2);
    expect(points.map((point) => point.knownValue)).toEqual([15.5, 15.5]);
    const serialized = storage.get('e-binder-portfolio-history-v1:personal')!;
    expect(serialized).not.toContain('Echte Karte');
    expect(serialized).not.toContain('sv01');
  });

  it('never connects charts after cards are added, even if total value rises', () => {
    const { state, summary } = stateWithPricedCard();
    recordPortfolioObservation(state, summary, '2026-11-09');
    state.holdings[0]!.quantity = 2;
    const modified = summarizePortfolio(
      state,
      new Map([
        ['de:sv01-001:normal', {
          source: 'cardmarket' as const,
          variant: 'normal' as const,
          amount: 15.5,
          updated: '2026-11-09T12:00:00.000Z',
        }],
      ]),
    );
    recordPortfolioObservation(state, modified, '2026-11-10');
    expect(comparableHistory(state, modified, 30)).toHaveLength(1);
    expect(portfolioSignature(state)).not.toBe(
      readPortfolioHistory('personal')[0]!.signature,
    );
  });

  it('keeps missing prices as missing, never writes a zero observation', () => {
    const { state } = stateWithPricedCard();
    recordPortfolioObservation(state, summarizePortfolio(state, new Map()), '2026-11-09');
    expect(readPortfolioHistory('personal')).toEqual([]);
  });
});
