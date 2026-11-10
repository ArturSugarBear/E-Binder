import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, sep } from 'node:path';

const root = resolve('docs/benchmarks/competitors/2026-11-10');
let manifest;
try {
  manifest = JSON.parse(
    await readFile(join(root, 'media-manifest.json'), 'utf8'),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.error(
    'Benchmark media not yet imported. Unzip the companion reference package at the repository root.',
  );
  process.exit(1);
}

if (!Array.isArray(manifest?.assets) || manifest.assets.length !== 18)
  throw new Error('Expected exactly 18 benchmark media entries.');

const locations = new Set();
for (const asset of manifest.assets) {
  if (
    typeof asset?.path !== 'string' ||
    !asset.path ||
    !Number.isSafeInteger(asset.bytes) ||
    asset.bytes <= 0 ||
    typeof asset.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(asset.sha256)
  )
    throw new Error('Invalid benchmark media entry.');
  const location = resolve(root, asset.path);
  if (!location.startsWith(root + sep))
    throw new Error(`Unsafe benchmark file path: ${asset.path}`);
  if (locations.has(location))
    throw new Error(`Duplicate benchmark file path: ${asset.path}`);
  locations.add(location);
}

const realRoot = await realpath(root);
let missing = 0;
let wrong = 0;
for (const asset of manifest.assets) {
  const location = resolve(root, asset.path);
  try {
    if (!(await realpath(location)).startsWith(realRoot + sep))
      throw new Error(
        `Benchmark file resolves outside media root: ${asset.path}`,
      );
    const meta = await stat(location);
    if (!meta.isFile()) throw new Error(`Not a media file: ${asset.path}`);
    const hash = createHash('sha256')
      .update(await readFile(location))
      .digest('hex');
    if (meta.size !== asset.bytes || hash !== asset.sha256) {
      wrong++;
      console.error(`MISMATCH: ${asset.path}`);
    } else {
      console.log(`OK: ${asset.path}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    missing++;
    console.error(`MISSING: ${asset.path}`);
  }
}

console.log(
  `${manifest.assets.length - missing - wrong}/${manifest.assets.length} benchmark media verified`,
);
if (missing || wrong) process.exitCode = 1;
