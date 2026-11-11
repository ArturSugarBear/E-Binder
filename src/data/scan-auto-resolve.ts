import {
  catalogSets,
  catalogSetCards,
  fetchCatalogCard,
  recognitionClues,
} from './card-catalog';
import {
  compareCandidateArtwork,
  strongAppearanceAgreement,
} from './scan-photo-match';
import { scanEvidence } from './scan-review';
import { recognizedNameHints } from '../domain/recognition-names';
import { normalize, numberKey, type PersonalCard } from '../domain/personal';

export interface AutomaticScanResult {
  candidates: PersonalCard[];
  suggested?: PersonalCard;
  basis: 'printed-set' | 'full-name' | 'image' | 'review' | 'no-match';
  visualChecked: number;
}

interface CardPreview {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

const locales = ['de', 'en', 'ja'] as const;

function cardPreviews(raw: unknown): CardPreview[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is CardPreview =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      /^[\w.+-]+$/.test(item.id) &&
      typeof item.localId === 'string' &&
      typeof item.name === 'string',
  );
}

async function lookupCardNumber(
  language: string,
  printed: string,
  signal: AbortSignal,
): Promise<CardPreview[]> {
  const number = printed.split('/')[0]!;
  // Japanese cards normally pad their collector ID to 3 digits while many
  // international sets do not. Query both exact forms, not name substrings.
  const aliases = [...new Set([number, number.padStart(3, '0')])];
  const found = new Map<string, CardPreview>();
  const calls = await Promise.allSettled(
    aliases.map(async (localId) => {
      const params = new URLSearchParams({
        localId: `eq:${localId}`,
        'pagination:page': '1',
        'pagination:itemsPerPage': '250',
      });
      const response = await fetch(
        `https://api.tcgdex.net/v2/${language}/cards?${params}`,
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(11000)]),
        },
      );
      if (!response.ok) throw new Error('Kartensuche fehlgeschlagen');
      return cardPreviews(await response.json());
    }),
  );
  for (const call of calls)
    if (call.status === 'fulfilled')
      for (const entry of call.value)
        if (numberKey(entry.localId) === number) found.set(entry.id, entry);
  return [...found.values()];
}

/**
 * Fast catalogue-first discovery without asking the collector to know a set
 * code. The full fraction narrows sets via their official collector count.
 * A photo is never uploaded to the catalogue or included in a query.
 */
export async function discoverNumberedCards(
  text: string,
  preferredLanguage: string,
  signal: AbortSignal,
): Promise<PersonalCard[]> {
  const clues = recognitionClues(text);
  const fraction = clues[0]?.number;
  if (!fraction || signal.aborted) return [];
  const [number, denominator] = fraction.split('/');
  if (!number || !denominator || !/^\d+$/.test(denominator)) return [];
  const langs = [...new Set([preferredLanguage, ...locales])].filter((locale) =>
    locales.some((supported) => supported === locale),
  );
  const variants = await Promise.allSettled(
    langs.map(async (language) => {
      const [sets, previews] = await Promise.all([
        catalogSets(language, signal),
        lookupCardNumber(language, fraction, signal).catch(() => []),
      ]);
      const eligible = new Map(
        sets
          .filter((set) => set.cardCount.official === Number(denominator))
          .map((set) => [set.id, set]),
      );
      // Only results with an exact collector fraction and official set total
      // survive. Leading-zero and letter suffixes remain significant.
      let matching = previews.filter((item) => {
        const split = item.id.lastIndexOf('-');
        const setId = item.id.slice(0, split);
        return eligible.has(setId) && numberKey(item.localId) === number;
      });
      // If a catalogue backend does not support exact-id filtering, try the
      // newest matching set manifests instead. Never claim a number by itself
      // is a printing or query every global card in a large collection.
      if (!matching.length && eligible.size) {
        const priority = (id: string) =>
          /^(M\d|ME\d)/i.test(id)
            ? 5
            : /^SV\d/i.test(id)
              ? 4
              : /^S\d/i.test(id)
                ? 3
                : /^SM\d/i.test(id)
                  ? 2
                  : 1;
        const likely = [...eligible.values()]
          .sort(
            (a, b) =>
              priority(b.id) - priority(a.id) || b.id.localeCompare(a.id),
          )
          .slice(0, 12);
        const attempts = await Promise.allSettled(
          likely.map((set) => catalogSetCards(set.id, language, signal)),
        );
        matching = attempts.flatMap((result) =>
          result.status === 'fulfilled'
            ? result.value.filter(
                (item) => numberKey(item.number ?? '') === fraction,
              )
            : [],
        );
      }
      const details: PersonalCard[] = [];
      for (let i = 0; i < matching.length && i < 24; i += 6) {
        if (signal.aborted) break;
        const batch = await Promise.allSettled(
          matching
            .slice(i, i + 6)
            .map((item) => fetchCatalogCard(item.id, language, signal)),
        );
        for (const entry of batch) {
          if (
            entry.status === 'fulfilled' &&
            numberKey(entry.value.number) === fraction
          )
            details.push(entry.value);
        }
      }
      return details;
    }),
  );
  const found = variants.flatMap((entry) =>
    entry.status === 'fulfilled' ? entry.value : [],
  );
  return [...new Map(found.map((card) => [card.key, card])).values()];
}

export async function resolvePhotoScan(
  photo: Blob,
  text: string,
  known: PersonalCard[],
  preferredLanguage: string,
  signal: AbortSignal,
): Promise<AutomaticScanResult> {
  const catalog = await discoverNumberedCards(text, preferredLanguage, signal);
  const all = [
    ...new Map([...catalog, ...known].map((card) => [card.key, card])).values(),
  ];
  const number = recognitionClues(text)[0]?.number;
  const candidates = number
    ? all.filter((card) => numberKey(card.number) === number)
    : all;
  const evidence = scanEvidence(text, candidates);
  if (evidence.kind === 'set-number' && evidence.title !== 'conflicting')
    return {
      candidates: [
        evidence.card,
        ...candidates.filter((card) => card.key !== evidence.card.key),
      ],
      suggested: evidence.card,
      basis: 'printed-set',
      visualChecked: 0,
    };
  if (evidence.kind === 'name-number')
    return {
      candidates: [
        evidence.card,
        ...candidates.filter((card) => card.key !== evidence.card.key),
      ],
      suggested: evidence.card,
      basis: 'full-name',
      visualChecked: 0,
    };
  const inspected = await compareCandidateArtwork(photo, candidates, signal);
  const strong = strongAppearanceAgreement(inspected);
  const scores = new Map(
    inspected.map((entry) => [entry.card.key, entry.similarity]),
  );
  const title = recognizedNameHints(text)[0];
  const ranked = [...candidates].sort((a, b) => {
    const nameA = title && normalize(title) === normalize(a.name) ? 1 : 0;
    const nameB = title && normalize(title) === normalize(b.name) ? 1 : 0;
    return (
      Number(nameB) - Number(nameA) ||
      (scores.get(b.key) ?? -1) - (scores.get(a.key) ?? -1) ||
      Number(b.language === preferredLanguage) -
        Number(a.language === preferredLanguage) ||
      a.key.localeCompare(b.key)
    );
  });
  const suggestion = strong && ranked.find((card) => card.key === strong.key);
  const ordered = suggestion
    ? [suggestion, ...ranked.filter((card) => card.key !== suggestion.key)]
    : ranked;
  return {
    candidates: ordered.slice(0, 24),
    suggested: suggestion,
    basis: suggestion ? 'image' : candidates.length ? 'review' : 'no-match',
    visualChecked: inspected.length,
  };
}
