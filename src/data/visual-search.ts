import type { VisualHit } from '../domain/visual-retrieval';

export interface VisualSearchSession {
  match: (photo: Blob, timeoutMs?: number) => Promise<VisualHit[]>;
  close: () => void;
}

/**
 * Optional visual-first path. No model/index is downloaded unless the app has
 * a same-origin, versioned manifest. Missing assets leave OCR fully functional.
 */
export async function createVisualSearchSession(
  signal: AbortSignal,
): Promise<VisualSearchSession | null> {
  if (signal.aborted) return null;
  const manifestUrl = `${import.meta.env.BASE_URL}assets/vision/manifest.json`;
  try {
    const response = await fetch(manifestUrl, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(1800)]),
      cache: 'no-cache',
    });
    if (!response.ok) return null;
  } catch {
    return null;
  }
  if (signal.aborted) return null;
  const worker = new Worker(new URL('./visual-worker.ts', import.meta.url), {
    type: 'module',
  });
  let disposed = false;
  let nextId = 0;
  let current:
    | {
        id: number;
        resolve: (hits: VisualHit[]) => void;
        reject: (reason: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  const finish = (error?: Error, hits: VisualHit[] = []) => {
    if (!current) return;
    const request = current;
    current = undefined;
    clearTimeout(request.timer);
    if (error) request.reject(error);
    else request.resolve(hits);
  };
  const close = () => {
    if (disposed) return;
    disposed = true;
    worker.terminate();
    signal.removeEventListener('abort', close);
    finish(new DOMException('Abgebrochen', 'AbortError'));
  };
  worker.onerror = (event) => {
    event.preventDefault();
    finish(new Error('Lokale Bildsuche ist nicht verfügbar.'));
    close();
  };
  worker.onmessage = (
    event: MessageEvent<{
      id?: number;
      type: string;
      hits?: VisualHit[];
      message?: string;
    }>,
  ) => {
    if (disposed || !current || event.data.id !== current.id) return;
    if (event.data.type === 'done') finish(undefined, event.data.hits ?? []);
    else if (event.data.type === 'error') {
      finish(new Error(event.data.message ?? 'Bildsuche fehlgeschlagen.'));
      close();
    }
  };
  const match = (
    photo: Blob,
    timeoutMs = 45000,
  ): Promise<VisualHit[]> =>
    new Promise((resolve, reject) => {
      if (disposed || signal.aborted) {
        reject(new DOMException('Abgebrochen', 'AbortError'));
        return;
      }
      if (current) {
        reject(new Error('Eine weitere Bildsuche läuft noch.'));
        return;
      }
      const id = ++nextId;
      const timer = setTimeout(() => {
        finish(
          new Error(
            'Die Bildsuche wurde wegen Zeitüberschreitung abgebrochen.',
          ),
        );
        close();
      }, Math.max(1, Math.min(45000, timeoutMs)));
      current = { id, resolve, reject, timer };
      worker.postMessage({ id, photo, manifestUrl });
    });
  signal.addEventListener('abort', close, { once: true });
  if (signal.aborted) close();
  return { match, close };
}
