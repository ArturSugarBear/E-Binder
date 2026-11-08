import {
  availableUnits,
  cardForSlot,
  findPage,
  normalize,
  numberKey,
  unitKey,
  type OwnedSlot,
  type PersonalCard,
  type PersonalState,
  type Slot,
} from './personal';

export interface Preferences {
  goal: 'story' | 'visual' | 'artist';
  artist: string;
  anchorId?: string;
  anchorSlot: number;
  excludedIds: string[];
  allowRepeats: boolean;
}
export interface Suggestion {
  id: string;
  title: string;
  description: string;
  slots: Slot[];
  filled: number;
  relations: number;
}

const species = (name: string) => normalize(name.replace(/[- ]?ex$/i, ''));
export function isEvolution(a: PersonalCard, b: PersonalCard): boolean {
  return Boolean(b.evolvesFrom) && species(a.name) === species(b.evolvesFrom);
}
export function suggestPages(
  state: PersonalState,
  pageId: string,
  preferences: Preferences,
): Suggestion[] {
  if (
    !Number.isInteger(preferences.anchorSlot) ||
    preferences.anchorSlot < 0 ||
    preferences.anchorSlot > 8
  )
    throw new Error('Ungültiger Platz für die Pflichtkarte.');
  const page = findPage(state, pageId);
  const cards = new Map(
    state.holdings.map((holding) => [holding.id, holding.card]),
  );
  const card = (unit: OwnedSlot): PersonalCard => cards.get(unit.holdingId)!;
  let pool = availableUnits(state, pageId).filter(
    (unit) => !preferences.excludedIds.includes(unit.holdingId),
  );
  if (preferences.goal === 'artist') {
    if (!preferences.artist.trim())
      throw new Error('Wähle einen Illustrator aus deinem Bestand.');
    pool = pool.filter(
      (unit) =>
        card(unit).artistSource !== 'unknown' &&
        normalize(card(unit).artist) === normalize(preferences.artist),
    );
  }
  const forced = new Map<number, OwnedSlot>();
  for (const [index, slot] of page.slots.entries()) {
    if (!slot?.locked) continue;
    if (slot.kind !== 'owned')
      throw new Error(
        'Ein festgehaltener Platz ist noch geplant. Löse die Fixierung, bevor du nur eigene Karten vorschlagen lässt.',
      );
    const available = pool.find((unit) => unitKey(unit) === unitKey(slot));
    if (!available)
      throw new Error(
        'Eine fixierte Karte passt nicht zur Artist-Auswahl oder wurde ausgeschlossen. Passe die Auswahl oder die Fixierung an.',
      );
    forced.set(index, slot);
  }
  if (preferences.anchorId) {
    const anchor =
      [...forced.values()].find(
        (unit) => unit.holdingId === preferences.anchorId,
      ) ?? pool.find((unit) => unit.holdingId === preferences.anchorId);
    if (!anchor)
      throw new Error(
        'Deine Pflichtkarte ist für diese Auswahl nicht verfügbar.',
      );
    const existing = forced.get(preferences.anchorSlot);
    if (existing && unitKey(existing) !== unitKey(anchor))
      throw new Error(
        'Der gewünschte Platz ist bereits für eine andere Karte fixiert.',
      );
    const other = [...forced].find(
      ([index, unit]) =>
        index !== preferences.anchorSlot && unitKey(unit) === unitKey(anchor),
    );
    if (other)
      throw new Error(
        'Deine Pflichtkarte ist bereits an einem anderen Platz fixiert.',
      );
    forced.set(preferences.anchorSlot, { ...anchor, locked: true });
  }
  const motif = (unit: OwnedSlot) =>
    `${card(unit).language}:${normalize(card(unit).setName)}:${numberKey(card(unit).number)}`;
  if (
    !preferences.allowRepeats &&
    new Set([...forced.values()].map(motif)).size !== forced.size
  )
    throw new Error(
      'Mehrere fixierte Plätze zeigen dasselbe Motiv. Erlaube bewusste Wiederholungen oder löse eine Fixierung.',
    );
  const forcedKeys = new Set([...forced.values()].map(unitKey));
  if (!preferences.allowRepeats) {
    const seen = new Set([...forced.values()].map(motif));
    pool = [
      ...forced.values(),
      ...pool.filter((unit) => {
        if (forcedKeys.has(unitKey(unit)) || seen.has(motif(unit)))
          return false;
        seen.add(motif(unit));
        return true;
      }),
    ];
  }
  pool = [...new Map(pool.map((unit) => [unitKey(unit), unit])).values()];
  if (!pool.length)
    throw new Error(
      'Für diese Auswahl sind noch keine freien, bestätigten Karten vorhanden.',
    );
  const stable = (a: OwnedSlot, b: OwnedSlot) =>
    card(a).key.localeCompare(card(b).key) ||
    unitKey(a).localeCompare(unitKey(b));
  pool.sort(stable);
  const choose = (order: OwnedSlot[]) =>
    [
      ...new Map(
        [...forced.values(), ...order].map((unit) => [unitKey(unit), unit]),
      ).values(),
    ].slice(0, 9);

  // Relationships come from explicit evolution metadata, never from shared colours.
  const bySpecies = new Map<string, OwnedSlot[]>();
  const children = new Map<string, OwnedSlot[]>();
  const favorites = new Set(
    state.holdings
      .filter((holding) => holding.favorite)
      .map((holding) => holding.id),
  );
  for (const unit of pool) {
    const name = species(card(unit).name);
    bySpecies.set(name, [...(bySpecies.get(name) ?? []), unit]);
    if (card(unit).evolvesFrom) {
      const parent = species(card(unit).evolvesFrom);
      children.set(parent, [...(children.get(parent) ?? []), unit]);
    }
  }
  const incoming = (unit: OwnedSlot) =>
    (bySpecies.get(species(card(unit).evolvesFrom)) ?? []).some(
      (parent) => unitKey(parent) !== unitKey(unit),
    );
  const story: OwnedSlot[] = [];
  const visited = new Set<string>();
  const roots = pool
    .filter((unit) => !incoming(unit))
    .sort(
      (a, b) =>
        Number(children.has(species(card(b).name))) -
          Number(children.has(species(card(a).name))) ||
        Number(favorites.has(b.holdingId)) -
          Number(favorites.has(a.holdingId)) ||
        stable(a, b),
    );
  for (const root of [...roots, ...pool]) {
    const stack = [root];
    while (stack.length) {
      const unit = stack.pop()!;
      if (visited.has(unitKey(unit))) continue;
      visited.add(unitKey(unit));
      story.push(unit);
      stack.push(
        ...[...(children.get(species(card(unit).name)) ?? [])]
          .reverse()
          .filter((child) => !visited.has(unitKey(child))),
      );
    }
  }

  const known = pool.filter((unit) => card(unit).palette);
  const distance = (a: OwnedSlot, b: OwnedSlot) => {
    const x = card(a).palette;
    const y = card(b).palette;
    if (!x || !y) return 2;
    const delta = Math.abs(x.hue - y.hue);
    return (
      Math.min(delta, 360 - delta) / 180 +
      Math.abs(x.lightness - y.lightness) / 2
    );
  };
  let visual = [...pool];
  if (known.length) {
    const seeds = known.slice(0, 120);
    const cost = (candidate: OwnedSlot) => {
      const nearest: number[] = [];
      for (const unit of pool) {
        const value = distance(candidate, unit);
        if (nearest.length === 9 && value >= nearest[8]!) continue;
        nearest.push(value);
        nearest.sort((a, b) => a - b);
        if (nearest.length > 9) nearest.pop();
      }
      return nearest.reduce((sum, value) => sum + value, 0);
    };
    let seed = seeds[0]!;
    let bestCost = cost(seed);
    for (const candidate of seeds.slice(1)) {
      const value = cost(candidate);
      if (value < bestCost) {
        seed = candidate;
        bestCost = value;
      }
    }
    visual.sort(
      (a, b) => distance(seed, a) - distance(seed, b) || stable(a, b),
    );
  }
  visual = choose(visual).sort(
    (a, b) =>
      (card(a).palette?.hue ?? 999) - (card(b).palette?.hue ?? 999) ||
      stable(a, b),
  );
  const artistCounts = new Map<string, number>();
  for (const unit of pool) {
    const artist = card(unit).artist || '\uffff';
    if (artist === '\uffff') continue;
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
  }
  const artistOrder = [...pool].sort((a, b) => {
    const x = card(a).artist || '\uffff';
    const y = card(b).artist || '\uffff';
    return (
      (artistCounts.get(y) ?? 0) - (artistCounts.get(x) ?? 0) ||
      x.localeCompare(y) ||
      stable(a, b)
    );
  });

  const fit = (order: OwnedSlot[]): Slot[] => {
    const slots: Slot[] = Array.from({ length: 9 }, () => null);
    const used = new Set<string>();
    for (const [index, unit] of forced) {
      slots[index] = { ...unit };
      used.add(unitKey(unit));
    }
    const remaining = choose(order).filter((unit) => !used.has(unitKey(unit)));
    for (let index = 0; index < 9; index++)
      if (!slots[index]) slots[index] = remaining.shift() ?? null;
    return slots;
  };
  const relationCount = (slots: Slot[]) =>
    slots.reduce((sum, slot, index) => {
      if (index % 3 === 2) return sum;
      const a = cardForSlot(state, slot);
      const b = cardForSlot(state, slots[index + 1] ?? null);
      return sum + (a && b && isEvolution(a, b) ? 1 : 0);
    }, 0);
  const visualCost = (slots: Slot[]) =>
    slots.reduce((sum, slot, index) => {
      if (
        index >= 6 ||
        slot?.kind !== 'owned' ||
        slots[index + 3]?.kind !== 'owned'
      )
        return sum;
      return sum + distance(slot, slots[index + 3] as OwnedSlot);
    }, 0);
  const selectedStory = choose(story);
  const groups: OwnedSlot[][] = [];
  for (const unit of selectedStory) {
    const previous = groups.at(-1);
    if (
      previous &&
      previous.length < 3 &&
      isEvolution(card(previous.at(-1)!), card(unit))
    )
      previous.push(unit);
    else groups.push([unit]);
  }
  const rows: OwnedSlot[][] = [[], [], []];
  for (const group of [...groups].sort((a, b) => b.length - a.length)) {
    const row = rows.find((item) => item.length + group.length <= 3);
    if (row) row.push(...group);
    else
      for (const unit of group)
        rows.find((item) => item.length < 3)?.push(unit);
  }
  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const storyLayouts = permutations.map((order) =>
    fit(order.flatMap((index) => rows[index]!)),
  );
  storyLayouts.sort(
    (a, b) =>
      relationCount(b) - relationCount(a) || visualCost(a) - visualCost(b),
  );
  const recipes = [
    {
      id: 'story',
      title: 'Zusammengehörig',
      slots: storyLayouts[0]!,
      reason: 'Belegte Entwicklungsbeziehungen zuerst.',
    },
    {
      id: 'visual',
      title: 'Farben im Fluss',
      slots: fit(visual),
      reason: known.length
        ? 'Gemessene Bildfarben bestimmen Auswahl und Reihenfolge.'
        : 'Noch keine auswertbaren Bildfarben. Diese Anordnung folgt der Kartenauswahl.',
    },
    {
      id: 'artists',
      title: 'Artist-Gruppen',
      slots: fit(choose(artistOrder)),
      reason: artistCounts.size
        ? 'Bekannte Illustrator-Credits werden gruppiert.'
        : 'Noch keine Illustrator-Credits belegt. Du kannst die Auswahl frei anpassen.',
    },
  ];
  if (preferences.goal === 'visual') recipes.unshift(recipes.splice(1, 1)[0]!);
  const signatures = new Set<string>();
  return recipes.flatMap((recipe) => {
    const signature = recipe.slots
      .map((slot) => (slot?.kind === 'owned' ? unitKey(slot) : '-'))
      .join('|');
    if (signatures.has(signature)) return [];
    signatures.add(signature);
    const filled = recipe.slots.filter(Boolean).length;
    const relations = relationCount(recipe.slots);
    const explanation =
      recipe.id === 'story'
        ? relations
          ? `${relations} Entwicklungsschritte bleiben in Leserichtung benachbart.`
          : 'Keine benachbarten Entwicklungsbeziehungen belegt; du kannst die Reihenfolge frei anpassen.'
        : recipe.reason;
    return [
      {
        id: recipe.id,
        title: recipe.title,
        slots: recipe.slots,
        filled,
        relations,
        description: `${explanation}${preferences.goal === 'artist' ? ` Nur ${preferences.artist}.` : ''}${filled < 9 ? ` ${9 - filled} Plätze bleiben frei.` : ''}`,
      },
    ];
  });
}
