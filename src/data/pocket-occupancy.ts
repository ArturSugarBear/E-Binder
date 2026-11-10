/**
 * Conservative empty-pocket hint. It is deliberately not a card detector:
 * coloured or reflective cards must never be marked empty based on one metric.
 * A user may override this suggestion before importing the binder page.
 */
export function looksLikeEmptyPocket(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): boolean {
  if (width < 16 || height < 16 || rgba.length !== width * height * 4)
    return false;
  let saturation = 0;
  let brightness = 0;
  let bright = 0;
  let count = 0;
  let gradients = 0;
  let gradientSamples = 0;
  // Ignore plastic sleeve edges: inspect the centre 70% of each crop.
  const x0 = Math.floor(width * 0.15);
  const x1 = Math.ceil(width * 0.85);
  const y0 = Math.floor(height * 0.15);
  const y1 = Math.ceil(height * 0.85);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const hi = Math.max(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
      const lo = Math.min(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
      saturation += hi ? ((hi - lo) / hi) * 255 : 0;
      brightness += hi;
      if (hi > 170) bright++;
      if (x > x0 + 1 && y > y0 + 1 && x < x1 - 2 && y < y1 - 2) {
        const gray = (offset: number) =>
          0.299 * rgba[offset]! +
          0.587 * rgba[offset + 1]! +
          0.114 * rgba[offset + 2]!;
        const left = i - 8;
        const right = i + 8;
        const up = i - width * 8;
        const down = i + width * 8;
        gradients += Math.abs(gray(right) - gray(left));
        gradients += Math.abs(gray(down) - gray(up));
        gradientSamples++;
      }
      count++;
    }
  return (
    count > 0 &&
    saturation / count < 38 &&
    brightness / count < 115 &&
    bright / count < 0.02 &&
    gradients / Math.max(1, gradientSamples) < 12
  );
}

export async function likelyEmptyPocket(
  photo: Blob,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const bitmap = await createImageBitmap(photo);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bitmap, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64);
    return looksLikeEmptyPocket(data.data, 64, 64);
  } finally {
    bitmap.close();
  }
}
