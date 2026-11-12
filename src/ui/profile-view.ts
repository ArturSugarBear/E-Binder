import { action, el, icon } from './workspace-dom';
import { currentBuild, checkPublishedBuild } from '../data/app-version';
import { isUpdateSafe } from '../pwa';
import {
  visualBetaEnabled,
  setVisualBetaEnabled,
  VISUAL_BETA_REFERENCE_COUNT,
} from '../data/visual-beta';
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
  const build = currentBuild();
  root.append(
    el(
      'section',
      'w-profile-group',
      el('h2', '', 'App-Version & Updates'),
      el(
        'div',
        'w-profile-options w-glass-panel',
        el('p', 'w-muted', `Installiert: v${build.version} · Build ${build.build}`),
        action('Auf neue Version prüfen', () => {
          void checkPublishedBuild().then(async (published) => {
            if (!published) {
              ctx.notify('Versionsprüfung nicht erreichbar. Bitte die Internetverbindung prüfen.', true);
              return;
            }
            if (published.build === build.build && published.version === build.version) {
              ctx.notify('Du verwendest den aktuell veröffentlichten Build.');
              return;
            }
            if (!isUpdateSafe()) {
              ctx.notify(`Neuer Build ${published.build} verfügbar. Bitte Änderungen speichern und Dialoge schließen.`);
              return;
            }
            if ('serviceWorker' in navigator) {
              try {
                const registration = await navigator.serviceWorker.getRegistration();
                await registration?.update();
              } catch {
                // The network manifest remains authoritative; reload may still be cached.
              }
            }
            ctx.notify(`Neuer Build ${published.build} veröffentlicht. Verwende den Update-Hinweis oder öffne E-Binder erneut.`);
          });
        }, 'secondary'),
      ),
    ),
  );
  const visualActive = visualBetaEnabled();
  root.append(
    el(
      'section',
      'w-profile-group',
      el('h2', '', 'Visuelle KI · begrenzter Test'),
      el(
        'p',
        'w-muted',
        'Testmodell mit ' +
          VISUAL_BETA_REFERENCE_COUNT +
          ' geprüften Kartenmotiven. Es kann keine beliebigen Pokémon-Karten erkennen. ' +
          'Bildähnlichkeit ergänzt OCR nur bei der Prüfung einer Einzelkarte oder Binderseite. ' +
          'Keine automatische Bestandsübernahme und kein Upload für die Bildsuche.',
      ),
      action(
        visualActive
          ? 'Visuelle KI Beta ausschalten'
          : 'Visuelle KI Beta testen',
        () => {
          if (!setVisualBetaEnabled(!visualActive)) {
            ctx.notify(
              'Die Einstellung konnte nicht gespeichert werden.',
              true,
            );
            return;
          }
          ctx.notify(
            visualActive
              ? 'Visuelle KI ist auf diesem Gerät ausgeschaltet.'
              : 'Visuelle KI ist aktiviert. Sie wird bei der nächsten Foto-Auswertung zusätzlich zu OCR genutzt.',
          );
          ctx.render();
        },
        'secondary',
      ),
      el(
        'p',
        'w-muted',
        visualActive
          ? 'Aktiv auf diesem Gerät · ausschließlich experimentelle Vorschläge'
          : 'Aus · Standard bleibt die bestehende OCR-Erkennung',
      ),
    ),
  );
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
                  ctx.notify(
                    count + ' Testbilder samt Speicherobjekten gelöscht.',
                  ),
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
