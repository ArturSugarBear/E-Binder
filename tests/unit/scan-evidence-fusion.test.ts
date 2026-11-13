import { describe, expect, it } from 'vitest';
import { fuseScanEvidence } from '../../src/data/scan-evidence-fusion';
import type { PersonalCard } from '../../src/domain/personal';

const card = (
  sourceId: string,
  name: string,
  setId: string,
  number: string,
  language: 'de' | 'en' | 'ja' = 'ja',
): PersonalCard => ({
  key: `tcgdex:${language}:${sourceId}`,
  source: 'tcgdex',
  sourceId,
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
const gardevoir = card('M1S-088', 'メガサーナイトex', 'M1S', '088/063');
const alternate = card('SV7-088', 'ルカリオex', 'SV7', '088/063');

describe('scanner evidence fusion', () => {
  it('keeps exact printed set+number over a disagreeing visual shortlist', () => {
    const result = fuseScanEvidence(
      'M1L 088/063\nメガルカリオex',
      [gardevoir, lucario],
      [gardevoir, lucario],
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

  it('uses an exact multilingual name+fraction when the printed set is unreadable', () => {
    const result = fuseScanEvidence(
      '088/063\nメガルカリオex',
      [gardevoir, lucario, alternate],
      [gardevoir],
      new Map([[gardevoir.key, 0.98]]),
    );
    expect(result.candidates[0]?.key).toBe(lucario.key);
    expect(result.suggested?.key).toBe(lucario.key);
    expect(result.basis).toBe('full-name');
  });

  it('ranks visual candidates on an OCR-empty photo but never suggests an exact printing', () => {
    const result = fuseScanEvidence(
      '',
      [gardevoir, lucario],
      [lucario, gardevoir],
    );
    expect(result.candidates.map((entry) => entry.key)).toEqual([
      lucario.key,
      gardevoir.key,
    ]);
    expect(result.suggested).toBeUndefined();
    expect(result.basis).toBe('review');
    expect(result.signals.visual).toBe(true);
  });

  it('does not turn an ambiguous collector number and image rank into an exact claim', () => {
    const result = fuseScanEvidence(
      '088/063',
      [gardevoir, lucario],
      [lucario, gardevoir],
    );
    expect(result.candidates[0]?.key).toBe(lucario.key);
    expect(result.suggested).toBeUndefined();
  });

  it('rejects contradictory full names even if the printed set and visual rank agree', () => {
    const en = card('M1L-088', 'Mega Lucario ex', 'M1L', '088/063', 'en');
    const result = fuseScanEvidence(
      'M1L 088/063\nLucario',
      [en],
      [en],
    );
    expect(result.suggested).toBeUndefined();
    expect(result.signals.conflict).toBe(true);
  });

  it('prefers OCR agreement over near-identical artwork without using cosine as probability', () => {
    const en = card('M1L-088', 'Mega Lucario ex', 'M1L', '088/063', 'en');
    const de = card('M1L-088', 'Mega Lucario ex', 'M1L', '088/063', 'de');
    const result = fuseScanEvidence(
      '088/063',
      [en, de],
      [],
      new Map([[en.key, 0.98], [de.key, 0.97]]),
      'de',
    );
    expect(result.suggested).toBeUndefined();
    expect(result.candidates[0]?.key).toBe(en.key);
    expect(result.signals.appearance).toBe(true);
  });

  it('handles zero candidates and invalid appearance values deterministically', () => {
    expect(fuseScanEvidence('', []).candidates).toEqual([]);
    const result = fuseScanEvidence(
      '',
      [lucario, gardevoir],
      [],
      new Map([[gardevoir.key, Number.NaN]]),
      'ja',
    );
    expect(result.candidates.map((item) => item.key)).toEqual(
      [lucario, gardevoir].map((item) => item.key).sort(),
    );
  });
});
