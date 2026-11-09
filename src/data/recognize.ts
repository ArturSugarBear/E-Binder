/** Local PP-OCRv4 model in a disposable worker. No photo upload. */
export function recognizePhoto(
  photo: Blob,
  signal: AbortSignal,
  progress: (status: string, fraction?: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./vision-worker.ts', import.meta.url), {
      type: 'module',
    });
    let finished = false;
    const stop = (error?: Error, text = '') => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(text);
    };
    const abort = () => stop(new DOMException('Abgebrochen', 'AbortError'));
    const timeout = setTimeout(
      () =>
        stop(
          new Error(
            'Die Erkennung dauert zu lange. Die Aufnahme bleibt bis zum Schließen geöffnet. Wähle die Ausgabe manuell oder starte die Erkennung erneut.',
          ),
        ),
      90000,
    );
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) => {
      event.preventDefault();
      stop(
        new Error(
          'Die lokale Erkennung konnte nicht gestartet werden. Die Aufnahme bleibt bis zum Schließen geöffnet; die manuelle Auswahl ist weiterhin verfügbar.',
        ),
      );
    };
    worker.onmessage = (
      event: MessageEvent<{
        type: string;
        status?: string;
        text?: string;
        message?: string;
      }>,
    ) => {
      if (finished) return;
      const message = event.data;
      if (message.type === 'progress')
        progress(message.status ?? 'Erkennung läuft …');
      else if (message.type === 'done') stop(undefined, message.text ?? '');
      else if (message.type === 'error')
        stop(
          new Error(message.message ?? 'Das Foto konnte nicht gelesen werden.'),
        );
    };
    if (signal.aborted) {
      abort();
      return;
    }
    progress('Lokale Erkennung wird vorbereitet …');
    worker.postMessage({
      photo,
      modelUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocrv4-rec.onnx`,
      dictionaryUrl: `${import.meta.env.BASE_URL}assets/ocr/ppocr-keys.txt`,
    });
  });
}
