import { expect, it } from 'vitest';
import {
  captureCardSignature,
  cardSignatureDistance,
  nextCardChange,
} from '../../src/domain/card-change';
import type { Quad } from '../../src/domain/photo-geometry';

const width = 192;
const height = 256;
const corners: Quad = [
  { x: 31 / width, y: 31 / height },
  { x: 161 / width, y: 31 / height },
  { x: 161 / width, y: 225 / height },
  { x: 31 / width, y: 225 / height },
];

function patternedCard(
  seed: number,
  brightness = 0,
  scale = 1,
  shift = 0,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const nx = x - shift;
      const ny = y - shift;
      const art =
        nx > 31 && nx < 161 && ny > 31 && ny < 225
          ? (Math.sin((nx + seed * 31) * 0.12) +
              Math.cos((ny + seed * 13) * 0.083) +
              Math.sin((nx + ny) * 0.053 + seed * 11)) *
              42 +
            125
          : 195;
      const value = Math.min(
        255,
        Math.max(0, art * scale + brightness),
      );
      const offset = (y * width + x) * 4;
      rgba[offset] = value;
      rgba[offset + 1] = value;
      rgba[offset + 2] = value;
      rgba[offset + 3] = 255;
    }
  return rgba;
}

function fingerprint(
  seed: number,
  brightness = 0,
  scale = 1,
  shift = 0,
) {
  return captureCardSignature(
    patternedCard(seed, brightness, scale, shift),
    width,
    height,
    corners,
  );
}

it('keeps the same card latched despite brightness and slight camera movement', () => {
  const original = fingerprint(4);
  const relit = fingerprint(4, 15, 0.9, 2);
  expect(original).not.toBeNull();
  expect(cardSignatureDistance(original, relit)).toBeLessThan(0.12);
  let state = { frames: 0, previous: null as Float32Array | null };
  for (let i = 0; i < 5; i++)
    state = nextCardChange(state, original, relit);
  expect(state.frames).toBe(0);
});

it('rearms only after three stable frames of a different physical card', () => {
  const previous = fingerprint(4);
  const replacement = fingerprint(10);
  let state = { frames: 0, previous: null as Float32Array | null };
  expect(cardSignatureDistance(previous, replacement)).toBeGreaterThan(0.55);
  for (let i = 1; i <= 3; i++) {
    state = nextCardChange(state, previous, replacement);
    expect(state.frames).toBe(i);
  }
});

it('discards an unstable transient instead of duplicating a capture', () => {
  const original = fingerprint(4);
  let state = { frames: 0, previous: null as Float32Array | null };
  state = nextCardChange(state, original, fingerprint(10));
  state = nextCardChange(state, original, fingerprint(11));
  expect(state.frames).toBe(1);
  state = nextCardChange(state, original, original);
  expect(state.frames).toBe(0);
});

it('never unlocks from empty, malformed or featureless frames', () => {
  const blank = new Uint8ClampedArray(width * height * 4);
  const empty = captureCardSignature(blank, width, height, corners);
  expect(empty).toBeNull();
  expect(
    captureCardSignature(blank, width - 1, height, corners),
  ).toBeNull();
  expect(cardSignatureDistance(fingerprint(4), empty)).toBeNull();
  expect(
    nextCardChange(
      { frames: 2, previous: fingerprint(10) },
      fingerprint(4),
      empty,
    ).frames,
  ).toBe(0);
});
