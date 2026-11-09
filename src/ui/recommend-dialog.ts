import {
  availableUnits,
  changeState,
  findPage,
  normalize,
  setPageLayout,
  type Palette,
} from '../domain/personal';
import { suggestPages, type Preferences } from '../domain/recommend';
import {
  action,
  choices,
  check,
  el,
  errorText,
  field,
  input,
  message,
  modal,
  select,
} from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';
import { renderPocketGrid } from './binder-view';

export function openRecommendations(
  ctx: WorkspaceContext,
  pageId: string,
): void {
  const sheet = modal('Deine nächste Binderseite', true);
  const introduction = message(
    'Wir verwenden nur bestätigte, verfügbare Exemplare. Fixierte Plätze bleiben erhalten. Du entscheidest, welcher Entwurf zu dir passt.',
  );
  const form = el('form', 'w-preference-form');
  const goal = choices(
    '1. Was soll diese Seite verbinden?',
    [
      ['story', 'Beziehungen und Entwicklungsreihen'],
      ['artist', 'Ein bestimmter Illustrator'],
      ['visual', 'Bildfarben und Komposition'],
    ],
    'story',
  );
  const units = availableUnits(ctx.state, pageId);
  const available = ctx.state.holdings.filter((holding) =>
    units.some((unit) => unit.holdingId === holding.id),
  );
  const artists = [
    ...new Set(
      ctx.state.holdings
        .filter(
          (holding) =>
            holding.card.artist && holding.card.artistSource !== 'unknown',
        )
        .map((holding) => holding.card.artist),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const artist = select([
    ['', 'Illustrator auswählen'],
    ...artists.map(
      (name) =>
        [
          name,
          `${name} · ${available.filter((holding) => normalize(holding.card.artist) === normalize(name)).length} freie Ausgaben`,
        ] as [string, string],
    ),
  ]);
  for (const option of artist.options) {
    if (option.value)
      option.disabled = !available.some(
        (holding) => normalize(holding.card.artist) === normalize(option.value),
      );
  }
  artist.disabled = !available.some(
    (holding) => holding.card.artist && holding.card.artistSource !== 'unknown',
  );
  const artistHint = message(
    !ctx.state.holdings.length
      ? 'Dein bestätigter Bestand ist noch leer. Entdecke Illustratoren im Katalog und füge eigene Karten hinzu.'
      : !available.length
        ? 'Deine Exemplare sind bereits für Binderseiten reserviert. Gib dort einen Platz frei oder bestätige weitere eigene Exemplare. Der Katalog bleibt zum Stöbern verfügbar.'
        : artist.disabled
          ? 'Bei deinen freien Karten fehlen noch Illustrator-Credits. Ergänze sie in den Kartendetails oder wähle die genaue Katalogausgabe.'
          : 'Hier erscheinen die Illustratoren deiner eigenen Karten. Reservierte Ausgaben sind nicht erneut verfügbar.',
  );
  const artistField = el(
    'div',
    'w-artist-empty',
    field('Illustrator aus deinem Bestand', artist),
    artistHint,
    action(
      'Illustratoren im Katalog entdecken',
      () => {
        sheet.close();
        ctx.openAdd({ browse: true });
      },
      'secondary',
    ),
  );
  artistField.hidden = true;
  goal.addEventListener('change', () => {
    artistField.hidden = goal.value !== 'artist';
  });
  const anchor = select([
    ['', 'Keine Pflichtkarte'],
    ...available.map(
      (holding) =>
        [holding.id, `${holding.card.name} · ${holding.card.number}`] as [
          string,
          string,
        ],
    ),
  ]);
  const anchorSlot = select(
    Array.from(
      { length: 9 },
      (_, index) =>
        [
          String(index),
          `Platz ${index + 1}${index === 4 ? ' · Mitte' : ''}`,
        ] as [string, string],
    ),
    '4',
  );
  const excludes = el('div', 'w-exclusion-list');
  const excluded = new Map<string, HTMLInputElement>();
  for (const holding of available) {
    const item = check(`${holding.card.name} · ${holding.card.number}`);
    excluded.set(holding.id, item.input);
    excludes.append(item.row);
  }
  const repeat = check(
    'Dieselbe Kartenausgabe darf mehrfach vorkommen, wenn genügend Exemplare frei sind.',
  );
  const restrictions = el(
    'details',
    'w-preference-details',
    el('summary', '', '3. Was soll draußen bleiben? (optional)'),
    message(
      'Markierte Ausgaben werden ausgeschlossen. Bereits festgehaltene Plätze kannst du im Binder ändern.',
    ),
    excludes,
    repeat.row,
  );
  const status = el('div', 'w-form-notices');
  status.setAttribute('aria-live', 'polite');
  const results = el('div', 'w-proposals');
  const generate = action(
    'Vorschläge ansehen',
    () => undefined,
    'primary',
    'spark',
  );
  generate.type = 'submit';
  generate.disabled = !available.length;
  form.append(
    goal.element,
    artistField,
    el(
      'fieldset',
      'w-anchor-question',
      el('legend', '', '2. Welche Karte muss hinein? (optional)'),
      el(
        'div',
        'w-form-grid',
        field('Pflichtkarte', anchor),
        field('Ihr fester Platz', anchorSlot),
      ),
    ),
    restrictions,
    generate,
  );
  sheet.body.append(introduction, form, status, results);
  let cancelled = false;
  let running = false;
  sheet.onClose(() => {
    cancelled = true;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void generatePages();
  });
  async function generatePages(): Promise<void> {
    if (running) return;
    const preferences: Preferences = {
      goal: goal.value as Preferences['goal'],
      artist: artist.value,
      anchorId: anchor.value || undefined,
      anchorSlot: Number(anchorSlot.value),
      excludedIds: [...excluded]
        .filter(([, control]) => control.checked)
        .map(([id]) => id),
      allowRepeats: repeat.input.checked,
    };
    if (
      preferences.goal === 'artist' &&
      (artist.disabled || !preferences.artist)
    ) {
      status.replaceChildren(
        message(
          artist.disabled
            ? (artistHint.textContent ??
                'Keine freien Karten mit Illustrator verfügbar.')
            : 'Wähle einen Illustrator mit freien Karten aus deinem Bestand.',
          'error',
        ),
      );
      return;
    }
    running = true;
    generate.disabled = true;
    results.replaceChildren();
    cancelled = false;
    const progress = el('p', 'w-muted', 'Verfügbare Karten werden geprüft …');
    const stop = action(
      'Abbrechen',
      () => {
        cancelled = true;
        progress.textContent = 'Abgebrochen. Dein Binder bleibt unverändert.';
      },
      'text',
    );
    status.replaceChildren(progress, stop);
    try {
      const relevant = available.filter(
        (holding) =>
          !preferences.excludedIds.includes(holding.id) &&
          (preferences.goal !== 'artist' ||
            normalize(holding.card.artist) === normalize(preferences.artist)),
      );
      const measured = new Map<string, Palette>();
      let complete = 0;
      const pending = [...relevant]
        .sort((a, b) => Number(b.favorite) - Number(a.favorite))
        .slice(0, 240);
      let next = 0;
      const work = async () => {
        while (next < pending.length && !cancelled) {
          const holding = pending[next++]!;
          const palette = await ctx.images.palette(holding.card);
          if (palette) measured.set(holding.id, palette);
          complete++;
          if (!cancelled)
            progress.textContent = `Bildfarben geprüft: ${complete} von ${pending.length} Ausgaben …`;
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(4, pending.length) }, work),
      );
      if (cancelled) return;
      if (measured.size)
        ctx.commit(
          'Bildmerkmale ergänzt',
          (state) =>
            changeState(state, (copy) => {
              for (const holding of copy.holdings) {
                const palette = measured.get(holding.id);
                if (palette) holding.card.palette = palette;
              }
            }),
          { undo: false, notify: false },
        );
      const proposals = suggestPages(ctx.state, pageId, preferences);
      status.replaceChildren(
        message(
          `${proposals.length} unterschiedliche ${proposals.length === 1 ? 'Seitenidee' : 'Seitenideen'}.${relevant.length > 240 ? ' Bildfarben wurden für bis zu 240 Ausgaben geprüft.' : ''} Du kannst jede Idee anschließend bearbeiten.`,
        ),
      );
      for (const proposal of proposals) {
        const preview = renderPocketGrid(
          ctx,
          { id: `preview-${proposal.id}`, slots: proposal.slots },
          true,
        );
        const use = action(
          'Diesen Entwurf übernehmen',
          () => {
            if (
              ctx.commit('Seitenentwurf übernommen', (state) =>
                setPageLayout(state, pageId, proposal.slots),
              )
            )
              sheet.close();
          },
          'primary',
          'check',
        );
        results.append(
          el(
            'article',
            'w-proposal',
            el(
              'div',
              'w-proposal-heading',
              el('h3', '', proposal.title),
              el('span', 'w-badge', `${proposal.filled}/9`),
            ),
            preview,
            el('p', 'w-muted', proposal.description),
            use,
          ),
        );
      }
      if (!findPage(ctx.state, pageId).assembled)
        results.append(
          message(
            'Die Übernahme reserviert die gewählten Exemplare für diesen Entwurf. Markiere den realen Aufbau später im Binder selbst.',
          ),
        );
    } catch (error) {
      status.replaceChildren(message(errorText(error), 'error'));
    } finally {
      running = false;
      generate.disabled = false;
    }
  }
  if (!available.length)
    status.replaceChildren(
      message(
        'Für neue Vorschläge fehlen freie Exemplare. Bereits reservierte Karten anderer Seiten werden nicht noch einmal verwendet.',
      ),
    );
  // A plain preference form intentionally stays available after viewing proposals.
  const hidden = input('hidden');
  hidden.name = 'page';
  hidden.value = pageId;
  form.append(hidden);
}
