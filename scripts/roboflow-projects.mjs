/**
 * Read-only Roboflow project discovery. This command never prints an API key
 * and never downloads photos, starts paid training or modifies the workspace.
 *
 * ROBOFLOW_API_KEY=<private key> node scripts/roboflow-projects.mjs artur-schuhmacher
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function summarizeProjects(value, workspace) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.workspace?.projects))
    throw new Error('Roboflow workspace response has no project list.');
  return value.workspace.projects.map((p) => {
    const id = String(p.id ?? '');
    const parts = id.split('/');
    if (parts.length !== 2 || parts[0] !== workspace ||
      !/^[A-Za-z0-9_-]+$/.test(parts[1]))
      throw new Error('Unexpected workspace project ID.');
    const rawCount = p.images ?? p.image_count ?? p.imageCount;
    const count = Number(rawCount);
    return {
      project: parts[1],
      images: Number.isSafeInteger(count) && count >= 0 ? count : null,
      type: typeof p.type === 'string' ? p.type : 'unknown',
      annotation: typeof p.annotation === 'string' ? p.annotation : 'unknown',
    };
  }).sort((a, b) => (b.images ?? -1) - (a.images ?? -1));
}

export async function discoverProjects(workspace, key) {
  if (!/^[A-Za-z0-9_-]+$/.test(workspace))
    throw new Error('Invalid workspace slug.');
  if (!key || key.length < 8) throw new Error('Private ROBOFLOW_API_KEY required.');
  const address = new URL('https://api.roboflow.com/' + workspace);
  address.searchParams.set('api_key', key);
  const response = await fetch(address, {
    signal: AbortSignal.timeout(25_000),
    cache: 'no-store',
  });
  // NEVER print response URL, body, or request headers on an auth error.
  if (!response.ok)
    throw new Error('Roboflow project list failed with HTTP ' + response.status);
  return summarizeProjects(await response.json(), workspace);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const workspace = process.argv[2];
  if (!workspace) {
    console.error('Usage: ROBOFLOW_API_KEY=<private key> node scripts/roboflow-projects.mjs <workspace>');
    process.exitCode = 2;
  } else {
    const projects = await discoverProjects(workspace, process.env.ROBOFLOW_API_KEY);
    console.log(JSON.stringify({workspace, projectCount: projects.length, projects}, null, 2));
  }
}
