import { expect, it } from 'vitest';
import { verifiedLocalArt } from '../../src/data/verified-images';
import type { PersonalCard } from '../../src/domain/personal';

const card: PersonalCard = {
  key: 'tcgdex:de:sv01-211',
  source: 'tcgdex',
  sourceId: 'sv01-211',
  name: 'Trasla',
  setName: 'Karmesin & Purpur',
  setId: 'sv01',
  number: '211/198',
  language: 'de',
  image: '',
  artist: '',
  artistSource: 'unknown',
  evolvesFrom: '',
  stage: '',
  finishes: ['normal'],
};

it('uses only verified, already-bundled artwork for the exact printed card', () => {
  expect(verifiedLocalArt(card)).toBe('assets/cards/svi-211.webp');
  expect(verifiedLocalArt({ ...card, number: '0211/198' })).toBe(
    'assets/cards/svi-211.webp',
  );
});

it('never substitutes wrong set, number, language, source or an existing catalog image', () => {
  expect(verifiedLocalArt({ ...card, setId: 'sv02' })).toBe('');
  expect(verifiedLocalArt({ ...card, number: '212/198' })).toBe('');
  expect(verifiedLocalArt({ ...card, language: 'en' })).toBe('');
  expect(verifiedLocalArt({ ...card, source: 'manual' })).toBe('');
  expect(
    verifiedLocalArt({ ...card, image: 'https://assets.tcgdex.net/de/sv/sv01/211/high.webp' }),
  ).toBe('');
  expect(verifiedLocalArt({ ...card, sourceId: 'sv01-999' })).toBe('');
});
