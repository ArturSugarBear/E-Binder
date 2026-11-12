import { expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

it('compares identical private labels but refuses claiming improvement from 15 samples', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ebinder-ab-'));
  try {
    const source = Array.from({ length: 15 }, (_, i) => ({
      photo: 'consented-' + i + '.jpg',
      expectedKey: 'tcgdex:de:sv01-211',
      language: 'de',
      conditions: ['physical-card'],
      top1: i < 8,
      top5: true,
      automaticKey: null,
      visualModelCandidates: 0,
    }));
    const base = join(dir, 'base.json');
    const beta = join(dir, 'beta.json');
    const report = (rows) => ({
      schemaVersion: 2,
      reports: rows,
      summary: { p95RecognitionMs: 5000 },
    });
    await writeFile(base, JSON.stringify(report(source)));
    await writeFile(
      beta,
      JSON.stringify(
        report(source.map((row) => ({
          ...row,
          top1: true,
          visualModelCandidates: 1,
        }))),
      ),
    );
    const run = (...args) =>
      spawnSync('node', ['scripts/compare-beta-benchmarks.mjs', ...args], {
        encoding: 'utf8',
      });
    const descriptive = run(base, beta);
    expect(descriptive.status).toBe(0);
    const output = JSON.parse(descriptive.stdout);
    expect(output.result).toBe('INSUFFICIENT_OR_REGRESSED');
    expect(output.sameReviewedPhotos).toBe(true);
    expect(output.deltaTop1).toBe(7);
    expect(run(base, beta, '--gate').status).toBe(1);
    const tampered = source.map((row) => ({ ...row }));
    tampered[0]!.expectedKey = 'tcgdex:de:sv01-212';
    await writeFile(beta, JSON.stringify(report(tampered)));
    expect(run(base, beta).status).not.toBe(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
