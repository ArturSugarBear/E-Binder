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
import { performance } from 'node:perf_hooks';
import {
  readRankedKeys,
  rankMatch,
  rate,
  percentile,
} from './scan-benchmark-results.mjs';

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error(
    'Usage: node scripts/benchmark-binder-scans.mjs <local-manifest.json>',
  );
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
      !sample.rights.trim() ||
      (sample.geometryMode !== undefined &&
        !['automatic', 'manual'].includes(sample.geometryMode)) ||
      (sample.geometryMode === 'manual' && !sample.corners)
    )
      throw new Error(
        'Each sample needs photo, rights and exactly nine slots.',
      );
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
  const browserVersion = browser.version();
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
        const readyAt = performance.now();
        const online = await page.evaluate(() => navigator.onLine);
        await page
          .getByRole('button', { name: 'Binderseite scannen', exact: true })
          .click();
        const dialog = page.getByRole('dialog', {
          name: 'Binderseiten scannen',
        });
        const photo = resolve(dirname(input), sample.photo);
        const extension = photo.slice(photo.lastIndexOf('.')).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension))
          throw new Error(
            'Use a browser-supported JPG, PNG or WebP benchmark image.',
          );
        await dialog.locator('input[type=file][multiple]').setInputFiles(photo);
        const grid = dialog.locator('.w-page-scan-grid');
        // The app auto-aligns immediately. A crop dialog is not the default.
        await grid.locator('.w-page-scan-pocket').nth(8).waitFor({
          timeout: 90_000,
        });
        await grid.locator('[data-recognition-state]').first().waitFor();
        await grid.waitFor({ state: 'visible' });
        await dialog
          .locator('.w-page-scan-grid[data-scan-state="complete"]')
          .waitFor({ timeout: 900_000 });
        const automaticCompletedAt = performance.now();
        const geometryMode =
          sample.geometryMode ?? (sample.corners ? 'manual' : 'automatic');
        if (geometryMode === 'manual') {
          await dialog
            .getByRole('button', { name: 'Zuschnitt korrigieren' })
            .click();
          const crop = page.getByRole('dialog', {
            name: 'Binderseite ausrichten',
          });
          await crop.waitFor();
          for (const [index, [x, y]] of sample.corners.entries()) {
            await crop.getByLabel('Ecke auswählen').selectOption(String(index));
            await crop
              .getByLabel('Position waagerecht')
              .fill(String(Math.round(x * 1000)));
            await crop
              .getByLabel('Position senkrecht')
              .fill(String(Math.round(y * 1000)));
          }
          await crop.getByRole('button', { name: 'Ausschnitt prüfen' }).click();
          await crop
            .getByRole('button', { name: 'Neun Fächer auswerten' })
            .click();
          await dialog
            .locator('.w-page-scan-grid[data-scan-adjustment="manual"][data-scan-state="complete"]')
            .waitFor({ timeout: 900_000 });
        }
        const finishedAt = performance.now();
        const payload = await grid.evaluate((node) => ({
          version: node.dataset.scanResultContract,
          geometryMethod: node.dataset.scanGeometry,
          adjustment: node.dataset.scanAdjustment,
          pockets: Array.from(
            node.querySelectorAll('.w-page-scan-pocket'),
            (pocket) => ({
              keys: pocket.dataset.scanRankedKeys,
              decision: pocket.dataset.decision,
              recognitionState: pocket.dataset.recognitionState,
              warning: pocket.querySelector('.w-page-scan-quality')?.textContent,
              status: pocket.querySelector('small.w-muted')?.textContent,
            }),
          ),
        }));
        if (payload.pockets.length !== 9)
          throw new Error('Benchmark expected exactly nine physical pockets.');
        if (payload.adjustment !== geometryMode)
          throw new Error('Benchmark geometry mode did not match the run.');
        const evaluated = payload.pockets.map((pocket, index) => {
          const keys = readRankedKeys(payload.version, pocket.keys);
          const expected = sample.slots[index];
          return {
            position: index + 1,
            expected,
            ...rankMatch(expected, keys),
            candidates: keys.length,
            rankedKeys: keys,
            decision: pocket.decision,
            recognitionState: pocket.recognitionState,
            falseEmptySuggestion:
              expected !== null &&
              pocket.recognitionState === 'empty-suggested',
            warnings: pocket.warning,
            status: pocket.status,
          };
        });
        // No imported ownership: the benchmark must never press the save action.
        await page.keyboard.press('Escape');
        await page.goto(new URL('#sammlung', url).toString());
        await page.locator('#workspace-main[data-ready="true"]').waitFor();
        const owned = await page.locator('.w-owned-grid button').count();
        if (owned !== 0)
          throw new Error(
            'Safety regression: binder scan added inventory without confirmation.',
          );
        reports.push({
          photo: basename(photo),
          rights: sample.rights,
          conditions: sample.conditions ?? [],
          geometryMode: sample.geometryMode ??
            (sample.corners ? 'manual' : 'automatic'),
          geometryMethod: payload.geometryMethod,
          online,
          phasesMs: {
            appLoad: Math.round(readyAt - startedAt),
            automaticAlignmentAndRecognition: Math.round(
              automaticCompletedAt - readyAt,
            ),
            manualCorrectionAndRecognition:
              geometryMode === 'manual'
                ? Math.round(finishedAt - automaticCompletedAt)
                : null,
          },
          durationMs: Math.round(performance.now() - startedAt),
          resultStatus: 'complete',
          positions: evaluated,
        });
      } catch (error) {
        reports.push({
          photo: basename(sample.photo),
          rights: sample.rights,
          conditions: sample.conditions ?? [],
          durationMs: Math.round(performance.now() - startedAt),
          resultStatus: 'technical-error',
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const positions = reports.flatMap((report) => report.positions ?? []);
  const known = positions.filter((position) => position.expected !== null);
  const totalKnown = manifest.samples.reduce(
    (sum, sample) => sum + sample.slots.filter((slot) => slot !== null).length,
    0,
  );
  const count = (key) => known.filter((position) => position[key]).length;
  const summary = {
    sampleCount: reports.length,
    completed: reports.filter((report) => !report.error).length,
    errors: reports.filter((report) => report.error).length,
    knownCards: totalKnown,
    knownEvaluated: known.length,
    top1Correct: count('top1'),
    top3Correct: count('top3'),
    top5Correct: count('top5'),
    top1Rate: rate(count('top1'), totalKnown),
    top3Rate: rate(count('top3'), totalKnown),
    top5Rate: rate(count('top5'), totalKnown),
    falseEmptySuggestions: known.filter((p) => p.falseEmptySuggestion).length,
    emptySlots: manifest.samples.reduce(
      (sum, sample) => sum + sample.slots.filter((slot) => slot === null).length,
      0,
    ),
    p50DurationMs: percentile(
      reports.filter((r) => !r.error).map((r) => r.durationMs),
      0.5,
    ),
    p95DurationMs: percentile(
      reports.filter((r) => !r.error).map((r) => r.durationMs),
      0.95,
    ),
    // Occupancy detection has not yet been validated as a reliable classifier.
    emptyPocketAccuracy: null,
  };
  const result = {
    schemaVersion: 2,
    measuredAt: new Date().toISOString(),
    provenance: {
      commit: process.env.GIT_COMMIT_SHA ?? null,
      modelVersion: null,
      indexVersion: null,
      browser: 'chromium',
      browserVersion,
      viewport: '390x844',
      serviceWorkers: 'blocked',
      recognition: 'real-worker-no-stubs',
    },
    summary,
    reports,
  };
  const outputPath = process.env.BINDER_BENCHMARK_OUT;
  if (outputPath)
    await writeFile(resolve(outputPath), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (reports.some((report) => report.error)) process.exitCode = 1;
}
