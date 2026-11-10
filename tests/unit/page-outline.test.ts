import { describe, expect, it } from 'vitest';
import { suggestPageCorners } from '../../src/domain/page-outline';

const WIDTH = 240;
const HEIGHT = 320;

function photo(valueAt: (x: number, y: number) => number) {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const value = valueAt(x, y);
      const offset = (y * WIDTH + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  return pixels;
}

describe('automatic binder page geometry suggestions', () => {
  it('finds the four outer corners of a slanted, high-contrast 3x3 page', () => {
    const pixels = photo((x, y) => {
      const px = x / WIDTH;
      const py = y / HEIGHT;
      const left = 0.12 + 0.055 * (py - 0.5);
      const right = 0.87 + 0.025 * (py - 0.5);
      const top = 0.105 + 0.03 * (px - 0.5);
      const bottom = 0.905 - 0.04 * (px - 0.5);
      if (px < left || px > right || py < top || py > bottom) return 228;
      const u = (px - left) / (right - left);
      const v = (py - top) / (bottom - top);
      if (u % (1 / 3) < 0.3 && v % (1 / 3) < 0.3)
        return 118 + ((Math.floor(u * 3) + Math.floor(v * 3)) % 2) * 35;
      return 24;
    });
    const corners = suggestPageCorners(pixels, WIDTH, HEIGHT);
    expect(corners).not.toBeNull();
    expect(corners![0]!.x).toBeCloseTo(0.1, 1);
    expect(corners![0]!.y).toBeCloseTo(0.1, 1);
    expect(corners![1]!.x).toBeCloseTo(0.86, 1);
    expect(corners![2]!.y).toBeCloseTo(0.9, 1);
    expect(corners![3]!.x).toBeCloseTo(0.14, 1);
    expect(corners![2]!.x - corners![3]!.x).toBeGreaterThan(0.55);
  });

  it('returns manual alignment for flat, blank and partially outlined images', () => {
    expect(suggestPageCorners(photo(() => 145), WIDTH, HEIGHT)).toBeNull();
    const verticalOnly = photo((x) =>
      x / WIDTH > 0.11 && x / WIDTH < 0.89 ? 20 : 230,
    );
    expect(suggestPageCorners(verticalOnly, WIDTH, HEIGHT)).toBeNull();
  });

  it('rejects missing or malformed pixel input without crashing the scanner', () => {
    expect(suggestPageCorners(new Uint8ClampedArray(0), 240, 320)).toBeNull();
    expect(
      suggestPageCorners(new Uint8ClampedArray(48 * 48 * 4), 20, 48),
    ).toBeNull();
  });
});
