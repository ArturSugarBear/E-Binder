import { recognitionClues } from '../data/card-catalog';
import { recognizedNameHints } from './recognition-names';

/** The entire first OCR + targeted retries + card lookup shares this cap. */
export const LIVE_SCAN_BUDGET_MS = 5600;
export const LIVE_SCAN_MAX_OCR_PASSES = 3;

export type LiveHotZone = 'footer' | 'footer-contrast' | 'title' | 'title-wide';

export function remainingLiveScanBudget(
  started: number,
  now: number,
  limit = LIVE_SCAN_BUDGET_MS,
): number {
  if (!Number.isFinite(started) || !Number.isFinite(now)) return 0;
  return Math.max(0, limit - Math.max(0, now - started));
}

/** Prefer the printed identity over a plausible but generic creature name. */
export function liveScanMissingEvidence(text: string): {
  footer: boolean;
  title: boolean;
} {
  return {
    footer: !recognitionClues(text).some(
      (clue) => Boolean(clue.setId && clue.number),
    ),
    title: recognizedNameHints(text).length === 0,
  };
}

/**
 * Reads are from the same physical image, not statistically independent
 * observations. Do not convert multiple crop results into confidence votes.
 */
export function nextLiveHotZone(
  text: string,
  alreadyTried: readonly LiveHotZone[],
): LiveHotZone | undefined {
  const missing = liveScanMissingEvidence(text);
  if (missing.footer) {
    if (!alreadyTried.includes('footer')) return 'footer';
    if (!alreadyTried.includes('footer-contrast')) return 'footer-contrast';
  }
  if (missing.title) {
    if (!alreadyTried.includes('title')) return 'title';
    if (!alreadyTried.includes('title-wide')) return 'title-wide';
  }
  return undefined;
}

/** Preserve distinct lines rather than count repeated OCR strings as votes. */
export function combineLiveOcrText(
  current: string,
  extra: string,
): string {
  const lines = new Set(
    [...current.split(/\r?\n/), ...extra.split(/\r?\n/)]
      .map((line) => line.trim())
      .filter(Boolean),
  );
  return [...lines].join('\n').slice(0, 30000);
}
