/**
 * Local, explicit opt-in for a LIMITED visual model pilot.
 * It is independent from donation consent and never sends image pixels.
 * The model has only nine verified local reference printings in v1.
 */
const KEY = 'e-binder-visual-beta-v1';

export function visualBetaEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setVisualBetaEnabled(enabled: boolean): boolean {
  try {
    if (enabled) localStorage.setItem(KEY, 'on');
    else localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export const VISUAL_BETA_REFERENCE_COUNT = 9;
