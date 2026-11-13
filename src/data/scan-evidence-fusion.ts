import { recognitionClues } from './card-catalog';
import { fullCardNameMatches, rankScanCandidates } from './scan-review';
import { recognizedNameHints } from '../domain/recognition-names';
import { numberKey, type PersonalCard } from '../domain/personal';

export interface FusedScanRanking {
  candidates: PersonalCard[];
  suggested?: PersonalCard;
  basis: 'printed-set' | 'full-name' | 'review';
  /** Diagnostic evidence categories, never a calibrated probability. */
  signals: Readonly<{
    numbered: boolean;
    named: boolean;
    visual: boolean;
    appearance: boolean;
    conflict: boolean;
  }>;
}

/**
 * Combines independent evidence TYPES, not repeat OCR crops of one photograph.
 * A model rank, cosine similarity or colour score is never a probability and
 * is never sufficient to suggest a printing for automatic acceptance.
 *
 * Strong printed identity remains authoritative. Visual retrieval can order
 * candidates when OCR is incomplete, but cannot invent language, set, number
 * or finish; every candidate has already been checked against TCGdex.
 */
export function fuseScanEvidence(
  text: string,
  cards: readonly PersonalCard[],
  visualCards: readonly PersonalCard[] = [],
  appearance: ReadonlyMap<string, number> = new Map(),
  preferredLanguage = 'de',
): FusedScanRanking {
  const unique = [...new Map(cards.map((card) => [card.key, card])).values()];
  const ocr = rankScanCandidates(text, unique);
  const title = recognizedNameHints(text)[0];
  const clues = recognitionClues(text);
  const visualRanks = new Map(
    visualCards.map((card, index) => [card.key, index]),
  );
  const exactName = (card: PersonalCard) =>
    Boolean(title && fullCardNameMatches(title, card.name));
  const fullNumber = (card: PersonalCard) =>
    clues.some(
      (clue) =>
        clue.number.includes('/') &&
        numberKey(clue.number) === numberKey(card.number) &&
        (!clue.language || clue.language === card.language),
    );
  const setAndNumber = (card: PersonalCard) =>
    clues.some(
      (clue) =>
        Boolean(clue.setId) &&
        clue.setId?.toLowerCase() === card.setId.toLowerCase() &&
        numberKey(clue.number) === numberKey(card.number) &&
        (!clue.language || clue.language === card.language),
    );
  // Only use visual evidence when the reference card was actually resolved
  // against the catalogue. Sorting never changes the printing identity.
  const score = (card: PersonalCard) => {
    const visualRank = visualRanks.get(card.key);
    const imageScore = appearance.get(card.key);
    const named = exactName(card);
    const full = fullNumber(card);
    const set = setAndNumber(card);
    const titlePenalty =
      title && !named && unique.some((item) => exactName(item)) ? -4 : 0;
    return (
      (set ? 20 : 0) +
      (named && full ? 12 : 0) +
      (named ? 4 : 0) +
      (full ? 3 : 0) +
      (visualRank === undefined ? 0 : Math.max(0, 4 - visualRank)) +
      (Number.isFinite(imageScore)
        ? Math.max(0, Math.min(1, imageScore!))
        : 0) +
      titlePenalty
    );
  };
  const ranked = unique.sort(
    (a, b) =>
      // The existing strict printing policy wins over any visual shortcut.
      Number(b.key === ocr.suggested?.key) -
        Number(a.key === ocr.suggested?.key) ||
      score(b) - score(a) ||
      Number(b.language === preferredLanguage) -
        Number(a.language === preferredLanguage) ||
      a.key.localeCompare(b.key),
  );
  return {
    candidates: ranked,
    suggested: ocr.suggested,
    basis: ocr.basis,
    signals: {
      numbered: clues.some((clue) => clue.number.includes('/')),
      named: Boolean(title),
      visual: visualRanks.size > 0,
      appearance: appearance.size > 0,
      conflict: ocr.conflictingName,
    },
  };
}
