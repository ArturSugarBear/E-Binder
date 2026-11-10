import { cardProjection, type Quad } from './photo-geometry';

/**
 * Fallback for dark binder pages with no visible outer boundary.
 * The stitched separators between the three columns and three rows usually
 * remain visible even when pockets are unoccupied. The detector seeks the
 * 45th-percentile cross-axis edge energy, not the brightest card artwork.
 *
 * Returns an approximation ONLY when two coherent separators are present
 * on both axes. No confidence score or ownership decision is inferred.
 */
export function suggestPocketGridCorners(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Quad | null {
  if (
    width < 64 ||
    height < 64 ||
    width > 512 ||
    height > 512 ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    rgba.length !== width * height * 4
  )
    return null;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = 0.2126 * rgba[p]! + 0.7152 * rgba[p + 1]! + 0.0722 * rgba[p + 2]!;
  }

  // A cheap two-pass Gaussian approximation suppresses sleeve microtexture.
  const horizontal = new Float32Array(gray.length);
  const smooth = new Float32Array(gray.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = gray[y * width + Math.max(0, x - 1)]!;
      const b = gray[y * width + x]!;
      const c = gray[y * width + Math.min(width - 1, x + 1)]!;
      horizontal[y * width + x] = (a + 2 * b + c) / 4;
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = horizontal[Math.max(0, y - 1) * width + x]!;
      const b = horizontal[y * width + x]!;
      const c = horizontal[Math.min(height - 1, y + 1) * width + x]!;
      smooth[y * width + x] = (a + 2 * b + c) / 4;
    }

  const find = (
    axis: 'horizontal' | 'vertical',
    near: [number, number],
    far: [number, number],
  ): [number, number] | null => {
    const vertical = axis === 'vertical';
    const size = vertical ? width : height;
    const other = vertical ? height : width;
    const profile = new Float32Array(size);
    for (let coord = 3; coord < size - 3; coord++) {
      const gradients: number[] = [];
      for (let t = 15; t < other - 15; t += 2) {
        const left = vertical
          ? smooth[t * width + coord - 2]!
          : smooth[(coord - 2) * width + t]!;
        const right = vertical
          ? smooth[t * width + coord + 2]!
          : smooth[(coord + 2) * width + t]!;
        gradients.push(Math.abs(right - left));
      }
      gradients.sort((a, b) => a - b);
      profile[coord] = gradients[Math.floor(gradients.length * 0.45)] ?? 0;
    }

    const filtered = new Float32Array(size);
    const weights = [1, 2, 3, 4, 3, 2, 1] as const;
    for (let p = 3; p < size - 3; p++)
      for (let k = -3; k <= 3; k++)
        filtered[p] =
          (filtered[p] ?? 0) + (profile[p + k]! * weights[k + 3]!) / 16;

    const peak = (band: [number, number]) => {
      const start = Math.max(3, Math.round(band[0] * (size - 1)));
      const end = Math.min(size - 4, Math.round(band[1] * (size - 1)));
      let best = start;
      for (let p = start + 1; p <= end; p++)
        if (filtered[p]! > filtered[best]!) best = p;
      return { pos: best / (size - 1), strength: filtered[best]! };
    };
    const a = peak(near);
    const b = peak(far);
    const spacing = b.pos - a.pos;
    if (a.strength < 8 || b.strength < 8 || spacing < 0.27 || spacing > 0.395)
      return null;
    return [a.pos, b.pos];
  };

  const columns = find('vertical', [0.275, 0.4], [0.6, 0.735]);
  const rows = find('horizontal', [0.24, 0.42], [0.57, 0.75]);
  if (!columns || !rows) return null;

  const [x1, x2] = columns;
  const [y1, y2] = rows;
  const left = 2 * x1 - x2;
  const right = 2 * x2 - x1;
  const top = 2 * y1 - y2;
  const bottom = 2 * y2 - y1;
  // Reject narrow grids, or extrapolations that leave too much image unseen.
  if (
    left < -0.09 ||
    right > 1.09 ||
    top < -0.09 ||
    bottom > 1.09 ||
    right - left < 0.84 ||
    bottom - top < 0.79
  )
    return null;

  const corners: Quad = [
    { x: Math.max(0, left), y: Math.max(0, top) },
    { x: Math.min(1, right), y: Math.max(0, top) },
    { x: Math.min(1, right), y: Math.min(1, bottom) },
    { x: Math.max(0, left), y: Math.min(1, bottom) },
  ];
  try {
    cardProjection(corners);
    return corners;
  } catch {
    return null;
  }
}
