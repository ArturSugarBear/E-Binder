import { afterEach, expect, it, vi } from 'vitest';
import { catalogEntry } from '../../src/data/card-catalog';

afterEach(() => vi.unstubAllGlobals());

function mockCard(id: string, cardmarket: Record<string, unknown>) {
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
            variants: { normal: true, holo: true, reverse: true },
            pricing: { cardmarket },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ),
  );
}

it('uses the exact 7-day Cardmarket average when trend is absent', async () => {
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
  expect(entry.holoPrice).toMatchObject({ amount: 15.75, basis: 'avg7' });
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
