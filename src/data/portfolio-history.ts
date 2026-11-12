import type { PersonalState } from '../domain/personal';
import type { PortfolioSummary } from '../domain/portfolio';

/** Only aggregate daily observations are stored locally, never card metadata. */
export interface PortfolioObservation {
  day: string;
  knownValue: number;
  ownedCopies: number;
  pricedCopies: number;
  signature: string;
}
// A unified EUR series may include converted US references. Keep previous
// policies stored, without presenting a source-policy switch as market gain.
const key = (mode: PersonalState['mode'], accountId: string | undefined) =>
  `e-binder-portfolio-history-v5:${accountId ? `account:${accountId}` : 'local'}:${mode}`;

/** Compare only the same quantities and exact printings; adding a card starts
 * a new series instead of faking a market gain. */
export function portfolioSignature(state: PersonalState): string {
  const ids = state.holdings
    .map((holding) =>
      [
        holding.card.language,
        holding.card.key,
        holding.finish,
        holding.variantNote,
        holding.quantity,
      ].join(':'),
    )
    .sort();
  let hash = 2166136261;
  for (const character of ids.join('|')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Equal counts do not mean equal price coverage. Compare the actual prints. */
function observationSignature(
  state: PersonalState,
  summary: PortfolioSummary,
): string {
  const coverage = summary.holdings
    .filter((row) => row.unitValue !== null)
    .map(
      (row) =>
        `${row.quoteKey}:${row.holding.quantity}:${row.priceSource ?? 'cardmarket'}:${row.priceBasis ?? 'unknown'}`,
    )
    .sort()
    .join('|');
  let hash = 2166136261;
  for (const c of coverage) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return `${portfolioSignature(state)}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function readPortfolioHistory(
  mode: PersonalState['mode'],
  accountId: string | undefined,
): PortfolioObservation[] {
  try {
    const raw = localStorage.getItem(key(mode, accountId));
    if (!raw || raw.length > 80000) return [];
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    return values
      .filter((row): row is PortfolioObservation => {
        if (!row || typeof row !== 'object') return false;
        const x = row as Partial<PortfolioObservation>;
        return (
          typeof x.day === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(x.day) &&
          typeof x.signature === 'string' &&
          /^[0-9a-f]{8}:[0-9a-f]{8}$/.test(x.signature) &&
          typeof x.knownValue === 'number' &&
          Number.isFinite(x.knownValue) &&
          x.knownValue > 0 &&
          typeof x.ownedCopies === 'number' &&
          Number.isInteger(x.ownedCopies) &&
          x.ownedCopies > 0 &&
          typeof x.pricedCopies === 'number' &&
          Number.isInteger(x.pricedCopies) &&
          x.pricedCopies > 0 &&
          x.pricedCopies <= x.ownedCopies
        );
      })
      .slice(-365);
  } catch {
    // Disabled/blocked browser storage must never block collection management.
    return [];
  }
}
export function recordPortfolioObservation(
  state: PersonalState,
  summary: PortfolioSummary,
  accountId: string | undefined,
  day = new Date().toISOString().slice(0, 10),
): PortfolioObservation[] {
  const current = readPortfolioHistory(state.mode, accountId);
  if (
    summary.pricedCopies === 0 ||
    !Number.isFinite(summary.knownValue) ||
    summary.knownValue <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day)
  )
    return current;
  const point: PortfolioObservation = {
    day,
    knownValue: Math.round(summary.knownValue * 100) / 100,
    ownedCopies: summary.ownedCopies,
    pricedCopies: summary.pricedCopies,
    signature: observationSignature(state, summary),
  };
  const merged = current
    .filter(
      (entry) =>
        entry.day !== day ||
        entry.signature !== point.signature ||
        entry.pricedCopies !== point.pricedCopies,
    )
    .concat(point)
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-365);
  try {
    localStorage.setItem(key(state.mode, accountId), JSON.stringify(merged));
  } catch {
    // Read-only browser sessions can still see the current portfolio.
  }
  return merged;
}

/** The chart deliberately excludes different inventories or pricing coverage. */
export function comparableHistory(
  state: PersonalState,
  summary: PortfolioSummary,
  accountId: string | undefined,
  windowDays = 90,
  current = readPortfolioHistory(state.mode, accountId),
): PortfolioObservation[] {
  const baseline = observationSignature(state, summary);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  const from = cutoff.toISOString().slice(0, 10);
  return current.filter(
    (row) =>
      row.signature === baseline &&
      row.ownedCopies === summary.ownedCopies &&
      row.pricedCopies === summary.pricedCopies &&
      row.day >= from,
  );
}
