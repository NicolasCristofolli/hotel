/**
 * Lightweight access to Supabase for the guest portal — no `@supabase/supabase-js` here.
 *
 * Guests only need a few anonymous HTTP calls (CDN snapshot, analytics insert, the public hotel list),
 * so those go through plain `fetch` to the REST API. The full client (auth, realtime, storage uploads)
 * is only downloaded when someone opens an admin screen: `loadSupabase()`.
 * Never import `./supabase` statically from code the guest portal loads.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export { HOTEL_ID } from './tenant';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') ?? '';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

/** false → "local demo" mode (localStorage + demo PIN). */
export const isRemote = !!(SUPABASE_URL && SUPABASE_KEY);

/** Where supabase-js keeps the admin session (see supabase.ts). */
export const AUTH_STORAGE_KEY = 'guia-hospede:auth';

/** An admin session may exist in this browser (so the auth client is worth loading). */
export function hasStoredSession() {
  try {
    return !!localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return false;
  }
}

let client: Promise<SupabaseClient | null> | null = null;
/** The full Supabase client, downloaded on first use (admin screens only). */
export function loadSupabase(): Promise<SupabaseClient | null> {
  client ??= isRemote ? import('./supabase').then((m) => m.supabase) : Promise.resolve(null);
  return client;
}

/** Anonymous call to the REST API (PostgREST), with the same headers supabase-js sends. */
export function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

/** Error text from a failed REST response. */
export async function restError(res: Response) {
  try {
    const body = await res.json();
    return String(body?.message ?? `HTTP ${res.status}`);
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Public URL of a file in a public Storage bucket. */
export const storagePublicUrl = (bucket: string, path: string) => `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
