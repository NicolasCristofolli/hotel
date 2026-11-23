import { HOTEL_ID, supabase } from './supabase';

/**
 * Image uploads from the admin. Every photo is resized and re-encoded in the browser before upload,
 * so a 12 MB phone picture becomes a few hundred KB and the guest portal stays fast on 4G.
 * The `hotel-assets` bucket also enforces a hard size limit server-side (see 0003_image_limits.sql).
 */

export type ImagePreset = 'logo' | 'hero' | 'photo' | 'map';

type PresetSpec = { maxSide: number; maxBytes: number; transparent: boolean };

export const IMAGE_PRESETS: Record<ImagePreset, PresetSpec> = {
  logo: { maxSide: 480, maxBytes: 150 * 1024, transparent: true },
  hero: { maxSide: 1920, maxBytes: 400 * 1024, transparent: false },
  photo: { maxSide: 1280, maxBytes: 250 * 1024, transparent: false },
  map: { maxSide: 2048, maxBytes: 600 * 1024, transparent: false },
};

/** Largest original file accepted (it is compressed before upload). */
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_SVG_BYTES = 200 * 1024;
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const formatBytes = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem. Use PNG, JPG ou WebP.'));
    };
    img.src = url;
  });
}

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, quality));

/**
 * Resizes and compresses a picked file to fit the preset's dimensions and byte budget.
 * Prefers WebP; browsers that can't encode it (older Safari) fall back to JPEG, or PNG for logos.
 */
export async function compressImage(file: File, preset: ImagePreset): Promise<Blob> {
  const spec = IMAGE_PRESETS[preset];

  if (file.type === 'image/svg+xml') {
    if (preset !== 'logo') throw new Error('SVG é aceito apenas para a logo.');
    if (file.size > MAX_SVG_BYTES) throw new Error(`SVG muito grande (máx. ${formatBytes(MAX_SVG_BYTES)}).`);
    return file;
  }
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('Formato não suportado. Use PNG, JPG ou WebP.');
  if (file.size > MAX_INPUT_BYTES)
    throw new Error(`Arquivo muito grande (${formatBytes(file.size)}). O máximo é ${formatBytes(MAX_INPUT_BYTES)}.`);

  const img = await loadImage(file);
  let side = Math.min(spec.maxSide, Math.max(img.naturalWidth, img.naturalHeight));
  let best: Blob | null = null;

  // Shrink quality first, then dimensions, until the file fits the budget.
  for (let round = 0; round < 6; round++) {
    const scale = side / Math.max(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d')!;
    if (!spec.transparent) {
      ctx.fillStyle = '#fff'; // JPEG has no alpha — avoid transparent areas turning black
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);

    for (const q of [0.85, 0.75, 0.65, 0.55]) {
      let blob = await toBlob(c, 'image/webp', q);
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(c, spec.transparent ? 'image/png' : 'image/jpeg', q);
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= spec.maxBytes) return blob;
      if (blob.type === 'image/png') break; // PNG ignores quality — only resizing helps
    }
    side = Math.round(side * 0.8);
  }
  if (best && best.size <= spec.maxBytes * 1.5) return best;
  throw new Error('Não foi possível reduzir a imagem o suficiente. Tente outra foto.');
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg' };

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

/**
 * Stores an image and returns the URL to save in the config.
 * With Supabase → public file in the `hotel-assets` bucket (keeps the config small).
 * Without → a data URL (local demo mode).
 */
export async function storeImage(blob: Blob, name: string): Promise<string> {
  if (!supabase) return blobToDataUrl(blob);
  const path = `${HOTEL_ID}/${name}-${Date.now()}.${EXT[blob.type] ?? 'bin'}`;
  const { error } = await supabase.storage.from('hotel-assets').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return supabase.storage.from('hotel-assets').getPublicUrl(path).data.publicUrl;
}

/** Compress + upload in one step. */
export async function uploadImage(file: File, preset: ImagePreset, name: string) {
  const blob = await compressImage(file, preset);
  return { url: await storeImage(blob, name), size: blob.size };
}
