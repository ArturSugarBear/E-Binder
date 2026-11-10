/**
 * Lightweight, deterministic capture diagnostics. Not an OCR confidence score.
 * Analysis uses a small downscaled copy and never transmits or saves photos.
 */
export interface PhotoQuality {
  meanBrightness: number;
  contrast: number;
  highlightFraction: number;
  shadowFraction: number;
  detail: number;
  warnings: string[];
}

export function analysePhotoPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): PhotoQuality {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 16 ||
    height < 16 ||
    pixels.length !== width * height * 4
  )
    throw new Error('Ungültige Bilddaten für die Qualitätsprüfung.');
  const luminance = new Uint8Array(width * height);
  const histogram = new Uint32Array(256);
  let total = 0;
  let bright = 0;
  let dark = 0;
  let sum = 0;
  // Ignore the pocket plastic around the outermost image boundary.
  const x0 = Math.round(width * 0.08);
  const x1 = Math.round(width * 0.92);
  const y0 = Math.round(height * 0.08);
  const y1 = Math.round(height * 0.92);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const index = y * width + x;
      const offset = index * 4;
      const value = Math.round(
        0.2126 * pixels[offset]! +
          0.7152 * pixels[offset + 1]! +
          0.0722 * pixels[offset + 2]!,
      );
      luminance[index] = value;
      histogram[value]!++;
      sum += value;
      total++;
      if (value >= 245) bright++;
      if (value <= 26) dark++;
    }
  const percentile = (fraction: number) => {
    const cutoff = Math.ceil(total * fraction);
    let count = 0;
    for (let i = 0; i < 256; i++) {
      count += histogram[i]!;
      if (count >= cutoff) return i;
    }
    return 255;
  };
  // Absolute discrete Laplacian of luminance in the central region.
  // It is only a hint about missing fine detail, not a sharpness guarantee.
  let highFrequency = 0;
  let cells = 0;
  for (let y = y0 + 1; y < y1 - 1; y += 2)
    for (let x = x0 + 1; x < x1 - 1; x += 2) {
      const i = y * width + x;
      highFrequency += Math.abs(
        4 * luminance[i]! -
          luminance[i - 1]! -
          luminance[i + 1]! -
          luminance[i - width]! -
          luminance[i + width]!,
      );
      cells++;
    }
  const meanBrightness = sum / total;
  const contrast = percentile(0.95) - percentile(0.05);
  const highlightFraction = bright / total;
  const shadowFraction = dark / total;
  const detail = highFrequency / cells;
  const warnings: string[] = [];
  if (meanBrightness < 57 || shadowFraction > 0.58)
    warnings.push('Sehr dunkel');
  if (highlightFraction > 0.31)
    warnings.push('Helle Reflexionen oder Überbelichtung möglich');
  if (contrast < 48)
    warnings.push('Wenig Kontrast');
  if (detail < 5.2)
    warnings.push('Wenige Bilddetails – möglicherweise unscharf oder leer');
  return {
    meanBrightness,
    contrast,
    highlightFraction,
    shadowFraction,
    detail,
    warnings,
  };
}

export async function inspectPocketPhoto(
  photo: Blob,
  signal: AbortSignal,
): Promise<PhotoQuality> {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const bitmap = await createImageBitmap(photo);
  try {
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 176;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Bildqualitätsprüfung nicht verfügbar.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return analysePhotoPixels(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    );
  } finally {
    bitmap.close();
  }
}
