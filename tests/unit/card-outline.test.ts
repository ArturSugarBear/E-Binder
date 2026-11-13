import { expect, it } from 'vitest';
import {
  detectCardCorners,
  suggestCardCorners,
} from '../../src/domain/card-outline';

function frame(
  kind: 'card' | 'blank' | 'square' | 'landscape' | 'partial',
): Uint8ClampedArray {
  const width = 192;
  const height = 256;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const region =
    kind === 'card'
      ? [31, 31, 161, 225]
      : kind === 'square'
        ? [20, 52, 172, 204]
        : kind === 'landscape'
          ? [19, 77, 173, 179]
          : kind === 'partial'
            ? [0, 31, 135, 225]
            : null;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const n = (y * width + x) * 4;
      let tone = 224;
      if (
        region &&
        x >= region[0]! &&
        x < region[2]! &&
        y >= region[1]! &&
        y < region[3]!
      ) {
        const border =
          x < region[0]! + 7 ||
          x >= region[2]! - 7 ||
          y < region[1]! + 7 ||
          y >= region[3]! - 7;
        tone = border ? 18 : 105;
      }
      rgba[n] = tone;
      rgba[n + 1] = tone;
      rgba[n + 2] = tone;
      rgba[n + 3] = 255;
    }
  return rgba;
}

it('recognizes a centered physical card rather than requiring a full binder page', () => {
  const result = suggestCardCorners(frame('card'), 192, 256);
  expect(result).not.toBeNull();
  expect(result![0]!.x).toBeGreaterThan(0.1);
  expect(result![0]!.x).toBeLessThan(0.27);
  expect(result![0]!.y).toBeGreaterThan(0.07);
  expect(result![0]!.y).toBeLessThan(0.22);
  expect(result![2]!.x).toBeGreaterThan(0.72);
  expect(result![2]!.y).toBeGreaterThan(0.78);
});

it.each(['blank', 'square', 'landscape', 'partial'] as const)(
  'never fires an automatic shutter on a %s scene',
  (kind) => {
    expect(suggestCardCorners(frame(kind), 192, 256)).toBeNull();
  },
);

it('recognizes a real low-contrast card border that was previously below the edge threshold', () => {
  const image = frame('card');
  // Deliberately flatten sleeve/card contrast; the outer edge is 22 levels.
  for (let i = 0; i < image.length; i += 4) {
    const value = image[i]!;
    const tone = value === 224 ? 190 : value === 18 ? 168 : 177;
    image[i] = image[i + 1] = image[i + 2] = tone;
  }
  const detection = detectCardCorners(image, 192, 256);
  expect(detection.strategy).toBe('soft-edges');
  expect(detection.corners).not.toBeNull();
  expect(detection.corners![0]!.x).toBeGreaterThan(0.1);
  expect(detection.corners![2]!.x).toBeLessThan(0.9);
});

it.each(['square', 'landscape', 'partial'] as const)(
  'does not promote a low-contrast %s to a card',
  (kind) => {
    const image = frame(kind);
    for (let i = 0; i < image.length; i += 4) {
      const tone = image[i] === 224 ? 190 : image[i] === 18 ? 168 : 177;
      image[i] = image[i + 1] = image[i + 2] = tone;
    }
    expect(detectCardCorners(image, 192, 256)).toEqual({
      corners: null,
      strategy: 'none',
    });
  },
);

it('rejects empty or malformed camera pixel buffers', () => {
  expect(suggestCardCorners(new Uint8ClampedArray(), 192, 256)).toBeNull();
  expect(suggestCardCorners(frame('card'), 0, 256)).toBeNull();
  expect(suggestCardCorners(frame('card'), 192, 0)).toBeNull();
});
