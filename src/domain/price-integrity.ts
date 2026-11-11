/**
 * TCGdex Cardmarket feeds may point two different printings at the same
 * Cardmarket product. They are unfiltered catalogue averages, NOT Near Mint
 * offers in a specific language. Refuse internally contradictory data.
 *
 * This is an anomaly detector, not a model of a card's fair market value.
 * Never replace a rejected observation with a guessed price.
 */
export interface PriceIntegrityInput {
  localId: string;
  setOfficialCount: number;
  amountEur: number;
  tcgplayerMarketUsd?: number;
}

export function priceLooksMisassigned(input: PriceIntegrityInput): boolean {
  const { amountEur, localId, setOfficialCount, tcgplayerMarketUsd } = input;
  if (!Number.isFinite(amountEur) || amountEur <= 0) return true;

  // A secret/illustration rare print beyond the set's main numbering priced
  // like its cheap base card is a known TCGdex product-ID collision pattern.
  // It is safer to leave genuinely cheap exceptions unpriced than invent a
  // portfolio value. This catches me06-106 and me06-111.
  const numeric = /^\d+$/.test(localId) ? Number(localId) : NaN;
  if (
    Number.isInteger(setOfficialCount) &&
    setOfficialCount > 0 &&
    numeric > setOfficialCount &&
    amountEur < 0.5
  )
    return true;

  // The independent US feed only flags gross contradictions. USD is NEVER
  // converted to EUR or presented as a Cardmarket / NM price.
  if (
    tcgplayerMarketUsd !== undefined &&
    Number.isFinite(tcgplayerMarketUsd) &&
    tcgplayerMarketUsd >= 5 &&
    amountEur * 15 < tcgplayerMarketUsd
  )
    return true;

  return false;
}
