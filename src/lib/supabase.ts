import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Which hotel this deployment serves (one row in `hotels`). */
export const HOTEL_ID = import.meta.env.VITE_HOTEL_ID || 'vale-sereno';

/**
 * Supabase client, or null when the env vars are missing — the app then runs in
 * "local demo" mode (localStorage + demo PIN), which is handy for development.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
          storageKey: 'guia-hospede:auth',
        },
      })
    : null;

export const isRemote = supabase !== null;
