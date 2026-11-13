import { recognitionClues } from '../../src/data/card-catalog';
import { expect, it } from 'vitest';
import {
  hasPrintedSetCode,
  wideCollectorFooterRegion,
} from '../../src/domain/ocr-number-search';

it('recognizes printed PBL and DLR footer codes even next to the language', () => {
  expect(hasPrintedSetCode(['089/084', 'PBLDE 089/084'])).toBe(true);
  expect(hasPrintedSetCode(['136/103', 'DLR DE'])).toBe(true);
  expect(hasPrintedSetCode(['211/198', 'SVIde 211/198'])).toBe(true);
});

it('flags contradictory printed set codes instead of choosing an arbitrary first match', () => {
  const clues = recognitionClues('PBLDE 089/084\nDLRDE 089/084');
  expect(clues).toHaveLength(1);
  expect(clues[0]).toMatchObject({
    number: '89/84',
    conflictingSets: true,
  });
  expect(clues[0]?.setId).toBeUndefined();
});

it('uses a bounded lower-15-percent fallback crop for hard-to-read card sleeves', () => {
  const [, y, , height] = wideCollectorFooterRegion;
  expect(y).toBe(0.85);
  expect(height).toBe(0.145);
  expect(y + height).toBeLessThanOrEqual(1);
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
