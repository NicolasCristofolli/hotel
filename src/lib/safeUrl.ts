/**
 * Links typed in the admin open on guests' phones, on the same site where admin logins live. Only plain
 * web/e-mail/phone links are allowed: `javascript:`, `data:` and friends would run code on hotelguia.com.br.
 * Applied when rendering (a hand-crafted config can't bypass it) and when typing (immediate feedback).
 */
const ALLOWED = new Set(['https:', 'http:', 'mailto:', 'tel:']);

export function safeExternalUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return ALLOWED.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
