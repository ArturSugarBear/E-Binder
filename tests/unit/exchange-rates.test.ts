import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isUsableQuote } from '../../src/domain/portfolio';

const store = new Map<string, string>();
const key = 'e-binder-usd-eur-ecb-v1';
const now = new Date('2026-11-12T12:00:00Z').getTime();
const response = { base: 'USD', quote: 'EUR', date: '2026-11-11', rate: 0.9 };
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, value: string) => store.set(k, value),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('coalesces a collection into one rate request, persists it and rounds a unit consistently', async () => {
  const fetcher = vi.fn(async () => Response.json(response));
  vi.stubGlobal('fetch', fetcher);
  const { usdEurRate, convertedMarketReference } =
    await import('../../src/data/exchange-rates');
  const rates = await Promise.all(
    Array.from({ length: 50 }, () => usdEurRate()),
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('providers=ECB'),
    expect.any(Object),
  );
  expect(store.get(key)).toContain('2026-11-11');
  const quote = convertedMarketReference(
    {
      source: 'tcgplayer',
      currency: 'USD',
      variant: 'holo',
      amount: 45.25,
      updated: '2026-11-10',
    },
    rates[0]!,
  );
  expect(quote).toMatchObject({
    source: 'tcgplayer',
    currency: 'EUR',
    amount: 40.73,
    conversion: { amount: 45.25, rate: 0.9, provider: 'ECB' },
  });
  expect(isUsableQuote(quote, 'de:mep-080:holo')).toBe(true);
  expect(isUsableQuote({ ...quote!, amount: 45.25 }, 'de:mep-080:holo')).toBe(
    false,
  );
  expect(
    isUsableQuote({ ...quote!, currency: 'USD' } as never, 'de:mep-080:holo'),
  ).toBe(false);
  expect(await usdEurRate()).toEqual(rates[0]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('reuses a fresh persisted pair and refreshes it after one hour', async () => {
  store.set(
    key,
    JSON.stringify({ date: response.date, rate: 0.9, fetchedAt: now - 1000 }),
  );
  const fetcher = vi.fn(async () => Response.json({ ...response, rate: 0.89 }));
  vi.stubGlobal('fetch', fetcher);
  const { usdEurRate } = await import('../../src/data/exchange-rates');
  expect((await usdEurRate())?.rate).toBe(0.9);
  expect(fetcher).not.toHaveBeenCalled();
  vi.setSystemTime(now + 3600000);
  expect((await usdEurRate())?.rate).toBe(0.89);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('uses a dated recent cache during an outage, but never beyond seven days', async () => {
  store.set(
    key,
    JSON.stringify({ date: '2026-11-09', rate: 0.9, fetchedAt: now - 7200000 }),
  );
  const fetcher = vi.fn(async () => {
    throw new Error('offline');
  });
  vi.stubGlobal('fetch', fetcher);
  const { usdEurRate } = await import('../../src/data/exchange-rates');
  expect((await usdEurRate())?.date).toBe('2026-11-09');
  expect((await usdEurRate())?.rate).toBe(0.9);
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.setSystemTime(now + 7 * 86400000);
  expect(await usdEurRate()).toBeUndefined();
});

it.each([
  { ...response, base: 'EUR', quote: 'USD' },
  { ...response, rate: 0 },
  { ...response, rate: -1 },
  { ...response, rate: '0.9' },
  { ...response, date: '2026-11-13' },
  { ...response, date: '2026-11-01' },
  { ...response, date: '2026-02-30' },
])(
  'rejects an invalid pair without a made-up conversion: %j',
  async (invalid) => {
    const fetcher = vi.fn(async () => Response.json(invalid));
    vi.stubGlobal('fetch', fetcher);
    const { usdEurRate } = await import('../../src/data/exchange-rates');
    expect(await usdEurRate()).toBeUndefined();
    expect(await usdEurRate()).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1); // outage cooldown, even with many cards
    expect(store.size).toBe(0);
  },
);

it('works without browser storage and can retry a failed request after cooldown', async () => {
  vi.stubGlobal('localStorage', {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  });
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json(response));
  vi.stubGlobal('fetch', fetcher);
  const { usdEurRate } = await import('../../src/data/exchange-rates');
  expect(await usdEurRate()).toBeUndefined();
  vi.setSystemTime(now + 61000);
  expect((await usdEurRate())?.rate).toBe(0.9);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
