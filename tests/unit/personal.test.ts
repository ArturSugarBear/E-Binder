import { describe, expect, it } from 'vitest';
import collection from '../../public/collection.json' with { type: 'json' };
import { parseCollection } from '../../src/domain/collection';
import {
  editorialCards,
  candidatesFromText,
} from '../../src/data/card-catalog';
import {
  addWish,
  normalize,
  availableUnits,
  changeState,
  confirmHolding,
  createBinder,
  correctHolding,
  emptyState,
  findPage,
  placeUnit,
  setPageLayout,
  swapSlots,
  validateState,
  type PersonalState,
} from '../../src/domain/personal';
import { suggestPages, type Preferences } from '../../src/domain/recommend';
import { allPhotoIds, parseBackup } from '../../src/data/personal-store';

const cards = editorialCards(parseCollection(collection));
function fixture(): PersonalState {
  let state = emptyState();
  for (const card of cards.slice(9, 18))
    state = confirmHolding(state, {
      card,
      finish: 'holo',
      variantNote: '',
      quantity: 1,
      tradeQuantity: 0,
      favorite: false,
      notes: '',
    });
  return createBinder(state, 'Mein Binder');
}
const preferences: Preferences = {
  goal: 'story',
  artist: '',
  anchorSlot: 4,
  excludedIds: [],
  allowRepeats: false,
};

describe('confirmed ownership and physical allocations', () => {
  it('treats confirmation as an explicit total, never an automatic increment', () => {
    const state = fixture();
    const holding = state.holdings[0]!;
    const again = confirmHolding(state, { ...holding, quantity: 1 });
    expect(again.holdings).toHaveLength(9);
    expect(again.holdings[0]!.quantity).toBe(1);
    const two = confirmHolding(again, { ...holding, quantity: 2 });
    expect(two.holdings[0]!.quantity).toBe(2);
  });
  it('does not permit a repeated capture adoption or invent additional copies', () => {
    let state = fixture();
    state = changeState(state, (next) => {
      next.captures.push({
        id: 'capture',
        photoId: 'photo',
        hash: 'hash',
        name: 'Karte.jpg',
        createdAt: 'today',
        status: 'pending',
        text: '',
        error: '',
        candidates: [],
      });
    });
    const holding = state.holdings[0]!;
    const once = confirmHolding(state, holding, 'capture');
    expect(() => confirmHolding(once, holding, 'capture')).toThrow(/bereits/);
    expect(once.holdings[0]!.quantity).toBe(1);
  });
  it('does not allocate one copy to two physical pages or release a trade reservation silently', () => {
    let state = fixture();
    const page = state.binders[0]!.pages[0]!;
    const unit = availableUnits(state)[0]!;
    state = placeUnit(state, page.id, 0, unit);
    state = createBinder(state, 'Zweiter Binder');
    const otherPage = state.binders[1]!.pages[0]!;
    expect(() => placeUnit(state, otherPage.id, 0, unit)).toThrow(
      /physisches Exemplar/,
    );
    expect(() =>
      changeState(state, (next) => {
        next.holdings[0]!.quantity = 1;
        next.holdings[0]!.tradeQuantity = 1;
      }),
    ).toThrow(/nicht verfügbar/);
  });
  it('moves within the current page without changing quantity and respects locks', () => {
    let state = fixture();
    const pageId = state.binders[0]!.pages[0]!.id;
    state = placeUnit(state, pageId, 0, availableUnits(state)[0]!);
    state = swapSlots(state, pageId, 0, 8);
    expect(findPage(state, pageId).slots[0]).toBeNull();
    expect(findPage(state, pageId).slots[8]?.kind).toBe('owned');
    const locked = changeState(state, (next) => {
      findPage(next, pageId).slots[8]!.locked = true;
    });
    expect(() => swapSlots(locked, pageId, 8, 0)).toThrow(/festgehalten/);
    expect(state.holdings.every((holding) => holding.quantity === 1)).toBe(
      true,
    );
  });
  it('keeps a wish independent of already owning that card', () => {
    const state = fixture();
    const next = addWish(state, state.holdings[0]!.card);
    expect(next.wishes).toHaveLength(1);
    expect(next.holdings).toEqual(state.holdings);
  });
});

describe('bounded arrangement rules', () => {
  it('keeps every locked copy in every alternative and never allocates beyond the pool', () => {
    let state = fixture();
    const pageId = state.binders[0]!.pages[0]!.id;
    const unit = availableUnits(state)[0]!;
    state = placeUnit(state, pageId, 7, unit);
    state = changeState(state, (next) => {
      findPage(next, pageId).slots[7]!.locked = true;
    });
    const suggestions = suggestPages(state, pageId, preferences);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion.slots[7]).toEqual(findPage(state, pageId).slots[7]);
      expect(() =>
        validateState(setPageLayout(state, pageId, suggestion.slots)),
      ).not.toThrow();
    }
  });
  it('shows artist shortage as empty pockets and never fills from another artist', () => {
    const state = fixture();
    const pageId = state.binders[0]!.pages[0]!.id;
    const suggestions = suggestPages(state, pageId, {
      ...preferences,
      goal: 'artist',
      artist: 'Jiro Sasumo',
    });
    for (const suggestion of suggestions) {
      expect(suggestion.filled).toBe(3);
      for (const slot of suggestion.slots)
        if (slot?.kind === 'owned')
          expect(
            state.holdings.find((holding) => holding.id === slot.holdingId)!
              .card.artist,
          ).toBe('Jiro Sasumo');
    }
    const keys = suggestions.map((suggestion) =>
      JSON.stringify(suggestion.slots),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('rejects an incompatible artist filter instead of moving a locked card', () => {
    let state = fixture();
    const pageId = state.binders[0]!.pages[0]!.id;
    state = placeUnit(state, pageId, 0, availableUnits(state)[0]!);
    state = changeState(state, (next) => {
      findPage(next, pageId).slots[0]!.locked = true;
    });
    expect(() =>
      suggestPages(state, pageId, {
        ...preferences,
        goal: 'artist',
        artist: 'Jerky',
      }),
    ).toThrow(/fixierte/);
  });
  it('works on previously unused synthetic cards rather than chapter IDs', () => {
    let state = emptyState();
    for (let i = 0; i < 12; i++) {
      const base = cards[0]!;
      state = confirmHolding(state, {
        card: {
          ...base,
          key: `unseen-${i}`,
          name: `Neues Motiv ${i}`,
          setName: 'Unabhängiger Testpool',
          number: `${i + 1}/100`,
          artist: i % 2 ? 'Artist A' : 'Artist B',
          artistSource: 'manual',
          evolvesFrom: '',
          palette: { hue: i * 28, saturation: 0.5, lightness: 0.5 },
        },
        finish: 'normal',
        variantNote: '',
        quantity: 1,
        tradeQuantity: 0,
        favorite: false,
        notes: '',
      });
    }
    state = createBinder(state, 'Unabhängiger Pool');
    const pageId = state.binders[0]!.pages[0]!.id;
    const anchor = state.holdings[11]!;
    for (const proposal of suggestPages(state, pageId, {
      ...preferences,
      goal: 'visual',
      anchorId: anchor.id,
    })) {
      expect(proposal.filled).toBe(9);
      expect(proposal.slots[4]).toMatchObject({ holdingId: anchor.id });
      expect(() => setPageLayout(state, pageId, proposal.slots)).not.toThrow();
    }
  });
});

describe('recognition and backup boundaries', () => {
  it('returns several candidates for ambiguous numbers, not confirmed ownership', () => {
    const candidates = candidatesFromText('207 / 197', cards);
    expect(candidates.some((card) => card.name === 'Taubsi')).toBe(true);
    expect(emptyState().holdings).toEqual([]);
  });
  it('rejects missing photos and impossible allocations before replacing a collection', () => {
    const state = fixture();
    const manifest = {
      record: 'manifest',
      format: 'e-binder',
      version: 1,
      mode: 'personal',
      revision: 0,
      exportedAt: 'today',
    };
    const bad = {
      ...state.holdings[0]!,
      card: { ...state.holdings[0]!.card, photoId: 'missing' },
    };
    const backup =
      JSON.stringify(manifest) +
      '\n' +
      JSON.stringify({ record: 'holding', data: bad });
    expect(() => parseBackup(backup)).toThrow(/Originalfoto/);
    expect(state.holdings).toHaveLength(9);
  });
});

describe('regressions at the boundary of inventory and layout', () => {
  it('preserves a current page copy beyond the first nine available copies', () => {
    let state = fixture();
    const id = state.holdings[0]!.id;
    const pageId = state.binders[0]!.pages[0]!.id;
    state = changeState(state, (next) => {
      next.holdings[0]!.quantity = 15;
    });
    state = placeUnit(state, pageId, 4, {
      kind: 'owned',
      holdingId: id,
      copy: 15,
      locked: false,
    });
    state = changeState(state, (next) => {
      findPage(next, pageId).slots[4]!.locked = true;
    });
    const suggestions = suggestPages(state, pageId, preferences);
    for (const proposal of suggestions)
      expect(proposal.slots[4]).toMatchObject({
        holdingId: id,
        copy: 15,
        locked: true,
      });
  });
  it('places related chains before unrelated cards even when unrelated keys sort first', () => {
    const state = createBinder(fixture(), 'Second page');
    const mixed = changeState(state, (next) => {
      for (const card of cards.slice(0, 9))
        next.holdings.push({
          ...next.holdings[0]!,
          id: crypto.randomUUID(),
          card,
        });
    });
    const pageId = mixed.binders[0]!.pages[0]!.id;
    const proposal = suggestPages(mixed, pageId, preferences)[0]!;
    expect(proposal.relations).toBe(6);
    expect(proposal.filled).toBe(9);
  });
  it('does not lose cards when groups of lengths three, two, two and two do not fit whole rows', () => {
    let state = fixture();
    const names = [
      'Alpha',
      'Beta',
      'Gamma',
      'Delta',
      'Epsilon',
      'Zeta',
      'Eta',
      'Theta',
      'Iota',
    ];
    const parents = ['', 'Alpha', 'Beta', '', 'Delta', '', 'Zeta', '', 'Theta'];
    state = changeState(state, (next) => {
      next.holdings.forEach((holding, i) => {
        holding.card.name = names[i]!;
        holding.card.evolvesFrom = parents[i]!;
      });
    });
    const pageId = state.binders[0]!.pages[0]!.id;
    expect(suggestPages(state, pageId, preferences)[0]!.filled).toBe(9);
  });
  it('keeps reservation IDs during an edition correction and resets the physical assembly marker', () => {
    let state = fixture();
    const holding = state.holdings[0]!;
    const pageId = state.binders[0]!.pages[0]!.id;
    state = placeUnit(state, pageId, 0, availableUnits(state)[0]!);
    state = changeState(state, (next) => {
      findPage(next, pageId).assembled = true;
    });
    state = correctHolding(state, holding.id, {
      card: { ...holding.card, name: 'Corrected name' },
      finish: 'reverse',
      variantNote: '',
      quantity: 1,
    });
    expect(findPage(state, pageId).slots[0]).toMatchObject({
      holdingId: holding.id,
    });
    expect(findPage(state, pageId).assembled).toBe(false);
  });
  it('includes originals referenced only by unconfirmed recognition candidates in the backup', () => {
    const state = changeState(fixture(), (next) => {
      next.captures.push({
        id: 'capture',
        photoId: 'original',
        hash: 'hash',
        name: 'photo.jpg',
        createdAt: 'today',
        status: 'pending',
        text: '',
        error: '',
        candidates: [{ ...cards[0]!, photoId: 'candidate-original' }],
      });
    });
    expect(allPhotoIds(state)).toEqual(
      new Set(['original', 'candidate-original']),
    );
  });
});

it('keeps non-Latin illustrator names and set names distinct during normalization', () => {
  expect(normalize('江川')).not.toBe(normalize('森山'));
  expect(normalize('が')).not.toBe(normalize('か'));
  expect(normalize('Pokémon Café')).toBe('pokemoncafe');
});
