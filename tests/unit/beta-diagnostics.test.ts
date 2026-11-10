import { expect, it } from 'vitest';
import {
  betaArea,
  betaCommitAction,
  safeCatalogueKey,
} from '../../src/data/beta-diagnostics';

it('restricts diagnostic routes and action labels to static categories', () => {
  expect(betaArea('binder')).toBe('binder');
  expect(betaArea('user/private/card')).toBe('other');
  expect(betaCommitAction('Bestand bestätigt')).toBe('holding_confirmed');
  expect(betaCommitAction('Mein seltenes Glurak')).toBe('state_changed');
});
it('rejects arbitrary text and image URLs as card telemetry identifiers', () => {
  expect(safeCatalogueKey('tcgdex:de:me06-12')).toBe('tcgdex:de:me06-12');
  expect(safeCatalogueKey('photo: data:image/png;base64,AA')).toBeUndefined();
  expect(safeCatalogueKey('https://example.com/secret')).toBeUndefined();
  expect(safeCatalogueKey('My private notes')).toBeUndefined();
  expect(safeCatalogueKey('blob:https://example.com/photo')).toBeUndefined();
});
