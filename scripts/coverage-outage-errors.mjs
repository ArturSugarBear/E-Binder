/**
 * The three required smoke lookups may all be unavailable during a proven
 * TCGdex outage. This is NOT successful artwork verification. A release
 * wrapper can record an explicit unverified state only when every problem is
 * one of these exact transient source requests and local index checks passed.
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
    const url =
      'https://api.tcgdex.net/v2/' + expected.lang + '/cards/' + expected.id;
    return (
      typeof issue.error === 'string' &&
      new RegExp(
        '^Error: HTTP (?:429|5[0-9]{2}) ' + url.replace(/\./g, '\\.') + '
    );
  });
}
,
      ).test(issue.error)
    );
  });
}
