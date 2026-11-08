import { z } from 'zod';

const text = z.string().trim().min(1).max(200);
const id = z.string().min(1).max(250);
export const finishes = ['normal', 'holo', 'reverse', 'other'] as const;
export type Finish = (typeof finishes)[number];
export const finishLabels: Record<Finish, string> = {
  normal: 'Nicht holografisch',
  holo: 'Holografisch',
  reverse: 'Reverse-Holo',
  other: 'Andere Variante',
};

export const paletteSchema = z
  .object({
    hue: z.number().min(0).max(360),
    saturation: z.number().min(0).max(1),
    lightness: z.number().min(0).max(1),
  })
  .strict();

const safeImage = z
  .string()
  .max(4096)
  .refine((value) => {
    if (!value) return true;
    if (/^assets\/cards\/[a-zA-Z0-9_-]+\.webp$/.test(value)) return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        [
          'assets.tcgdex.net',
          'assets.pokemon.com',
          'images.pokemontcg.io',
        ].includes(url.hostname)
      );
    } catch {
      return false;
    }
  }, 'Unzulässige Bildadresse');

export const personalCardSchema = z
  .object({
    key: id,
    name: text,
    setName: text,
    setId: z.string().max(100),
    number: text,
    language: z.string().regex(/^[a-z]{2}(?:-[a-z]{2})?$/),
    image: safeImage,
    source: z.enum(['editorial', 'tcgdex', 'manual']),
    sourceId: z.string().max(200),
    artist: z.string().trim().max(200),
    artistSource: z.enum(['publisher', 'catalogue', 'manual', 'unknown']),
    artistUrl: z
      .string()
      .url()
      .max(4096)
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password;
      }, 'Ungültiger Quellenlink')
      .optional(),
    evolvesFrom: z.string().max(200),
    stage: z.string().max(100),
    finishes: z.array(z.enum(finishes)).min(1).max(4),
    photoId: id.optional(),
    palette: paletteSchema.optional(),
  })
  .strict();
export type PersonalCard = z.infer<typeof personalCardSchema>;
export type Palette = z.infer<typeof paletteSchema>;

export const holdingSchema = z
  .object({
    id,
    card: personalCardSchema,
    finish: z.enum(finishes),
    variantNote: z.string().trim().max(200),
    quantity: z.number().int().min(1).max(999),
    tradeQuantity: z.number().int().min(0).max(999),
    favorite: z.boolean(),
    notes: z.string().max(2000),
    confirmed: z.literal(true),
    createdAt: text,
    updatedAt: text,
  })
  .strict();
export type Holding = z.infer<typeof holdingSchema>;

export const ownedSlotSchema = z
  .object({
    kind: z.literal('owned'),
    holdingId: id,
    copy: z.number().int().min(1).max(999),
    locked: z.boolean(),
  })
  .strict();
const plannedSlotSchema = z
  .object({
    kind: z.literal('planned'),
    card: personalCardSchema,
    locked: z.boolean(),
  })
  .strict();
export const slotSchema = z.union([
  ownedSlotSchema,
  plannedSlotSchema,
  z.null(),
]);
export type OwnedSlot = z.infer<typeof ownedSlotSchema>;
export type Slot = z.infer<typeof slotSchema>;
export const pageSchema = z
  .object({
    id,
    title: text,
    slots: z.array(slotSchema).length(9),
    assembled: z.boolean().default(false),
    assembledAt: z.string().optional(),
  })
  .strict();
export type PersonalPage = z.infer<typeof pageSchema>;
export const binderSchema = z
  .object({ id, name: text, pages: z.array(pageSchema).min(1).max(200) })
  .strict();
export type PersonalBinder = z.infer<typeof binderSchema>;

const wishSchema = z
  .object({
    id,
    card: personalCardSchema,
    quantity: z.number().int().min(1).max(999),
    priority: z.enum(['low', 'normal', 'high']),
    notes: z.string().max(2000),
  })
  .strict();
export type Wish = z.infer<typeof wishSchema>;
export const captureSchema = z
  .object({
    id,
    photoId: id,
    hash: text,
    name: text,
    createdAt: text,
    status: z.enum(['pending', 'confirmed', 'skipped']),
    text: z.string().max(30000),
    error: z.string().max(2000),
    candidates: z.array(personalCardSchema).max(30),
    holdingId: id.optional(),
  })
  .strict();
export type Capture = z.infer<typeof captureSchema>;

export const personalStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    mode: z.enum(['personal', 'demo']),
    holdings: z.array(holdingSchema).max(20000),
    binders: z.array(binderSchema).max(1000),
    wishes: z.array(wishSchema).max(20000),
    captures: z.array(captureSchema).max(5000),
    lastBinderId: id.optional(),
    lastPageId: id.optional(),
  })
  .strict();
export type PersonalState = z.infer<typeof personalStateSchema>;

export function emptyState(
  mode: PersonalState['mode'] = 'personal',
): PersonalState {
  return {
    schemaVersion: 1,
    revision: 0,
    mode,
    holdings: [],
    binders: [],
    wishes: [],
    captures: [],
  };
}
export const uid = (): string => crypto.randomUUID();
export const normalize = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de')
    .replace(/[^a-z0-9]/g, '');
export const numberKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s/g, '')
    .split('/')
    .map((part) =>
      part.replace(
        /^([a-z]*)(\d+)$/,
        (_, prefix: string, digits: string) => `${prefix}${Number(digits)}`,
      ),
    )
    .join('/');
export function sameCard(a: PersonalCard, b: PersonalCard): boolean {
  return (
    a.language === b.language &&
    (a.key === b.key ||
      (normalize(a.setName) === normalize(b.setName) &&
        numberKey(a.number) === numberKey(b.number)))
  );
}
export const unitKey = (unit: Pick<OwnedSlot, 'holdingId' | 'copy'>): string =>
  `${unit.holdingId}:${unit.copy}`;
export const emptySlots = (): Slot[] => Array.from({ length: 9 }, () => null);
export function findPage(state: PersonalState, pageId: string): PersonalPage {
  const page = state.binders
    .flatMap((binder) => binder.pages)
    .find((item) => item.id === pageId);
  if (!page) throw new Error('Diese Seite wurde nicht gefunden.');
  return page;
}
export function cardForSlot(
  state: PersonalState,
  slot: Slot,
): PersonalCard | undefined {
  return slot?.kind === 'planned'
    ? slot.card
    : slot?.kind === 'owned'
      ? state.holdings.find((item) => item.id === slot.holdingId)?.card
      : undefined;
}
export function locations(
  state: PersonalState,
  holdingId: string,
): {
  binder: string;
  page: string;
  pageId: string;
  slot: number;
  copy: number;
}[] {
  return state.binders.flatMap((binder) =>
    binder.pages.flatMap((page) =>
      page.slots.flatMap((slot, index) =>
        slot?.kind === 'owned' && slot.holdingId === holdingId
          ? [
              {
                binder: binder.name,
                page: page.title,
                pageId: page.id,
                slot: index,
                copy: slot.copy,
              },
            ]
          : [],
      ),
    ),
  );
}
export function availableUnits(
  state: PersonalState,
  pageId?: string,
): OwnedSlot[] {
  const used = new Set(
    state.binders.flatMap((binder) =>
      binder.pages
        .filter((page) => page.id !== pageId)
        .flatMap((page) =>
          page.slots.flatMap((slot) =>
            slot?.kind === 'owned' ? [unitKey(slot)] : [],
          ),
        ),
    ),
  );
  return state.holdings.flatMap((holding) => {
    const units: OwnedSlot[] = pageId
      ? state.binders.flatMap((binder) =>
          binder.pages
            .filter((page) => page.id === pageId)
            .flatMap((page) =>
              page.slots.flatMap((slot) =>
                slot?.kind === 'owned' && slot.holdingId === holding.id
                  ? [{ ...slot, locked: false }]
                  : [],
              ),
            ),
        )
      : [];
    for (
      let copy = 1;
      copy <= holding.quantity - holding.tradeQuantity && units.length < 9;
      copy++
    ) {
      if (
        !used.has(`${holding.id}:${copy}`) &&
        !units.some((unit) => unit.copy === copy)
      )
        units.push({
          kind: 'owned',
          holdingId: holding.id,
          copy,
          locked: false,
        });
    }
    return units;
  });
}
export function freeCount(state: PersonalState, holding: Holding): number {
  return (
    holding.quantity -
    holding.tradeQuantity -
    locations(state, holding.id).length
  );
}

export function validateState(input: unknown): PersonalState {
  const state = personalStateSchema.parse(input);
  const unique = (values: string[], message: string) => {
    if (new Set(values).size !== values.length) throw new Error(message);
  };
  unique(
    state.holdings.map((item) => item.id),
    'Doppelte Bestandseinträge.',
  );
  unique(
    state.binders.map((item) => item.id),
    'Doppelte Binder.',
  );
  unique(
    state.binders.flatMap((item) => item.pages.map((page) => page.id)),
    'Doppelte Seiten.',
  );
  unique(
    state.wishes.map((item) => item.id),
    'Doppelte Wunsch-Einträge.',
  );
  unique(
    state.captures.map((item) => item.id),
    'Doppelte Foto-Einträge.',
  );
  const copies = new Set<string>();
  for (const holding of state.holdings) {
    if (holding.tradeQuantity > holding.quantity)
      throw new Error('Die Tauschmenge ist größer als dein Bestand.');
    if (holding.finish === 'other' && !holding.variantNote)
      throw new Error('Beschreibe die andere Druckvariante.');
  }
  const printingKeys = state.holdings.map(
    (holding) =>
      `${holding.card.language}:${normalize(holding.card.setName)}:${numberKey(holding.card.number)}:${holding.finish}:${normalize(holding.variantNote)}`,
  );
  unique(
    printingKeys,
    'Eine Ausgabe ist mehrfach eingetragen. Mengen vor der Übernahme klären.',
  );
  unique(
    state.holdings.map(
      (holding) =>
        `${holding.card.language}:${holding.card.key}:${holding.finish}:${normalize(holding.variantNote)}`,
    ),
    'Eine Katalogausgabe ist mehrfach eingetragen. Mengen vor der Übernahme klären.',
  );
  for (const binder of state.binders)
    for (const page of binder.pages)
      for (const slot of page.slots) {
        if (slot?.kind !== 'owned') continue;
        const holding = state.holdings.find(
          (item) => item.id === slot.holdingId,
        );
        if (!holding || slot.copy > holding.quantity - holding.tradeQuantity)
          throw new Error(
            'Ein belegtes Exemplar ist nicht verfügbar. Gib zuerst seinen Binderplatz oder die Tauschreservierung frei.',
          );
        const key = unitKey(slot);
        if (copies.has(key))
          throw new Error(
            'Ein physisches Exemplar kann nur einen Binderplatz belegen.',
          );
        copies.add(key);
      }
  return state;
}

export function changeState(
  state: PersonalState,
  change: (next: PersonalState) => void,
): PersonalState {
  const next = structuredClone(state);
  change(next);
  next.revision = state.revision + 1;
  return validateState(next);
}

export function confirmHolding(
  state: PersonalState,
  values: Omit<Holding, 'id' | 'createdAt' | 'updatedAt' | 'confirmed'>,
  captureId?: string,
): PersonalState {
  return changeState(state, (next) => {
    const capture = captureId
      ? next.captures.find((item) => item.id === captureId)
      : undefined;
    if (captureId && (!capture || capture.status === 'confirmed'))
      throw new Error(
        'Dieses Foto wurde bereits übernommen oder ist nicht mehr vorhanden.',
      );
    const existing = next.holdings.find(
      (item) =>
        sameCard(item.card, values.card) &&
        item.finish === values.finish &&
        normalize(item.variantNote) === normalize(values.variantNote),
    );
    const now = new Date().toISOString();
    const holding: Holding = {
      ...values,
      id: existing?.id ?? uid(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      confirmed: true,
    };
    if (existing) next.holdings[next.holdings.indexOf(existing)] = holding;
    else next.holdings.push(holding);
    if (capture) {
      capture.status = 'confirmed';
      capture.holdingId = holding.id;
    }
  });
}

export function correctHolding(
  state: PersonalState,
  holdingId: string,
  values: Pick<Holding, 'card' | 'finish' | 'variantNote' | 'quantity'>,
  captureId?: string,
): PersonalState {
  return changeState(state, (next) => {
    const holding = next.holdings.find((item) => item.id === holdingId);
    if (!holding)
      throw new Error('Der Bestandseintrag ist nicht mehr vorhanden.');
    Object.assign(holding, values, { updatedAt: new Date().toISOString() });
    for (const binder of next.binders)
      for (const page of binder.pages)
        if (
          page.slots.some(
            (slot) => slot?.kind === 'owned' && slot.holdingId === holdingId,
          )
        ) {
          page.assembled = false;
          delete page.assembledAt;
        }
    if (captureId) {
      const capture = next.captures.find((item) => item.id === captureId);
      if (!capture || capture.status === 'confirmed')
        throw new Error(
          'Dieses Foto wurde bereits übernommen oder ist nicht mehr vorhanden.',
        );
      capture.status = 'confirmed';
      capture.holdingId = holdingId;
    }
  });
}

export function createBinder(
  state: PersonalState,
  name: string,
): PersonalState {
  return changeState(state, (next) => {
    const page = {
      id: uid(),
      title: 'Seite 1',
      slots: emptySlots(),
      assembled: false,
    };
    const binder = { id: uid(), name: name.trim(), pages: [page] };
    next.binders.push(binder);
    next.lastBinderId = binder.id;
    next.lastPageId = page.id;
  });
}
export function setPageLayout(
  state: PersonalState,
  pageId: string,
  slots: Slot[],
): PersonalState {
  const previous = findPage(state, pageId);
  for (const [index, slot] of previous.slots.entries()) {
    if (slot?.locked && JSON.stringify(slot) !== JSON.stringify(slots[index]))
      throw new Error('Ein festgehaltener Platz darf nicht verändert werden.');
  }
  return changeState(state, (next) => {
    const page = findPage(next, pageId);
    page.slots = structuredClone(slots);
    page.assembled = false;
    delete page.assembledAt;
  });
}
export function placeUnit(
  state: PersonalState,
  pageId: string,
  index: number,
  unit: OwnedSlot,
): PersonalState {
  if (index < 0 || index > 8) throw new Error('Ungültiger Binderplatz.');
  const page = findPage(state, pageId);
  const slots = structuredClone(page.slots);
  const source = slots.findIndex(
    (slot) => slot?.kind === 'owned' && unitKey(slot) === unitKey(unit),
  );
  if (source === index) return state;
  if (source >= 0) slots[source] = slots[index] ?? null;
  slots[index] = { ...unit, locked: false };
  return setPageLayout(state, pageId, slots);
}
export function swapSlots(
  state: PersonalState,
  pageId: string,
  a: number,
  b: number,
): PersonalState {
  if (![a, b].every((index) => index >= 0 && index <= 8))
    throw new Error('Ungültiger Binderplatz.');
  const slots = structuredClone(findPage(state, pageId).slots);
  [slots[a], slots[b]] = [slots[b] ?? null, slots[a] ?? null];
  return setPageLayout(state, pageId, slots);
}
export function addWish(
  state: PersonalState,
  card: PersonalCard,
): PersonalState {
  return changeState(state, (next) => {
    if (next.wishes.some((wish) => sameCard(wish.card, card)))
      throw new Error('Diese Ausgabe steht bereits auf deiner Wunschliste.');
    next.wishes.push({
      id: uid(),
      card,
      quantity: 1,
      priority: 'normal',
      notes: '',
    });
  });
}
export function templateSlots(
  state: PersonalState,
  cards: PersonalCard[],
): Slot[] {
  const units = availableUnits(state);
  const used = new Set<string>();
  return cards.slice(0, 9).map((card) => {
    const unit = units.find(
      (candidate) =>
        !used.has(unitKey(candidate)) &&
        sameCard(
          state.holdings.find((item) => item.id === candidate.holdingId)!.card,
          card,
        ),
    );
    if (unit) {
      used.add(unitKey(unit));
      return unit;
    }
    return { kind: 'planned', card, locked: false };
  });
}
