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
