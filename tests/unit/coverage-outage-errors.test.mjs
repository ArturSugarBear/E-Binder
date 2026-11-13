import { describe, expect, it } from 'vitest';
import { isStrictTransientCardCoverageOutage } from '../../scripts/coverage-outage-errors.mjs';

const makeIssue = (lang, setId, id, status = 503) => ({
  lang,
  setId,
  id,
  stage: 'critical-card',
  error:
    'Error: HTTP ' +
    status +
    ' https://api.tcgdex.net/v2/' +
    lang +
    '/cards/' +
    id,
});

const healthyOutage = () => ({
  mode: 'smoke',
  sets: [],
  totals: {
    primary: 0,
    'paired-english': 0,
    'secondary-index': 0,
    'verified-japanese': 0,
    missing: 0,
  },
  missing: [],
  issues: [
    makeIssue('ja', 'M1L', 'M1L-068'),
    makeIssue('en', '30th-c', '30th-c-004'),
    makeIssue('de', 'me01', 'me01-077'),
  ],
});

describe('strict release-only card coverage provider outage', () => {
  it('records the exact three 503 failures as unverified, not successful', () => {
    expect(isStrictTransientCardCoverageOutage(healthyOutage())).toBe(true);
  });

  it('rejects actual missing art or unsafe local manifest errors', () => {
    expect(
      isStrictTransientCardCoverageOutage({
        ...healthyOutage(),
        missing: [{ id: 'M1L-068' }],
      }),
    ).toBe(false);
    expect(
      isStrictTransientCardCoverageOutage({
        ...healthyOutage(),
        issues: [
          ...healthyOutage().issues,
          { stage: 'unsafe-or-unverified-art', setId: 'base1' },
        ],
      }),
    ).toBe(false);
  });

  it('rejects wrong identity, duplicates, 404 and unrelated domains', () => {
    for (const changes of [
      [makeIssue('ja', 'M1S', 'M1L-068')],
      [makeIssue('ja', 'M1L', 'M1L-068', 404)],
      [healthyOutage().issues[0], healthyOutage().issues[0]],
      [
        {
          ...healthyOutage().issues[0],
          error: 'Error: HTTP 503 https://evil.example/cards/M1L-068',
        },
      ],
    ]) {
      expect(
        isStrictTransientCardCoverageOutage({
          ...healthyOutage(),
          issues: [changes[0], ...healthyOutage().issues.slice(1)],
        }),
      ).toBe(false);
    }
  });

  it('rejects missing verification data', () => {
    expect(isStrictTransientCardCoverageOutage(null)).toBe(false);
    expect(
      isStrictTransientCardCoverageOutage({
        ...healthyOutage(),
        totals: { missing: 1 },
      }),
    ).toBe(false);
  });
});
