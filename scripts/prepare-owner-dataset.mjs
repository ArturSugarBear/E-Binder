#!/usr/bin/env node
/**
 * Build a private manifest for the repository owner's own card photos.
 *
 * Privacy contract:
 * - Images are read only to validate magic bytes and compute SHA-256.
 * - No image is copied, renamed, uploaded or committed.
 * - EXIF is never parsed, so capture locations and device details stay unread.
 * - The manifest contains only repository-relative photo paths, never absolute
 *   input paths, account identifiers or OCR text.
 * - The output directory must live outside every Git worktree.
 *
 * Usage:
 *   node scripts/prepare-owner-dataset.mjs <input-dir> [--out <private-dir>]
 *     [--seed <string>] [--force]
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SEED = 'e-binder-owner-dataset-v1';

const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SUPPORTED_EXTENSIONS = new Map([
  ['jpg', 'jpeg'],
  ['jpeg', 'jpeg'],
  ['png', 'png'],
  ['webp', 'webp'],
  ['heic', 'heif'],
  ['heif', 'heif'],
]);
const HEIF_BRANDS = new Map([
  ['heic', 'heic'],
  ['heix', 'heic'],
  ['hevc', 'heic'],
  ['hevx', 'heic'],
  ['heim', 'heic'],
  ['heis', 'heic'],
  ['hevm', 'heic'],
  ['hevs', 'heic'],
  ['mif1', 'heif'],
  ['msf1', 'heif'],
]);
const MAX_SEED_LENGTH = 200;

const ascii = (bytes, start, end) =>
  bytes.subarray(start, end).toString('latin1');

const isHexSha256 = (value) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);

const comparePaths = (left, right) =>
  left.relativePath < right.relativePath
    ? -1
    : left.relativePath > right.relativePath
      ? 1
      : 0;

function inside(root, target) {
  const part = relative(root, target);
  return (
    part === '' ||
    (!isAbsolute(part) &&
      part !== '..' &&
      !part.startsWith('..' + sep) &&
      !part.startsWith('..' + '/') &&
      !part.startsWith('..' + '\\'))
  );
}

/** Resolve a path even when its final components do not exist yet. */
async function realPathFor(path) {
  let existing = path;
  const missing = [];
  while (!existsSync(existing)) {
    missing.unshift(basename(existing));
    const parent = dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  const real = await realpath(existing);
  if (missing.length > 0 && !(await stat(real)).isDirectory())
    throw new Error('Output path has a non-directory ancestor.');
  return resolve(real, ...missing);
}

/** Return the nearest ancestor containing .git, or null. */
function repositoryAncestor(path) {
  let current = path;
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Detect a supported image format from magic bytes only.
 * JPEG: FF D8 FF
 * PNG: 89 50 4E 47 (full eight-byte signature checked)
 * WebP: RIFF....WEBP
 * HEIC/HEIF: ISO-BMFF ftyp box with a known still-image brand
 *
 * @param {Buffer | Uint8Array} input
 * @returns {'jpeg' | 'png' | 'webp' | 'heic' | 'heif' | null}
 */
export function detectImageFormat(input) {
  if (!(input instanceof Uint8Array) || input.length < 3) return null;
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'jpeg';

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'png';

  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 12) === 'WEBP'
  )
    return 'webp';

  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    const boxSize = bytes.readUInt32BE(0);
    const boxEnd =
      boxSize >= 16 && boxSize <= bytes.length ? boxSize : bytes.length;
    const brands = [ascii(bytes, 8, 12)];
    for (let offset = 16; offset + 4 <= boxEnd; offset += 4)
      brands.push(ascii(bytes, offset, offset + 4));
    for (const brand of brands) {
      const format = HEIF_BRANDS.get(brand);
      if (format) return format;
    }
  }

  return null;
}

/**
 * Hash a file's bytes. Accepts a path or an already-read Buffer so callers can
 * hash and validate the same bytes without a second disk read.
 *
 * @param {string | Buffer | Uint8Array} input
 * @returns {Promise<string>} lowercase SHA-256 hex digest
 */
export async function hashFile(input) {
  const bytes =
    typeof input === 'string' ? await readFile(input) : Buffer.from(input);
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Deterministic 80/20 split. The seed and content hash both participate, so
 * identical photos always land in the same split and cannot leak across the
 * boundary. Splits are assigned per unique SHA-256, never per filename.
 *
 * @param {string} sha256
 * @param {string} seed
 * @returns {'train' | 'test'}
 */
export function splitForHash(sha256, seed) {
  if (!isHexSha256(sha256))
    throw new Error('splitForHash requires a SHA-256 hex digest');
  if (typeof seed !== 'string' || seed.trim().length === 0)
    throw new Error('splitForHash requires a non-empty seed');
  if (seed.length > MAX_SEED_LENGTH)
    throw new Error('Seed is too long (maximum ' + MAX_SEED_LENGTH + ')');
  const bucket = createHash('sha256')
    .update(seed + '\0' + sha256.toLowerCase())
    .digest()
    .readUInt32BE(0);
  return bucket % 100 < 20 ? 'test' : 'train';
}

/**
 * Build the versioned manifest contract. Input photos must already be unique
 * and split-assigned. Labels stay null and review stays pending until a later,
 * independent labeling pass.
 *
 * @param {{
 *   photos: Array<{file: string, relativePath: string, sha256: string,
 *     bytes: number, format: string, split: 'train' | 'test'}>,
 *   seed: string,
 *   createdAt?: string,
 *   duplicates?: number
 * }} options
 */
export function buildManifest({
  photos,
  seed,
  createdAt = new Date().toISOString(),
  duplicates = 0,
}) {
  if (!Array.isArray(photos)) throw new Error('Photos must be an array');
  if (typeof seed !== 'string' || seed.trim().length === 0)
    throw new Error('A non-empty seed is required');
  if (seed.length > MAX_SEED_LENGTH)
    throw new Error('Seed is too long (maximum ' + MAX_SEED_LENGTH + ')');
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt)))
    throw new Error('createdAt must be an ISO timestamp');
  if (!Number.isSafeInteger(duplicates) || duplicates < 0)
    throw new Error('duplicates must be a non-negative integer');

  const seenHashes = new Set();
  const seenPaths = new Set();
  const ordered = [...photos].sort(comparePaths);
  const normalized = ordered.map((photo) => {
    if (!photo || typeof photo !== 'object')
      throw new Error('Invalid photo record');
    const { file, relativePath, sha256, bytes, format, split } = photo;
    if (typeof file !== 'string' || file.length === 0)
      throw new Error('Photo file name is required');
    if (
      typeof relativePath !== 'string' ||
      relativePath.length === 0 ||
      isAbsolute(relativePath) ||
      relativePath.split('/').some((part) => part === '..' || part === '')
    )
      throw new Error('Photo path must be a safe relative POSIX path');
    if (file !== basename(relativePath))
      throw new Error('Photo file name must match its relative path');
    if (!isHexSha256(sha256))
      throw new Error('Photo SHA-256 is invalid: ' + relativePath);
    const normalizedHash = sha256.toLowerCase();
    if (!Number.isSafeInteger(bytes) || bytes < 1)
      throw new Error('Photo byte size is invalid: ' + relativePath);
    const extensionFamily = SUPPORTED_EXTENSIONS.get(
      extname(file).slice(1).toLowerCase(),
    );
    if (!extensionFamily)
      throw new Error('Unsupported photo extension: ' + relativePath);
    const formatFamily = format === 'heic' ? 'heif' : format;
    if (!['jpeg', 'png', 'webp', 'heic', 'heif'].includes(format))
      throw new Error('Photo format is invalid: ' + relativePath);
    if (formatFamily !== extensionFamily)
      throw new Error(
        'Photo format does not match its extension: ' + relativePath,
      );
    if (!['train', 'test'].includes(split))
      throw new Error('Photo split is invalid: ' + relativePath);
    if (seenHashes.has(normalizedHash))
      throw new Error('Duplicate photo hash in manifest: ' + relativePath);
    if (seenPaths.has(relativePath))
      throw new Error('Duplicate photo path in manifest: ' + relativePath);
    seenHashes.add(normalizedHash);
    seenPaths.add(relativePath);
    return {
      file,
      relativePath,
      sha256: normalizedHash,
      bytes,
      format,
      split,
      label: null,
      review: 'pending',
    };
  });

  return {
    version: 1,
    createdAt: new Date(createdAt).toISOString(),
    source: 'owner-provided',
    consent: 'owner-confirmed',
    seed,
    counts: {
      photos: normalized.length,
      train: normalized.filter((photo) => photo.split === 'train').length,
      test: normalized.filter((photo) => photo.split === 'test').length,
      duplicates,
    },
    photos: normalized,
  };
}

/**
 * Refuse unsafe output locations: anywhere inside a Git worktree, a symlink,
 * a non-directory, or a non-empty directory without --force.
 *
 * @param {string} outputDir
 * @param {{ repoRoot?: string, force?: boolean }} [options]
 * @returns {Promise<string>} resolved real output path
 */
export async function assertSafeOutput(
  outputDir,
  { repoRoot = REPOSITORY_ROOT, force = false } = {},
) {
  if (typeof outputDir !== 'string' || outputDir.trim().length === 0)
    throw new Error('An output directory is required');
  const absolute = resolve(outputDir);
  const real = await realPathFor(absolute);
  const repository = await realpath(repoRoot);

  if (inside(repository, real))
    throw new Error('Output must be outside the repository.');
  if (repositoryAncestor(real))
    throw new Error('Output must be outside every Git worktree.');

  if (existsSync(absolute)) {
    const info = await lstat(absolute);
    if (info.isSymbolicLink())
      throw new Error('Output must not be a symbolic link.');
    if (!info.isDirectory())
      throw new Error('Output path exists and is not a directory.');
    const entries = await readdir(absolute);
    if (entries.length > 0 && !force)
      throw new Error(
        'Output directory is not empty. Pass --force to replace manifest.json and README.md.',
      );
  }

  return real;
}

/** Recursively list supported image files, ignoring hidden entries and symlinks. */
async function collectImages(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await visit(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = extname(entry.name).slice(1).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) continue;
      const relativePath = relative(root, full).split(sep).join('/');
      if (
        relativePath.length === 0 ||
        isAbsolute(relativePath) ||
        relativePath.split('/').some((part) => part === '..' || part === '')
      )
        throw new Error('Unsafe relative photo path.');
      files.push({ full, relativePath, extension });
    }
  }
  await visit(root);
  return files.sort(comparePaths);
}

/** Resolve and validate the input directory, which must stay outside Git. */
async function resolveInput(inputDir) {
  if (typeof inputDir !== 'string' || inputDir.trim().length === 0)
    throw new Error('An input directory is required');
  let real;
  try {
    real = await realpath(resolve(inputDir));
  } catch {
    throw new Error('Input directory does not exist or is inaccessible.');
  }
  if (!(await stat(real)).isDirectory())
    throw new Error('Input path must be a directory.');
  if (repositoryAncestor(real))
    throw new Error('Input photos must be outside every Git worktree.');
  return real;
}

function parseArguments(argv) {
  let input = null;
  let out = null;
  let seed = DEFAULT_SEED;
  let force = false;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument === '--force') {
      force = true;
      continue;
    }
    if (argument === '--out' || argument === '--seed') {
      const value = argv[index + 1];
      if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.startsWith('--')
      )
        throw new Error(argument + ' requires a value');
      index++;
      if (argument === '--out') out = value;
      else seed = value;
      continue;
    }
    if (argument.startsWith('-'))
      throw new Error('Unknown option: ' + argument);
    if (input !== null) throw new Error('Only one input directory is allowed');
    input = argument;
  }

  if (!input) throw new Error('An input directory is required');
  if (seed.trim().length === 0 || seed.length > MAX_SEED_LENGTH)
    throw new Error('Seed must be 1-' + MAX_SEED_LENGTH + ' characters');
  return { input, out, seed, force };
}

function usage() {
  return [
    'Usage: node scripts/prepare-owner-dataset.mjs <input-dir>',
    '  [--out <private-dir>] [--seed <string>] [--force]',
    '',
    'Default output: ~/.e-binder-private/card-dataset-YYYY-MM-DD',
  ].join('\n');
}

/** Replace a regular file without ever following an existing symlink. */
async function writePrivateFile(directory, name, contents) {
  const target = join(directory, name);
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isFile())
      throw new Error('Refusing to replace a non-regular file: ' + name);
    await unlink(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await writeFile(target, contents, { mode: 0o600, flag: 'wx' });
}

function datasetReadme({ manifest }) {
  const { counts, seed, createdAt } = manifest;
  return [
    '# Private E-Binder owner dataset',
    '',
    'Created: ' + createdAt,
    'Source: owner-provided',
    'Consent: owner-confirmed',
    'Seed: ' + seed,
    '',
    'Photos: ' +
      counts.photos +
      ' unique (train ' +
      counts.train +
      ', test ' +
      counts.test +
      '); duplicate files skipped: ' +
      counts.duplicates +
      '.',
    '',
    '## Privacy rules',
    '',
    '- This directory is private. Never commit it, copy it into a public repository,',
    '  or upload it to a public bucket.',
    '- The preparation script did not copy, modify, upload, or commit any image.',
    '- No image bytes were written here; only `manifest.json` and this README exist.',
    '- EXIF metadata, absolute paths, account IDs, and OCR text are not stored.',
    '- Keep the dataset and any Supabase service key outside every Git worktree.',
    '',
    '## Splits',
    '',
    'Each unique SHA-256 receives a deterministic train/test assignment from the',
    'photo hash and the seed above. Identical photos are deduplicated before the',
    'split, so one photo can never appear in both splits. Small collections can',
    'deviate from an exact 80/20 ratio; that is expected.',
    '',
    '## Labeling later',
    '',
    'Every photo starts with `label: null` and `review: "pending"`. A later',
    'private review may attach an independently verified exact printing',
    '(`tcgdexId` plus language) and set `review` to `"verified"`. OCR output, a',
    'filename, or a listing title alone is not a verified label. Do not move a',
    'photo between splits after labels are added; rebuild the manifest instead.',
    '',
    '## Benchmark seed',
    '',
    'This manifest can seed private scanner and recognition benchmarks. Keep the',
    'train/test boundary fixed, report metrics by split, and never train on the',
    'test split. Benchmark reports must contain aggregate metrics only, not photo',
    'paths or image bytes.',
    '',
  ].join('\n');
}

async function prepare({ input, out, seed, force }) {
  const inputRoot = await resolveInput(input);
  const date = new Date().toISOString().slice(0, 10);
  const outputDirectory = await assertSafeOutput(
    out ?? join(homedir(), '.e-binder-private', 'card-dataset-' + date),
    { force },
  );

  if (inside(inputRoot, outputDirectory) || inside(outputDirectory, inputRoot))
    throw new Error(
      'Input and output directories must not overlap. Choose a separate private directory.',
    );

  const candidates = await collectImages(inputRoot);
  if (candidates.length === 0)
    throw new Error('No supported image files were found.');

  const invalid = [];
  const photos = [];
  const hashes = new Map();
  let duplicates = 0;

  for (const candidate of candidates) {
    let bytes;
    try {
      bytes = await readFile(candidate.full);
    } catch {
      invalid.push(candidate.relativePath + ' (unreadable)');
      continue;
    }
    const format = detectImageFormat(bytes);
    const expected = SUPPORTED_EXTENSIONS.get(candidate.extension);
    const family = format === 'heic' ? 'heif' : format;
    if (!format || family !== expected) {
      invalid.push(candidate.relativePath);
      continue;
    }
    const sha256 = await hashFile(bytes);
    if (hashes.has(sha256)) {
      duplicates++;
      continue;
    }
    hashes.set(sha256, candidate.relativePath);
    photos.push({
      file: basename(candidate.relativePath),
      relativePath: candidate.relativePath,
      sha256,
      bytes: bytes.length,
      format,
      split: splitForHash(sha256, seed),
    });
  }

  if (invalid.length > 0) {
    const preview = invalid.slice(0, 5).join(', ');
    throw new Error(
      invalid.length +
        ' image file(s) failed magic-byte, extension, or readability validation: ' +
        preview +
        (invalid.length > 5 ? ', …' : ''),
    );
  }
  if (photos.length === 0)
    throw new Error('No unique valid photos remain after deduplication.');

  const manifest = buildManifest({ photos, seed, duplicates });
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await writePrivateFile(
    outputDirectory,
    'manifest.json',
    JSON.stringify(manifest, null, 2) + '\n',
  );
  await writePrivateFile(
    outputDirectory,
    'README.md',
    datasetReadme({ manifest }),
  );

  return { manifest, outputDirectory };
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.help) {
    console.log(usage());
    return;
  }
  const { manifest, outputDirectory } = await prepare(parsed);
  console.log('Owner dataset prepared.');
  console.log(
    '  Photos: ' +
      manifest.counts.photos +
      ' unique (train ' +
      manifest.counts.train +
      ', test ' +
      manifest.counts.test +
      ')',
  );
  console.log('  Duplicates skipped: ' + manifest.counts.duplicates);
  console.log('  Output: ' + outputDirectory);
  console.log('  Manifest: ' + join(outputDirectory, 'manifest.json'));
  console.log('No image was copied, modified, or uploaded.');
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error('Owner dataset preparation failed: ' + error.message);
    process.exitCode = 1;
  });
}
