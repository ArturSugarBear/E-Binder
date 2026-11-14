import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSafeOutput,
  buildManifest,
  detectImageFormat,
  hashFile,
  splitForHash,
} from '../../scripts/prepare-owner-dataset.mjs';

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL('../../scripts/prepare-owner-dataset.mjs', import.meta.url),
);
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'owner-dataset-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function jpeg(payload = 'jpeg') {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    Buffer.from('JFIF\0', 'latin1'),
    Buffer.from(payload),
  ]);
}

function png(payload = 'png') {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(payload),
  ]);
}

function webp(payload = 'webp') {
  const data = Buffer.from(payload);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(data.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, data]);
}

function heic(brand = 'heic', compatible = 'mif1') {
  const header = Buffer.alloc(24);
  header.writeUInt32BE(24, 0);
  header.write('ftyp', 4, 'latin1');
  header.write(brand, 8, 'latin1');
  header.writeUInt32BE(0, 12);
  header.write(compatible, 16, 'latin1');
  header.write('heic', 20, 'latin1');
  return header;
}

async function runCli(args) {
  try {
    const result = await execFileAsync(
      process.execPath,
      [scriptPath, ...args],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
      },
    );
    return { code: 0, ...result };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('detectImageFormat', () => {
  it('recognises each supported container from magic bytes', () => {
    expect(detectImageFormat(jpeg())).toBe('jpeg');
    expect(detectImageFormat(png())).toBe('png');
    expect(detectImageFormat(webp())).toBe('webp');
    expect(detectImageFormat(heic('heic'))).toBe('heic');
    expect(detectImageFormat(heic('mif1', 'msf1'))).toBe('heif');
    expect(detectImageFormat(heic('mif1', 'heic'))).toBe('heif');
  });

  it('rejects text, empty and truncated inputs', () => {
    expect(detectImageFormat(Buffer.from('not an image'))).toBeNull();
    expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
    expect(detectImageFormat(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(detectImageFormat(webp().subarray(0, 8))).toBeNull();
    expect(detectImageFormat(Buffer.from('RIFF0000AVI '))).toBeNull();
  });
});

describe('hashFile', () => {
  it('hashes file bytes and accepts an in-memory buffer', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'photo.jpg');
    const bytes = jpeg('hash-me');
    await writeFile(path, bytes);
    const expected = createHash('sha256').update(bytes).digest('hex');
    await expect(hashFile(path)).resolves.toBe(expected);
    await expect(hashFile(bytes)).resolves.toBe(expected);
  });
});

describe('splitForHash', () => {
  it('is deterministic, seeded and limited to the two splits', () => {
    const hashes = Array.from({ length: 32 }, (_, index) =>
      createHash('sha256')
        .update('photo-' + index)
        .digest('hex'),
    );
    const first = hashes.map((hash) => splitForHash(hash, 'seed-a'));
    const repeated = hashes.map((hash) => splitForHash(hash, 'seed-a'));
    const otherSeed = hashes.map((hash) => splitForHash(hash, 'seed-b'));

    expect(first).toEqual(repeated);
    expect(first.every((split) => ['train', 'test'].includes(split))).toBe(
      true,
    );
    expect(new Set(first)).toEqual(new Set(['train', 'test']));
    expect(otherSeed).not.toEqual(first);
  });

  it('rejects invalid digests and seeds', () => {
    expect(() => splitForHash('abc', 'seed')).toThrow(/SHA-256/);
    expect(() => splitForHash('f'.repeat(64), '')).toThrow(/seed/);
    expect(() => splitForHash('f'.repeat(64), 'x'.repeat(201))).toThrow(
      /too long/,
    );
  });
});

describe('buildManifest', () => {
  const photo = {
    file: 'card.jpg',
    relativePath: 'session-a/card.jpg',
    sha256: 'a'.repeat(64),
    bytes: 123,
    format: 'jpeg',
    split: 'train',
  };

  it('emits the exact versioned contract with pending labels', () => {
    const manifest = buildManifest({
      seed: 'test-seed',
      createdAt: '2026-11-14T12:00:00.000Z',
      duplicates: 2,
      photos: [photo],
    });

    expect(Object.keys(manifest)).toEqual([
      'version',
      'createdAt',
      'source',
      'consent',
      'seed',
      'counts',
      'photos',
    ]);
    expect(manifest).toMatchObject({
      version: 1,
      source: 'owner-provided',
      consent: 'owner-confirmed',
      seed: 'test-seed',
      counts: { photos: 1, train: 1, test: 0, duplicates: 2 },
    });
    expect(manifest.photos[0]).toEqual({
      ...photo,
      label: null,
      review: 'pending',
    });
    expect(JSON.stringify(manifest)).not.toContain('/tmp/');
  });

  it('sorts photos deterministically and rejects duplicate hashes', () => {
    const manifest = buildManifest({
      seed: 'test-seed',
      createdAt: '2026-11-14T12:00:00.000Z',
      photos: [
        {
          ...photo,
          file: 'b.jpg',
          relativePath: 'b.jpg',
          sha256: 'b'.repeat(64),
        },
        photo,
      ],
    });
    expect(manifest.photos.map((item) => item.relativePath)).toEqual([
      'b.jpg',
      'session-a/card.jpg',
    ]);

    expect(() =>
      buildManifest({
        seed: 'test-seed',
        photos: [
          photo,
          { ...photo, relativePath: 'other.jpg', file: 'other.jpg' },
        ],
      }),
    ).toThrow(/Duplicate photo hash/);
  });

  it('rejects absolute or traversing relative paths', () => {
    expect(() =>
      buildManifest({
        seed: 'seed',
        photos: [
          { ...photo, relativePath: '/etc/photo.jpg', file: 'photo.jpg' },
        ],
      }),
    ).toThrow(/relative POSIX path/);
    expect(() =>
      buildManifest({
        seed: 'seed',
        photos: [{ ...photo, relativePath: '../photo.jpg', file: 'photo.jpg' }],
      }),
    ).toThrow(/relative POSIX path/);
  });
});

describe('assertSafeOutput', () => {
  it('accepts a private directory outside the repository', async () => {
    const directory = await temporaryDirectory();
    const output = join(directory, 'nested', 'dataset');
    const expected = join(await realpath(directory), 'nested', 'dataset');
    await expect(assertSafeOutput(output)).resolves.toBe(expected);
  });

  it('refuses any path inside the repository', async () => {
    await expect(
      assertSafeOutput(join(repositoryRoot, '.owner-dataset-test-output')),
    ).rejects.toThrow(/outside the repository/);
    await expect(assertSafeOutput(repositoryRoot)).rejects.toThrow(
      /outside the repository/,
    );
  });

  it('refuses non-empty output without force and allows it with force', async () => {
    const directory = await temporaryDirectory();
    const output = join(directory, 'dataset');
    await mkdir(output);
    await writeFile(join(output, 'keep.txt'), 'keep');
    await expect(assertSafeOutput(output)).rejects.toThrow(/not empty/);
    await expect(assertSafeOutput(output, { force: true })).resolves.toBe(
      output,
    );
  });

  it('refuses a symlinked output directory', async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, 'target');
    const link = join(directory, 'link');
    await mkdir(target);
    await symlink(target, link);
    await expect(assertSafeOutput(link)).rejects.toThrow(/symbolic link/);
  });
});

describe('prepare-owner-dataset CLI', () => {
  async function createInput() {
    const directory = await temporaryDirectory();
    const input = join(directory, 'photos');
    await mkdir(join(input, 'session-a'), { recursive: true });
    await mkdir(join(input, '.hidden-directory'), { recursive: true });
    await writeFile(join(input, 'card-1.jpg'), jpeg('one'));
    await writeFile(join(input, 'duplicate.jpg'), jpeg('one'));
    await writeFile(join(input, 'session-a', 'card-2.png'), png('two'));
    await writeFile(join(input, 'session-a', 'card-3.webp'), webp('three'));
    await writeFile(join(input, '.hidden.jpg'), jpeg('hidden'));
    await writeFile(
      join(input, '.hidden-directory', 'hidden.jpg'),
      jpeg('hidden-directory'),
    );
    await writeFile(join(input, 'notes.txt'), 'not an image');
    await symlink(join(input, 'card-1.jpg'), join(input, 'linked.jpg'));
    return { directory, input };
  }

  it('deduplicates, splits and writes only a manifest plus README', async () => {
    const { directory, input } = await createInput();
    const output = join(directory, 'private', 'dataset');
    const result = await runCli([
      input,
      '--out',
      output,
      '--seed',
      'owner-test-seed',
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect((await readdir(output)).sort()).toEqual([
      'README.md',
      'manifest.json',
    ]);

    const manifest = JSON.parse(
      await readFile(join(output, 'manifest.json'), 'utf8'),
    );
    expect(manifest).toMatchObject({
      version: 1,
      source: 'owner-provided',
      consent: 'owner-confirmed',
      seed: 'owner-test-seed',
      counts: { photos: 3, duplicates: 1 },
    });
    expect(manifest.counts.train + manifest.counts.test).toBe(3);
    expect(manifest.photos).toHaveLength(3);
    expect(manifest.photos.map((photo) => photo.relativePath)).toEqual([
      'card-1.jpg',
      'session-a/card-2.png',
      'session-a/card-3.webp',
    ]);
    expect(manifest.photos.map((photo) => photo.format)).toEqual([
      'jpeg',
      'png',
      'webp',
    ]);
    expect(manifest.photos.every((photo) => photo.label === null)).toBe(true);
    expect(manifest.photos.every((photo) => photo.review === 'pending')).toBe(
      true,
    );
    expect(new Set(manifest.photos.map((photo) => photo.sha256)).size).toBe(3);
    expect(
      manifest.photos.every((photo) => ['train', 'test'].includes(photo.split)),
    ).toBe(true);

    const manifestText = JSON.stringify(manifest);
    expect(manifestText).not.toContain(directory);
    expect(manifestText).not.toContain(input);
    expect(manifestText).not.toContain(output);
    expect(manifestText).not.toMatch(/"\/(home|tmp|workspaces)\//);

    const readme = await readFile(join(output, 'README.md'), 'utf8');
    expect(readme).toContain('Never commit');
    expect(readme).not.toContain(directory);
    expect(readme).not.toContain(input);
    expect(readme).not.toContain(output);
  });

  it('assigns identical splits on repeated runs with the same seed', async () => {
    const { directory, input } = await createInput();
    const firstOutput = join(directory, 'first');
    const secondOutput = join(directory, 'second');

    expect(
      (await runCli([input, '--out', firstOutput, '--seed', 'stable-seed']))
        .code,
    ).toBe(0);
    expect(
      (await runCli([input, '--out', secondOutput, '--seed', 'stable-seed']))
        .code,
    ).toBe(0);

    const first = JSON.parse(
      await readFile(join(firstOutput, 'manifest.json'), 'utf8'),
    );
    const second = JSON.parse(
      await readFile(join(secondOutput, 'manifest.json'), 'utf8'),
    );
    expect(
      first.photos.map(({ relativePath, split }) => ({ relativePath, split })),
    ).toEqual(
      second.photos.map(({ relativePath, split }) => ({ relativePath, split })),
    );
  });

  it('refuses to overwrite and preserves unrelated files with --force', async () => {
    const { directory, input } = await createInput();
    const output = join(directory, 'dataset');

    expect((await runCli([input, '--out', output])).code).toBe(0);
    const original = await readFile(join(output, 'manifest.json'), 'utf8');
    await writeFile(join(output, 'keep.txt'), 'keep');

    const refused = await runCli([input, '--out', output]);
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toMatch(/not empty/);
    expect(await readFile(join(output, 'manifest.json'), 'utf8')).toBe(
      original,
    );

    const forced = await runCli([input, '--out', output, '--force']);
    expect(forced.code).toBe(0);
    expect(await readFile(join(output, 'keep.txt'), 'utf8')).toBe('keep');
  });

  it('does not follow a symlinked manifest with --force', async () => {
    const { directory, input } = await createInput();
    const output = join(directory, 'dataset');
    await mkdir(output);
    await writeFile(join(output, 'keep.txt'), 'keep');
    await symlink(join(output, 'keep.txt'), join(output, 'manifest.json'));

    const result = await runCli([input, '--out', output, '--force']);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/non-regular file/);
    expect(await readFile(join(output, 'keep.txt'), 'utf8')).toBe('keep');
  });

  it('exits non-zero for an unsafe output inside the repository', async () => {
    const { input } = await createInput();
    const unsafe = join(repositoryRoot, '.owner-dataset-test-output');
    const result = await runCli([input, '--out', unsafe]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/outside the repository/);
    expect(await exists(unsafe)).toBe(false);
  });

  it('exits non-zero for invalid magic bytes without writing output', async () => {
    const directory = await temporaryDirectory();
    const input = join(directory, 'photos');
    const output = join(directory, 'dataset');
    await mkdir(input);
    await writeFile(join(input, 'fake.jpg'), 'this is not a JPEG');

    const result = await runCli([input, '--out', output]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/failed magic-byte/);
    expect(await exists(output)).toBe(false);
  });

  it('exits non-zero when no supported images exist', async () => {
    const directory = await temporaryDirectory();
    const input = join(directory, 'photos');
    const output = join(directory, 'dataset');
    await mkdir(input);
    await writeFile(join(input, 'notes.txt'), 'nothing here');

    const result = await runCli([input, '--out', output]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/No supported image files/);
    expect(await exists(output)).toBe(false);
  });

  it('refuses overlapping input and output directories', async () => {
    const { input } = await createInput();
    const result = await runCli([input, '--out', join(input, 'private')]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/must not overlap/);
    expect(await exists(join(input, 'private'))).toBe(false);
  });
});
