import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  imageKind,
  importFork,
  normalizeCardBoxes,
  stableSplit,
} from '../scripts/roboflow-card-import.mjs';

test('Roboflow pixel-center boxes convert into unclipped COCO xywh', () => {
  assert.deepEqual(
    normalizeCardBoxes(
      [{ class: 'cards', x: 100, y: 150, width: 100, height: 200 }],
      200,
      300,
    ),
    [[50, 50, 100, 200]],
  );
});

test('card-only importer rejects labels for name or collector-number regions', () => {
  assert.deepEqual(
    normalizeCardBoxes(
      [
        { class: 'Name', x: 10, y: 10, width: 8, height: 8 },
        { class: 'cards', x: 50, y: 50, width: 50, height: 60 },
      ],
      100,
      100,
    ),
    [[25, 20, 50, 60]],
  );
});

test('source boundary drift of less than one pixel clips but a wrong box fails', () => {
  assert.deepEqual(
    normalizeCardBoxes(
      [
        {
          class: 'trading-cards',
          x: 50.0025,
          y: 50,
          width: 100.005,
          height: 100,
        },
      ],
      100,
      100,
    ),
    [[0, 0, 100, 100]],
  );
  assert.throws(
    () =>
      normalizeCardBoxes(
        [{ class: 'card', x: 102, y: 20, width: 20, height: 20 }],
        100,
        100,
      ),
    /outside/,
  );
});

test('unknown annotation formats fail closed instead of fabricating card boxes', () => {
  assert.throws(() => normalizeCardBoxes({}, 400, 600), /schema/);
  assert.throws(() => normalizeCardBoxes([], NaN, 100), /dimensions/);
  assert.throws(
    () =>
      normalizeCardBoxes(
        [{ class: 'cards', x: 5, y: 5, width: -1, height: 10 }],
        100,
        100,
      ),
    /Invalid/,
  );
});

test('split is deterministic for identical image bytes regardless of Roboflow ID', () => {
  const a = createHash('sha256')
    .update('example original card photo')
    .digest('hex');
  assert.equal(stableSplit(a), stableSplit(a));
  assert.ok(['train', 'valid', 'test'].includes(stableSplit(a)));
  assert.throws(() => stableSplit('fake-image-id'), /SHA/);
});

test('image signatures prevent text or HTML being imported as photos', () => {
  assert.equal(imageKind(Buffer.from([0xff, 0xd8, 0xff])).ext, 'jpg');
  assert.equal(imageKind(Buffer.from('89504e470d0a1a0a', 'hex')).ext, 'png');
  assert.equal(
    imageKind(
      Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('WEBP'),
      ]),
    ).ext,
    'webp',
  );
  assert.throws(() => imageKind(Buffer.from('<html>')), /unsupported/);
});

test('real Roboflow image-detail schema builds private COCO splits end to end', async () => {
  const dest = await mkdtemp(join(tmpdir(), 'ebinder-roboflow-mock-'));
  const nativeFetch = globalThis.fetch;
  const oldKey = process.env.ROBOFLOW_API_KEY;
  process.env.ROBOFLOW_API_KEY = 'mock-key-not-a-real-credential';
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/mock/fork') {
      return Response.json({ license: 'CC BY 4.0' });
    }
    if (url.pathname === '/mock/fork/search') {
      return Response.json({
        results: [{ id: 'demo-a' }, { id: 'demo-b' }],
      });
    }
    if (url.pathname.startsWith('/mock/fork/images/')) {
      const id = url.pathname.split('/').at(-1);
      return Response.json({
        image: {
          urls: { original: 'https://cdn.example.org/' + id + '.jpg' },
          annotation: {
            width: 100,
            height: 120,
            boxes: [
              { label: 'cards', x: 50, y: 60, width: 80, height: 100 },
            ],
          },
        },
      });
    }
    if (url.hostname === 'cdn.example.org') {
      const id = url.pathname.includes('demo-a') ? 97 : 98;
      return new Response(Buffer.from([0xff, 0xd8, 0xff, id]));
    }
    throw new Error('Unexpected external request');
  };
  try {
    await importFork('mock/fork', dest, 2);
    const datasets = await Promise.all(
      ['train', 'valid', 'test'].map(async (split) =>
        JSON.parse(
          await readFile(join(dest, split, '_annotations.coco.json'), 'utf8'),
        ),
      ),
    );
    assert.equal(
      datasets.reduce((sum, data) => sum + data.images.length, 0),
      2,
    );
    assert.equal(
      datasets.reduce((sum, data) => sum + data.annotations.length, 0),
      2,
    );
    for (const data of datasets) {
      assert.deepEqual(data.categories, [
        { id: 1, name: 'card', supercategory: 'trading-card' },
      ]);
      for (const annotation of data.annotations) {
        assert.deepEqual(annotation.bbox, [10, 10, 80, 100]);
      }
    }
    const report = JSON.parse(
      await readFile(join(dest, 'private-provenance.json'), 'utf8'),
    );
    assert.equal(report.savedImages, 2);
    assert.equal(report.detectedBoxes, 2);
    assert.equal(report.declaredLicense, 'CC BY 4.0');
  } finally {
    globalThis.fetch = nativeFetch;
    if (oldKey === undefined) delete process.env.ROBOFLOW_API_KEY;
    else process.env.ROBOFLOW_API_KEY = oldKey;
    await rm(dest, { recursive: true, force: true });
  }
});
