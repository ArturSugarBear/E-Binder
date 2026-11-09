import { cloudClient, loginAddress } from '../data/supabase';
import { CloudStore } from '../data/cloud-store';
import { PersonalStore } from '../data/personal-store';
import { validateState } from '../domain/personal';
import type { WorkspaceContext } from './workspace-context';
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
} from './workspace-dom';

export async function openAccount(
  ctx: WorkspaceContext,
  flush: () => Promise<void>,
): Promise<void> {
  const sheet = modal(ctx.account ? 'Dein Konto' : 'Sammlung im Konto sichern');
  if (!cloudClient) {
    sheet.body.append(
      message(
        'Die Cloud-Verbindung ist in diesem Build nicht konfiguriert. Dein lokaler Bestand bleibt nutzbar.',
      ),
    );
    return;
  }
  const client = cloudClient;
  const status = message('');
  status.hidden = true;
  status.setAttribute('role', 'status');
  const fail = (error: unknown) => {
    status.textContent = errorText(error);
    status.hidden = false;
  };
  if (!ctx.account) {
    const mode = choices(
      'Zugang',
      [
        ['login', 'Anmelden'],
        ['register', 'Konto anlegen'],
      ],
      'login',
    );
    const username = input();
    username.required = true;
    username.autocomplete = 'username';
    username.minLength = 3;
    username.maxLength = 24;
    username.autocapitalize = 'none';
    username.spellcheck = false;
    const password = input('password');
    password.required = true;
    password.minLength = 12;
    password.maxLength = 128;
    password.autocomplete = 'current-password';
    const submit = action('Anmelden', () => undefined, 'primary');
    submit.type = 'submit';
    mode.addEventListener('change', () => {
      submit.textContent =
        mode.value === 'login' ? 'Anmelden' : 'Konto anlegen';
      password.autocomplete =
        mode.value === 'login' ? 'current-password' : 'new-password';
    });
    const form = el(
      'form',
      'w-confirm-form',
      mode.element,
      field('Nutzername', username),
      field(
        'Passwort',
        password,
        'Mindestens 12 Zeichen. Keine E-Mail-Adresse erforderlich.',
      ),
      message(
        'Im Konto werden Sammlung und Binder als reine Metadaten privat mit Supabase gespeichert. Fotos werden nicht gespeichert. Die Erkennung läuft weiterhin im Browser. Dein bisheriger lokaler Bestand bleibt separat erhalten und kann nach der Anmeldung übernommen werden.',
      ),
      message(
        'Ohne E-Mail gibt es keinen automatischen Passwort-Reset. Bei Verlust kann der Betreiber nach Prüfung helfen.',
      ),
      status,
      submit,
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      status.hidden = true;
      submit.disabled = true;
      void (async () => {
        try {
          const email = loginAddress(username.value);
          await flush();
          if (mode.value === 'register') {
            const { error } = await client.functions.invoke('register', {
              body: {
                username: username.value.trim().toLowerCase(),
                password: password.value,
              },
            });
            if (error) {
              const response =
                'context' in error && error.context instanceof Response
                  ? await error.context.json().catch(() => null)
                  : null;
              throw new Error(
                response?.message ??
                  'Das Konto konnte nicht angelegt werden. Prüfe den Namen oder versuche es später erneut.',
              );
            }
          }
          const { error } = await client.auth.signInWithPassword({
            email,
            password: password.value,
          });
          password.value = '';
          if (error)
            throw new Error(
              'Anmeldung fehlgeschlagen. Prüfe Nutzername und Passwort.',
            );
          localStorage.setItem('e-binder-mode', 'personal');
          location.reload();
        } catch (error) {
          fail(error);
          submit.disabled = false;
        }
      })();
    });
    sheet.body.append(form);
    username.focus();
    return;
  }
  const store = ctx.store;
  sheet.body.append(
    el('p', 'w-lead', ctx.account.username),
    message(
      'Deine Sammlung ist nur für dieses Konto zugänglich. Einen Binder gibst du einzeln über „Binder teilen“ frei.',
    ),
    status,
  );
  const sync = action(
    'Jetzt synchronisieren',
    () => {
      sync.disabled = true;
      void flush()
        .then(() => store.save(ctx.state))
        .then(() => {
          status.hidden = false;
          status.textContent =
            store instanceof CloudStore && store.syncError
              ? store.syncError
              : 'Dein Konto ist synchronisiert.';
        })
        .catch(fail)
        .finally(() => {
          sync.disabled = false;
        });
    },
    'primary',
  );
  const importLocal = action(
    'Lokalen Bestand übernehmen',
    () => {
      importLocal.disabled = true;
      void (async () => {
        try {
          await flush();
          if (
            ctx.state.holdings.length ||
            ctx.state.binders.length ||
            ctx.state.captures.length ||
            ctx.state.wishes.length
          )
            throw new Error(
              'Dein Konto enthält bereits Daten. Nutze Export/Import mit Vorschau, um einen Stand bewusst zu ersetzen.',
            );
          const local = new PersonalStore();
          const state = await local.load('personal');
          if (!state.revision)
            throw new Error(
              'Auf diesem Gerät ist noch kein lokaler Bestand gespeichert.',
            );
          await ctx.restore(validateState({ ...state, mode: 'personal' }));
        } catch (error) {
          fail(error);
        } finally {
          importLocal.disabled = false;
        }
      })();
    },
    'secondary',
  );
  const discard = check(
    'Lokale, noch nicht synchronisierte Kontoänderungen durch den Cloudstand ersetzen.',
  );
  const remote = action(
    'Cloudstand laden',
    () => {
      if (!discard.input.checked) {
        fail(
          new Error(
            'Bestätige zuerst das Ersetzen der lokalen Kontoänderungen. Lade bei Bedarf eine Sicherung herunter.',
          ),
        );
        discard.input.focus();
        return;
      }
      if (store instanceof CloudStore) {
        remote.disabled = true;
        void flush()
          .then(() => {
            store.useRemoteOnNextLoad();
            location.reload();
          })
          .catch(fail);
      }
    },
    'secondary',
  );
  const logout = action(
    'Abmelden',
    () => {
      logout.disabled = true;
      void flush()
        .then(async () => {
          const { error } = await client.auth.signOut({ scope: 'local' });
          if (error) throw error;
          localStorage.setItem('e-binder-mode', 'personal');
          location.reload();
        })
        .catch((error) => {
          fail(error);
          logout.disabled = false;
        });
    },
    'secondary',
  );
  sheet.body.append(
    el(
      'div',
      'w-action-row',
      sync,
      importLocal,
      action('Sicherung herunterladen', ctx.openBackup, 'secondary'),
    ),
    message(
      'Bei einem Konflikt bleibt dein lokaler Stand erhalten. Lade eine Sicherung herunter, bevor du ihn ersetzt.',
    ),
    discard.row,
    remote,
  );
  sheet.footer.append(logout);
}
