import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const text = z.string().trim().min(1);
const nullableText = text.nullable();
const date = z.string().datetime();
const language = z.string().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const box = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(
    ([x, y, w, h]) =>
      x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1,
    'Expected normalized [x, y, width, height] within the image',
  );
const review = z
  .object({
    status: z.enum(['verified', 'unverified', 'rejected']),
    reviewer: nullableText,
    reviewedAt: date.nullable(),
    evidence: nullableText,
  })
  .strict();
const sampleSchema = z
  .object({
    id: text,
    imagePath: text,
    sha256: hash,
    // Same original photo, crops, augmentations, bursts or cross-dataset forks.
    groupId: text,
    source: z
      .object({
        dataset: text,
        version: text,
        assetId: text,
        url: z.string().url(),
        acquiredAt: date,
        attribution: nullableText,
        license: nullableText,
        rightsStatus: z.enum(['verified', 'unverified', 'restricted']),
        rightsEvidence: nullableText,
        restrictions: z.array(text),
      })
      .strict(),
    media: z.enum(['camera-photo', 'digital-artwork', 'unknown']),
    language: z.union([z.literal('unknown'), z.literal('mixed'), language]),
    verification: review,
    split: z.enum(['train', 'validation', 'test', 'quarantine']),
    content: z.enum(['cards', 'unknown', 'empty']),
    cards: z.array(
      z
        .object({
          box,
          regions: z.array(
            z.object({ kind: z.enum(['name', 'number', 'set']), box }).strict(),
          ),
          identity: z
            .object({
              tcgdexId: text,
              language: language.optional(),
              // Transcribed from the photo and checked by the reviewer, never inferred
              // from a filename, a listing title or the Pokemon species alone.
              observed: z
                .object({ name: text, localId: text, setId: text })
                .strict(),
            })
            .strict()
            .nullable(),
        })
        .strict(),
    ),
  })
  .strict();
const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    catalogueSha256: hash,
    samples: z.array(sampleSchema),
  })
  .strict();
const catalogueSchema = z
  .object({
    schemaVersion: z.literal(1),
    records: z.array(
      z
        .object({
          language,
          sourceUrl: z.string().url(),
          retrievedAt: date,
          card: z
            .object({
              id: text,
              localId: text,
              name: text,
              set: z.object({ id: text }).passthrough(),
            })
            .passthrough(),
        })
        .strict(),
    ),
  })
  .strict();

type Issue = { code: string; sampleId?: string; message: string };
type Sample = z.infer<typeof sampleSchema>;
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const sha256 = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
function inside(root: string, path: string): boolean {
  const part = relative(root, path);
  return (
    part === '' ||
    (!isAbsolute(part) &&
      part !== '..' &&
      !part.startsWith('../') &&
      !part.startsWith('..\\'))
  );
}

/** Offline validation only. This checks recorded evidence, not its truthfulness. */
export async function validatePhotoManifest(
  input: unknown,
  catalogueBytes: string,
  imageRoot: string,
) {
  const issues: Issue[] = [];
  const issue = (code: string, message: string, sampleId?: string) =>
    issues.push({ code, ...(sampleId ? { sampleId } : {}), message });
  const manifest = manifestSchema.safeParse(input);
  let catalogue: z.infer<typeof catalogueSchema>;
  try {
    catalogue = catalogueSchema.parse(JSON.parse(catalogueBytes));
  } catch {
    issue('catalogue_schema', 'Invalid catalogue snapshot');
    return { valid: false, issues, summary: null };
  }
  if (!manifest.success) {
    for (const error of manifest.error.issues)
      issue('manifest_schema', `${error.path.join('.')}: ${error.message}`);
    return { valid: false, issues, summary: null };
  }
  if (sha256(catalogueBytes) !== manifest.data.catalogueSha256)
    issue(
      'catalogue_hash',
      'Catalogue bytes do not match the pinned snapshot hash',
    );
  const index = new Map<string, (typeof catalogue.records)[number]['card']>();
  for (const record of catalogue.records) {
    const key = `${record.language}:${record.card.id}`;
    if (index.has(key))
      issue('catalogue_duplicate', `Repeated catalogue key: ${key}`);
    if (
      record.sourceUrl !==
      `https://api.tcgdex.net/v2/${record.language}/cards/${encodeURIComponent(record.card.id)}`
    )
      issue('catalogue_source', `Unexpected TCGdex metadata source: ${key}`);
    if (record.card.id !== `${record.card.set.id}-${record.card.localId}`)
      issue(
        'catalogue_identity',
        `Inconsistent TCGdex ID, set and local number: ${key}`,
      );
    index.set(key, record.card);
  }
  let root: string;
  try {
    root = await realpath(imageRoot);
    if (
      !(await stat(root)).isDirectory() ||
      inside(await realpath(repositoryRoot), root)
    )
      throw new Error();
  } catch {
    issue(
      'private_root',
      'Images must be in an existing directory outside this repository',
    );
    return { valid: false, issues, summary: null };
  }
  const seen = new Map<string, Sample>();
  const remember = (key: string, sample: Sample, duplicate: boolean) => {
    const previous = seen.get(key);
    if (previous) {
      if (duplicate)
        issue(
          'duplicate_sample',
          `Shares ${key.split(':')[0]} with ${previous.id}`,
          sample.id,
        );
      if (previous.split !== sample.split)
        issue(
          'split_leakage',
          `Shares ${key.split(':')[0]} across splits with ${previous.id}`,
          sample.id,
        );
    } else seen.set(key, sample);
  };
  const summary = {
    samples: manifest.data.samples.length,
    reviewedExactPhotos: 0,
    usableVerifiedPhotos: 0,
    usableEmptyPhotos: 0,
    unverifiedPhotos: 0,
    unknownMedia: 0,
    missingIdentities: 0,
    unknownContent: 0,
    unresolvedRights: 0,
    languages: {} as Record<string, number>,
    splits: {} as Record<string, number>,
  };
  for (const sample of manifest.data.samples) {
    const before = issues.length;
    const fail = (code: string, message: string) =>
      issue(code, message, sample.id);
    remember(`id:${sample.id}`, sample, true);
    remember(
      `asset:${JSON.stringify([sample.source.dataset, sample.source.assetId])}`,
      sample,
      true,
    );
    remember(`group:${sample.groupId}`, sample, false);
    summary.languages[sample.language] =
      (summary.languages[sample.language] ?? 0) + 1;
    summary.splits[sample.split] = (summary.splits[sample.split] ?? 0) + 1;
    summary.missingIdentities += sample.cards.filter(
      (card) => card.identity === null,
    ).length;
    if (
      sample.media === 'camera-photo' &&
      sample.verification.status !== 'verified'
    )
      summary.unverifiedPhotos++;
    if (sample.media === 'unknown') summary.unknownMedia++;
    if (sample.content === 'unknown') summary.unknownContent++;
    if (sample.source.rightsStatus !== 'verified') summary.unresolvedRights++;
    try {
      if (isAbsolute(sample.imagePath)) throw new Error();
      const image = await realpath(resolve(root, sample.imagePath));
      if (
        !inside(root, image) ||
        inside(await realpath(repositoryRoot), image) ||
        !(await stat(image)).isFile()
      )
        throw new Error();
      const bytes = await readFile(image);
      const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const png = bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const webp =
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!jpeg && !png && !webp)
        fail(
          'image_format',
          'Expected JPEG, PNG or WebP signature (not a full decode)',
        );
      const actualHash = sha256(bytes);
      remember(`hash:${actualHash}`, sample, true);
      if (!bytes.length || actualHash !== sample.sha256)
        fail(
          'image_hash',
          'Empty file or image bytes differ from the recorded SHA-256',
        );
    } catch {
      fail(
        'image_path',
        'Image must be an existing private file beneath the image root (no escaping symlinks)',
      );
    }
    if ((sample.content === 'cards') !== sample.cards.length > 0)
      fail(
        'content',
        'Cards require nonempty annotations; unknown/empty require an explicit empty cards array',
      );
    if (
      sample.source.rightsStatus === 'verified' &&
      (!sample.source.license ||
        !sample.source.rightsEvidence ||
        !sample.source.attribution)
    )
      fail(
        'rights_evidence',
        'Verified rights require license, attribution and evidence for the intended private use',
      );
    if (sample.verification.status === 'verified') {
      if (
        !sample.verification.reviewer ||
        !sample.verification.reviewedAt ||
        !sample.verification.evidence
      )
        fail(
          'review_evidence',
          'Verified samples require a reviewer, timestamp and image-based evidence',
        );
      if (
        sample.content === 'unknown' ||
        sample.cards.some((card) => !card.identity) ||
        (sample.content === 'cards' && sample.language === 'unknown')
      )
        fail(
          'unverified_identity',
          'Verified samples cannot have unknown content, language or card identities',
        );
    }
    const identityLanguages = new Set<string>();
    for (const card of sample.cards) {
      if (!card.identity) continue;
      const cardLanguage = card.identity.language ?? sample.language;
      identityLanguages.add(cardLanguage);
      if (
        (sample.language === 'mixed' && !card.identity.language) ||
        (sample.language !== 'mixed' &&
          sample.language !== 'unknown' &&
          cardLanguage !== sample.language)
      )
        fail(
          'identity_language',
          'Mixed photos require a language per identified card; single-language photos must agree with every identity',
        );
      const metadata = index.get(`${cardLanguage}:${card.identity.tcgdexId}`);
      const observed = card.identity.observed;
      if (
        !metadata ||
        metadata.localId !== observed.localId ||
        metadata.set.id !== observed.setId ||
        metadata.name.normalize('NFC') !== observed.name.normalize('NFC')
      )
        fail(
          'exact_identity',
          'Exact ID and observed language/name/number/set must match a TCGdex snapshot record',
        );
    }
    if (
      sample.language === 'mixed' &&
      sample.verification.status === 'verified' &&
      identityLanguages.size < 2
    )
      fail(
        'identity_language',
        'A verified mixed-language photo must establish at least two distinct card languages',
      );
    if (
      issues.length === before &&
      sample.media === 'camera-photo' &&
      sample.content === 'cards' &&
      sample.verification.status === 'verified'
    )
      summary.reviewedExactPhotos++;
    if (
      sample.split !== 'quarantine' &&
      (sample.verification.status !== 'verified' ||
        sample.source.rightsStatus !== 'verified' ||
        sample.media !== 'camera-photo')
    )
      fail(
        'ineligible_split',
        'Only verified real photos with reviewed rights may enter train/validation/test',
      );
    if (
      issues.length === before &&
      sample.split !== 'quarantine' &&
      sample.verification.status === 'verified' &&
      sample.source.rightsStatus === 'verified' &&
      sample.media === 'camera-photo'
    ) {
      if (sample.content === 'cards') summary.usableVerifiedPhotos++;
      if (sample.content === 'empty') summary.usableEmptyPhotos++;
    }
  }
  // A later duplicate may invalidate an earlier sample. Suppress eligibility
  // totals for an invalid manifest rather than imply a partially approved set.
  return {
    valid: issues.length === 0,
    issues,
    summary: {
      ...summary,
      reviewedExactPhotos: issues.length ? null : summary.reviewedExactPhotos,
      usableVerifiedPhotos: issues.length ? null : summary.usableVerifiedPhotos,
      usableEmptyPhotos: issues.length ? null : summary.usableEmptyPhotos,
    },
  };
}

async function main() {
  const [manifestPath, cataloguePath, imageRoot, ...extra] =
    process.argv.slice(2);
  if (!manifestPath || !cataloguePath || !imageRoot || extra.length)
    throw new Error(
      'Usage: node --import tsx scripts/validate-photo-ground-truth.ts /private/manifest.json /private/catalogue.json /private/photos',
    );
  const repo = await realpath(repositoryRoot);
  for (const path of [manifestPath, cataloguePath])
    if (inside(repo, await realpath(path)))
      throw new Error(
        'Manifest and catalogue snapshot must stay outside the repository',
      );
  const report = await validatePhotoManifest(
    JSON.parse(await readFile(manifestPath, 'utf8')),
    await readFile(cataloguePath, 'utf8'),
    imageRoot,
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.valid ? 0 : 1;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch(() => {
    console.error(
      'Validation could not run: invalid JSON, inaccessible private inputs, or invalid arguments. See docs/dataset-audit.md for usage.',
    );
    process.exitCode = 2;
  });
}
