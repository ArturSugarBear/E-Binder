import { catalogEntry } from './card-catalog';
import {
  isUsableQuote,
  portfolioQuoteKey,
  type PortfolioQuote,
} from '../domain/portfolio';
import { normalize, numberKey, type Holding } from '../domain/personal';

export type HoldingPriceResult =
  | { status: 'priced'; quote: PortfolioQuote }
  | { status: 'unavailable' | 'suspect' | 'error' };

interface CachedPrice {
  until: number;
  value: HoldingPriceResult;
}

const results = new Map<string, CachedPrice>();
const pending = new Map<string, Promise<HoldingPriceResult>>();
const CACHE_MS = 5 * 60 * 1000;

/**
 * Reuse the Portfolio's exact-printing rules in Collection cards and details.
 * No approximate set price is shown for unverified, reverse or custom copies.
 */
export async function holdingPrice(
  holding: Holding,
): Promise<HoldingPriceResult> {
  const key = portfolioQuoteKey(holding);
  if (!key) return { status: 'unavailable' };
  const cached = results.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  const request = pending.get(key);
  if (request) return request;
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return { status: 'error' };

  // Keys are generated exclusively by portfolioQuoteKey, never from search
  // text or a loose card name. The source ID includes any set-prefix hyphens.
  const sourceId = key.split(':').slice(1, -1).join(':');
  const promise: Promise<HoldingPriceResult> = catalogEntry(
    sourceId,
    'de',
    undefined,
    false,
  )
    .then((entry) => {
      // A stored printing can outlive catalogue corrections or be imported
      // with a wrong language, fraction or finish. Never borrow its neighbor's
      // market quote just because the source ID still exists.
      const samePrinting =
        entry.card.sourceId === sourceId &&
        entry.card.setId === holding.card.setId &&
        entry.card.language === holding.card.language &&
        numberKey(entry.card.number) === numberKey(holding.card.number) &&
        normalize(entry.card.name) === normalize(holding.card.name) &&
        entry.card.finishes.includes(holding.finish);
      if (!samePrinting) {
        return { status: 'unavailable' } as HoldingPriceResult;
      }
      const price = holding.finish === 'holo' ? entry.holoPrice : entry.price;
      const quote: PortfolioQuote | undefined = price
        ? {
            source: 'cardmarket',
            variant: holding.finish === 'holo' ? 'holo' : 'normal',
            amount: price.amount,
            updated: price.updated,
            basis: price.basis,
            provenance: price.provenance,
            productUrl: entry.cardmarketUrl,
          }
        : undefined;
      const value: HoldingPriceResult =
        entry.priceIssue === 'suspect'
          ? { status: 'suspect' }
          : isUsableQuote(quote, key)
            ? { status: 'priced', quote }
            : { status: 'unavailable' };
      results.set(key, { until: Date.now() + CACHE_MS, value });
      return value;
    })
    .catch((): HoldingPriceResult => ({ status: 'error' }))
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, promise);
  return promise;
}
