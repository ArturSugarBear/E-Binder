import { enableSheetDrag } from './sheet-gestures';
import type { CatalogEntry } from '../data/card-catalog';
import { cardMarket } from './card-market';
import { addWish, sameCard, type PersonalCard } from '../domain/personal';
import {
  createCatalogBrowser,
  type CatalogBrowserState,
} from './catalog-browser';
import type { WorkspaceContext } from './workspace-context';
import {
  action,
  choices,
  el,
  errorText,
  field,
  input,
  message,
  modal,
} from './workspace-dom';

/** Public catalogue state only: never serialise ownership, notes or photos into a URL. */
export function createDiscoverView(ctx: WorkspaceContext) {
  const parameters = new URLSearchParams(location.hash.split('?')[1]);
  const language = choices(
    'Katalogsprache',
    [
      ['de', 'Deutsch'],
      ['en', 'Englisch'],
      ['ja', 'Japanisch'],
    ],
    parameters.get('lang') ?? 'de',
  );
  if (!language.value) language.value = 'de';
  const search = input('search');
  search.placeholder = 'Kartenname oder Sammlernummer';
  const status = el('div');
  status.setAttribute('role', 'status');
  const results = el('div', 'w-search-results');
  const initial: Partial<CatalogBrowserState> = {};
  for (const name of [
    'setId',
    'artist',
    'rarity',
    'query',
    'series',
    'setQuery',
  ] as const)
    initial[name] = (parameters.get(name) ?? '').slice(0, 160);
  const requestedPage = Number(parameters.get('page'));
  initial.page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 1000)
      : 1;
  initial.order = ['number', 'name', 'price-asc', 'price-desc'].includes(
    parameters.get('order') ?? '',
  )
    ? parameters.get('order')!
    : 'number';
  let currentHash = location.hash;
  let request: AbortController | undefined;
  let debounce: ReturnType<typeof setTimeout>;
  let closed = false;
  let previewRefresh: (() => void) | undefined;
  let closePreview: (() => void) | undefined;
  const browser = createCatalogBrowser({
    ctx,
    search,
    language,
    results,
    initial,
    standalone: true,
    tell: (text, error = false) =>
      status.replaceChildren(message(text, error ? 'error' : 'note')),
    onChoose: showCard,
    onSearch: (reset = true) => {
      void run(reset);
    },
    onStateChange: (state) => {
      if (closed) return;
      const next = new URLSearchParams();
      if (language.value !== 'de') next.set('lang', language.value);
      for (const [key, value] of Object.entries(state))
        if (
          value &&
          !(key === 'page' && value === 1) &&
          !(key === 'order' && value === 'number')
        )
          next.set(key, String(value));
      const hash = `#entdecken${next.size ? `?${next}` : ''}`;
      const previousSet = new URLSearchParams(currentHash.split('?')[1]).get(
        'setId',
      );
      if (hash !== currentHash) {
        const method =
          previousSet !== (state.setId || null) ? 'pushState' : 'replaceState';
        window.history[method](null, '', hash);
        currentHash = hash;
      }
    },
  });
  const element = el(
    'section',
    'w-discover',
    el(
      'div',
      'w-page-heading',
      el(
        'div',
        '',
        el('p', 'w-eyebrow', 'Der Kartenkatalog'),
        el('h1', '', 'Karten entdecken'),
        el(
          'p',
          'w-lead',
          'Stöbere durch Sets, entdecke Illustratoren und finde deine nächste Karte.',
        ),
      ),
    ),
    el(
      'div',
      'w-discover-search',
      field('Karte suchen', search),
      language.element,
    ),
    browser.element,
    status,
    results,
    browser.pager,
    el(
      'p',
      'w-help',
      'Katalogdaten von TCGdex. Nur ausdrücklich bestätigte Karten zählen zu deinem Bestand.',
    ),
  );
  async function run(reset: boolean) {
    clearTimeout(debounce);
    request?.abort();
    request = new AbortController();
    const signal = request.signal;
    results.replaceChildren();
    browser.pager.replaceChildren();
    // Arrive in the set catalogue instead of requesting arbitrary global cards.
    if (!search.value.trim() && !browser.hasFilters()) {
      browser.element.querySelector<HTMLDetailsElement>('details')!.open = true;
      status.replaceChildren(
        message('Wähle ein Set oder suche nach Karte oder Illustrator.'),
      );
      // Persist even an empty filter state, including a changed catalogue language.
      const state = browser.state();
      const next = new URLSearchParams();
      if (language.value !== 'de') next.set('lang', language.value);
      if (state.series) next.set('series', state.series);
      if (state.setQuery) next.set('setQuery', state.setQuery);
      currentHash = `#entdecken${next.size ? `?${next}` : ''}`;
      window.history.replaceState(null, '', currentHash);
      return;
    }
    try {
      await browser.run(signal, reset);
    } catch (error) {
      if (signal.aborted || closed) return;
      status.replaceChildren(
        message(errorText(error), 'error'),
        action('Suche wiederholen', () => {
          void run(false);
        }),
      );
    }
  }
  function showCard(card: PersonalCard, entry: CatalogEntry) {
    status.replaceChildren();
    const view = modal(card.name);
    view.dialog.classList.add('w-card-detail-dialog');
    closePreview = view.close;
    const owned = el('p', 'w-muted');
    const wish = action(
      'Auf die Wunschliste',
      () => {
        ctx.commit('Karte auf der Wunschliste gemerkt', (state) =>
          addWish(state, card),
        );
        refresh();
      },
      'secondary',
      'star',
    );
    previewRefresh = () => {
      const quantity = ctx.state.holdings
        .filter((item) => sameCard(item.card, card))
        .reduce((sum, item) => sum + item.quantity, 0);
      owned.textContent = quantity
        ? `${quantity}× im ${ctx.state.mode === 'demo' ? 'Demo-' : ''}Bestand`
        : 'Noch nicht im Bestand';
      wish.disabled = ctx.state.wishes.some((item) =>
        sameCard(item.card, card),
      );
      wish.querySelector('span')!.textContent = wish.disabled
        ? 'Auf deiner Wunschliste'
        : 'Auf die Wunschliste';
    };
    view.body.append(
      el(
        'div',
        'w-discover-card',
        ctx.images.artwork(card),
        el(
          'div',
          '',
          el('h3', '', card.setName),
          el('p', '', `${card.number} · ${card.language.toUpperCase()}`),
          el(
            'p',
            'w-muted',
            card.artist
              ? `Illustration: ${card.artist} · ${card.artistSource === 'publisher' ? 'Verlagsangabe' : 'Katalogangabe'}`
              : 'Illustration nicht bekannt',
          ),
          entry.rarity ? el('p', 'w-card-rarity', entry.rarity) : null,
          owned,
        ),
      ),
      cardMarket(entry),
    );
    const cardSurface = view.body.querySelector<HTMLElement>('.w-discover-card');
    if (cardSurface) {
      cardSurface.classList.add('w-card-touch-surface');
      enableSheetDrag(view.dialog, view.dialog, [cardSurface]);
    }
    view.footer.append(
      action(
        'Zum Bestand hinzufügen',
        () => {
          view.close();
          ctx.openAdd({ card });
        },
        'primary',
        'plus',
      ),
      wish,
    );
    view.onClose(() => {
      previewRefresh = undefined;
      closePreview = undefined;
    });
    previewRefresh();
  }
  function refresh() {
    browser.refresh();
    previewRefresh?.();
  }
  search.addEventListener('input', () => {
    request?.abort();
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      void run(true);
    }, 450);
  });
  language.addEventListener('change', () => {
    request?.abort();
    browser.languageChanged();
  });
  return {
    element,
    get currentHash() {
      return currentHash;
    },
    refresh,
    close: () => {
      closed = true;
      clearTimeout(debounce);
      request?.abort();
      browser.close();
      closePreview?.();
    },
  };
}
