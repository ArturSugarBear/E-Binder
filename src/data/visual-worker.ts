import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import runtimeUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import {
  searchVisualIndex,
  type VisualIndex,
  type VisualReference,
} from '../domain/visual-retrieval';

type Manifest = {
  format: 'e-binder-visual-v1';
  modelId: string;
  dimensions: number;
  size: number;
  preprocessing: 'rgb-0-1-chw-stretch';
  pooling: 'cls';
  modelFile: string;
  modelSha256: string;
  indexFile: string;
  indexSha256: string;
  referencesFile: string;
  count: number;
};

type MatchRequest = {
  id: number;
  photo: Blob;
  manifestUrl: string;
};
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<MatchRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};
const isFile = (name: unknown): name is string =>
  typeof name === 'string' &&
  /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) &&
  !name.startsWith('.') &&
  !name.includes('..');

const validSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

function parseManifest(value: unknown): Manifest {
  if (!value || typeof value !== 'object')
    throw new Error('Der visuelle Index ist ungültig.');
  const entry = value as Record<string, unknown>;
  if (
    entry.format !== 'e-binder-visual-v1' ||
    typeof entry.modelId !== 'string' ||
    !/^[a-zA-Z0-9_.-]{3,100}$/.test(entry.modelId) ||
    entry.preprocessing !== 'rgb-0-1-chw-stretch' ||
    entry.pooling !== 'cls' ||
    entry.size !== 224 ||
    !Number.isInteger(entry.dimensions) ||
    Number(entry.dimensions) < 64 ||
    Number(entry.dimensions) > 2048 ||
    !Number.isInteger(entry.count) ||
    Number(entry.count) < 1 ||
    Number(entry.count) > 200000 ||
    !isFile(entry.modelFile) ||
    !isFile(entry.indexFile) ||
    !isFile(entry.referencesFile) ||
    !validSha(entry.modelSha256) ||
    !validSha(entry.indexSha256)
  )
    throw new Error('Bildmodell und Indexmanifest sind nicht kompatibel.');
  return entry as Manifest;
}

async function localResource(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Bildsuchdatei nicht vorhanden.');
  return response.arrayBuffer();
}

async function checkedResource(url: string, checksum: string): Promise<ArrayBuffer> {
  const bytes = await localResource(url);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  if (hash !== checksum)
    throw new Error('Prüfsumme des Bildmodells oder Kartenindex stimmt nicht.');
  return bytes;
}

function parseReferences(input: unknown, expected: number): VisualReference[] {
  if (!Array.isArray(input) || input.length !== expected)
    throw new Error('Unvollständiger Bildkatalog.');
  return input.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object')
      throw new Error('Ungültige Bildkatalogkarte.');
    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      !/^[A-Za-z0-9_.:+-]{3,200}$/.test(item.id) ||
      !['de', 'en', 'ja'].includes(String(item.language)) ||
      typeof item.setId !== 'string' ||
      !/^[A-Za-z0-9_.+-]{1,100}$/.test(item.setId) ||
      typeof item.number !== 'string' ||
      !/^[A-Za-z0-9 /-]{1,40}$/.test(item.number)
    )
      throw new Error('Ungültige Kartenausgabe im Bildkatalog.');
    return {
      id: item.id,
      language: item.language as VisualReference['language'],
      setId: item.setId,
      number: item.number,
    };
  });
}

let cached:
  | Promise<{ session: InferenceSession; index: VisualIndex; size: number }>
  | undefined;

function load(manifestUrl: string) {
  if (!cached)
    cached = (async () => {
      const url = new URL(manifestUrl, location.href);
      if (
        url.origin !== location.origin ||
        !url.pathname.endsWith('/assets/vision/manifest.json')
      )
        throw new Error('Externes Bildmodell ist nicht zugelassen.');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Visuelle Suche ist nicht installiert.');
      const manifest = parseManifest(await response.json());
      const file = (name: string) => new URL(name, url).href;
      env.wasm.numThreads = 1;
      env.wasm.proxy = false;
      env.wasm.wasmPaths = { wasm: wasmUrl, mjs: runtimeUrl };
      const [modelBytes, indexBytes, referenceBytes] = await Promise.all([
        checkedResource(file(manifest.modelFile), manifest.modelSha256),
        checkedResource(file(manifest.indexFile), manifest.indexSha256),
        localResource(file(manifest.referencesFile)),
      ]);
      const references = parseReferences(
        JSON.parse(new TextDecoder().decode(referenceBytes)) as unknown,
        manifest.count,
      );
      if (indexBytes.byteLength !== manifest.count * manifest.dimensions)
        throw new Error('Bildindex hat unerwartete Länge.');
      const session = await InferenceSession.create(modelBytes, {
        executionProviders: ['wasm'],
      });
      const index: VisualIndex = {
        modelId: manifest.modelId,
        dimensions: manifest.dimensions,
        references,
        vectors: new Int8Array(indexBytes),
      };
      return { session, index, size: manifest.size };
    })().catch((error: unknown) => {
      cached = undefined;
      throw error;
    });
  return cached;
}

async function match({ id, photo, manifestUrl }: MatchRequest): Promise<void> {
  const { session, index, size } = await load(manifestUrl);
  if (typeof OffscreenCanvas === 'undefined')
    throw new Error('Bildverarbeitung im Worker nicht verfügbar.');
  const bitmap = await createImageBitmap(photo);
  let tensor: Tensor | undefined;
  try {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Kartenbild konnte nicht skaliert werden.');
    context.drawImage(bitmap, 0, 0, size, size);
    const rgba = context.getImageData(0, 0, size, size).data;
    const plane = size * size;
    const values = new Float32Array(plane * 3);
    for (let i = 0; i < plane; i++) {
      values[i] = rgba[i * 4]! / 255;
      values[i + plane] = rgba[i * 4 + 1]! / 255;
      values[i + plane * 2] = rgba[i * 4 + 2]! / 255;
    }
    tensor = new Tensor('float32', values, [1, 3, size, size]);
    const outputs = await session.run({ [session.inputNames[0]!]: tensor });
    try {
      const embedding = outputs[session.outputNames[0]!];
      if (
        !embedding ||
        embedding.type !== 'float32' ||
        embedding.dims.at(-1) !== index.dimensions
      )
        throw new Error('Bildmodell liefert inkompatible Embeddings.');
      const data = embedding.data as Float32Array;
      // CLS token: token zero of [1, tokens, dimensions] or [1, dimensions].
      const query = { modelId: index.modelId, values: data.slice(0, index.dimensions) };
      scope.postMessage({ id, type: 'done', hits: searchVisualIndex(query, index, 5) });
    } finally {
      for (const output of Object.values(outputs)) output.dispose();
    }
  } finally {
    tensor?.dispose();
    bitmap.close();
  }
}

let sequence = Promise.resolve();
scope.onmessage = (event) => {
  const request = event.data;
  sequence = sequence.then(() => match(request)).catch((error: unknown) => {
    scope.postMessage({
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : 'Bildsuche fehlgeschlagen.',
    });
  });
};
