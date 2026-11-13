import { describe, expect, it } from 'vitest';
import {
  isTransientArtworkUpstreamFailure,
  isTransientArtworkBootstrapFailure,
  isTransientClassicCollectionDependency,
} from '../../scripts/artwork-upstream-errors.mjs';

describe('release artwork transient upstream classification', () => {
  it.each([
    'Set metadata unavailable (en:2024sv): Error: 503: https://api.tcgdex.net/v2/en/sets/2024sv',
    'Set metadata unavailable (de:sv08.5): Error: 429: https://api.tcgdex.net/v2/de/sets/sv08.5',
    'Promo artwork audit failed: Error: 503: https://api.tcgdex.net/v2/en/cards/mep-028',
    'Promo artwork audit failed: Error: 502: https://api.tcgdex.net/v2/en/cards/mep-099',
  ])(
    'allows only genuine transient TCGdex metadata failures: %s',
    (message) => {
      expect(isTransientArtworkUpstreamFailure(message)).toBe(true);
    },
  );

  it.each([
    'Set metadata unavailable (en:base1): Error: 503: https://api.tcgdex.net/v2/de/sets/base1',
    'Set metadata unavailable (en:base1): Error: 503: https://api.tcgdex.net/v2/en/sets/base2',
    'Promo artwork audit failed: Error: 404: https://api.tcgdex.net/v2/en/cards/mep-028',
    'Promo artwork audit failed: Error: 503: https://tcgcsv.com/tcgplayer/3/groups',
    'Promo artwork audit failed: Error: Promo metadata mismatch: mep-028',
    'Promo artwork audit failed: Invalid cached promo source',
    'Invalid local card image: mep-028',
    'Set metadata unavailable (en:base1): Error: 401: https://api.tcgdex.net/v2/en/sets/base1',
    '503: https://api.tcgdex.net/v2/en/cards/mep-028',
    '',
  ])('rejects unverified/unsafe artwork errors: %s', (message) => {
    expect(isTransientArtworkUpstreamFailure(message)).toBe(false);
  });

  it('rejects values other than strings', () => {
    expect(isTransientArtworkUpstreamFailure(null)).toBe(false);
    expect(isTransientArtworkUpstreamFailure(undefined)).toBe(false);
  });
});

describe('release artwork initial provider outage', () => {
  it('accepts one explicit 503 from the initial English set listing', () => {
    const stderr =
      'file:///tmp/scripts/audit-catalog-art.mjs:34\n' +
      'Error: 503: https://api.tcgdex.net/v2/en/sets\n' +
      '    at json (scripts/audit-catalog-art.mjs:34)\n';
    expect(isTransientArtworkBootstrapFailure(stderr)).toBe(true);
  });

  it.each([
    'Error: 404: https://api.tcgdex.net/v2/en/sets',
    'Error: 503: https://api.tcgdex.net/v2/en/cards/mep-028',
    'Error: 503: https://tcgcsv.com/tcgplayer/3/groups',
    'Error: 503: https://api.tcgdex.net/v2/en/sets\nError: invalid card index',
    'TypeError: Cannot parse provider content',
    '',
  ])('rejects any other premature audit failure', (stderr) => {
    expect(isTransientArtworkBootstrapFailure(stderr)).toBe(false);
  });
});

describe('dependent Classic Collection metadata outage', () => {
  const mismatch =
    'Classic Collection artwork audit failed: Error: Classic Collection catalogue / mapping mismatch';
  const verifiedTransient =
    'Set metadata unavailable (en:30th-c): Error: 503: https://api.tcgdex.net/v2/en/sets/30th-c';

  it('recognizes the exact dependent failure only during a proven TCGdex set-detail outage', () => {
    expect(
      isTransientClassicCollectionDependency(mismatch, [
        verifiedTransient,
        mismatch,
      ]),
    ).toBe(true);
  });

  it.each([
    [],
    ['Classic Collection artwork audit failed: invalid mapping'],
    ['Set metadata unavailable (en:base1): Error: 503: https://api.tcgdex.net/v2/en/sets/base1'],
    ['Set metadata unavailable (en:30th-c): Error: 404: https://api.tcgdex.net/v2/en/sets/30th-c'],
    ['Set metadata unavailable (en:30th-c): Error: 503: https://api.tcgdex.net/v2/en/sets/base1'],
  ])('rejects unrelated failures and nontransient detail responses', (errors) => {
    expect(isTransientClassicCollectionDependency(mismatch, errors)).toBe(false);
  });

  it('does not forgive malformed or altered Classic Collection mappings', () => {
    expect(
      isTransientClassicCollectionDependency(
        'Classic Collection artwork audit failed: Error: Different card source',
        [verifiedTransient],
      ),
    ).toBe(false);
  });
});
