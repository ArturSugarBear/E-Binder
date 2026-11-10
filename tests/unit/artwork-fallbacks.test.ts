import { afterEach, expect, it, vi } from 'vitest';
import type { PersonalCard } from '../../src/domain/personal';
afterEach(() => vi.unstubAllGlobals());
const card = {
  source: 'tcgdex',
  setId: 'sv01',
  sourceId: 'sv01-001',
  number: '001/198',
  language: 'de',
} as PersonalCard;
it('pairs only exact set and collector number and coalesces repeated requests', async () => {
  vi.resetModules();
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('index.json')
            ? { version: 1, sets: { sv01: { cards: 'sv01.json' } } }
            : {
                setId: 'sv01',
                cards: {
                  '1': {
                    url: 'https://images.pokemontcg.io/sv1/1_hires.png',
                    language: 'en',
                    providerId: 'sv1-1',
                  },
                },
              },
        ),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  const { secondaryCardArt } = await import('../../src/data/artwork-fallbacks');
  const result = await Promise.all([
    secondaryCardArt(card),
    secondaryCardArt(card),
  ]);
  expect(result[0]?.url).toBe('https://images.pokemontcg.io/sv1/1_hires.png');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(
    await secondaryCardArt({ ...card, number: '002/198' }),
  ).toBeUndefined();
  expect(await secondaryCardArt({ ...card, language: 'ja' })).toBeUndefined();
});
it('rejects arbitrary hosts and ambiguous collector numbers', async () => {
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith('index.json')
              ? { version: 1, sets: { sv01: { cards: 'sv01.json' } } }
              : {
                  setId: 'sv01',
                  cards: {
                    '1': {
                      url: 'https://evil.example/art.jpg',
                      language: 'en',
                    },
                  },
                },
          ),
        ),
    ),
  );
  const { secondaryCardArt, trustedArtwork } =
    await import('../../src/data/artwork-fallbacks');
  expect(await secondaryCardArt(card)).toBeUndefined();
  expect(trustedArtwork('http://images.pokemontcg.io/sv1/1.png')).toBe(false);
  expect(
    trustedArtwork('https://images.pokemontcg.io.evil.example/a.png'),
  ).toBe(false);
});
