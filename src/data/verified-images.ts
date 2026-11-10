import { numberKey, type PersonalCard } from '../domain/personal';

/**
 * Publisher-checked offline archive printings, each already bundled by the
 * app. Exact edition and language only: similar artworks, reprints and holo
 * variants are not interchangeable.
 */
const verified: Record<string, string> = {
  'sv01-211': 'svi-211',
  'sv01-212': 'svi-212',
  'sv01-245': 'svi-245',
  'sv03-207': 'obf-207',
  'sv03-208': 'obf-208',
  'sv03-225': 'obf-225',
  'sv02-208': 'pal-208',
  'sv02-209': 'pal-209',
  'sv02-210': 'pal-210',
};

/** A curated local fallback, never a fuzzy name/illustration lookup. */
export function verifiedLocalArt(card: PersonalCard): string {
  if (
    card.source !== 'tcgdex' ||
    card.language !== 'de' ||
    card.image ||
    !/^[a-zA-Z0-9]+-[a-zA-Z0-9]+$/.test(card.sourceId)
  )
    return '';
  const stem = verified[card.sourceId];
  if (!stem) return '';
  const dash = card.sourceId.lastIndexOf('-');
  const set = card.sourceId.slice(0, dash);
  const localId = card.sourceId.slice(dash + 1);
  if (
    set !== card.setId ||
    numberKey(card.number).split('/')[0] !== numberKey(localId)
  )
    return '';
  return `assets/cards/${stem}.webp`;
}
