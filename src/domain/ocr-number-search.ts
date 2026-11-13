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

/** A single fallback crop for the lower 15% of an aligned card. Narrow
 * number and set-code reads remain the first, more precise OCR passes. */
export const wideCollectorFooterRegion: RecognitionRegion = [
  0.015, 0.85, 0.97, 0.145,
];

/** Typography aliases preserve digits; rarity glyphs are delimiters, not digits. */
export function normalizePrintedIdentityText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/(^|[^A-Za-z0-9])M[Iil]([A-Za-z])(?=[^A-Za-z]|$)/gi, '$1M1$2')
    .replace(/((?:SV|SM|XY|BW|S|M)\d{1,2}[a-z])(?=\d{1,3}\s*[/|])/gi, '$1 ')
    .replace(
      /(?<!\d)(\d{1,3}\s*[/|]\s*\d{1,3})(?=(?:SAR|CHR|CSR|RRR|SR|AR|UR|HR|RR|R|C|U)(?:[^A-Za-z]|$))/gi,
      '$1 ',
    );
}

/** A printed fraction is evidence, not a calibrated confidence or exact card ID. */
export function hasPrintedCollectorFraction(texts: readonly string[]): boolean {
  return texts.some((text) =>
    /(?<!\d)\d{1,3}\s*[/|]\s*\d{1,3}(?![A-Za-z0-9])/.test(
      normalizePrintedIdentityText(text),
    ),
  );
}

/** A footer set code makes the normalized collector fraction useful as a
 * specific printing lookup instead of an arbitrary same-numbered card. */
export function hasPrintedSetCode(texts: readonly string[]): boolean {
  return texts.some((text) =>
    /(?:^|[^A-Z0-9])(?:(?:MEG|SVI|PAL|OBF|PAR|TEF|TWM|SCR|SSP|JTG|DRI|PBL|DLR)\s*(?:DE|EN)?|(?:SV|SM|XY|BW|S|M)\d{1,2}[A-Z]?)(?=[^A-Z0-9]|$)/i.test(
      normalizePrintedIdentityText(text),
    ),
  );
}
