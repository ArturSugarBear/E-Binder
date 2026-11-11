import { describe, expect, it } from 'vitest';
import type { Quad } from '../../src/domain/photo-geometry';
import {
  nextCardLock,
  plausibleCardQuad,
  type CardLock,
} from '../../src/domain/live-card-lock';

const WIDTH = 192;
const HEIGHT = 256;
const card: Quad = [
  { x: 0.16, y: 0.12 },
  { x: 0.84, y: 0.12 },
  { x: 0.84, y: 0.88 },
  { x: 0.16, y: 0.88 },
];
const blank: CardLock = { corners: null, stableFrames: 0 };
const shifted = (quad: Quad, dx: number, dy: number): Quad =>
  quad.map((p) => ({ x: p.x + dx, y: p.y + dy })) as unknown as Quad;

describe('live camera: safety-critical automatic shutter gating', () => {
  it('accepts a centered portrait TCG-card outline with perspective skew', () => {
    expect(plausibleCardQuad(card, WIDTH, HEIGHT)).toBe(true);
    const skewed: Quad = [
      { x: 0.2, y: 0.13 },
      { x: 0.82, y: 0.09 },
      { x: 0.88, y: 0.86 },
      { x: 0.13, y: 0.91 },
    ];
    expect(plausibleCardQuad(skewed, WIDTH, HEIGHT)).toBe(true);
  });

  it('rejects a square, wide landscape sheet and tiny rectangular object', () => {
    const square: Quad = [
      { x: 0.1, y: 0.2 },
      { x: 0.9, y: 0.2 },
      { x: 0.9, y: 0.8 },
      { x: 0.1, y: 0.8 },
    ];
    const landscape: Quad = [
      { x: 0.06, y: 0.3 },
      { x: 0.94, y: 0.3 },
      { x: 0.94, y: 0.7 },
      { x: 0.06, y: 0.7 },
    ];
    const small: Quad = [
      { x: 0.37, y: 0.38 },
      { x: 0.63, y: 0.38 },
      { x: 0.63, y: 0.62 },
      { x: 0.37, y: 0.62 },
    ];
    expect(plausibleCardQuad(square, WIDTH, HEIGHT)).toBe(false);
    expect(plausibleCardQuad(landscape, WIDTH, HEIGHT)).toBe(false);
    expect(plausibleCardQuad(small, WIDTH, HEIGHT)).toBe(false);
  });

  it('rejects a vertically stretched card outline instead of lengthening the scan frame', () => {
    const stretched: Quad = [
      { x: 0.18, y: 0.11 },
      { x: 0.82, y: 0.11 },
      { x: 0.82, y: 0.89 },
      { x: 0.18, y: 0.89 },
    ];
    expect(plausibleCardQuad(stretched, WIDTH, HEIGHT)).toBe(false);
    expect(
      nextCardLock(
        { corners: card, stableFrames: 3 },
        stretched,
        WIDTH,
        HEIGHT,
      ),
    ).toEqual(blank);
  });

  it('rejects frames with offscreen or invalid geometry instead of guessing', () => {
    expect(plausibleCardQuad(shifted(card, 0.6, 0), WIDTH, HEIGHT)).toBe(false);
    expect(plausibleCardQuad(shifted(card, 0, 0.6), WIDTH, HEIGHT)).toBe(false);
    expect(
      plausibleCardQuad(
        [card[0]!, { x: NaN, y: 0.12 }, card[2]!, card[3]!],
        WIDTH,
        HEIGHT,
      ),
    ).toBe(false);
    expect(plausibleCardQuad(card, 0, HEIGHT)).toBe(false);
    expect(plausibleCardQuad(card, WIDTH, -5)).toBe(false);
  });

  it('only locks after three consecutive stable frames', () => {
    const first = nextCardLock(blank, card, WIDTH, HEIGHT);
    expect(first.stableFrames).toBe(1);
    const second = nextCardLock(
      first,
      shifted(card, 0.009, 0.005),
      WIDTH,
      HEIGHT,
    );
    expect(second.stableFrames).toBe(2);
    const third = nextCardLock(second, card, WIDTH, HEIGHT);
    expect(third.stableFrames).toBe(3);
    expect(nextCardLock(third, card, WIDTH, HEIGHT).stableFrames).toBe(3);
  });

  it('clears the auto-shutter lock when corners disappear, jump or are not card-shaped', () => {
    const locked = nextCardLock(
      nextCardLock(
        nextCardLock(blank, card, WIDTH, HEIGHT),
        card,
        WIDTH,
        HEIGHT,
      ),
      card,
      WIDTH,
      HEIGHT,
    );
    expect(locked.stableFrames).toBe(3);
    const none = nextCardLock(locked, null, WIDTH, HEIGHT);
    expect(none).toEqual(blank);
    const jumped = nextCardLock(locked, shifted(card, 0.09, 0), WIDTH, HEIGHT);
    expect(jumped.stableFrames).toBe(1);
    const bad: Quad = [
      { x: 0.1, y: 0.3 },
      { x: 0.9, y: 0.3 },
      { x: 0.9, y: 0.7 },
      { x: 0.1, y: 0.7 },
    ];
    expect(nextCardLock(locked, bad, WIDTH, HEIGHT)).toEqual(blank);
  });
});
