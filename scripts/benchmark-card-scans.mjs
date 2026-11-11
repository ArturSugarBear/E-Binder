/**
 * Private, repeatable single-card recognition benchmark.
 * Images never enter this repo. The browser imports each from the local
 * filesystem, runs the app's real OCR/catalogue pipeline, then closes a
 * fresh isolated browser context without confirming any inventory.
 *
 * npm run build && npm run preview
 * CARD_SCAN_BENCHMARK_OUT=~/private/report.json \
 *   node scripts/benchmark-card-scans.mjs ~/private/card-ground-truth.json
 */
import { chromium } from '@playwright/test';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, basename } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  readRankedKeys,
  rankMatch,
  cardSummary,
} from './scan-benchmark-results.mjs';

const input = process.argv[2];
if (!input) {
  console.error(
    'Usage: node scripts/benchmark-card-scans.mjs <private-ground-truth.json>',
  );
  process.exitCode = 2;
} else {
  await benchmark(resolve(input));
}

async function benchmark(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (
    !Array.isArray(manifest.samples) ||
    !manifest.samples.length ||
    manifest.samples.length > 200
  )
    throw new Error('A manifest needs 1–200 local photo samples.');
  for (const [index, sample] of manifest.samples.entries()) {
    if (
      typeof sample.photo !== 'string' ||
      !sample.photo.trim() ||
      typeof sample.rights !== 'string' ||
      !sample.rights.trim() ||
      !(
        sample.expectedKey === null ||
        (typeof sample.expectedKey === 'string' &&
          sample.expectedKey.length > 3)
      ) ||
      (sample.conditions !== undefined &&
        (!Array.isArray(sample.conditions) ||
          sample.conditions.some((tag) => typeof tag !== 'string'))) ||
      (sample.language !== undefined &&
        !['de', 'en', 'ja'].includes(sample.language)) ||
      (sample.corners !== undefined &&
        (!Array.isArray(sample.corners) ||
          sample.corners.length !== 4 ||
          sample.corners.some(
            (point) =>
              !Array.isArray(point) ||
              point.length !== 2 ||
              point.some(
                (part) => !Number.isFinite(part) || part < 0 || part > 1,
              ),
          )))
    )
      throw new Error(`Invalid ground truth at photo #${index + 1}.`);
    const photoPath = resolve(dirname(manifestPath), sample.photo);
    if (
      !['.jpg', '.jpeg', '.png', '.webp'].includes(
        extname(photoPath).toLowerCase(),
      )
    )
      throw new Error('Benchmark photos must be JPG, PNG or WebP.');
    if ((await stat(photoPath)).size > 12_000_000)
      throw new Error("Single photo exceeds the app's 12 MB capture limit.");
  }
  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  const reports = [];
  try {
    for (const sample of manifest.samples) {
      const photoPath = resolve(dirname(manifestPath), sample.photo);
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      const start = performance.now();
      try {
        const url = new URL(
          process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173/E-Binder/',
        );
        url.hash = 'sammlung';
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
        await page.locator('#workspace-main[data-ready="true"]').waitFor();
        const readyAt = performance.now();
        const online = await page.evaluate(() => navigator.onLine);
        await page
          .getByRole('button', { name: 'Karten hinzufügen', exact: true })
          .click();
        const add = page.getByRole('dialog', {
          name: 'Karten hinzufügen',
          exact: true,
        });
        if (sample.language)
          await add.getByLabel('Katalogsprache').selectOption(sample.language);
        await add
          .locator('input[type=file][multiple]')
          .setInputFiles(photoPath);
        await add.locator('.w-photo-review img').waitFor();
        await add
          .getByRole('button', { name: 'Foto ausrichten und erkennen' })
          .click();
        const crop = page.getByRole('dialog', {
          name: 'Karte ausrichten',
          exact: true,
        });
        await crop.waitFor();
        if (sample.corners) {
          for (const [index, [x, y]] of sample.corners.entries()) {
            await crop.getByLabel('Ecke auswählen').selectOption(String(index));
            await crop
              .getByLabel('Position waagerecht')
              .fill(String(Math.round(x * 1000)));
            await crop
              .getByLabel('Position senkrecht')
              .fill(String(Math.round(y * 1000)));
          }
        }
        await crop.getByRole('button', { name: 'Ausschnitt prüfen' }).click();
        const alignedAt = performance.now();
        await crop
          .getByRole('button', { name: 'Texterkennung starten' })
          .click();
        await add
          .locator('.w-search-results[data-scan-state="complete"]')
          .waitFor({ timeout: 180_000 });
        const finishedAt = performance.now();
        const payload = await add.locator('.w-search-results').evaluate(
          (node) => ({
            version: node.dataset.scanResultContract,
            keys: node.dataset.scanRankedKeys,
          }),
        );
        const ranked = readRankedKeys(payload.version, payload.keys);
        const owned = await page.locator('.w-owned-grid button').count();
        if (owned !== 0)
          throw new Error(
            'Safety regression: recognition added inventory without confirmation.',
          );
        reports.push({
          photo: basename(photoPath),
          conditions: sample.conditions ?? [],
          rights: sample.rights,
          language: sample.language ?? 'de',
          expectedKey: sample.expectedKey,
          ...rankMatch(sample.expectedKey, ranked),
          resultStatus: ranked.length ? 'candidates' : 'no-candidates',
          rankedKeys: ranked,
          candidates: ranked.length,
          online,
          geometryMode: sample.corners ? 'corrected' : 'manual-default',
          phasesMs: {
            appLoad: Math.round(readyAt - start),
            captureAndAlignment: Math.round(alignedAt - readyAt),
            recognitionAndReview: Math.round(finishedAt - alignedAt),
          },
          durationMs: Math.round(performance.now() - start),
        });
      } catch (error) {
        reports.push({
          photo: basename(photoPath),
          conditions: sample.conditions ?? [],
          rights: sample.rights,
          expectedKey: sample.expectedKey,
          durationMs: Math.round(performance.now() - start),
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
  const summary = cardSummary(reports);
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
      geometry: 'manual-photo-alignment',
    },
    summary,
    reports,
  };
  if (process.env.CARD_SCAN_BENCHMARK_OUT)
    await writeFile(
      resolve(process.env.CARD_SCAN_BENCHMARK_OUT),
      JSON.stringify(result, null, 2),
    );
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors) process.exitCode = 1;
}
