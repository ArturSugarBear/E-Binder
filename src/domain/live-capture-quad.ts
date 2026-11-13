import { cardProjection, type Quad } from './photo-geometry';

/**
 * Protect printed text from optimistic camera-edge estimates.
 * The photo is perspective-corrected with a small title-side overscan,
 * not cropped exactly at an inferred top line (which could be artwork).
 *
 * There is deliberately almost no footer overscan: collector-number
 * OCR expects printed text near the original card's lower edge.
 * This function only changes a temporary local capture, never identity.
 */
export function expandLiveCaptureQuad(corners: Quad): Quad {
  let project: ReturnType<typeof cardProjection>;
  try {
    project = cardProjection(corners);
  } catch {
    return corners;
  }
  for (const scale of [1, 0.75, 0.5, 0.25]) {
    const left = -0.03 * scale;
    const right = 1 + 0.03 * scale;
    const top = -0.1 * scale;
    const bottom = 1 + 0.005 * scale;
    const expanded: Quad = [
      project(left, top),
      project(right, top),
      project(right, bottom),
      project(left, bottom),
    ];
    if (
      expanded.every(
        (point) =>
          Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          point.x >= 0 &&
          point.x <= 1 &&
          point.y >= 0 &&
          point.y <= 1,
      )
    )
      return expanded;
  }
  return corners;
}
