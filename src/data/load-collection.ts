import { parseCollection, type Collection } from '../domain/collection';

export async function loadCollection(
  url: string,
  request: typeof fetch = fetch,
): Promise<Collection> {
  const response = await request(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok)
    throw new Error(`Collection request failed (${response.status})`);
  return parseCollection(await response.json());
}
