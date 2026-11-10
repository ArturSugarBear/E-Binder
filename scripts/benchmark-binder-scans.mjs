/**
 * Optional local, repeatable recognition benchmark. Photos are read directly
 * from disk into a local Chromium file picker; no images are committed/exported.
 *
 * Usage (after npm run build && npm run preview):
 *   node scripts/benchmark-binder-scans.mjs ~/private/binder-ground-truth.json
 */
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('Usage: node scripts/benchmark-binder-scans.mjs <local-manifest.json>');
  process.exitCode = 2;
} else {
  await run(manifestPath);
}

async function run(path) {
  const input = resolve(path);
  const manifest = JSON.parse(await readFile(input, 'utf8'));
  if (
    !Array.isArray(manifest.samples) ||
    !manifest.samples.length ||
    manifest.samples.length > 100
  )
    throw new Error('Expected 1–100 documented photo samples.');
  for (const sample of manifest.samples) {
    if (
      typeof sample.photo !== 'string' ||
      !Array.isArray(sample.slots) ||
      sample.slots.length !== 9 ||
      typeof sample.rights !== 'string' ||
      !sample.rights.trim()
    )
      throw new Error('Each sample needs photo, rights and exactly nine slots.');
    if (
      sample.corners &&
      (!Array.isArray(sample.corners) ||
        sample.corners.length !== 4 ||
        sample.corners.some(
          (p) =>
            !Array.isArray(p) ||
            p.length !== 2 ||
            p.some((v) => !Number.isFinite(v) || v < 0 || v > 1),
        ))
    )
      throw new Error('Corners must be four normalized [x,y] pairs.');
    if (
      sample.slots.some(
        (slot) => slot !== null && (typeof slot !== 'string' || !slot.length),
      )
    )
      throw new Error('Slots must be null or exact catalogue card keys.');
  }
  const browser = await chromium.launch({ headless: true });
  const reports = [];
  try {
    for (const sample of manifest.samples) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      const startedAt = performance.now();
      try {
        const url = new URL(
          process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173/E-Binder/',
        );
        url.hash = 'binder';
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
        await page.locator('#workspace-main[data-ready="true"]').waitFor();
        await page
          .getByRole('button', { name: 'Binderseite scannen', exact: true })
          .click();
        const dialog = page.getByRole('dialog', { name: 'Binderseiten scannen' });
        const photo = resolve(dirname(input), sample.photo);
        const extension = photo.slice(photo.lastIndexOf('.')).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension))
          throw new Error('Use a browser-supported JPG, PNG or WebP benchmark image.');
        await dialog.locator('input[type=file][multiple]').setInputFiles(photo);
        const crop = page.getByRole('dialog', { name: 'Binderseite ausrichten' });
        await crop.waitFor();
        if (sample.corners) {
          for (const [index, [x, y]] of sample.corners.entries()) {
            await crop.getByLabel('Ecke auswählen').selectOption(String(index));
            await crop.getByLabel('Position waagerecht').fill(
              String(Math.round(x * 1000)),
            );
            await crop.getByLabel('Position senkrecht').fill(
              String(Math.round(y * 1000)),
            );
          }
        }
        await crop.getByRole('button', { name: 'Ausschnitt prüfen' }).click();
        await crop.getByRole('button', { name: 'Neun Fächer auswerten' }).click();
        await dialog.locator('.w-page-scan-pocket').nth(8).waitFor({
          timeout: 30_000,
        });
        await dialog.getByRole('button', { name: 'Erkennung stoppen' }).waitFor({
          state: 'hidden',
          timeout: 900_000,
        });
        const pockets = await dialog.locator('.w-page-scan-pocket').evaluateAll(
          (nodes) =>
            nodes.map((node) => ({
              keys: Array.from(
                node.querySelectorAll('option[data-card-key]'),
                (option) => option.dataset.cardKey,
              ),
              warning: node.querySelector('.w-page-scan-quality')?.textContent,
              status: node.querySelector('small.w-muted')?.textContent,
            })),
        );
        const evaluated = pockets.map((pocket, index) => {
          const expected = sample.slots[index];
          return {
            position: index + 1,
            expected,
            top1: expected === null ? null : pocket.keys[0] === expected,
            top3:
              expected === null
                ? null
                : pocket.keys.slice(0, 3).includes(expected),
            candidates: pocket.keys.length,
            warnings: pocket.warning,
            status: pocket.status,
          };
        });
        reports.push({
          photo: basename(photo),
          rights: sample.rights,
          conditions: sample.conditions ?? [],
          durationMs: Math.round(performance.now() - startedAt),
          positions: evaluated,
        });
      } catch (error) {
        reports.push({
          photo: basename(sample.photo),
          rights: sample.rights,
          conditions: sample.conditions ?? [],
          durationMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const known = reports.flatMap((report) =>
    (report.positions ?? []).filter((position) => position.expected !== null),
  );
  const summary = {
    sampleCount: reports.length,
    completed: reports.filter((report) => !report.error).length,
    knownCards: known.length,
    top1Correct: known.filter((position) => position.top1).length,
    top3Correct: known.filter((position) => position.top3).length,
    // Null is intentional when the dataset has no ground-truth cards.
    top1Rate:
      known.length === 0
        ? null
        : known.filter((position) => position.top1).length / known.length,
    top3Rate:
      known.length === 0
        ? null
        : known.filter((position) => position.top3).length / known.length,
    // Empty pockets are not automatically classified by this scanner.
    emptyPocketAccuracy: null,
  };
  const result = { measuredAt: new Date().toISOString(), summary, reports };
  const outputPath = process.env.BINDER_BENCHMARK_OUT;
  if (outputPath) await writeFile(resolve(outputPath), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (reports.some((report) => report.error)) process.exitCode = 1;
}
