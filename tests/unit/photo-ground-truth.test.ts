import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validatePhotoManifest } from '../../scripts/validate-photo-ground-truth';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
const digest = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const timestamp = '2026-11-11T00:00:00Z';
// Tiny synthetic PNG, never a real-photo dataset or accuracy claim.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',
  'base64',
);
const snapshot = () => ({
  schemaVersion: 1,
  records: [
    {
      language: 'en',
      retrievedAt: timestamp,
      sourceUrl: 'https://api.tcgdex.net/v2/en/cards/base1-4',
      card: {
        id: 'base1-4',
        name: 'Charizard',
        localId: '4',
        set: { id: 'base1' },
      },
    },
  ],
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'photo-ground-truth-'));
  directories.push(root);
  await writeFile(join(root, 'photo.png'), png);
  const catalogue = JSON.stringify(snapshot());
  const sample = {
    id: 'photo-1',
    imagePath: 'photo.png',
    sha256: digest(png),
    groupId: 'original-capture-1',
    source: {
      dataset: 'synthetic-test',
      version: '1',
      assetId: '1',
      url: 'https://example.org/dataset',
      acquiredAt: timestamp,
      attribution: 'Synthetic unit fixture',
      license: 'test-fixture-only',
      rightsStatus: 'verified',
      rightsEvidence: 'Synthetic test evidence; not a real photo',
      restrictions: ['Do not count as real-photo evidence'],
    },
    media: 'camera-photo',
    language: 'en',
    split: 'test',
    content: 'cards',
    verification: {
      status: 'verified',
      reviewer: 'fixture-reviewer',
      reviewedAt: timestamp,
      evidence: 'Synthetic test attestation only',
    },
    cards: [
      {
        box: [0, 0, 1, 1],
        regions: [{ kind: 'name', box: [0, 0, 1, 0.1] }],
        identity: {
          tcgdexId: 'base1-4',
          observed: { name: 'Charizard', localId: '4', setId: 'base1' },
        },
      },
    ],
  };
  const manifest = {
    schemaVersion: 1,
    catalogueSha256: digest(catalogue),
    samples: [sample],
  };
  return {
    root,
    catalogue,
    manifest,
    sample,
    run: () => validatePhotoManifest(manifest, catalogue, root),
  };
}
const codes = (report: Awaited<ReturnType<typeof validatePhotoManifest>>) =>
  report.issues.map((i) => i.code);

describe('private photo ground-truth validator', () => {
  it('validates pinned exact metadata offline and counts only eligible photos', async () => {
    const f = await fixture();
    const result = await f.run();
    expect(result).toMatchObject({
      valid: true,
      issues: [],
      summary: {
        samples: 1,
        usableVerifiedPhotos: 1,
        languages: { en: 1 },
        splits: { test: 1 },
      },
    });
    expect(await f.run()).toEqual(result);
  });
  it.each(['tcgdexId', 'name', 'localId', 'setId', 'language'] as const)(
    'rejects an invalid exact-print %s',
    async (field) => {
      const f = await fixture();
      if (field === 'tcgdexId')
        f.sample.cards[0]!.identity.tcgdexId = 'Charizard';
      else if (field === 'language') f.sample.language = 'de';
      else
        f.sample.cards[0]!.identity.observed[field] =
          'unverified-listing-label';
      expect(codes(await f.run())).toContain('exact_identity');
    },
  );
  it('does not infer an identity from an apparently exact filename', async () => {
    const f = await fixture();
    await writeFile(join(f.root, 'base1-4-Charizard.png'), png);
    f.sample.imagePath = 'base1-4-Charizard.png';
    const input = structuredClone(f.manifest);
    input.samples[0]!.cards[0]!.identity = null as never;
    expect(
      codes(await validatePhotoManifest(input, f.catalogue, f.root)),
    ).toContain('unverified_identity');
  });
  it('allows explicit unknown and empty quarantined entries without inventing labels', async () => {
    for (const content of ['unknown', 'empty']) {
      const f = await fixture();
      f.sample.content = content;
      f.sample.cards = [];
      f.sample.language = 'unknown';
      f.sample.media = 'unknown';
      f.sample.split = 'quarantine';
      f.sample.verification.status = 'unverified';
      f.sample.source.rightsStatus = 'unverified';
      const result = await f.run();
      expect(result.valid).toBe(true);
      expect(result.summary).toMatchObject({
        usableVerifiedPhotos: 0,
        unknownMedia: 1,
        unresolvedRights: 1,
        languages: { unknown: 1 },
      });
    }
  });
  it('accepts a reviewed empty camera negative without an invented card ID', async () => {
    const f = await fixture();
    f.sample.content = 'empty';
    f.sample.cards = [];
    f.sample.language = 'unknown';
    expect(await f.run()).toMatchObject({
      valid: true,
      summary: { usableVerifiedPhotos: 0, usableEmptyPhotos: 1 },
    });
  });
  it('keeps partially identified cards explicit and quarantined', async () => {
    const f = await fixture();
    const input = structuredClone(f.manifest);
    input.samples[0]!.cards[0]!.identity = null as never;
    input.samples[0]!.verification.status = 'unverified';
    input.samples[0]!.split = 'quarantine';
    expect(
      await validatePhotoManifest(input, f.catalogue, f.root),
    ).toMatchObject({
      valid: true,
      summary: { missingIdentities: 1, unverifiedPhotos: 1 },
    });
  });
  it.each(['rights', 'review', 'media', 'evidence'] as const)(
    'rejects ineligible active-split %s',
    async (field) => {
      const f = await fixture();
      if (field === 'rights') f.sample.source.rightsStatus = 'restricted';
      if (field === 'review') f.sample.verification.status = 'unverified';
      if (field === 'media') f.sample.media = 'digital-artwork';
      if (field === 'evidence') f.sample.verification.evidence = '';
      expect((await f.run()).valid).toBe(false);
    },
  );
  it.each(['license', 'attribution', 'rightsEvidence'] as const)(
    'rejects verified rights without %s',
    async (field) => {
      const f = await fixture();
      const input = structuredClone(f.manifest);
      input.samples[0]!.source[field] = null as never;
      expect(
        codes(await validatePhotoManifest(input, f.catalogue, f.root)),
      ).toContain('rights_evidence');
    },
  );
  it('detects actual-byte duplicates despite different declared hashes and file names', async () => {
    const f = await fixture();
    await writeFile(join(f.root, 'copy.png'), png);
    const second = structuredClone(f.sample);
    second.id = 'copy';
    second.imagePath = 'copy.png';
    second.sha256 = '0'.repeat(64);
    second.source.assetId = '2';
    second.groupId = 'different-claim';
    second.split = 'train';
    f.manifest.samples.push(second);
    const result = await f.run();
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'duplicate_sample',
        'split_leakage',
        'image_hash',
      ]),
    );
    expect(result.summary?.usableVerifiedPhotos).toBeNull();
  });
  it('flags same-split duplicates and cross-split transformed originals', async () => {
    const f = await fixture();
    const duplicate = structuredClone(f.sample);
    duplicate.id = 'duplicate';
    f.manifest.samples.push(duplicate);
    expect(codes(await f.run())).toContain('duplicate_sample');
    const transformed = Buffer.concat([
      png,
      Buffer.from('synthetic different bytes'),
    ]);
    await writeFile(join(f.root, 'crop.png'), transformed);
    duplicate.imagePath = 'crop.png';
    duplicate.sha256 = digest(transformed);
    duplicate.source.assetId = 'crop';
    duplicate.split = 'train';
    expect(codes(await f.run())).toContain('split_leakage');
  });
  it('rejects corrupt bytes, escaping paths and symlinks', async () => {
    const f = await fixture();
    await writeFile(join(f.root, 'not-image'), 'not an image');
    f.sample.imagePath = 'not-image';
    f.sample.sha256 = digest('not an image');
    expect(codes(await f.run())).toContain('image_format');
    f.sample.imagePath = '../missing.png';
    expect(codes(await f.run())).toContain('image_path');
    await symlink(resolve('package.json'), join(f.root, 'escape'));
    f.sample.imagePath = 'escape';
    expect(codes(await f.run())).toContain('image_path');
    expect(
      codes(
        await validatePhotoManifest(f.manifest, f.catalogue, resolve('public')),
      ),
    ).toContain('private_root');
  });
  it('rejects invalid boxes, implicit empty content and missing review evidence', async () => {
    const f = await fixture();
    f.sample.cards[0]!.box = [0.9, 0, 0.5, 1];
    expect(codes(await f.run())).toContain('manifest_schema');
    f.sample.cards = [];
    expect(codes(await f.run())).toContain('content');
    f.sample.content = 'empty';
    const input = structuredClone(f.manifest);
    input.samples[0]!.verification.reviewer = null as never;
    expect(
      codes(await validatePhotoManifest(input, f.catalogue, f.root)),
    ).toContain('review_evidence');
  });
  it('rejects snapshot drift, ambiguous catalogue keys and non-TCGdex provenance', async () => {
    const f = await fixture();
    expect(
      codes(await validatePhotoManifest(f.manifest, f.catalogue + ' ', f.root)),
    ).toContain('catalogue_hash');
    const data = snapshot();
    data.records.push(data.records[0]!);
    data.records[0]!.sourceUrl = 'https://example.org/untrusted';
    expect(
      codes(
        await validatePhotoManifest(f.manifest, JSON.stringify(data), f.root),
      ),
    ).toEqual(
      expect.arrayContaining(['catalogue_duplicate', 'catalogue_source']),
    );
    const inconsistent = snapshot();
    inconsistent.records[0]!.card.localId = '5';
    expect(
      codes(
        await validatePhotoManifest(
          f.manifest,
          JSON.stringify(inconsistent),
          f.root,
        ),
      ),
    ).toContain('catalogue_identity');
    expect(
      codes(await validatePhotoManifest(f.manifest, '{}', f.root)),
    ).toContain('catalogue_schema');
  });
  it('runs the real CLI with deterministic output and meaningful exit codes', async () => {
    const f = await fixture();
    await mkdir(join(f.root, 'photos'));
    await writeFile(join(f.root, 'photos/photo.png'), png);
    await writeFile(join(f.root, 'manifest.json'), JSON.stringify(f.manifest));
    await writeFile(join(f.root, 'catalogue.json'), f.catalogue);
    const command = (args: string[]) =>
      spawnSync(
        process.execPath,
        ['--import', 'tsx', 'scripts/validate-photo-ground-truth.ts', ...args],
        { encoding: 'utf8' },
      );
    const args = [
      join(f.root, 'manifest.json'),
      join(f.root, 'catalogue.json'),
      join(f.root, 'photos'),
    ];
    const first = command(args);
    expect(first.status, first.stderr).toBe(0);
    expect(command(args).stdout).toBe(first.stdout);
    f.manifest.catalogueSha256 = '0'.repeat(64);
    await writeFile(args[0]!, JSON.stringify(f.manifest));
    expect(command(args).status).toBe(1);
    expect(command(['package.json', ...args.slice(1)]).status).toBe(2);
    expect(command([]).status).toBe(2);
  });
});
