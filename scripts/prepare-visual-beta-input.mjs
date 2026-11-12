#!/usr/bin/env node
/**
 * Beta-only, deliberately small corpus from the project's already bundled,
 * exact-print checked illustrations. Never infer printings by names, number
 * alone, or downloaded third-party artwork. No donor photos are read.
 *
 * The initial beta has NINE references. It cannot recognise arbitrary cards.
 * Expand only through an independently reviewed rights/identity manifest.
 */
import { readFile, writeFile, stat } from 'node:fs/promises';

const source = await readFile('src/data/verified-images.ts', 'utf8');
const matches = [...source.matchAll(/^\s*'([a-zA-Z0-9]+-[a-zA-Z0-9]+)': '([a-zA-Z0-9]+-[a-zA-Z0-9]+)',?$/gm)];
if (matches.length !== 9) throw Error('Visual pilot list changed; explicit review required.');
const collection = JSON.parse(await readFile('public/collection.json', 'utf8'));
const cards = new Map(collection.flatMap((chapter) => chapter.cards).map((card) => [card.id, card]));
const references = [];
for (const [, sourceId, stem] of matches) {
  const card = cards.get(stem);
  if (!card || typeof card.number !== 'string')
    throw Error('Missing verified local illustration ' + stem);
  const suffix = sourceId.slice(sourceId.lastIndexOf('-') + 1);
  const printed = card.number.split('/')[0];
  if (Number(suffix) !== Number(printed))
    throw Error('Card number mismatch for ' + sourceId);
  const path = 'public/assets/cards/' + stem + '.webp';
  if (!(await stat(path)).isFile()) throw Error('Artwork file missing: ' + stem);
  references.push({
    id: 'de:' + sourceId,
    language: 'de',
    setId: sourceId.slice(0, sourceId.lastIndexOf('-')),
    number: card.number,
    path,
  });
}
if (new Set(references.map((item) => item.id)).size !== references.length)
  throw Error('Duplicate visual reference');
await writeFile('visual-beta-reference-input.json', JSON.stringify({
  modelId: 'dinov2-small-onnx-08c606e-int8-beta9',
  preprocessing: 'imagenet-meanstd-chw-stretch',
  references,
}, null, 2) + '\n');
console.log('Prepared ' + references.length + ' exact-print pilot references.');
