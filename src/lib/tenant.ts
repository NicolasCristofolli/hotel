/**
 * Which hotel this page serves, read from the first path segment:
 *
 *   hotelguia.com.br/vale-sereno#/servicos  → hotel "vale-sereno", guest route "#/servicos"
 *   hotelguia.com.br/vale-sereno#/admin     → that hotel's admin panel
 *   hotelguia.com.br/                       → platform home (no hotel)
 *
 * Resolved once per page load: switching hotels is a full navigation, so a module constant is enough.
 * `VITE_HOTEL_ID` is only a fallback for the bare root (local dev / legacy single-hotel deploys).
 */

/** Same rule as the `hotels.id` check constraint. */
const SLUG = /^[a-z0-9-]{2,40}$/;

/** Paths that can never be a hotel (static files, future platform pages). */
export const RESERVED = new Set([
  'assets',
  'admin',
  'api',
  'app',
  'www',
  'static',
  'public',
  'login',
  'painel',
  'hoteis',
  'sobre',
  'contato',
]);

/** hotelguia.com.br/painel — the platform's super-admin area (no hotel). */
export const isPlatformPanel = /^\/painel\/?$/i.test(window.location.pathname);

function resolve(): string | null {
  const [first = ''] = window.location.pathname.split('/').filter(Boolean);
  let seg = '';
  try {
    seg = decodeURIComponent(first).toLowerCase();
  } catch {
    /* malformed %-escape → not a hotel */
  }
  if (SLUG.test(seg) && !RESERVED.has(seg)) {
    // Canonical URL: lowercase, no trailing segments (keeps ?code=… and #/route).
    const canonical = `/${seg}`;
    if (window.location.pathname !== canonical) {
      history.replaceState(null, '', `${canonical}${window.location.search}${window.location.hash}`);
    }
    return seg;
  }
  if (first) return null; // unknown path → platform home (it shows "not found")
  return import.meta.env.VITE_HOTEL_ID || null;
}

const resolved = resolve();

/** True when the URL points to a hotel portal; false on the platform home. */
export const hasHotel = resolved !== null;

/** The hotel's id (row in `hotels`). Empty on the platform home — nothing hotel-scoped is mounted there. */
export const HOTEL_ID = resolved ?? '';

/** Public URL of a hotel's portal. */
export const hotelUrl = (id: string) => `${window.location.origin}/${id}`;

/** Browser-storage key scoped to this hotel, so two hotels opened on the same phone don't mix data. */
export const hotelKey = (key: string) => `${key}:${HOTEL_ID}`;
