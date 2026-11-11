import { recognitionClues } from './card-catalog';
import { numberKey, type PersonalCard } from '../domain/personal';

export type ScanEvidence =
  | { kind: 'exact'; card: PersonalCard; number: string }
  | { kind: 'number-only'; number: string; count: number }
  | { kind: 'name-only'; count: number }
  | { kind: 'none' };

/**
 * An OCR collector fraction is shared by different sets. It is not evidence
 * of an exact printing unless a printed set code matches a single candidate.
 * No branch of this function confirms that the collector owns a card.
 */
export function scanEvidence(text: string, candidates: PersonalCard[]): ScanEvidence {
  const clues = recognitionClues(text);
  const exact = candidates.filter((card) =>
    clues.some(
      (clue) =>
        Boolean(clue.setId) &&
        clue.setId === card.setId &&
        numberKey(clue.number) === numberKey(card.number) &&
        (!clue.language || clue.language === card.language),
    ),
  );
  if (exact.length === 1) {
    const card = exact[0]!;
    return { kind: 'exact', card, number: card.number };
  }
  const numbered = clues[0]?.number;
  if (numbered)
    return { kind: 'number-only', number: numbered, count: candidates.length };
  if (candidates.length) return { kind: 'name-only', count: candidates.length };
  return { kind: 'none' };
}
