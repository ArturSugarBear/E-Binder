import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const guide = JSON.parse(
  await readFile(
    new URL('../../public/assets/prices/cardmarket-verified.json', import.meta.url),
    'utf8',
  ),
);

describe('generated Cardmarket daily exact-print reference', () => {
  it('contains independently checked identities for both normal and illustration rare', () => {
    expect(guide.schemaVersion).toBe(1);
    expect(guide.currency).toBe('EUR');
    expect(Object.keys(guide.cards).length).toBeGreaterThan(150);
    expect(guide.sets.me06.status).toBe('validated');
    expect(guide.cards['me06-106'][0]).toBe(918943);
    expect(guide.cards['me06-111'][0]).toBe(918949);
    expect(guide.cards['me05-101'][0]).toBe(895886);
    expect(guide.cards['me06-106'][0]).not.toBe(918832);
    expect(guide.cards['me06-111'][0]).not.toBe(918876);
  });

  it('never silently fills an expansion which did not pass independent matching', () => {
    expect(guide.sets['30th'].status).not.toBe('validated');
    expect(guide.cards['30th-132']).toBeUndefined();
  });

  it('has valid dates, unambiguous products, and positive EUR guide amounts', () => {
    expect(Number.isFinite(Date.parse(guide.sourceCreatedAt))).toBe(true);
    const products = new Set();
    for (const [card, row] of Object.entries(guide.cards)) {
      expect(card).toMatch(/^[a-z0-9.+-]+-[a-z0-9]+$/i);
      expect(Number.isSafeInteger(row[0])).toBe(true);
      expect(Number.isFinite(row[1]) && row[1] > 0).toBe(true);
      expect(['trend','avg7','avg30','avg'].includes(row[2])).toBe(true);
      expect(typeof row[3]).toBe('string');
      expect(products.has(row[0])).toBe(false);
      products.add(row[0]);
    }
  });
});
