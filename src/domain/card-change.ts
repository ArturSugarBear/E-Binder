import { cardProjection, type Quad } from './photo-geometry';

export interface CardChangeState {
  frames: number;
  previous: Float32Array | null;
}

/**
 * Small illumination-normalized artwork fingerprint sampled from the
 * rectified card interior. It stays in memory and never leaves the device.
 * Does not identify a card or imply ownership.
 */
export function captureCardSignature(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  corners: Quad,
): Float32Array | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 64 ||
    height < 80 ||
    rgba.length !== width * height * 4
  )
    return null;
  let project: ReturnType<typeof cardProjection>;
  try {
    project = cardProjection(corners);
  } catch {
    return null;
  }
  const columns = 10;
  const rows = 14;
  const samples = new Float32Array(columns * rows);
  let sum = 0;
  let sumSquares = 0;
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const u = 0.1 + (0.8 * (column + 0.5)) / columns;
      const v = 0.13 + (0.74 * (row + 0.5)) / rows;
      const point = project(u, v);
      const x = Math.round(point.x * (width - 1));
      const y = Math.round(point.y * (height - 1));
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2)
        return null;
      let brightness = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const offset = ((y + dy) * width + x + dx) * 4;
          brightness +=
            0.2126 * rgba[offset]! +
            0.7152 * rgba[offset + 1]! +
            0.0722 * rgba[offset + 2]!;
        }
      const value = brightness / 9;
      samples[row * columns + column] = value;
      sum += value;
      sumSquares += value * value;
    }
  const mean = sum / samples.length;
  const deviation = Math.sqrt(
    Math.max(0, sumSquares / samples.length - mean * mean),
  );
  // Uniform sleeves or overexposed cards have no useful identity texture.
  if (deviation < 14) return null;
  const normalized = new Float32Array(samples.length);
  const scale = deviation * Math.sqrt(samples.length);
  for (let i = 0; i < samples.length; i++)
    normalized[i] = (samples[i]! - mean) / scale;
  return normalized;
}

/** Cosine distance between already normalized fingerprints, not certainty. */
export function cardSignatureDistance(
  a: Float32Array | null,
  b: Float32Array | null,
): number | null {
  if (!a || !b || a.length !== b.length || a.length < 16) return null;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return Math.max(0, Math.min(2, 1 - dot));
}

/**
 * Rearm only after three coherent observations of visibly different art.
 * Ordinary card-removal detection and the manual Next action remain available.
 * A moving or relit copy of the same card must not double-capture.
 */
export function nextCardChange(
  previous: CardChangeState,
  captured: Float32Array | null,
  current: Float32Array | null,
): CardChangeState {
  const difference = cardSignatureDistance(captured, current);
  if (difference === null || difference < 0.55)
    return { frames: 0, previous: null };
  const continuity = cardSignatureDistance(previous.previous, current);
  return {
    frames:
      continuity !== null && continuity < 0.24
        ? Math.min(3, previous.frames + 1)
        : 1,
    previous: current,
  };
}
