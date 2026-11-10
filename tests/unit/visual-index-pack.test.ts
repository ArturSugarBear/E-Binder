import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

it('packs a model-versioned int8 corpus with verifiable checksums', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e-binder-visual-test-'));
  try {
    const modelFile = join(dir, 'test.onnx');
    const source = join(dir, 'vectors.json');
    const destination = join(dir, 'built');
    // Fixture bytes only, deliberately not a real ONNX model or a production asset.
    writeFileSync(modelFile, Buffer.alloc(1100, 0xab));
    writeFileSync(
      source,
      JSON.stringify({
        modelId: 'test-model-1',
        references: [
          {
            id: 'de:sv01-211',
            language: 'de',
            setId: 'sv01',
            number: '211/198',
            vector: Array.from({ length: 384 }, (_, i) => (i % 2 ? -0.5 : 0.5)),
          },
          {
            id: 'ja:SV2a-001',
            language: 'ja',
            setId: 'SV2a',
            number: '001/165',
            vector: Array.from({ length: 384 }, (_, i) =>
              i % 2 ? 0.25 : -0.25,
            ),
          },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [
        resolve('scripts/pack-visual-index.mjs'),
        source,
        modelFile,
        destination,
      ],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    const manifest = JSON.parse(
      readFileSync(join(destination, 'manifest.json'), 'utf8'),
    );
    expect(manifest).toMatchObject({
      format: 'e-binder-visual-v1',
      modelId: 'test-model-1',
      dimensions: 384,
      count: 2,
      preprocessing: 'rgb-0-1-chw-stretch',
    });
    expect(manifest.indexFile).toContain('test-model-1');
    const bytes = readFileSync(join(destination, manifest.indexFile));
    expect(bytes).toHaveLength(768);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      manifest.indexSha256,
    );
    const references = readFileSync(join(destination, manifest.referencesFile));
    expect(createHash('sha256').update(references).digest('hex')).toBe(
      manifest.referencesSha256,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
