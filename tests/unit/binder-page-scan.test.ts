import { describe, expect, it } from 'vitest';
import collection from '../../public/collection.json' with { type: 'json' };
import { parseCollection } from '../../src/domain/collection';
import { editorialCards } from '../../src/data/card-catalog';
import { pocketCrop } from '../../src/data/page-pockets';
import {
  confirmHolding,
  createBinder,
  emptyState,
  importScannedPage,
  type ScannedCardChoice,
} from '../../src/domain/personal';

const cards = editorialCards(parseCollection(collection));
const fingerprint = (character: string) => character.repeat(64);
const choice = (index: number): ScannedCardChoice => ({
  card: cards[index]!,
  finish: 'normal',
  variantNote: '',
});

describe('3x3 binder page geometry', () => {
  it('extracts a row-major grid with inset for all nine cards', () => {
    const crops = Array.from({ length: 9 }, (_, index) =>
      pocketCrop(index, 1260, 1760),
    );
    expect(crops).toHaveLength(9);
    expect(crops[0]!.x).toBeLessThan(crops[1]!.x);
    expect(crops[0]!.y).toBe(crops[1]!.y);
    expect(crops[3]!.y).toBeGreaterThan(crops[0]!.y);
    expect(crops[8]!.x).toBeGreaterThan(crops[6]!.x);
    expect(crops[8]!.y).toBeGreaterThan(crops[5]!.y);
    for (const crop of crops) {
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.width).toBeLessThanOrEqual(1260);
      expect(crop.y + crop.height).toBeLessThanOrEqual(1760);
    }
  });
  it('rejects invalid slots and bounds', () => {
    expect(() => pocketCrop(9, 1260, 1760)).toThrow();
    expect(() => pocketCrop(-1, 1260, 1760)).toThrow();
    expect(() => pocketCrop(0, 0, 1760)).toThrow();
    expect(() => pocketCrop(0, 1260, 1760, 0.3)).toThrow();
  });
});

describe('atomic binder page import', () => {
  it('preserves physical positions and never changes the input state', () => {
    const state = emptyState();
    const slots = Array<ScannedCardChoice | null>(9).fill(null);
    slots[0] = choice(0);
    slots[4] = choice(1);
    slots[8] = choice(2);
    const next = importScannedPage(state, {
      fingerprint: fingerprint('a'),
      binderName: 'Mein Foto-Binder',
      slots,
    });
    expect(state.binders).toHaveLength(0);
    expect(state.holdings).toHaveLength(0);
    expect(next.binders).toHaveLength(1);
    expect(next.binders[0]!.isPublic).toBe(false);
    const page = next.binders[0]!.pages[0]!;
    expect(page.sourceFingerprint).toBe(fingerprint('a'));
    expect(page.slots[1]).toBeNull();
    expect(page.slots[4]?.kind).toBe('owned');
    expect(page.slots[8]?.kind).toBe('owned');
    expect(next.holdings).toHaveLength(3);
  });
  it('reuses unassigned copies and adds a new one only when needed', () => {
    const state = confirmHolding(emptyState(), {
      ...choice(0),
      quantity: 2,
      tradeQuantity: 0,
      favorite: false,
      notes: '',
    });
    const first = importScannedPage(state, {
      fingerprint: fingerprint('a'),
      slots: [choice(0), choice(0), null, null, null, null, null, null, null],
    });
    expect(first.holdings[0]!.quantity).toBe(2);
    const second = importScannedPage(first, {
      fingerprint: fingerprint('b'),
      binderId: first.binders[0]!.id,
      slots: [choice(0), null, null, null, null, null, null, null, null],
    });
    expect(second.holdings[0]!.quantity).toBe(3);
    expect(second.binders[0]!.pages).toHaveLength(2);
    const used = second.binders[0]!.pages.flatMap((page) =>
      page.slots.flatMap((slot) => (slot?.kind === 'owned' ? [slot.copy] : [])),
    );
    expect(used).toEqual([1, 2, 3]);
  });
  it('does not reimport an identical photo or corrupt existing binder pages', () => {
    const state = createBinder(emptyState(), 'Schon da');
    const next = importScannedPage(state, {
      fingerprint: fingerprint('a'),
      binderId: state.binders[0]!.id,
      slots: [choice(0), null, null, null, null, null, null, null, null],
    });
    expect(next.binders[0]!.pages[0]).toEqual(state.binders[0]!.pages[0]);
    expect(() =>
      importScannedPage(next, {
        fingerprint: fingerprint('a'),
        slots: [choice(0), null, null, null, null, null, null, null, null],
      }),
    ).toThrow(/bereits/);
    expect(next.binders[0]!.pages).toHaveLength(2);
  });
  it('keeps duplicates and unresolved printings without inventing holo status', () => {
    const card = { ...choice(0), finish: 'unverified' as const };
    const next = importScannedPage(emptyState(), {
      fingerprint: fingerprint('d'),
      binderName: 'Mixed printings',
      slots: [card, card, null, null, null, null, null, null, null],
    });
    expect(next.holdings).toHaveLength(1);
    expect(next.holdings[0]!.finish).toBe('unverified');
    expect(next.holdings[0]!.quantity).toBe(2);
    expect(next.binders[0]!.pages[0]!.slots[2]).toBeNull();
    const assigned = next.binders[0]!.pages[0]!.slots.slice(0, 2);
    expect(
      assigned.map((slot) => (slot?.kind === 'owned' ? slot.copy : 0)),
    ).toEqual([1, 2]);
  });
  it('rejects all-empty pages and unknown binders without writes', () => {
    const state = emptyState();
    expect(() =>
      importScannedPage(state, {
        fingerprint: fingerprint('c'),
        slots: Array(9).fill(null),
      }),
    ).toThrow();
    expect(() =>
      importScannedPage(state, {
        fingerprint: fingerprint('c'),
        binderId: 'missing',
        slots: [choice(0), null, null, null, null, null, null, null, null],
      }),
    ).toThrow();
    expect(state.holdings).toEqual([]);
  });
});
