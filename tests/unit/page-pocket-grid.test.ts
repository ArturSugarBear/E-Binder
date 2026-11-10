import { describe, expect, it } from 'vitest';
import { suggestPocketGridCorners } from '../../src/domain/page-pocket-grid';

const WIDTH = 192;
const HEIGHT = 256;

function image(value: (x: number, y: number) => number) {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const intensity = value(x, y);
      const p = (y * WIDTH + x) * 4;
      pixels[p] = pixels[p + 1] = pixels[p + 2] = intensity;
      pixels[p + 3] = 255;
    }
  return pixels;
}

describe('private binder grid seam alignment', () => {
  it('finds rows and columns even when the binder is as dark as the background', () => {
    const pixels = image((x, y) => {
      const vertical =
        Math.abs(x - Math.round(WIDTH * 0.34)) < 3 ||
        Math.abs(x - Math.round(WIDTH * 0.67)) < 3;
      const horizontal =
        Math.abs(y - Math.round(HEIGHT * 0.33)) < 3 ||
        Math.abs(y - Math.round(HEIGHT * 0.65)) < 3;
      if (vertical || horizontal) return 140;
      // Partly filled pages: the bottom-right pockets are still empty.
      if (x < WIDTH * 0.6 && y < HEIGHT * 0.31) return (x + y) % 3 ? 44 : 70;
      return 28;
    });
    const result = suggestPocketGridCorners(pixels, WIDTH, HEIGHT);
    expect(result).not.toBeNull();
    expect(result![0]!.x).toBeLessThan(0.12);
    expect(result![0]!.y).toBeLessThan(0.14);
    expect(result![1]!.x).toBeGreaterThan(0.87);
    expect(result![2]!.y).toBeGreaterThan(0.83);
  });

  it('rejects a featureless image or separators along only one axis', () => {
    expect(
      suggestPocketGridCorners(
        image(() => 38),
        WIDTH,
        HEIGHT,
      ),
    ).toBeNull();
    expect(
      suggestPocketGridCorners(
        image((x) => (Math.abs(x - WIDTH / 3) < 3 ? 150 : 38)),
        WIDTH,
        HEIGHT,
      ),
    ).toBeNull();
  });

  it('does not accept malformed RGBA data', () => {
    expect(
      suggestPocketGridCorners(new Uint8ClampedArray(0), WIDTH, HEIGHT),
    ).toBeNull();
  });
});
