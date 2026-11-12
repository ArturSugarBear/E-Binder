import { afterEach, expect, it, vi } from 'vitest';
import { CardImages } from '../../src/data/card-images';
import type { PersonalStore } from '../../src/data/personal-store';
import type { PersonalCard } from '../../src/domain/personal';

afterEach(() => vi.unstubAllGlobals());

it('shares concurrent exact-print image lookups while keeping languages separate', async () => {
  const fetch = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify({
          id: 'sv01-081',
          localId: '081',
          name: 'Testkarte',
          image: `https://assets.tcgdex.net/${url.includes('/de/') ? 'de' : 'en'}/sv/sv01/081`,
          set: {
            id: 'sv01',
            name: 'Karmesin & Purpur',
            cardCount: { official: 198 },
          },
          variants: { normal: true },
        }),
      ),
  );
  vi.stubGlobal('fetch', fetch);
  const card: PersonalCard = {
    key: 'tcgdex:de:sv01-081',
    source: 'tcgdex',
    sourceId: 'sv01-081',
    setId: 'sv01',
    setName: 'Karmesin & Purpur',
    number: '081/198',
    language: 'de',
    name: 'Testkarte',
    image: '',
    artist: '',
    artistSource: 'unknown',
    evolvesFrom: '',
    stage: '',
    finishes: ['normal'],
  };
  const images = new CardImages({} as PersonalStore, () => 'personal');
  const urls = await Promise.all([
    images.url(card),
    images.url(card),
    images.url(card),
  ]);
  expect(new Set(urls)).toEqual(
    new Set(['https://assets.tcgdex.net/de/sv/sv01/081/high.webp']),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    await images.url({ ...card, key: 'tcgdex:en:sv01-081', language: 'en' }),
  ).toContain('/en/');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('rejects stored images pointing to another set, number or Japanese/Western printing', async () => {
  const { exactPrimaryArtwork } = await import('../../src/data/card-images');
  const card = {
    sourceId: 'sv01-081',
    setId: 'sv01',
    number: '081/198',
    language: 'de',
    image: 'https://assets.tcgdex.net/en/sv/sv01/081/high.webp',
  } as PersonalCard;
  expect(exactPrimaryArtwork(card)).toBe(true);
  expect(
    exactPrimaryArtwork({
      ...card,
      image: 'https://assets.tcgdex.net/en/sv/sv01/082/high.webp',
    }),
  ).toBe(false);
  expect(
    exactPrimaryArtwork({
      ...card,
      image: 'https://assets.tcgdex.net/en/sv/sv02/081/high.webp',
    }),
  ).toBe(false);
  expect(exactPrimaryArtwork({ ...card, language: 'ja' })).toBe(false);
});
