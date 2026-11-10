import type { Quad } from './photo-geometry';

export interface CardLock {
  corners: Quad | null;
  stableFrames: number;
}

/**
 * Reject obvious non-card shapes before the live shutter can fire.
 * A standard TCG card is approximately 63:88 (width:height); tolerance
 * allows perspective distortion but does not claim to identify the artwork.
 */
export function plausibleCardQuad(
  corners: Quad,
  width: number,
  height: number,
): boolean {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return false;
  if (
    corners.some(
      (corner) =>
        !Number.isFinite(corner.x) ||
        !Number.isFinite(corner.y) ||
        corner.x < 0 ||
        corner.y < 0 ||
        corner.x > 1 ||
        corner.y > 1,
    )
  )
    return false;
  const pixelLength = (i: number, j: number) =>
    Math.hypot(
      (corners[i]!.x - corners[j]!.x) * width,
      (corners[i]!.y - corners[j]!.y) * height,
    );
  const top = pixelLength(0, 1);
  const right = pixelLength(1, 2);
  const bottom = pixelLength(2, 3);
  const left = pixelLength(3, 0);
  const averageWidth = (top + bottom) / 2;
  const averageHeight = (left + right) / 2;
  const ratio = averageWidth / averageHeight;
  const boxArea = Math.abs(
    corners.reduce((sum, point, index) => {
      const other = corners[(index + 1) % 4]!;
      return sum + point.x * other.y - other.x * point.y;
    }, 0) / 2,
  );
  const centerX = corners.reduce((sum, point) => sum + point.x, 0) / 4;
  const centerY = corners.reduce((sum, point) => sum + point.y, 0) / 4;
  return (
    ratio >= 0.57 &&
    ratio <= 0.87 &&
    boxArea >= 0.23 &&
    Math.max(top, bottom) / Math.min(top, bottom) <= 1.42 &&
    Math.max(left, right) / Math.min(left, right) <= 1.42 &&
    centerX >= 0.28 &&
    centerX <= 0.72 &&
    centerY >= 0.25 &&
    centerY <= 0.75
  );
}

export function nextCardLock(
  previous: CardLock,
  candidate: Quad | null,
  width: number,
  height: number,
): CardLock {
  if (!candidate || !plausibleCardQuad(candidate, width, height))
    return { corners: null, stableFrames: 0 };
  const stable =
    previous.corners !== null &&
    previous.corners.every(
      (corner, index) =>
        Math.hypot(
          corner.x - candidate[index]!.x,
          corner.y - candidate[index]!.y,
        ) < 0.045,
    );
  return {
    corners: candidate,
    stableFrames: stable ? Math.min(3, previous.stableFrames + 1) : 1,
  };
}
