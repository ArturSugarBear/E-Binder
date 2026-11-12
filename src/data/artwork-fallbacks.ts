import { japanesePrinting } from './japanese-catalog';
import { numberKey, type PersonalCard } from '../domain/personal';

type Art = { url: string; language: string; providerId: string };
type SetArt = {
  logo: string[];
  symbol: string[];
  cards?: string;
  placeholder?: string;
};
type Index = { version: number; sets: Record<string, SetArt> };
const requests = new Map<string, Promise<unknown>>();
function load(path: string): Promise<unknown> {
  if (!requests.has(path)) {
    requests.set(
      path,
      fetch(`${import.meta.env.BASE_URL}catalog-art/${path}`, {
        signal: AbortSignal.timeout(10000),
      })
        .then((r) => {
          if (!r.ok) throw new Error('Artwork index unavailable');
          return r.json();
        })
        .catch((error: unknown) => {
          requests.delete(path);
          throw error;
        }),
    );
  }
  return requests.get(path)!;
}
export function trustedArtwork(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      [
        'assets.tcgdex.net',
        'images.pokemontcg.io',
        'images.scrydex.com',
        'tcgplayer-cdn.tcgplayer.com',
      ].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
export async function secondaryCardArt(
  card: PersonalCard,
): Promise<Art | undefined> {
  if (card.language === 'ja') {
    try {
      const match = await japanesePrinting(card);
      if (match)
        return {
          url: `https://tcgplayer-cdn.tcgplayer.com/product/${match.productId}_in_1000x1000.jpg`,
          language: 'ja',
          providerId: String(match.productId),
        };
    } catch {
      /* Missing exact metadata cannot establish artwork identity. */
    }
    return;
  }
  if (
    card.source !== 'tcgdex' ||
    !['de', 'en'].includes(card.language) ||
    !/^[a-z0-9.+-]+$/i.test(card.setId)
  )
    return;
  const localId = card.sourceId.slice(card.setId.length + 1);
  if (
    !card.sourceId.startsWith(`${card.setId}-`) ||
    numberKey(localId) !== numberKey(card.number).split('/')[0]
  )
    return;
  try {
    const index = (await load('index.json')) as Index;
    if (!index.sets[card.setId]?.cards) return;
    const set = (await load(`${card.setId}.json`)) as {
      setId: string;
      cards: Record<string, Art | null>;
    };
    if (set.setId !== card.setId) return;
    const candidates = Object.entries(set.cards).filter(
      ([number]) => numberKey(number) === numberKey(localId),
    );
    const art = candidates.length === 1 ? candidates[0]![1] : null;
    if (art && art.language === 'en' && trustedArtwork(art.url)) return art;
  } catch {
    /* A provider outage must not prevent collecting. */
  }
}
export async function secondarySetArt(setId: string): Promise<string[]> {
  try {
    const index = (await load('index.json')) as Index;
    const set = index.sets[setId];
    if (!set) return [];
    // Generated neutral SVGs are not logos. The UI renders a branded,
    // accessible text identifier if no verified provider image exists.
    return [...set.logo, ...set.symbol].filter(trustedArtwork);
  } catch {
    return [];
  }
}
