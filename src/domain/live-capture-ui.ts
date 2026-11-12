/** A timeout reveals recovery; it never declares a card recognized. */
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
    !state.analyzing &&
    !state.waitingForRemoval &&
    state.stableFrames < 2 &&
    state.elapsedMs >= 6000
  );
}
