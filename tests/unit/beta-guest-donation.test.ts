import { describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  consent: false,
  signed: false,
  signCalls: 0,
  insertedFeedback: 0,
  uploaded: 0,
}));
vi.mock('../../src/data/supabase', () => {
  const userId = '90fc3f09-75b3-4e9f-b87f-2e0b126204ee';
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: fake.signed
            ? { user: { id: userId, is_anonymous: true } }
            : null,
        },
        error: null,
      }),
      signInAnonymously: async () => {
        fake.signCalls++;
        fake.signed = true;
        return {
          data: { user: { id: userId, is_anonymous: true } },
          error: null,
        };
      },
    },
    from(table: string) {
      if (table === 'beta_scan_consents')
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  enabled: fake.consent,
                  consent_version: '2026-11-photo-v1',
                },
                error: null,
              }),
            }),
          }),
          upsert: async (value: { enabled: boolean }) => {
            fake.consent = value.enabled;
            return { error: null };
          },
        };
      if (table === 'beta_scan_feedback')
        return {
          insert: async () => {
            fake.insertedFeedback++;
            return { error: null };
          },
          delete: () => ({ eq: async () => ({ error: null }) }),
        };
      return {
        select: () => ({
          eq: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      };
    },
    storage: {
      from: () => ({
        upload: async () => {
          fake.uploaded++;
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
  };
  return { cloudClient: undefined, guestBetaClient: client };
});

import {
  betaScanDonationState,
  changeBetaScanConsent,
  loadBetaScanConsent,
  recordBetaScanConfirmation,
  deleteBetaScanPhotos,
} from '../../src/data/beta-scan-donation';

describe('guest beta photos require explicit consent', () => {
  it('never silently signs in a visitor, keeps account separate and allows withdrawal', async () => {
    await loadBetaScanConsent(undefined, () => undefined);
    expect(betaScanDonationState()).toBe('off');
    expect(fake.signCalls).toBe(0);
    expect(fake.uploaded).toBe(0);
    await recordBetaScanConfirmation(
      'c424e4bb-75d9-4da8-a5f1-a8620759b660',
      'tcgdex:de:sv01-211',
    );
    expect(fake.insertedFeedback).toBe(0);
    await changeBetaScanConsent(true);
    expect(fake.signCalls).toBe(1);
    expect(betaScanDonationState()).toBe('on');
    await recordBetaScanConfirmation(
      'c424e4bb-75d9-4da8-a5f1-a8620759b660',
      'tcgdex:de:sv01-211',
    );
    expect(fake.insertedFeedback).toBe(1);
    await recordBetaScanConfirmation(
      'c424e4bb-75d9-4da8-a5f1-a8620759b660',
      'unverified:guess',
    );
    expect(fake.insertedFeedback).toBe(1);
    const count = await deleteBetaScanPhotos();
    expect(count).toBe(0);
    expect(betaScanDonationState()).toBe('off');
    expect(fake.consent).toBe(false);
    await loadBetaScanConsent(undefined, () => undefined);
    expect(betaScanDonationState()).toBe('off');
    expect(fake.signCalls).toBe(1);
  });
});
