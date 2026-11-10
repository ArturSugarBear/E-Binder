import { describe, expect, it } from 'vitest';
import { recognizedNameHints } from '../../src/domain/recognition-names';

describe('OCR card-title fallback', () => {
  it('uses the final title line rather than the printed collector fraction', () => {
    expect(recognizedNameHints('067/094\nPAL DE\nMiltank')).toEqual([
      'Miltank',
    ]);
    expect(recognizedNameHints('037/167\nN 73\nEneco KP 60')).toEqual([
      'Eneco',
    ]);
  });

  it('offers only a generic search for energy cards, never a printing', () => {
    expect(recognizedNameHints('BASIS-ENERGIE')).toEqual(['Energie']);
    expect(recognizedNameHints('001/182\nBasis Energie')).toEqual(['Energie']);
  });

  it('accepts Japanese card names but never converts them into German printings', () => {
    expect(recognizedNameHints('049/080\nゲンガー')).toEqual(['ゲンガー']);
  });

  it('returns nothing for numbers or unreadable snippets', () => {
    expect(recognizedNameHints('006/086\n  \n00/000')).toEqual([]);
    expect(recognizedNameHints('')).toEqual([]);
  });
});
