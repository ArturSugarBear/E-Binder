import { describe, expect, it } from 'vitest';
import { shouldDismissSheet } from '../../src/ui/sheet-gestures';

describe('native sheet gesture thresholds', () => {
  it('dismisses a deliberate downward swipe', () => {
    expect(shouldDismissSheet(145, 380)).toBe(true);
    expect(shouldDismissSheet(60, 75)).toBe(true);
  });

  it('does not confuse scroll, accidental touch or upward movement with dismiss', () => {
    expect(shouldDismissSheet(-170, 200)).toBe(false);
    expect(shouldDismissSheet(42, 60)).toBe(false);
    expect(shouldDismissSheet(70, 850)).toBe(false);
    expect(shouldDismissSheet(0, 0)).toBe(false);
  });
});
