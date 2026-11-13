import { describe, expect, it } from 'vitest';
import { isTransientArtworkUpstreamFailure } from '../../scripts/artwork-upstream-errors.mjs';

describe('release artwork transient upstream classification', () => {
  it.each([
    'Set metadata unavailable (en:2024sv): Error: 503: https://api.tcgdex.net/v2/en/sets/2024sv',
    'Set catalogue unavailable (en): Error: 503: https://api.tcgdex.net/v2/en/sets',
    'Set catalogue unavailable (de): Error: 429: https://api.tcgdex.net/v2/de/sets',
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
    'Set catalogue unavailable (en): Error: 503: https://api.tcgdex.net/v2/de/sets',
    'Set catalogue unavailable (en): Error: 404: https://api.tcgdex.net/v2/en/sets',
    'Set catalogue unavailable (en): Error: 503: https://example.com/v2/en/sets',
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
