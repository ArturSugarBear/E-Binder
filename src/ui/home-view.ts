import { localizedCardName } from '../data/japanese-catalog';
import { action, el, icon } from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';

/** Home is intentionally derived from confirmed state; it never invents market history. */
export function renderHome(ctx: WorkspaceContext): HTMLElement {
  const root = el('section', 'w-home');
  root.classList.toggle('is-first-visit', !ctx.state.holdings.length);
  const owned = ctx.state.holdings;
  const copies = owned.reduce((sum, holding) => sum + holding.quantity, 0);
  const pages = ctx.state.binders.reduce(
    (sum, binder) => sum + binder.pages.length,
    0,
  );
  const pending = ctx.state.captures.filter(
    (capture) => capture.status === 'pending',
  ).length;

  const lastBinder =
    ctx.state.binders.find((binder) => binder.id === ctx.state.lastBinderId) ??
    ctx.state.binders[0];
  const lastPage =
    lastBinder?.pages.find((page) => page.id === ctx.state.lastPageId) ??
    lastBinder?.pages[0];
  const continueHolding = lastPage?.slots
    .map((slot) =>
      slot && 'holdingId' in slot && slot.holdingId
        ? owned.find((holding) => holding.id === slot.holdingId)
        : undefined,
    )
    .find(Boolean);
  const scan = action(
    'Karte scannen',
    () => ctx.openLiveScan(),
    'primary',
    'camera',
  );
  const openCollection = action(
    'Sammlung öffnen',
    () => ctx.navigate('binder'),
    'secondary',
    'binder',
  );

  if (copies) {
    // Returning collectors see their own collection first, not marketing.
    root.append(
      el(
        'header',
        'w-home-returning',
        el('p', 'w-eyebrow', 'E-Binder · Deine Sammlung'),
        el('h1', '', 'Weiter sammeln'),
        el(
          'p',
          'w-home-intro',
          `${copies} Karten · ${ctx.state.binders.length} Binder${
            pending ? ` · ${pending} offene Scans` : ''
          }`,
        ),
        el('div', 'w-home-hero-actions', scan, openCollection),
      ),
    );
    if (lastBinder && lastPage) {
      const pageIndex = lastBinder.pages.indexOf(lastPage);
      const continueButton = action(
        `Weiter: ${lastBinder.name} · Seite ${pageIndex + 1}`,
        () => ctx.navigate('binder'),
        'card',
      );
      continueButton.classList.add('w-home-continue');
      continueButton.replaceChildren(
        el(
          'span',
          'w-home-continue-art',
          continueHolding
            ? ctx.images.artwork(continueHolding.card)
            : el('span', 'art-fallback', '3×3'),
        ),
        el(
          'span',
          'w-home-continue-copy',
          el('strong', '', lastBinder.name),
          el(
            'small',
            '',
            `Seite ${pageIndex + 1} · ${
              lastPage.slots.filter((slot) => slot?.kind === 'owned').length
            } belegt`,
          ),
        ),
        el('span', 'w-home-quick-arrow', icon('arrow')),
      );
      root.append(continueButton);
    }
  } else {
    const hero = el(
      'div',
      'w-home-hero-copy',
      el('p', 'w-eyebrow', 'E-Binder · Dein Sammelraum'),
      el('h1', '', 'Dein Fund. Dein Moment.'),
      el(
        'p',
        'w-home-intro',
        'Scanne deine erste Karte, bestätige ihre Ausgabe und gestalte deinen Binder.',
      ),
      el(
        'div',
        'w-home-hero-actions',
        action(
          'Karte live scannen',
          () => ctx.openLiveScan(),
          'primary',
          'camera',
        ),
        action(
          'Demo ansehen',
          () => {
            void ctx.switchMode('demo').then(() => {
              if (ctx.state.mode === 'demo') ctx.navigate('binder');
            });
          },
          'secondary',
          'binder',
        ),
      ),
    );
    const preview = el('div', 'w-home-art');
    for (const [index, card] of ctx.catalog.slice(0, 3).entries()) {
      const art = el('div', 'w-home-art-card', ctx.images.artwork(card));
      art.dataset.position = String(index);
      preview.append(art);
    }
    if (preview.childElementCount) {
      const note = el(
        'small',
        'w-home-art-note',
        'Inspiration · kein eigener Bestand',
      );
      preview.append(note);
    }
    root.append(el('header', 'w-home-hero w-glass-panel', hero, preview));
  }

  // The collection leads before marketing: recent cards come straight after
  // the hero. Onboarding stays a first-run section only.
  if (copies) {
    const latest = el(
      'section',
      'w-home-section',
      el(
        'div',
        'w-home-section-heading',
        el('h2', '', 'Zuletzt hinzugefügt'),
        action('Alle Karten', () => ctx.navigate('sammlung'), 'text', 'arrow'),
      ),
    );
    const recent = el('div', 'w-home-recent');
    for (const holding of [...owned]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)) {
      const button = action(
        `${holding.card.name} ansehen`,
        () => ctx.openHolding(holding.id),
        'card',
      );
      button.classList.add('w-home-recent-card');
      button.replaceChildren(
        el('div', 'w-home-recent-art', ctx.images.artwork(holding.card)),
        el(
          'div',
          '',
          el('strong', '', localizedCardName(holding.card)),
          el('small', '', `${holding.card.setName} · ${holding.card.number}`),
        ),
      );
      recent.append(button);
    }
    latest.append(recent);
    root.append(latest);
  }

  const firstPending = ctx.state.captures.find(
    (capture) => capture.status === 'pending',
  );
  root.append(
    el(
      'section',
      'w-home-quick',
      el(
        'div',
        'w-home-section-heading',
        el(
          'h2',
          '',
          copies ? 'Dein nächster Schritt' : 'Starte, wie du sammelst',
        ),
      ),
      el(
        'div',
        'w-home-quick-grid',
        quickAction(
          'Binderseite scannen',
          'Neun Karten auf einmal erfassen und einzeln prüfen',
          () => ctx.openPageScan(),
        ),
        quickAction(
          firstPending ? 'Offene Scans prüfen' : 'Sets entdecken',
          firstPending
            ? `${pending} Aufnahmen warten auf deine Bestätigung`
            : 'Neue Karten und passende Ausgaben finden',
          () =>
            firstPending
              ? ctx.openAdd({ captureId: firstPending.id })
              : ctx.navigate('entdecken'),
        ),
        quickAction(
          copies ? 'Binder öffnen' : 'Sammlung öffnen',
          copies
            ? `${pages} Seiten weitergestalten`
            : 'Lege deinen ersten Binder an',
          () => ctx.navigate('binder'),
        ),
      ),
    ),
  );

  if (!copies) {
    root.append(
      el(
        'section',
        'w-home-onboarding',
        el(
          'div',
          'w-home-section-heading',
          el('h2', '', 'So beginnt dein Binder'),
        ),
        el(
          'div',
          'w-home-steps',
          step(
            '01',
            'Karte scannen',
            'Halte die Karte in den Live-Rahmen. Wir helfen beim Ausrichten.',
          ),
          step(
            '02',
            'Ausgabe prüfen',
            'Kontrolliere Set, Nummer, Sprache und Variante vor dem Speichern.',
          ),
          step(
            '03',
            'Binder gestalten',
            'Ordne deine Karten auf echten 9-Pocket-Seiten an.',
          ),
        ),
      ),
    );
    return root;
  }

  const stats = el(
    'div',
    'w-home-stats',
    metric('Karten', String(copies), 'Bestätigter Bestand'),
    metric('Binder', String(ctx.state.binders.length), `${pages} Seiten`),
    metric('Offene Scans', String(pending), 'Noch zu prüfen'),
  );
  root.append(stats);

  const groups = new Map<string, { name: string; count: number }>();
  for (const holding of owned) {
    const key = `${holding.card.language}:${holding.card.setId || holding.card.setName}`;
    const group = groups.get(key) ?? { name: holding.card.setName, count: 0 };
    group.count += holding.quantity;
    groups.set(key, group);
  }
  const setSection = el(
    'section',
    'w-home-section',
    el(
      'div',
      'w-home-section-heading',
      el('h2', '', 'Deine Sets'),
      action(
        'Sets entdecken',
        () => ctx.navigate('entdecken'),
        'text',
        'arrow',
      ),
    ),
  );
  const sets = el('div', 'w-home-set-list');
  for (const set of [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4))
    sets.append(
      el(
        'div',
        'w-home-set-row w-glass-panel',
        el('span', 'w-home-set-mark', set.name.slice(0, 2).toUpperCase()),
        el(
          'span',
          '',
          el('strong', '', set.name),
          el('small', '', 'In deiner Sammlung'),
        ),
        el('b', '', `${set.count} Karten`),
      ),
    );
  setSection.append(sets);
  root.append(setSection);

  const shortcut = el(
    'section',
    'w-home-next w-glass-panel',
    el(
      'div',
      '',
      el('p', 'w-eyebrow', 'Dein nächster Fund'),
      el('h2', '', 'Was ist dein Binder wert?'),
      el(
        'p',
        '',
        'Entdecke verifizierte Preisreferenzen, Werte pro Binderseite und noch unbewertete Karten.',
      ),
    ),
    action(
      'Portfolio ansehen',
      () => ctx.navigate('portfolio'),
      'secondary',
      'arrow',
    ),
  );
  root.append(shortcut);
  return root;
}

function quickAction(
  title: string,
  description: string,
  onClick: () => void,
): HTMLElement {
  const button = action(title, onClick, 'secondary');
  button.classList.add('w-home-quick-tile');
  button.replaceChildren(
    el('strong', '', title),
    el('small', '', description),
    el('span', 'w-home-quick-arrow', icon('arrow')),
  );
  return button;
}

function step(index: string, title: string, explanation: string): HTMLElement {
  return el(
    'div',
    'w-home-step w-glass-panel',
    el('span', 'w-home-step-count', index),
    el('h3', '', title),
    el('p', '', explanation),
  );
}

function metric(title: string, value: string, caption: string): HTMLElement {
  return el(
    'div',
    'w-home-stat w-glass-panel',
    el('p', '', title),
    el('strong', '', value),
    el('small', '', caption),
  );
}
