import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRecognitionSession } from '../../src/data/recognize';

class SilentWorker {
  static latest: SilentWorker | undefined;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  messages: unknown[] = [];
  terminated = false;

  constructor() {
    SilentWorker.latest = this;
  }

  postMessage(message: unknown) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  SilentWorker.latest = undefined;
});

describe('live background OCR safety budget', () => {
  it('terminates a slow model after the bounded 5.6s attempt', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', SilentWorker);
    const abort = new AbortController();
    const session = createRecognitionSession(abort.signal, () => undefined, {
      fast: true,
      timeoutMs: 5600,
    });
    session.warmup();
    expect(SilentWorker.latest?.messages[0]).toMatchObject({ warmup: true });
    const work = session.recognize(new Blob(['card'], { type: 'image/jpeg' }));
    const failure = expect(work).rejects.toThrow(
      'Die Erkennung dauert zu lange',
    );
    expect(SilentWorker.latest?.messages[1]).toMatchObject({
      fast: true,
      numberOnly: false,
    });
    await vi.advanceTimersByTimeAsync(5599);
    expect(SilentWorker.latest?.terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await failure;
    expect(SilentWorker.latest?.terminated).toBe(true);
  });
});
