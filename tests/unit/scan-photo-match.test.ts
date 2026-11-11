import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  spatialColourSignature,
  strongAppearanceAgreement,
} from '../../src/data/scan-photo-match';
import type { PersonalCard } from '../../src/domain/personal';

const card = (key: string) => ({ key }) as PersonalCard;

describe('bounded local photo comparison', () => {
  it('compares nonempty signatures and rejects invalid dimensions', () => {
    expect(cosineSimilarity([1, 0, 2], [1, 0, 2])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
  });

  it('uses spatial colour regions, not only an image-wide colour average', () => {
    const width = 8;
    const height = 8;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const start = (y * width + x) * 4;
        pixels[start] = x < 4 ? 255 : 0;
        pixels[start + 2] = x >= 4 ? 255 : 0;
        pixels[start + 3] = 255;
      }
    }
    const a = spatialColourSignature(pixels, width, height);
    const reversed = new Uint8ClampedArray(pixels);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const start = (y * width + x) * 4;
        reversed[start] = x < 4 ? 0 : 255;
        reversed[start + 2] = x >= 4 ? 0 : 255;
      }
    const b = spatialColourSignature(reversed, width, height);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1);
    expect(cosineSimilarity(a, b)).toBeLessThan(0.8);
  });

  it('does not treat similar artwork scores as a confident exact printing', () => {
    expect(
      strongAppearanceAgreement([
        { card: card('one'), similarity: 0.91 },
        { card: card('two'), similarity: 0.87 },
      ]),
    ).toBeUndefined();
    expect(
      strongAppearanceAgreement([
        { card: card('one'), similarity: 0.95 },
        { card: card('two'), similarity: 0.81 },
      ])?.key,
    ).toBe('one');
  });
});
