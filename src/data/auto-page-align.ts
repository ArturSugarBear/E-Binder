import { suggestPageCorners } from '../domain/page-outline';
import { cardProjection, type Quad } from '../domain/photo-geometry';

export type AutomaticPageAlignment = {
  blob: Blob;
  method: 'detected' | 'full-photo';
};

/**
 * Photo-first capture: build nine aligned pockets without opening the corner
 * editor. The editor is still available explicitly from the review screen.
 * Images remain in memory and are never uploaded.
 */
export async function autoAlignPage(
  photo: Blob,
  signal: AbortSignal,
): Promise<AutomaticPageAlignment> {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const url = URL.createObjectURL(photo);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error('Foto konnte nicht geöffnet werden.');

    const source = document.createElement('canvas');
    const scale = Math.min(
      1,
      2000 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    source.width = Math.max(1, Math.round(image.naturalWidth * scale));
    source.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = source.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Fotoverarbeitung ist nicht verfügbar.');
    context.drawImage(image, 0, 0, source.width, source.height);

    const small = document.createElement('canvas');
    const reduction = Math.min(
      1,
      256 / Math.max(source.width, source.height),
    );
    small.width = Math.max(48, Math.round(source.width * reduction));
    small.height = Math.max(48, Math.round(source.height * reduction));
    const thumb = small.getContext('2d', { willReadFrequently: true });
    if (!thumb) throw new Error('Fotoverarbeitung ist nicht verfügbar.');
    thumb.drawImage(source, 0, 0, small.width, small.height);

    const proposed = suggestPageCorners(
      thumb.getImageData(0, 0, small.width, small.height).data,
      small.width,
      small.height,
    );
    // A partly occupied page still occupies the whole 3x3 sheet. Never crop
    // to only the visible cards or silently discard empty pockets.
    const wideEnough =
      proposed &&
      proposed[1].x - proposed[0].x > 0.72 &&
      proposed[2].x - proposed[3].x > 0.72 &&
      proposed[3].y - proposed[0].y > 0.68 &&
      proposed[2].y - proposed[1].y > 0.68;
    const corners: Quad = wideEnough
      ? proposed
      : [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ];
    const mapping = cardProjection(corners);
    const input = context.getImageData(0, 0, source.width, source.height);
    const output = document.createElement('canvas');
    output.width = 1260;
    output.height = 1760;
    const out = output.getContext('2d');
    if (!out) throw new Error('Fotoverarbeitung ist nicht verfügbar.');
    const pixels = out.createImageData(output.width, output.height);
    const src = input.data;
    const dst = pixels.data;

    for (let y = 0; y < output.height; y++) {
      if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      for (let x = 0; x < output.width; x++) {
        const point = mapping(
          x / (output.width - 1),
          y / (output.height - 1),
        );
        const sx = Math.max(
          0,
          Math.min(source.width - 1, point.x * (source.width - 1)),
        );
        const sy = Math.max(
          0,
          Math.min(source.height - 1, point.y * (source.height - 1)),
        );
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = Math.min(x0 + 1, source.width - 1);
        const y1 = Math.min(y0 + 1, source.height - 1);
        const fx = sx - x0;
        const fy = sy - y0;
        const a = (y0 * source.width + x0) * 4;
        const b = (y0 * source.width + x1) * 4;
        const c = (y1 * source.width + x0) * 4;
        const d = (y1 * source.width + x1) * 4;
        const dest = (y * output.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          dst[dest + channel] =
            src[a + channel]! * (1 - fx) * (1 - fy) +
            src[b + channel]! * fx * (1 - fy) +
            src[c + channel]! * (1 - fx) * fy +
            src[d + channel]! * fx * fy;
        }
        dst[dest + 3] = 255;
      }
      if (y % 256 === 255)
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
    }
    out.putImageData(pixels, 0, 0);
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    const blob = await new Promise<Blob>((resolve, reject) =>
      output.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error('Der automatische Zuschnitt ist fehlgeschlagen.')),
        'image/jpeg',
        0.94,
      ),
    );
    return { blob, method: wideEnough ? 'detected' : 'full-photo' };
  } finally {
    URL.revokeObjectURL(url);
  }
}
