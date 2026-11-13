/**
 * Local-only A/B corner benchmark. Use independently verified private photos.
 * No images, filenames or account data are written to the result report.
 *
 * CORNER_BENCHMARK_OUT=/private/result.json \
 *   node --import tsx scripts/benchmark-card-corners.mjs /private/corners.json
 */
import { chromium } from '@playwright/test';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { detectCardCorners } from '../src/domain/card-outline.ts';

const manifestFile = process.argv[2];
if (!manifestFile) {
  throw new Error('Provide a private corner ground-truth JSON manifest.');
}

const manifestPath = resolve(manifestFile);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (
  !Array.isArray(manifest.samples) ||
  !manifest.samples.length ||
  manifest.samples.length > 500
)
  throw new Error('Expected 1–500 independently verified samples.');

function validCorners(corners) {
  return (
    corners === null ||
    (Array.isArray(corners) &&
      corners.length === 4 &&
      corners.every(
        (point) =>
          Array.isArray(point) &&
          point.length === 2 &&
          point.every(
            (value) => Number.isFinite(value) && value >= 0 && value <= 1,
          ),
      ))
  );
}
const paths = [];
for (const [index, sample] of manifest.samples.entries()) {
  if (
    !sample ||
    !Object.hasOwn(sample, 'corners') ||
    !validCorners(sample.corners) ||
    sample.verification?.independent !== true ||
    typeof sample.verification?.evidence !== 'string' ||
    !sample.verification.evidence.trim() ||
    typeof sample.rights !== 'string' ||
    !sample.rights.trim() ||
    typeof sample.physicalCardGroup !== 'string' ||
    !sample.physicalCardGroup.trim() ||
    typeof sample.sessionGroup !== 'string' ||
    !sample.sessionGroup.trim() ||
    typeof sample.photo !== 'string' ||
    !sample.photo.trim()
  )
    throw new Error('Invalid independent ground truth at index ' + index);
  const path = resolve(dirname(manifestPath), sample.photo);
  const ext = extname(path).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext))
    throw new Error('Unsupported private photo format.');
  const file = await stat(path);
  if (!file.isFile() || file.size > 12_000_000)
    throw new Error('Private photo exceeds the allowed size.');
  paths.push({ path, mime: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg' });
}
const output = process.env.CORNER_BENCHMARK_OUT;
if (output) {
  const rel = relative(process.cwd(), resolve(output));
  if (!rel.startsWith('..'))
    throw new Error('Private benchmark output must be outside the repository.');
}
const results = { baseline: [], improved: [] };
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const [index, sample] of manifest.samples.entries()) {
    const file = paths[index];
    const bytes = (await readFile(file.path)).toString('base64');
    const capture = await page.evaluate(
      async ({ base64, mime }) => {
        const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([buffer], { type: mime }));
        try {
          const ratio = 192 / 256;
          const wide = bitmap.width / bitmap.height > ratio;
          const crop = wide
            ? { x: (bitmap.width - bitmap.height * ratio) / 2, y: 0, width: bitmap.height * ratio, height: bitmap.height }
            : { x: 0, y: (bitmap.height - bitmap.width / ratio) / 2, width: bitmap.width, height: bitmap.width / ratio };
          const canvas = document.createElement('canvas');
          canvas.width = 192;
          canvas.height = 256;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Canvas unavailable');
          ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, 192, 256);
          return {
            rgba: Array.from(ctx.getImageData(0, 0, 192, 256).data),
            crop,
            fullWidth: bitmap.width,
            fullHeight: bitmap.height,
          };
        } finally {
          bitmap.close();
        }
      },
      { base64: bytes, mime: file.mime },
    );
    const rgba = new Uint8ClampedArray(capture.rgba);
    const expected = sample.corners?.map(([x, y]) => ({
      x: (x * capture.fullWidth - capture.crop.x) / capture.crop.width,
      y: (y * capture.fullHeight - capture.crop.y) / capture.crop.height,
    }));
    for (const [name, soft] of [['baseline', false], ['improved', true]]) {
      const start = performance.now();
      const prediction = detectCardCorners(rgba, 192, 256, soft);
      const durationMs = performance.now() - start;
      const error = prediction.corners && expected
        ? Math.max(
            ...prediction.corners.map((point, i) =>
              Math.hypot(point.x - expected[i].x, point.y - expected[i].y),
            ),
          )
        : null;
      results[name].push({
        positive: Boolean(expected),
        detected: prediction.corners !== null,
        correct: error !== null && error <= 0.065,
        durationMs,
      });
    }
  }
} finally {
  await browser.close();
}
function summary(rows) {
  const positive = rows.filter((r) => r.positive);
  const negative = rows.filter((r) => !r.positive);
  const times = rows.map((r) => r.durationMs).sort((a, b) => a - b);
  const detected = positive.filter((r) => r.detected).length;
  const accurate = positive.filter((r) => r.correct).length;
  const falsePositives = negative.filter((r) => r.detected).length;
  return {
    photos: rows.length,
    positives: positive.length,
    negatives: negative.length,
    detected,
    accurate,
    falsePositives,
    recall: positive.length ? detected / positive.length : null,
    accurateRate: positive.length ? accurate / positive.length : null,
    falsePositiveRate: negative.length ? falsePositives / negative.length : null,
    p95Ms: times[Math.ceil(times.length * 0.95) - 1] ?? null,
  };
}
const baseline = summary(results.baseline);
const improved = summary(results.improved);
const enough =
  baseline.positives >= 100 &&
  baseline.negatives >= 10 &&
  new Set(manifest.samples.map((s) => s.physicalCardGroup)).size >= 100 &&
  new Set(manifest.samples.map((s) => s.sessionGroup)).size >= 3;
const report = {
  schemaVersion: 1,
  samples: manifest.samples.length,
  independentlyVerified: true,
  baseline,
  improved,
  releaseGate: enough &&
    improved.accurate >= baseline.accurate &&
    improved.falsePositives <= baseline.falsePositives,
  warning: enough ? null : 'Exploratory only: insufficient independently verified holdout.',
};
if (output)
  await writeFile(resolve(output), JSON.stringify(report, null, 2), {
    mode: 0o600,
  });
console.log(JSON.stringify(report, null, 2));
