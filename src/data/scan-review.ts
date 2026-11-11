import { recognitionClues } from './card-catalog';
import { recognizedNameHints } from '../domain/recognition-names';
import { normalize, numberKey, type PersonalCard } from '../domain/personal';

export type ScanEvidence =
  | {
      kind: 'set-number';
      card: PersonalCard;
      title: 'matching' | 'unreadable' | 'conflicting';
    }
  | { kind: 'name-number'; card: PersonalCard }
  | { kind: 'set-required'; number: string; count: number }
  | { kind: 'name-only'; count: number }
  | { kind: 'none' };

/**
 * Retain printed identity qualifiers such as Mega, ex, GX, VSTAR or regional
 * prefixes. "Lucario" must not match "Mega Lucario ex" as a full title.
 */
export function fullCardNameMatches(a: string, b: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  return left.length >= 3 && left === right;
}

/**
 * Ranking must be evidence-driven: printed set + collector fraction first,
 * then exact full name + collector fraction. A fraction alone is ambiguous.
 * The user still confirms the physical printing and finish.
 */
export function scanEvidence(
  text: string,
  candidates: PersonalCard[],
): ScanEvidence {
  const clues = recognitionClues(text);
  const title = recognizedNameHints(text)[0];
  const unique = [
    ...new Map(candidates.map((card) => [card.key, card])).values(),
  ];
  const printed = unique.filter((card) =>
    clues.some(
      (clue) =>
        Boolean(clue.setId) &&
        clue.setId === card.setId &&
        numberKey(clue.number) === numberKey(card.number) &&
        (!clue.language || clue.language === card.language),
    ),
  );
  if (printed.length === 1) {
    const card = printed[0]!;
    return {
      kind: 'set-number',
      card,
      title: !title
        ? 'unreadable'
        : fullCardNameMatches(title, card.name)
          ? 'matching'
          : 'conflicting',
    };
  }
  const nameAndNumber = title
    ? unique.filter(
        (card) =>
          fullCardNameMatches(title, card.name) &&
          clues.some(
            (clue) =>
              numberKey(clue.number) === numberKey(card.number) &&
              (!clue.language || clue.language === card.language),
          ),
      )
    : [];
  if (nameAndNumber.length === 1) {
    return { kind: 'name-number', card: nameAndNumber[0]! };
  }
  if (clues.length)
    return {
      kind: 'set-required',
      number: clues[0]!.number,
      count: unique.length,
    };
  if (unique.length) return { kind: 'name-only', count: unique.length };
  return { kind: 'none' };
}
