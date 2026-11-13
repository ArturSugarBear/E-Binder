import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm';
import type { LiveHotZone } from '../domain/live-ocr-policy';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import runtimeUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import { decodeRecognition, recognitionTensor } from '../domain/vision-codec';
import {
  collectorNumberFallbackRegions,
  wideCollectorFooterRegion,
  hasPrintedCollectorFraction,
  hasPrintedSetCode,
} from '../domain/ocr-number-search';

const scope = self as unknown as {
  onmessage:
    | ((
        event: MessageEvent<{
          photo: Blob;
          numberOnly?: boolean;
          hotZone?: LiveHotZone;
          fast?: boolean;
          warmup?: boolean;
          language?: string;
          latinModelUrl?: string;
          latinDictionaryUrl?: string;
          japaneseModelUrl?: string;
          japaneseDictionaryUrl?: string;
          modelUrl: string;
          dictionaryUrl: string;
          id?: number;
        }>,
      ) => void)
    | null;
  postMessage: (value: unknown) => void;
  close: () => void;
};
const report = (status: string, id?: number) =>
  scope.postMessage({ type: 'progress', status, id });
const prepared = new Map<
  string,
  Promise<{ session: InferenceSession; dictionary: string[] }>
>();
async function modelResources(
  modelUrl: string,
  dictionaryUrl: string,
  id?: number,
) {
  if (!prepared.has(modelUrl)) {
    prepared.set(
      modelUrl,
      (async () => {
        report('Erkennungsmodell wird geladen …', id);
        env.wasm.numThreads = 1;
        env.wasm.proxy = false;
        env.wasm.wasmPaths = { wasm: wasmUrl, mjs: runtimeUrl };
        const [model, dictionaryText] = await Promise.all([
          resource(modelUrl).then((response) => response.arrayBuffer()),
          resource(dictionaryUrl).then((response) => response.text()),
        ]);
        const session = await InferenceSession.create(model, {
          executionProviders: ['wasm'],
        });
        const dictionary = [
          '',
          ...dictionaryText
            .replace(/\r\n/g, '\n')
            .replace(/\n$/, '')
            .split('\n'),
          ' ',
        ];
        // Loading a WASM session is not proof that iOS can execute it.
        // Run one small synthetic blank tensor and validate output shape,
        // dictionary compatibility and the actual inference path.
        const probe = new Tensor(
          'float32',
          new Float32Array(3 * 48 * 192).fill(1),
          [1, 3, 48, 192],
        );
        try {
          const outputs = await session.run({
            [session.inputNames[0]!]: probe,
          });
          try {
            const output = outputs[session.outputNames[0]!];
            if (!output || output.type !== 'float32')
              throw new Error('Lokales OCR-Modell liefert falsche Ausgaben.');
            decodeRecognition(
              output.data as Float32Array,
              output.dims,
              dictionary,
            );
          } finally {
            Object.values(outputs).forEach((tensor) => tensor.dispose());
          }
        } finally {
          probe.dispose();
        }
        return { session, dictionary };
      })().catch((error: unknown) => {
        prepared.delete(modelUrl);
        throw error;
      }),
    );
  }
  return prepared.get(modelUrl)!;
}

async function resource(url: string): Promise<Response> {
  const result = await fetch(url);
  if (!result.ok)
    throw new Error('Das lokale Erkennungsmodell konnte nicht geladen werden.');
  return result;
}
// A single worker can recognize a full binder page without loading ONNX nine times.
let queue = Promise.resolve();
scope.onmessage = (event) => {
  const data = event.data;
  if (data.warmup) {
    // The same worker and ONNX session are reused for subsequent photos.
    // A failed warmup must not prevent a later explicit OCR retry.
    queue = queue
      .then(async () => {
        await modelResources(data.modelUrl, data.dictionaryUrl);
        if (
          data.language === 'ja' &&
          data.latinModelUrl &&
          data.latinDictionaryUrl
        )
          await modelResources(data.latinModelUrl, data.latinDictionaryUrl);
        scope.postMessage({ type: 'ready' });
      })
      .catch(() => scope.postMessage({ type: 'warmup-error' }));
    return;
  }
  queue = queue
    .then(() => recognize(data))
    .catch(() => {
      scope.postMessage({
        type: 'error',
        id: data.id,
        message:
          'Die Erkennung konnte dieses Foto nicht zuverlässig lesen oder das Modell nicht laden. Wähle die Karte manuell oder fotografiere sie deutlicher.',
      });
    });
};
async function recognize({
  photo,
  numberOnly,
  hotZone,
  fast,
  modelUrl,
  dictionaryUrl,
  language,
  japaneseModelUrl,
  japaneseDictionaryUrl,
  latinModelUrl,
  latinDictionaryUrl,
  id,
}: {
  photo: Blob;
  numberOnly?: boolean;
  hotZone?: LiveHotZone;
  fast?: boolean;
  modelUrl: string;
  dictionaryUrl: string;
  language?: string;
  japaneseModelUrl?: string;
  japaneseDictionaryUrl?: string;
  latinModelUrl?: string;
  latinDictionaryUrl?: string;
  id?: number;
}): Promise<void> {
  if (typeof OffscreenCanvas === 'undefined')
    throw new Error('Bildverarbeitung im Hintergrund wird nicht unterstützt.');
  const [resources, bitmap] = await Promise.all([
    modelResources(modelUrl, dictionaryUrl, id),
    createImageBitmap(photo),
  ]);
  let { session, dictionary } = resources;
  try {
    const read = async (
      region: readonly [number, number, number, number],
      variant: 'colour' | 'gray' | 'inverted' | 'binary' = 'colour',
    ): Promise<string> => {
      const [x, y, w, h] = region;
      const height = 48;
      const width = Math.max(
        32,
        Math.min(
          1024,
          Math.round(((bitmap.width * w) / (bitmap.height * h)) * height),
        ),
      );
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Bild nicht lesbar.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(
        bitmap,
        bitmap.width * x,
        bitmap.height * y,
        bitmap.width * w,
        bitmap.height * h,
        0,
        0,
        width,
        height,
      );
      const pixels = context.getImageData(0, 0, width, height).data;
      if (variant !== 'colour')
        for (let i = 0; i < pixels.length; i += 4) {
          let value = Math.max(
            0,
            Math.min(
              255,
              ((pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) / 3 - 128) * 1.5 +
                128,
            ),
          );
          if (variant === 'inverted') value = 255 - value;
          if (variant === 'binary') value = value > 128 ? 255 : 0;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
        }
      const input = new Tensor(
        'float32',
        recognitionTensor(pixels, width, height),
        [1, 3, height, width],
      );
      try {
        const outputs = await session.run({ [session.inputNames[0]!]: input });
        const output = outputs[session.outputNames[0]!]!;
        const text = decodeRecognition(
          output.data as Float32Array,
          output.dims,
          dictionary,
        );
        Object.values(outputs).forEach((value) => value.dispose());
        return text;
      } finally {
        input.dispose();
      }
    };
    // Only re-read a region that was weak in the first pass. Avoid
    // repeating the same full-card OCR while the camera is still active.
    // Two extra hot-zone passes are permitted by the calling 5.6s budget.
    if (hotZone) {
      const retry: string[] = [];
      report(
        hotZone.startsWith('footer')
          ? 'Sammlernummer wird nochmals lokal geprüft …'
          : 'Vollständiger Kartenname wird nochmals geprüft …',
        id,
      );
      switch (hotZone) {
        case 'footer':
          retry.push(await read([0.025, 0.91, 0.7, 0.08], 'gray'));
          if (!hasPrintedCollectorFraction(retry) || !hasPrintedSetCode(retry))
            retry.push(await read(wideCollectorFooterRegion));
          break;
        case 'footer-contrast':
          retry.push(await read([0.04, 0.92, 0.83, 0.07], 'inverted'));
          if (!hasPrintedCollectorFraction(retry) || !hasPrintedSetCode(retry))
            retry.push(await read([0.01, 0.875, 0.96, 0.12], 'binary'));
          break;
        case 'title':
          retry.push(await read([0.03, 0.005, 0.93, 0.12], 'gray'));
          break;
        case 'title-wide':
          retry.push(await read([0.015, 0.01, 0.97, 0.18]));
          break;
      }
      scope.postMessage({ type: 'done', id, text: retry.join('\n') });
      return;
    }

    report('Set und Sammlernummer werden gelesen …', id);
    // Modern Japanese fractions sit immediately beside the SAR/AR rarity.
    // Keep those glyphs out of the numeric crop; never trim guessed digits.
    const number = await read(
      language === 'ja'
        ? [0.155, 0.95, 0.11, 0.024]
        : [0.155, 0.94, 0.13, 0.032],
    );
    let identifier: string;
    if (language === 'ja' && latinModelUrl && latinDictionaryUrl) {
      // Set codes remain Latin even on Japanese cards. Use the Latin-capable
      // model for that line instead of turning M1S into Japanese-looking glyphs.
      const titleResources = { session, dictionary };
      ({ session, dictionary } = await modelResources(
        latinModelUrl,
        latinDictionaryUrl,
        id,
      ));
      try {
        identifier = await read([0.07, 0.94, 0.38, 0.032]);
      } finally {
        ({ session, dictionary } = titleResources);
      }
    } else identifier = await read([0.07, 0.94, 0.38, 0.032]);
    const texts = [number, identifier];
    // The card number alone is shared by many sets. Re-read the wider footer
    // if the narrow crop missed PBL, DLR or another printed set code.
    if (!hasPrintedSetCode(texts)) {
      report('Gedrucktes Setkürzel wird gegengeprüft …', id);
      texts.push(await read([0.035, 0.905, 0.62, 0.075], 'gray'));
      // Japanese M1L/M1S/M2a codes are often left of the collector fraction.
      // Re-read this footer with normal contrast before falling back to the
      // ambiguous printed number alone.
      if (!hasPrintedSetCode(texts))
        texts.push(await read([0.02, 0.92, 0.64, 0.065]));
    }
    // The original OR condition repeated contrast OCR even after an initial hit.
    if (!hasPrintedCollectorFraction(texts)) {
      report('Nummernzeile im unteren Bildbereich wird gesucht …', id);
      // Two additional footer crops in live mode; the full review mode
      // retains the complete fallback ladder. No model score is invented.
      for (const region of fast
        ? collectorNumberFallbackRegions.slice(0, 2)
        : collectorNumberFallbackRegions) {
        texts.push(await read(region));
        if (hasPrintedCollectorFraction(texts)) break;
      }
    }
    if (!fast && !hasPrintedCollectorFraction(texts)) {
      report('Unterer Rand wird mit höherem Kontrast gegengeprüft …', id);
      for (const variant of ['gray', 'inverted', 'binary'] as const) {
        texts.push(await read([0.07, 0.94, 0.38, 0.032], variant));
        if (hasPrintedCollectorFraction(texts)) break;
      }
    }
    if (!fast && !hasPrintedCollectorFraction(texts)) {
      texts.push(await read([0.7, 0.9, 0.27, 0.045]));
    }
    if (numberOnly) {
      scope.postMessage({ type: 'done', id, text: texts.join('\n') });
      return;
    }
    // A printed Japanese set code selects a Japanese-capable title model,
    // even when the collector started with the default German catalogue.
    if (
      language !== 'ja' &&
      japaneseModelUrl &&
      japaneseDictionaryUrl &&
      texts.some((text) =>
        /(?:^|[^A-Z0-9])(?:SV|SM|XY|BW|S|M)\d{1,2}[A-Z]?(?=[^A-Z0-9]|$)/i.test(
          text,
        ),
      )
    ) {
      report('Japanischer Kartenname wird lokal geprüft …', id);
      ({ session, dictionary } = await modelResources(
        japaneseModelUrl,
        japaneseDictionaryUrl,
        id,
      ));
    }
    report('Kartenname wird gegengeprüft …', id);
    // Real sleeve photos often shift the title well outside the narrow
    // centre band. The second, wider top read is only needed for weak OCR.
    const title = await read(
      language === 'ja' ? [0.15, 0.018, 0.6, 0.062] : [0.08, 0.02, 0.83, 0.065],
    );
    texts.push(title);
    if (!/\p{L}{3}/u.test(title)) {
      texts.push(await read([0.05, 0.005, 0.9, 0.095], 'gray'));
    }
    scope.postMessage({ type: 'done', id, text: texts.join('\n') });
  } finally {
    bitmap.close();
  }
}
