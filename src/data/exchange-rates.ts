import type { TcgplayerReference } from './card-catalog';
import {
  euroAmountFromUsd,
  isRecentExchangeDate,
  type PortfolioQuote,
} from '../domain/portfolio';

export interface UsdEurRate {
  date: string;
  rate: number;
  fetchedAt: number;
}
const endpoint = 'https://api.frankfurter.dev/v2/rate/usd/eur?providers=ECB';
const storageKey = 'e-binder-usd-eur-ecb-v1';
const hour = 60 * 60 * 1000;
let cached: UsdEurRate | undefined;
let pending: Promise<UsdEurRate | undefined> | undefined;
let retryAfter = 0;

function valid(value: unknown): value is UsdEurRate {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<UsdEurRate>;
  return (
    typeof item.rate === 'number' &&
    Number.isFinite(item.rate) &&
    item.rate > 0 &&
    typeof item.fetchedAt === 'number' &&
    Number.isFinite(item.fetchedAt) &&
    item.fetchedAt > 0 &&
    item.fetchedAt <= Date.now() &&
    isRecentExchangeDate(item.date)
  );
}

/** One shared pair request, never one conversion request per card. */
export async function usdEurRate(): Promise<UsdEurRate | undefined> {
  if (!cached) {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? 'null',
      );
      if (valid(value)) cached = value;
    } catch {
      /* Storage is optional; no personal data are stored here. */
    }
  }
  if (valid(cached) && Date.now() - cached.fetchedAt < hour) return cached;
  if (pending) return pending;
  if (Date.now() < retryAfter) return undefined;
  const request = (async () => {
    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Exchange rate unavailable');
      const raw = (await response.json()) as Record<string, unknown>;
      const value = { date: raw.date, rate: raw.rate, fetchedAt: Date.now() };
      if (raw.base !== 'USD' || raw.quote !== 'EUR' || !valid(value))
        throw new Error('Invalid exchange rate');
      cached = value;
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        /* A read-only browser can still convert. */
      }
      return cached;
    } catch {
      retryAfter = Date.now() + 60 * 1000;
      // A dated recent reference remains usable during an outage/weekend.
      if (valid(cached)) {
        cached = { ...cached, fetchedAt: Date.now() };
        return cached;
      }
      return undefined;
    }
  })();
  pending = request.finally(() => {
    pending = undefined;
  });
  return pending;
}

export function convertedMarketReference(
  reference: TcgplayerReference,
  rate: UsdEurRate,
): PortfolioQuote | undefined {
  if (!valid(rate)) return;
  const amount = euroAmountFromUsd(reference.amount, rate.rate);
  if (amount === null) return;
  return {
    source: 'tcgplayer',
    currency: 'EUR',
    variant: reference.variant,
    amount,
    updated: reference.updated,
    basis: 'market',
    productUrl: reference.productUrl,
    conversion: {
      from: 'USD',
      amount: reference.amount,
      rate: rate.rate,
      date: rate.date,
      provider: 'ECB',
    },
  };
}
