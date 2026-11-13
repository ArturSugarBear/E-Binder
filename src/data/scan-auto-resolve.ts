import {
  catalogSets,
  catalogSetCards,
  candidatesFromText,
  fetchCatalogCard,
  recognitionClues,
  visualNumberClues,
} from './card-catalog';
import { compareCandidateArtwork } from './scan-photo-match';
import {
  reviewVisualCandidates,
  type VisualHit,
} from '../domain/visual-retrieval';
import type { VisualSearchSession } from './visual-search';
import { resolveVisualPrintings } from './scan-visual-shortlist';
import { fuseScanEvidence } from './scan-evidence-fusion';
import { numberKey, type PersonalCard } from '../domain/personal';

export interface AutomaticScanResult {
  candidates: PersonalCard[];
  suggested?: PersonalCard;
  basis:
    | 'printed-set'
    | 'full-name'
    | 'image'
    | 'visual-review'
    | 'review'
    | 'no-match';
  visualChecked: number;
  /** Validated local-model candidate count, not confidence or accuracy. */
  visualModelCandidates: number;
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
  visualSession?: VisualSearchSession | null,
  visualTimeoutMs = 4700,
  prefetchedVisualHits?: Promise<VisualHit[]>,
): Promise<AutomaticScanResult> {
  // The optional ONNX index is the only path capable of finding printings
  // when set/name OCR is unreadable. Start it beside catalogue discovery,
  // not after a potentially long network lookup. Missing licensed assets,
  // expired manifests or visual timeouts leave ordinary OCR functional.
  const boundedVisualMs = Math.max(1000, Math.min(12000, visualTimeoutMs));
  const visualBudget = AbortSignal.any([
    signal,
    AbortSignal.timeout(boundedVisualMs + 100),
  ]);
  const visualHits =
    prefetchedVisualHits ??
    (visualSession ? visualSession.match(photo, boundedVisualMs) : null);
  // A prefetched request can still be waiting for a 60-second cold model
  // download. Never make the live scanner wait past its own review budget.
  const visualCards = visualHits
    ? Promise.race([
        visualHits
          .then((hits) =>
            reviewVisualCandidates(hits, visualNumberClues(text), 5),
          )
          .then((review) =>
            resolveVisualPrintings(review.choices, known, visualBudget, {
              online: typeof navigator === 'undefined' || navigator.onLine,
            }),
          )
          .catch(() => [] as PersonalCard[]),
        new Promise<PersonalCard[]>((resolve) => {
          if (visualBudget.aborted) resolve([]);
          else
            visualBudget.addEventListener('abort', () => resolve([]), {
              once: true,
            });
        }),
      ])
    : Promise.resolve([] as PersonalCard[]);
  const [catalog, fromVisual] = await Promise.all([
    discoverNumberedCards(text, preferredLanguage, signal),
    visualCards,
  ]);
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const all = [
    ...new Map(
      [...fromVisual, ...catalog, ...candidatesFromText(text, known)].map(
        (card) => [card.key, card],
      ),
    ).values(),
  ];
  // Partial numbers (e.g. '088' without '/063') cannot discard otherwise
  // valid image candidates or prove a printing by themselves.
  const number = recognitionClues(text)[0]?.number;
  const candidates = number?.includes('/')
    ? all.filter((card) => numberKey(card.number) === numberKey(number))
    : all;
  const exact = fuseScanEvidence(text, candidates, fromVisual, undefined, preferredLanguage);
  if (exact.suggested)
    return {
      candidates: exact.candidates,
      suggested: exact.suggested,
      basis: exact.basis,
      visualChecked: 0,
      visualModelCandidates: fromVisual.length,
    };
  // Lightweight artwork colour signatures can rank OCR candidates, but
  // neither cosine similarity nor a dominant colour margin proves a
  // particular language, collector number or foil.
  const appearanceSignal = AbortSignal.any([signal, AbortSignal.timeout(1800)]);
  const inspected = fromVisual.length
    ? []
    : await compareCandidateArtwork(
        photo,
        candidates.slice(0, 12),
        appearanceSignal,
      ).catch(() => []);
  const appearance = new Map(
    inspected.map((entry) => [entry.card.key, entry.similarity]),
  );
  const fused = fuseScanEvidence(
    text,
    candidates,
    fromVisual,
    appearance,
    preferredLanguage,
  );
  const ranked = fused.candidates;
  return {
    candidates: ranked.slice(0, 24),
    // Only a separate printed-identity match can suggest an exact
    // printing. Images alone cannot distinguish identical DE/EN artwork
    // or different foil treatments.
    basis: fromVisual.length
      ? 'visual-review'
      : candidates.length
        ? 'review'
        : 'no-match',
    visualChecked: fromVisual.length + inspected.length,
    visualModelCandidates: fromVisual.length,
  };
}
