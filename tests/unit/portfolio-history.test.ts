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
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

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
  it('starts a new series when a trend quote falls back to an average price', () => {
    const { state } = stateWithPricedCard();
    const price = (basis: 'trend' | 'avg7', amount: number) =>
      summarizePortfolio(
        state,
        new Map([
          [
            'de:sv01-001:normal',
            {
              source: 'cardmarket',
              variant: 'normal',
              updated: '2026-11-10',
              basis,
              amount,
            },
          ],
        ]),
      );
    recordPortfolioObservation(
      state,
      price('trend', 15.5),
      undefined,
      '2026-11-09',
    );
    const average = price('avg7', 20);
    recordPortfolioObservation(state, average, undefined, '2026-11-10');
    expect(
      comparableHistory(state, average, undefined).map((p) => p.knownValue),
    ).toEqual([20]);
  });

  it('isolates identical portfolios between accounts, local mode and demo', () => {
    const { state, summary } = stateWithPricedCard();
    recordPortfolioObservation(state, summary, 'account-a', '2026-11-09');
    recordPortfolioObservation(
      state,
      { ...summary, knownValue: 20 },
      'account-b',
      '2026-11-10',
    );
    expect(
      comparableHistory(state, summary, 'account-a').map((p) => p.knownValue),
    ).toEqual([15.5]);
    expect(
      comparableHistory(state, summary, 'account-b').map((p) => p.knownValue),
    ).toEqual([20]);
    expect(comparableHistory(state, summary, undefined)).toEqual([]);
    expect(readPortfolioHistory('demo', 'account-a')).toEqual([]);
    // Neither login nor logout may claim the unscoped legacy history.
    storage.set(
      'e-binder-portfolio-history-v2:personal',
      JSON.stringify(readPortfolioHistory('personal', 'account-a')),
    );
    expect(readPortfolioHistory('personal', 'account-c')).toEqual([]);
    expect(readPortfolioHistory('personal', undefined)).toEqual([]);
  });

  it('starts without a fake curve and records daily aggregates, not card names', () => {
    const { state, summary } = stateWithPricedCard();
    expect(readPortfolioHistory('personal', undefined)).toEqual([]);
    recordPortfolioObservation(state, summary, undefined, '2026-11-09');
    recordPortfolioObservation(state, summary, undefined, '2026-11-10');
    const points = comparableHistory(state, summary, undefined, 30);
    expect(points).toHaveLength(2);
    expect(points.map((point) => point.knownValue)).toEqual([15.5, 15.5]);
    const serialized = storage.get(
      'e-binder-portfolio-history-v3:local:personal',
    )!;
    expect(serialized).not.toContain('Echte Karte');
    expect(serialized).not.toContain('sv01');
  });

  it('never connects charts after cards are added, even if total value rises', () => {
    const { state, summary } = stateWithPricedCard();
    recordPortfolioObservation(state, summary, undefined, '2026-11-09');
    state.holdings[0]!.quantity = 2;
    const modified = summarizePortfolio(
      state,
      new Map([
        [
          'de:sv01-001:normal',
          {
            source: 'cardmarket' as const,
            variant: 'normal' as const,
            amount: 15.5,
            updated: '2026-11-09T12:00:00.000Z',
          },
        ],
      ]),
    );
    recordPortfolioObservation(state, modified, undefined, '2026-11-10');
    expect(comparableHistory(state, modified, undefined, 30)).toHaveLength(1);
    expect(portfolioSignature(state)).not.toBe(
      readPortfolioHistory('personal', undefined)[0]!.signature,
    );
  });

  it('keeps missing prices as missing, never writes a zero observation', () => {
    const { state } = stateWithPricedCard();
    recordPortfolioObservation(
      state,
      summarizePortfolio(state, new Map()),
      undefined,
      '2026-11-09',
    );
    expect(readPortfolioHistory('personal', undefined)).toEqual([]);
  });
  it('never connects equal-sized coverage of different cards', () => {
    const { state } = stateWithPricedCard();
    const second = structuredClone(state.holdings[0]!);
    second.id = 'second';
    second.card.key = 'tcgdex:de:sv01-002';
    second.card.sourceId = 'sv01-002';
    second.card.number = '002/198';
    state.holdings.push(second);
    const quote = (id: string, amount: number) =>
      summarizePortfolio(
        state,
        new Map([
          [
            `de:${id}:normal`,
            {
              source: 'cardmarket' as const,
              variant: 'normal' as const,
              amount,
              updated: '2026-11-09',
            },
          ],
        ]),
      );
    recordPortfolioObservation(
      state,
      quote('sv01-001', 10),
      undefined,
      '2026-11-09',
    );
    const today = quote('sv01-002', 100);
    recordPortfolioObservation(state, today, undefined, '2026-11-10');
    expect(comparableHistory(state, today, undefined, 30)).toHaveLength(1);
  });
});
