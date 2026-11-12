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
