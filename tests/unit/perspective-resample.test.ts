import { expect, it } from 'vitest';
import { resamplePerspectivePixels } from '../../src/domain/perspective-resample';
import type { Quad } from '../../src/domain/photo-geometry';

const fullFrame: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

it('bilinearly interpolates the centre of a tiny rectified image', () => {
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 255,
    100, 100, 100, 255,
    200, 200, 200, 255,
    240, 240, 240, 255,
  ]);
  const result = resamplePerspectivePixels(
    pixels,
    2,
    2,
    3,
    3,
    fullFrame,
  );
  const centre = (1 * 3 + 1) * 4;
  expect(result[centre]).toBe(135);
  expect(result[centre + 1]).toBe(135);
  expect(result[centre + 3]).toBe(255);
  expect(result[0]).toBe(0);
  expect(result[(3 * 3 - 1) * 4]).toBe(240);
});

it('preserves an identity-aligned card without inventing pixel values', () => {
  const image = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < image.length; i += 4) {
    image[i] = i % 255;
    image[i + 1] = 127;
    image[i + 2] = 255 - (i % 255);
    image[i + 3] = 255;
  }
  expect(
    resamplePerspectivePixels(image, 4, 4, 4, 4, fullFrame),
  ).toEqual(image);
});

it('rejects malformed buffers and impossible perspective corners', () => {
  expect(() =>
    resamplePerspectivePixels(
      new Uint8ClampedArray(),
      4,
      4,
      4,
      4,
      fullFrame,
    ),
  ).toThrow();
  const inverted: Quad = [
    { x: 1, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ];
  expect(() =>
    resamplePerspectivePixels(
      new Uint8ClampedArray(4 * 4 * 4),
      4,
      4,
      4,
      4,
      inverted,
    ),
  ).toThrow();
});
