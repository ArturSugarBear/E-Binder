import { describe, expect, it } from 'vitest';
import { updateCaptureLatch } from '../../src/domain/scan-capture-latch';

describe('consecutive live card capture', () => {
  it('does not rearm the same card while its outline remains visible', () => {
    const waiting = { waitingForRemoval: true, missingFrames: 0 };
    expect(updateCaptureLatch(waiting, true)).toEqual(waiting);
    const flicker = updateCaptureLatch(waiting, false);
    expect(flicker).toEqual({ waitingForRemoval: true, missingFrames: 1 });
    expect(updateCaptureLatch(flicker, true)).toEqual(waiting);
  });

  it('rearms only after independent missing-card observations', () => {
    const first = updateCaptureLatch(
      { waitingForRemoval: true, missingFrames: 0 },
      false,
    );
    expect(updateCaptureLatch(first, false)).toEqual({
      waitingForRemoval: false,
      missingFrames: 0,
    });
  });

  it('never changes a camera that is already armed', () => {
    const armed = { waitingForRemoval: false, missingFrames: 0 };
    expect(updateCaptureLatch(armed, true)).toBe(armed);
    expect(updateCaptureLatch(armed, false)).toBe(armed);
  });

  it('rejects one-frame rearming that could create duplicate photos', () => {
    expect(() =>
      updateCaptureLatch(
        { waitingForRemoval: true, missingFrames: 0 },
        false,
        1,
      ),
    ).toThrow('Ungültige Freigabezeit');
  });
});
