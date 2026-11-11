import { describe, expect, it } from 'vitest';
import {
  editionClaimFromNote,
  requiresEditionStampReview,
  validateVintageEdition,
} from '../../src/domain/vintage-edition';

const base = {
  source: 'tcgdex' as const,
  setId: 'base1',
  language: 'de',
};

describe('Vintage Base Set edition integrity', () => {
  it('requires a dedicated edition review for German and English Base Set', () => {
    expect(requiresEditionStampReview(base)).toBe(true);
    expect(requiresEditionStampReview({ ...base, language: 'en' })).toBe(true);
    expect(requiresEditionStampReview({ ...base, source: 'manual' })).toBe(false);
    expect(requiresEditionStampReview({ ...base, setId: 'base2' })).toBe(false);
    expect(requiresEditionStampReview({ ...base, setId: 'me06' })).toBe(false);
  });

  it('recognizes German and English variants written as free text', () => {
    for (const note of [
      '1. Edition',
      '1.Auflage',
      '1 Auflage',
      '1st Edition',
      'First Edition',
      'erste Auflage',
      'Edition 1',
      'Erstauflage',
    ]) {
      expect(editionClaimFromNote(note)).toBe('first');
    }
    expect(editionClaimFromNote('Unlimitiert')).toBe('unlimited');
    expect(editionClaimFromNote('Unlimited')).toBe('unlimited');
    expect(editionClaimFromNote('Shadowless')).toBe('unknown');
    expect(editionClaimFromNote('')).toBe('unknown');
  });

  it('rejects unverified 1st Edition even when a catalogue match is exact', () => {
    expect(
      validateVintageEdition(base, '1. Edition', false, 'first'),
    ).toMatch(/Editionsstempels/);
    expect(
      validateVintageEdition(base, '1st Edition', false, 'unknown'),
    ).toMatch(/Editionsstempels/);
    expect(validateVintageEdition(base, '1. Edition', true, 'first'))
      .toBeUndefined();
  });

  it('allows a neutral edition and manually selected Unlimited', () => {
    expect(validateVintageEdition(base, '', false, 'unknown')).toBeUndefined();
    expect(
      validateVintageEdition(base, 'Unlimited', false, 'unlimited'),
    ).toBeUndefined();
    expect(
      validateVintageEdition(base, '1. Edition', true, 'unlimited'),
    ).toMatch(/widerspricht/);
  });

  it('does not block newer cards or pretend to detect edition stamps', () => {
    expect(
      validateVintageEdition(
        { ...base, setId: 'me06' },
        '1. Edition',
        false,
      ),
    ).toBeUndefined();
  });
});
