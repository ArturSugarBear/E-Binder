import { registerSW } from 'virtual:pwa-register';
import './pwa.css';
import { appBuild, releaseComparison, versionLabel } from './data/app-version';

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(ua) &&
    /Safari/.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  );
}

/** Prevent reloading over pending saves, failed writes or edit dialogs. */
export function isUpdateSafe(): boolean {
  const state = document.querySelector<HTMLElement>('#workspace-save-status')
    ?.dataset.state;
  if (state === 'saving' || state === 'error') return false;
  if (document.querySelector('dialog[open]')) return false;
  const active = document.activeElement;
  return !(
    active instanceof HTMLElement &&
    active.matches('input, textarea, select, [contenteditable="true"]')
  );
}

function showBanner(
  kind: string,
  message: string,
  action?: { text: string; run: () => void },
  rememberDismissal = false,
): void {
  for (const notice of document.querySelectorAll('.pwa-banner'))
    notice.remove();
  const box = document.createElement('div');
  box.className = 'pwa-banner';
  box.dataset.pwaBanner = kind;
  box.setAttribute('role', 'status');
  const body = document.createElement('p');
  body.textContent = message;
  if (kind === 'install' && !action) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'E-Binder als App nutzen';
    details.append(summary, body);
    box.append(details);
  } else box.append(body);
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pwa-banner-primary';
    button.textContent = action.text;
    button.addEventListener('click', action.run);
    box.append(button);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pwa-banner-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Hinweis schließen');
  close.addEventListener('click', () => {
    box.remove();
    if (rememberDismissal) {
      try {
        localStorage.setItem('e-binder-install-dismissed', 'yes');
      } catch {
        // Dismissal works even if browser storage is unavailable.
      }
    }
  });
  box.append(close);
  const anchor = document.querySelector('.w-workspace-status, .top');
  if (anchor) anchor.insertAdjacentElement('afterend', box);
  else document.body.prepend(box);
}

function dismissedInstall(): boolean {
  try {
    return localStorage.getItem('e-binder-install-dismissed') === 'yes';
  } catch {
    return false;
  }
}

let activateUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;

/** A manual check never reloads over edits or loses private scans. */
export async function checkForReleaseUpdate(): Promise<
  Awaited<ReturnType<typeof releaseComparison>>
> {
  const status = await releaseComparison();
  if (status.state !== 'different' || !status.deployed) return status;

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    } catch {
      // A blocked SW update does not erase the uncached version result.
    }
  }
  const useUpdate = () => {
    if (!isUpdateSafe()) {
      showBanner(
        'update',
        'Bitte vor dem Update Änderungen speichern und offene Scan- oder Bearbeitungsdialoge schließen.',
        { text: 'Erneut versuchen', run: useUpdate },
      );
      return;
    }
    if (activateUpdate) void activateUpdate(true);
    else location.reload();
  };
  showBanner(
    'update',
    `Eine andere E-Binder-Version ist veröffentlicht (${versionLabel(status.deployed)}). Aktuell läuft ${versionLabel(appBuild)}.`,
    { text: 'Update anwenden', run: useUpdate },
  );
  return status;
}

export function initPwa(): void {
  const label = document.querySelector<HTMLElement>('#workspace-version');
  if (label) {
    label.textContent = versionLabel();
    // Accessible name must contain the visible version text (WCAG 2.5.3).
    label.setAttribute(
      'aria-label',
      `${versionLabel()} – App-Version und Updates im Profil`,
    );
    label.title = `E-Binder Build ${appBuild.builtAt || 'lokal'}`;
    label.dataset.buildCommit = appBuild.commit;
  }
  if (isStandalone()) document.documentElement.classList.add('pwa-standalone');

  if ('serviceWorker' in navigator) {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        const requestUpdate = () => {
          if (isUpdateSafe()) {
            void update(true);
            return;
          }
          showBanner(
            'update',
            'Bitte zuerst Änderungen speichern und alle Bearbeitungsdialoge schließen. Deine Daten bleiben unverändert.',
            { text: 'Erneut prüfen', run: requestUpdate },
          );
        };
        showBanner('update', 'Eine neue E-Binder-Version ist verfügbar.', {
          text: 'Jetzt aktualisieren',
          run: requestUpdate,
        });
      },
      onOfflineReady() {
        if (document.querySelector('[data-pwa-banner="install"]')) return;
        showBanner(
          'offline-ready',
          'E-Binder lässt sich jetzt offline öffnen. Noch nicht geladene Kartenbilder, Online-Katalog und Cloud-Sync benötigen Internet.',
        );
      },
      onRegisterError(error) {
        console.warn('Service Worker konnte nicht gestartet werden:', error);
      },
    });
    activateUpdate = update;
    const checkForUpdate = () => {
      if (!navigator.onLine || document.visibilityState !== 'visible') return;
      void navigator.serviceWorker.ready
        .then((registration) => registration.update())
        .catch(() => {
          // Network or service worker failure should not block the app.
        });
    };
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
  }

  if (isStandalone() || dismissedInstall()) return;

  if (isIOSSafari()) {
    showBanner(
      'install',
      'E-Binder als App: In Safari „Teilen“ → „Zum Home-Bildschirm“ wählen, gegebenenfalls „Als Web-App öffnen“ aktivieren und „Hinzufügen“ tippen.',
      undefined,
      true,
    );
    return;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    const prompt = event as InstallPrompt;
    showBanner(
      'install',
      'E-Binder auf diesem Gerät als App installieren.',
      {
        text: 'Installieren',
        run: () => {
          document.querySelector('[data-pwa-banner="install"]')?.remove();
          void prompt
            .prompt()
            .then(() => prompt.userChoice)
            .catch(() => {
              // Installing is optional; keep the normal website functional.
            });
        },
      },
      true,
    );
  });
  window.addEventListener('appinstalled', () => {
    document.querySelector('[data-pwa-banner="install"]')?.remove();
  });
}
