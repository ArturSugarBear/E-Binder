#!/usr/bin/env node
/** Compare two independently reviewed, identical private card-photo benchmarks.
 * No photos or user IDs are copied into reports. This script NEVER trains a model.
 */
import { readFile } from 'node:fs/promises';

const [baselinePath, visualPath] = process.argv.slice(2);
if (!baselinePath || !visualPath)
  throw Error(
    'Usage: compare-beta-benchmarks.mjs <ocr-only.json> <ocr-plus-visual.json> [--gate]',
  );
const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [baseline, visual] = await Promise.all([
  read(baselinePath),
  read(visualPath),
]);

function manifest(report) {
  if (report.schemaVersion !== 2 || !Array.isArray(report.reports))
    throw Error('Invalid benchmark schema');
  const entries = report.reports.map((r) => {
    if (
      typeof r.photo !== 'string' ||
      !('expectedKey' in r) ||
      !['de', 'en', 'ja'].includes(r.language)
    )
      throw Error('Missing independent ground truth');
    return JSON.stringify([r.photo, r.expectedKey, r.language, r.conditions]);
  });
  if (entries.length !== new Set(report.reports.map((r) => r.photo)).size)
    throw Error('Duplicate photos in a benchmark');
  return entries;
}
const before = manifest(baseline);
const after = manifest(visual);
if (JSON.stringify(before) !== JSON.stringify(after))
  throw Error('Different test photos or expected identities: A/B invalid');

function measure(report) {
  const labelled = report.reports.filter((r) => r.expectedKey !== null);
  const negative = report.reports.filter((r) => r.expectedKey === null);
  return {
    images: report.reports.length,
    labelled: labelled.length,
    negative: negative.length,
    errors: report.reports.filter((r) => r.error).length,
    top1: labelled.filter((r) => r.top1).length,
    top5: labelled.filter((r) => r.top5).length,
    wrongAutomatic: report.reports.filter(
      (r) => r.automaticKey && r.automaticKey !== r.expectedKey,
    ).length,
    visualCandidates: report.reports.reduce(
      (sum, r) => sum + (Number(r.visualModelCandidates) || 0),
      0,
    ),
    p95Ms: report.summary?.p95RecognitionMs ?? null,
  };
}
const a = measure(baseline);
const b = measure(visual);
const eligible =
  a.labelled >= 100 &&
  a.negative >= 10 &&
  a.errors === 0 &&
  b.errors === 0 &&
  b.top1 >= a.top1 &&
  b.top5 >= a.top5 &&
  b.wrongAutomatic <= a.wrongAutomatic &&
  b.visualCandidates > 0 &&
  (a.p95Ms === null || b.p95Ms === null || b.p95Ms <= a.p95Ms * 1.35);
console.log(
  JSON.stringify(
    {
      result: eligible
        ? 'EVALUATION_ELIGIBLE_NOT_TRAINING_APPROVED'
        : 'INSUFFICIENT_OR_REGRESSED',
      sameReviewedPhotos: true,
      baseline: a,
      visual: b,
      deltaTop1: b.top1 - a.top1,
      deltaTop5: b.top5 - a.top5,
      deltaWrongAutomatic: b.wrongAutomatic - a.wrongAutomatic,
      note: 'Requires separate rights, human labels, hold-out, iPhone Safari and model approval.',
    },
    null,
    2,
  ),
);
if (process.argv.includes('--gate') && !eligible) process.exitCode = 1;
