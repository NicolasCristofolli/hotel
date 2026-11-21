import { HOTEL_ID, supabase } from './supabase';

/**
 * Stores an image and returns the URL to save in the config.
 * With Supabase → public file in the `hotel-assets` bucket (keeps the config small).
 * Without → the data URL itself (local demo mode).
 */
export async function storeImage(dataUrl: string, name: string): Promise<string> {
  if (!supabase) return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type === 'image/svg+xml' ? 'svg' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
  const path = `${HOTEL_ID}/${name}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('hotel-assets').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return supabase.storage.from('hotel-assets').getPublicUrl(path).data.publicUrl;
}
