import { secondaryCardArt } from './artwork-fallbacks';
import { priceLooksMisassigned } from '../domain/price-integrity';
import { verifiedCardmarketProduct } from './verified-cardmarket';
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
const canonicalGermanSetNames: Record<string, string> = {
  'swsh12.5': 'Zenit der Könige',
  'swsh12.5gg': 'Zenit der Könige Galar-Galerie',
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
  // Printed set codes differ from the TCGdex catalogue IDs.
  pbl: 'me05', // Dunkelnacht / Pitch Black (084 cards in the main set)
  dlr: 'me06', // Delta-Herrschaft / Delta Reign (103 main-set cards)
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
  basis?: 'trend' | 'avg7' | 'avg30' | 'avg';
  provenance?: 'verified-snapshot';
}
export interface CatalogEntry {
  card: PersonalCard;
  rarity: string;
  price?: MarketPrice;
  holoPrice?: MarketPrice;
  cardmarketUrl?: string;
  priceIssue?: 'suspect';
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
    .map((set) => {
      const paired = english.find((other) => other.id === set.id);
      return {
        ...set,
        // A set logo/symbol may be shared across languages for the SAME set,
        // never across sets with similar names or artwork.
        logo: set.logo || paired?.logo,
        symbol: set.symbol || paired?.symbol,
        alias: paired?.name,
      };
    });
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
function exactGalleryArtwork(
  id: string,
  localId: string,
  language: string,
  image?: string,
): string | undefined {
  // In TCGdex this gallery's images share the *same* numbered parent
  // folder. This maps the exact GG printing, not a similarly named card.
  if (id.startsWith('swsh12.5gg-GG') && /^GG\d{1,2}$/i.test(localId))
    return `https://assets.tcgdex.net/${language}/swsh/swsh12.5/${localId}`;
  return image;
}

export function catalogArtworkUrl(url?: string): string {
  if (!url) return '';
  return /\.(webp|png|jpe?g)(?:\?|$)/i.test(url) ||
    url.includes('images.scrydex.com/')
    ? url
    : `${url}/high.webp`;
}
async function completeArtwork<T extends CatalogResult>(
  cards: T[],
): Promise<T[]> {
  return Promise.all(
    cards.map(async (card) => {
      if (card.image) return card;
      const fallback = await secondaryCardArt(catalogResumeCard(card));
      return fallback ? { ...card, image: fallback.url } : card;
    }),
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
    image: catalogArtworkUrl(
      exactGalleryArtwork(
        result.id,
        result.localId,
        result.language,
        result.image,
      ),
    ),
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
  const exact = cards.map((card) => ({
    ...card,
    image: exactGalleryArtwork(
      card.id,
      card.localId,
      card.language,
      card.image,
    ),
  }));
  const missing = exact.filter((card) => !card.image && card.language === 'de');
  if (!missing.length) return completeArtwork(exact);
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
    return completeArtwork(pairCatalogImages(exact, alternatives));
  } catch (error) {
    if (signal?.aborted) throw error;
    return completeArtwork(exact);
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
    if (['images.pokemontcg.io', 'images.scrydex.com'].includes(url.hostname))
      return 'en';
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
          updated: z
            .union([z.string(), z.number()])
            .optional()
            .catch(undefined),
          trend: z.number().nullable().optional().catch(undefined),
          'trend-holo': z.number().nullable().optional().catch(undefined),
          avg: z.number().nullable().optional().catch(undefined),
          'avg-holo': z.number().nullable().optional().catch(undefined),
          avg7: z.number().nullable().optional().catch(undefined),
          'avg7-holo': z.number().nullable().optional().catch(undefined),
          avg30: z.number().nullable().optional().catch(undefined),
          'avg30-holo': z.number().nullable().optional().catch(undefined),
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
      tcgplayer: z
        .object({
          normal: z
            .object({ marketPrice: z.number().nullable().optional() })
            .optional(),
          holofoil: z
            .object({ marketPrice: z.number().nullable().optional() })
            .optional(),
        })
        .passthrough()
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
    setName:
      language === 'de'
        ? (canonicalGermanSetNames[raw.set.id] ?? raw.set.name)
        : raw.set.name,
    setId: raw.set.id,
    number:
      raw.set.cardCount.official > 0
        ? `${raw.localId}/${raw.set.cardCount.official}`
        : raw.localId,
    language,
    // TCGdex's Galarian Gallery artwork lives in the parent Crown Zenith
    // asset directory, even though its physical set ID is swsh12.5gg.
    // The printed GG number is unchanged: never use another card's artwork.
    image: exactGalleryArtwork(raw.id, raw.localId, language, raw.image)
      ? `${exactGalleryArtwork(raw.id, raw.localId, language, raw.image)}/high.webp`
      : '',
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
/**
 * Upstream can accidentally assign the cheap base card's Cardmarket product
 * ID to an illustration/secret print of the same Pokémon in the same set.
 * Verify the sibling product mapping before publishing a secret-print quote.
 * A catalogue outage cannot establish a match and must not invent one.
 */
async function hasSiblingCardmarketCollision(
  card: z.infer<typeof apiCardSchema>,
  language: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const productId = card.pricing?.cardmarket?.idProduct;
  if (
    !productId ||
    !/^\d+$/.test(card.localId) ||
    Number(card.localId) <= card.set.cardCount.official
  )
    return false;
  try {
    const cards = await catalogSetCards(card.set.id, language, signal);
    const siblings = cards
      .filter(
        (candidate) =>
          candidate.id !== card.id &&
          normalize(candidate.name) === normalize(card.name),
      )
      .slice(0, 8);
    const matches = await Promise.allSettled(
      siblings.map(async (candidate) =>
        apiCardSchema.parse(
          await cachedJson(
            `https://api.tcgdex.net/v2/${language}/cards/${encodeURIComponent(candidate.id)}`,
            signal,
          ),
        ),
      ),
    );
    return matches.some(
      (result) =>
        result.status === 'fulfilled' &&
        result.value.id !== card.id &&
        result.value.pricing?.cardmarket?.idProduct === productId,
    );
  } catch {
    return false;
  }
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
    if (paired[0]?.image) card.image = catalogArtworkUrl(paired[0].image);
  }
  const quote = raw.pricing?.cardmarket;
  const updated =
    typeof quote?.updated === 'number'
      ? new Date(
          quote.updated < 1e12 ? quote.updated * 1000 : quote.updated,
        ).toISOString()
      : quote?.updated;
  const bestQuote = (foil: boolean): MarketPrice | undefined => {
    if (
      quote?.unit !== 'EUR' ||
      !updated ||
      !Number.isFinite(Date.parse(updated)) ||
      Date.parse(updated) > Date.now()
    )
      return undefined;
    // All choices originate from the exact Cardmarket product and the
    // requested foil family. Never use normal averages as holo prices.
    for (const basis of ['trend', 'avg7', 'avg30', 'avg'] as const) {
      const key = foil ? `${basis}-holo` : basis;
      const amount = quote[key as keyof typeof quote];
      if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0)
        return { amount, updated, basis };
    }
    return undefined;
  };
  const candidate = bestQuote(false);
  const dollarMarket =
    raw.variants?.holo && raw.variants.normal === false
      ? raw.pricing?.tcgplayer?.holofoil?.marketPrice
      : raw.pricing?.tcgplayer?.normal?.marketPrice;

  const verified = verifiedCardmarketProduct({
    id: raw.id,
    setId: raw.set.id,
    localId: raw.localId,
    officialCount: raw.set.cardCount.official,
    name: raw.name,
    language,
    normal: raw.variants?.normal,
  });
  // A correct printing-to-product ID is a separate assertion from a
  // plausible numerical price. The provider currently maps Groudon DLR111
  // to the cheap DLR053 product (918876 vs the verified 918949).
  const wrongProduct = Boolean(
    verified && quote?.idProduct !== verified.productId,
  );
  const suspect =
    candidate !== undefined &&
    (wrongProduct ||
      priceLooksMisassigned({
        localId: raw.localId,
        setOfficialCount: raw.set.cardCount.official,
        amountEur: candidate.amount,
        tcgplayerMarketUsd: dollarMarket ?? undefined,
      }) ||
      (!verified &&
        (await hasSiblingCardmarketCollision(raw, language, signal))));

  // A verified and dated source can replace the rejected mismapped feed
  // without permitting the false upstream product or its cent prices.
  // Once the observation expires, retain the correct product link but
  // withhold its market value until new independent data are verified.
  const price: MarketPrice | undefined =
    !suspect && !wrongProduct && candidate ? candidate : verified?.observation;
  // Cardmarket's secondary "-holo" series can represent reverse foil.
  // Never use it to value a regular card or a verified normal-only print.
  const holoPrice =
    raw.variants?.holo === true && raw.variants.normal === false
      ? price
      : undefined;
  const cardmarketUrl =
    verified?.url ??
    (!suspect && !wrongProduct && quote?.idProduct
      ? `https://www.cardmarket.com/en/Pokemon/Products?idProduct=${quote.idProduct}`
      : undefined);
  return {
    card,
    rarity: raw.rarity ?? '',
    price,
    holoPrice,
    cardmarketUrl,
    priceIssue: (suspect || wrongProduct) && !price ? 'suspect' : undefined,
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
  language?: 'de' | 'en' | 'ja';
  observations: number;
}
/** Printed codes narrow candidates; an OCR string never confirms ownership. */
export function recognitionClues(text: string): RecognitionClue[] {
  const code = text.match(
    /(?:^|[^A-Z])(?:[A-I])?(SVI|PAL|OBF|0BF|PAR|TEF|TWM|SCR|SSP|JTG|DRI|PBL|DLR)\s*(DE|EN)?(?=[^A-Z]|$)/i,
  );
  // Japanese set identifiers (e.g. M2a, SV8a, S12a) can be read even
  // when the current Latin OCR cannot transcribe the Japanese card title.
  // The set code is only a clue, never sufficient evidence on its own.
  const japaneseCode = text.match(
    /(?:^|[^A-Za-z0-9])((?:SV|SM|XY|BW|S|M)\d{1,2}[a-z]?)(?![A-Za-z0-9])/i,
  );
  const setId = code
    ? setIds[code[1]!.toLowerCase().replace(/^0bf$/, 'obf')]
    : japaneseCode?.[1]?.replace(/^[a-z]+/i, (prefix) => prefix.toUpperCase());
  const language: 'de' | 'en' | 'ja' | undefined =
    (code?.[2]?.toLowerCase() as 'de' | 'en' | undefined) ??
    (japaneseCode ? 'ja' : undefined);
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
      if (clue.setId) {
        // A printed 089/084 is stored as me05-089, not me05-89.
        // Resolve the actual TCGdex ID from the set manifest instead of
        // constructing an unpadded ID from the normalized OCR fraction.
        const editions = await catalogSetCards(clue.setId, language, signal);
        const exact = editions.find(
          (entry) => numberKey(entry.localId) === number,
        );
        if (!exact) return [];
        const card = await fetchCatalogCard(exact.id, language, signal);
        return numberKey(card.number) === clue.number ? [card] : [];
      }
      // Old frames and Japanese prints have different set codes. Match actual set counts and local IDs.
      const sets = (await setsFor(language, signal))
        .filter((set) => String(set.cardCount.official) === total)
        // Set lists contain decades of printings. Prioritize recent sets
        // rather than arbitrarily taking the provider's first eight results.
        // This only orders review candidates; it never confirms ownership.
        .sort((a, b) => {
          const recency = (id: string) => {
            const match = id.toLowerCase().match(/^(me|sv|swsh|sm)(\d+)/);
            if (!match) return 0;
            const era = { me: 4, sv: 3, swsh: 2, sm: 1 }[
              match[1] as 'me' | 'sv' | 'swsh' | 'sm'
            ];
            return era * 1000 + Number(match[2]);
          };
          return recency(b.id) - recency(a.id);
        });
      const matches: PersonalCard[] = [];
      // Cap ambiguous denominators at eight sets; no name-only guess becomes
      // an accepted printing, and older sets remain searchable manually.
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
  return { cards: await completeArtwork(previews) };
}
