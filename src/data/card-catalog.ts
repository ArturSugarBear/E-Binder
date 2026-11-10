import { z } from 'zod';
import type { Collection } from '../domain/collection';
import { recognizedNameHints } from '../domain/recognition-names';
import {
  normalize,
  numberKey,
  personalCardSchema,
  type PersonalCard,
} from '../domain/personal';

const verified: Record<string, string> = {
  'svi-211': 'sv01/211',
  'svi-212': 'sv01/212',
  'svi-245': 'sv01/245',
  'obf-207': 'sv03/207',
  'obf-208': 'sv03/208',
  'obf-225': 'sv03/225',
  'pal-208': 'sv02/208',
  'pal-209': 'sv02/209',
  'pal-210': 'sv02/210',
};
const verifiedArtists: Record<string, string> = {
  'svi-211': 'Jiro Sasumo',
  'svi-212': 'Jiro Sasumo',
  'svi-245': 'Jiro Sasumo',
  'obf-207': 'Jerky',
  'obf-208': 'Jerky',
  'obf-225': 'Jerky',
  'pal-208': 'Tomokazu Komiya',
  'pal-209': 'Tomokazu Komiya',
  'pal-210': 'Tomokazu Komiya',
};
const setIds: Record<string, string> = {
  svi: 'sv01',
  pal: 'sv02',
  obf: 'sv03',
  par: 'sv04',
  tef: 'sv05',
  twm: 'sv06',
  scr: 'sv07',
  ssp: 'sv08',
  jtg: 'sv09',
  dri: 'sv10',
};
const evolution: Record<string, string> = {
  'svi-212': 'Trasla',
  'svi-245': 'Kirlia',
  'obf-208': 'Taubsi',
  'obf-225': 'Tauboga',
  'pal-209': 'Frospino',
  'pal-210': 'Cryospino',
};
export function editorialCards(collection: Collection): PersonalCard[] {
  return collection.flatMap((chapter) =>
    chapter.cards.map((card) => {
      const [prefix] = card.id.split('-');
      const setId = (prefix && setIds[prefix]) || '';
      const localId = card.number.split('/')[0]!;
      const externalId = setId ? `${setId}-${localId}` : '';
      const artist = card.facts.split('gezeichnet von ')[1]?.trim() ?? '';
      return personalCardSchema.parse({
        key: externalId ? `tcgdex:de:${externalId}` : `editorial:${card.id}`,
        name: card.name,
        setName: card.set,
        setId,
        number: card.number,
        language: card.id.startsWith('greninja-') ? 'en' : 'de',
        image: `assets/cards/${card.id}.webp`,
        source: 'editorial',
        sourceId: card.id,
        artist,
        artistSource:
          verified[card.id] &&
          normalize(artist) === normalize(verifiedArtists[card.id]!)
            ? 'publisher'
            : artist
              ? 'catalogue'
              : 'unknown',
        artistUrl:
          verified[card.id] &&
          normalize(artist) === normalize(verifiedArtists[card.id]!)
            ? `https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/series/${verified[card.id]}/`
            : undefined,
        evolvesFrom: evolution[card.id] ?? '',
        stage: '',
        finishes: ['holo', 'normal', 'reverse', 'other'],
      });
    }),
  );
}

export const resumeSchema = z.object({
  id: z.string().regex(/^[\w.+-]+$/),
  localId: z.string(),
  name: z.string(),
  image: z.string().optional(),
});
export type CatalogResult = z.infer<typeof resumeSchema> & {
  language: string;
  setName?: string;
  number?: string;
};
export interface CatalogFilters {
  setId?: string;
  artist?: string;
  rarity?: string;
  page?: number;
  order?: 'number' | 'name';
}
export interface MarketPrice {
  amount: number;
  updated: string;
}
export interface CatalogEntry {
  card: PersonalCard;
  rarity: string;
  price?: MarketPrice;
  holoPrice?: MarketPrice;
  cardmarketUrl?: string;
}
export const catalogSetSchema = z.object({
  id: z.string().regex(/^[\w.+-]+$/),
  name: z.string(),
  logo: z.string().optional(),
  symbol: z.string().optional(),
  cardCount: z.object({ official: z.number(), total: z.number().optional() }),
});
export type CatalogSet = z.infer<typeof catalogSetSchema> & { alias?: string };
const digitalSets = new Map<string, Set<string>>();
const publicCache = new Map<string, { until: number; data: unknown }>();
async function cachedJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const cached = publicCache.get(url);
  if (cached && cached.until > Date.now()) return cached.data;
  const data = await getJson(url, signal);
  if (publicCache.size > 1500)
    publicCache.delete(publicCache.keys().next().value!);
  publicCache.set(url, { until: Date.now() + 300000, data });
  return data;
}
function catalogLanguage(language: string): void {
  if (!['de', 'en', 'ja'].includes(language))
    throw new Error(
      'Die Online-Suche unterstützt Deutsch, Englisch und Japanisch.',
    );
}
export async function catalogSets(
  language: string,
  signal?: AbortSignal,
): Promise<CatalogSet[]> {
  catalogLanguage(language);
  const own = z
    .array(catalogSetSchema)
    .parse(
      await cachedJson(`https://api.tcgdex.net/v2/${language}/sets`, signal),
    );
  try {
    const digital = z
      .object({ id: z.literal('tcgp'), sets: z.array(catalogSetSchema) })
      .parse(
        await cachedJson(
          `https://api.tcgdex.net/v2/${language}/series/tcgp`,
          signal,
        ),
      );
    digitalSets.set(language, new Set(digital.sets.map((set) => set.id)));
  } catch {
    if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  }
  let english: z.infer<typeof catalogSetSchema>[] = [];
  if (language === 'de') {
    try {
      english = z
        .array(catalogSetSchema)
        .parse(await cachedJson('https://api.tcgdex.net/v2/en/sets', signal));
    } catch {
      if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    }
  }
  return own
    .filter((set) => !digitalSets.get(language)?.has(set.id))
    .map((set) => ({
      ...set,
      alias: english.find((other) => other.id === set.id)?.name,
    }));
}
const seriesSchema = z.object({
  id: z.string().regex(/^[\w.+-]+$/),
  name: z.string(),
});
export async function catalogSeries(
  language: string,
  signal?: AbortSignal,
): Promise<{ id: string; name: string }[]> {
  catalogLanguage(language);
  return z
    .array(seriesSchema)
    .parse(
      await cachedJson(`https://api.tcgdex.net/v2/${language}/series`, signal),
    )
    .filter((item) => item.id !== 'tcgp');
}
export async function catalogSeriesSets(
  id: string,
  language: string,
  signal?: AbortSignal,
): Promise<string[]> {
  catalogLanguage(language);
  if (!/^[\w.+-]+$/.test(id) || id === 'tcgp')
    throw new Error('Ungültige Kartenreihe.');
  const data = z
    .object({ id: z.literal(id), sets: z.array(catalogSetSchema) })
    .parse(
      await cachedJson(
        `https://api.tcgdex.net/v2/${language}/series/${encodeURIComponent(id)}`,
        signal,
      ),
    );
  return data.sets.map((item) => item.id);
}

export async function catalogValues(
  language: string,
  field: 'illustrators' | 'rarities',
  signal?: AbortSignal,
): Promise<string[]> {
  catalogLanguage(language);
  return z
    .array(z.string())
    .parse(
      await cachedJson(
        `https://api.tcgdex.net/v2/${language}/${field}`,
        signal,
      ),
    );
}
export function catalogResumeCard(result: CatalogResult): PersonalCard {
  const split = result.id.lastIndexOf('-');
  const setId = result.id.slice(0, split);
  return personalCardSchema.parse({
    key: `tcgdex:${result.language}:${result.id}`,
    name: result.name,
    setName: result.setName ?? 'Set wird geladen',
    setId,
    number: result.number ?? result.localId,
    language: result.language,
    image: result.image ? `${result.image}/high.webp` : '',
    source: 'tcgdex',
    sourceId: result.id,
    artist: '',
    artistSource: 'unknown',
    evolvesFrom: '',
    stage: '',
    finishes: ['normal', 'holo', 'reverse', 'other'],
  });
}
/** English previews are only paired by the exact provider printing ID and collector number. */
export async function fillCatalogImages(
  cards: CatalogResult[],
  signal?: AbortSignal,
): Promise<CatalogResult[]> {
  const missing = cards.filter((card) => !card.image && card.language === 'de');
  if (!missing.length) return cards;
  const params = new URLSearchParams({
    id: `eq:${missing.map((card) => card.id).join('|')}`,
    'pagination:page': '1',
    'pagination:itemsPerPage': String(missing.length),
  });
  try {
    const alternatives = z
      .array(resumeSchema)
      .parse(
        await cachedJson(
          `https://api.tcgdex.net/v2/en/cards?${params}`,
          signal,
        ),
      );
    return pairCatalogImages(cards, alternatives);
  } catch (error) {
    if (signal?.aborted) throw error;
    return cards;
  }
}
/** Preserve the requested printing/language; only replace artwork for an exact paired ID. */
function pairCatalogImages<T extends CatalogResult>(
  cards: T[],
  alternatives: Pick<CatalogResult, 'id' | 'localId' | 'image'>[],
): T[] {
  const byId = new Map(alternatives.map((card) => [card.id, card]));
  return cards.map((card) => {
    const match = byId.get(card.id);
    return card.language === 'de' &&
      !card.image &&
      match?.image &&
      numberKey(match.localId) === numberKey(card.localId)
      ? { ...card, image: match.image }
      : card;
  });
}
export function imageLanguage(image: string): string | undefined {
  try {
    const url = new URL(image);
    return url.hostname === 'assets.tcgdex.net'
      ? url.pathname.split('/')[1]
      : undefined;
  } catch {
    return undefined;
  }
}

const apiCardSchema = resumeSchema.extend({
  illustrator: z.string().optional(),
  evolveFrom: z.string().optional(),
  stage: z.string().optional(),
  rarity: z.string().optional(),
  pricing: z
    .object({
      cardmarket: z
        .object({
          unit: z.string().optional().catch(undefined),
          updated: z.string().optional().catch(undefined),
          trend: z.number().nullable().optional().catch(undefined),
          'trend-holo': z.number().nullable().optional().catch(undefined),
          idProduct: z
            .number()
            .int()
            .positive()
            .max(Number.MAX_SAFE_INTEGER)
            .optional()
            .catch(undefined),
        })
        .nullable()
        .optional(),
    })
    .nullish()
    .catch(undefined),
  set: z.object({
    id: z.string(),
    name: z.string(),
    cardCount: z.object({ official: z.number() }),
  }),
  variants: z
    .object({
      normal: z.boolean().optional(),
      holo: z.boolean().optional(),
      reverse: z.boolean().optional(),
    })
    .optional(),
});
async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? 'Diese Ausgabe ist im Katalog nicht verfügbar.'
        : 'Der Kartenkatalog ist gerade nicht erreichbar.',
    );
  return response.json();
}
export async function searchCatalog(
  query: string,
  language: string,
  signal?: AbortSignal,
  filters: CatalogFilters = {},
): Promise<CatalogResult[]> {
  if (!['de', 'en', 'ja'].includes(language))
    throw new Error(
      'Die Online-Suche unterstützt Deutsch, Englisch und Japanisch.',
    );
  const params = new URLSearchParams({
    'pagination:page': String(filters.page ?? 1),
    'pagination:itemsPerPage': '24',
    'sort:field': filters.order === 'name' ? 'name' : 'localId',
    'sort:order': 'ASC',
  });
  const numeric = query.trim().match(/^(\d{1,3})(?:\s*\/\s*\d{1,3})?$/);
  if (query.trim())
    params.set(
      numeric ? 'localId' : 'name',
      numeric ? `eq:${numeric[1]}` : query.trim().slice(0, 100),
    );
  if (filters.setId) params.set('set.id', `eq:${filters.setId}`);
  if (filters.artist) params.set('illustrator', `eq:${filters.artist}`);
  if (filters.rarity) params.set('rarity', `eq:${filters.rarity}`);
  const raw = await cachedJson(
    `https://api.tcgdex.net/v2/${language}/cards?${params}`,
    signal,
  );
  return z
    .array(resumeSchema)
    .parse(raw)
    .filter(
      (card) =>
        !digitalSets
          .get(language)
          ?.has(card.id.slice(0, card.id.lastIndexOf('-'))),
    )
    .map((card) => ({ ...card, language }));
}
export async function fetchCatalogCard(
  id: string,
  language: string,
  signal?: AbortSignal,
): Promise<PersonalCard> {
  if (!/^[\w.+-]+$/.test(id) || !['de', 'en', 'ja'].includes(language))
    throw new Error('Ungültige Katalogreferenz.');
  const raw = apiCardSchema.parse(
    await getJson(
      `https://api.tcgdex.net/v2/${language}/cards/${encodeURIComponent(id)}`,
      signal,
    ),
  );
  if (raw.id !== id)
    throw new Error(
      'Die Katalogantwort passt nicht zur angefragten Ausgabe. Bitte wähle die Karte erneut.',
    );
  return personalFromApi(raw, language);
}
function personalFromApi(
  raw: z.infer<typeof apiCardSchema>,
  language: string,
): PersonalCard {
  const finishes = (['normal', 'holo', 'reverse'] as const).filter(
    (finish) => raw.variants?.[finish],
  );
  const known = Object.entries(verified).find(
    ([, path]) => path.replace('/', '-') === raw.id,
  );
  const knownCredit =
    known &&
    raw.illustrator &&
    normalize(raw.illustrator) === normalize(verifiedArtists[known[0]]!)
      ? known[1]
      : undefined;
  return personalCardSchema.parse({
    key: `tcgdex:${language}:${raw.id}`,
    name: raw.name,
    setName: raw.set.name,
    setId: raw.set.id,
    number:
      raw.set.cardCount.official > 0
        ? `${raw.localId}/${raw.set.cardCount.official}`
        : raw.localId,
    language,
    image: raw.image ? `${raw.image}/high.webp` : '',
    source: 'tcgdex',
    sourceId: raw.id,
    artist: raw.illustrator ?? '',
    artistSource: knownCredit
      ? 'publisher'
      : raw.illustrator
        ? 'catalogue'
        : 'unknown',
    artistUrl: knownCredit
      ? `https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/series/${knownCredit}/`
      : undefined,
    evolvesFrom: raw.evolveFrom ?? '',
    stage: raw.stage ?? '',
    finishes: finishes.length
      ? finishes
      : ['normal', 'holo', 'reverse', 'other'],
  });
}
export async function catalogEntry(
  id: string,
  language: string,
  signal?: AbortSignal,
  imageFallback = true,
): Promise<CatalogEntry> {
  catalogLanguage(language);
  if (!/^[\w.+-]+$/.test(id)) throw new Error('Ungültige Katalogreferenz.');
  const raw = apiCardSchema.parse(
    await cachedJson(
      `https://api.tcgdex.net/v2/${language}/cards/${encodeURIComponent(id)}`,
      signal,
    ),
  );
  if (raw.id !== id)
    throw new Error('Die Katalogantwort passt nicht zur angefragten Ausgabe.');
  const card = personalFromApi(raw, language);
  if (imageFallback && !card.image && language === 'de') {
    const paired = await fillCatalogImages(
      [{ id: raw.id, localId: raw.localId, name: raw.name, language }],
      signal,
    );
    if (paired[0]?.image) card.image = `${paired[0].image}/high.webp`;
  }
  const quote = raw.pricing?.cardmarket;
  const price =
    quote?.unit === 'EUR' &&
    typeof quote.trend === 'number' &&
    quote.trend > 0 &&
    quote.updated &&
    Number.isFinite(Date.parse(quote.updated))
      ? { amount: quote.trend, updated: quote.updated }
      : undefined;
  const holoPrice =
    quote?.unit === 'EUR' &&
    typeof quote['trend-holo'] === 'number' &&
    quote['trend-holo'] > 0 &&
    quote.updated &&
    Number.isFinite(Date.parse(quote.updated))
      ? { amount: quote['trend-holo'], updated: quote.updated }
      : undefined;
  const cardmarketUrl = quote?.idProduct
    ? `https://www.cardmarket.com/en/Pokemon/Products?idProduct=${quote.idProduct}`
    : undefined;
  return {
    card,
    rarity: raw.rarity ?? '',
    price,
    holoPrice,
    cardmarketUrl,
  };
}
export async function catalogSetCards(
  id: string,
  language: string,
  signal?: AbortSignal,
): Promise<CatalogResult[]> {
  catalogLanguage(language);
  if (!/^[\w.+-]+$/.test(id)) throw new Error('Ungültiges Set.');
  const detail = catalogSetSchema
    .extend({ cards: z.array(resumeSchema) })
    .parse(
      await cachedJson(
        `https://api.tcgdex.net/v2/${language}/sets/${encodeURIComponent(id)}`,
        signal,
      ),
    );
  if (detail.id !== id)
    throw new Error('Die Setantwort passt nicht zur Anfrage.');
  return detail.cards.map((card) => ({
    ...card,
    language,
    setName: detail.name,
    number: detail.cardCount.official
      ? `${card.localId}/${detail.cardCount.official}`
      : card.localId,
  }));
}

export function matchesCard(card: PersonalCard, query: string): boolean {
  const value = normalize(query);
  return (
    !value ||
    [card.name, card.setName, card.number, card.artist, card.sourceId].some(
      (field) => normalize(field).includes(value),
    )
  );
}

export function candidatesFromText(
  text: string,
  catalog: PersonalCard[],
): PersonalCard[] {
  const normalizedText = normalize(text);
  const clues = recognitionClues(text);
  const numbers = clues.map((clue) => clue.number);
  const printedSet = clues.find((clue) => clue.setId)?.setId;
  const ranked = catalog.map((card) => {
    const name = normalize(card.name.replace(/[- ]?ex$/i, ''));
    const number = numbers.includes(numberKey(card.number));
    const nameMatch = name.length >= 4 && normalizedText.includes(name);
    return {
      card,
      score:
        (number ? 8 : 0) +
        (number && printedSet === card.setId ? 4 : 0) +
        (nameMatch ? 2 : 0),
    };
  });
  return ranked
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((item) => item.card);
}

export interface RecognitionClue {
  number: string;
  setId?: string;
  language?: 'de' | 'en';
  observations: number;
}
/** Printed codes narrow candidates; an OCR string never confirms ownership. */
export function recognitionClues(text: string): RecognitionClue[] {
  const code = text.match(
    /(?:^|[^A-Z])(?:[A-I])?(SVI|PAL|OBF|0BF|PAR|TEF|TWM|SCR|SSP|JTG|DRI)\s*(DE|EN)?(?=[^A-Z]|$)/i,
  );
  const setId = code
    ? setIds[code[1]!.toLowerCase().replace(/^0bf$/, 'obf')]
    : undefined;
  const language = code?.[2]?.toLowerCase() as 'de' | 'en' | undefined;
  const counts = new Map<string, number>();
  for (const match of text.matchAll(
    /(?<![0-9])((?:TG|GG|RC|SV)?[0-9OIl]{1,3})\s*[/|]\s*((?:TG|GG|RC|SV)?[0-9OIl]{1,3})\b/gi,
  )) {
    const fix = (part: string) =>
      part.replace(/^[0-9OIl]+$/i, (value) =>
        value.replace(/O/gi, '0').replace(/[Il]/gi, '1'),
      );
    const number = numberKey(`${fix(match[1]!)}/${fix(match[2]!)}`);
    if (number.split('/').some((part) => part === '0')) continue;
    counts.set(number, (counts.get(number) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([number, observations]) => ({
      number,
      setId,
      language,
      observations,
    }));
}
/**
 * Number-band OCR sometimes reads only half of a collector fraction.
 * Such fragments may reorder visual candidates, never verify a printing.
 */
export function visualNumberClues(text: string): RecognitionClue[] {
  const complete = recognitionClues(text);
  if (complete.length) return complete;
  const counts = new Map<string, number>();
  for (const match of text.matchAll(
    /(?<![A-Za-z0-9])(?:TG|GG|RC|SV)?([0-9OIl]{2,3})(?![A-Za-z0-9])/gi,
  )) {
    const value = match[1]!.replace(/O/gi, '0').replace(/[Il]/g, '1');
    const part = numberKey(value);
    if (part === '0') continue;
    counts.set(part, (counts.get(part) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([number, observations]) => ({ number, observations }));
}
const setResume = z.object({
  id: z.string(),
  cardCount: z.object({ official: z.number() }),
});
const setDetails = z.object({ cards: z.array(resumeSchema) });
const setCache = new Map<
  string,
  { until: number; sets: z.infer<typeof setResume>[] }
>();
async function setsFor(language: string, signal?: AbortSignal) {
  const cached = setCache.get(language);
  if (cached && cached.until > Date.now()) return cached.sets;
  const sets = z
    .array(setResume)
    .parse(await getJson(`https://api.tcgdex.net/v2/${language}/sets`, signal));
  setCache.set(language, { sets, until: Date.now() + 300000 });
  return sets;
}
export async function fetchRecognizedCards(
  text: string,
  fallbackLanguage: string,
  signal?: AbortSignal,
): Promise<PersonalCard[]> {
  signal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(25000)])
    : AbortSignal.timeout(25000);
  if (!['de', 'en', 'ja'].includes(fallbackLanguage))
    throw new Error('Ungültige Katalogsprache.');
  const results = await Promise.allSettled(
    recognitionClues(text).map(async (clue) => {
      const language = clue.language ?? fallbackLanguage;
      const [number, total] = clue.number.split('/');
      if (clue.setId && language !== 'ja') {
        const card = await fetchCatalogCard(
          `${clue.setId}-${number}`,
          language,
          signal,
        );
        return numberKey(card.number) === clue.number ? [card] : [];
      }
      // Old frames and Japanese prints have different set codes. Match actual set counts and local IDs.
      const sets = (await setsFor(language, signal)).filter(
        (set) => String(set.cardCount.official) === total,
      );
      const matches: PersonalCard[] = [];
      // shortcut: cap ambiguous denominators at eight sets, use manual search for broader matches.
      for (const set of sets.slice(0, 8)) {
        const detail = setDetails.parse(
          await getJson(
            `https://api.tcgdex.net/v2/${language}/sets/${encodeURIComponent(set.id)}`,
            signal,
          ),
        );
        const resume = detail.cards.find(
          (card) => numberKey(card.localId) === number,
        );
        if (resume) {
          const card = await fetchCatalogCard(resume.id, language, signal);
          if (numberKey(card.number) === clue.number) matches.push(card);
        }
      }
      return matches;
    }),
  );
  const candidates = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (!candidates.length && failure?.status === 'rejected')
    throw failure.reason;
  return candidates;
}

/**
 * When the collector fraction is illegible, search by the OCR title only.
 * These are unverified candidates: a name (especially "Energie") never proves
 * a particular set, language, finish or owned copy.
 *
 * Keep API work bounded; the scanner has up to nine pockets per page.
 */
export async function fetchNameHintCandidates(
  text: string,
  language: string,
  signal?: AbortSignal,
): Promise<{ query: string; candidates: PersonalCard[] }> {
  const query = recognizedNameHints(text)[0] ?? '';
  if (!query || !['de', 'en', 'ja'].includes(language))
    return { query, candidates: [] };
  const searchSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
    : AbortSignal.timeout(10000);
  const names = await searchCatalog(query, language, searchSignal);
  const normalized = normalize(query);
  const matching = names
    .filter((item) => normalize(item.name).includes(normalized))
    .slice(0, 6);
  const checked = await Promise.allSettled(
    matching.map((item) => fetchCatalogCard(item.id, language, searchSignal)),
  );
  return {
    query,
    candidates: checked.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    ),
  };
}

/** One text-only request for complete set facets, independent of the visible result page. */
export async function catalogSetFacets(
  id: string,
  language: string,
  signal?: AbortSignal,
): Promise<{ cards: (CatalogResult & { rarity: string; artist: string })[] }> {
  catalogLanguage(language);
  if (!/^[\w.+-]+$/.test(id)) throw new Error('Ungültiges Set.');
  const key = `set-facets:${language}:${id}`;
  const cached = publicCache.get(key);
  let json: unknown;
  if (cached && cached.until > Date.now()) json = cached.data;
  else {
    const response = await fetch('https://api.tcgdex.net/v2/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      body: JSON.stringify({
        query: `query SetFacets($set: ID!, $prefix: ID!, $lang: String!) {
          set(id: $set) @locale(lang: $lang) { id name cardCount { official } cards { id } }
          cards(filters: { id: $prefix }) @locale(lang: $lang) {
            id localId name image rarity illustrator set { id }
          }
        }`,
        variables: { set: id, prefix: `like:${id}-*`, lang: language },
      }),
    });
    if (!response.ok)
      throw new Error('Die Filter dieses Sets konnten nicht geladen werden.');
    json = await response.json();
  }
  const result = z
    .object({
      errors: z.array(z.unknown()).optional(),
      data: z.object({
        set: z.object({
          id: z.literal(id),
          name: z.string(),
          cardCount: z.object({ official: z.number() }),
          cards: z.array(z.object({ id: z.string() })),
        }),
        cards: z.array(
          z.object({
            id: resumeSchema.shape.id,
            localId: z.string(),
            name: z.string(),
            image: z.string().nullish(),
            rarity: z.string().nullish(),
            illustrator: z.string().nullish(),
            set: z.object({ id: resumeSchema.shape.id }),
          }),
        ),
      }),
    })
    .safeParse(json);
  if (!result.success || result.data.errors?.length)
    throw new Error(
      'Die Filter dieses Sets konnten nicht vollständig geprüft werden. Versuche es erneut.',
    );
  const data = result.data.data;
  // Prefixes such as 30th-* also return 30th-c-*; exact set membership is authoritative.
  const cards = data.cards.filter((card) => card.set.id === id);
  const expected = new Set(data.set.cards.map((card) => card.id));
  const actual = new Set(cards.map((card) => card.id));
  if (
    expected.size !== data.set.cards.length ||
    actual.size !== cards.length ||
    expected.size !== actual.size ||
    [...expected].some((card) => !actual.has(card))
  )
    throw new Error(
      'Die Filter dieses Sets sind noch unvollständig. Versuche es erneut.',
    );
  // Only validated, complete metadata enters the bounded public in-memory cache.
  if (publicCache.size > 1500)
    publicCache.delete(publicCache.keys().next().value!);
  publicCache.set(key, { until: Date.now() + 300000, data: json });
  let previews: (CatalogResult & { rarity: string; artist: string })[] =
    cards.map((card) => ({
      id: card.id,
      localId: card.localId,
      name: card.name,
      image: card.image ?? undefined,
      language,
      setName: data.set.name,
      number: data.set.cardCount.official
        ? `${card.localId}/${data.set.cardCount.official}`
        : card.localId,
      rarity: card.rarity ?? '',
      artist: card.illustrator ?? '',
    }));
  if (language === 'de' && previews.some((card) => !card.image)) {
    try {
      const alternatives = await catalogSetCards(id, 'en', signal);
      previews = pairCatalogImages(previews, alternatives);
    } catch (error) {
      if (signal?.aborted) throw error;
      // Missing source images never change the requested card edition or language.
    }
  }
  return { cards: previews };
}
