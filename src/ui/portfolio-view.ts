import { catalogEntry } from '../data/card-catalog';
import {
  portfolioQuoteKey,
  summarizePortfolio,
  type PortfolioQuote,
} from '../domain/portfolio';
import { changeState, finishLabels, type Holding } from '../domain/personal';
import { revealPortfolioBars, revealHistoryStroke } from './collector-polish';
import {
  comparableHistory,
  recordPortfolioObservation,
} from '../data/portfolio-history';
import { action, el, message } from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';

const euros = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function shownValue(value: number, covered: number): string {
  return covered ? euros.format(value) : '—';
}

function uniqueQuoteTargets(holdings: Holding[]): {
  key: string;
  holding: Holding;
}[] {
  const selected = new Map<string, Holding>();
  for (const holding of holdings) {
    const key = portfolioQuoteKey(holding);
    if (key && !selected.has(key)) selected.set(key, holding);
  }
  return [...selected].map(([key, holding]) => ({ key, holding }));
}

/** A portfolio of verified catalogue observations, never a sale-price claim. */
export function createPortfolioView(ctx: WorkspaceContext) {
  const element = el('section', 'w-portfolio');
  const content = el('div', 'w-portfolio-content');
  element.append(content);
  const controller = new AbortController();
  const quotes = new Map<string, PortfolioQuote>();
  const attempted = new Set<string>();
  let closed = false;
  let loading = false;
  let limit = 40;
  let connectionError = false;
  let chartRevealed = false;
  let historyRange: 7 | 30 | 90 = 30;
  const expandedBinders = new Set<string>();

  function openBinder(binderId: string, pageId?: string) {
    const chosen = ctx.state.binders.find((item) => item.id === binderId);
    if (!chosen) return;
    ctx.commit(
      'Binder im Portfolio geöffnet',
      (state) =>
        changeState(state, (next) => {
          next.lastBinderId = binderId;
          next.lastPageId = pageId ?? chosen.pages[0]?.id;
        }),
      { undo: false, notify: false },
    );
    ctx.navigate('binder');
  }

  function render(): void {
    if (closed) return;
    const overview = summarizePortfolio(ctx.state, quotes);
    const count = overview.ownedCopies;
    const priced = overview.pricedCopies;
    const targets = uniqueQuoteTargets(ctx.state.holdings);
    const remaining = targets.filter((target) => !attempted.has(target.key));
    const top = overview.holdings
      .filter((row) => row.totalValue !== null)
      .sort((a, b) => b.totalValue! - a.totalValue!)
      .slice(0, 6);
    const value = shownValue(overview.knownValue, priced);
    const grouped = new Map<
      string,
      { name: string; copies: number; priced: number; total: number }
    >();
    for (const row of overview.holdings) {
      const id = `${row.holding.card.language}:${row.holding.card.setId || row.holding.card.setName}`;
      const group = grouped.get(id) ?? {
        name: row.holding.card.setName,
        copies: 0,
        priced: 0,
        total: 0,
      };
      group.copies += row.holding.quantity;
      if (row.unitValue !== null) {
        group.priced += row.holding.quantity;
        group.total += row.totalValue ?? 0;
      }
      grouped.set(id, group);
    }

    const hero = el(
      'header',
      'w-portfolio-hero',
      el(
        'div',
        'w-portfolio-hero-copy',
        el('p', 'w-eyebrow', 'Rare Room / Dein Sammelwert'),
        el('h1', '', 'Dein Portfolio'),
        el(
          'p',
          'w-portfolio-hero-label',
          count && priced < count
            ? 'Erfasster Teilwert · nicht vollständig bewertet'
            : 'Erfasste Cardmarket-Preisreferenzen',
        ),
        el('p', 'w-portfolio-balance', value),
        el(
          'p',
          'w-portfolio-caption',
          priced
            ? `${priced} von ${count} Exemplaren bepreist · ${count - priced} ohne Marktwert`
            : count
              ? 'Noch keine geeigneten Preisdaten für diese Ausgaben.'
              : 'Die besten Sammlungen beginnen mit einer Karte.',
        ),
        el(
          'p',
          'w-portfolio-disclaimer',
          'Indikativer Katalogwert, kein bestätigter Verkaufspreis. Zustand, Sprache, Grading, Gebühren und Sondervarianten werden nicht pauschal eingepreist.',
        ),
      ),
      el(
        'div',
        'w-portfolio-hero-art',
        ...top
          .filter((row) => Boolean(row.holding.card.image))
          .slice(0, 3)
          .map((row) =>
            el(
              'div',
              'w-portfolio-art-card',
              ctx.images.artwork(row.holding.card),
            ),
          ),
      ),
    );

    const historyPoints = comparableHistory(ctx.state, overview, historyRange);
    const historyChart = el(
      'section',
      'w-portfolio-section w-portfolio-history',
      el('div', 'w-portfolio-section-head', el('h2', '', 'Wertentwicklung')),
    );
    const periods = el('div', 'w-portfolio-periods');
    periods.setAttribute('role', 'group');
    periods.setAttribute('aria-label', 'Zeitraum der Wertentwicklung');
    for (const days of [7, 30, 90] as const) {
      const option = action(
        `${days} Tage`,
        () => {
          historyRange = days;
          render();
        },
        'secondary',
      );
      option.setAttribute('aria-pressed', String(days === historyRange));
      periods.append(option);
    }
    historyChart.append(periods);
    if (historyPoints.length < 2) {
      historyChart.append(
        message(
          historyPoints.length
            ? 'Die erste echte EUR-Messung wurde gespeichert. Ein Verlauf erscheint nach einer weiteren vergleichbaren Messung an einem anderen Tag.'
            : 'Noch keine vergleichbare Preisentwicklung erfasst. Nach zwei unterschiedlichen Tagen mit gleicher Sammlung und Preisabdeckung erscheint hier dein tatsächlicher Verlauf.',
        ),
      );
    } else {
      const values = historyPoints.map((point) => point.knownValue);
      const low = Math.min(...values);
      const high = Math.max(...values);
      const spread = Math.max(high - low, 0.01);
      const first = Date.parse(`${historyPoints[0]!.day}T00:00:00Z`);
      const last = Date.parse(`${historyPoints.at(-1)!.day}T00:00:00Z`);
      const x = (date: string) =>
        24 +
        (512 * (Date.parse(`${date}T00:00:00Z`) - first)) /
          Math.max(last - first, 1);
      const y = (value: number) => 185 - (145 * (value - low)) / spread;
      const points = historyPoints.map(
        (point) => `${x(point.day)},${y(point.knownValue)}`,
      );
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 560 220');
      svg.setAttribute('role', 'img');
      svg.setAttribute(
        'aria-label',
        `Gemessener EUR-Teilwert von ${euros.format(values[0]!)} bis ${euros.format(values.at(-1)!)} an ${historyPoints.length} Tagen`,
      );
      svg.classList.add('w-portfolio-history-svg');
      const line = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      );
      line.setAttribute('d', `M ${points.join(' L ')}`);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', 'var(--accent)');
      line.setAttribute('stroke-width', '3.5');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-linejoin', 'round');
      line.classList.add('w-portfolio-history-path');
      svg.append(line);
      historyChart.append(
        svg,
        el(
          'div',
          'w-portfolio-history-labels',
          el('span', '', historyPoints[0]!.day),
          el('strong', '', `${euros.format(low)} – ${euros.format(high)}`),
          el('span', '', historyPoints.at(-1)!.day),
        ),
      );
      queueMicrotask(() => {
        if (!closed && line.isConnected) revealHistoryStroke(line);
      });
    }
    historyChart.append(
      el(
        'small',
        'w-muted',
        'Nur echte lokale Tagesmessungen desselben Bestands mit gleicher Preisabdeckung. Fehlende Preise, neue Karten und unterschiedliche Bestände werden nicht als Gewinne oder Verluste verbunden.',
      ),
    );

    const overviewStats = el(
      'div',
      'w-portfolio-stats',
      stat('Karten im Bestand', String(count), 'Physisch bestätigt'),
      stat('Preisreferenzen', `${priced} / ${count}`, 'Nicht geschätzt'),
      stat(
        'Ohne Preisreferenz',
        String(overview.missingCopies),
        'Offen ausgewiesen',
      ),
      stat(
        'Deine Binder',
        String(ctx.state.binders.length),
        'Wert je Seite sichtbar',
      ),
    );

    const status = el('p', 'w-portfolio-source-status');
    status.setAttribute('role', 'status');
    const known = attempted.size;
    if (!navigator.onLine)
      status.textContent =
        'Offline: Neue Marktpreise lassen sich erst mit Internet abrufen.';
    else if (loading)
      status.textContent = `Katalogpreise werden geprüft … ${known} von ${targets.length} Ausgaben verarbeitet.`;
    else if (connectionError)
      status.textContent =
        'Einige Katalogpreise sind derzeit nicht erreichbar. Bereits geprüfte Werte bleiben sichtbar.';
    else
      status.textContent = targets.length
        ? `${known} von ${targets.length} unterschiedlichen Druckvarianten geprüft. Quelle: TCGdex / Cardmarket.`
        : 'Für deine Sonderausgaben oder unbestimmten Varianten liegen noch keine eindeutig passenden Preisreferenzen vor.';

    const source = el(
      'section',
      'w-portfolio-source',
      el('div', '', el('h2', '', 'Marktdaten'), status),
      el(
        'div',
        'w-portfolio-source-actions',
        action(
          'Preise erneut prüfen',
          () => {
            attempted.clear();
            quotes.clear();
            connectionError = false;
            render();
            void loadQuotes();
          },
          'secondary',
        ),
      ),
    );
    if (loading)
      source.append(el('progress', 'w-progress w-portfolio-load-progress'));
    if (!loading && remaining.length && known >= limit) {
      source.querySelector('.w-portfolio-source-actions')!.append(
        action(
          'Weitere 40 Karten prüfen',
          () => {
            limit += 40;
            void loadQuotes();
          },
          'secondary',
        ),
      );
    }

    const bySet = el(
      'section',
      'w-portfolio-section w-portfolio-by-set',
      el(
        'div',
        'w-portfolio-section-head',
        el('h2', '', 'Deine Sets im Überblick'),
      ),
    );
    if (!count) {
      bySet.append(
        message(
          'Sobald du Karten besitzt, erscheint hier ihre Verteilung nach Sets.',
        ),
      );
    } else {
      const entries = [...grouped.values()]
        .sort((a, b) => b.copies - a.copies)
        .slice(0, 8);
      const peak = entries[0]?.copies ?? 1;
      bySet.append(
        el(
          'p',
          'w-muted',
          'Balken = Kartenanzahl. EUR-Werte werden nur bei verifizierten Preisreferenzen angezeigt.',
        ),
      );
      const chart = el('div', 'w-portfolio-set-chart');
      for (const group of entries) {
        const fill = el('span', 'w-portfolio-set-fill');
        fill.style.width = `${Math.round((100 * group.copies) / peak)}%`;
        const bar = el('span', 'w-portfolio-set-track', fill);
        bar.setAttribute(
          'aria-label',
          `${group.copies} Exemplare aus ${group.name}`,
        );
        chart.append(
          el(
            'div',
            'w-portfolio-set-row',
            el(
              'span',
              'w-portfolio-set-label',
              el('strong', '', group.name),
              el(
                'small',
                '',
                `${group.copies} Exemplare · ${group.priced} mit Preis`,
              ),
            ),
            bar,
            el(
              'strong',
              'w-portfolio-set-value',
              group.priced ? euros.format(group.total) : '—',
            ),
          ),
        );
      }
      bySet.append(chart);
    }

    const leaders = el(
      'section',
      'w-portfolio-section',
      el(
        'div',
        'w-portfolio-section-head',
        el('h2', '', 'Wertvollste Karten'),
        el('span', 'w-portfolio-overline', 'Bestätigter Bestand'),
      ),
    );
    if (!count)
      leaders.append(
        el(
          'div',
          'w-portfolio-empty',
          el('h3', '', 'Dein Portfolio wartet auf seine erste Karte.'),
          message(
            'Füge Karten hinzu und bestätige die genaue Ausgabe. Die Portfolioansicht ergänzt dann passende Preisinformationen.',
          ),
          action('Karte hinzufügen', () => ctx.openAdd(), 'primary', 'plus'),
          ...(ctx.state.mode === 'personal'
            ? [
                action(
                  'Beispielportfolio ansehen',
                  () =>
                    void ctx.switchMode('demo').then(() => {
                      if (ctx.state.mode === 'demo') ctx.navigate('portfolio');
                    }),
                  'secondary',
                ),
              ]
            : []),
        ),
      );
    else if (!top.length)
      leaders.append(
        message(
          'Noch keine exakt passende Preisreferenz verfügbar. Deine Karten sind weiterhin vollständig in der Sammlung vorhanden.',
        ),
      );
    else {
      const grid = el('div', 'w-portfolio-leaders');
      for (const row of top) {
        const { holding } = row;
        const button = action(
          `${holding.card.name} anzeigen`,
          () => ctx.openHolding(holding.id),
          'card',
        );
        button.classList.add('w-portfolio-leader');
        button.replaceChildren(
          el(
            'div',
            'w-portfolio-leader-image',
            ctx.images.artwork(holding.card),
          ),
          el(
            'div',
            'w-portfolio-leader-info',
            el('strong', '', holding.card.name),
            el(
              'span',
              'w-portfolio-overline',
              `${holding.card.setName} · ${holding.card.number}`,
            ),
            el(
              'span',
              'w-portfolio-overline',
              `${finishLabels[holding.finish]} · ${holding.quantity}×`,
            ),
            el('b', 'w-portfolio-leader-value', euros.format(row.totalValue!)),
            el(
              'small',
              '',
              `${euros.format(row.unitValue!)} je Exemplar · Katalogtrend`,
            ),
          ),
        );
        grid.append(button);
      }
      leaders.append(grid);
    }

    const missing = el(
      'section',
      'w-portfolio-section w-portfolio-missing',
      el(
        'div',
        'w-portfolio-section-head',
        el('h2', '', 'Ohne Marktwert'),
        el(
          'span',
          'w-portfolio-overline',
          `${overview.missingCopies} Exemplare`,
        ),
      ),
    );
    if (overview.missingCopies) {
      const list = el('div', 'w-portfolio-missing-grid');
      for (const row of overview.holdings
        .filter((item) => item.unitValue === null)
        .slice(0, 12)) {
        const card = row.holding.card;
        const reason =
          card.source !== 'tcgdex'
            ? 'Nicht mit einer geprüften Katalogausgabe verknüpft'
            : row.holding.finish !== 'normal' && row.holding.finish !== 'holo'
              ? 'Druckvariante noch nicht eindeutig bepreist'
              : row.holding.variantNote
                ? 'Sonderauflage ohne gesicherten Vergleichspreis'
                : 'Für diese Ausgabe noch keine Preisreferenz';
        const button = action(
          `${card.name} ansehen`,
          () => ctx.openHolding(row.holding.id),
          'secondary',
        );
        button.classList.add('w-portfolio-missing-card');
        button.replaceChildren(
          el('span', 'w-portfolio-missing-art', ctx.images.artwork(card)),
          el(
            'span',
            'w-portfolio-missing-copy',
            el('strong', '', card.name),
            el('small', '', `${card.setName} · ${card.number}`),
            el('small', '', reason),
          ),
        );
        list.append(button);
      }
      missing.append(list);
    }

    const book = el(
      'section',
      'w-portfolio-section',
      el(
        'div',
        'w-portfolio-section-head',
        el('h2', '', 'Wert deiner Binder'),
        el('span', 'w-portfolio-overline', 'Nur belegte Plätze'),
      ),
    );
    if (!overview.binders.length)
      book.append(
        message(
          'Noch kein Binder angelegt. Sobald du Karten auf Seiten platzierst, erscheint hier der Wert je Binderseite.',
        ),
        action(
          'Binder anlegen',
          () => ctx.navigate('binder'),
          'secondary',
          'binder',
        ),
      );
    else
      for (const binder of overview.binders) {
        const details = el(
          'details',
          'w-portfolio-binder',
          el(
            'summary',
            '',
            el(
              'span',
              'w-portfolio-binder-name',
              el('strong', '', binder.name),
              el(
                'small',
                '',
                `${binder.pricedSlots} von ${binder.slots} belegten Plätzen mit Referenz`,
              ),
            ),
            el(
              'span',
              'w-portfolio-binder-value',
              shownValue(binder.knownValue, binder.pricedSlots),
            ),
          ),
        );
        details.open = expandedBinders.has(binder.id);
        // Preserve an explicitly expanded binder across asynchronous price
        // refreshes, which reconstruct the portfolio DOM.
        details.querySelector('summary')!.addEventListener('click', () => {
          if (details.open) expandedBinders.delete(binder.id);
          else expandedBinders.add(binder.id);
        });
        const pages = el('div', 'w-portfolio-pages');
        for (const page of binder.pages)
          pages.append(
            action(
              `${page.title} öffnen`,
              () => openBinder(binder.id, page.id),
              'text',
            ),
          );
        for (const [index, page] of binder.pages.entries()) {
          const row = pages.children[index]!;
          row.replaceChildren(
            el('span', '', page.title),
            el('small', '', `${page.pricedSlots}/${page.slots} Karten`),
            el('strong', '', shownValue(page.knownValue, page.pricedSlots)),
          );
        }
        details.append(
          pages,
          action(
            'Binder öffnen',
            () => openBinder(binder.id),
            'secondary',
            'binder',
          ),
        );
        book.append(details);
      }

    const foot = el(
      'p',
      'w-portfolio-footnote',
      'Wichtig: Werte zeigen datierte EUR-Referenzen zum exakt passenden Cardmarket-Druck (Trend, sonst 7-/30-Tage- oder allgemeiner Verkaufsdurchschnitt). Durchschnitt ist kein Trend. Unbestimmte Varianten, Reverse-Holo und Grading bleiben ohne eindeutige Zuordnung unbewertet. Fehlende Preise zählen nicht als 0 €. Das sind keine Verkaufserlöse oder historischen Depotkurse.',
    );
    if (!count) {
      leaders.querySelector('.w-portfolio-section-head')?.remove();
      content.replaceChildren(hero, leaders, book);
      content.classList.add('is-empty');
      return;
    }
    content.classList.remove('is-empty');
    content.replaceChildren(
      hero,
      overviewStats,
      historyChart,
      bySet,
      source,
      leaders,
      ...(overview.missingCopies ? [missing] : []),
      book,
      foot,
    );
    if (!chartRevealed && count) {
      chartRevealed = true;
      queueMicrotask(() => {
        if (!closed) revealPortfolioBars(content);
      });
    }
  }

  function stat(title: string, value: string, caption: string): HTMLElement {
    return el(
      'div',
      'w-portfolio-stat',
      el('p', '', title),
      el('strong', '', value),
      el('small', '', caption),
    );
  }

  async function loadQuotes(): Promise<void> {
    if (closed || loading || !navigator.onLine) return;
    const targets = uniqueQuoteTargets(ctx.state.holdings).slice(0, limit);
    const missing = targets.filter((target) => !attempted.has(target.key));
    if (!missing.length) return;
    loading = true;
    render();
    for (let index = 0; index < missing.length; index += 4) {
      if (closed || controller.signal.aborted) break;
      const chunk = missing.slice(index, index + 4);
      const results = await Promise.allSettled(
        chunk.map(async ({ key, holding }) => {
          const entry = await catalogEntry(
            key.split(':').slice(1, -1).join(':'),
            'de',
            controller.signal,
            false,
          );
          const price =
            holding.finish === 'holo' ? entry.holoPrice : entry.price;
          return { key, price, finish: holding.finish };
        }),
      );
      if (closed || controller.signal.aborted) break;
      for (const [offset, result] of results.entries()) {
        const target = chunk[offset]!;
        attempted.add(target.key);
        if (result.status === 'rejected') {
          connectionError = true;
          continue;
        }
        const { price, finish } = result.value;
        if (!price || !Number.isFinite(price.amount) || price.amount <= 0)
          continue;
        quotes.set(target.key, {
          source: 'cardmarket',
          variant: finish === 'holo' ? 'holo' : 'normal',
          amount: price.amount,
          updated: price.updated,
          basis: price.basis,
        });
      }
      render();
    }
    loading = false;
    if (!closed) {
      const all = uniqueQuoteTargets(ctx.state.holdings);
      if (all.length && all.every((target) => attempted.has(target.key)))
        recordPortfolioObservation(
          ctx.state,
          summarizePortfolio(ctx.state, quotes),
        );
    }
    render();
  }

  function refresh() {
    if (closed) return;
    render();
    void loadQuotes();
  }
  refresh();
  return {
    element,
    refresh,
    close: () => {
      closed = true;
      controller.abort();
    },
  };
}
