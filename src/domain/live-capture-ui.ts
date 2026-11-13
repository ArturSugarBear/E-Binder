/** Keep a manual shutter available as soon as the camera is ready.\n * Background OCR and unstable card outlines must never lock out capture.\n */
export function manualCaptureAvailable(state: {
  running: boolean;
  busy: boolean;
  analyzing: boolean;
  waitingForRemoval: boolean;
  stableFrames: number;
  elapsedMs: number;
}): boolean {
  return (
    state.running &&
    !state.busy &&
    !state.waitingForRemoval
  );
}
