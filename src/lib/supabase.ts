import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, isRemote, SUPABASE_KEY, SUPABASE_URL } from './backend';

/** Which hotel this page serves — resolved from the URL path (see tenant.ts). */
export { HOTEL_ID } from './tenant';
export { isRemote } from './backend';

/**
 * Supabase client, or null when the env vars are missing — the app then runs in
 * "local demo" mode (localStorage + demo PIN), which is handy for development.
 *
 * Heavy (auth, realtime, storage): only admin code imports this module directly, and it is
 * downloaded on demand. Code the guest portal loads uses `backend.ts` (`rest`, `loadSupabase`).
 */
export const supabase: SupabaseClient | null = isRemote
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storageKey: AUTH_STORAGE_KEY,
      },
    })
  : null;
