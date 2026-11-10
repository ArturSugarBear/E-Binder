import {
  addWish,
  availableUnits,
  cardForSlot,
  changeState,
  createBinder,
  emptySlots,
  findPage,
  placeUnit,
  sameCard,
  setPageLayout,
  swapSlots,
  templateSlots,
  uid,
  unitKey,
  type PersonalPage,
} from '../domain/personal';
import {
  action,
  check,
  el,
  field,
  input,
  message,
  modal,
  select,
} from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';
import { openRecommendations } from './recommend-dialog';
import { enableSwipe } from './swipe';
import { cloudClient } from '../data/supabase';

let pendingPageSwipe: -1 | 0 | 1 = 0;

export function newBinder(ctx: WorkspaceContext): void {
  textPrompt(
    'Neuen Binder anlegen',
    'Name deines Binders',
    'Mein Binder',
    (name) =>
      ctx.commit('Binder angelegt', (state) => createBinder(state, name)),
  );
}
export function textPrompt(
  title: string,
  label: string,
  value: string,
  save: (text: string) => boolean,
): void {
  const sheet = modal(title);
  const name = input('text', value);
  name.required = true;
  name.maxLength = 200;
  const submit = action('Speichern', () => undefined, 'primary', 'check');
  submit.type = 'submit';
  const form = el('form', 'w-form', field(label, name), submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (save(name.value)) sheet.close();
  });
  sheet.body.append(form);
  name.focus();
  name.select();
}
export function renderBinders(ctx: WorkspaceContext): HTMLElement {
  const root = el('section', 'w-binders');
  root.append(
    el(
      'div',
      'w-page-heading',
      el(
        'div',
        '',
        el('p', 'w-eyebrow', 'Dein persönliches Sammelalbum'),
        el('h1', '', 'Deine Binder'),
        el(
          'p',
          'w-lead',
          'Neun Plätze. Deine Karten. Ein Zusammenhang, der dir gefällt.',
        ),
      ),
      el(
        'div',
        'w-action-row',
        action(
          'Binderseite scannen',
          () => ctx.openPageScan(),
          'primary',
          'camera',
        ),
        action('Neuer Binder', () => newBinder(ctx), 'secondary', 'plus'),
      ),
    ),
  );
  if (!ctx.state.binders.length) {
    root.append(
      el(
        'div',
        'w-empty',
        el('h2', '', 'Deine erste Seite wartet.'),
        el(
          'p',
          '',
          'Beginne mit einer leeren Seite oder übernimm eine Inspirationsvorlage. Vorhandene und geplante Karten bleiben klar getrennt.',
        ),
        action(
          'Ersten Binder anlegen',
          () => newBinder(ctx),
          'primary',
          'binder',
        ),
      ),
    );
    return root;
  }
  const binder =
    ctx.state.binders.find((item) => item.id === ctx.state.lastBinderId) ??
    ctx.state.binders[0]!;
  const page =
    binder.pages.find((item) => item.id === ctx.state.lastPageId) ??
    binder.pages[0]!;
  const pageIndex = binder.pages.indexOf(page);
  const choosePage = (id: string) =>
    ctx.commit(
      'Binderseite geöffnet',
      (state) =>
        changeState(state, (next) => {
          next.lastBinderId = binder.id;
          next.lastPageId = id;
        }),
      { undo: false, notify: false },
    );
  const binderSelect = select(
    ctx.state.binders.map((item) => [item.id, item.name]),
    binder.id,
  );
  binderSelect.dataset.focus = 'binder-select';
  binderSelect.addEventListener('change', () =>
    ctx.commit(
      'Binder geöffnet',
      (state) =>
        changeState(state, (next) => {
          next.lastBinderId = binderSelect.value;
          next.lastPageId = next.binders.find(
            (item) => item.id === binderSelect.value,
          )!.pages[0]!.id;
        }),
      { undo: false, notify: false },
    ),
  );
  const sidebar = el(
    'aside',
    'w-binder-sidebar',
    ctx.state.binders.length > 1
      ? field('Binder auswählen', binderSelect)
      : el('h2', 'w-single-binder-name', binder.name),
  );
  const pages = el('nav', 'w-page-list');
  pages.setAttribute('aria-label', 'Deine Binderseiten');
  for (const [itemIndex, item] of binder.pages.entries()) {
    const button = action(
      `${String(itemIndex + 1).padStart(2, '0')} ${item.title}`,
      () => choosePage(item.id),
      'page',
    );
    button.setAttribute('aria-current', item.id === page.id ? 'page' : 'false');
    button.append(
      el(
        'small',
        '',
        `${item.slots.filter((slot) => slot?.kind === 'owned').length}/9 zugeordnet${item.assembled ? ' · aufgebaut' : ''}`,
      ),
    );
    pages.append(button);
  }
  const controls = el('details', 'w-page-controls');
  controls.open = !matchMedia('(max-width: 640px)').matches;
  controls.append(
    el(
      'summary',
      '',
      `${binder.pages.length} ${binder.pages.length === 1 ? 'Seite' : 'Seiten'} · Seiten verwalten`,
    ),
  );
  controls.append(
    pages,
    action(
      'Leere Seite hinzufügen',
      () =>
        ctx.commit('Seite hinzugefügt', (state) =>
          changeState(state, (next) => {
            const target = next.binders.find((item) => item.id === binder.id)!;
            const added = {
              id: uid(),
              title: `Seite ${target.pages.length + 1}`,
              slots: emptySlots(),
              assembled: false,
            };
            target.pages.push(added);
            next.lastBinderId = target.id;
            next.lastPageId = added.id;
          }),
        ),
      'text',
      'plus',
    ),
    action(
      'Binder umbenennen',
      () =>
        textPrompt('Binder umbenennen', 'Name', binder.name, (name) =>
          ctx.commit('Binder umbenannt', (state) =>
            changeState(state, (next) => {
              next.binders.find((item) => item.id === binder.id)!.name =
                name.trim();
            }),
          ),
        ),
      'text',
    ),
  );
  if (ctx.account && ctx.state.mode !== 'demo')
    controls.append(
      action(
        'Binder teilen',
        () => {
          const sheet = modal('Binder teilen');
          const shared = check(
            'Diesen Binder über einen Link öffentlich ansehen lassen.',
            binder.isPublic,
          );
          const status = message(
            'Freigegeben werden Kartenmotive und ihre Plätze. Bestandsmengen, eigene Originalfotos und private Notizen bleiben privat.',
          );
          const save = action(
            'Freigabe speichern',
            () => {
              if (
                ctx.commit('Binderfreigabe geändert', (state) =>
                  changeState(state, (next) => {
                    next.binders.find(
                      (item) => item.id === binder.id,
                    )!.isPublic = shared.input.checked;
                  }),
                )
              ) {
                save.disabled = true;
                void ctx.store
                  .save(ctx.state)
                  .then(async () => {
                    const { data, error } = await cloudClient!
                      .from('binders')
                      .select('id,is_public')
                      .eq('client_id', binder.id)
                      .eq(
                        'user_id',
                        (await cloudClient!.auth.getSession()).data.session!
                          .user.id,
                      )
                      .single();
                    if (
                      error ||
                      !data ||
                      data.is_public !== shared.input.checked
                    )
                      throw new Error(
                        'Die Freigabe ist noch nicht synchronisiert. Öffne die Kontoeinstellungen.',
                      );
                    status.replaceChildren();
                    if (data.is_public) {
                      const link = el(
                        'a',
                        'w-text-link',
                        'Öffentlichen Binder öffnen',
                      );
                      link.href = `${location.origin}${location.pathname}#geteilt/${data.id}`;
                      link.target = '_blank';
                      link.rel = 'noopener';
                      const address = input('text', link.href);
                      address.readOnly = true;
                      status.append(
                        field('Link zum Weitergeben', address),
                        link,
                      );
                    } else
                      status.textContent =
                        'Dieser Binder ist privat. Bisherige Links geben keinen Zugriff mehr.';
                  })
                  .catch(() => {
                    status.textContent =
                      'Die Freigabe konnte nicht bestätigt werden. Prüfe deine Cloud-Verbindung.';
                  })
                  .finally(() => {
                    save.disabled = false;
                  });
              }
            },
            'primary',
          );
          sheet.body.append(status, shared.row);
          sheet.footer.append(save);
        },
        'text',
      ),
    );
  sidebar.append(controls);
  const owned = page.slots.filter((slot) => slot?.kind === 'owned').length;
  const planned = page.slots.filter((slot) => slot?.kind === 'planned').length;
  const title = el(
    'div',
    'w-binder-title',
    el(
      'div',
      '',
      el(
        'p',
        'w-eyebrow',
        `${binder.name} · Seite ${pageIndex + 1} von ${binder.pages.length}`,
      ),
      el('h2', '', page.title),
    ),
    action(
      'Seitentitel ändern',
      () =>
        textPrompt('Seite umbenennen', 'Titel', page.title, (text) =>
          ctx.commit('Seitentitel geändert', (state) =>
            changeState(state, (next) => {
              findPage(next, page.id).title = text.trim();
            }),
          ),
        ),
      'text',
    ),
  );
  const proposals = action(
    'Seiten vorschlagen',
    () => openRecommendations(ctx, page.id),
    'primary',
    'spark',
  );
  const toolbar = el(
    'div',
    'w-binder-toolbar',
    proposals,
    action(
      'Vorlage übernehmen',
      () => openTemplates(ctx, page.id),
      'secondary',
      'cards',
    ),
  );
  const grid = renderPocketGrid(ctx, page, false);
  const paper = el(
    'div',
    'w-binder-paper',
    el('div', 'w-binder-rings', el('i'), el('i'), el('i')),
    grid,
  );
  paper.classList.add('w-binder-gesture-zone');
  paper.setAttribute('role', 'group');
  paper.setAttribute(
    'aria-label',
    `Binderseite ${pageIndex + 1} von ${binder.pages.length}. Zum Blättern nach links oder rechts wischen.`,
  );
  if (pendingPageSwipe) {
    paper.classList.add(
      pendingPageSwipe > 0 ? 'is-page-arriving-next' : 'is-page-arriving-previous',
    );
    pendingPageSwipe = 0;
  }
  enableSwipe(paper, (step) => {
    if (document.querySelector('.w-dialog[open]')) return;
    const adjacent = binder.pages[pageIndex + step];
    if (!adjacent) return;
    pendingPageSwipe = step;
    if (!choosePage(adjacent.id)) pendingPageSwipe = 0;
  });
  const assembly = action(
    page.assembled ? 'Aufbau-Markierung aufheben' : 'Als aufgebaut markieren',
    () => {
      if (!owned) {
        ctx.notify(
          'Ordne zuerst eigene Exemplare zu. Geplante Motive sind noch kein physischer Aufbau.',
          true,
        );
        return;
      }
      ctx.commit(
        page.assembled
          ? 'Aufbau-Markierung aufgehoben'
          : 'Seite als aufgebaut markiert',
        (state) =>
          changeState(state, (next) => {
            const target = findPage(next, page.id);
            target.assembled = !target.assembled;
            if (target.assembled) target.assembledAt = new Date().toISOString();
            else delete target.assembledAt;
          }),
      );
    },
    'secondary',
    'check',
  );
  const info = el(
    'div',
    'w-binder-meta',
    el(
      'p',
      '',
      el('strong', '', `${owned}/9`),
      ' eigene Exemplare zugeordnet',
      planned ? ` · ${planned} geplant` : '',
      ` · ${9 - owned - planned} frei`,
    ),
    el(
      'p',
      'w-muted',
      page.assembled
        ? 'Von dir als aufgebaut markiert. Eine neue Anordnung setzt diese Markierung zurück.'
        : 'Entwurf: Zuordnungen reservieren deine Exemplare. Markiere die Seite erst nach deinem physischen Aufbau.',
    ),
    el(
      'div',
      'w-action-row',
      assembly,
      action(
        'Seite entfernen',
        () => deletePage(ctx, binder.id, page.id),
        'text',
        'trash',
      ),
    ),
  );
  const previous = action(
    'Vorherige Seite',
    () => choosePage(binder.pages[pageIndex - 1]!.id),
    'text',
  );
  previous.disabled = pageIndex === 0;
  const next = action(
    'Nächste Seite',
    () => choosePage(binder.pages[pageIndex + 1]!.id),
    'text',
  );
  next.disabled = pageIndex === binder.pages.length - 1;
  const workspace = el(
    'div',
    'w-binder-workspace',
    title,
    toolbar,
    paper,
    el(
      'nav',
      'w-page-pager',
      previous,
      el('span', 'w-mono', `${pageIndex + 1} / ${binder.pages.length}`),
      next,
    ),
    info,
  );
  const inventory = el(
    'aside',
    'w-page-inspector',
    el('p', 'w-eyebrow', 'Auf dieser Seite'),
  );
  for (const [slotIndex, slot] of page.slots.entries()) {
    const card = cardForSlot(ctx.state, slot);
    const button = action(
      `${slotIndex + 1}. ${card?.name ?? 'Freier Platz'}`,
      () => openSlot(ctx, page.id, slotIndex),
      'slot-row',
    );
    button.append(
      el(
        'small',
        '',
        slot?.locked
          ? 'Festgehalten'
          : slot?.kind === 'planned'
            ? 'Geplant'
            : slot?.kind === 'owned'
              ? `Exemplar ${slot.copy}`
              : 'Karte auswählen',
      ),
    );
    inventory.append(button);
  }
  inventory.append(
    message(
      'Klicke einen Platz zum Belegen, Fixieren oder Tauschen. Ziehen funktioniert zusätzlich mit der Maus.',
    ),
  );
  root.append(el('div', 'w-binder-layout', sidebar, workspace, inventory));
  return root;
}

export function renderPocketGrid(
  ctx: WorkspaceContext,
  page: Pick<PersonalPage, 'id' | 'slots'>,
  preview = false,
): HTMLElement {
  const grid = el(
    'div',
    `w-pocket-grid${preview ? ' w-pocket-grid-preview' : ''}`,
  );
  for (const [index, slot] of page.slots.entries()) {
    const card = cardForSlot(ctx.state, slot);
    const pocket = el(
      preview ? 'span' : 'button',
      `w-pocket${slot?.kind === 'planned' ? ' w-pocket-planned' : ''}${slot?.locked ? ' is-locked' : ''}`,
    );
    if (pocket instanceof HTMLButtonElement) {
      pocket.type = 'button';
      pocket.setAttribute(
        'aria-label',
        `Platz ${index + 1}: ${card?.name ?? 'frei'}${slot?.kind === 'planned' ? ', geplant' : ''}${slot?.locked ? ', festgehalten' : ''}`,
      );
      pocket.dataset.focus = `pocket-${page.id}-${index}`;
      pocket.addEventListener('click', () => openSlot(ctx, page.id, index));
    }
    if (card) pocket.append(ctx.images.artwork(card));
    else
      pocket.append(
        el(
          'span',
          'w-empty-pocket',
          el('span', 'w-pocket-number', String(index + 1).padStart(2, '0')),
          preview ? null : el('span', '', 'Karte auswählen'),
        ),
      );
    if (slot?.locked) pocket.append(el('span', 'w-pocket-lock', 'Fest'));
    if (slot?.kind === 'planned')
      pocket.append(el('span', 'w-planned-label', 'Geplant'));
    if (!preview) {
      pocket.draggable = Boolean(slot && !slot.locked);
      pocket.addEventListener('dragstart', (event) => {
        if (!(event instanceof DragEvent) || !event.dataTransfer) return;
        event.dataTransfer.setData(
          'application/x-e-binder-slot',
          JSON.stringify({ pageId: page.id, index }),
        );
        event.dataTransfer.effectAllowed = 'move';
      });
      pocket.addEventListener('dragover', (event) => {
        if (
          event instanceof DragEvent &&
          event.dataTransfer?.types.includes('application/x-e-binder-slot') &&
          !slot?.locked
        ) {
          event.preventDefault();
          pocket.classList.add('is-drag-target');
        }
      });
      pocket.addEventListener('dragleave', () =>
        pocket.classList.remove('is-drag-target'),
      );
      pocket.addEventListener('drop', (event) => {
        if (!(event instanceof DragEvent)) return;
        event.preventDefault();
        pocket.classList.remove('is-drag-target');
        try {
          const raw = JSON.parse(
            event.dataTransfer?.getData('application/x-e-binder-slot') ?? '{}',
          ) as { pageId?: string; index?: number };
          if (
            raw.pageId === page.id &&
            Number.isInteger(raw.index) &&
            raw.index !== index
          )
            ctx.commit('Binderplätze getauscht', (state) =>
              swapSlots(state, page.id, raw.index!, index),
            );
        } catch {
          ctx.notify('Dieser Platz konnte nicht verschoben werden.', true);
        }
      });
    }
    grid.append(pocket);
  }
  return grid;
}

function openSlot(ctx: WorkspaceContext, pageId: string, index: number): void {
  const page = findPage(ctx.state, pageId);
  const slot = page.slots[index] ?? null;
  const card = cardForSlot(ctx.state, slot);
  const sheet = modal(`Platz ${index + 1}${card ? ` · ${card.name}` : ''}`);
  if (card)
    sheet.body.append(
      el(
        'div',
        'w-holding-preview',
        ctx.images.artwork(card),
        el(
          'div',
          '',
          el('h3', '', card.name),
          el('p', 'w-muted', `${card.setName} · ${card.number}`),
          message(
            slot?.kind === 'planned'
              ? 'Geplantes Motiv: noch kein Exemplar zugeordnet.'
              : 'Ein bestätigtes Exemplar ist für diese Seite reserviert.',
          ),
        ),
      ),
    );
  if (slot) {
    const lock = action(
      slot.locked ? 'Fixierung lösen' : 'Platz festhalten',
      () => {
        if (
          ctx.commit(
            slot.locked ? 'Fixierung gelöst' : 'Platz festgehalten',
            (state) =>
              changeState(state, (next) => {
                const target = findPage(next, pageId).slots[index];
                if (target) target.locked = !target.locked;
              }),
          )
        )
          sheet.close();
      },
      'secondary',
      'lock',
    );
    const clear = action(
      'Platz leeren',
      () => {
        const slots = structuredClone(page.slots);
        slots[index] = null;
        if (
          ctx.commit('Binderplatz geleert', (state) =>
            setPageLayout(state, pageId, slots),
          )
        )
          sheet.close();
      },
      'text',
      'trash',
    );
    clear.disabled = slot.locked;
    sheet.body.append(el('div', 'w-action-row', lock, clear));
    const options = page.slots.flatMap((item, destination) =>
      destination !== index && !item?.locked
        ? [
            [
              String(destination),
              `Platz ${destination + 1}${cardForSlot(ctx.state, item) ? ` · ${cardForSlot(ctx.state, item)!.name}` : ' · frei'}`,
            ] as [string, string],
          ]
        : [],
    );
    if (options.length) {
      const target = select(options, options[0]![0]);
      const move = action(
        'Verschieben / tauschen',
        () => {
          if (
            ctx.commit('Binderplätze getauscht', (state) =>
              swapSlots(state, pageId, index, Number(target.value)),
            )
          )
            sheet.close();
        },
        'secondary',
        'swap',
      );
      move.disabled = slot.locked;
      sheet.body.append(
        el('div', 'w-move-control', field('Zielplatz', target), move),
      );
    }
    if (slot.kind === 'owned')
      sheet.body.append(
        action(
          'Bestand und Ablage ansehen',
          () => {
            sheet.close();
            ctx.openHolding(slot.holdingId);
          },
          'text',
          'cards',
        ),
      );
    if (slot.kind === 'planned' && card)
      sheet.body.append(
        action(
          'Diese Ausgabe hinzufügen',
          () => {
            sheet.close();
            ctx.openAdd({ card });
          },
          'primary',
          'plus',
        ),
      );
    if (card)
      sheet.body.append(
        action(
          'Auf die Wunschliste',
          () => {
            if (
              ctx.commit('Wunschkarte hinzugefügt', (state) =>
                addWish(state, card),
              )
            )
              ctx.notify(
                'Wunsch gespeichert. Besitz und Binderbelegung bleiben unverändert.',
              );
          },
          'text',
          'star',
        ),
      );
  }
  if (slot?.locked) return;
  const units = availableUnits(ctx.state, pageId);
  const search = input('search');
  search.placeholder = 'Freie Karte suchen';
  const choices = el('div', 'w-unit-choices');
  const render = () => {
    choices.replaceChildren();
    const available = units.filter((unit) => {
      const item = ctx.state.holdings.find(
        (holding) => holding.id === unit.holdingId,
      )!;
      return (
        (!search.value ||
          normalizeSearch(
            `${item.card.name} ${item.card.number} ${item.card.artist}`,
          ).includes(normalizeSearch(search.value))) &&
        !(slot?.kind === 'owned' && unitKey(slot) === unitKey(unit))
      );
    });
    available.sort((a, b) => {
      const cardA = ctx.state.holdings.find(
        (item) => item.id === a.holdingId,
      )!.card;
      const cardB = ctx.state.holdings.find(
        (item) => item.id === b.holdingId,
      )!.card;
      return (
        (card && sameCard(cardB, card) ? 1 : 0) -
          (card && sameCard(cardA, card) ? 1 : 0) ||
        cardA.name.localeCompare(cardB.name, 'de')
      );
    });
    for (const unit of available.slice(0, 80)) {
      const holding = ctx.state.holdings.find(
        (item) => item.id === unit.holdingId,
      )!;
      const onPage = page.slots.some(
        (item) => item?.kind === 'owned' && unitKey(item) === unitKey(unit),
      );
      const choose = action(
        holding.card.name,
        () => {
          if (
            ctx.commit('Exemplar zugeordnet', (state) =>
              placeUnit(state, pageId, index, unit),
            )
          )
            sheet.close();
        },
        'unit',
      );
      choose.replaceChildren(
        ctx.images.artwork(holding.card),
        el(
          'span',
          '',
          el('strong', '', holding.card.name),
          el(
            'small',
            '',
            `${holding.card.number} · Exemplar ${unit.copy}${onPage ? ' · wird auf dieser Seite verschoben' : ''}`,
          ),
        ),
      );
      choices.append(choose);
    }
    if (!available.length)
      choices.append(
        message(
          'Keine freie Karte passt. Bereits für andere Seiten oder zum Tausch reservierte Exemplare werden nicht erneut zugeordnet.',
        ),
      );
  };
  search.addEventListener('input', render);
  sheet.body.append(
    el('h3', '', 'Eigenes Exemplar zuordnen'),
    field('Im verfügbaren Bestand suchen', search),
    choices,
  );
  render();
}
function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('de')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function openTemplates(ctx: WorkspaceContext, pageId: string): void {
  const sheet = modal('Eine Seite aus deinen Inspirationen', true);
  sheet.body.append(
    message(
      'Vorhandene freie Exemplare werden zugeordnet. Alle anderen Motive bleiben als geplant markiert. Dein Besitz und deine Wunschliste werden nicht verändert.',
    ),
  );
  const list = el('div', 'w-template-list');
  for (const chapter of ctx.chapters) {
    const preview = el('div', 'w-template-covers');
    for (const id of chapter.covers) {
      const card = ctx.catalog.find((item) => item.sourceId === id);
      if (card) preview.append(ctx.images.artwork(card));
    }
    const choose = action(
      'Diese Vorlage übernehmen',
      () => {
        const target = findPage(ctx.state, pageId);
        const cards = chapter.cards
          .map((item) => ctx.catalog.find((card) => card.sourceId === item.id)!)
          .filter(Boolean);
        const ok = ctx.commit('Vorlagenseite angelegt', (state) =>
          changeState(state, (next) => {
            const binder = next.binders.find((item) =>
              item.pages.some((page) => page.id === pageId),
            )!;
            if (target.slots.every((slot) => !slot)) {
              const page = findPage(next, pageId);
              page.title = chapter.title;
              page.slots = templateSlots(next, cards);
              page.assembled = false;
            } else {
              const page = {
                id: uid(),
                title: chapter.title,
                slots: templateSlots(next, cards),
                assembled: false,
              };
              binder.pages.push(page);
              next.lastPageId = page.id;
            }
            next.lastBinderId = binder.id;
          }),
        );
        if (ok) sheet.close();
      },
      'secondary',
      'plus',
    );
    list.append(
      el(
        'article',
        'w-template',
        preview,
        el('h3', '', chapter.title),
        el('p', 'w-muted', chapter.description),
        choose,
      ),
    );
  }
  sheet.body.append(list);
}
function deletePage(
  ctx: WorkspaceContext,
  binderId: string,
  pageId: string,
): void {
  const sheet = modal('Seite entfernen');
  sheet.body.append(
    message(
      'Die Seite und ihre Reservierungen werden entfernt. Deine Exemplare und Wünsche bleiben erhalten. Die Aktion ist rückgängig machbar.',
    ),
  );
  sheet.footer.append(
    action('Abbrechen', sheet.close),
    action(
      'Seite entfernen',
      () => {
        if (
          ctx.commit('Seite entfernt', (state) =>
            changeState(state, (next) => {
              const binder = next.binders.find((item) => item.id === binderId)!;
              binder.pages = binder.pages.filter((page) => page.id !== pageId);
              if (!binder.pages.length) {
                next.binders = next.binders.filter(
                  (item) => item.id !== binderId,
                );
                next.lastBinderId = next.binders[0]?.id;
                next.lastPageId = next.binders[0]?.pages[0]?.id;
              } else next.lastPageId = binder.pages[0]!.id;
            }),
          )
        )
          sheet.close();
      },
      'danger',
      'trash',
    ),
  );
}
