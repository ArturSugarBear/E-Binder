import { cardProjection, type Quad } from './photo-geometry';

/**
 * Rectify a physical card with bilinear interpolation instead of pixel
 * rounding. Small OCR glyphs remain less jagged after perspective correction.
 * Runs entirely on a bounded in-memory RGBA camera frame.
 */
export function resamplePerspectivePixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  outputWidth: number,
  outputHeight: number,
  corners: Quad,
): Uint8ClampedArray {
  if (
    ![width, height, outputWidth, outputHeight].every(
      (size) => Number.isInteger(size) && size >= 2 && size <= 4096,
    ) ||
    rgba.length !== width * height * 4
  )
    throw new Error('Ungültige Kameradaten für die Entzerrung.');
  const project = cardProjection(corners);
  const result = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  for (let y = 0; y < outputHeight; y++)
    for (let x = 0; x < outputWidth; x++) {
      const point = project(x / (outputWidth - 1), y / (outputHeight - 1));
      const sourceX = Math.max(0, Math.min(width - 1, point.x * (width - 1)));
      const sourceY = Math.max(0, Math.min(height - 1, point.y * (height - 1)));
      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const dx = sourceX - x0;
      const dy = sourceY - y0;
      const topLeft = (y0 * width + x0) * 4;
      const topRight = (y0 * width + x1) * 4;
      const bottomLeft = (y1 * width + x0) * 4;
      const bottomRight = (y1 * width + x1) * 4;
      const destination = (y * outputWidth + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const upper =
          rgba[topLeft + channel]! * (1 - dx) + rgba[topRight + channel]! * dx;
        const lower =
          rgba[bottomLeft + channel]! * (1 - dx) +
          rgba[bottomRight + channel]! * dx;
        result[destination + channel] = upper * (1 - dy) + lower * dy;
      }
      result[destination + 3] = 255;
    }
  return result;
}
