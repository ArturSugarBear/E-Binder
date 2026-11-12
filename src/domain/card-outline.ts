import { cardProjection, type Point, type Quad } from './photo-geometry';
import { plausibleCardQuad } from './live-card-lock';
import { suggestPageCorners } from './page-outline';

type Axis = 'vertical' | 'horizontal';
type Edge = {
  position: number;
  slope: number;
  score: number;
};

/**
 * Find the four sides of a *single physical card* in the downscaled live
 * camera frame. A binder-page detector alone can miss smaller, centered
 * cards; this searches card-sized borders and validates their proportions.
 *
 * False positives are more harmful than a manual fallback: this function
 * returns null rather than selecting arbitrary interior artwork edges.
 * No pixel buffer is saved or transmitted.
 */
export function suggestCardCorners(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Quad | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 64 ||
    height < 80 ||
    rgba.length !== width * height * 4
  )
    return null;

  // Preserve the existing good path for high-contrast, nearly full-frame
  // cards, but never use a page quad with non-card proportions.
  const page = suggestPageCorners(rgba, width, height);
  const whollyVisible = (quad: Quad): boolean =>
    quad.every((point) =>
      point.x > 0.07 &&
      point.x < 0.93 &&
      point.y > 0.07 &&
      point.y < 0.93,
    );
  if (page && plausibleCardQuad(page, width, height) && whollyVisible(page))
    return page;

  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const n = i * 4;
    gray[i] = Math.round(
      0.2126 * rgba[n]! +
        0.7152 * rgba[n + 1]! +
        0.0722 * rgba[n + 2]!,
    );
  }

  function find(axis: Axis, near: boolean): Edge[] {
    const candidates: Edge[] = [];
    const start = near ? 0.055 : 0.56;
    const end = near ? 0.44 : 0.945;
    for (let step = 0; step < 49; step++) {
      const position = start + ((end - start) * step) / 48;
      for (let angle = -9; angle <= 9; angle++) {
        const slope = angle * 0.018;
        let signed = 0;
        let magnitude = 0;
        let strong = 0;
        let count = 0;
        for (let sample = 0; sample < 40; sample++) {
          const t = 0.14 + (sample * 0.72) / 39;
          const p = position + slope * (t - 0.5);
          const x = Math.round((axis === 'vertical' ? p : t) * (width - 1));
          const y = Math.round((axis === 'vertical' ? t : p) * (height - 1));
          if (x < 3 || x >= width - 3 || y < 3 || y >= height - 3)
            continue;
          const before =
            axis === 'vertical'
              ? gray[y * width + x - 2]!
              : gray[(y - 2) * width + x]!;
          const after =
            axis === 'vertical'
              ? gray[y * width + x + 2]!
              : gray[(y + 2) * width + x]!;
          const delta = after - before;
          signed += delta;
          magnitude += Math.abs(delta);
          if (Math.abs(delta) >= 28) strong++;
          count++;
        }
        if (count < 33 || magnitude === 0) continue;
        const coverage = strong / count;
        const coherence = Math.abs(signed) / magnitude;
        const strength = magnitude / count;
        if (coverage < 0.57 || coherence < 0.66 || strength < 32)
          continue;
        const score = strength * (0.4 + 0.6 * coverage) * coherence;
        candidates.push({ position, slope, score });
      }
    }
    // Keep distinct sides rather than 3 neighboring samples of one edge.
    candidates.sort((a, b) => b.score - a.score);
    const chosen: Edge[] = [];
    for (const edge of candidates) {
      if (
        chosen.every(
          (other) =>
            Math.abs(edge.position - other.position) > 0.025 ||
            Math.abs(edge.slope - other.slope) > 0.075,
        )
      )
        chosen.push(edge);
      if (chosen.length === 5) break;
    }
    return chosen;
  }

  const left = find('vertical', true);
  const right = find('vertical', false);
  const top = find('horizontal', true);
  const bottom = find('horizontal', false);
  if (!left.length || !right.length || !top.length || !bottom.length)
    return null;

  function crossing(vertical: Edge, horizontal: Edge): Point {
    const denominator = 1 - vertical.slope * horizontal.slope;
    const x =
      (vertical.position +
        vertical.slope *
          (horizontal.position - 0.5 - horizontal.slope * 0.5)) /
      denominator;
    return { x, y: horizontal.position + horizontal.slope * (x - 0.5) };
  }

  let best: Quad | null = null;
  let bestScore = -Infinity;
  for (const l of left)
    for (const r of right)
      for (const t of top)
        for (const b of bottom) {
          const corners: Quad = [
            crossing(l, t),
            crossing(r, t),
            crossing(r, b),
            crossing(l, b),
          ];
          if (
            !plausibleCardQuad(corners, width, height) ||
            !whollyVisible(corners)
          )
            continue;
          try {
            cardProjection(corners);
          } catch {
            continue;
          }
          const area = (r.position - l.position) * (b.position - t.position);
          // Prefer a complete visible outer border over a stronger inner
          // artwork frame; the physical shape is still validated above.
          const score = l.score + r.score + t.score + b.score + area * 70;
          if (score > bestScore) {
            best = corners;
            bestScore = score;
          }
        }
  return best;
}
