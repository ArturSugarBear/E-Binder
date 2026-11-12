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
it('shows only a delayed manual fallback when auto-capture has not locked', () => {
  expect(manualCaptureAvailable({ ...ready, elapsedMs: 5999 })).toBe(false);
  expect(manualCaptureAvailable(ready)).toBe(true);
  for (const patch of [
    { running: false },
    { busy: true },
    { analyzing: true },
    { waitingForRemoval: true },
    { stableFrames: 2 },
  ])
    expect(manualCaptureAvailable({ ...ready, ...patch })).toBe(false);
});
