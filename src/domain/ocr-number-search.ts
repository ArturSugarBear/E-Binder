/** Regions to re-read when a sleeve or perspective moves the printed collector number. */
export type RecognitionRegion = readonly [
  x: number,
  y: number,
  width: number,
  height: number,
];

export const collectorNumberFallbackRegions: readonly RecognitionRegion[] = [
  [0.07, 0.84, 0.41, 0.055],
  [0.07, 0.865, 0.41, 0.055],
  [0.07, 0.89, 0.41, 0.055],
  [0.07, 0.915, 0.41, 0.055],
  [0.62, 0.9, 0.35, 0.055],
];

/** A printed fraction is evidence, not a calibrated confidence or exact card ID. */
export function hasPrintedCollectorFraction(texts: readonly string[]): boolean {
  return texts.some((text) =>
    /(?<!\d)\d{1,3}\s*[/|]\s*\d{1,3}(?!\d)/.test(text),
  );
}
