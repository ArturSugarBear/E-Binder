import { cardProjection, type Point, type Quad } from './photo-geometry';

type Axis = 'vertical' | 'horizontal';
type EdgeLine = {
  position: number;
  slope: number;
  coverage: number;
  coherence: number;
  strength: number;
};

/**
 * Suggest a quadrilateral only when four consistent, high-contrast outer edges
 * are visible. A low-confidence or cluttered photograph keeps manual corners.
 *
 * Work is bounded: the caller supplies a small downscaled RGBA image; neither
 * the original photo nor detection data is persisted or sent to a server.
 */
export function suggestPageCorners(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Quad | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 48 ||
    height < 48 ||
    rgba.length !== width * height * 4
  )
    return null;

  const luminance = new Uint8Array(width * height);
  for (let index = 0; index < luminance.length; index++) {
    const pixel = index * 4;
    luminance[index] = Math.round(
      0.2126 * rgba[pixel]! +
        0.7152 * rgba[pixel + 1]! +
        0.0722 * rgba[pixel + 2]!,
    );
  }

  const search = (axis: Axis, side: 'near' | 'far'): EdgeLine | null => {
    const start = side === 'near' ? 0.03 : 0.7;
    const end = side === 'near' ? 0.3 : 0.97;
    let best: EdgeLine | null = null;
    for (let step = 0; step <= 39; step++) {
      const position = start + ((end - start) * step) / 39;
      for (let angle = -8; angle <= 8; angle++) {
        const slope = angle * 0.025;
        let magnitude = 0;
        let signed = 0;
        let strong = 0;
        let total = 0;
        for (let sample = 0; sample < 40; sample++) {
          const t = 0.135 + (sample * 0.73) / 39;
          const line = position + slope * (t - 0.5);
          if (line < 0.01 || line > 0.99) continue;
          const x = Math.round(
            (axis === 'vertical' ? line : t) * (width - 1),
          );
          const y = Math.round(
            (axis === 'vertical' ? t : line) * (height - 1),
          );
          if (x < 3 || y < 3 || x >= width - 3 || y >= height - 3)
            continue;
          const before =
            axis === 'vertical'
              ? luminance[y * width + x - 2]!
              : luminance[(y - 2) * width + x]!;
          const after =
            axis === 'vertical'
              ? luminance[y * width + x + 2]!
              : luminance[(y + 2) * width + x]!;
          const difference = after - before;
          magnitude += Math.abs(difference);
          signed += difference;
          if (Math.abs(difference) >= 32) strong++;
          total++;
        }
        if (total < 34 || magnitude === 0) continue;
        const coverage = strong / total;
        const coherence = Math.abs(signed) / magnitude;
        const strength = (magnitude / total) * (0.35 + 0.65 * coverage);
        if (
          coverage < 0.65 ||
          coherence < 0.58 ||
          strength < 34 ||
          (best !== null && strength <= best.strength)
        )
          continue;
        best = { position, slope, coverage, coherence, strength };
      }
    }
    return best;
  };

  const left = search('vertical', 'near');
  const right = search('vertical', 'far');
  const top = search('horizontal', 'near');
  const bottom = search('horizontal', 'far');
  if (!left || !right || !top || !bottom) return null;

  // Vertical edge: x = position + slope * (y - 0.5).
  // Horizontal edge: y = position + slope * (x - 0.5).
  const intersection = (v: EdgeLine, h: EdgeLine): Point => {
    const denominator = 1 - v.slope * h.slope;
    const x =
      (v.position + v.slope * (h.position - 0.5 - h.slope * 0.5)) /
      denominator;
    return { x, y: h.position + h.slope * (x - 0.5) };
  };
  const corners: Quad = [
    intersection(left, top),
    intersection(right, top),
    intersection(right, bottom),
    intersection(left, bottom),
  ];
  // Avoid offering a tiny object, interior pocket, or invalid perspective.
  const [tl, tr, br, bl] = corners;
  if (
    Math.min(tr.x - tl.x, br.x - bl.x) < 0.48 ||
    Math.min(bl.y - tl.y, br.y - tr.y) < 0.52
  )
    return null;
  try {
    cardProjection(corners);
    return corners;
  } catch {
    return null;
  }
}
