import type { Worker } from 'tesseract.js';
import { footerVariants } from './recognition-image';

export async function recognizePhoto(
  blob: Blob,
  signal: AbortSignal,
  progress: (status: string, fraction?: number) => void,
): Promise<string> {
  const userSignal = signal;
  signal = AbortSignal.any([userSignal, AbortSignal.timeout(90000)]);
  let worker: Worker | undefined;
  let bitmap: ImageBitmap | undefined;
  const abort = () => {
    if (worker) void worker.terminate();
  };
  signal.addEventListener('abort', abort, { once: true });
  const cancellable = <T>(job: Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const stop = () => reject(new DOMException('Abgebrochen', 'AbortError'));
      if (signal.aborted) {
        stop();
        void job.catch(() => undefined);
        return;
      }
      signal.addEventListener('abort', stop, { once: true });
      void job
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', stop));
    });
  try {
    bitmap = await createImageBitmap(blob);
    progress('Lokale Texterkennung wird vorbereitet …');
    const { createWorker, PSM } = await import('tesseract.js');
    if (signal.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    const initializing = createWorker(['deu', 'eng'], 1, {
      workerPath: `${import.meta.env.BASE_URL}assets/ocr/worker.js`,
      workerBlobURL: false,
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
      errorHandler: () => undefined,
      logger: (event) => {
        if (event.status !== 'recognizing text')
          progress(
            event.status.includes('language')
              ? 'Sprachdaten werden geladen …'
              : 'OCR-Modell wird geladen …',
            event.progress,
          );
      },
    });
    void initializing
      .then((created) => {
        if (signal.aborted) void created.terminate();
      })
      .catch(() => undefined);
    worker = await cancellable(initializing);
    await cancellable(
      worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/-. ',
      }),
    );
    const texts: string[] = [];
    const observations = new Map<string, number>();
    await cancellable(
      worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE }),
    );
    for (const [index, canvas] of footerVariants(
      bitmap,
      'identifier',
    ).entries()) {
      progress(`Set und Nummer lesen · Bildvariante ${index + 1} …`, index / 8);
      const result = await cancellable(worker.recognize(canvas));
      texts.push(result.data.text);
      const numbers = new Set(
        [...result.data.text.matchAll(/\d{1,3}\s*\/\s*\d{1,3}/g)].map((match) =>
          match[0].replace(/\s/g, ''),
        ),
      );
      for (const number of numbers)
        observations.set(number, (observations.get(number) ?? 0) + 1);
      if ([...observations.values()].some((count) => count >= 2)) break;
    }
    if (![...observations.values()].some((count) => count >= 2)) {
      await cancellable(
        worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }),
      );
      for (const [index, canvas] of footerVariants(bitmap).entries()) {
        progress(
          `Unterer Kartenstreifen · Bildvariante ${index + 1} …`,
          0.5 + index / 16,
        );
        const result = await cancellable(worker.recognize(canvas));
        texts.push(result.data.text);
      }
    }
    await cancellable(
      worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: '',
      }),
    );
    progress('Kartenname wird zur Gegenprüfung gelesen …', 0.8);
    const title = await cancellable(
      worker.recognize(footerVariants(bitmap, 'title')[0]!),
    );
    texts.push(title.data.text);
    return texts.join('\n');
  } catch (error) {
    if (signal.aborted) {
      if (userSignal.aborted)
        throw new DOMException('Abgebrochen', 'AbortError');
      throw new Error(
        'Die Erkennung dauert zu lange. Dein Foto bleibt erhalten. Wähle die Ausgabe manuell oder fotografiere den unteren Rand deutlicher.',
        { cause: error },
      );
    }
    throw new Error(
      'Die lokale Texterkennung konnte nicht abgeschlossen werden. Nutze ein scharfes JPG/PNG oder wähle die Ausgabe manuell. Für den ersten Modellstart wird eine Verbindung benötigt.',
      { cause: error },
    );
  } finally {
    bitmap?.close();
    signal.removeEventListener('abort', abort);
    if (worker && !signal.aborted)
      await worker.terminate().catch(() => undefined);
  }
}
