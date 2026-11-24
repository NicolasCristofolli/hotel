import { supabase } from '../lib/supabase';

/**
 * Super-admin operations. Each one is a SQL function (migrations/0006_platform.sql) that checks,
 * inside the database, that the caller is a platform admin with 2FA — the UI hiding buttons is not the security.
 * Only the invite goes through an Edge Function, because creating users needs the secret key.
 */

export type PlatformHotel = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  configured: boolean;
  /** Shown on the public showcase (hotelguia.com.br) — 0009. */
  listed: boolean;
  admins: number;
  pending_admins: number;
  sessions_30d: number;
  events_30d: number;
  last_activity: string | null;
};

export type HotelAdminRole = 'owner' | 'admin' | 'staff';

export type HotelAdmin = {
  user_id: string;
  email: string;
  role: HotelAdminRole;
  created_at: string;
  last_sign_in_at: string | null;
  has_2fa: boolean;
};

export type InviteResult = { status: 'invited' | 'pending' | 'linked' | 'reset'; link: string | null; email: string };

// The Edge Function's address (slug). In the dashboard it's named "invite-admin", but its address stayed
// 'rapid-responder' (auto-generated on the first deploy; Supabase can't change it). 'invite-admin' covers a redeploy.
const INVITE_FUNCTIONS = ['rapid-responder', 'invite-admin'];

async function callInvite(body: Record<string, unknown>): Promise<InviteResult> {
  let lastError: Error | null = null;
  for (const name of INVITE_FUNCTIONS) {
    const { data, error } = await db().functions.invoke(name, { body: { ...body, redirect_to: window.location.origin } });
    if (!error) return data as InviteResult;
    // The function answers errors as JSON { error } — show that instead of "non-2xx status code".
    const ctx = (error as { context?: Response }).context;
    if (ctx?.status === 404) {
      lastError = new Error('Função "invite-admin" não encontrada. Publique-a no Supabase (veja o README).');
      continue;
    }
    const msg = await ctx
      ?.json()
      .then((j: { error?: string }) => j.error)
      .catch(() => undefined);
    if (!msg && /Failed to send a request|FunctionsFetchError/i.test(error.message))
      throw new Error('Não foi possível falar com a função de convites. Verifique a internet e se ela está publicada.');
    throw new Error(msg ?? error.message);
  }
  throw lastError ?? new Error('Função de convites indisponível.');
}

export const ROLE_OPTIONS: { value: HotelAdminRole; label: string; hint: string }[] = [
  { value: 'owner', label: 'Proprietário', hint: 'Edita tudo' },
  { value: 'admin', label: 'Administrador', hint: 'Edita tudo' },
  { value: 'staff', label: 'Equipe', hint: 'Só vê os relatórios' },
];

function db() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const platformApi = {
  hotels: () => rpc<PlatformHotel[]>('platform_hotels'),
  createHotel: (id: string, name: string) => rpc<void>('platform_create_hotel', { p_id: id, p_name: name }),
  renameHotel: (id: string, name: string) => rpc<void>('platform_rename_hotel', { p_id: id, p_name: name }),
  setListed: (id: string, listed: boolean) => rpc<void>('platform_set_listed', { p_id: id, p_listed: listed }),
  deleteHotel: (id: string) => rpc<void>('platform_delete_hotel', { p_id: id }),
  admins: (hotelId: string) => rpc<HotelAdmin[]>('platform_hotel_admins', { p_hotel: hotelId }),
  setRole: (hotelId: string, userId: string, role: HotelAdminRole) =>
    rpc<void>('platform_set_admin', { p_hotel: hotelId, p_user: userId, p_role: role }),
  removeAdmin: (hotelId: string, userId: string) => rpc<void>('platform_remove_admin', { p_hotel: hotelId, p_user: userId }),
  reset2fa: (userId: string) => rpc<void>('platform_reset_2fa', { p_user: userId }),

  invite: (hotelId: string, email: string, role: HotelAdminRole) => callInvite({ hotel_id: hotelId, email, role }),
  /** One-time link to set a new password (for someone who already has an account). */
  passwordLink: (hotelId: string, email: string) => callInvite({ hotel_id: hotelId, email, password_reset: true }),
};

/** "Piscina & Spa Vale" → "piscina-spa-vale" (same rule as hotel ids in the database). */
export const toSlug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
