import { registerSW } from 'virtual:pwa-register';
import './pwa.css';

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
  return /iPhone|iPad|iPod/.test(ua) &&
    /Safari/.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** Prevent reloading over pending saves, failed writes or edit dialogs. */
export function isUpdateSafe(): boolean {
  const state = document.querySelector<HTMLElement>('#workspace-save-status')?.dataset.state;
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
  document.querySelector('[data-pwa-banner="' + kind + '"]')?.remove();
  const box = document.createElement('aside');
  box.className = 'pwa-banner';
  box.dataset.pwaBanner = kind;
  box.setAttribute('role', 'status');
  const body = document.createElement('p');
  body.textContent = message;
  box.append(body);
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
  close.textContent = 'Schließen';
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
  document.body.append(box);
}

function dismissedInstall(): boolean {
  try {
    return localStorage.getItem('e-binder-install-dismissed') === 'yes';
  } catch {
    return false;
  }
}

export function initPwa(): void {
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
        showBanner(
          'offline-ready',
          'E-Binder lässt sich jetzt offline öffnen. Noch nicht geladene Kartenbilder, Online-Katalog und Cloud-Sync benötigen Internet.',
        );
      },
      onRegisterError(error) {
        console.warn('Service Worker konnte nicht gestartet werden:', error);
      },
    });
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
    showBanner('install', 'E-Binder auf diesem Gerät als App installieren.', {
      text: 'Installieren',
      run: () => {
        document.querySelector('[data-pwa-banner="install"]')?.remove();
        void prompt.prompt().then(() => prompt.userChoice).catch(() => {
          // Installing is optional; keep the normal website functional.
        });
      },
    }, true);
  });
  window.addEventListener('appinstalled', () => {
    document.querySelector('[data-pwa-banner="install"]')?.remove();
  });
}
