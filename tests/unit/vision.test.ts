import { expect, it } from 'vitest';
import {
  decodeRecognition,
  otsuThreshold,
  recognitionTensor,
} from '../../src/domain/vision-codec';
import { recognitionClues } from '../../src/data/card-catalog';
import {
  collectorNumberFallbackRegions,
  hasPrintedCollectorFraction,
} from '../../src/domain/ocr-number-search';
it('normalizes RGB into three separate channels without changing original pixels', () => {
  const pixels = new Uint8ClampedArray([255, 0, 127, 255, 0, 255, 255, 255]);
  const before = pixels.slice();
  const data = recognitionTensor(pixels, 2, 1);
  expect([...data].slice(0, 4)).toEqual([1, -1, -1, 1]);
  expect(data[5]).toBe(1);
  expect(pixels).toEqual(before);
});
it('decodes repeated digits separated by CTC blanks and collapses uninterrupted duplicates', () => {
  const dictionary = ['', '1', '/', '9', '8'];
  const sequence = [1, 1, 0, 1, 2, 3, 0, 3, 4];
  const values = Float32Array.from(
    sequence.flatMap((label) =>
      dictionary.map((_, i) => (i === label ? 0.98 : 0.005)),
    ),
  );
  expect(
    decodeRecognition(
      values,
      [1, sequence.length, dictionary.length],
      dictionary,
    ),
  ).toBe('11/998');
});
it('rejects mismatched model dictionaries instead of turning labels into guessed digits', () => {
  expect(() =>
    decodeRecognition(new Float32Array(6), [1, 2, 3], ['', '1']),
  ).toThrow(/Wörterbuch/);
});
it('accepts adjoining printed set, language and number fields from the vision model', () => {
  expect(recognitionClues('TEFDE163/162★')[0]).toMatchObject({
    setId: 'sv05',
    language: 'de',
    number: '163/162',
  });
  expect(recognitionClues('HSSPDE234/191★')[0]).toMatchObject({
    setId: 'sv08',
    language: 'de',
    number: '234/191',
  });
  expect(recognitionClues('0BF207/197★')[0]).toMatchObject({
    setId: 'sv03',
    number: '207/197',
  });
  expect(recognitionClues('SVI211/198★')[0]).toMatchObject({
    setId: 'sv01',
    number: '211/198',
  });
});
it('accepts a complete collector fraction in either OCR crop', () => {
  expect(hasPrintedCollectorFraction(['TEFDE163/162★', ''])).toBe(true);
  expect(hasPrintedCollectorFraction(['', '211 / 198'])).toBe(true);
  expect(hasPrintedCollectorFraction(['', '211|198'])).toBe(true);
});
it('does not treat a partial number or a Pokémon name as a recognized fraction', () => {
  expect(hasPrintedCollectorFraction(['163/', 'Greninja'])).toBe(false);
  expect(hasPrintedCollectorFraction(['', 'SVI 211'])).toBe(false);
  expect(hasPrintedCollectorFraction(['2024/2025'])).toBe(false);
  expect(hasPrintedCollectorFraction(['1234/198'])).toBe(false);
  expect(hasPrintedCollectorFraction(['211/1984'])).toBe(false);
});
it('searches a bounded lower band and right edge without leaving the photo', () => {
  expect(collectorNumberFallbackRegions.length).toBe(5);
  for (const [x, y, width, height] of collectorNumberFallbackRegions) {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0.8);
    expect(x + width).toBeLessThanOrEqual(1);
    expect(y + height).toBeLessThanOrEqual(1);
  }
});

it('uses Otsu to separate a low-contrast footer into ink and paper', () => {
  const values = [
    ...Array.from({ length: 200 }, () => 28),
    ...Array.from({ length: 200 }, () => 214),
  ];
  const threshold = otsuThreshold(values);
  expect(threshold).toBeGreaterThanOrEqual(28);
  expect(threshold).toBeLessThan(214);
  expect(values.filter((value) => value <= threshold)).toHaveLength(200);
});

it('rejects empty or non-finite Otsu input instead of inventing a threshold', () => {
  expect(() => otsuThreshold([])).toThrow();
  expect(() => otsuThreshold([0, Number.NaN, 255])).toThrow();
});
