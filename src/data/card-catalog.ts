import { z } from 'zod';
import type { Collection } from '../domain/collection';
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

const resumeSchema = z.object({
  id: z.string().regex(/^[\w.-]+$/),
  localId: z.string(),
  name: z.string(),
  image: z.string().optional(),
});
export type CatalogResult = z.infer<typeof resumeSchema> & { language: string };
const apiCardSchema = resumeSchema.extend({
  illustrator: z.string().optional(),
  evolveFrom: z.string().optional(),
  stage: z.string().optional(),
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
): Promise<CatalogResult[]> {
  if (!['de', 'en'].includes(language))
    throw new Error('Die Online-Suche unterstützt hier Deutsch und Englisch.');
  const params = new URLSearchParams({
    'pagination:page': '1',
    'pagination:itemsPerPage': '48',
  });
  const numeric = query.trim().match(/^(\d{1,3})(?:\s*\/\s*\d{1,3})?$/);
  params.set(
    numeric ? 'localId' : 'name',
    numeric ? `eq:${numeric[1]}` : query.trim().slice(0, 100),
  );
  const raw = await getJson(
    `https://api.tcgdex.net/v2/${language}/cards?${params}`,
    signal,
  );
  return z
    .array(resumeSchema)
    .parse(raw)
    .map((card) => ({ ...card, language }));
}
export async function fetchCatalogCard(
  id: string,
  language: string,
  signal?: AbortSignal,
): Promise<PersonalCard> {
  if (!/^[\w.-]+$/.test(id) || !['de', 'en'].includes(language))
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
export async function fetchRecognizedCards(
  text: string,
  fallbackLanguage: string,
  signal?: AbortSignal,
): Promise<PersonalCard[]> {
  const results = await Promise.allSettled(
    recognitionClues(text).map(async (clue) => {
      if (!clue.setId) return undefined;
      const number = clue.number.split('/')[0]!;
      if (!/^\d+$/.test(number)) return undefined;
      const card = await fetchCatalogCard(
        `${clue.setId}-${number}`,
        clue.language ?? fallbackLanguage,
        signal,
      );
      return numberKey(card.number) === clue.number ? card : undefined;
    }),
  );
  const candidates = results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (!candidates.length && failure?.status === 'rejected')
    throw failure.reason;
  return candidates;
}
