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

  it('never suggests unrelated energy types from an unreadable generic title', () => {
    expect(recognizedNameHints('BASIS-ENERGIE')).toEqual([]);
    expect(recognizedNameHints('001/182\nBasis Energie')).toEqual([]);
    expect(recognizedNameHints('Energie')).toEqual([]);
  });

  it('retains the actual typed energy name when OCR has read the type', () => {
    expect(recognizedNameHints('001/024\nBasis-Metall-Energie')).toEqual([
      'Metall-Energie',
    ]);
    expect(recognizedNameHints('Basic Metal Energy')).toEqual(['Metal Energy']);
    expect(recognizedNameHints('Basis-Pflanze-Energie')).toEqual([
      'Pflanze-Energie',
    ]);
  });

  it('accepts Japanese card names but never converts them into German printings', () => {
    expect(recognizedNameHints('049/080\nゲンガー')).toEqual(['ゲンガー']);
  });

  it('returns nothing for numbers or unreadable snippets', () => {
    expect(recognizedNameHints('006/086\n  \n00/000')).toEqual([]);
    expect(recognizedNameHints('')).toEqual([]);
  });
});
