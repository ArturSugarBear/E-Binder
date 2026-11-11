import { describe, expect, it } from 'vitest';
import {
  alignProductPrints,
  canonicalCollectorNumber,
  canonicalProductName,
} from '../../scripts/lib/cardmarket-print-alignment.mjs';

const cards = Array.from({ length: 14 }, (_, i) => [
  String(i + 1),
  i === 3 || i === 10 ? 'Groudon' : `Card ${i + 1}`,
  '',
  null,
]);
const products = cards.map((c, i) => ({
  idProduct: 2000 + i,
  idExpansion: 123,
  name: `${c[1]} [Attack | Other]`,
}));

describe('Cardmarket exact-print sequence alignment', () => {
  it('distinguishes two printings with identical names in one set', () => {
    const result = alignProductPrints(products, cards);
    expect(result.accepted).toBe(true);
    expect(result.coverage).toBe(1);
    expect(
      result.matches
        .filter((row) => row.cardName === 'Groudon')
        .map((row) => row.productId),
    ).toEqual([2003, 2010]);
    expect(
      result.matches
        .filter((row) => row.cardName === 'Groudon')
        .map((row) => row.number),
    ).toEqual(['4', '11']);
  });

  it('tolerates extra products at the beginning without shifting printing IDs', () => {
    const market = [
      { idProduct: 1999, idExpansion: 123, name: 'Special Promo' },
      ...products,
    ];
    const result = alignProductPrints(market, cards);
    expect(result.accepted).toBe(true);
    expect(result.matches.find((row) => row.number === '11')?.productId).toBe(
      2010,
    );
  });

  it('rejects independent product-ID contradictions', () => {
    const independent = cards.map((x) => [...x]);
    independent[10][3] = 999999;
    const result = alignProductPrints(products, independent);
    expect(result.accepted).toBe(true);
    expect(result.matches.some((row) => row.number === '11')).toBe(false);
  });

  it('declines low-coverage and ambiguous catalogues', () => {
    const wrong = products.map((p) => ({ ...p, name: 'Unknown' }));
    expect(alignProductPrints(wrong, cards).accepted).toBe(false);
    expect(alignProductPrints(products.slice(0, 3), cards).accepted).toBe(
      false,
    );
  });

  it('normalizes zero-padded printed numbers and artwork names', () => {
    expect(canonicalCollectorNumber('001')).toBe('1');
    expect(canonicalCollectorNumber('GG-01')).toBe('GG-01');
    expect(canonicalProductName('Groudon [Strength]')).toBe('groudon');
    expect(canonicalProductName('Mega Darkrai ex')).toBe('megadarkraiex');
  });
});
