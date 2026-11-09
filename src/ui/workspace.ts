import type { Collection } from '../domain/collection';
import {
  changeState,
  confirmHolding,
  createBinder,
  emptyState,
  validateState,
  type PersonalState,
} from '../domain/personal';
import { CardImages } from '../data/card-images';
import { editorialCards } from '../data/card-catalog';
import { PersonalStore } from '../data/personal-store';
import { CloudStore } from '../data/cloud-store';
import { cloudClient } from '../data/supabase';
import { openAccount } from './account-dialog';
import { renderSharedBinder } from './shared-binder';
import { loadCollection } from '../data/load-collection';
import { openAddCards } from './add-cards';
import { renderCollection, renderWishes, openHolding } from './collection-view';
import { createDiscoverView } from './discover-view';
import { renderBinders } from './binder-view';
import { openBackup } from './backup-dialog';
import { action, el, errorText, message } from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';

export async function startWorkspace(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#workspace-main')!;
  const status = document.querySelector<HTMLElement>('#workspace-save-status')!;
  const storageError = document.querySelector<HTMLElement>(
    '#workspace-storage-error',
  )!;
  const notice = document.querySelector<HTMLElement>('#workspace-notice')!;
  const undoButton =
    document.querySelector<HTMLButtonElement>('#workspace-undo')!;
  const demo = document.querySelector<HTMLElement>('#workspace-demo')!;
  const catalogError = document.querySelector<HTMLElement>(
    '#workspace-catalog-error',
  )!;
  const { data: sessionData } = cloudClient
    ? await cloudClient.auth.getSession()
    : { data: { session: null } };
  const session = sessionData.session;
  const account = session
    ? { username: session.user.email?.split('@')[0] ?? 'Konto' }
    : undefined;
  const store =
    session && cloudClient
      ? new CloudStore(cloudClient, session.user.id)
      : new PersonalStore();
  const accountButton =
    document.querySelector<HTMLButtonElement>('#workspace-account')!;
  accountButton.textContent = account ? 'Konto' : 'Anmelden';
  document.querySelector('.w-local-label')!.textContent = account
    ? `Konto · ${account.username}`
    : 'Persönlicher Bestand · nur auf diesem Gerät';
  let storedMode: PersonalState['mode'] = 'personal';
  try {
    if (localStorage.getItem('e-binder-mode') === 'demo') storedMode = 'demo';
  } catch {
    /* IndexedDB remains the authoritative store. */
  }
  let initial: PersonalState;
  try {
    initial = await store.load(storedMode);
  } catch (error) {
    root.replaceChildren(
      el(
        'div',
        'w-empty',
        el('h1', '', 'Dein lokaler Bestand konnte nicht geöffnet werden.'),
        message(errorText(error), 'error'),
        el(
          'p',
          '',
          'Deine gespeicherten Daten wurden nicht überschrieben. Prüfe die Speicherfreigabe deines Browsers und lade die Seite erneut.',
        ),
        action('Erneut laden', () => location.reload(), 'primary'),
      ),
    );
    status.textContent = 'Speicher nicht erreichbar';
    return;
  }
  const history: { state: PersonalState; label: string }[] = [];
  let saving: Promise<void> = Promise.resolve();
  let saveFailed = false;
  let blocked = false;
  let noticeTimer: ReturnType<typeof setTimeout>;
  let catalogLoading = false;
  let discovery: ReturnType<typeof createDiscoverView> | undefined;
  const ctx: WorkspaceContext = {
    account,
    state: initial,
    catalog: [],
    chapters: [],
    store,
    images: new CardImages(store, () => ctx.state.mode),
    filters: { query: '', kind: 'all', order: 'recent' },
    commit: (label, operation, options = {}) => {
      if (blocked) {
        ctx.notify(
          'Die Wiederherstellung läuft noch. Bitte warte auf den Abschluss.',
          true,
        );
        return false;
      }
      try {
        const previous = ctx.state;
        const candidate = operation(previous);
        if (candidate === previous) return true;
        const next = validateState(candidate);
        if (next.mode !== previous.mode)
          throw new Error('Demo und persönlicher Bestand bleiben getrennt.');
        if (options.undo !== false) {
          history.push({ state: structuredClone(previous), label });
          if (history.length > 20) history.shift();
        }
        ctx.state = next;
        ctx.render();
        persist(next);
        if (options.notify !== false) ctx.notify(label);
        return true;
      } catch (error) {
        ctx.notify(errorText(error), true);
        return false;
      }
    },
    notify: (text, isError = false) => {
      clearTimeout(noticeTimer);
      const dialog = document.querySelector<HTMLDialogElement>(
        '.w-dialog[open]:last-of-type',
      );
      const inline = dialog?.querySelector<HTMLElement>('.w-dialog-alerts');
      if (isError && inline) {
        inline.textContent = text;
        inline.hidden = false;
        return;
      }
      notice.replaceChildren(
        el('span', '', text),
        action(
          'Meldung schließen',
          () => {
            notice.hidden = true;
          },
          'icon',
          'close',
        ),
      );
      notice.hidden = false;
      notice.dataset.kind = isError ? 'error' : 'success';
      notice.setAttribute('role', isError ? 'alert' : 'status');
      if (!isError)
        noticeTimer = setTimeout(() => {
          notice.hidden = true;
        }, 4500);
    },
    render: () => {
      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;
      const focus =
        active && root.contains(active) ? active.dataset.focus : undefined;
      const route = location.hash.slice(1).split(/[/?]/)[0] || 'sammlung';
      for (const link of document.querySelectorAll<HTMLAnchorElement>(
        '[data-workspace-route]',
      ))
        link.setAttribute(
          'aria-current',
          link.dataset.workspaceRoute === route ? 'page' : 'false',
        );
      if (
        discovery &&
        (route !== 'entdecken' || discovery.currentHash !== location.hash)
      ) {
        discovery.close();
        discovery = undefined;
      }
      if (route === 'entdecken') {
        discovery ??= createDiscoverView(ctx);
        if (root.firstElementChild !== discovery.element)
          root.replaceChildren(discovery.element);
        discovery.refresh();
      } else
        root.replaceChildren(
          route === 'geteilt'
            ? renderSharedBinder(location.hash.split('/')[1] ?? '', ctx)
            : route === 'binder'
              ? renderBinders(ctx)
              : route === 'wunschliste'
                ? renderWishes(ctx)
                : renderCollection(ctx),
        );
      document.title = `${route === 'entdecken' ? 'Karten entdecken' : route === 'binder' ? 'Deine Binder' : route === 'wunschliste' ? 'Deine Wunschkarten' : 'Deine Sammlung'} · E-Binder`;
      demo.hidden = ctx.state.mode !== 'demo';
      undoButton.hidden = !history.length;
      undoButton.disabled = !history.length;
      undoButton.setAttribute(
        'aria-label',
        history.length ? `Rückgängig: ${history.at(-1)!.label}` : 'Rückgängig',
      );
      if (focus)
        root
          .querySelector<HTMLElement>(`[data-focus="${CSS.escape(focus)}"]`)
          ?.focus({ preventScroll: true });
      root.dataset.ready = 'true';
      try {
        localStorage.setItem('e-binder-route', route);
      } catch {
        /* Navigation still works without localStorage. */
      }
    },
    navigate: (route) => {
      if (location.hash !== `#${route}`) historyPush(route);
      ctx.render();
      root.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    openAdd: (options) => openAddCards(ctx, options),
    openHolding: (id) => openHolding(ctx, id),
    openBackup: () => openBackup(ctx),
    switchMode: async (mode) => {
      await saving;
      if (saveFailed) {
        ctx.notify(
          'Sichere deine ungespeicherten Änderungen oder wiederhole das Speichern, bevor du den Modus wechselst.',
          true,
        );
        return;
      }
      try {
        let state = await store.load(mode);
        if (mode === 'demo' && !state.holdings.length) {
          if (!ctx.catalog.length) {
            ctx.notify(
              'Die Demo benötigt die Inspirationskarten. Lade die Vorlagen erneut.',
              true,
            );
            return;
          }
          state = demoState(ctx.chapters);
          await store.save(state);
        }
        ctx.state = state;
        history.length = 0;
        ctx.filters = { query: '', kind: 'all', order: 'recent' };
        try {
          localStorage.setItem('e-binder-mode', mode);
        } catch {
          /* Mode is also visibly labelled. */
        }
        saved();
        ctx.navigate('sammlung');
      } catch (error) {
        ctx.notify(errorText(error), true);
      }
    },
    restore: async (incoming) => {
      await saving;
      blocked = true;
      try {
        const previous = ctx.state;
        const snapshot = validateState({
          ...incoming,
          mode: previous.mode,
          revision: previous.revision + 1,
        });
        status.textContent = 'Wiederherstellung läuft …';
        status.dataset.state = 'saving';
        await store.save(snapshot);
        history.push({
          state: structuredClone(previous),
          label: 'Sicherung wiederhergestellt',
        });
        ctx.state = snapshot;
        saveFailed = false;
        storageError.hidden = true;
        ctx.render();
        saved();
        ctx.notify('Sicherung vollständig wiederhergestellt.');
        return true;
      } catch (error) {
        ctx.notify(errorText(error), true);
        return false;
      } finally {
        blocked = false;
      }
    },
  };
  function saved(): void {
    status.textContent =
      ctx.state.mode === 'demo'
        ? 'Demo gespeichert'
        : store instanceof CloudStore
          ? store.syncError
            ? 'Lokal gesichert · Cloud ausstehend'
            : 'Im Konto gespeichert'
          : 'Auf diesem Gerät gespeichert';
    status.dataset.state =
      store instanceof CloudStore && store.syncError ? 'error' : 'saved';
    if (store instanceof CloudStore && store.syncError) {
      storageError.hidden = false;
      storageError.replaceChildren(
        message(store.syncError, 'error'),
        action(
          'Konto und Synchronisierung',
          () => {
            void openAccount(ctx, () => saving);
          },
          'secondary',
        ),
        action('Sicherung herunterladen', ctx.openBackup, 'secondary'),
      );
    }
  }
  function persist(snapshot: PersonalState): void {
    status.textContent = 'Wird gespeichert …';
    status.dataset.state = 'saving';
    saving = store
      .save(snapshot)
      .then(() => {
        saveFailed = false;
        storageError.hidden = true;
        if (
          ctx.state.mode === snapshot.mode &&
          ctx.state.revision === snapshot.revision
        )
          saved();
      })
      .catch((error: unknown) => {
        saveFailed = true;
        status.textContent = 'Nicht gesichert';
        status.dataset.state = 'error';
        storageError.hidden = false;
        storageError.replaceChildren(
          message(
            `${errorText(error)} Deine Änderungen sind hier noch geöffnet.`,
            'error',
          ),
          action(
            'Speichern wiederholen',
            () => persist(ctx.state),
            'secondary',
          ),
          action(
            'Sicherung herunterladen',
            ctx.openBackup,
            'secondary',
            'download',
          ),
        );
      });
  }
  function historyPush(route: string): void {
    window.history.pushState(null, '', `#${route}`);
  }
  async function catalog(): Promise<void> {
    if (catalogLoading) return;
    catalogLoading = true;
    try {
      const chapters = await loadCollection(
        `${import.meta.env.BASE_URL}collection.json`,
      );
      ctx.chapters = chapters;
      ctx.catalog = editorialCards(chapters);
      catalogError.hidden = true;
      ctx.render();
    } catch {
      catalogError.hidden = false;
      catalogError.replaceChildren(
        message(
          'Die Inspirationsvorlagen konnten nicht geladen werden. Dein eigener Bestand bleibt verfügbar.',
          'error',
        ),
        action(
          'Vorlagen erneut laden',
          () => {
            void catalog();
          },
          'secondary',
        ),
      );
    } finally {
      catalogLoading = false;
    }
  }
  accountButton.addEventListener('click', () => {
    if (ctx.state.mode === 'demo') {
      void ctx.switchMode('personal').then(() => {
        if (ctx.state.mode === 'personal') void openAccount(ctx, () => saving);
      });
      return;
    }
    void openAccount(ctx, async () => {
      await saving;
      if (saveFailed)
        throw new Error(
          'Sichere deine lokalen Änderungen vor dem Kontowechsel.',
        );
    });
  });
  cloudClient?.auth.onAuthStateChange((_event, next) => {
    if ((next?.user.id ?? null) !== (session?.user.id ?? null)) {
      blocked = true;
      for (const dialog of document.querySelectorAll<HTMLDialogElement>(
        '.w-dialog[open]',
      ))
        dialog.close();
      root.replaceChildren(el('h1', '', 'Anmeldung geändert'));
      history.length = 0;
      undoButton.hidden = true;
      storageError.hidden = false;
      storageError.replaceChildren(
        message(
          'Die Anmeldung wurde geändert. Lade die Seite neu, um den passenden Bestand zu öffnen.',
        ),
        action('Seite neu laden', () => location.reload(), 'primary'),
      );
    }
  });
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    '[data-workspace-route]',
  ))
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const route = link.dataset.workspaceRoute!;
      if (location.hash.slice(1).split(/[/?]/)[0] === route) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
      ctx.navigate(route);
    });
  document.querySelector('.skip-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    root.focus({ preventScroll: true });
    root.scrollIntoView({ block: 'start' });
  });
  document
    .querySelector('#workspace-add')!
    .addEventListener('click', () => ctx.openAdd());
  document
    .querySelector('#workspace-mobile-add')!
    .addEventListener('click', () => ctx.openAdd());
  document
    .querySelector('#workspace-mobile-account')!
    .addEventListener('click', () => accountButton.click());
  document
    .querySelector('#workspace-backup')!
    .addEventListener('click', ctx.openBackup);
  document
    .querySelector('#workspace-end-demo')!
    .addEventListener('click', () => {
      void ctx.switchMode('personal');
    });
  undoButton.addEventListener('click', () => {
    const previous = history.pop();
    if (!previous) return;
    ctx.state = validateState({
      ...previous.state,
      revision: ctx.state.revision + 1,
    });
    ctx.render();
    persist(ctx.state);
    ctx.notify(`${previous.label} rückgängig gemacht.`);
  });
  addEventListener('hashchange', () => ctx.render());
  addEventListener('popstate', () => ctx.render());
  if (!location.hash) {
    let route = 'sammlung';
    try {
      const remembered = localStorage.getItem('e-binder-route');
      if (
        remembered &&
        ['sammlung', 'binder', 'wunschliste', 'entdecken'].includes(remembered)
      )
        route = remembered;
    } catch {
      /* A fresh collection remains available. */
    }
    window.history.replaceState(null, '', `#${route}`);
  }
  saved();
  ctx.render();
  void catalog();
}

function demoState(chapters: Collection): PersonalState {
  const cards = editorialCards(chapters).slice(0, 18);
  let state = emptyState('demo');
  for (const [index, card] of cards.entries())
    state = confirmHolding(state, {
      card,
      finish: 'holo',
      variantNote: '',
      quantity: 1,
      tradeQuantity: 0,
      favorite: index === 9,
      notes: '',
    });
  state = createBinder(state, 'Mein Beispielbinder');
  return changeState(state, (next) => {
    next.wishes = [];
  });
}
