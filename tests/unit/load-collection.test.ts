import { expect, it, vi } from 'vitest';
import data from '../../public/collection.json' with { type: 'json' };
import { loadCollection } from '../../src/data/load-collection';

it('loads and validates the response and supplies a timeout signal', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(data));
  await expect(
    loadCollection('/collection.json', request),
  ).resolves.toHaveLength(22);
  expect(request).toHaveBeenCalledWith('/collection.json', {
    signal: expect.any(AbortSignal),
  });
});
it('rejects an HTTP error rather than rendering partial data', async () => {
  await expect(
    loadCollection(
      '/collection.json',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('', { status: 503 })),
    ),
  ).rejects.toThrow('503');
});
it('rejects valid JSON with an invalid collection shape', async () => {
  await expect(
    loadCollection(
      '/collection.json',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ error: 'missing' })),
    ),
  ).rejects.toThrow();
});
