/** Reproducible clean-reference regression, not a camera accuracy estimate.
 * Images stay outside the repository and are never used as beta training data.
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = await mkdtemp(join(tmpdir(), 'e-binder-reference-'));
const sources = [
  ['de', 'me01-077', 'https://assets.tcgdex.net/de/me/me01/077/high.webp'],
  ['en', 'me01-077', 'https://assets.tcgdex.net/en/me/me01/077/high.webp'],
  [
    'ja',
    'M1L-088',
    'https://tcgplayer-cdn.tcgplayer.com/product/647197_in_1000x1000.jpg',
  ],
  [
    'ja',
    'M1S-088',
    'https://tcgplayer-cdn.tcgplayer.com/product/647217_in_1000x1000.jpg',
  ],
];
const samples = [];
for (const [language, id, url] of sources) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok)
    throw new Error(`Reference source unavailable: ${response.status}`);
  const photo = language + '-' + id + (url.endsWith('.jpg') ? '.jpg' : '.webp');
  await writeFile(
    join(directory, photo),
    Buffer.from(await response.arrayBuffer()),
    { mode: 0o600 },
  );
  samples.push({
    photo,
    language,
    expectedKey: `tcgdex:${language}:${id}`,
    rights:
      'Public provider-hosted catalogue reference; local evaluation only, not training data',
    verification: {
      independent: true,
      method: 'assisted-visual-catalog',
      evidence: url,
    },
    conditions: ['clean-catalogue-reference'],
    corners: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  });
}
const manifest = join(directory, 'manifest.json');
await writeFile(
  manifest,
  JSON.stringify(
    { kind: 'clean-catalogue-reference-not-beta', samples },
    null,
    2,
  ),
  { mode: 0o600 },
);
const run = spawnSync(
  process.execPath,
  ['scripts/benchmark-card-scans.mjs', manifest],
  { stdio: 'inherit', env: process.env },
);
console.log(
  'These four references test reproducible regressions, not real beta camera accuracy.',
);
process.exitCode = run.status ?? 1;
