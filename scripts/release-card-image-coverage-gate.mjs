/**
 * Release-only wrapper. Keep "npm run audit:card-images" strict for manual
 * investigations. The mandatory smoke can be inconclusive when all three
 * remote critical cards are unavailable with explicit transient HTTP codes.
 *
 * The complete committed card index was already checked by the strict audit.
 * Never claim the external card coverage passed when the provider was down.
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isStrictTransientCardCoverageOutage } from './coverage-outage-errors.mjs';

const result = spawnSync(
  process.execPath,
  ['scripts/audit-catalog-card-coverage.mjs'],
  { stdio: 'inherit' },
);
if (!result.error && result.status === 0) process.exit(0);

try {
  const [report, artwork] = await Promise.all([
    readFile('artifacts/card-artwork-coverage.json', 'utf8').then(JSON.parse),
    readFile('public/catalog-art/audit.json', 'utf8').then(JSON.parse),
  ]);
  if (
    !isStrictTransientCardCoverageOutage(report) ||
    !Array.isArray(artwork.errors) ||
    artwork.errors.length !== 0 ||
    !Array.isArray(artwork.bundledCards) ||
    artwork.bundledCards.length === 0 ||
    artwork.bundledCards.some((card) => card.available !== true)
  )
    throw new Error(
      'Coverage failure is not exclusively transient and verified.',
    );

  // Distinguish a skipped live-provider probe from a passed coverage audit.
  await writeFile(
    'artifacts/card-artwork-coverage.json',
    JSON.stringify(
      {
        ...report,
        verificationStatus: 'unverified-upstream-unavailable',
        providerOutage: `TCGdex returned 429/5xx on ${report.issues.length} of 3 critical cards`,
      },
      null,
      2,
    ) + '\n',
  );
  console.warn(
    '::warning::TCGdex unavailable for one or more required cards. ' +
      'Live-provider coverage is UNVERIFIED; committed artwork integrity was checked.',
  );
} catch (error) {
  console.error('Card coverage release gate failed:', error);
  process.exitCode = 1;
}
