/**
 * P09 batch-scan backpressure. Bound pending photographs independently from
 * metadata history. Confirmed scans never imply a new physical copy.
 */
export const MAX_PENDING_SCAN_CAPTURES = 24;
export const MAX_SCAN_SESSION_BYTES = 48 * 1024 * 1024;

export interface SessionCapture {
  status: 'pending' | 'confirmed' | 'skipped';
}

export type ScanQueueBlocker = 'queue-full' | 'memory-full' | null;
export type LiveCaptureOutcome = 'added' | 'duplicate' | 'limit' | 'error';

export function pendingScanCount(captures: readonly SessionCapture[]): number {
  return captures.filter((capture) => capture.status !== 'confirmed').length;
}

/**
 * A failed reservation must never discard an existing photo, increment card
 * quantity, mutate stored state, or treat a different photo as a duplicate.
 * Call only after the SHA-256 duplicate check.
 */
export function scanQueueBlocker(
  captures: readonly SessionCapture[],
  photos: Iterable<{ size: number }>,
  incomingBytes: number,
): ScanQueueBlocker {
  if (pendingScanCount(captures) >= MAX_PENDING_SCAN_CAPTURES)
    return 'queue-full';
  if (!Number.isSafeInteger(incomingBytes) || incomingBytes < 0)
    return 'memory-full';
  let usedBytes = 0;
  for (const photo of photos) {
    if (!Number.isSafeInteger(photo.size) || photo.size < 0)
      return 'memory-full';
    usedBytes += photo.size;
    if (!Number.isSafeInteger(usedBytes)) return 'memory-full';
  }
  return usedBytes + incomingBytes > MAX_SCAN_SESSION_BYTES
    ? 'memory-full'
    : null;
}
