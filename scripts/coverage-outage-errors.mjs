/**
 * The three required live-provider smoke checks can be inconclusive while
 * TCGdex is down. This function never claims an artwork check succeeded:
 * only the exact critical-card HTTP 429/5xx errors may be reclassified as
 * unverified after the independent cached-index integrity gate passed.
 */
const required = [
  { lang: 'ja', setId: 'M1L', id: 'M1L-068' },
  { lang: 'en', setId: '30th-c', id: '30th-c-004' },
  { lang: 'de', setId: 'me01', id: 'me01-077' },
];

export function isStrictTransientCardCoverageOutage(report) {
  if (
    !report ||
    report.mode !== 'smoke' ||
    !Array.isArray(report.sets) ||
    report.sets.length !== 0 ||
    !Array.isArray(report.missing) ||
    report.missing.length !== 0 ||
    !report.totals ||
    Object.values(report.totals).some((value) => value !== 0) ||
    !Array.isArray(report.issues) ||
    report.issues.length !== required.length
  )
    return false;

  const accounted = new Set();
  return report.issues.every((issue) => {
    const expected = required.find(
      (item) =>
        item.lang === issue.lang &&
        item.setId === issue.setId &&
        item.id === issue.id,
    );
    if (!expected || issue.stage !== 'critical-card') return false;
    const identity = expected.lang + ':' + expected.id;
    if (accounted.has(identity)) return false;
    accounted.add(identity);
    const expectedUrl =
      'https://api.tcgdex.net/v2/' + expected.lang + '/cards/' + expected.id;
    const failure =
      typeof issue.error === 'string'
        ? /^Error: HTTP (429|5[0-9]{2}) (.+)$/.exec(issue.error)
        : null;
    return Boolean(failure && failure[2] === expectedUrl);
  });
}
