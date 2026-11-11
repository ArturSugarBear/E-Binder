import type { PersonalCard } from '../domain/personal';
import { numberKey } from '../domain/personal';
import type { VisualHit } from '../domain/visual-retrieval';
import { fetchCatalogCard } from './card-catalog';

type ReadCard = (
  sourceId: string,
  language: string,
  signal: AbortSignal,
) => Promise<PersonalCard>;

/**
 * Resolve visual embedding hits to genuine catalogue printings.
 * Neither a model vector nor an artwork match identifies language or finish.
 * Strictly validate source ID, set, number and language against the model's
 * own reference before surfacing a card. No invented catalogue records.
 */
export async function resolveVisualPrintings(
  hits: readonly VisualHit[],
  known: readonly PersonalCard[],
  signal: AbortSignal,
  options: {
    online?: boolean;
    readCard?: ReadCard;
  } = {},
): Promise<PersonalCard[]> {
  if (signal.aborted) return [];
  const limit = 5;
  const unique = [
    ...new Map(hits.map((hit) => [hit.reference.id, hit])).values(),
  ].slice(0, limit);
  const exact = (card: PersonalCard, hit: VisualHit) => {
    const ref = hit.reference;
    const sourceId = ref.id.slice(ref.language.length + 1);
    return (
      ref.id.startsWith(`${ref.language}:`) &&
      /^[\w.+-]{2,100}$/.test(sourceId) &&
      card.source === 'tcgdex' &&
      card.sourceId === sourceId &&
      card.setId === ref.setId &&
      card.language === ref.language &&
      numberKey(card.number) === numberKey(ref.number)
    );
  };
  const local = new Map<string, PersonalCard>();
  for (const hit of unique) {
    const found = known.find((card) => exact(card, hit));
    if (found) local.set(hit.reference.id, found);
  }

  if (options.online !== false && unique.length && !signal.aborted) {
    const read = options.readCard ?? fetchCatalogCard;
    const missing = unique.filter((hit) => !local.has(hit.reference.id));
    const results = await Promise.allSettled(
      missing.map(async (hit) => {
        const ref = hit.reference;
        if (!ref.id.startsWith(`${ref.language}:`)) return null;
        const sourceId = ref.id.slice(ref.language.length + 1);
        if (!/^[\w.+-]{2,100}$/.test(sourceId)) return null;
        const card = await read(sourceId, ref.language, signal);
        return exact(card, hit) ? card : null;
      }),
    );
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === 'fulfilled' && result.value) {
        local.set(missing[i]!.reference.id, result.value);
      }
    }
  }

  if (signal.aborted) return [];
  // Preserve the visual order, including unresolved DE/EN print variants.
  return unique.flatMap((hit) => {
    const card = local.get(hit.reference.id);
    return card ? [card] : [];
  });
}
