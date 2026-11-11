import { numberKey, type Holding, type PersonalState } from './personal';

export interface PortfolioQuote {
  amount: number;
  updated: string;
  source: 'cardmarket';
  variant: 'normal' | 'holo';
  basis?: 'trend' | 'avg7' | 'avg30' | 'avg';
  provenance?: 'verified-snapshot';
  productUrl?: string;
}

export interface PortfolioHolding {
  holding: Holding;
  quoteKey: string | null;
  unitValue: number | null;
  totalValue: number | null;
  priceBasis?: PortfolioQuote['basis'];
}

export interface PortfolioPage {
  id: string;
  title: string;
  slots: number;
  pricedSlots: number;
  knownValue: number;
}

export interface PortfolioBinder {
  id: string;
  name: string;
  slots: number;
  pricedSlots: number;
  knownValue: number;
  pages: PortfolioPage[];
}

export interface PortfolioSummary {
  knownValue: number;
  ownedCopies: number;
  pricedCopies: number;
  missingCopies: number;
  holdings: PortfolioHolding[];
  binders: PortfolioBinder[];
}

/**
 * A price can only be applied to the exact TCGdex printing and known foil
 * treatment. "Other", reverse, stamped, manually entered and unverified
 * cards remain unpriced instead of inheriting a misleading card trend.
 */
export function portfolioQuoteKey(holding: Holding): string | null {
  const { card, finish, variantNote } = holding;
  // Exact, publisher-verified editorial print IDs are safe to value too.
  // Ordinary editorial placeholders and manual cards are not.
  const verifiedEditorial =
    card.source === 'editorial' &&
    card.artistSource === 'publisher' &&
    card.key.startsWith('tcgdex:de:');
  if (
    (card.source !== 'tcgdex' && !verifiedEditorial) ||
    card.language !== 'de' ||
    (finish !== 'normal' && finish !== 'holo') ||
    variantNote.trim() ||
    !card.sourceId ||
    !card.setId
  )
    return null;
  const sourceId = verifiedEditorial
    ? card.key.slice('tcgdex:de:'.length)
    : card.sourceId;
  const split = sourceId.lastIndexOf('-');
  if (split <= 0) return null;
  const printedSet = sourceId.slice(0, split);
  const printedNumber = sourceId.slice(split + 1);
  if (
    card.setId !== printedSet ||
    numberKey(card.number).split('/')[0] !== numberKey(printedNumber)
  )
    return null;
  return `${card.language}:${sourceId}:${finish}`;
}

export function isUsableQuote(
  quote: PortfolioQuote | undefined,
  key: string | null,
): quote is PortfolioQuote {
  if (!quote || !key) return false;
  const variant = key.split(':').at(-1);
  return (
    quote.source === 'cardmarket' &&
    quote.variant === variant &&
    Number.isFinite(quote.amount) &&
    quote.amount > 0 &&
    Number.isFinite(Date.parse(quote.updated)) &&
    Date.parse(quote.updated) <= Date.now()
  );
}

/**
 * Count confirmed holdings once by quantity; count binder value only for
 * physically assigned copies. Planned slots and empty slots have no value.
 * A partly priced total is always presented as "known/covered", not full net
 * worth, and prices are not actual sold proceeds.
 */
export function summarizePortfolio(
  state: PersonalState,
  quotes: ReadonlyMap<string, PortfolioQuote>,
): PortfolioSummary {
  const holdings = state.holdings.map((holding): PortfolioHolding => {
    const key = portfolioQuoteKey(holding);
    const candidate = key ? quotes.get(key) : undefined;
    const unitValue = isUsableQuote(candidate, key) ? candidate.amount : null;
    return {
      holding,
      quoteKey: key,
      unitValue,
      totalValue: unitValue === null ? null : unitValue * holding.quantity,
      priceBasis: unitValue === null ? undefined : candidate?.basis,
    };
  });
  const lookup = new Map(holdings.map((row) => [row.holding.id, row]));
  const ownedCopies = holdings.reduce(
    (total, row) => total + row.holding.quantity,
    0,
  );
  const pricedCopies = holdings.reduce(
    (total, row) => total + (row.unitValue === null ? 0 : row.holding.quantity),
    0,
  );
  const binders = state.binders.map((binder): PortfolioBinder => {
    let slots = 0;
    let pricedSlots = 0;
    let knownValue = 0;
    const pages = binder.pages.map((page): PortfolioPage => {
      let pageSlots = 0;
      let pagePriced = 0;
      let pageValue = 0;
      for (const slot of page.slots) {
        if (slot?.kind !== 'owned') continue;
        pageSlots++;
        const value = lookup.get(slot.holdingId)?.unitValue;
        if (value === undefined || value === null) continue;
        pagePriced++;
        pageValue += value;
      }
      slots += pageSlots;
      pricedSlots += pagePriced;
      knownValue += pageValue;
      return {
        id: page.id,
        title: page.title,
        slots: pageSlots,
        pricedSlots: pagePriced,
        knownValue: pageValue,
      };
    });
    return {
      id: binder.id,
      name: binder.name,
      slots,
      pricedSlots,
      knownValue,
      pages,
    };
  });
  return {
    knownValue: holdings.reduce(
      (total, row) => total + (row.totalValue ?? 0),
      0,
    ),
    ownedCopies,
    pricedCopies,
    missingCopies: ownedCopies - pricedCopies,
    holdings,
    binders,
  };
}
