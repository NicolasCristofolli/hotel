import { HOTEL_ID, supabase } from './supabase';

/**
 * Published snapshot of the hotel config, served by the Storage CDN.
 *
 * Guests read this file instead of the `hotels` table, so a visit costs no database query:
 * the database is only touched when an admin saves (which republishes the file).
 * The CDN keeps a copy for up to CDN_MAX_AGE seconds, so guests see admin edits within ~1 minute.
 */
const BUCKET = 'hotel-assets';
const PATH = `${HOTEL_ID}/config.json`;
const CDN_MAX_AGE = 60;

export const publicConfigUrl = supabase ? supabase.storage.from(BUCKET).getPublicUrl(PATH).data.publicUrl : '';

/** Admin side: overwrite the snapshot after a successful database save. */
export async function publishConfig(config: unknown) {
  if (!supabase) return;
  const body = new Blob([JSON.stringify(config)], { type: 'application/json' });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(PATH, body, { upsert: true, contentType: 'application/json', cacheControl: String(CDN_MAX_AGE) });
  if (error) throw new Error(error.message);
}

/**
 * Guest side: fetch the snapshot. Returns null when it doesn't exist yet (hotel never saved since
 * this feature shipped) so the caller can fall back to the database once.
 * `no-cache` makes the browser revalidate with the CDN (ETag) — it never bypasses the CDN.
 */
export async function fetchPublicConfig(): Promise<unknown | null> {
  if (!publicConfigUrl) return null;
  const res = await fetch(publicConfigUrl, { cache: 'no-cache' });
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
