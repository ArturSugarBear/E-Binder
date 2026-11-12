#!/usr/bin/env node
/**
 * Validate a packaged visual-search deployment before enabling the feature.
 * Run: node scripts/check-vision-release.mjs [public/assets/vision]
 * Structural integrity alone is not evidence of recognition accuracy.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';
import { createHash } from 'node:crypto';

const directory = resolve(process.argv[2] ?? 'public/assets/vision');
const fail = (message) => {
  throw new Error(`Vision release invalid: ${message}`);
};
const safeName = (name) =>
  typeof name === 'string' &&
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) &&
  basename(name) === name &&
  !name.includes('..');
const validHash = (hash) =>
  typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);

async function check() {
  const manifest = JSON.parse(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
  );
  if (manifest.format !== 'e-binder-visual-v1') {
    fail('unexpected manifest format');
  }
  if (
    !/^[a-zA-Z0-9_.-]{3,100}$/.test(manifest.modelId ?? '') ||
    !Number.isInteger(manifest.dimensions) ||
    manifest.dimensions < 64 ||
    manifest.dimensions > 2048 ||
    manifest.size !== 224 ||
    manifest.pooling !== 'cls'
  ) {
    fail('invalid model identity or tensor contract');
  }
  if (!Number.isInteger(manifest.count) || manifest.count < 1) {
    fail('empty reference index');
  }

  const assets = [
    ['modelFile', 'modelSha256'],
    ['indexFile', 'indexSha256'],
    ['referencesFile', 'referencesSha256'],
  ];
  for (const [fileKey, hashKey] of assets) {
    const name = manifest[fileKey];
    if (!safeName(name) || !validHash(manifest[hashKey])) {
      fail(`invalid asset metadata: ${fileKey}`);
    }
    const info = await stat(join(directory, name));
    if (!info.isFile() || info.size < 1) {
      fail(`missing or empty file: ${name}`);
    }
    const bytes = await readFile(join(directory, name));
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== manifest[hashKey]) {
      fail(`SHA-256 mismatch: ${name}`);
    }
    console.log(`${name}: ${info.size} bytes; SHA-256 ${digest}`);
  }

  const refs = JSON.parse(
    await readFile(join(directory, manifest.referencesFile), 'utf8'),
  );
  if (!Array.isArray(refs) || refs.length !== manifest.count) {
    fail('reference count mismatch');
  }
  const size = (await stat(join(directory, manifest.indexFile))).size;
  if (size !== manifest.count * manifest.dimensions) {
    fail('int8 index dimensions do not match reference count');
  }
  const ids = new Set();
  for (const ref of refs) {
    if (
      !ref ||
      !['de', 'en', 'ja'].includes(ref.language) ||
      typeof ref.id !== 'string' ||
      !ref.id.startsWith(`${ref.language}:`) ||
      !ref.setId ||
      !ref.number ||
      ids.has(ref.id)
    ) {
      fail('invalid, inconsistent or duplicate reference');
    }
    ids.add(ref.id);
  }
  const languages = Object.fromEntries(
    ['de', 'en', 'ja'].map((language) => [
      language,
      refs.filter((ref) => ref.language === language).length,
    ]),
  );
  console.log(
    `PASS: ${manifest.count} model-bound references by language: ${JSON.stringify(languages)}`,
  );
  console.log(
    'Recognition accuracy and iPhone memory/latency have not been measured.',
  );
}
check().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
