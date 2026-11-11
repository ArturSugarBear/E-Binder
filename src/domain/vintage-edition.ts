import type { PersonalCard } from './personal';

/**
 * Vintage English/German Base Set cards may be printed as 1st Edition
 * or Unlimited under the SAME set/number/catalogue ID.
 *
 * A catalogue match, finish, artwork (especially translated fallback art),
 * or OCR of the Pokémon name does not verify the edition stamp. Never use
 * those signals to infer a scarce first printing automatically.
 */
export function requiresEditionStampReview(
  card: Pick<PersonalCard, 'source' | 'setId' | 'language'>,
): boolean {
  return (
    card.source === 'tcgdex' &&
    card.setId.toLowerCase() === 'base1' &&
    ['de', 'en'].includes(card.language)
  );
}

export type VintageEdition = 'unknown' | 'unlimited' | 'first';

export function editionClaimFromNote(note: string): VintageEdition {
  const value = note.trim().toLowerCase();
  if (
    /\b(?:1st|first|erste|erstauflage|1\s*\.?\s*(?:edition|auflage)|(?:edition|auflage)\s*1)\b/u.test(
      value,
    )
  )
    return 'first';
  if (/\b(?:unlimited|unlimitiert|ohne\s+stempel)\b/u.test(value))
    return 'unlimited';
  return 'unknown';
}

/** Only an explicit physical stamp check allows saving "1. Edition". */
export function validateVintageEdition(
  card: Pick<PersonalCard, 'source' | 'setId' | 'language'>,
  variantNote: string,
  stamped: boolean,
  selector?: VintageEdition,
): string | undefined {
  if (!requiresEditionStampReview(card)) return undefined;
  const claim = editionClaimFromNote(variantNote);
  if (selector === 'unlimited' && claim === 'first')
    return 'Die Auflage widerspricht der Angabe Unlimited. Bitte korrigieren.';
  if (selector === 'first' && claim !== 'first')
    return 'Für 1. Edition muss die Auflage ausdrücklich angegeben werden.';
  if ((selector === 'first' || claim === 'first') && !stamped)
    return '1. Edition nur nach Sichtprüfung des Editionsstempels bestätigen.';
  return undefined;
}
