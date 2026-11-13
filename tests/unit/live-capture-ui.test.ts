import { expect, it } from 'vitest';
import { manualCaptureAvailable } from '../../src/domain/live-capture-ui';
const ready = {
  running: true,
  busy: false,
  analyzing: false,
  waitingForRemoval: false,
  stableFrames: 0,
  elapsedMs: 6000,
};
it('keeps the manual shutter usable immediately even while OCR and outlines are processing', () => {
  expect(manualCaptureAvailable({ ...ready, elapsedMs: 0 })).toBe(true);
  expect(manualCaptureAvailable({ ...ready, analyzing: true })).toBe(true);
  expect(manualCaptureAvailable({ ...ready, stableFrames: 2 })).toBe(true);
  for (const patch of [
    { running: false },
    { busy: true },
    { waitingForRemoval: true },
  ])
    expect(manualCaptureAvailable({ ...ready, ...patch })).toBe(false);
});
