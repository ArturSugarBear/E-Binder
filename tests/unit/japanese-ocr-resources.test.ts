import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import source from '../../public/assets/ocr/model-source.json';
import { decodeRecognition } from '../../src/domain/vision-codec';
it('pairs the pinned Japanese model with all Katakana and its exact 4401 CTC tokens', () => {
  const text = readFileSync('public/assets/ocr/ppocr-ja-keys.txt', 'utf8');
  const dictionary = [
    '',
    ...text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'),
    ' ',
  ];
  expect(dictionary).toHaveLength(4401);
  const name = 'メガルカリオex';
  for (const c of name) expect(dictionary).toContain(c);
  const data = new Float32Array(name.length * dictionary.length);
  [...name].forEach((c, i) => {
    data[i * dictionary.length + dictionary.indexOf(c)] = 1;
  });
  expect(
    decodeRecognition(data, [1, name.length, dictionary.length], dictionary),
  ).toBe(name);
  for (const file of source.japanese.files) {
    const bytes = readFileSync('public/assets/ocr/' + file.name);
    expect(bytes.byteLength).toBe(file.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
  }
});
