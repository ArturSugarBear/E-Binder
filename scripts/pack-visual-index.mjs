#!/usr/bin/env node
/**
 * Produce an offline, model-bound visual corpus from precomputed embeddings.
 * No photos, filenames or secret tokens are fetched, scraped or uploaded here.
 *
 * Usage:
 * node scripts/pack-visual-index.mjs embeddings.json licensed-model.onnx public/assets/vision
 *
 * Input:
 * {
 *   "modelId": "approved-model-v1",
 *   "references": [
 *     { "id": "de:sv01-211", "language": "de", "setId": "sv01",
 *       "number": "211/198", "vector": [0.01, ...] }
 *   ]
 * }
 * All vectors must come from the *same exact* ONNX model as --model, using
 * 224px RGB/255 CHW, stretch resize and CLS-token pooling.
 */
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const [sourceFile, modelFile, outputDirectory] = process.argv.slice(2);
if (!sourceFile || !modelFile || !outputDirectory) {
  console.error(
    'Usage: node scripts/pack-visual-index.mjs <embeddings.json> <model.onnx> <output-dir>',
  );
  process.exit(2);
}
const parsed = JSON.parse(await readFile(resolve(sourceFile), 'utf8'));
const entries = parsed.references;
if (
  !/^[A-Za-z0-9_.-]{3,100}$/.test(parsed.modelId ?? '') ||
  !Array.isArray(entries) ||
  !entries.length ||
  entries.length > 200000
)
  throw new Error('Invalid visual embedding source.');
const dimensions = entries[0].vector?.length;
if (!Number.isInteger(dimensions) || dimensions < 64 || dimensions > 2048)
  throw new Error('Invalid embedding dimensions.');
const references = [];
const seen = new Set();
const packed = Buffer.alloc(entries.length * dimensions);
for (const [row, entry] of entries.entries()) {
  if (
    !/^[A-Za-z0-9_.:+-]{3,200}$/.test(entry.id ?? '') ||
    !['de', 'en', 'ja'].includes(entry.language) ||
    !/^[A-Za-z0-9_.+-]{1,100}$/.test(entry.setId ?? '') ||
    !/^[A-Za-z0-9 /-]{1,40}$/.test(entry.number ?? '') ||
    !Array.isArray(entry.vector) ||
    entry.vector.length !== dimensions ||
    seen.has(entry.id)
  )
    throw new Error(
      'Invalid, duplicate or inconsistent reference at row ' + row,
    );
  seen.add(entry.id);
  const maxAbs = Math.max(
    ...entry.vector.map((v) => {
      if (typeof v !== 'number' || !Number.isFinite(v))
        throw new Error('Non-finite embedding.');
      return Math.abs(v);
    }),
  );
  if (maxAbs <= 0) throw new Error('Empty vector at row ' + row);
  for (let i = 0; i < dimensions; i++) {
    const quantized = Math.max(
      -127,
      Math.min(127, Math.round((entry.vector[i] * 127) / maxAbs)),
    );
    packed.writeInt8(quantized, row * dimensions + i);
  }
  references.push({
    id: entry.id,
    language: entry.language,
    setId: entry.setId,
    number: entry.number,
  });
}
const model = await readFile(resolve(modelFile));
if (model.length < 1024)
  throw new Error('Model file too small; use a real licensed ONNX model.');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const directory = resolve(outputDirectory);
await mkdir(directory, { recursive: true });
const modelName = `visual-model-${parsed.modelId}.onnx`;
const indexName = `index-${parsed.modelId}.i8`;
const referencesName = `references-${parsed.modelId}.json`;
await copyFile(resolve(modelFile), join(directory, modelName));
await writeFile(join(directory, indexName), packed);
const referencesBytes = Buffer.from(JSON.stringify(references));
await writeFile(join(directory, referencesName), referencesBytes);
await writeFile(
  join(directory, 'manifest.json'),
  JSON.stringify(
    {
      format: 'e-binder-visual-v1',
      modelId: parsed.modelId,
      dimensions,
      size: 224,
      preprocessing: 'rgb-0-1-chw-stretch',
      pooling: 'cls',
      modelFile: modelName,
      modelSha256: sha256(model),
      indexFile: indexName,
      indexSha256: sha256(packed),
      referencesFile: referencesName,
      referencesSha256: sha256(referencesBytes),
      count: entries.length,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Prepared ${entries.length} model-bound references (${dimensions} dims, ${packed.length} packed bytes).`,
);
