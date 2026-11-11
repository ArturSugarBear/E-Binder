/**
 * Versioned, presentation-independent read-only scanner benchmark contract.
 * No image data, account information or confirmed inventory is exposed.
 */
export function readRankedKeys(contract, encodedKeys) {
  if (contract !== '1')
    throw new Error('Scanner benchmark contract missing or unsupported.');
  let parsed;
  try {
    parsed = JSON.parse(encodedKeys ?? '');
  } catch {
    throw new Error('Scanner benchmark candidate payload is not valid JSON.');
  }
  if (
    !Array.isArray(parsed) ||
    parsed.some((key) => typeof key !== 'string' || !key.length) ||
    new Set(parsed).size !== parsed.length
  )
    throw new Error('Scanner benchmark candidate ranking is invalid.');
  return parsed;
}

export function rankMatch(expectedKey, ranked) {
  if (expectedKey === null)
    return {
      top1: null,
      top3: null,
      top5: null,
      unexpectedSuggestions: ranked.length,
    };
  return {
    top1: ranked[0] === expectedKey,
    top3: ranked.slice(0, 3).includes(expectedKey),
    top5: ranked.slice(0, 5).includes(expectedKey),
    unexpectedSuggestions: null,
  };
}

export function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

export function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil((sorted.length - 1) * fraction)]);
}

export function cardSummary(reports) {
  const known = reports.filter((report) => report.expectedKey !== null);
  const evaluated = known.filter((report) => !report.error);
  const completed = reports.filter((report) => !report.error);
  const count = (entries, key) => entries.filter((entry) => entry[key]).length;
  const rates = (entries) => ({
    total: entries.length,
    evaluated: entries.filter((entry) => !entry.error).length,
    top1Correct: count(entries, 'top1'),
    top3Correct: count(entries, 'top3'),
    top5Correct: count(entries, 'top5'),
    top1Rate: rate(count(entries, 'top1'), entries.length),
    top3Rate: rate(count(entries, 'top3'), entries.length),
    top5Rate: rate(count(entries, 'top5'), entries.length),
  });
  const negative = reports.filter((report) => report.expectedKey === null);
  const byCondition = Object.fromEntries(
    [...new Set(reports.flatMap((report) => report.conditions))].map(
      (condition) => [
        condition,
        rates(known.filter((report) => report.conditions.includes(condition))),
      ],
    ),
  );
  return {
    samples: reports.length,
    completed: completed.length,
    errors: reports.length - completed.length,
    ...rates(known),
    evaluatedTop3Rate: rate(count(evaluated, 'top3'), evaluated.length),
    negativeSamples: negative.length,
    negativeSamplesEvaluated: negative.filter((r) => !r.error).length,
    negativeSamplesWithSuggestions: negative.filter(
      (r) => !r.error && r.unexpectedSuggestions > 0,
    ).length,
    noCandidates: completed.filter((r) => r.resultStatus === 'no-candidates')
      .length,
    p50DurationMs: percentile(completed.map((r) => r.durationMs), 0.5),
    p95DurationMs: percentile(completed.map((r) => r.durationMs), 0.95),
    byCondition,
  };
}
