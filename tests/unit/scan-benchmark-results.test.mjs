import { describe, expect, it } from 'vitest';
import {
  cardSummary,
  percentile,
  rankMatch,
  readRankedKeys,
} from '../../scripts/scan-benchmark-results.mjs';

describe('versioned scanner benchmark results', () => {
  it('preserves the displayed ranking and rejects a stale UI contract', () => {
    expect(
      readRankedKeys('1', '["tcgdex:ja:M1L-088","tcgdex:ja:M1S-088"]'),
    ).toEqual(['tcgdex:ja:M1L-088', 'tcgdex:ja:M1S-088']);
    expect(() => readRankedKeys(undefined, '[]')).toThrow(/contract/);
    expect(() => readRankedKeys('1', 'not-json')).toThrow(/JSON/);
    expect(() => readRankedKeys('1', '["one","one"]')).toThrow(/invalid/);
  });

  it('scores exact print keys, top-five and negative photos separately', () => {
    expect(
      rankMatch('tcgdex:ja:M1L-088', [
        'tcgdex:ja:M1S-088',
        'tcgdex:ja:M1L-088',
      ]),
    ).toEqual({
      top1: false,
      top3: true,
      top5: true,
      unexpectedSuggestions: null,
    });
    expect(rankMatch(null, ['tcgdex:ja:M1L-088'])).toEqual({
      top1: null,
      top3: null,
      top5: null,
      unexpectedSuggestions: 1,
    });
  });

  it('includes technical failures in the denominator without hiding them', () => {
    const reports = [
      {
        expectedKey: 'tcgdex:de:a-001',
        conditions: ['normal'],
        ...rankMatch('tcgdex:de:a-001', ['tcgdex:de:a-001']),
        resultStatus: 'candidates',
        durationMs: 500,
      },
      {
        expectedKey: 'tcgdex:de:a-002',
        conditions: ['normal', 'glare'],
        error: 'OCR worker unavailable',
        resultStatus: 'technical-error',
        durationMs: 2000,
      },
      {
        expectedKey: null,
        conditions: ['negative'],
        ...rankMatch(null, []),
        resultStatus: 'no-candidates',
        durationMs: 100,
      },
    ];
    const summary = cardSummary(reports);
    expect(summary.total).toBe(2);
    expect(summary.evaluated).toBe(1);
    expect(summary.errors).toBe(1);
    expect(summary.top1Rate).toBe(0.5);
    expect(summary.evaluatedTop3Rate).toBe(1);
    expect(summary.negativeSamples).toBe(1);
    expect(summary.noCandidates).toBe(1);
    expect(summary.byCondition.glare.top3Rate).toBe(0);
    expect(percentile([100, 500, 300], 0.5)).toBe(300);
  });
});

it('reports per-language misses, latency and incorrect automatic identities without calling ranked guesses confident', () => {
  const reports = [
    {
      language: 'ja',
      expectedKey: 'tcgdex:ja:M1L-088',
      conditions: [],
      automaticKey: 'tcgdex:ja:M1S-088',
      ...rankMatch('tcgdex:ja:M1L-088', ['tcgdex:ja:M1S-088']),
      resultStatus: 'candidates',
      durationMs: 100,
      phasesMs: { recognitionAndReview: 80 },
    },
    {
      language: 'de',
      expectedKey: 'tcgdex:de:sv01-001',
      conditions: [],
      automaticKey: null,
      ...rankMatch('tcgdex:de:sv01-001', []),
      resultStatus: 'no-candidates',
      durationMs: 200,
    },
  ];
  const summary = cardSummary(reports);
  expect(summary.byLanguage.ja.incorrectConfidentMatches).toBe(1);
  expect(summary.byLanguage.ja.p95RecognitionMs).toBe(80);
  expect(summary.byLanguage.de.noMatchRate).toBe(1);
  expect(summary.byLanguage.en.top1Rate).toBeNull();
});
