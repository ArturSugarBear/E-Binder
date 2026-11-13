import { expect, it } from 'vitest';
import { expandLiveCaptureQuad } from '../../src/domain/live-capture-quad';
import { cardProjection, type Quad } from '../../src/domain/photo-geometry';

const card: Quad = [
  { x: 0.18, y: 0.19 },
  { x: 0.82, y: 0.19 },
  { x: 0.82, y: 0.81 },
  { x: 0.18, y: 0.81 },
];

it('preserves the top name band outside an optimistic automatic border', () => {
  const safe = expandLiveCaptureQuad(card);
  expect(safe[0]!.y).toBeLessThan(card[0]!.y - 0.04);
  expect(safe[1]!.y).toBeLessThan(card[1]!.y - 0.04);
  expect(safe[0]!.x).toBeLessThan(card[0]!.x);
  expect(safe[1]!.x).toBeGreaterThan(card[1]!.x);
  // The footer stays close to its existing OCR coordinates.
  expect(safe[2]!.y).toBeLessThan(card[2]!.y + 0.015);
  expect(safe[2]!.y).toBeGreaterThan(card[2]!.y);
  expect(cardProjection(safe)(0.5, 0.5).y).toBeGreaterThan(0.4);
});

it('adapts overscan near the camera boundary instead of inventing pixels', () => {
  const close: Quad = [
    { x: 0.08, y: 0.072 },
    { x: 0.9, y: 0.072 },
    { x: 0.9, y: 0.92 },
    { x: 0.08, y: 0.92 },
  ];
  const safe = expandLiveCaptureQuad(close);
  expect(safe[0]!.y).toBeLessThan(close[0]!.y);
  expect(safe.every((point) => point.x >= 0 && point.x <= 1)).toBe(
    true,
  );
  expect(safe.every((point) => point.y >= 0 && point.y <= 1)).toBe(
    true,
  );
});

it('leaves malformed quads unchanged instead of producing a black crop', () => {
  const invalid: Quad = [
    { x: 0.2, y: 0.2 },
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.9 },
    { x: 0.2, y: 0.9 },
  ];
  expect(expandLiveCaptureQuad(invalid)).toBe(invalid);
});
