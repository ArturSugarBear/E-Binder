import { expect, it } from 'vitest';
import { cardProjection, type Quad } from '../../src/domain/photo-geometry';
it('maps an inset perspective card to the correct four corners and interior', () => {
  const corners: Quad = [
    { x: 0.1, y: 0.05 },
    { x: 0.9, y: 0.2 },
    { x: 0.8, y: 0.95 },
    { x: 0.15, y: 0.8 },
  ];
  const map = cardProjection(corners);
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].forEach(([u, v], i) => {
    expect(map(u!, v!).x).toBeCloseTo(corners[i]!.x);
    expect(map(u!, v!).y).toBeCloseTo(corners[i]!.y);
  });
  expect(map(0.5, 0.5).x).toBeGreaterThan(0.1);
  expect(map(0.5, 0.5).y).toBeLessThan(0.95);
});
it('keeps already upright images unchanged and rejects crossed or collapsed corners', () => {
  const corners: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  expect(cardProjection(corners)(0.3, 0.7)).toEqual({ x: 0.3, y: 0.7 });
  expect(() =>
    cardProjection([corners[0], corners[2], corners[1], corners[3]]),
  ).toThrow();
  expect(() =>
    cardProjection([corners[0], corners[0], corners[2], corners[3]]),
  ).toThrow();
  expect(() =>
    cardProjection([{ x: NaN, y: 0 }, ...corners.slice(1)] as Quad),
  ).toThrow();
});
