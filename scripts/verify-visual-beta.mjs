#!/usr/bin/env node
/** Strict release gate: a real, consistent, LIMITED visual pilot or no publish. */
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'public/assets/vision/';
const manifest = JSON.parse(await readFile(root + 'manifest.json', 'utf8'));
if (
  manifest.format !== 'e-binder-visual-v1' ||
  manifest.count !== 9 ||
  manifest.dimensions !== 384 ||
  manifest.size !== 224 ||
  manifest.preprocessing !== 'imagenet-meanstd-chw-stretch' ||
  manifest.pooling !== 'cls' ||
  manifest.modelId !== 'dinov2-small-onnx-08c606e-int8-beta9'
)
  throw Error(
    'Visual beta manifest is unverified or claims incorrect coverage',
  );
for (const [file, hash] of [
  [manifest.modelFile, manifest.modelSha256],
  [manifest.indexFile, manifest.indexSha256],
  [manifest.referencesFile, manifest.referencesSha256],
]) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]+$/.test(file) || file.includes('..'))
    throw Error('Unsafe visual asset path');
  const bytes = await readFile(root + file);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (hash !== actual) throw Error('Visual beta asset SHA mismatch: ' + file);
}
if ((await stat(root + manifest.modelFile)).size !== 24427763)
  throw Error('Unexpected or placeholder visual model');
if ((await stat(root + manifest.indexFile)).size !== 9 * 384)
  throw Error('Wrong index vector dimensions');
const refs = JSON.parse(await readFile(root + manifest.referencesFile, 'utf8'));
if (
  !Array.isArray(refs) ||
  refs.length !== 9 ||
  new Set(refs.map((r) => r.id)).size !== 9 ||
  refs.some(
    (r) =>
      r.language !== 'de' ||
      !/^de:sv0[123]-\d{3}$/.test(r.id) ||
      r.id.split(':')[1].split('-')[0] !== r.setId ||
      !/^[0-9]{3}\/[0-9]{3}$/.test(r.number),
  )
)
  throw Error(
    'Unreviewed visual references: beta must contain nine exact DE printings',
  );
console.log(
  'Visual pilot checks passed: 9 exact printings; model and index integrity confirmed.',
);
