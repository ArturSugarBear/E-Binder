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
