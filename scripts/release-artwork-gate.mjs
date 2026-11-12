/**
 * Production artwork release gate.
 *
 * Only a transient upstream TCGdex 429/5xx metadata outage may reuse an
 * intact, recently verified *committed* artwork snapshot. Actual missing
 * local images, new sets, invalid indices and all other errors fail closed.
 * Developer audits remain strict through `npm run audit:artwork`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';

const path = 'public/catalog-art';
const audit = spawnSync(process.execPath, ['scripts/audit-catalog-art.mjs'], {
  stdio: 'inherit',
});
if (!audit.error && audit.status === 0) process.exit(0);

function committed(relative) {
  return execFileSync('git', ['show', `HEAD:${relative}`], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

async function fallbackToVerifiedSnapshot() {
  const attempted = JSON.parse(await readFile(`${path}/audit.json`, 'utf8'));
  const previous = JSON.parse(committed(`${path}/audit.json`));
  const index = JSON.parse(committed(`${path}/index.json`));

  const transient =
    /^Set metadata unavailable \((?:en|de):[a-z0-9.+_-]+\): Error: (?:429|5[0-9]{2}): https:\/\/api\.tcgdex\.net\/v2\/(?:en|de)\/sets\/[a-z0-9.+_-]+$/i;
  if (
    !Array.isArray(attempted.errors) ||
    attempted.errors.length === 0 ||
    !attempted.errors.every((error) => transient.test(error))
  ) {
    throw new Error('Non-transient artwork audit errors: release blocked.');
  }
  if (
    !Array.isArray(previous.errors) ||
    previous.errors.length !== 0 ||
    !Number.isFinite(Date.parse(previous.checkedAt)) ||
    Date.now() - Date.parse(previous.checkedAt) > 7 * 24 * 60 * 60 * 1000
  ) {
    throw new Error('No recent clean previously verified artwork audit.');
  }
  const freshSets = new Set(attempted.sets.map((set) => set.id));
  const cachedSets = Object.keys(index.sets ?? {});
  if (
    freshSets.size !== cachedSets.length ||
    !cachedSets.every((id) => freshSets.has(id))
  ) {
    throw new Error('Set coverage changed: a cached index cannot hide it.');
  }
  const expected = new Set(previous.bundledCards.map((card) => card.id));
  if (
    attempted.bundledCards.length !== expected.size ||
    !attempted.bundledCards.every(
      (card) => card.available === true && expected.has(card.id),
    )
  ) {
    throw new Error('A bundled card image is missing: release blocked.');
  }
  for (const card of attempted.bundledCards) {
    const file = await stat(`public/${card.path}`);
    if (!file.isFile() || file.size < 100)
      throw new Error(`Invalid local card image: ${card.id}`);
  }
  for (const [id, entry] of Object.entries(index.sets)) {
    if (entry.cards) {
      if (!/^[a-z0-9.+_-]+\.json$/i.test(entry.cards))
        throw new Error(`Invalid cached card index path: ${id}`);
      const cards = JSON.parse(committed(`${path}/${entry.cards}`));
      if (cards.setId !== id || !cards.cards)
        throw new Error(`Invalid cached card index: ${id}`);
    }
    if (entry.placeholder) {
      if (!/^set-[a-z0-9.+_-]+\.svg$/i.test(entry.placeholder))
        throw new Error(`Invalid cached placeholder path: ${id}`);
      const svg = committed(`${path}/${entry.placeholder}`);
      if (!svg.includes('<svg')) throw new Error(`Invalid SVG: ${id}`);
    }
  }

  // The attempted audit may have overwritten several committed indices.
  // Restore the entire proven-good tracked dataset, not a partial re-scan.
  execFileSync('git', ['restore', '--', path]);
  const result = {
    ...previous,
    checkedAt: new Date().toISOString(),
    retainedVerifiedSnapshotAt: previous.checkedAt,
    releaseAuditMode: 'cached-verified-upstream-outage',
    warnings: attempted.errors,
  };
  await writeFile(`${path}/audit.json`, JSON.stringify(result, null, 2));
  console.warn(
    `TCGdex transient outage: retained the clean audited index from ${previous.checkedAt}. ${attempted.errors.length} upstream metadata failures are recorded as warnings; no new artwork is invented.`,
  );
}

try {
  await fallbackToVerifiedSnapshot();
} catch (error) {
  console.error('Artwork release gate failed:', error);
  process.exitCode = 1;
}
