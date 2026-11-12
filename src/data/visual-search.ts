import type { VisualHit } from '../domain/visual-retrieval';
import { visualBetaEnabled } from './visual-beta';

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
  if (signal.aborted || !visualBetaEnabled()) return null;
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
  // The model download, hash checks and ONNX initialization are a distinct
  // cold-start stage. A per-card timeout begins only after real readiness.
  // Otherwise all early scans time out while a valid model is downloading.
  let settledWarmup = false;
  let resolveWarmup: (() => void) | undefined;
  let rejectWarmup: ((reason: Error) => void) | undefined;
  const warmed = new Promise<void>((resolve, reject) => {
    resolveWarmup = resolve;
    rejectWarmup = reject;
  });
  void warmed.catch(() => undefined);
  const warmupTimer = setTimeout(() => {
    const error = new Error('Das Bildmodell konnte nicht rechtzeitig geladen werden.');
    finishWarmup(error);
    close();
  }, 60000);
  const finishWarmup = (error?: Error) => {
    if (settledWarmup) return;
    settledWarmup = true;
    clearTimeout(warmupTimer);
    if (error) rejectWarmup?.(error);
    else resolveWarmup?.();
  };
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
    finishWarmup(new DOMException('Abgebrochen', 'AbortError'));
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
    if (disposed) return;
    if (event.data.id === 0) {
      if (event.data.type === 'ready') finishWarmup();
      else if (event.data.type === 'error') {
        const reason = event.data.message ?? 'Bildmodell nicht verfügbar.';
        finishWarmup(new Error(reason));
        close();
      }
      return;
    }
    if (!current || event.data.id !== current.id) return;
    if (event.data.type === 'done') finish(undefined, event.data.hits ?? []);
    else if (event.data.type === 'error') {
      finish(new Error(event.data.message ?? 'Bildsuche fehlgeschlagen.'));
      close();
    }
  };
  // Serialise live captures so concurrent photos share one ONNX worker.
  // Bound the queue to prevent unbounded photo retention on old iPhones.
  let matchQueue: Promise<void> = Promise.resolve();
  let queuedMatches = 0;
  const matchOnce = async (
    photo: Blob,
    timeoutMs: number,
  ): Promise<VisualHit[]> => {
    await warmed;
    return new Promise((resolve, reject) => {
      if (disposed || signal.aborted) {
        reject(new DOMException('Abgebrochen', 'AbortError'));
        return;
      }
      if (current) {
        reject(new Error('Eine weitere Bildsuche läuft noch.'));
        return;
      }
      const id = ++nextId;
      const timer = setTimeout(
        () => {
          finish(
            new Error(
              'Die Bildsuche wurde wegen Zeitüberschreitung abgebrochen.',
            ),
          );
          close();
        },
        Math.max(1, Math.min(45000, timeoutMs)),
      );
      current = { id, resolve, reject, timer };
      worker.postMessage({ id, photo, manifestUrl });
    });
  };
  signal.addEventListener('abort', close, { once: true });
  const match = (photo: Blob, timeoutMs = 45000): Promise<VisualHit[]> => {
    if (disposed || signal.aborted)
      return Promise.reject(new DOMException('Abgebrochen', 'AbortError'));
    if (queuedMatches >= 5)
      return Promise.reject(new Error('Zu viele gleichzeitige Bildsuchen.'));
    queuedMatches++;
    const result = matchQueue
      .catch(() => undefined)
      .then(() => matchOnce(photo, timeoutMs));
    matchQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      queuedMatches--;
    });
  };
  if (signal.aborted) close();
  else {
    try {
      worker.postMessage({
        id: 0,
        warmup: true,
        photo: new Blob(),
        manifestUrl,
      });
    } catch {
      const error = new Error('Das Bildmodell konnte nicht gestartet werden.');
      finishWarmup(error);
      close();
    }
  }
  return { match, close };
}
