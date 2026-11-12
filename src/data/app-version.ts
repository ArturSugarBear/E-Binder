/** Read-only, compile-time proof of the JavaScript actually running. */
export interface BuildInfo {
  schema: number;
  version: string;
  commit: string;
  builtAt: string;
}
declare const __E_BINDER_BUILD_INFO__: BuildInfo;
export const appBuild: BuildInfo =
  typeof __E_BINDER_BUILD_INFO__ === 'undefined'
    ? { schema: 1, version: 'dev', commit: 'local', builtAt: '' }
    : __E_BINDER_BUILD_INFO__;

export function versionLabel(build: BuildInfo = appBuild): string {
  return `v${build.version} · ${build.commit.slice(0, 8)}`;
}

export function builtAtLabel(build: BuildInfo = appBuild): string {
  if (!build.builtAt) return 'Lokaler Entwicklungsstand';
  const date = new Date(build.builtAt);
  return Number.isNaN(date.getTime())
    ? 'Buildzeit unbekannt'
    : date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Query actual GitHub Pages release metadata, NOT a cached app bundle.
 * The endpoint is intentionally excluded from PWA precaching and handled
 * NetworkOnly; stale SW pages can still detect an updated deployment.
 */
export async function deployedBuild(): Promise<BuildInfo | null> {
  try {
    const url = new URL(`${import.meta.env.BASE_URL}version.json`, location.origin);
    url.searchParams.set('check', Date.now().toString(36));
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return null;
    const info = data as Partial<BuildInfo>;
    return info.schema === 1 &&
      typeof info.version === 'string' &&
      /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(info.version) &&
      typeof info.commit === 'string' &&
      /^(?:[0-9a-f]{7,40}|local)$/.test(info.commit) &&
      typeof info.builtAt === 'string' &&
      !Number.isNaN(Date.parse(info.builtAt))
      ? (info as BuildInfo)
      : null;
  } catch {
    return null;
  }
}

export async function releaseComparison(): Promise<{
  state: 'current' | 'different' | 'unavailable';
  running: BuildInfo;
  deployed: BuildInfo | null;
}> {
  const deployed = await deployedBuild();
  return {
    state: !deployed
      ? 'unavailable'
      : deployed.commit === appBuild.commit &&
          deployed.version === appBuild.version &&
          deployed.builtAt === appBuild.builtAt
        ? 'current'
        : 'different',
    running: appBuild,
    deployed,
  };
}
