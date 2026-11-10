import {
  catalogEntry,
  catalogResumeCard,
  catalogSetCards,
  catalogSetFacets,
  catalogSets,
  catalogSeries,
  catalogSeriesSets,
  catalogValues,
  fillCatalogImages,
  searchCatalog,
  type CatalogEntry,
  type CatalogResult,
  type CatalogSet,
} from '../data/card-catalog';
import {
  normalize,
  numberKey,
  sameCard,
  type PersonalCard,
} from '../domain/personal';
import {
  action,
  choices,
  el,
  errorText,
  field,
  input,
  message,
  select,
} from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';
import { createRarityGuide } from './rarity-guide';
import { verifiedLocalArt } from '../data/verified-images';
import '../catalog.css';

export interface CatalogBrowserState {
  setId: string;
  artist: string;
  rarity: string;
  order: string;
  query: string;
  page: number;
  series: string;
  setQuery: string;
}
type Options = {
  ctx: WorkspaceContext;
  initial?: Partial<CatalogBrowserState>;
  standalone?: boolean;
  onStateChange?: (state: CatalogBrowserState) => void;
  search: HTMLInputElement;
  language: { value: string };
  results: HTMLElement;
  artist?: string;
  browse?: boolean;
  setId?: string;
  onChoose: (card: PersonalCard, entry: CatalogEntry) => void;
  onSearch: (reset?: boolean) => void;
  tell: (text: string, error?: boolean) => void;
};
const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});
export function createCatalogBrowser(options: Options) {
  const { ctx, search, language, results, tell } = options;
  const initial = options.initial ?? {};
  if (initial.query !== undefined) search.value = initial.query;
  const set = select([['', 'Alle Sets']], initial.setId ?? options.setId ?? '');
  const artist = input('search', initial.artist ?? options.artist ?? '');
  artist.placeholder = 'Illustrator suchen';
  artist.autocomplete = 'off';
  const suggestions = el('datalist');
  suggestions.id = `catalog-artists-${crypto.randomUUID()}`;
  artist.setAttribute('list', suggestions.id);
  const rarity = select([['', 'Alle Seltenheiten']]);
  const order = choices(
    'Katalog sortieren',
    [
      ['number', 'Kartennummer'],
      ['name', 'Name'],
      ['price-asc', 'Preis: niedrig zuerst'],
      ['price-desc', 'Preis: hoch zuerst'],
    ],
    initial.order ?? 'number',
  );
  const series = select([['', 'Alle Reihen']], '');
  const setSearch = input('search');
  setSearch.value = initial.setQuery ?? '';
  setSearch.placeholder = 'z. B. Ewige Rivalen / Destined Rivals';
  const sets = el('div', 'w-set-grid');
  const loadStatus = el('div', 'w-catalog-status');
  loadStatus.setAttribute('aria-live', 'polite');
  const browse = el(
    'details',
    'w-catalog-discovery',
    el(
      'summary',
      '',
      options.standalone
        ? 'Alle Sets und Reihen'
        : 'Sets und Illustratoren entdecken',
    ),
    el(
      'div',
      'w-set-browse-controls',
      field('Reihe / Ära', series),
      field('Set suchen', setSearch),
    ),
    sets,
    loadStatus,
  );
  const controls = el(
    'div',
    'w-catalog-filters',
    field('Set', set),
    field('Illustrator im Katalog', artist),
    suggestions,
    field('Seltenheit', rarity),
    order.element,
  );
  const selectedSet = el('div', 'w-selected-set');
  const scopeStatus = el('div', 'w-set-filter-status');
  scopeStatus.setAttribute('aria-live', 'polite');
  const rarityGuide = createRarityGuide(ctx, (card) => {
    const signal = active ?? lifetime.signal;
    tell('Genaue Ausgabe wird geladen …');
    void catalogEntry(card.sourceId, card.language, signal)
      .then((detail) => {
        if (!closed && !signal.aborted) options.onChoose(detail.card, detail);
      })
      .catch((error) => {
        if (!closed && !signal.aborted) tell(errorText(error), true);
      });
  });
  const pager = el('div', 'w-catalog-pager');
  const priceNotice = message(
    'Preise sind Cardmarket-Katalogtrends in EUR mit Datenstand, keine Bewertung deiner Sprach-, Zustands- oder Druckvariante. Fehlende Preise stehen am Ende.',
  );
  priceNotice.hidden = true;
  const filterSummary = el('summary', '', 'Filtern & sortieren');
  const filterPanel = el(
    'details',
    'w-catalog-filter-panel',
    filterSummary,
    controls,
    rarityGuide.element,
  );
  const element = el(
    'section',
    'w-catalog-browser',
    selectedSet,
    browse,
    options.standalone ? filterPanel : controls,
    scopeStatus,
    options.standalone ? null : rarityGuide.element,
    priceNotice,
  );
  let page = initial.page ?? 1;
  let setLimit = 24;
  let seriesMembers: Set<string> | undefined;
  let seriesRequest: AbortController | undefined;
  let inventory: CatalogSet[] = [];
  let initialized = false;
  let metadataLanguage = '';
  let metadata: Promise<void> | undefined;
  let active: AbortSignal | undefined;
  let closed = false;
  let debounce: ReturnType<typeof setTimeout>;
  const lifetime = new AbortController();
  const pricing = new Map<string, CatalogEntry[]>();
  const visibleCards = new Map<string, PersonalCard>();
  let globalArtists: string[] = [];
  let globalRarities: string[] = [];
  let scopeKey = '';
  let setFacets: Awaited<ReturnType<typeof catalogSetFacets>> | undefined;
  function state(): CatalogBrowserState {
    return {
      setId: set.value,
      artist: artist.value,
      rarity: rarity.value,
      order: order.value,
      query: search.value,
      page,
      series: series.value,
      setQuery: setSearch.value,
    };
  }
  async function loadSeries(): Promise<void> {
    seriesRequest?.abort();
    const controller = new AbortController();
    seriesRequest = controller;
    setLimit = 24;
    try {
      const members = series.value
        ? new Set(
            await catalogSeriesSets(
              series.value,
              language.value,
              AbortSignal.any([controller.signal, lifetime.signal]),
            ),
          )
        : undefined;
      if (closed || controller.signal.aborted) return;
      seriesMembers = members;
      renderSets();
    } catch {
      if (controller.signal.aborted || closed) return;
      series.value = '';
      seriesMembers = undefined;
      renderSets();
      loadStatus.replaceChildren(
        message(
          'Diese Kartenreihe konnte nicht geladen werden. Alle Sets bleiben erreichbar.',
        ),
      );
    }
  }
  function refresh(): void {
    for (const marker of results.querySelectorAll<HTMLElement>(
      '[data-catalog-status]',
    )) {
      const card = visibleCards.get(marker.dataset.catalogStatus ?? '');
      if (!card) continue;
      const own = ctx.state.holdings
        .filter((item) => sameCard(item.card, card))
        .reduce((total, item) => total + item.quantity, 0);
      const wish = ctx.state.wishes.some((item) => sameCard(item.card, card));
      marker.textContent = `${own ? `${own}× im ${ctx.state.mode === 'demo' ? 'Demo-' : ''}Bestand` : ''}${own && wish ? ' · ' : ''}${wish ? 'Gemerkt' : ''}`;
      marker.hidden = !own && !wish;
    }
  }
  function updateFilterSummary(): void {
    const labels = [
      artist.value.trim(),
      rarity.value,
      order.value !== 'number'
        ? order.options.find((option) => option.checked)?.parentElement
            ?.textContent
        : '',
    ].filter(Boolean);
    filterSummary.replaceChildren(el('span', '', 'Filtern & sortieren'));
    if (labels.length)
      filterSummary.append(el('small', '', labels.join(' · ')));
  }
  function updateSet(): void {
    for (const option of order.options)
      if (option.value.startsWith('price')) option.disabled = !set.value;
    if (!set.value && order.value.startsWith('price')) order.value = 'number';
    updateFilterSummary();
    selectedSet.replaceChildren();
    const current = inventory.find((item) => item.id === set.value);
    if (!current) return;
    const icon = setIcon(current);
    const ownedEditions = editionsInSet(current.id);
    const info = el(
      'span',
      '',
      el('strong', '', current.name),
      el(
        'small',
        'w-muted',
        `${current.alias && current.alias !== current.name ? `${current.alias} · ` : ''}${current.cardCount.total ?? current.cardCount.official} Karten · ${language.value.toUpperCase()}`,
      ),
    );
    if (ownedEditions)
      info.append(
        el(
          'small',
          'w-set-owned-note',
          `${ownedEditions} verschiedene Ausgaben im ${ctx.state.mode === 'demo' ? 'Demo-' : ''}Bestand`,
        ),
      );
    if (ownedEditions && current.cardCount.official) {
      const meter = el('progress', 'w-set-progress') as HTMLProgressElement;
      meter.max = current.cardCount.official;
      meter.value = Math.min(ownedEditions, meter.max);
      meter.setAttribute(
        'aria-label',
        `${ownedEditions} von ${meter.max} Setpositionen`,
      );
      info.append(meter);
    }
    selectedSet.append(
      icon,
      info,
      ...(current.id === 'me06'
        ? [
            el(
              'a',
              'w-set-official-link',
              'Delta-Herrschaft: 141 Karten mit Bildern ansehen',
            ),
          ]
        : []),
      action(
        'Setfilter entfernen',
        () => {
          set.value = '';
          scopeKey = '';
          setFacets = undefined;
          rarityGuide.update(undefined, '');
          applyFilterChoices(globalRarities, globalArtists);
          scopeStatus.replaceChildren();
          browse.open = true;
          updateSet();
          options.onSearch();
        },
        'text',
      ),
    );
    if (current.id === 'me06') {
      const reference = selectedSet.querySelector<HTMLAnchorElement>(
        '.w-set-official-link',
      );
      if (reference) {
        reference.href =
          'https://www.bisafans.de/sammelkarten/sets/me/delta-herrschaft/galerie.php';
        reference.target = '_blank';
        reference.rel = 'noopener noreferrer';
        reference.title =
          'Externe Kartengalerie (Bisafans). E-Binder übernimmt keine fremden Bilder.';
      }
    }
  }
  function setIcon(item: CatalogSet): HTMLElement {
    const icon = el('span', 'w-set-symbol', item.id.toUpperCase());
    const sources = [item.logo, item.symbol].filter((value): value is string =>
      Boolean(value),
    );
    const image = el('img');
    image.alt = '';
    image.loading = 'lazy';
    let index = 0;
    const next = () => {
      while (index < sources.length) {
        const base = sources[index++]!;
        try {
          const url = new URL(base);
          if (url.protocol !== 'https:' || url.hostname !== 'assets.tcgdex.net')
            continue;
          image.src = `${base}.webp`;
          icon.replaceChildren(image);
          return;
        } catch {
          // Ignore invalid provider URLs; never load an arbitrary host.
        }
      }
      image.remove();
      icon.textContent = item.id.toUpperCase();
      if (item.id === 'me06') icon.classList.add('w-set-me06-identity');
    };
    image.addEventListener('error', next);
    next();
    return icon;
  }
  function editionsInSet(setId: string): number {
    return new Set(
      ctx.state.holdings
        .filter(
          (holding) =>
            holding.card.setId === setId &&
            holding.card.language === language.value,
        )
        .map((holding) => holding.card.sourceId || holding.card.key),
    ).size;
  }
  function renderSets(): void {
    sets.replaceChildren();
    const query = normalize(setSearch.value);
    const matching = [...inventory]
      .reverse()
      .filter((item) => !seriesMembers || seriesMembers.has(item.id))
      .filter((item) =>
        normalize(`${item.id} ${item.name} ${item.alias ?? ''}`).includes(
          query,
        ),
      );
    for (const item of matching.slice(0, setLimit)) {
      const button = action(
        item.name,
        () => {
          set.value = item.id;
          search.value = '';
          updateSet();
          browse.open = false;
          options.onSearch();
        },
        'secondary',
      );
      button.classList.add('w-set-choice');
      const label = el(
        'span',
        '',
        el('strong', '', item.name),
        el(
          'small',
          'w-muted',
          `${item.id.toUpperCase()} · ${item.cardCount.total ?? item.cardCount.official} Karten`,
        ),
      );
      if (options.standalone) {
        const ownedEditions = editionsInSet(item.id);
        if (ownedEditions) {
          label.append(
            el(
              'small',
              'w-set-owned-note',
              `${ownedEditions} Ausgaben gesammelt`,
            ),
          );
          if (item.cardCount.official) {
            const meter = el(
              'progress',
              'w-set-progress',
            ) as HTMLProgressElement;
            meter.max = item.cardCount.official;
            meter.value = Math.min(ownedEditions, meter.max);
            meter.setAttribute(
              'aria-label',
              `${ownedEditions} von ${meter.max} Setpositionen`,
            );
            label.append(meter);
          }
        }
      }
      button.replaceChildren(setIcon(item), label);
      sets.append(button);
    }
    if (!matching.length)
      sets.append(
        message(
          'Kein passendes Set in dieser Katalogsprache. Versuche den Namen, die Setkennung oder eine andere Sprache.',
        ),
      );
    else {
      if (matching.length > setLimit)
        sets.append(
          action(
            `Weitere Sets anzeigen (${matching.length - setLimit})`,
            () => {
              const firstNew = setLimit;
              setLimit += 24;
              renderSets();
              sets
                .querySelectorAll<HTMLButtonElement>('.w-set-choice')
                .item(firstNew)
                ?.focus();
            },
            'secondary',
          ),
        );
      sets.append(
        el(
          'p',
          'w-muted',
          `${matching.length} Sets${series.value ? ' in dieser Reihe' : ' verfügbar'}. Suche auch nach englischen Setnamen.`,
        ),
      );
    }
  }
  async function loadMetadata(): Promise<void> {
    if (metadataLanguage === language.value && metadata) return metadata;
    metadataLanguage = language.value;
    const lang = language.value;
    const desiredSet = initialized
      ? set.value
      : initial.setId || options.setId || '';
    const desiredRarity = initialized ? rarity.value : initial.rarity || '';
    const desiredSeries = initialized ? series.value : initial.series || '';
    initialized = true;
    loadStatus.replaceChildren(
      message('Sets und Katalogfilter werden geladen …'),
    );
    metadata = (async () => {
      const data = await Promise.allSettled([
        catalogSets(lang, lifetime.signal),
        catalogValues(lang, 'illustrators', lifetime.signal),
        catalogValues(lang, 'rarities', lifetime.signal),
        catalogSeries(lang, lifetime.signal),
      ]);
      if (closed || lang !== language.value) return;
      const [setResult, artistsResult, raritiesResult, seriesResult] = data;
      if (setResult!.status === 'fulfilled') {
        inventory = setResult!.value as CatalogSet[];
        set.replaceChildren(el('option', '', 'Alle Sets'));
        set.options[0]!.value = '';
        for (const item of [...inventory].reverse()) {
          const option = el('option', '', item.name);
          option.value = item.id;
          set.append(option);
        }
        set.value = inventory.some((item) => item.id === desiredSet)
          ? desiredSet
          : '';
        renderSets();
        updateSet();
      }
      if (artistsResult!.status === 'fulfilled') {
        globalArtists = artistsResult!.value as string[];
        suggestions.replaceChildren(
          ...(artistsResult!.value as string[]).map((name) => {
            const option = el('option');
            option.value = name;
            return option;
          }),
        );
      }
      if (raritiesResult!.status === 'fulfilled') {
        globalRarities = raritiesResult!.value as string[];
        const selected = desiredRarity;
        rarity.replaceChildren(el('option', '', 'Alle Seltenheiten'));
        rarity.options[0]!.value = '';
        for (const name of raritiesResult!.value as string[]) {
          const option = el('option', '', name);
          option.value = name;
          rarity.append(option);
        }
        rarity.value = [...rarity.options].some(
          (item) => item.value === selected,
        )
          ? selected
          : '';
      }
      if (seriesResult?.status === 'fulfilled') {
        series.replaceChildren(el('option', '', 'Alle Reihen'));
        series.options[0]!.value = '';
        for (const item of seriesResult.value as {
          id: string;
          name: string;
        }[]) {
          const option = el('option', '', item.name);
          option.value = item.id;
          series.append(option);
        }
        series.value = desiredSeries;
        if (series.value) await loadSeries();
      }
      const failed = data.some((item) => item.status === 'rejected');
      loadStatus.replaceChildren(
        ...(failed
          ? [
              message(
                'Einige Katalogfilter sind nicht erreichbar. Suche und manuelle Erfassung bleiben verfügbar.',
              ),
              action(
                'Filter erneut laden',
                () => {
                  metadataLanguage = '';
                  void loadMetadata();
                },
                'text',
              ),
            ]
          : []),
      );
    })();
    return metadata;
  }
  function applyFilterChoices(rarities: string[], artists: string[]) {
    const chosen = rarity.value;
    rarity.replaceChildren(el('option', '', 'Alle Seltenheiten'));
    rarity.options[0]!.value = '';
    for (const name of rarities) {
      const option = el('option', '', name);
      option.value = name;
      rarity.append(option);
    }
    rarity.value = rarities.includes(chosen) ? chosen : '';
    suggestions.replaceChildren(
      ...artists.map((name) => {
        const option = el('option');
        option.value = name;
        return option;
      }),
    );
    rarity.disabled = false;
    artist.disabled = false;
  }
  async function syncSetFilters(signal: AbortSignal): Promise<void> {
    const id = set.value;
    const lang = language.value;
    const key = `${lang}:${id}`;
    if (scopeKey === key) return;
    scopeKey = '';
    setFacets = undefined;
    rarityGuide.update(undefined, '');
    if (!id) {
      applyFilterChoices(globalRarities, globalArtists);
      scopeKey = key;
      scopeStatus.replaceChildren();
      return;
    }
    rarity.disabled = true;
    artist.disabled = true;
    scopeStatus.replaceChildren(
      message('Seltenheiten und Illustratoren dieses Sets werden geladen …'),
    );
    try {
      const facets = await catalogSetFacets(id, lang, signal);
      if (
        closed ||
        signal.aborted ||
        active !== signal ||
        language.value !== lang ||
        set.value !== id
      )
        return;
      const previousRarity = rarity.value;
      const previousArtist = artist.value.trim();
      const rarities = [
        ...new Set(facets.cards.map((card) => card.rarity).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b));
      const artists = [
        ...new Set(facets.cards.map((card) => card.artist).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b));
      applyFilterChoices(rarities, artists);
      if (previousArtist)
        artist.value =
          artists.find(
            (name) => normalize(name) === normalize(previousArtist),
          ) ?? '';
      setFacets = facets;
      scopeKey = key;
      const pictured = facets.cards.filter((card) => card.image).length;
      const imageCoverage =
        pictured === 0 && facets.cards.length
          ? ' TCGdex liefert für diese Ausgaben derzeit keine Kartenbilder. Die Kartendaten werden als Liste angezeigt.'
          : ` ${pictured} von ${facets.cards.length} Ausgaben mit Katalogbild.`;
      const reset = [
        previousRarity && !rarity.value ? `„${previousRarity}“` : '',
        previousArtist && !artist.value ? `„${previousArtist}“` : '',
      ].filter(Boolean);
      scopeStatus.replaceChildren(
        message(
          facets.cards.length
            ? `${rarities.length} Seltenheiten und ${artists.length} Illustratoren im gewählten Set.${imageCoverage}${reset.length ? ` ${reset.join(' und ')} kommen hier nicht vor; diese Filter wurden zurückgesetzt.` : ''}`
            : 'Für dieses Set enthält der Katalog noch keine Karteneinträge. Seltenheiten und Illustratoren sind deshalb nicht verfügbar.',
        ),
      );
      rarity.disabled = !rarities.length;
      artist.disabled = !artists.length;
      rarityGuide.update(setFacets, rarity.value);
    } catch (error) {
      if (closed || signal.aborted || active !== signal) return;
      scopeStatus.replaceChildren(
        message(
          'Die Filter dieses Sets sind gerade nicht verfügbar. Deine Eingaben bleiben erhalten.',
          'error',
        ),
        action('Setfilter erneut laden', () => options.onSearch(false), 'text'),
      );
      if (rarity.value || artist.value.trim()) throw error;
    }
  }
  async function loadPrices(signal: AbortSignal): Promise<CatalogEntry[]> {
    const key = `${language.value}:${set.value}`;
    const cached = pricing.get(key);
    if (cached) return cached;
    const resumes = await catalogSetCards(set.value, language.value, signal);
    if (resumes.length > 600)
      throw new Error(
        'Dieses Set ist zu groß für einen vollständigen Preisvergleich im Browser. Nutze die Nummern- oder Namenssortierung.',
      );
    const entries: CatalogEntry[] = [];
    const group = new AbortController();
    const requestSignal = AbortSignal.any([signal, group.signal]);
    let next = 0,
      done = 0;
    const stop = action(
      'Preisvergleich abbrechen',
      () => {
        order.value = 'number';
        options.onSearch();
      },
      'text',
    );
    const progress = el(
      'p',
      'w-muted',
      `Preise werden geladen: 0 von ${resumes.length}`,
    );
    pager.replaceChildren(progress, stop);
    const workers = Array.from(
      { length: Math.min(4, resumes.length) },
      async () => {
        while (next < resumes.length) {
          if (signal.aborted)
            throw new DOMException('Abgebrochen', 'AbortError');
          const resume = resumes[next++]!;
          entries.push(
            await catalogEntry(
              resume.id,
              resume.language,
              requestSignal,
              false,
            ),
          );
          progress.textContent = `Preise werden geladen: ${++done} von ${resumes.length}`;
        }
      },
    );
    try {
      await Promise.all(workers);
    } catch (error) {
      group.abort();
      throw error;
    }
    if (!signal.aborted) pricing.set(key, entries);
    return entries;
  }
  function matchesFields(
    name: string,
    printedNumber: string,
    illustrator: string,
    entryRarity: string,
  ): boolean {
    const number = search.value
      .trim()
      .match(/^([A-Za-z]{0,4}\d+)(?:\s*\/\s*[A-Za-z]*\d+)?$/)?.[1];
    return (
      (!search.value.trim() ||
        (number
          ? numberKey(printedNumber.split('/')[0]!) === numberKey(number)
          : normalize(name).includes(normalize(search.value)))) &&
      (!artist.value.trim() ||
        normalize(illustrator) === normalize(artist.value)) &&
      (!rarity.value || entryRarity === rarity.value)
    );
  }
  function renderResult(
    result: CatalogResult,
    signal: AbortSignal,
    entry?: CatalogEntry,
  ): void {
    const card = entry?.card ?? catalogResumeCard(result);
    const button = action(
      card.name,
      () => {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        tell('Genaue Ausgabe wird geladen …');
        void (
          entry
            ? Promise.resolve(entry)
            : catalogEntry(result.id, result.language, signal)
        )
          .then((detail) => {
            if (!closed && !signal.aborted) {
              // A disabled button loses browser focus. Restore the opener before
              // the modal captures it, including when the request was cached.
              button.disabled = false;
              button.focus({ preventScroll: true });
              options.onChoose(detail.card, detail);
            }
          })
          .catch((error) => {
            if (!signal.aborted && !closed) tell(errorText(error), true);
          })
          .finally(() => {
            button.disabled = false;
            button.removeAttribute('aria-busy');
          });
      },
      'card',
    );
    button.setAttribute('aria-haspopup', 'dialog');
    const caption = el(
      'span',
      'w-card-caption',
      el('strong', '', card.name),
      el('small', '', `${card.setName} · ${card.number}`),
    );
    if (entry?.rarity) caption.append(el('small', 'w-muted', entry.rarity));
    if (priceNotice.hidden === false)
      caption.append(
        el(
          'small',
          'w-catalog-price',
          entry?.price
            ? `${euro.format(entry.price.amount)} · ${new Date(entry.price.updated).toLocaleDateString('de-DE')}`
            : 'Preis unbekannt',
        ),
      );
    button.dataset.focus = `catalog-${card.key}`;
    const owned = el('small', 'w-catalog-owned');
    owned.dataset.catalogStatus = card.key;
    visibleCards.set(card.key, card);
    caption.append(owned);
    if (card.image || verifiedLocalArt(card))
      button.replaceChildren(ctx.images.artwork(card), caption);
    else {
      button.classList.add('w-card-without-image');
      const placeholder = el(
        'span',
        'w-unpictured-card',
        el('small', '', `${card.setName} / ${card.number}`),
        el('strong', '', card.name),
        el('span', '', 'Abbildung noch nicht verfügbar'),
      );
      placeholder.setAttribute(
        'aria-label',
        `Für ${card.name} ist noch kein geprüftes Katalogbild verfügbar.`,
      );
      caption.append(el('small', 'w-muted', 'Ohne geprüftes Katalogbild'));
      button.replaceChildren(placeholder, caption);
    }
    results.append(button);
  }
  const previous = action(
    'Vorherige Karten',
    () => {
      page--;
      options.onSearch(false);
    },
    'secondary',
  );
  const next = action(
    'Weitere Karten',
    () => {
      page++;
      options.onSearch(false);
    },
    'secondary',
  );
  async function run(signal: AbortSignal, reset = true): Promise<void> {
    active = signal;
    if (reset) page = 1;
    options.onStateChange?.(state());
    pager.replaceChildren();
    priceNotice.hidden = !order.value.startsWith('price');
    tell('Kartenkatalog wird durchsucht …');
    await loadMetadata();
    if (signal.aborted || closed || active !== signal) return;
    updateSet();
    await syncSetFilters(signal);
    if (signal.aborted || closed || active !== signal) return;
    rarityGuide.update(setFacets, rarity.value);
    updateFilterSummary();
    options.onStateChange?.(state());
    let found: CatalogResult[];
    let prices: CatalogEntry[] | undefined;
    if (order.value.startsWith('price')) {
      if (!set.value) {
        tell(
          'Wähle zuerst ein Set für den vollständigen Preisvergleich.',
          true,
        );
        return;
      }
      const entries = (await loadPrices(signal))
        .filter((entry) =>
          matchesFields(
            entry.card.name,
            entry.card.number,
            entry.card.artist,
            entry.rarity,
          ),
        )
        .sort((a, b) => {
          if (!a.price)
            return b.price
              ? 1
              : a.card.number.localeCompare(b.card.number, undefined, {
                  numeric: true,
                });
          if (!b.price) return -1;
          return (
            (a.price.amount - b.price.amount) *
            (order.value === 'price-asc' ? 1 : -1)
          );
        });
      prices = entries.slice((page - 1) * 24, page * 24);
      found = await fillCatalogImages(
        prices.map((entry) => ({
          id: entry.card.sourceId,
          localId: entry.card.number.split('/')[0]!,
          name: entry.card.name,
          language: entry.card.language,
          image: entry.card.image
            ? entry.card.image.replace(/\/high\.webp$/, '')
            : undefined,
        })),
        signal,
      );
      prices.forEach((entry, index) => {
        if (!entry.card.image && found[index]?.image)
          entry.card.image = `${found[index]!.image}/high.webp`;
      });
      next.disabled = page * 24 >= entries.length;
      tell(
        `${entries.length} Ausgaben im gewählten Set. Seite ${page}. ${entries.filter((entry) => !entry.price).length} ohne passenden EUR-Trend.`,
      );
    } else if (set.value && setFacets) {
      const matching = setFacets.cards
        .filter((card) =>
          matchesFields(
            card.name,
            card.number ?? card.localId,
            card.artist,
            card.rarity,
          ),
        )
        .sort((a, b) =>
          order.value === 'name'
            ? a.name.localeCompare(b.name, language.value) ||
              a.id.localeCompare(b.id)
            : a.localId.localeCompare(b.localId, undefined, { numeric: true }),
        );
      found = matching.slice((page - 1) * 24, page * 24);
      next.disabled = page * 24 >= matching.length;
      tell(
        matching.length
          ? `${matching.length} Ausgaben im gewählten Set. Seite ${page}. Öffne eine Karte, um Ausgabe und Menge zu prüfen.`
          : 'Keine passende Ausgabe im gewählten Set. Ändere Name, Nummer oder Filter.',
      );
    } else {
      const query = search.value;
      const number = query
        .trim()
        .match(/^([A-Za-z]*\d+)(?:\s*\/\s*[A-Za-z]*\d+)?$/)?.[1];
      if (set.value && number) {
        const cards = await catalogSetCards(set.value, language.value, signal);
        const exact = cards.find(
          (card) => numberKey(card.localId) === numberKey(number),
        );
        if (!exact) found = [];
        else
          found = await searchCatalog(exact.localId, language.value, signal, {
            setId: set.value,
            artist: artist.value.trim(),
            rarity: rarity.value,
            page,
            order: order.value as 'number' | 'name',
          });
      } else
        found = await searchCatalog(query, language.value, signal, {
          setId: set.value,
          artist: artist.value.trim(),
          rarity: rarity.value,
          page,
          order: order.value as 'number' | 'name',
        });
      next.disabled = found.length === 0;
      const info = new Map(inventory.map((item) => [item.id, item]));
      found = found.map((card) => {
        const item = info.get(card.id.slice(0, card.id.lastIndexOf('-')));
        return {
          ...card,
          setName: item?.name ?? 'Setangabe nicht verfügbar',
          number: item?.cardCount.official
            ? `${card.localId}/${item.cardCount.official}`
            : card.localId,
        };
      });
      found = await fillCatalogImages(found, signal);
      tell(
        found.length
          ? `Seite ${page} · ${found.length} Ausgaben. Öffne eine Karte, um Ausgabe und Menge zu prüfen.`
          : 'Keine passende Ausgabe. Ändere Name, Nummer, Set oder Filter.',
      );
    }
    if (closed || signal.aborted || active !== signal) return;
    results.replaceChildren();
    visibleCards.clear();
    results.classList.toggle(
      'w-text-results',
      found.length > 0 && found.every((card) => !card.image),
    );
    found.forEach((result, i) => renderResult(result, signal, prices?.[i]));
    refresh();
    previous.disabled = page === 1;
    pager.replaceChildren(
      previous,
      el('span', 'w-muted', `Seite ${page}`),
      next,
    );
    if (page > 1) results.scrollIntoView({ block: 'start' });
  }
  set.addEventListener('change', () => {
    if (!set.value) {
      scopeKey = '';
      setFacets = undefined;
      rarityGuide.update(undefined, '');
      applyFilterChoices(globalRarities, globalArtists);
      scopeStatus.replaceChildren();
    }
    updateSet();
    options.onSearch();
  });
  for (const control of [rarity, order])
    control.addEventListener('change', () => options.onSearch());
  artist.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => options.onSearch(), 500);
  });
  setSearch.addEventListener('input', () => {
    setLimit = 24;
    renderSets();
    options.onStateChange?.(state());
  });
  series.addEventListener('change', () => {
    void loadSeries().then(() => {
      options.onStateChange?.(state());
    });
  });
  browse.addEventListener('toggle', () => {
    if (browse.open) void loadMetadata();
  });
  if (
    options.artist ||
    options.setId ||
    options.browse ||
    options.standalone ||
    initial.setId ||
    initial.artist ||
    initial.query
  ) {
    browse.open =
      !options.standalone ||
      !(initial.setId || initial.query || initial.artist);
    void loadMetadata().then(() => {
      if (!closed) options.onSearch(false);
    });
  }
  if (!initial.setId && !options.setId) updateSet();
  return {
    element,
    pager,
    run,
    state,
    refresh,
    hasFilters: () => Boolean(set.value || artist.value.trim() || rarity.value),
    languageChanged: () => {
      initialized = true;
      scopeKey = '';
      globalArtists = [];
      globalRarities = [];
      setFacets = undefined;
      rarityGuide.update(undefined, '');
      scopeStatus.replaceChildren();
      artist.disabled = false;
      rarity.disabled = false;
      seriesRequest?.abort();
      metadataLanguage = '';
      metadata = undefined;
      inventory = [];
      set.value = '';
      rarity.value = '';
      suggestions.replaceChildren();
      series.value = '';
      seriesMembers = undefined;
      pricing.clear();
      void loadMetadata().then(() => {
        if (!closed) options.onSearch();
      });
    },
    close: () => {
      closed = true;
      clearTimeout(debounce);
      lifetime.abort();
      seriesRequest?.abort();
    },
  };
}
