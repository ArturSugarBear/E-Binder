/** 3x3 geometry for a perspective-corrected binder page.
 * Slot coordinates are always row-major, top-left to bottom-right.
 * The pocket inset removes most plastic seams without hiding card titles.
 */
export interface PocketCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function pocketCrop(
  slot: number,
  imageWidth: number,
  imageHeight: number,
  inset = 0.045,
): PocketCrop {
  if (
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= 9 ||
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    imageWidth < 9 ||
    imageHeight < 9 ||
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

/** Crops are held only in memory for the review session, never stored/uploaded. */
export async function extractPagePockets(
  alignedPage: Blob,
  signal: AbortSignal,
): Promise<Blob[]> {
  if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  const bitmap = await createImageBitmap(alignedPage);
  const output: Blob[] = [];
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Die Binderseite kann nicht verarbeitet werden.');
    canvas.width = 394;
    canvas.height = 548;
    for (let slot = 0; slot < 9; slot++) {
      if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      const crop = pocketCrop(slot, bitmap.width, bitmap.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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
          0.9,
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
