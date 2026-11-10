import { action, el } from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';

/** Profile keeps existing account, backup and privacy workflows intact. */
export function renderProfile(ctx: WorkspaceContext): HTMLElement {
  const root = el('section', 'w-profile');
  const head = el(
    'header',
    'w-profile-hero w-glass-panel',
    el('p', 'w-eyebrow', 'Rare Room / Einstellungen'),
    el('h1', '', 'Dein Profil'),
    el(
      'p',
      'w-lead',
      ctx.account
        ? `Angemeldet als ${ctx.account.username}. Deine Sammlung gehört dir.`
        : 'Du kannst E-Binder ohne Konto benutzen. Sichere deinen lokalen Bestand regelmäßig.',
    ),
  );
  root.append(head);
  const account = el(
    'section',
    'w-profile-group',
    el('h2', '', 'Konto & Daten'),
    el(
      'div',
      'w-profile-options w-glass-panel',
      option(
        'Konto verwalten',
        ctx.account ? 'Anmeldung, Synchronisierung und Abmeldung' : 'Optional anmelden und den Bestand sichern',
        () =>
          document
            .querySelector<HTMLButtonElement>('#workspace-account')
            ?.click(),
      ),
      option(
        'Sammlung sichern',
        'Exportieren oder eine vorhandene Sicherung einspielen',
        () => ctx.openBackup(),
      ),
      option(
        'Wunschliste',
        'Karten ansehen, die du noch suchst',
        () => ctx.navigate('wunschliste'),
      ),
    ),
  );
  const scanner = el(
    'section',
    'w-profile-group',
    el('h2', '', 'Erfassung & Darstellung'),
    el(
      'div',
      'w-profile-options w-glass-panel',
      option(
        'Live-Kartenscanner',
        'Karte erfassen und Ausgabe bestätigen',
        () => ctx.openAdd({ live: true }),
      ),
      option(
        'Binderseiten scannen',
        'Bis zu neun Karten gleichzeitig überprüfen',
        () => ctx.openPageScan(),
      ),
      option(
        'Katalog durchsuchen',
        'Sets, Illustratoren und Kartenvarianten',
        () => ctx.navigate('entdecken'),
      ),
    ),
  );
  root.append(account, scanner);
  root.append(
    el(
      'p',
      'w-profile-privacy',
      'Deine Fotos werden lokal verarbeitet und nach der Erfassung verworfen. Kartenbilder und Katalogdaten kommen aus den jeweils ausgewiesenen Quellen.',
    ),
  );
  if (ctx.state.mode === 'demo')
    root.append(
      action('Persönlichen Bestand öffnen', () => {
        void ctx.switchMode('personal');
      }, 'secondary'),
    );
  return root;
}

function option(
  title: string,
  description: string,
  handler: () => void,
): HTMLElement {
  const control = action(title, handler, 'text', 'arrow');
  control.classList.add('w-profile-option');
  control.replaceChildren(
    el('span', 'w-profile-option-label', el('strong', '', title), el('small', '', description)),
    el('span', 'w-profile-option-arrow', '↗'),
  );
  return control;
}
