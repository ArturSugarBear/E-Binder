import { detectCardBounds } from './pocket-card-edges';

/** 3x3 pocket geometry for an already aligned binder page.
 * Slot coordinates are row-major from top-left to bottom-right.
 * A pocket boundary is NOT assumed to be the printed card boundary.
 */
export interface PocketCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Preserve the whole pocket except a sub-percent guard against seam bleed. */
export function pocketCrop(
  slot: number,
  imageWidth: number,
  imageHeight: number,
  inset = 0.003,
): PocketCrop {
  if (
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= 9 ||
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    imageWidth < 9 ||
    imageHeight < 9 ||
    !Number.isFinite(inset) ||
    inset < 0 ||
    inset >= 0.2
  )
    throw new Error('Ungültige Binderseiten-Geometrie.');
  const cellWidth = imageWidth / 3;
  const cellHeight = imageHeight / 3;
  return {
    x: ((slot % 3) + inset) * cellWidth,
    y: (Math.floor(slot / 3) + inset) * cellHeight,
    width: cellWidth * (1 - 2 * inset),
    height: cellHeight * (1 - 2 * inset),
  };
}

/**
 * Prepare nine independent photo crops for review and OCR, in physical order.
 *
 * Step 1: isolate each COMPLETE pocket with only a tiny seam guard.
 * Step 2: look for four actual printed-card edges within that pocket.
 *         Use a measured card crop ONLY when all four edges agree. Otherwise
 *         keep the whole pocket so no name/set code/number is cut off.
 *
 * No further artificial upscaling; images stay in memory and are not uploaded.
 */
export async function extractPagePockets(
  alignedPage: Blob,
  signal: AbortSignal,
): Promise<Blob[]> {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const bitmap = await createImageBitmap(alignedPage);
  const output: Blob[] = [];
  try {
    const probe = document.createElement('canvas');
    probe.width = 160;
    probe.height = 224;
    const probeContext = probe.getContext('2d', {
      willReadFrequently: true,
    });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !probeContext)
      throw new Error('Die Binderseite kann nicht verarbeitet werden.');

    for (let slot = 0; slot < 9; slot++) {
      if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      const pocket = pocketCrop(slot, bitmap.width, bitmap.height);
      probeContext.clearRect(0, 0, probe.width, probe.height);
      probeContext.drawImage(
        bitmap,
        pocket.x,
        pocket.y,
        pocket.width,
        pocket.height,
        0,
        0,
        probe.width,
        probe.height,
      );
      const bounds = detectCardBounds(
        probeContext.getImageData(0, 0, probe.width, probe.height).data,
        probe.width,
        probe.height,
      );
      const crop = bounds
        ? {
            x: pocket.x + (bounds.x / probe.width) * pocket.width,
            y: pocket.y + (bounds.y / probe.height) * pocket.height,
            width: (bounds.width / probe.width) * pocket.width,
            height: (bounds.height / probe.height) * pocket.height,
          }
        : pocket;
      // A smaller source crop must not be needlessly enlarged to a fixed
      // output size: resampling does not restore lost printed text detail.
      canvas.width = Math.max(1, Math.min(420, Math.floor(crop.width)));
      canvas.height = Math.max(1, Math.min(586, Math.floor(crop.height)));
      ctx.drawImage(
        bitmap,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(
                  new Error(
                    'Der Kartenausschnitt konnte nicht gespeichert werden.',
                  ),
                ),
          'image/jpeg',
          0.94,
        );
      });
      output.push(blob);
    }
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    return output;
  } finally {
    bitmap.close();
  }
}
