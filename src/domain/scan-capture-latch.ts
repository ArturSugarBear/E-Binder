/**
 * Auto-scan must not capture the same card repeatedly while it remains
 * under the camera. Require consecutive video observations WITHOUT a valid
 * card outline before arming the next automatic shutter.
 *
 * A user may still explicitly override this with the "next card" control.
 */
export interface CaptureLatch {
  waitingForRemoval: boolean;
  missingFrames: number;
}

export function updateCaptureLatch(
  state: CaptureLatch,
  validCardVisible: boolean,
  requiredMissingFrames = 2,
): CaptureLatch {
  if (!state.waitingForRemoval) return state;
  if (!Number.isInteger(requiredMissingFrames) || requiredMissingFrames < 2)
    throw new Error('Ungültige Freigabezeit für den Kartenwechsel.');
  if (validCardVisible) return { waitingForRemoval: true, missingFrames: 0 };
  if (state.missingFrames + 1 < requiredMissingFrames)
    return { waitingForRemoval: true, missingFrames: state.missingFrames + 1 };
  return { waitingForRemoval: false, missingFrames: 0 };
}
