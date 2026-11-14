import { describe, expect, it } from 'vitest';
import data from '../../public/collection.json' with { type: 'json' };
import { parseCollection } from '../../src/domain/collection';
import {
  resolveChapter,
  swipeDirection,
  swipeOffset,
} from '../../src/domain/navigation';

const chapters = parseCollection(data);
describe('chapter routes', () => {
  it.each([
    ['#greninja', 20],
    ['#kapitel-22', 21],
    ['#kapitel-1', 0],
    ['#kapitel-999', 0],
    ['#kapitel--1', 0],
    ['#kapitel-0', 0],
  ])('resolves %s to %i', (hash, expected) => {
    expect(resolveChapter(hash, chapters, 5)).toBe(expected);
  });
  it('preserves the current chapter for in-page anchors', () => {
    expect(resolveChapter('#kapitel', chapters, 8)).toBe(8);
    expect(resolveChapter('#top', chapters, 8)).toBe(8);
  });
  it('returns to chapter one when browser history returns to the root URL', () => {
    expect(resolveChapter('', chapters, 8)).toBe(0);
  });
});
describe('swipe intent', () => {
  it.each([
    [-80, 10, 1],
    [80, 10, -1],
    [40, 0, 0],
    [60, 100, 0],
    [0, 100, 0],
  ])('interprets (%i, %i) as %i', (dx, dy, expected) => {
    expect(swipeDirection(dx, dy)).toBe(expected);
  });
});

describe('swipe follow offset', () => {
  it('follows the finger with damping and clamps at the visual limit', () => {
    expect(swipeOffset(100)).toBe(35);
    expect(swipeOffset(-100)).toBe(-35);
    expect(swipeOffset(1000)).toBe(120);
    expect(swipeOffset(-1000, 80)).toBe(-80);
    expect(swipeOffset(0)).toBe(0);
  });
});
