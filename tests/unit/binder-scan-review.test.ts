import { describe, expect, it } from 'vitest';
import { binderReviewComplete } from '../../src/domain/binder-scan-review';

describe('explicit 9-pocket binder review', () => {
  it('rejects incomplete, all-empty and unfinished pages', () => {
    expect(binderReviewComplete([])).toBe(false);
    expect(binderReviewComplete(Array(9).fill('empty'))).toBe(false);
    expect(
      binderReviewComplete(['card', ...Array(7).fill('empty'), 'pending']),
    ).toBe(false);
  });
  it('requires one selected card and a decision for all nine positions', () => {
    expect(
      binderReviewComplete(['card', ...Array(8).fill('skip')]),
    ).toBe(true);
    expect(
      binderReviewComplete(['card', ...Array(8).fill('empty')]),
    ).toBe(true);
  });
});
