/** Reusable local PaddleOCR worker. All photos stay on the device. */
import type { LiveHotZone } from '../domain/live-ocr-policy';
export interface RecognitionOptions {
  /** A limited hot-zone pass for responsive live capture; no accuracy claim. */
  fast?: boolean;
  /** Hard per-card OCR time budget; a timed-out worker is disposed. */
  timeoutMs?: number;
}

export function createRecognitionSession(
  signal: AbortSignal,
  progress: (status: string, fraction?: number) => void,
  options: RecognitionOptions = {},
) {
  const worker = new Worker(new URL('./vision-worker.ts', import.meta.url), {
    type: 'module',
  });
  let disposed = false;
  let sequence = 0;
  let pending:
    | {
        id: number;
        resolve: (text: string) => void;
        reject: (reason: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  const finish = (error?: Error, text = '') => {
    if (!pending) return;
    const current = pending;
    pending = undefined;
    clearTimeout(current.timer);
    if (error) current.reject(error);
    else current.resolve(text);
  };
  const close = () => {
    if (disposed) return;
    disposed = true;
    worker.terminate();
    signal.removeEventListener('abort', close);
    finish(new DOMException('Abgebrochen', 'AbortError'));
  };
  signal.addEventListener('abort', close, { once: true });
  worker.onerror = (event) => {
    event.preventDefault();
    finish(new Error('Die lokale Erkennung konnte nicht gestartet werden.'));
    close();
  };
  worker.onmessage = (
    event: MessageEvent<{
      type: string;
      id?: number;
      status?: string;
      text?: string;
      message?: string;
    }>,
  ) => {
    if (disposed || !pending || event.data.id !== pending.id) return;
    if (event.data.type === 'progress') {
      progress(event.data.status ?? 'Erkennung läuft …');
    } else if (event.data.type === 'done') {
      finish(undefined, event.data.text ?? '');
    } else if (event.data.type === 'error') {
      finish(
        new Error(
          event.data.message ?? 'Das Foto konnte nicht gelesen werden.',
        ),
      );
    }
  };
  const recognize = (
    photo: Blob,
    numberOnly = false,
    hotZone?: LiveHotZone,
    timeoutMs?: number,
  ): Promise<string> =>
    new Promise((resolve, reject) => {
      if (disposed || signal.aborted) {
        reject(new DOMException('Abgebrochen', 'AbortError'));
        return;
      }
      if (pending) {
        reject(new Error('Es läuft bereits eine Texterkennung.'));
        return;
      }
      const id = ++sequence;
      const timer = setTimeout(
        () => {
          finish(
            new Error(
              'Die Erkennung dauert zu lange. Prüfe die Karte manuell.',
            ),
          );
          close();
        },
        Math.max(
          1,
          Math.min(options.timeoutMs ?? 90000, timeoutMs ?? Infinity),
        ),
      );
      pending = { id, timer, resolve, reject };
      progress('Lokale Erkennung wird vorbereitet …');
      try {
        worker.postMessage({
          id,
          photo,
          numberOnly,
          hotZone,
          fast: options.fast === true,
          modelUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocrv4-rec.onnx`,
          dictionaryUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocr-keys.txt`,
        });
      } catch {
        finish(
          new Error('Das Bild konnte nicht zur Erkennung übergeben werden.'),
        );
      }
    });
  const warmup = () => {
    if (disposed || signal.aborted) return;
    try {
      // Preload the same local 10.8 MB ONNX model while the collector
      // positions the first card. The worker serializes this ahead of OCR.
      worker.postMessage({
        warmup: true,
        photo: new Blob(),
        modelUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocrv4-rec.onnx`,
        dictionaryUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocr-keys.txt`,
      });
    } catch {
      // First real scan will retry normal model loading.
    }
  };
  if (signal.aborted) close();
  return { recognize, warmup, close };
}

/** Compatible with the original single-card flow; worker is disposed after use. */
export async function recognizePhoto(
  photo: Blob,
  signal: AbortSignal,
  progress: (status: string, fraction?: number) => void,
  options: RecognitionOptions = {},
): Promise<string> {
  const session = createRecognitionSession(signal, progress, options);
  try {
    return await session.recognize(photo);
  } finally {
    session.close();
  }
}
