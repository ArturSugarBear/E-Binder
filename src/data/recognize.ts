/** Reusable local PaddleOCR worker. All photos stay on the device. */
import type { LiveHotZone } from '../domain/live-ocr-policy';
export interface RecognitionOptions {
  /** Select the matching model/dictionary, including live language changes. */
  language?: string | (() => string);
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
  const modelPair = () => {
    const language =
      typeof options.language === 'function'
        ? options.language()
        : options.language;
    return {
      language,
      modelUrl: `${import.meta.env.BASE_URL}assets/ocr/${language === 'ja' ? 'ppocrv3-ja-rec.onnx' : 'ppocrv4-rec.onnx'}`,
      dictionaryUrl: `${import.meta.env.BASE_URL}assets/ocr/${language === 'ja' ? 'ppocr-ja-keys.txt' : 'ppocr-keys.txt'}`,
      latinModelUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocrv4-rec.onnx`,
      latinDictionaryUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocr-keys.txt`,
      japaneseModelUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocrv3-ja-rec.onnx`,
      japaneseDictionaryUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocr-ja-keys.txt`,
    };
  };
  const worker = new Worker(new URL('./vision-worker.ts', import.meta.url), {
    type: 'module',
  });
  let disposed = false;
  let sequence = 0;
  let warmed: Promise<void> | undefined;
  let warmedFor = '';
  let warmupTimer: ReturnType<typeof setTimeout> | undefined;
  let warmupResolve: (() => void) | undefined;
  let warmupReject: ((reason: Error) => void) | undefined;
  const finishWarmup = (error?: Error) => {
    clearTimeout(warmupTimer);
    if (error) warmupReject?.(error);
    else warmupResolve?.();
    warmupResolve = undefined;
    warmupReject = undefined;
  };
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
    finishWarmup(new DOMException('Abgebrochen', 'AbortError'));
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
    if (disposed) return;
    if (event.data.type === 'ready') {
      finishWarmup();
      return;
    }
    if (event.data.type === 'warmup-error') {
      finishWarmup(
        new Error('Das lokale Erkennungsmodell konnte nicht geladen werden.'),
      );
      return;
    }
    if (
      event.data.type === 'progress' &&
      event.data.id === undefined &&
      warmupResolve
    ) {
      progress(event.data.status ?? 'Erkennungsmodell wird geladen …');
      return;
    }
    if (!pending || event.data.id !== pending.id) return;
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
          ...modelPair(),
        });
      } catch {
        finish(
          new Error('Das Bild konnte nicht zur Erkennung übergeben werden.'),
        );
      }
    });
  const warmup = (): Promise<void> => {
    const pair = modelPair();
    if (warmed && warmedFor === pair.modelUrl) return warmed;
    if (warmed && warmupResolve) return warmed.then(() => warmup());
    warmedFor = pair.modelUrl;
    warmed = new Promise<void>((resolve, reject) => {
      warmupResolve = resolve;
      warmupReject = reject;
      if (disposed || signal.aborted) {
        finishWarmup(new DOMException('Abgebrochen', 'AbortError'));
        return;
      }
      warmupTimer = setTimeout(() => {
        finishWarmup(
          new Error(
            'Das Erkennungsmodell konnte nicht rechtzeitig vorbereitet werden.',
          ),
        );
        close();
      }, 60000);
      try {
        worker.postMessage({ warmup: true, photo: new Blob(), ...pair });
      } catch {
        finishWarmup(
          new Error('Das Erkennungsmodell konnte nicht vorbereitet werden.'),
        );
      }
    });
    // Existing callers may prefetch without awaiting; failures remain observable
    // by callers that await readiness, with no unhandled background rejection.
    void warmed.catch(() => undefined);
    return warmed;
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
