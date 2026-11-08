import { expect, it } from 'vitest';
import {
  decodeRecognition,
  recognitionTensor,
} from '../../src/domain/vision-codec';
import { recognitionClues } from '../../src/data/card-catalog';
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
