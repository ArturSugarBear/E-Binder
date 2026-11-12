import { recognitionClues } from '../../src/data/card-catalog';
import { expect, it } from 'vitest';
import { hasPrintedSetCode } from '../../src/domain/ocr-number-search';

it('recognizes printed PBL and DLR footer codes even next to the language', () => {
  expect(hasPrintedSetCode(['089/084', 'PBLDE 089/084'])).toBe(true);
  expect(hasPrintedSetCode(['136/103', 'DLR DE'])).toBe(true);
  expect(hasPrintedSetCode(['211/198', 'SVIde 211/198'])).toBe(true);
});

it('does not mistake a collector number or arbitrary OCR title for a printed set code', () => {
  expect(hasPrintedSetCode(['089/084', 'Voltenso KP 120'])).toBe(false);
  expect(hasPrintedSetCode(['unlesbar', ''])).toBe(false);
});

it('normalizes verified Japanese typography and rarity delimiters without deleting uncertain digits', () => {
  expect(recognitionClues('MIL 088/063SAR')[0]).toMatchObject({
    setId: 'M1L',
    number: '88/63',
    language: 'ja',
  });
  expect(recognitionClues('mis ０８８/０６３SAR')[0]).toMatchObject({
    number: '88/63',
    language: 'ja',
  });
  expect(recognitionClues('M1L 0887/063SAR')).toHaveLength(0);
  expect(recognitionClues('M1L 088/0635')).toHaveLength(0);
  expect(recognitionClues('MEGDE 077/132')[0]).toMatchObject({
    setId: 'me01',
    number: '77/132',
    language: 'de',
  });
});
