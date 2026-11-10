import { readFile, stat } from 'node:fs/promises';
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

let missing = 0;
let wrong = 0;
for (const asset of manifest.assets) {
  const location = resolve(root, asset.path);
  if (!location.startsWith(root + sep))
    throw new Error(`Unsafe benchmark file path: ${asset.path}`);
  try {
    const meta = await stat(location);
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
