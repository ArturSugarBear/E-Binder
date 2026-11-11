import { describe, expect, it } from 'vitest';
import {
  combineLiveOcrText,
  LIVE_SCAN_BUDGET_MS,
  LIVE_SCAN_MAX_OCR_PASSES,
  liveScanMissingEvidence,
  nextLiveHotZone,
  remainingLiveScanBudget,
} from '../../src/domain/live-ocr-policy';

describe('P07 live analysis budget', () => {
  it('bounds all OCR retries and catalogue work to 5.6 seconds', () => {
    expect(LIVE_SCAN_BUDGET_MS).toBe(5600);
    expect(LIVE_SCAN_MAX_OCR_PASSES).toBe(3);
    expect(remainingLiveScanBudget(1000, 1100)).toBe(5500);
    expect(remainingLiveScanBudget(1000, 6600)).toBe(0);
    expect(remainingLiveScanBudget(1000, 9900)).toBe(0);
    expect(remainingLiveScanBudget(NaN, 1200)).toBe(0);
  });

  it('does not trigger unnecessary retries for a readable exact identity', () => {
    const exact = 'DLR 111/103\nGroudon';
    expect(liveScanMissingEvidence(exact)).toEqual({
      footer: false,
      title: false,
    });
    expect(nextLiveHotZone(exact, [])).toBeUndefined();
  });

  it('re-reads an ambiguous footer with two different crops, never forever', () => {
    const unclear = '111/103\nGroudon';
    expect(nextLiveHotZone(unclear, [])).toBe('footer');
    expect(nextLiveHotZone(unclear, ['footer'])).toBe('footer-contrast');
    expect(
      nextLiveHotZone(unclear, ['footer', 'footer-contrast']),
    ).toBeUndefined();
  });

  it('does not confuse a set code with the card title', () => {
    expect(liveScanMissingEvidence('DLR 111/103\nDLR').title).toBe(true);
    expect(nextLiveHotZone('DLR 111/103', [])).toBe('title');
    expect(nextLiveHotZone('DLR 111/103', ['title'])).toBe('title-wide');
  });

  it('keeps the full title at the end when footer retry text arrives later', () => {
    const combined = combineLiveOcrText(
      '111/103\nMega Lucario ex',
      'DLR 111/103',
      'footer',
    );
    expect(combined).toContain('DLR 111/103');
    expect(combined.endsWith('Mega Lucario ex')).toBe(true);
    expect(liveScanMissingEvidence(combined).title).toBe(false);
  });

  it('removes duplicate OCR strings without presenting repeated crops as votes', () => {
    const merged = combineLiveOcrText(
      'DLR 111/103\nGroudon',
      'Groudon\nGroudon',
      'title-wide',
    );
    expect(
      merged.split('\n').filter((line) => line === 'Groudon'),
    ).toHaveLength(1);
  });
});
