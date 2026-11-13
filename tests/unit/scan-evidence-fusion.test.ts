import { describe, expect, it } from 'vitest';
import { fuseScanEvidence } from '../../src/data/scan-evidence-fusion';
import type { PersonalCard } from '../../src/domain/personal';

const card = (
  id: string,
  name: string,
  setId: string,
  number: string,
  language: 'de' | 'en' | 'ja' = 'ja',
): PersonalCard => ({
  key: `tcgdex:${language}:${id}`,
  source: 'tcgdex',
  sourceId: id,
  name,
  setId,
  setName: setId,
  number,
  language,
  image: '',
  artist: '',
  artistSource: 'unknown',
  evolvesFrom: '',
  stage: '',
  finishes: ['normal'],
});

const lucario = card('M1L-088', 'メガルカリオex', 'M1L', '088/063');
const wrong = card('M1S-088', 'メガサーナイトex', 'M1S', '088/063');
const other = card('SV7-088', 'ルカリオex', 'SV7', '088/063');

describe('scanner evidence fusion', () => {
  it('trusts exact printing over conflicting visual order', () => {
    const cards = [wrong, lucario];
    const result = fuseScanEvidence(
      'M1L 088/063\nメガルカリオex',
      cards,
      cards,
    );
    expect(result.candidates[0]?.key).toBe(lucario.key);
    expect(result.suggested?.key).toBe(lucario.key);
    expect(result.basis).toBe('printed-set');
    expect(result.signals).toMatchObject({
      numbered: true,
      named: true,
      visual: true,
      conflict: false,
    });
  });

  it('recognizes a full Japanese title and collector number', () => {
    const result = fuseScanEvidence(
      '088/063\nメガルカリオex',
      [wrong, lucario, other],
      [wrong],
      new Map([[wrong.key, 0.98]]),
    );
    expect(result.candidates[0]?.key).toBe(lucario.key);
    expect(result.suggested?.key).toBe(lucario.key);
    expect(result.basis).toBe('full-name');
  });

  it('reviews OCR-empty visual matches without selecting one', () => {
    const cards = [wrong, lucario];
    const result = fuseScanEvidence('', cards, [lucario, wrong]);
    expect(result.candidates.map((item) => item.key)).toEqual([
      lucario.key,
      wrong.key,
    ]);
    expect(result.suggested).toBeUndefined();
    expect(result.basis).toBe('review');
    expect(result.signals.visual).toBe(true);
  });

  it('does not promote a shared number and image into identity', () => {
    const cards = [wrong, lucario];
    const result = fuseScanEvidence('088/063', cards, [lucario, wrong]);
    expect(result.candidates[0]?.key).toBe(lucario.key);
    expect(result.suggested).toBeUndefined();
  });

  it('blocks conflicting OCR names even on a visual match', () => {
    const en = card('M1L-088', 'Mega Lucario ex', 'M1L', '088/063', 'en');
    const result = fuseScanEvidence('M1L 088/063\nLucario', [en], [en]);
    expect(result.suggested).toBeUndefined();
    expect(result.signals.conflict).toBe(true);
  });

  it('keeps artwork similarity as ranking, not confidence', () => {
    const en = card('M1L-088', 'Mega Lucario ex', 'M1L', '088/063', 'en');
    const de = card('M1L-088', 'Mega Lucario ex', 'M1L', '088/063', 'de');
    const scores = new Map([[en.key, 0.98], [de.key, 0.97]]);
    const result = fuseScanEvidence('088/063', [en, de], [], scores, 'de');
    expect(result.suggested).toBeUndefined();
    expect(result.candidates[0]?.key).toBe(en.key);
    expect(result.signals.appearance).toBe(true);
  });

  it('tolerates zero candidates and invalid image scores', () => {
    expect(fuseScanEvidence('', []).candidates).toEqual([]);
    const result = fuseScanEvidence(
      '',
      [lucario, wrong],
      [],
      new Map([[wrong.key, Number.NaN]]),
      'ja',
    );
    expect(result.candidates.map((item) => item.key)).toEqual(
      [lucario, wrong].map((item) => item.key).sort(),
    );
  });
});
