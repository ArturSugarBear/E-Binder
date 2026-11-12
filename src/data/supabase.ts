import { createClient } from '@supabase/supabase-js';
import configuration from '../../cloud.config.json';

const url = import.meta.env.VITE_SUPABASE_URL || configuration.url;
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY || configuration.publishableKey;
export const cloudClient =
  url && key
    ? createClient(url, key, {
        global: {
          fetch: (input, init = {}) =>
            fetch(input, {
              ...init,
              signal: init.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)])
                : AbortSignal.timeout(20000),
            }),
        },
      })
    : undefined;
export function loginAddress(username: string): string {
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(name))
    throw new Error('Nutzername: 3–24 Zeichen (a–z, Zahlen, _ oder -).');
  return `${name}@users.e-binder.invalid`;
}

/**
 * Separate, pseudonymous Auth identity exclusively for opt-in beta photo
 * donations. It must NEVER replace the normal user's session or make a
 * local-only personal collection use CloudStore.
 *
 * This client does not create an account unless the collector explicitly
 * chooses the guest photo-donation toggle in Profile.
 */
export const guestBetaClient =
  url && key
    ? createClient(url, key, {
        auth: {
          storageKey: 'e-binder-guest-photo-donation-auth-v1',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        global: {
          fetch: (input, init = {}) =>
            fetch(input, {
              ...init,
              signal: init.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)])
                : AbortSignal.timeout(20000),
            }),
        },
      })
    : undefined;
