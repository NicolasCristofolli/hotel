import { HOTEL_ID, supabase } from './supabase';
import { isPlatformPanel } from './tenant';

/** `platform`: super admin — the platform panel, plus support access to every hotel's panel. */
export type AdminRole = 'owner' | 'admin' | 'staff' | 'demo' | 'platform';

/** Set while the admin is finishing a "forgot password" flow (link from e-mail). */
export const RECOVERY_KEY = 'guia-hospede:recovery';
/** Why the last session ended (shown on the login screen). */
export const LOGOUT_REASON_KEY = 'guia-hospede:logout-reason';
/** Shared across tabs so activity in any admin tab keeps the session alive. */
export const LAST_ACTIVITY_KEY = 'guia-hospede:admin-activity';
export const IDLE_LIMIT_MS = 30 * 60_000;

/** Role of the signed-in user here (this hotel, or the platform panel), or null if they have no access. */
export async function fetchRole(): Promise<AdminRole | null> {
  if (!supabase) return null;
  if (!isPlatformPanel) {
    const { data } = await supabase.from('hotel_admins').select('role').eq('hotel_id', HOTEL_ID).maybeSingle();
    if (data?.role) return data.role as AdminRole;
  }
  // Platform admins: the platform panel, and support access to any hotel (the database allows it too).
  const { data: platform } = await supabase.from('platform_admins').select('user_id').maybeSingle();
  return platform ? 'platform' : null;
}

export type AuthStep = 'password' | 'mfa-verify' | 'mfa-enroll' | 'new-password' | 'done';

/** Where the current session stands in: password → 2FA (enroll or verify) → [new password] → done. */
export async function nextStep(): Promise<{ step: AuthStep; role: AdminRole | null; error?: string }> {
  if (!supabase) return { step: 'password', role: null };
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return { step: 'password', role: null };

  const role = await fetchRole();
  if (!role) {
    await supabase.auth.signOut();
    return {
      step: 'password',
      role: null,
      error: isPlatformPanel ? 'Esta conta não administra a plataforma.' : 'Esta conta não tem acesso a este hotel.',
    };
  }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    const { data: f } = await supabase.auth.mfa.listFactors();
    return { step: f?.totp.length ? 'mfa-verify' : 'mfa-enroll', role };
  }
  if (sessionStorage.getItem(RECOVERY_KEY)) return { step: 'new-password', role };
  return { step: 'done', role };
}

/** Fully authenticated = admin of this hotel + 2FA verified + not mid password reset. */
export async function isFullyAuthenticated() {
  const r = await nextStep();
  return r.step === 'done' ? r.role : null;
}

export const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'E-mail ainda não confirmado.',
  'Invalid TOTP code entered': 'Código incorreto. Confira o app e tente de novo.',
  'captcha protection: request disallowed (invalid-input-response)': 'Verificação anti-robô falhou. Tente de novo.',
  'New password should be different from the old password.': 'A nova senha precisa ser diferente da anterior.',
};

export function authMessage(err: { message: string; status?: number }) {
  if (err.status === 429) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (/captcha/i.test(err.message)) return 'Verificação anti-robô falhou. Tente de novo.';
  if (/expired|verifier|invalid.*(code|grant|flow)/i.test(err.message))
    return 'Link expirado ou inválido. Peça um novo e abra no mesmo navegador.';
  return AUTH_ERRORS[err.message] ?? err.message;
}
