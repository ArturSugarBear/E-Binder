import { expect, it } from 'vitest';
import { looksLikeEmptyPocket } from '../../src/data/pocket-occupancy';

function image(
  width: number,
  height: number,
  sample: (x: number, y: number) => [number, number, number],
) {
  const bytes = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [red, green, blue] = sample(x, y);
      const offset = (y * width + x) * 4;
      bytes[offset] = red;
      bytes[offset + 1] = green;
      bytes[offset + 2] = blue;
      bytes[offset + 3] = 255;
    }
  return bytes;
}

it('can propose a dark neutral pocket as empty', () => {
  expect(
    looksLikeEmptyPocket(
      image(64, 64, () => [40, 41, 44]),
      64,
      64,
    ),
  ).toBe(true);
});

it('never drops a colourful, bright or highlighted card as empty', () => {
  const colorful = image(64, 64, () => [75, 95, 180]);
  expect(looksLikeEmptyPocket(colorful, 64, 64)).toBe(false);
  const fullArt = image(64, 64, (x) =>
    x % 4 === 0 ? [235, 230, 218] : [35, 34, 33],
  );
  expect(looksLikeEmptyPocket(fullArt, 64, 64)).toBe(false);
  expect(
    looksLikeEmptyPocket(
      image(64, 64, () => [235, 235, 235]),
      64,
      64,
    ),
  ).toBe(false);
});

it('does not hide a dark, visually detailed card', () => {
  const darkTextured = image(64, 64, (x) =>
    x % 3 === 0 ? [105, 107, 108] : [25, 26, 27],
  );
  expect(looksLikeEmptyPocket(darkTextured, 64, 64)).toBe(false);
});

it('is conservative when input geometry is invalid', () => {
  expect(looksLikeEmptyPocket(new Uint8ClampedArray(0), 64, 64)).toBe(false);
});
