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
  if (
    width < 16 ||
    height < 16 ||
    rgba.length !== width * height * 4
  )
    return false;
  let saturation = 0;
  let brightness = 0;
  let bright = 0;
  let count = 0;
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
      count++;
    }
  return (
    count > 0 &&
    saturation / count < 38 &&
    brightness / count < 115 &&
    bright / count < 0.02
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
