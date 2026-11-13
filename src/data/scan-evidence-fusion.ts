import { recognitionClues, visualNumberClues } from './card-catalog';
import { fullCardNameMatches, rankScanCandidates } from './scan-review';
import { recognizedNameHints } from '../domain/recognition-names';
import { numberKey, type PersonalCard } from '../domain/personal';
import type { VisualHit } from '../domain/visual-retrieval';

/**
 * The scanner has no calibrated probability model yet. A cosine score of 0.8
 * is NOT an 80% probability and must never unlock automatic inventory changes.
 */
export type FusionState =
  | 'text-image-agree'
  | 'printed-identity'
  | 'name-number'
  | 'ocr-conflict'
  | 'visual-review'
  | 'review'
  | 'no-match';

export type FusionRetryRegion = 'footer' | 'footer-contrast' | 'title';

export interface FusedScanEvidence {
  candidates: PersonalCard[];
  suggested?: PersonalCard;
  basis: 'printed-set' | 'full-name' | 'review';
  state: FusionState;
  /** A suggestion for another OCR crop, not a request for a new photograph. */
  retryRegion?: FusionRetryRegion;
  /** Relative position in the reference index, never a probability. */
  visualAgreement: boolean;
}

/** A validated model reference is a printing *candidate*, not proof of finish. */
function matchesVisualReference(card: PersonalCard, hit: VisualHit): boolean {
  const ref = hit.reference;
  return (
    Number.isFinite(hit.similarity) &&
    card.source === 'tcgdex' &&
    ref.id === ref.language + ':' + card.sourceId &&
    card.language === ref.language &&
    card.setId.toLowerCase() === ref.setId.toLowerCase() &&
    numberKey(card.number) === numberKey(ref.number)
  );
}

/**
 * Merge OCR identity, catalogue and opt-in vision evidence without converting
 * duplicate crops into independent votes, or equating visual similarity with
 * probability. Incomplete or contradictory OCR must not delete image matches.
 */
export function fuseScanEvidence(
  text: string,
  candidates: readonly PersonalCard[],
  visualHits: readonly VisualHit[] = [],
  preferredLanguage = 'de',
): FusedScanEvidence {
  const unique = [
    ...new Map(candidates.map((card) => [card.key, card])).values(),
  ];
  const clues = recognitionClues(text);
  const partial = visualNumberClues(text);
  const fullNumbers = new Set(clues.map((clue) => numberKey(clue.number)));
  const ambiguousOcr = fullNumbers.size > 1;
  const name = recognizedNameHints(text)[0];
  const visualRanks = new Map<string, number>();
  for (const card of unique) {
    const rank = visualHits
      .filter((hit) => matchesVisualReference(card, hit))
      .reduce(
        (best, hit) => Math.min(best, hit.visualRank),
        Number.POSITIVE_INFINITY,
      );
    if (Number.isFinite(rank)) visualRanks.set(card.key, rank);
  }

  const ranked = [...unique].sort((a, b) => {
    const score = (card: PersonalCard): number => {
      const number = numberKey(card.number);
      const matchingNumber = clues.some(
        (clue) => numberKey(clue.number) === number,
      );
      const matchingPrintedSet = clues.some(
        (clue) =>
          clue.setId?.toLowerCase() === card.setId.toLowerCase() &&
          numberKey(clue.number) === number &&
          (!clue.language || clue.language === card.language),
      );
      const titleMatches = Boolean(
        name && fullCardNameMatches(name, card.name),
      );
      const fragmentMatches = partial.some((clue) => {
        if (clue.number.includes('/')) return false;
        const part = numberKey(clue.number);
        return part.length >= 2 && number.split('/')[0] === part;
      });
      const visualRank = visualRanks.get(card.key);
      return (
        (matchingPrintedSet ? 1000 : 0) +
        (matchingNumber && titleMatches ? 600 : 0) +
        (matchingNumber ? 180 : 0) +
        (titleMatches ? 75 : 0) +
        (visualRank === undefined ? 0 : 90 + Math.max(0, 6 - visualRank)) +
        (fragmentMatches ? 25 : 0) +
        (card.language === preferredLanguage ? 1 : 0) -
        (fullNumbers.size && !matchingNumber ? 260 : 0) -
        (name && matchingPrintedSet && !titleMatches ? 300 : 0)
      );
    };
    return score(b) - score(a) || a.key.localeCompare(b.key);
  });

  const exact = rankScanCandidates(text, ranked);
  const plausibleOcrTitle = Boolean(
    name &&
    unique.some(
      (card) =>
        fullCardNameMatches(name, card.name) &&
        clues.some(
          (clue) =>
            !clue.setId ||
            clue.setId.toLowerCase() === card.setId.toLowerCase(),
        ),
    ),
  );
  const numberDisagreement =
    fullNumbers.size > 0 &&
    (visualRanks.size > 0 || plausibleOcrTitle) &&
    !unique.some((card) => fullNumbers.has(numberKey(card.number)));
  const conflict = ambiguousOcr || exact.conflictingName || numberDisagreement;
  const suggested = conflict ? undefined : exact.suggested;
  const basis = suggested ? exact.basis : 'review';
  const visualAgreement = Boolean(suggested && visualRanks.has(suggested.key));

  let state: FusionState;
  if (conflict) state = 'ocr-conflict';
  else if (suggested)
    state = visualAgreement
      ? 'text-image-agree'
      : basis === 'printed-set'
        ? 'printed-identity'
        : 'name-number';
  else if (visualRanks.size) state = 'visual-review';
  else state = unique.length ? 'review' : 'no-match';

  const hasFullNumber = fullNumbers.size === 1;
  const hasSetAndNumber = clues.some((clue) => Boolean(clue.setId));
  const retryRegion: FusionRetryRegion | undefined = conflict
    ? exact.conflictingName
      ? 'title'
      : 'footer-contrast'
    : !hasFullNumber || !hasSetAndNumber
      ? 'footer'
      : !name
        ? 'title'
        : undefined;

  return {
    candidates: exact.candidates,
    suggested,
    basis,
    state,
    retryRegion,
    visualAgreement,
  };
}
