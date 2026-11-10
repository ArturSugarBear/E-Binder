import { afterEach, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const verifier = resolve('scripts/verify-competitor-media.mjs');
const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'e-binder-competitor-media-'));
  temporary.push(cwd);
  const root = join(cwd, 'docs/benchmarks/competitors/2026-11-10');
  mkdirSync(root, { recursive: true });
  // Synthetic bytes test integrity checks, not real media or video decoding.
  const assets = Array.from({ length: 18 }, (_, index) => {
    const bytes = Buffer.from(`synthetic reference ${index}`);
    const path = `reference-${index}.jpg`;
    writeFileSync(join(root, path), bytes);
    return {
      path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  const manifest = () =>
    writeFileSync(
      join(root, 'media-manifest.json'),
      JSON.stringify({ assets }),
    );
  const run = () => {
    manifest();
    return spawnSync(process.execPath, [verifier], { cwd, encoding: 'utf8' });
  };
  return { cwd, root, assets, run };
}

it('requires 18 distinct files with matching size and SHA-256', () => {
  const { run } = fixture();
  const result = run();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('18/18 benchmark media verified');
});

it.each([0, 17])('rejects a partial manifest with %i entries', (count) => {
  const { assets, run } = fixture();
  assets.length = count;
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Expected exactly 18');
});

it('rejects aliases of the same file instead of counting it twice', () => {
  const { assets, run } = fixture();
  assets[17] = { ...assets[0]!, path: './reference-0.jpg' };
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Duplicate benchmark file path');
});

it('reports missing and altered files without a successful result', () => {
  const { root, run } = fixture();
  rmSync(join(root, 'reference-0.jpg'));
  writeFileSync(join(root, 'reference-1.jpg'), 'synthetic reference X');
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('MISSING: reference-0.jpg');
  expect(result.stderr).toContain('MISMATCH: reference-1.jpg');
  expect(result.stdout).toContain('16/18 benchmark media verified');
});

it('rejects a path outside the benchmark directory', () => {
  const { assets, run } = fixture();
  assets[0]!.path = '../outside.jpg';
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Unsafe benchmark file path');
});

it('rejects a symlink to bytes outside the benchmark directory', () => {
  const { cwd, root, run } = fixture();
  writeFileSync(join(cwd, 'outside.jpg'), 'synthetic reference 0');
  rmSync(join(root, 'reference-0.jpg'));
  symlinkSync(join(cwd, 'outside.jpg'), join(root, 'reference-0.jpg'));
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('resolves outside media root');
});
