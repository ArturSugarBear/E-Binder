import { expect, it } from 'vitest';
import { loginAddress } from '../../src/data/supabase';
it('uses one canonical username for login and rejects ambiguous or address-shaped input', () => {
  expect(loginAddress('  Sammler_13 ')).toBe(
    'sammler_13@users.e-binder.invalid',
  );
  for (const invalid of [
    'ab',
    'sammler@mail.de',
    'sammler name',
    'sammler/one',
    'Ｓammler',
    'sammler'.repeat(5),
  ])
    expect(() => loginAddress(invalid)).toThrow();
});
