import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, expect, it, vi } from 'vitest';
import { CloudStore } from '../../src/data/cloud-store';
import { PersonalStore } from '../../src/data/personal-store';
import { emptyState } from '../../src/domain/personal';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('persists consecutive scan revisions without waiting for a slow cloud', async () => {
  const markers = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    setItem: (key: string, value: string) => markers.set(key, value),
  });
  // IndexedDB persistence is covered separately by PersonalStore tests.
  vi.stubGlobal('indexedDB', { open: () => ({}) });
  const local = vi.spyOn(PersonalStore.prototype, 'save');
  local.mockResolvedValue(undefined);
  let finishFirst: ((value: unknown) => void) | undefined;
  const rpc = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockResolvedValue({ data: 2, error: null });
  const client = { rpc } as unknown as SupabaseClient;
  const store = new CloudStore(client, 'user-test');
  await store.save({ ...emptyState('personal'), revision: 1 });
  await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
  await store.save({ ...emptyState('personal'), revision: 2 });
  expect(local).toHaveBeenCalledTimes(2);
  expect(rpc).toHaveBeenCalledTimes(1);
  finishFirst?.({ data: 1, error: null });
  await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => {
    expect(JSON.parse(markers.get('e-binder-sync:user-test') ?? '{}')).toEqual({
      version: 2,
      revision: 2,
    });
  });
  const versions = rpc.mock.calls.map((call) => call[1].p_expected_version);
  expect(versions).toEqual([0, 1]);
});

it('keeps local writes and blocks further cloud calls after version conflict', async () => {
  vi.stubGlobal('localStorage', { setItem: vi.fn() });
  vi.stubGlobal('indexedDB', { open: () => ({}) });
  const local = vi.spyOn(PersonalStore.prototype, 'save');
  local.mockResolvedValue(undefined);
  const rpc = vi.fn().mockResolvedValue({
    data: null,
    error: { message: 'WORKSPACE_CONFLICT' },
  });
  const client = { rpc } as unknown as SupabaseClient;
  const store = new CloudStore(client, 'user-test');
  await store.save({ ...emptyState('personal'), revision: 1 });
  await vi.waitFor(() => expect(store.conflict).toBe(true));
  await store.save({ ...emptyState('personal'), revision: 2 });
  await vi.waitFor(() => expect(local).toHaveBeenCalledTimes(2));
  expect(store.syncError).toContain('Cloudkonflikt');
  expect(rpc).toHaveBeenCalledTimes(1);
});
