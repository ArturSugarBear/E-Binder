/**
 * Independently verified printing-to-Cardmarket crosswalk.
 *
 * Do NOT trust a TCGdex idProduct when the ordinary and illustration-rare
 * versions collide. A dated direct Cardmarket observation is a temporary
 * reference, NOT a live quote and NOT a language/condition-specific NM sale.
 *
 * Observation: Cardmarket product page for DLR 111, checked 2026-11-11.
 * The public page identifies product 918949; TCGdex currently incorrectly
 * identifies both me06-053 and me06-111 as product 918876.
 *
 * Once a licensed/official recurring price feed is installed it should
 * replace the dated snapshot. Keep the verified URL even after expiry.
 */
export interface ExactCardmarketPrinting {
  id: string;
  setId: string;
  localId: string;
  officialCount: number;
  name: string;
  language: string;
  normal: boolean | undefined;
}

export interface VerifiedCardmarketProduct {
  productId: number;
  url: string;
  observation: {
    amount: number;
    updated: string;
    basis: 'trend';
    provenance: 'verified-snapshot';
  } | undefined;
}

const GROUDON = {
  productId: 918949,
  url: 'https://www.cardmarket.com/en/Pokemon/Products/Singles/Delta-Reign/Groudon-V2-DLR111',
  amount: 17.81,
  updated: '2026-11-11T00:00:00.000Z',
} as const;

const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Exact matching is mandatory. A shared name, collector number, similar
 * illustration, Japanese print or different finish must not receive a quote.
 */
export function verifiedCardmarketProduct(
  card: ExactCardmarketPrinting,
  now = Date.now(),
): VerifiedCardmarketProduct | undefined {
  if (
    card.id !== 'me06-111' ||
    card.setId !== 'me06' ||
    card.localId !== '111' ||
    card.officialCount !== 103 ||
    card.name.trim().toLowerCase() !== 'groudon' ||
    (card.language !== 'de' && card.language !== 'en') ||
    card.normal !== true
  )
    return undefined;

  const age = now - Date.parse(GROUDON.updated);
  return {
    productId: GROUDON.productId,
    url: GROUDON.url,
    observation:
      Number.isFinite(age) && age >= 0 && age < SNAPSHOT_MAX_AGE_MS
        ? {
            amount: GROUDON.amount,
            updated: GROUDON.updated,
            basis: 'trend',
            provenance: 'verified-snapshot',
          }
        : undefined,
  };
}
