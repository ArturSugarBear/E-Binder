declare const __E_BINDER_BUILD__: string;
declare const __E_BINDER_VERSION__: string;

export type AppBuild = { version: string; build: string };

export function currentBuild(): AppBuild {
  return {
    version: __E_BINDER_VERSION__,
    build: __E_BINDER_BUILD__,
  };
}

/** Version.json is emitted by Vite on each build and bypasses the PWA cache. */
export async function checkPublishedBuild(): Promise<AppBuild | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?check=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (
      !value ||
      typeof value !== 'object' ||
      !('version' in value) ||
      !('build' in value) ||
      typeof value.version !== 'string' ||
      typeof value.build !== 'string'
    ) return null;
    return { version: value.version, build: value.build };
  } catch {
    return null;
  }
}
