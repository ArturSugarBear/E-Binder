import { action, el } from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';

/** Home is intentionally derived from confirmed state; it never invents market history. */
export function renderHome(ctx: WorkspaceContext): HTMLElement {
  const root = el('section', 'w-home');
  const owned = ctx.state.holdings;
  const copies = owned.reduce((sum, holding) => sum + holding.quantity, 0);
  const pages = ctx.state.binders.reduce(
    (sum, binder) => sum + binder.pages.length,
    0,
  );
  const pending = ctx.state.captures.filter(
    (capture) => capture.status === 'pending',
  ).length;

  const hero = el(
    'header',
    'w-home-hero w-glass-panel',
    el('p', 'w-eyebrow', 'Rare Room · Dein Sammelraum'),
    el('h1', '', copies ? 'Deine Sammlung. Deine Geschichte.' : 'Dein Fund. Dein Moment.'),
    el(
      'p',
      'w-home-intro',
      copies
        ? `${copies} Karten in deiner Sammlung. Jede verdient ihren Platz.`
        : 'Scanne deine erste Karte, bestätige ihre Ausgabe und gestalte deinen Binder.',
    ),
    el(
      'div',
      'w-home-hero-actions',
      action('Karte live scannen', () => ctx.openAdd({ live: true }), 'primary', 'camera'),
      action('Meine Binder', () => ctx.navigate('binder'), 'secondary', 'binder'),
    ),
  );
  const preview = el('div', 'w-home-art');
  for (const [index, holding] of [...owned]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)
    .entries()) {
    const art = el('div', 'w-home-art-card', ctx.images.artwork(holding.card));
    art.dataset.position = String(index);
    preview.append(art);
  }
  if (!preview.childElementCount) {
    preview.append(
      el('div', 'w-home-art-placeholder', '01'),
      el('div', 'w-home-art-placeholder', '02'),
      el('div', 'w-home-art-placeholder', '03'),
    );
  }
  hero.append(preview);
  root.append(hero);

  if (!copies) {
    root.append(
      el(
        'section',
        'w-home-onboarding',
        el('div', 'w-home-section-heading', el('h2', '', 'So beginnt dein Binder')),
        el(
          'div',
          'w-home-steps',
          step('01', 'Karte scannen', 'Halte die Karte in den Live-Rahmen. Wir helfen beim Ausrichten.'),
          step('02', 'Ausgabe prüfen', 'Kontrolliere Set, Nummer, Sprache und Variante vor dem Speichern.'),
          step('03', 'Binder gestalten', 'Ordne deine Karten auf echten 9-Pocket-Seiten an.'),
        ),
      ),
      action('Mit der ersten Karte starten', () => ctx.openAdd({ live: true }), 'primary', 'camera'),
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
      el('div', '', el('strong', '', holding.card.name), el('small', '', `${holding.card.setName} · ${holding.card.number}`)),
    );
    recent.append(button);
  }
  latest.append(recent);
  root.append(latest);

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
      action('Sets entdecken', () => ctx.navigate('entdecken'), 'text', 'arrow'),
    ),
  );
  const sets = el('div', 'w-home-set-list');
  for (const set of [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 4))
    sets.append(
      el(
        'div',
        'w-home-set-row w-glass-panel',
        el('span', 'w-home-set-mark', set.name.slice(0, 2).toUpperCase()),
        el('span', '', el('strong', '', set.name), el('small', '', 'In deiner Sammlung')),
        el('b', '', `${set.count} Karten`),
      ),
    );
  setSection.append(sets);
  root.append(setSection);

  const shortcut = el(
    'section',
    'w-home-next w-glass-panel',
    el('div', '', el('p', 'w-eyebrow', 'Dein nächster Fund'), el('h2', '', 'Was ist dein Binder wert?'), el('p', '', 'Entdecke verifizierte Preisreferenzen, Werte pro Binderseite und noch unbewertete Karten.')),
    action('Portfolio ansehen', () => ctx.navigate('portfolio'), 'secondary', 'arrow'),
  );
  root.append(shortcut);
  return root;
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
