import { readFile, stat } from 'node:fs/promises';
import { parseCollection } from '../src/domain/collection';

const collection = parseCollection(
  JSON.parse(await readFile('public/collection.json', 'utf8')),
);
const ids = new Set(
  collection.flatMap((chapter) => chapter.cards.map((card) => card.id)),
);
await Promise.all(
  [...ids].map(async (id) => {
    const path = `public/assets/cards/${id}.webp`;
    const file = await stat(path);
    if (!file.isFile() || file.size === 0)
      throw new Error(`Missing image: ${path}`);
    const header = await readFile(path);
    if (
      header.toString('ascii', 0, 4) !== 'RIFF' ||
      header.toString('ascii', 8, 12) !== 'WEBP'
    ) {
      throw new Error(`Invalid WebP: ${path}`);
    }
  }),
);
console.log(
  `Validated ${collection.length} chapters, ${ids.size} images and all Cardmarket URLs.`,
);
