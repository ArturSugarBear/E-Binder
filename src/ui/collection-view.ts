import {
  addWish,
  changeState,
  finishLabels,
  findPage,
  freeCount,
  locations,
  sameCard,
  type Holding,
} from '../domain/personal';
import { matchesCard } from '../data/card-catalog';
import { holdingPrice, type HoldingPriceResult } from '../data/holding-prices';
import { portfolioQuoteKey, type PortfolioQuote } from '../domain/portfolio';
import {
  action,
  choices,
  check,
  el,
  field,
  input,
  message,
  modal,
  select,
} from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';
import { enableSwipe } from './swipe';
import { enableSheetDrag } from './sheet-gestures';

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});
const priceBasisLabels: Record<NonNullable<PortfolioQuote['basis']>, string> = {
  trend: 'Trendpreis',
  avg7: '7-Tage-Durchschnitt',
  avg30: '30-Tage-Durchschnitt',
  avg: 'Verkaufsdurchschnitt',
};

interface PriceBadge {
  element: HTMLElement;
  load: () => Promise<void>;
}

function priceBadge(
  holding: Holding,
  detail = false,
): PriceBadge {
  const comparable = portfolioQuoteKey(holding) !== null;
  const value = el(
    'strong',
    'w-price-value',
    comparable ? 'Wird geladen …' : '—',
  );
  const note = el(
    'small',
    'w-price-note',
    comparable ? 'Cardmarket · Preisreferenz' : 'Keine sichere Preisreferenz',
  );
  const element = el(
    'span',
    detail ? 'w-price-reference w-holding-price' : 'w-price-reference',
    detail ? el('span', 'w-label', 'Cardmarket · Preisreferenz') : null,
    value,
    note,
  );
  const render = (result: HoldingPriceResult) => {
    if (!element.isConnected) return;
    if (result.status === 'priced') {
      value.textContent = euro.format(result.quote.amount);
      const basis = result.quote.basis
        ? priceBasisLabels[result.quote.basis]
        : 'Preisreferenz';
      note.textContent = `${basis} · Stand ${new Date(result.quote.updated).toLocaleDateString('de-DE')}`;
    } else {
      value.textContent = '—';
      note.textContent =
        result.status === 'error'
          ? 'Preis momentan nicht erreichbar'
          : 'Keine datierte EUR-Preisreferenz';
    }
  };
  return {
    element,
    load: async () => {
      if (comparable) render(await holdingPrice(holding));
    },
  };
}

export function renderCollection(ctx: WorkspaceContext): HTMLElement {
  const root = el('section', 'w-collection');
  const quantity = ctx.state.holdings.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const head = el(
    'div',
    'w-page-heading',
    el(
      'div',
      '',
      el('p', 'w-eyebrow', 'Dein Kartenatelier'),
      el('h1', '', 'Deine Sammlung'),
      el(
        'p',
        'w-lead',
        quantity
          ? `${quantity} Exemplare · ${ctx.state.holdings.length} Ausgaben. Bereit für deine nächste Seite.`
          : 'Aus deinen Karten wird dein nächster Lieblingsbinder.',
      ),
    ),
    el(
      'div',
      'w-action-row',
      action('Karten hinzufügen', () => ctx.openAdd(), 'primary', 'plus'),
      action(
        'Foto erfassen',
        () => ctx.openAdd({ photos: true }),
        'secondary',
        'camera',
      ),
    ),
  );
  root.append(head);
  if (quantity) {
    const unplaced = ctx.state.holdings.reduce(
      (sum, holding) => sum + freeCount(ctx.state, holding),
      0,
    );
    const binderPages = ctx.state.binders.reduce(
      (sum, binder) => sum + binder.pages.length,
      0,
    );
    root.append(
      el(
        'div',
        'w-vault-overview',
        el(
          'div',
          'w-vault-overview-stat',
          el('small', '', 'Verschiedene Ausgaben'),
          el('strong', '', String(ctx.state.holdings.length)),
        ),
        el(
          'div',
          'w-vault-overview-stat',
          el('small', '', 'Noch nicht zugeordnet'),
          el('strong', '', String(unplaced)),
        ),
        el(
          'div',
          'w-vault-overview-stat',
          el('small', '', 'Binderseiten'),
          el('strong', '', String(binderPages)),
        ),
        action(
          'Im Binder anordnen',
          () => ctx.navigate('binder'),
          'secondary',
          'binder',
        ),
      ),
    );
  }
  if (!quantity) {
    const display = el('div', 'w-welcome-art');
    for (const card of ctx.catalog.slice(9, 12))
      display.append(ctx.images.artwork(card));
    root.append(
      el(
        'div',
        'w-welcome',
        el(
          'div',
          'w-welcome-copy',
          el('p', 'w-eyebrow', 'Deine Karten. Deine Ideen.'),
          el('h2', '', 'Eine Sammlung, die nach dir aussieht.'),
          el(
            'p',
            '',
            'Füge deine erste Karte hinzu, bestätige die Ausgabe und entdecke, was zusammenpasst. Jede Binderseite beginnt mit den Karten, die du wirklich hast.',
          ),
          el(
            'div',
            'w-action-row',
            action(
              'Erste Karte hinzufügen',
              () => ctx.openAdd(),
              'primary',
              'plus',
            ),
            action(
              'Mit Demo ausprobieren',
              () => {
                void ctx.switchMode('demo');
              },
              'secondary',
              'spark',
            ),
          ),
          el(
            'small',
            'w-help',
            'Gespeichert werden Karten-Metadaten. Fotos dienen nur der Erkennung und werden anschließend verworfen.',
          ),
        ),
        el(
          'div',
          '',
          display,
          el(
            'p',
            'w-art-note',
            'Abbildungen aus den Inspirationsvorlagen · kein eigener Bestand',
          ),
        ),
      ),
    );
    if (ctx.state.captures.some((item) => item.status === 'pending'))
      root.append(pending(ctx));
    return root;
  }
  if (ctx.state.captures.some((item) => item.status === 'pending'))
    root.append(pending(ctx));
  const search = input('search', ctx.filters.query);
  search.placeholder = 'Name, Set, Nummer oder Illustrator';
  search.dataset.focus = 'collection-search';
  const filter = choices(
    'Ansicht',
    [
      ['all', 'Alle Karten'],
      ['free', 'Freie Karten'],
      ['favorite', 'Lieblinge'],
      ['trade', 'Tausch'],
    ],
    ctx.filters.kind,
    'collection-kind',
  );
  const sort = choices(
    'Sortieren',
    [
      ['recent', 'Zuletzt hinzugefügt'],
      ['name', 'Nach Name'],
      ['artist', 'Nach Illustrator'],
      ['quantity', 'Nach Menge'],
    ],
    ctx.filters.order,
    'collection-order',
  );
  const sortSummary = el('summary', '', 'Sortieren');
  const sortPanel = el('details', 'w-sort-panel', sortSummary, sort.element);
  const result = el('div', 'w-owned-grid');
  const count = el('p', 'w-result-count');
  count.setAttribute('aria-live', 'polite');
  const update = () => {
    ctx.filters.query = search.value;
    ctx.filters.kind = filter.value;
    ctx.filters.order = sort.value;
    sortSummary.textContent = `Sortieren: ${sort.options.find((option) => option.checked)?.parentElement?.textContent ?? ''}`;
    const rows = ctx.state.holdings.filter(
      (holding) =>
        matchesCard(holding.card, search.value) &&
        (filter.value === 'all' ||
          (filter.value === 'favorite' && holding.favorite) ||
          (filter.value === 'trade' && holding.tradeQuantity > 0) ||
          (filter.value === 'free' && freeCount(ctx.state, holding) > 0)),
    );
    rows.sort((a, b) =>
      sort.value === 'name'
        ? a.card.name.localeCompare(b.card.name, 'de')
        : sort.value === 'artist'
          ? a.card.artist.localeCompare(b.card.artist, 'de')
          : sort.value === 'quantity'
            ? b.quantity - a.quantity
            : b.createdAt.localeCompare(a.createdAt),
    );
    result.replaceChildren();
    count.textContent = `${rows.length} ${rows.length === 1 ? 'Ausgabe' : 'Ausgaben'}`;
    const visibleOrder = rows.map((holding) => holding.id);
    const prices: PriceBadge[] = [];
    for (const holding of rows) {
      const tile = holdingCard(ctx, holding, visibleOrder);
      result.append(tile.element);
      prices.push(tile.price);
    }
    // Keep the page interactive: load at most four public catalogue quotes at
    // once, updating only card tiles still present after a filter change.
    queueMicrotask(() => {
      void (async () => {
        for (let index = 0; index < prices.length; index += 4) {
          if (!root.isConnected) return;
          await Promise.all(prices.slice(index, index + 4).map((item) => item.load()));
        }
      })();
    });
    if (!rows.length)
      result.append(
        message(
          'Keine Karte passt zu diesen Filtern. Ändere die Suche oder füge eine Ausgabe hinzu.',
        ),
      );
  };
  search.addEventListener('input', update);
  filter.addEventListener('change', update);
  sort.addEventListener('change', update);
  root.append(
    el(
      'div',
      'w-filter-bar',
      field('Im eigenen Bestand suchen', search),
      filter.element,
    ),
    el('div', 'w-collection-results-bar', count, sortPanel),
    result,
  );
  update();
  return root;
}
function pending(ctx: WorkspaceContext): HTMLElement {
  return el(
    'div',
    'w-inline-banner',
    el(
      'div',
      '',
      el('strong', '', 'Deine Erfassung wartet auf dich.'),
      el(
        'span',
        '',
        `${ctx.state.captures.filter((item) => item.status === 'pending').length} Fotos sind noch nicht als Bestand bestätigt.`,
      ),
    ),
    action(
      'Erfassung fortsetzen',
      () =>
        ctx.openAdd({
          captureId: ctx.state.captures.find(
            (item) => item.status === 'pending',
          )?.id,
        }),
      'text',
      'arrow',
    ),
  );
}
function holdingCard(
  ctx: WorkspaceContext,
  holding: Holding,
  order: string[],
): { element: HTMLElement; price: PriceBadge } {
  const price = priceBadge(holding);
  const button = action(
    holding.card.name,
    () => openHolding(ctx, holding.id, order),
    'card',
  );
  button.dataset.focus = `holding-${holding.id}`;
  button.replaceChildren(
    el(
      'span',
      'w-card-visual',
      ctx.images.artwork(holding.card),
      el('span', 'w-quantity-badge', `${holding.quantity}×`),
      holding.favorite ? el('span', 'w-favorite-badge', '★') : null,
    ),
    el(
      'span',
      'w-card-caption',
      el('strong', '', holding.card.name),
      el(
        'small',
        '',
        `${holding.card.number} · ${holding.card.language.toUpperCase()}`,
      ),
      el('small', 'w-muted', holding.card.artist || 'Illustrator unbekannt'),
      price.element,
    ),
    el(
      'span',
      'w-card-availability',
      `${freeCount(ctx.state, holding)} frei${holding.tradeQuantity ? ` · ${holding.tradeQuantity} zum Tausch` : ''}`,
    ),
  );
  // The visible caption names the button; a separate hint must not replace it.
  button.setAttribute('aria-description', 'Kartendetails öffnen');
  return { element: button, price };
}

export function openHolding(
  ctx: WorkspaceContext,
  id: string,
  order?: readonly string[],
): void {
  const holding = ctx.state.holdings.find((item) => item.id === id);
  if (!holding) return;
  const sheet = modal(holding.card.name);
  const price = priceBadge(holding, true);
  const quantity = input('number', String(holding.quantity));
  quantity.min = '1';
  quantity.max = '999';
  quantity.required = true;
  const trade = input('number', String(holding.tradeQuantity));
  trade.min = '0';
  trade.max = String(holding.quantity);
  const favorite = check('Als Lieblingskarte markieren', holding.favorite);
  const notes = el('textarea', 'w-input');
  notes.value = holding.notes;
  notes.maxLength = 2000;
  notes.rows = 3;
  const form = el('form', 'w-holding-form');
  const where = locations(ctx.state, id);
  const places = el(
    'div',
    'w-location-list',
    el('h3', '', 'Deine Binder-Zuordnungen'),
  );
  if (!where.length)
    places.append(el('p', 'w-muted', 'Noch keinem Binderplatz zugeordnet.'));
  for (const location of where)
    places.append(
      action(
        `${location.binder} · ${location.page} · Platz ${location.slot + 1} · ${findPage(ctx.state, location.pageId).assembled ? 'Aufbau markiert' : 'Entwurf'}`,
        () => {
          ctx.commit(
            'Binder geöffnet',
            (state) =>
              changeState(state, (next) => {
                next.lastPageId = location.pageId;
                next.lastBinderId = next.binders.find((binder) =>
                  binder.pages.some((page) => page.id === location.pageId),
                )!.id;
              }),
            { undo: false, notify: false },
          );
          sheet.close();
          ctx.navigate('binder');
        },
        'text',
        'binder',
      ),
    );
  const save = action(
    'Änderungen speichern',
    () => undefined,
    'primary',
    'check',
  );
  save.type = 'submit';
  form.append(
    el(
      'div',
      'w-holding-preview',
      ctx.images.artwork(holding.card),
      el(
        'div',
        '',
        el('p', 'w-eyebrow', holding.card.language.toUpperCase()),
        el('h3', '', holding.card.setName),
        el('p', '', holding.card.number),
        el(
          'p',
          'w-muted',
          `${finishLabels[holding.finish]}${holding.variantNote ? ` · ${holding.variantNote}` : ''}`,
        ),
        el(
          'p',
          'w-muted',
          holding.card.artist
            ? `Illustration: ${holding.card.artist}`
            : 'Illustrator unbekannt',
        ),
        holding.card.artistUrl ? sourceLink(holding.card.artistUrl) : null,
      ),
    ),
    price.element,
    el(
      'div',
      'w-form-grid',
      field('Bestätigte Gesamtmenge', quantity),
      field(
        'Davon ausdrücklich zum Tausch',
        trade,
        'Eine doppelte Karte wird nicht automatisch angeboten.',
      ),
    ),
    favorite.row,
    field('Deine Notiz', notes),
    places,
    save,
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (
      ctx.commit('Bestand geändert', (state) =>
        changeState(state, (next) => {
          const item = next.holdings.find((row) => row.id === id)!;
          item.quantity = Number(quantity.value);
          item.tradeQuantity = Number(trade.value);
          item.favorite = favorite.input.checked;
          item.notes = notes.value;
          item.updatedAt = new Date().toISOString();
        }),
      )
    )
      sheet.close();
  });
  sheet.body.append(form);
  void price.load();
  const cardSurface = form.querySelector<HTMLElement>('.w-holding-preview');
  if (cardSurface) {
    cardSurface.classList.add('w-card-swipe-zone');
    enableSheetDrag(sheet.dialog, sheet.dialog, [cardSurface]);
  }
  const visibleOrder =
    order?.filter((itemId) =>
      ctx.state.holdings.some((item) => item.id === itemId),
    ) ?? ctx.state.holdings.map((item) => item.id);
  const holdingIndex = visibleOrder.indexOf(id);
  if (visibleOrder.length > 1 && holdingIndex >= 0) {
    let modified = false;
    form.addEventListener('input', () => {
      modified = true;
    });
    form.addEventListener('change', () => {
      modified = true;
    });
    const browse = (step: number) => {
      const adjacentId = visibleOrder[holdingIndex + step];
      if (!adjacentId) return;
      if (modified) {
        ctx.notify(
          'Speichere zuerst deine Änderungen, bevor du zur nächsten Karte wechselst.',
          true,
        );
        return;
      }
      sheet.close();
      requestAnimationFrame(() => openHolding(ctx, adjacentId, visibleOrder));
    };
    const previous = action('Vorherige Karte', () => browse(-1), 'text');
    const next = action('Nächste Karte', () => browse(1), 'text');
    previous.disabled = holdingIndex === 0;
    next.disabled = holdingIndex === visibleOrder.length - 1;
    const navigator = el(
      'nav',
      'w-card-browse',
      previous,
      el('span', 'w-mono', `${holdingIndex + 1} / ${visibleOrder.length}`),
      next,
    );
    navigator.setAttribute('aria-label', 'Zwischen Karten wechseln');
    sheet.body.prepend(navigator);
    if (cardSurface) enableSwipe(cardSurface, browse);
  }
  sheet.footer.append(
    action(
      'Ausgabe korrigieren',
      () => {
        sheet.close();
        ctx.openAdd({ card: holding.card, correctHoldingId: id });
      },
      'text',
    ),
    action(
      'Auch auf die Wunschliste',
      () => {
        if (
          ctx.commit('Wunschkarte hinzugefügt', (state) =>
            addWish(state, holding.card),
          )
        )
          ctx.notify('Wunsch gespeichert. Der Besitz bleibt unverändert.');
      },
      'text',
      'star',
    ),
    action(
      'Bestandseintrag entfernen',
      () => {
        if (where.length) {
          ctx.notify(
            'Gib zuerst die belegten Binderplätze dieser Ausgabe frei.',
            true,
          );
          return;
        }
        const confirm = modal('Bestandseintrag entfernen');
        confirm.body.append(
          message(
            `Alle ${holding.quantity} Exemplare von ${holding.card.name} aus diesem lokalen Bestand entfernen? Du kannst die Aktion rückgängig machen.`,
          ),
        );
        confirm.footer.append(
          action('Abbrechen', confirm.close),
          action(
            'Entfernen',
            () => {
              if (
                ctx.commit('Bestandseintrag entfernt', (state) =>
                  changeState(state, (next) => {
                    next.holdings = next.holdings.filter(
                      (row) => row.id !== id,
                    );
                  }),
                )
              ) {
                confirm.close();
                sheet.close();
              }
            },
            'danger',
            'trash',
          ),
        );
      },
      'text',
      'trash',
    ),
  );
}
function sourceLink(url: string): HTMLAnchorElement {
  const link = el('a', 'w-text-link', 'Publisher-Credit ansehen');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

export function renderWishes(ctx: WorkspaceContext): HTMLElement {
  const root = el(
    'section',
    'w-wishes',
    el(
      'div',
      'w-page-heading',
      el(
        'div',
        '',
        el('p', 'w-eyebrow', 'Nächste Ergänzungen'),
        el('h1', '', 'Deine Wunschkarten'),
        el(
          'p',
          'w-lead',
          'Eine genaue Ausgabe, ein bewusster Wunsch. Unabhängig davon, was du schon besitzt.',
        ),
      ),
      action('Wunschkarte suchen', () => ctx.openAdd(), 'primary', 'plus'),
    ),
  );
  if (!ctx.state.wishes.length) {
    root.append(
      el(
        'div',
        'w-empty',
        el('h2', '', 'Platz für deine nächsten Fundstücke.'),
        el(
          'p',
          '',
          'Suche eine Karte und wähle „Auf die Wunschliste“. Geplante Binderplätze bleiben zunächst nur Teil deines Entwurfs.',
        ),
        action(
          'Katalog durchsuchen',
          () => ctx.openAdd(),
          'secondary',
          'search',
        ),
      ),
    );
    return root;
  }
  const grid = el('div', 'w-wish-grid');
  for (const wish of [...ctx.state.wishes].sort(
    (a, b) =>
      ({ high: 0, normal: 1, low: 2 })[a.priority] -
      { high: 0, normal: 1, low: 2 }[b.priority],
  )) {
    const owned = ctx.state.holdings
      .filter((item) => sameCard(item.card, wish.card))
      .reduce((sum, item) => sum + item.quantity, 0);
    const priority = select(
      [
        ['high', 'Hohe Priorität'],
        ['normal', 'Normale Priorität'],
        ['low', 'Später'],
      ],
      wish.priority,
    );
    priority.dataset.focus = `wish-priority-${wish.id}`;
    const quantity = input('number', String(wish.quantity));
    quantity.min = '1';
    quantity.max = '999';
    quantity.required = true;
    quantity.dataset.focus = `wish-quantity-${wish.id}`;
    const form = el(
      'form',
      'w-wish-card',
      ctx.images.artwork(wish.card),
      el(
        'div',
        'w-wish-copy',
        el('h2', '', wish.card.name),
        el(
          'p',
          'w-muted',
          `${wish.card.setName} · ${wish.card.number} · ${wish.card.language.toUpperCase()}`,
        ),
        el(
          'p',
          '',
          owned
            ? `${owned} Exemplare bereits im Bestand`
            : 'Noch nicht im Bestand',
        ),
        el(
          'div',
          'w-form-grid',
          field('Gewünschte Menge', quantity),
          field('Priorität', priority),
        ),
      ),
    );
    const save = action('Wunsch speichern', () => undefined, 'text', 'check');
    save.type = 'submit';
    form.append(
      el(
        'div',
        'w-action-row',
        action(
          'Jetzt vorhanden',
          () => ctx.openAdd({ card: wish.card }),
          'secondary',
          'plus',
        ),
        save,
        action(
          'Entfernen',
          () =>
            ctx.commit('Wunsch entfernt', (state) =>
              changeState(state, (next) => {
                next.wishes = next.wishes.filter((item) => item.id !== wish.id);
              }),
            ),
          'text',
          'trash',
        ),
      ),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      ctx.commit('Wunsch geändert', (state) =>
        changeState(state, (next) => {
          const item = next.wishes.find((row) => row.id === wish.id)!;
          item.quantity = Number(quantity.value);
          item.priority = priority.value as 'low' | 'normal' | 'high';
        }),
      );
    });
    grid.append(form);
  }
  root.append(grid);
  return root;
}
