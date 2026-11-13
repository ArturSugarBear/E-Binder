/**
 * Privately propose four corners on consented E-Binder review photos.
 * Never auto-approve a model label or transmit images to external APIs.
 *
 * node --import tsx scripts/propose-card-corners.mjs /private/review/review.json
 */
import { chromium } from '@playwright/test';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { detectCardCorners } from '../src/domain/card-outline.ts';

const input = process.argv[2];
if (!input) throw new Error('Provide a private decrypted review.json file.');
const manifestPath = resolve(input);
const directory = dirname(manifestPath);
const relativeToRepo = relative(process.cwd(), directory);
if (!relativeToRepo.startsWith('..'))
  throw new Error('Review photos must remain outside the repository.');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (
  manifest.purpose !== 'independent-review-required-not-training' ||
  !Array.isArray(manifest.samples) ||
  manifest.samples.length < 1 ||
  manifest.samples.length > 200
)
  throw new Error('Not a verified private review manifest.');
const previewDirectory = join(directory, 'corner-previews');
await mkdir(previewDirectory, { recursive: true, mode: 0o700 });

const browser = await chromium.launch({ headless: true });
const proposals = [];
try {
  const page = await browser.newPage();
  for (const [index, sample] of manifest.samples.entries()) {
    if (
      !sample ||
      !/^[0-9a-f-]{36}$/.test(sample.id) ||
      typeof sample.photo !== 'string' ||
      !/^sample-\d+\.jpg$/.test(sample.photo) ||
      sample.consentVersion !== '2026-11-photo-v1'
    )
      throw new Error('Invalid private review sample.');
    const path = resolve(directory, sample.photo);
    if (relative(directory, path).startsWith('..'))
      throw new Error('A private photo path escapes the review directory.');
    const file = await stat(path);
    if (!file.isFile() || file.size > 1500000)
      throw new Error('Private review image is unavailable or too large.');
    const base64 = (await readFile(path)).toString('base64');
    const frame = await page.evaluate(async (image) => {
      const data = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(
        new Blob([data], { type: 'image/jpeg' }),
      );
      try {
        const ratio = 192 / 256;
        const wide = bitmap.width / bitmap.height > ratio;
        const crop = wide
          ? {
              x: (bitmap.width - bitmap.height * ratio) / 2,
              y: 0,
              width: bitmap.height * ratio,
              height: bitmap.height,
            }
          : {
              x: 0,
              y: (bitmap.height - bitmap.width / ratio) / 2,
              width: bitmap.width,
              height: bitmap.width / ratio,
            };
        const canvas = document.createElement('canvas');
        canvas.width = 192;
        canvas.height = 256;
        const context = canvas.getContext('2d', {
          willReadFrequently: true,
        });
        if (!context) throw new Error('Private image decoder unavailable');
        context.drawImage(
          bitmap,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          192,
          256,
        );
        return {
          rgba: Array.from(context.getImageData(0, 0, 192, 256).data),
          crop,
          fullWidth: bitmap.width,
          fullHeight: bitmap.height,
        };
      } finally {
        bitmap.close();
      }
    }, base64);
    const detection = detectCardCorners(
      new Uint8ClampedArray(frame.rgba),
      192,
      256,
    );
    const corners = detection.corners?.map((point) => [
      (frame.crop.x + frame.crop.width * point.x) / frame.fullWidth,
      (frame.crop.y + frame.crop.height * point.y) / frame.fullHeight,
    ]) ?? null;
    const preview = await page.evaluate(
      async ({ image, corners }) => {
        const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: 'image/jpeg' }),
        );
        try {
          const canvas = document.createElement('canvas');
          const scale = Math.min(
            1,
            960 / Math.max(bitmap.width, bitmap.height),
          );
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Preview canvas unavailable');
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          if (corners) {
            context.beginPath();
            corners.forEach(([x, y], i) => {
              const px = x * canvas.width;
              const py = y * canvas.height;
              if (i === 0) context.moveTo(px, py);
              else context.lineTo(px, py);
            });
            context.closePath();
            context.lineWidth = 4;
            context.strokeStyle = '#d8f25a';
            context.stroke();
          }
          return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        } finally {
          bitmap.close();
        }
      },
      { image: base64, corners },
    );
    const previewName = 'corner-previews/sample-' + (index + 1) + '.jpg';
    await writeFile(
      join(directory, previewName),
      Buffer.from(preview, 'base64'),
      { mode: 0o600 },
    );
    proposals.push({
      id: sample.id,
      photo: sample.photo,
      proposedCorners: corners,
      proposalStrategy: detection.strategy,
      preview: previewName,
      reviewState: 'unverified',
    });
  }
} finally {
  await browser.close();
}
await writeFile(
  join(directory, 'corner-proposals.json'),
  JSON.stringify(
    {
      kind: 'private-geometry-proposals-not-ground-truth',
      generatedAt: new Date().toISOString(),
      notes:
        'Each polygon is an unverified model proposal. A human must check every corner in the original photo.',
      samples: proposals,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  'Created ' +
    proposals.length +
    ' private preview images and unverified corner proposals; no data were uploaded.',
);
