import {
  catalogEntry,
  type CatalogEntry,
  type TcgplayerReference,
} from './card-catalog';
import {
  isUsableQuote,
  portfolioQuoteKey,
  type PortfolioQuote,
} from '../domain/portfolio';
import { normalize, numberKey, type Holding } from '../domain/personal';
import { convertedMarketReference, usdEurRate } from './exchange-rates';

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

function matchesHolding(
  entry: CatalogEntry,
  holding: Holding,
  sourceId: string,
): boolean {
  return (
    entry.card.sourceId === sourceId &&
    entry.card.setId === holding.card.setId &&
    entry.card.language === holding.card.language &&
    numberKey(entry.card.number) === numberKey(holding.card.number) &&
    normalize(entry.card.name) === normalize(holding.card.name) &&
    entry.card.finishes.includes(holding.finish)
  );
}

/** Exact US-market source observation before the shared EUR conversion. */
export async function holdingMarketReference(
  holding: Holding,
): Promise<TcgplayerReference | undefined> {
  const card = holding.card;
  const editorial =
    card.source === 'editorial' &&
    card.artistSource === 'publisher' &&
    card.key.startsWith('tcgdex:de:');
  const sourceId = editorial
    ? card.key.slice('tcgdex:de:'.length)
    : card.sourceId;
  if (
    (card.source !== 'tcgdex' && !editorial) ||
    !['de', 'en', 'ja'].includes(card.language) ||
    (holding.finish !== 'normal' && holding.finish !== 'holo') ||
    holding.variantNote.trim() ||
    !card.setId ||
    !sourceId.startsWith(`${card.setId}-`) ||
    numberKey(sourceId.slice(card.setId.length + 1)) !==
      numberKey(card.number).split('/')[0]
  )
    return;
  try {
    const entry = await catalogEntry(sourceId, card.language, undefined, false);
    return matchesHolding(entry, holding, sourceId)
      ? entry.tcgplayer?.[holding.finish]
      : undefined;
  } catch {
    return;
  }
}

/**
 * Reuse the Portfolio's exact-printing rules in Collection cards and details.
 * No approximate set price is shown for unverified, reverse or custom copies.
 */
export async function holdingPrice(
  holding: Holding,
): Promise<HoldingPriceResult> {
  const key = portfolioQuoteKey(holding);
  if (!key) return { status: 'unavailable' };
  // Re-check imported/corrected metadata even if another holding with the
  // same provider ID already has a cached quote.
  const requestKey = JSON.stringify([
    key,
    normalize(holding.card.name),
    numberKey(holding.card.number),
  ]);
  const cached = results.get(requestKey);
  if (cached && cached.until > Date.now()) return cached.value;
  const request = pending.get(requestKey);
  if (request) return request;
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return { status: 'error' };

  // Keys are generated exclusively by portfolioQuoteKey, never from search
  // text or a loose card name. The source ID includes any set-prefix hyphens.
  const sourceId = key.split(':').slice(1, -1).join(':');
  const promise: Promise<HoldingPriceResult> = catalogEntry(
    sourceId,
    holding.card.language,
    undefined,
    false,
  )
    .then(async (entry) => {
      // A stored printing can outlive catalogue corrections or be imported
      // with a wrong language, fraction or finish. Never borrow its neighbor's
      // market quote just because the source ID still exists.
      if (!matchesHolding(entry, holding, sourceId)) {
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
      let value: HoldingPriceResult =
        entry.priceIssue === 'suspect'
          ? { status: 'suspect' }
          : isUsableQuote(quote, key)
            ? { status: 'priced', quote }
            : { status: 'unavailable' };
      if (value.status !== 'priced') {
        const reference =
          holding.finish === 'normal' || holding.finish === 'holo'
            ? entry.tcgplayer?.[holding.finish]
            : undefined;
        if (reference) {
          const rate = await usdEurRate();
          const converted = rate
            ? convertedMarketReference(reference, rate)
            : undefined;
          value = isUsableQuote(converted, key)
            ? { status: 'priced', quote: converted }
            : { status: 'error' };
        }
      }
      if (value.status !== 'error')
        results.set(requestKey, { until: Date.now() + CACHE_MS, value });
      return value;
    })
    .catch((): HoldingPriceResult => ({ status: 'error' }))
    .finally(() => {
      pending.delete(requestKey);
    });
  pending.set(requestKey, promise);
  return promise;
}
