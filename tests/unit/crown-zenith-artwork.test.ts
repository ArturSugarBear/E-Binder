import { expect, it } from 'vitest';
import {
  catalogResumeCard,
  fillCatalogImages,
} from '../../src/data/card-catalog';

it('renders Crown Zenith Galarian Gallery images from the exact GG print path', async () => {
  const result = {
    id: 'swsh12.5gg-GG69',
    localId: 'GG69',
    name: 'Giratina VSTAR',
    language: 'de',
    image: 'https://assets.tcgdex.net/de/swsh/swsh12.5gg/GG69',
  };
  const card = catalogResumeCard(result);
  expect(card.sourceId).toBe('swsh12.5gg-GG69');
  expect(card.setId).toBe('swsh12.5gg');
  expect(card.image).toBe(
    'https://assets.tcgdex.net/de/swsh/swsh12.5/GG69/high.webp',
  );
  const filled = await fillCatalogImages([{ ...result, image: undefined }]);
  expect(filled[0]?.image).toBe(
    'https://assets.tcgdex.net/de/swsh/swsh12.5/GG69',
  );
});

it('never uses a Galarian Gallery image for another physical set', () => {
  const card = catalogResumeCard({
    id: 'swsh12.5-GG69',
    localId: 'GG69',
    name: 'Testkarte',
    language: 'de',
    image: 'https://assets.tcgdex.net/de/swsh/swsh12.5/GG69',
  });
  expect(card.setId).toBe('swsh12.5');
  expect(card.image).toBe(
    'https://assets.tcgdex.net/de/swsh/swsh12.5/GG69/high.webp',
  );
});
