import { afterEach, expect, it, vi } from 'vitest';
import { catalogSets } from '../../src/data/card-catalog';
import { verifiedLocalArt } from '../../src/data/verified-images';
import type { PersonalCard } from '../../src/domain/personal';

afterEach(() => vi.unstubAllGlobals());

it('only borrows an English set logo for the exact same German set ID', async () => {
  const fetcher = vi.fn().mockImplementation((url: string) => {
    const data = url.endsWith('/de/sets')
      ? [
          {
            id: 'me06',
            name: 'Delta-Herrschaft',
            cardCount: { official: 103, total: 141 },
          },
        ]
      : url.endsWith('/en/sets')
        ? [
            {
              id: 'me06',
              name: 'Delta Reign',
              logo: 'https://assets.tcgdex.net/en/me/me06/logo',
              cardCount: { official: 103, total: 141 },
            },
            {
              id: 'me05',
              name: 'Other Set',
              logo: 'https://assets.tcgdex.net/en/me/me05/logo',
              cardCount: { official: 120 },
            },
          ]
        : { id: 'tcgp', sets: [] };
    return Promise.resolve(new Response(JSON.stringify(data)));
  });
  vi.stubGlobal('fetch', fetcher);
  const sets = await catalogSets('de');
  expect(sets).toHaveLength(1);
  expect(sets[0]).toMatchObject({
    id: 'me06',
    name: 'Delta-Herrschaft',
    alias: 'Delta Reign',
    logo: 'https://assets.tcgdex.net/en/me/me06/logo',
    cardCount: { total: 141 },
  });
  expect(sets[0]?.logo).not.toContain('/me05/');
});

it('does not conflate a missing new-release image with a similarly named old printing', () => {
  const card: PersonalCard = {
    key: 'tcgdex:de:me06-138',
    source: 'tcgdex',
    sourceId: 'me06-138',
    setId: 'me06',
    setName: 'Delta-Herrschaft',
    name: 'Mega-Rayquaza-ex',
    number: '138/103',
    language: 'de',
    image: '',
    artist: '',
    artistSource: 'unknown',
    evolvesFrom: '',
    stage: '',
    finishes: ['holo'],
  };
  expect(verifiedLocalArt(card)).toBe('');
  expect(verifiedLocalArt({ ...card, sourceId: 'sv01-211' })).toBe('');
});
