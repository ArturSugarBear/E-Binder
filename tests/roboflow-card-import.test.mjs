import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  imageKind,
  normalizeCardBoxes,
  stableSplit,
} from '../scripts/roboflow-card-import.mjs';

test('Roboflow pixel-center boxes convert into unclipped COCO xywh', () => {
  assert.deepEqual(
    normalizeCardBoxes(
      [{ class: 'cards', x: 100, y: 150, width: 100, height: 200 }],
      200, 300,
    ),
    [[50, 50, 100, 200]],
  );
});

test('card-only importer rejects labels for name or collector-number regions', () => {
  assert.deepEqual(normalizeCardBoxes([
    { class: 'Name', x: 10, y: 10, width: 8, height: 8 },
    { class: 'cards', x: 50, y: 50, width: 50, height: 60 },
  ], 100, 100), [[25, 20, 50, 60]]);
});

test('source boundary drift of less than one pixel clips but a wrong box fails', () => {
  assert.deepEqual(
    normalizeCardBoxes([
      { class: 'trading-cards', x: 50.0025, y: 50, width: 100.005, height: 100 },
    ], 100, 100),
    [[0, 0, 100, 100]],
  );
  assert.throws(() => normalizeCardBoxes([
    { class: 'card', x: 102, y: 20, width: 20, height: 20 },
  ], 100, 100), /outside/);
});

test('unknown annotation formats fail closed instead of fabricating card boxes', () => {
  assert.throws(() => normalizeCardBoxes({}, 400, 600), /schema/);
  assert.throws(() => normalizeCardBoxes([], NaN, 100), /dimensions/);
  assert.throws(() => normalizeCardBoxes([
    { class: 'cards', x: 5, y: 5, width: -1, height: 10 },
  ], 100, 100), /Invalid/);
});

test('split is deterministic for identical image bytes regardless of Roboflow ID', () => {
  const a = createHash('sha256').update('example original card photo').digest('hex');
  assert.equal(stableSplit(a), stableSplit(a));
  assert.ok(['train', 'valid', 'test'].includes(stableSplit(a)));
  assert.throws(() => stableSplit('fake-image-id'), /SHA/);
});

test('image signatures prevent text or HTML being imported as photos', () => {
  assert.equal(imageKind(Buffer.from([0xff, 0xd8, 0xff])).ext, 'jpg');
  assert.equal(imageKind(Buffer.from('89504e470d0a1a0a', 'hex')).ext, 'png');
  assert.equal(imageKind(Buffer.concat([
    Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'),
  ])).ext, 'webp');
  assert.throws(() => imageKind(Buffer.from('<html>')), /unsupported/);
});
