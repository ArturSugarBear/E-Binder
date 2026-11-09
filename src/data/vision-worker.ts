import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import runtimeUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import { decodeRecognition, recognitionTensor } from '../domain/vision-codec';

const scope = self as unknown as {
  onmessage:
    | ((
        event: MessageEvent<{
          photo: Blob;
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
let prepared:
  | Promise<{ session: InferenceSession; dictionary: string[] }>
  | undefined;
async function modelResources(modelUrl: string, dictionaryUrl: string) {
  if (!prepared) {
    prepared = (async () => {
      report('Erkennungsmodell wird geladen …');
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
      return {
        session,
        dictionary: ['', ...dictionaryText.trimEnd().split('\n'), ' '],
      };
    })().catch((error: unknown) => {
      prepared = undefined;
      throw error;
    });
  }
  return prepared;
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
  queue = queue.then(() => recognize(data)).catch(() => {
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
  modelUrl,
  dictionaryUrl,
  id,
}: {
  photo: Blob;
  modelUrl: string;
  dictionaryUrl: string;
  id?: number;
}): Promise<void> {
  if (typeof OffscreenCanvas === 'undefined')
    throw new Error('Bildverarbeitung im Hintergrund wird nicht unterstützt.');
  const [{ session, dictionary }, bitmap] = await Promise.all([
    modelResources(modelUrl, dictionaryUrl),
    createImageBitmap(photo),
  ]);
  try {
    const read = async (
      region: [number, number, number, number],
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
    report('Set und Sammlernummer werden gelesen …', id);
    const number = await read([0.155, 0.94, 0.13, 0.032]);
    const identifier = await read([0.07, 0.94, 0.38, 0.032]);
    const texts = [number, identifier];
    const fraction = /\d{1,3}\s*\/\s*\d{1,3}/;
    if (!fraction.test(number) || !fraction.test(identifier)) {
      report('Unterer Rand wird mit höherem Kontrast gegengeprüft …', id);
      for (const variant of ['gray', 'inverted', 'binary'] as const) {
        texts.push(await read([0.155, 0.94, 0.13, 0.032], variant));
        texts.push(await read([0.07, 0.94, 0.38, 0.032], variant));
      }
      texts.push(await read([0.7, 0.9, 0.27, 0.045]));
    }
    report('Kartenname wird gegengeprüft …', id);
    texts.push(await read([0.18, 0.025, 0.56, 0.055]));
    scope.postMessage({ type: 'done', id, text: texts.join('\n') });
  } finally {
    bitmap.close();
  }
}
