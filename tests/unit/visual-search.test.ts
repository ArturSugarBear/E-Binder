import { afterEach, expect, it, vi } from 'vitest';
import { createVisualSearchSession } from '../../src/data/visual-search';

afterEach(() => vi.unstubAllGlobals());

it('falls back to the existing OCR path when no licensed local embedding bundle exists', async () => {
  const request = vi
    .fn()
    .mockResolvedValue(new Response('Not found', { status: 404 }));
  const worker = vi.fn(() => {
    throw new Error('A missing model must never start an ONNX worker');
  });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'on') });
  vi.stubGlobal('fetch', request);
  vi.stubGlobal('Worker', worker);
  const session = await createVisualSearchSession(new AbortController().signal);
  expect(session).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  expect(String(request.mock.calls[0]![0])).toContain(
    '/assets/vision/manifest.json',
  );
  expect(worker).not.toHaveBeenCalled();
});

it('does not load an embedding model after a scanner was cancelled', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  controller.abort();
  expect(await createVisualSearchSession(controller.signal)).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it('does not start image inference until verified ONNX warmup signals readiness', async () => {
  const messages: unknown[] = [];
  const workers: FakeVisualWorker[] = [];
  class FakeVisualWorker {
    constructor() {
      workers.push(this);
    }
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    postMessage(value: unknown) {
      messages.push(value);
    }
    terminate() {}
    emit(value: unknown) {
      this.onmessage?.(new MessageEvent('message', { data: value }));
    }
  }
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'on') });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
  );
  vi.stubGlobal('Worker', FakeVisualWorker);
  const session = await createVisualSearchSession(new AbortController().signal);
  expect(session).not.toBeNull();
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ warmup: true, id: 0 });

  const pending = session!.match(new Blob(['real-photo']), 500);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(messages).toHaveLength(1);
  workers[0]?.emit({ id: 0, type: 'ready' });
  await vi.waitFor(() => expect(messages).toHaveLength(2));
  expect(messages[1]).toMatchObject({ id: 1 });
  expect(messages[1]).not.toHaveProperty('warmup');
  workers[0]?.emit({ id: 1, type: 'done', hits: [] });
  await expect(pending).resolves.toEqual([]);
  session!.close();
});
