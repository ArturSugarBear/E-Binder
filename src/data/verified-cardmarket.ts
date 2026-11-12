/** Independent, exact printing crosswalk with dated official price-guide trends.
 * These are not language/condition-specific Near Mint offers.
 * Ambiguous catalogue rows are excluded; expired observations retain only the URL.
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
  observation:
    | {
        amount: number;
        updated: string;
        basis: 'trend';
        provenance: 'verified-snapshot';
      }
    | undefined;
}

import crosswalk from './cardmarket-crosswalk.json';
import observations from './cardmarket-observations.json';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Independent expansion crosswalk, never inferred from name or price magnitude. */
export function verifiedCardmarketProduct(
  card: ExactCardmarketPrinting,
  now = Date.now(),
): VerifiedCardmarketProduct | undefined {
  const row = (
    crosswalk as Record<string, (typeof crosswalk)[keyof typeof crosswalk]>
  )[card.id];
  if (
    !row ||
    row.setId !== card.setId ||
    row.localId !== card.localId ||
    row.officialCount !== card.officialCount ||
    row.normal !== card.normal ||
    !row.language.includes(card.language) ||
    row.names[card.language as keyof typeof row.names]?.toLowerCase() !==
      card.name.trim().toLowerCase()
  )
    return;
  const guide = (
    observations.prices as Record<string, { trend: number | null } | null>
  )[String(row.productId)];
  const updated = new Date(observations.updated).toISOString();
  const age = now - Date.parse(updated);
  return {
    productId: row.productId,
    url: row.url,
    observation:
      guide?.trend && guide.trend > 0 && age >= 0 && age < MAX_AGE_MS
        ? {
            amount: guide.trend,
            updated,
            basis: 'trend',
            provenance: 'verified-snapshot',
          }
        : undefined,
  };
}
