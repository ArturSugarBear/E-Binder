import { describe, expect, it } from 'vitest';
import {
  MAX_PENDING_SCAN_CAPTURES,
  MAX_SCAN_SESSION_BYTES,
  pendingScanCount,
  scanQueueBlocker,
} from '../../src/domain/scan-session-guardrails';

const pending = { status: 'pending' } as const;
const confirmed = { status: 'confirmed' } as const;
const skipped = { status: 'skipped' } as const;

describe('P09 bounded scan-session buffer', () => {
  it('limits physical scan attempts to 24 unresolved photos, not 24 owned cards', () => {
    expect(MAX_PENDING_SCAN_CAPTURES).toBe(24);
    expect(pendingScanCount(Array(23).fill(pending))).toBe(23);
    expect(scanQueueBlocker(Array(23).fill(pending), [], 100)).toBeNull();
    expect(scanQueueBlocker(Array(24).fill(pending), [], 100)).toBe(
      'queue-full',
    );
  });

  it('counts deferred photos as unresolved and excludes explicitly confirmed ones', () => {
    const captures = [skipped, pending, confirmed];
    expect(pendingScanCount(captures)).toBe(2);
    expect(
      scanQueueBlocker(
        [confirmed, ...Array(23).fill(skipped)],
        [{ size: 1024 }],
        1024,
      ),
    ).toBeNull();
    expect(
      scanQueueBlocker([confirmed, ...Array(24).fill(skipped)], [], 1),
    ).toBe('queue-full');
  });

  it('refuses a photo that exceeds 48 MiB of transient images, without mutation', () => {
    const photos = [{ size: 24 * 1024 * 1024 }, { size: 24 * 1024 * 1024 }];
    const snapshot = structuredClone(photos);
    expect(MAX_SCAN_SESSION_BYTES).toBe(48 * 1024 * 1024);
    expect(scanQueueBlocker([], photos, 1)).toBe('memory-full');
    expect(scanQueueBlocker([], photos, 0)).toBeNull();
    expect(photos).toEqual(snapshot);
  });

  it('handles malformed and overflow sizes conservatively', () => {
    expect(scanQueueBlocker([], [], -1)).toBe('memory-full');
    expect(scanQueueBlocker([], [], Number.POSITIVE_INFINITY)).toBe('memory-full');
    expect(scanQueueBlocker([], [{ size: Number.MAX_SAFE_INTEGER }], 9))
      .toBe('memory-full');
  });

  it('does not alter holdings or silently add duplicate physical copies', () => {
    const captures = [pending, confirmed];
    const original = structuredClone(captures);
    scanQueueBlocker(captures, [{ size: 300 }], 100);
    expect(captures).toEqual(original);
  });
});
