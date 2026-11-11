import { describe, expect, it } from 'vitest';
import { detectCardBounds } from '../../src/data/pocket-card-edges';
import { pocketCrop } from '../../src/data/page-pockets';

const WIDTH = 160;
const HEIGHT = 224;

function image(fill: (x: number, y: number) => number) {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const value = fill(x, y);
      const index = (y * WIDTH + x) * 4;
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  return pixels;
}

describe('printed-card edges inside a binder pocket', () => {
  it('only crops when all four card borders agree and preserves header/footer', () => {
    const pixels = image((x, y) => {
      if (x < 10 || x > 149 || y < 12 || y > 211) return 24;
      if ((y > 16 && y < 35) || (y > 193 && y < 207))
        return x % 8 < 2 ? 70 : 206;
      return 206;
    });
    const bounds = detectCardBounds(pixels, WIDTH, HEIGHT);
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeLessThanOrEqual(10);
    expect(bounds!.y).toBeLessThanOrEqual(12);
    expect(bounds!.x + bounds!.width).toBeGreaterThanOrEqual(150);
    expect(bounds!.y + bounds!.height).toBeGreaterThanOrEqual(212);
    expect(bounds!.width).toBeLessThan(WIDTH);
    expect(bounds!.height).toBeLessThan(HEIGHT);
  });

  it('falls back to the full pocket for a plain or one-axis image', () => {
    expect(
      detectCardBounds(
        image(() => 26),
        WIDTH,
        HEIGHT,
      ),
    ).toBeNull();
    expect(
      detectCardBounds(
        image((x) => (x > 10 && x < 150 ? 205 : 26)),
        WIDTH,
        HEIGHT,
      ),
    ).toBeNull();
  });

  it('rejects partial, offset and invalid photo geometry', () => {
    const offCenter = image((x, y) =>
      x > 24 && x < 155 && y > 12 && y < 212 ? 196 : 21,
    );
    expect(detectCardBounds(offCenter, WIDTH, HEIGHT)).toBeNull();
    expect(detectCardBounds(new Uint8ClampedArray(), WIDTH, HEIGHT)).toBeNull();
  });
});

describe('complete binder pockets', () => {
  it('uses row-major physical cells with less than one percent trim', () => {
    const cells = Array.from({ length: 9 }, (_, slot) =>
      pocketCrop(slot, 1260, 1760),
    );
    expect(cells[0]!.x).toBeLessThan(4.2);
    expect(cells[0]!.y).toBeLessThan(5.9);
    expect(cells[0]!.width).toBeGreaterThan(415);
    expect(cells[0]!.height).toBeGreaterThan(579);
    expect(cells[1]!.x).toBeGreaterThanOrEqual(420);
    expect(cells[3]!.y).toBeGreaterThanOrEqual(1760 / 3);
    expect(cells[8]!.x + cells[8]!.width).toBeLessThanOrEqual(1260);
    expect(cells[8]!.y + cells[8]!.height).toBeLessThanOrEqual(1760);
  });
});
