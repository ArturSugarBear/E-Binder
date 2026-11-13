import { describe, expect, it } from 'vitest';
import {
  analysePhotoPixels,
  liveCameraPhotoHint,
} from '../../src/data/photo-quality';

function fixture(
  width: number,
  height: number,
  pixel: (x: number, y: number) => number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const value = pixel(x, y);
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  return data;
}

describe('local binder photo diagnostics', () => {
  it('warns on completely dark photos without treating them as empty cards', () => {
    const report = analysePhotoPixels(
      fixture(128, 176, () => 12),
      128,
      176,
    );
    expect(report.warnings).toContain('Sehr dunkel');
    expect(report.warnings.some((warning) => warning.includes('leer'))).toBe(
      true,
    );
  });
  it('warns on near-white photographs and severe glare', () => {
    const report = analysePhotoPixels(
      fixture(128, 176, () => 255),
      128,
      176,
    );
    expect(report.highlightFraction).toBe(1);
    expect(report.warnings.join(' ')).toMatch(/Reflexionen/);
  });
  it('distinguishes a detailed high-contrast grid from a flat blurred field', () => {
    const clear = analysePhotoPixels(
      fixture(128, 176, (x, y) =>
        (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 215 : 39,
      ),
      128,
      176,
    );
    const flat = analysePhotoPixels(
      fixture(128, 176, () => 135),
      128,
      176,
    );
    expect(clear.detail).toBeGreaterThan(flat.detail);
    expect(clear.warnings).not.toContain(
      'Wenige Bilddetails – möglicherweise unscharf oder leer',
    );
    expect(flat.warnings.join(' ')).toMatch(/Wenige Bilddetails/);
  });
  it('offers nonblocking live hints for dark, reflective and low-detail frames', () => {
    const dark = analysePhotoPixels(
      fixture(128, 176, () => 12),
      128,
      176,
    );
    const reflective = analysePhotoPixels(
      fixture(128, 176, () => 255),
      128,
      176,
    );
    const flat = analysePhotoPixels(
      fixture(128, 176, () => 135),
      128,
      176,
    );
    const clear = analysePhotoPixels(
      fixture(128, 176, (x, y) =>
        (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 215 : 39,
      ),
      128,
      176,
    );
    expect(liveCameraPhotoHint(dark)).toMatch(/Licht/);
    expect(liveCameraPhotoHint(reflective)).toMatch(/Reflexionen/);
    expect(liveCameraPhotoHint(flat)).toMatch(/unscharf/);
    expect(liveCameraPhotoHint(clear)).toBeUndefined();
  });

  it('rejects empty, corrupt and mismatched pixel arrays', () => {
    expect(() =>
      analysePhotoPixels(new Uint8ClampedArray(20), 128, 176),
    ).toThrow();
    expect(() =>
      analysePhotoPixels(new Uint8ClampedArray(128 * 176 * 4), 0, 176),
    ).toThrow();
  });
});
