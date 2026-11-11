import type { PersonalCard } from '../domain/personal';

/**
 * Local image evidence for a small set+collector-number shortlist.
 * This uses the actual card image, never card names or an adjacent card.
 * Similarity is not a calibrated probability and must not prove ownership.
 */
const allowedHosts = new Set([
  'assets.tcgdex.net',
  'images.pokemontcg.io',
  'images.scrydex.com',
]);

function allowedUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname))
      return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function spatialColourSignature(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const result = new Float32Array(4 * 4 * 14);
  if (width < 4 || height < 4 || pixels.length !== width * height * 4)
    return result;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      const r = pixels[pixel]! / 255;
      const g = pixels[pixel + 1]! / 255;
      const b = pixels[pixel + 2]! / 255;
      const maximum = Math.max(r, g, b);
      const minimum = Math.min(r, g, b);
      const saturation = maximum ? (maximum - minimum) / maximum : 0;
      let colour = maximum > 0.5 ? 12 : 13;
      if (saturation > 0.14 && maximum > minimum) {
        const delta = maximum - minimum;
        const hue =
          maximum === r
            ? ((g - b) / delta + 6) % 6
            : maximum === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4;
        colour = Math.floor((hue * 60) / 30) % 12;
      }
      const region =
        Math.min(3, Math.floor(y / (height / 4))) * 4 +
        Math.min(3, Math.floor(x / (width / 4)));
      result[region * 14 + colour] += saturation > 0.14 ? 1 : 0.3;
    }
  }
  // Normalise every region: a brighter sleeve reflection should not dominate.
  for (let region = 0; region < 16; region++) {
    let total = 0;
    for (let i = 0; i < 14; i++) total += result[region * 14 + i]!;
    if (!total) continue;
    for (let i = 0; i < 14; i++) result[region * 14 + i] /= total;
  }
  return result;
}

export function cosineSimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    a2 += a[i]! ** 2;
    b2 += b[i]! ** 2;
  }
  return a2 > 0 && b2 > 0 ? dot / Math.sqrt(a2 * b2) : 0;
}

async function signature(bitmap: ImageBitmap): Promise<Float32Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 88;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Bildvergleich ist nicht verfügbar');
  context.drawImage(
    bitmap,
    bitmap.width * 0.07,
    bitmap.height * 0.09,
    bitmap.width * 0.86,
    bitmap.height * 0.77,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return spatialColourSignature(
    context.getImageData(0, 0, canvas.width, canvas.height).data,
    canvas.width,
    canvas.height,
  );
}

export interface AppearanceResult {
  card: PersonalCard;
  similarity: number;
}

export async function compareCandidateArtwork(
  photo: Blob,
  cards: PersonalCard[],
  signal: AbortSignal,
): Promise<AppearanceResult[]> {
  if (signal.aborted || !cards.length) return [];
  let source: ImageBitmap;
  try {
    source = await createImageBitmap(photo);
  } catch {
    return [];
  }
  let reference: Float32Array;
  try {
    reference = await signature(source);
  } finally {
    source.close();
  }
  const results: AppearanceResult[] = [];
  // Small, bounded public image lookup: do not send the private photo away.
  const usable = cards.filter((card) => allowedUrl(card.image)).slice(0, 24);
  for (let start = 0; start < usable.length; start += 4) {
    if (signal.aborted) break;
    const batch = await Promise.allSettled(
      usable.slice(start, start + 4).map(async (card) => {
        const url = allowedUrl(card.image)!;
        const response = await fetch(url, {
          mode: 'cors',
          signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
        });
        if (!response.ok) throw new Error('Kartenbild nicht erreichbar');
        const image = await createImageBitmap(await response.blob());
        try {
          return {
            card,
            similarity: cosineSimilarity(reference, await signature(image)),
          };
        } finally {
          image.close();
        }
      }),
    );
    for (const item of batch) {
      if (item.status === 'fulfilled') results.push(item.value);
    }
  }
  return results.sort(
    (a, b) =>
      b.similarity - a.similarity || a.card.key.localeCompare(b.card.key),
  );
}

export function strongAppearanceAgreement(
  sorted: readonly AppearanceResult[],
): PersonalCard | undefined {
  const first = sorted[0];
  const second = sorted[1];
  // Conservative evidence gate, not a claim of a calibrated model accuracy.
  return first &&
    first.similarity >= 0.9 &&
    (!second || first.similarity - second.similarity >= 0.1)
    ? first.card
    : undefined;
}
