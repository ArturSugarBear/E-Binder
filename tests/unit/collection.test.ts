import { describe, expect, it } from 'vitest';
import data from '../../public/collection.json' with { type: 'json' };
import { parseCollection } from '../../src/domain/collection';

describe('collection boundary', () => {
  it('retains all 198 cards and both Greninja chapters', () => {
    const collection = parseCollection(data);
    expect(collection).toHaveLength(22);
    expect(collection.flatMap((entry) => entry.cards)).toHaveLength(198);
    expect(
      collection.filter((entry) => entry.theme === 'greninja'),
    ).toHaveLength(2);
  });
  it.each([
    'javascript:alert(1)',
    'https://evil.example/?idProduct=12',
    'https://www.cardmarket.com/en/Pokemon/Products?idProduct=0',
  ])('rejects unsafe product URL %s', (url) => {
    const changed = structuredClone(data);
    changed[0]!.cards[0]!.cardmarket = url;
    expect(() => parseCollection(changed)).toThrow();
  });
  it('rejects missing cards, duplicate pockets, path traversal and unrelated cover images', () => {
    for (const mutate of [
      (value: typeof data) => value[0]!.cards.pop(),
      (value: typeof data) => {
        value[0]!.cards[1] = value[0]!.cards[0]!;
      },
      (value: typeof data) => {
        value[0]!.cards[0]!.id = '../secret';
      },
      (value: typeof data) => {
        value[0]!.covers[0] = 'missing';
      },
    ]) {
      const changed = structuredClone(data);
      mutate(changed);
      expect(() => parseCollection(changed)).toThrow();
    }
  });
});
