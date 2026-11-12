import { action, el, icon } from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';
import {
  betaScanDonationState,
  changeBetaScanConsent,
  deleteBetaScanPhotos,
} from '../data/beta-scan-donation';
import {
  betaDiagnosticsAuthorized,
  betaDiagnosticsPaused,
  setBetaDiagnosticsPaused,
} from '../data/beta-diagnostics';

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
        ctx.account
          ? 'Anmeldung, Synchronisierung und Abmeldung'
          : 'Optional anmelden und den Bestand sichern',
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
      option('Wunschliste', 'Karten ansehen, die du noch suchst', () =>
        ctx.navigate('wunschliste'),
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
  if (betaDiagnosticsAuthorized()) {
    const suspended = betaDiagnosticsPaused();
    root.append(
      el(
        'section',
        'w-profile-group',
        el('h2', '', 'Beta-Diagnostik · Entwicklerkonto'),
        el(
          'p',
          'w-muted',
          'Nur auf diesem Testkonto: Bedienaktionen, technische Fehler und Erkennungs-Korrekturen. Keine Fotos, OCR-Texte, Suchbegriffe oder privaten Notizen.',
        ),
        action(
          suspended ? 'Diagnose fortsetzen' : 'Diagnose pausieren',
          () => {
            setBetaDiagnosticsPaused(!suspended);
            ctx.render();
          },
          'secondary',
        ),
      ),
    );
  }
  if (ctx.account) {
    const donation = betaScanDonationState();
    const enabled = donation === 'on';
    root.append(
      el(
        'section',
        'w-profile-group',
        el('h2', '', 'Beta · Bilderkennung verbessern'),
        el(
          'p',
          'w-muted',
          'Freiwillig: Deine neu aufgenommenen Kartenscans werden nur mit deiner Einwilligung als komprimierte JPEGs ohne EXIF- und Standortdaten in einen privaten Testbereich übertragen. Das verbessert die Erkennung nicht sofort. Aufnahmen werden zuerst geprüft und beschriftet. Deine Sammlung bleibt privat.',
        ),
        el(
          'div',
          'w-profile-options w-glass-panel',
          el(
            'p',
            'w-muted',
            donation === 'loading'
              ? 'Deine Einstellung wird geladen …'
              : enabled
                ? 'Teilnahme aktiv · neu erfasste Karten und ausgerichtete Binderseiten können gespendet werden.'
                : 'Teilnahme ausgeschaltet · Fotos bleiben auf deinem Gerät.',
          ),
          action(
            enabled
              ? 'Foto-Teilnahme beenden'
              : 'Foto-Teilnahme ausdrücklich aktivieren',
            () => {
              void changeBetaScanConsent(!enabled)
                .then(() => {
                  ctx.notify(
                    enabled
                      ? 'Weitere Fotoübertragungen sind ausgeschaltet.'
                      : 'Danke! Künftige Scanbilder können jetzt zur Verbesserung beitragen.',
                  );
                  ctx.render();
                })
                .catch((error: unknown) => ctx.notify(String(error), true));
            },
            'secondary',
          ),
          action(
            'Alle meine Beta-Testbilder löschen',
            () => {
              void deleteBetaScanPhotos()
                .then((count) =>
                  ctx.notify(count + ' Testbilder samt Speicherobjekten gelöscht.'),
                )
                .catch((error: unknown) => ctx.notify(String(error), true));
            },
            'text',
          ),
        ),
      ),
    );
  }
  root.append(
    el(
      'p',
      'w-profile-privacy',
      'Standardmäßig bleiben Fotos lokal und werden nach der Erfassung verworfen. Nur bei freiwillig aktivierter Beta-Teilnahme werden neue, komprimierte Scans privat übertragen. Kartenbilder und Katalogdaten stammen aus den ausgewiesenen Quellen.',
    ),
  );
  if (ctx.state.mode === 'demo')
    root.append(
      action(
        'Persönlichen Bestand öffnen',
        () => {
          void ctx.switchMode('personal');
        },
        'secondary',
      ),
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
    el(
      'span',
      'w-profile-option-label',
      el('strong', '', title),
      el('small', '', description),
    ),
    el('span', 'w-profile-option-arrow', icon('arrow')),
  );
  return control;
}
