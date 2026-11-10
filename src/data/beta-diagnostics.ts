/** Developer-account-only beta events. Never send photos, OCR, field values or errors. */
import { cloudClient } from './supabase';

type Kind =
  | 'session'
  | 'navigation'
  | 'interaction'
  | 'state_change'
  | 'ui_error'
  | 'runtime_error'
  | 'scan_result'
  | 'scan_review';
type Outcome = 'ok' | 'error' | 'cancelled' | 'unknown';
type Area =
  | 'home'
  | 'entdecken'
  | 'binder'
  | 'sammlung'
  | 'portfolio'
  | 'profil'
  | 'wunschliste'
  | 'scan'
  | 'dialog'
  | 'other';
type Platform = 'ios' | 'android' | 'desktop';

interface Row {
  user_id: string;
  session_id: string;
  event_type: Kind;
  area: Area;
  action: string;
  outcome: Outcome;
  platform: Platform;
  app_build: string;
  card_candidate?: string;
  card_selected?: string;
  metric?: number;
}

const routes = new Set<Area>([
  'home',
  'entdecken',
  'binder',
  'sammlung',
  'portfolio',
  'profil',
  'wunschliste',
]);
const clicks: Record<string, string> = {
  'Jetzt aufnehmen': 'camera_shutter',
  'Karte live scannen': 'live_scanner_open',
  'Karte manuell eintragen': 'manual_entry_open',
  'Ganze Binderseite scannen': 'page_scan_open',
  'Ergebnisse prüfen': 'review_open',
  'Erkennung abbrechen': 'recognition_cancel',
  'Bestand bestätigen': 'holding_confirm_click',
  'Erkennung falsch melden': 'recognition_report_wrong',
};
const commits: Record<string, string> = {
  'Bestand bestätigt': 'holding_confirmed',
  'Ausgabe korrigiert': 'holding_corrected',
  'Binder angelegt': 'binder_created',
  'Binder umbenannt': 'binder_renamed',
  'Seite hinzugefügt': 'page_added',
  'Binderplätze getauscht': 'pockets_swapped',
  'Wunschkarte hinzugefügt': 'wish_added',
  'Texterkennung abgeschlossen': 'recognition_completed',
  'Foto bleibt zur Klärung offen': 'recognition_failed',
};

let authorized = false;
let paused = false;
let actor = '';
let sessionId = '';
let queued: Row[] = [];
let sent = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
declare const __E_BINDER_BUILD__: string;
const appBuild =
  typeof __E_BINDER_BUILD__ === 'undefined' ? 'local' : __E_BINDER_BUILD__;

export function betaArea(value: string): Area {
  return routes.has(value as Area) ? (value as Area) : 'other';
}
export function safeCatalogueKey(
  value: string | undefined,
): string | undefined {
  // Product codes can contain colons and slashes. Never transmit URLs,
  // photo references or arbitrary free-form strings.
  return value &&
    /^[a-z0-9][a-z0-9_.:/-]{0,119}$/i.test(value) &&
    !value.includes('://') &&
    !/^(?:photo|data|blob):/i.test(value)
    ? value
    : undefined;
}
export function betaCommitAction(label: string): string {
  return commits[label] ?? 'state_changed';
}
function currentArea(): Area {
  return betaArea(location.hash.slice(1).split(/[/?]/)[0] || 'home');
}
function platform(): Platform {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
  return /android/i.test(navigator.userAgent) ? 'android' : 'desktop';
}
export function betaDiagnosticsAuthorized(): boolean {
  return authorized;
}
export function betaDiagnosticsPaused(): boolean {
  return paused;
}
export function setBetaDiagnosticsPaused(next: boolean): void {
  if (!authorized) return;
  paused = next;
  try {
    localStorage.setItem(
      'e-binder-beta-diagnostics-paused',
      next ? 'yes' : 'no',
    );
  } catch {
    // Browser storage restrictions cannot block the application.
  }
  if (next) queued = [];
  else recordBetaEvent('session', 'profil', 'resumed');
}
export function recordBetaEvent(
  event_type: Kind,
  area: Area,
  action: string,
  outcome: Outcome = 'ok',
  details: { candidate?: string; selected?: string; metric?: number } = {},
): void {
  if (!authorized || paused || !cloudClient || sent + queued.length >= 750)
    return;
  if (!/^[a-z][a-z0-9_]{0,47}$/.test(action)) return;
  const row: Row = {
    user_id: actor,
    session_id: sessionId,
    event_type,
    area,
    action,
    outcome,
    platform: platform(),
    app_build: appBuild,
  };
  const candidate = safeCatalogueKey(details.candidate);
  const selected = safeCatalogueKey(details.selected);
  if (candidate) row.card_candidate = candidate;
  if (selected) row.card_selected = selected;
  if (
    Number.isInteger(details.metric) &&
    details.metric! >= 0 &&
    details.metric! <= 200
  )
    row.metric = details.metric;
  queued.push(row);
  if (queued.length >= 12) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), 1500);
}
async function flush(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = undefined;
  if (!authorized || paused || !cloudClient || !queued.length) return;
  const batch = queued.splice(0, 25);
  sent += batch.length;
  try {
    const { error } = await cloudClient
      .from('beta_diagnostic_events')
      .insert(batch);
    if (error) console.warn('Beta diagnostic batch could not be stored');
  } catch {
    // Diagnostics must never affect application data or camera use.
  }
  if (queued.length) timer = setTimeout(() => void flush(), 1500);
}
/** Server-controlled app_metadata is the only enablement authority. */
export function startBetaDiagnostics(
  user: {
    id: string;
    app_metadata?: Record<string, unknown>;
  } | null,
): void {
  if (
    !cloudClient ||
    !user ||
    user.app_metadata?.e_binder_beta_telemetry !== true ||
    authorized
  )
    return;
  authorized = true;
  actor = user.id;
  sessionId = crypto.randomUUID();
  try {
    paused = localStorage.getItem('e-binder-beta-diagnostics-paused') === 'yes';
  } catch {
    paused = false;
  }
  recordBetaEvent('session', currentArea(), 'started');
  window.addEventListener('error', () =>
    recordBetaEvent('runtime_error', currentArea(), 'uncaught_script', 'error'),
  );
  window.addEventListener('unhandledrejection', () =>
    recordBetaEvent(
      'runtime_error',
      currentArea(),
      'unhandled_promise',
      'error',
    ),
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest('button, a, summary');
      if (!control) return;
      const area: Area = control.closest('.w-live-scan-dialog')
        ? 'scan'
        : control.closest('.w-dialog')
          ? 'dialog'
          : currentArea();
      let action = control.matches('a')
        ? 'link_click'
        : control.matches('summary')
          ? 'expand_click'
          : 'button_click';
      const route = control.getAttribute('data-workspace-route');
      if (route && routes.has(route as Area)) action = 'open_' + route;
      else {
        const label =
          control.getAttribute('aria-label') || control.textContent?.trim();
        if (label && clicks[label]) action = clicks[label];
      }
      recordBetaEvent('interaction', area, action);
    },
    { capture: true },
  );
  document.addEventListener(
    'change',
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.matches('input, select, textarea')
      )
        recordBetaEvent('interaction', currentArea(), 'field_changed');
      // Never access the changed field's contents.
    },
    { capture: true },
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void flush();
  });
}
