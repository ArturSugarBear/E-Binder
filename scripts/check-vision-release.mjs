#!/usr/bin/env node
/**
 * Validate a packaged visual-search deployment before enabling the feature.
 * Run: node scripts/check-vision-release.mjs [public/assets/vision]
 * This does not download or generate copyrighted card artwork.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';
import { createHash } from 'node:crypto';

const directory = resolve(process.argv[2] ?? 'public/assets/vision');
const fail = (message) => { throw new Error(`Vision release invalid: ${message}`); };
const safeName = (name) =>
  typeof name === 'string' &&
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) &&
  basename(name) === name;

async function check() {
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'e-binder-visual-v1') fail('unexpected manifest format');
  if (!manifest.modelId || !Number.isInteger(manifest.dimensions) || manifest.dimensions < 1)
    fail('invalid model identity/dimensions');
  if (!Number.isInteger(manifest.count) || manifest.count < 1) fail('empty reference index');
  const fields = Object.entries(manifest).filter(([key]) => /file|sha256|hash/i.test(key));
  console.log('Manifest:', manifest.modelId, 'references:', manifest.count, 'dimensions:', manifest.dimensions);
  console.log('Manifest file/hash fields:', fields.map(([key]) => key).join(', '));
  for (const [key, value] of fields) {
    if (/file/i.test(key) && typeof value === 'string' && !safeName(value))
      fail(`unsafe filename in ${key}`);
  }
  // Exact fields are validated by the runtime loader; this release gate
  // additionally rejects absent artifacts and mismatched bytes.
  const names = [manifest.modelFile, manifest.indexFile, manifest.referencesFile];
  if (names.some((name) => !safeName(name))) fail('missing or unsafe model/index/reference filename');
  for (const name of names) {
    const file = join(directory, name);
    const info = await stat(file);
    if (!info.isFile() || info.size === 0) fail(`empty artifact: ${name}`);
    const bytes = await readFile(file);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const expected = name === manifest.modelFile ? manifest.modelSha256
      : name === manifest.indexFile ? manifest.indexSha256 : manifest.referencesSha256;
    if (expected && digest !== expected) fail(`SHA-256 mismatch: ${name}`);
    console.log(`${name}: ${info.size} bytes, SHA-256 ${digest}`);
  }
  const refs = JSON.parse(await readFile(join(directory, manifest.referencesFile), 'utf8'));
  if (!Array.isArray(refs) || refs.length !== manifest.count) fail('reference count mismatch');
  const indexSize = (await stat(join(directory, manifest.indexFile))).size;
  if (indexSize !== manifest.count * manifest.dimensions)
    fail('int8 index dimensions do not match reference count');
  const ids = new Set();
  for (const ref of refs) {
    if (!ref || !['de', 'en', 'ja'].includes(ref.language) ||
      typeof ref.id !== 'string' || !ref.id.startsWith(`${ref.language}:`) ||
      !ref.setId || !ref.number || ids.has(ref.id)) fail('invalid or duplicate reference');
    ids.add(ref.id);
  }
  console.log('PASS: release artifacts structurally valid. iOS inference and recognition accuracy still require device benchmarks.');
}
check().catch((error) => { console.error(error.message); process.exitCode = 1; });
