import { describe, expect, it } from 'vitest';
import { scanEvidence, fullCardNameMatches, rankScanCandidates } from '../../src/data/scan-review';
import { hasPrintedSetCode } from '../../src/domain/ocr-number-search';
import type { PersonalCard } from '../../src/domain/personal';

const card = (
  id: string,
  name: string,
  setId: string,
  number: string,
  language = 'ja',
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
  finishes: ['holo'],
});

describe('set-first card identification', () => {
  const lucario = card('M1L-088', 'メガルカリオex', 'M1L', '088/063');
  const wrong = card('M1S-088', 'メガサーナイトex', 'M1S', '088/063');
  const third = card('SV7-088', 'ルカリオex', 'SV7', '088/063');

  it('uses the printed Japanese set code and full number, not a shared fraction', () => {
    expect(hasPrintedSetCode(['M1L 088/063'])).toBe(true);
    expect(
      scanEvidence('M1L 088/063\nメガルカリオex', [wrong, lucario, third]),
    ).toEqual({ kind: 'set-number', card: lucario, title: 'matching' });
  });

  it('never claims an exact printing from a fraction shared by three sets', () => {
    expect(scanEvidence('088/063', [wrong, lucario, third])).toEqual({
      kind: 'set-required',
      number: '88/63',
      count: 3,
    });
  });

  it('can match a single print from an exact full name plus collector number', () => {
    expect(scanEvidence('088/063\nメガルカリオex', [wrong, lucario])).toEqual({
      kind: 'name-number',
      card: lucario,
    });
  });

  it('distinguishes Lucario, Lucario ex, Mega Lucario ex and Mega Lucario Z ex', () => {
    expect(fullCardNameMatches('Lucario', 'Mega Lucario ex')).toBe(false);
    expect(fullCardNameMatches('Lucario ex', 'Mega Lucario ex')).toBe(false);
    expect(fullCardNameMatches('Mega Lucario Z ex', 'Mega Lucario ex')).toBe(
      false,
    );
    expect(fullCardNameMatches('Mega-Lucario ex', 'Mega Lucario EX')).toBe(
      true,
    );
    const mega = card('M1L-088', 'Mega Lucario ex', 'M1L', '088/063', 'en');
    expect(scanEvidence('088/063\nLucario', [mega])).toMatchObject({
      kind: 'set-required',
    });
    expect(scanEvidence('088/063\nMega Lucario ex', [mega])).toEqual({
      kind: 'name-number',
      card: mega,
    });
  });

  it('shares the exact printing choice between a photo and binder pocket', () => {
    const items = [wrong, lucario, third];
    const ranked = rankScanCandidates('M1L 088/063\\nメガルカリオex', items);
    expect(ranked.basis).toBe('printed-set');
    expect(ranked.suggested?.key).toBe(lucario.key);
    expect(ranked.candidates[0]?.key).toBe(lucario.key);
    expect(rankScanCandidates('088/063', items).suggested).toBeUndefined();
  });

  it('never auto-selects a conflicting full card title in either scanner', () => {
    const ranked = rankScanCandidates('M1L 088/063\\nルカリオ', [
      lucario,
      third,
    ]);
    expect(ranked.conflictingName).toBe(true);
    expect(ranked.suggested).toBeUndefined();
    expect(ranked.basis).toBe('review');
  });

  it('flags a contradictory OCR title even when the printed set and number match', () => {
    expect(scanEvidence('M1L 088/063\nLucario', [lucario])).toEqual({
      kind: 'set-number',
      card: lucario,
      title: 'conflicting',
    });
  });
});
