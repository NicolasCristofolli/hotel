// @ts-nocheck — runs on Deno inside Supabase; the editor's Node TypeScript doesn't know `Deno` or `npm:` imports.
// ════════════════════════════════════════════════════════════════════
//  Edge Function: invite-admin
//  Convida (ou vincula) um administrador a um hotel. Só admins da plataforma com 2FA podem chamar.
//
//  Por que uma Edge Function: criar usuários exige a chave secreta do Supabase, que nunca pode
//  ir para o navegador. Todo o resto do super admin usa funções SQL (migrations/0006_platform.sql).
//
//  Em vez de mandar e-mail, devolve um LINK de acesso para o super admin enviar por WhatsApp/e-mail.
//  Com { password_reset: true }, gera um link de nova senha para quem já usa o sistema (não muda o papel).
//
//  Deploy (dashboard): Edge Functions → Deploy a new function → Via Editor → nome "invite-admin" →
//  cole este arquivo → Deploy. Depois, nos detalhes da função, DESLIGUE "Verify JWT" (a função
//  confere o login sozinha, abaixo).
// ════════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

// Sites that may call this function and receive its links. Extra ones (e.g. a preview) go in the
// ALLOWED_ORIGINS secret, comma-separated.
const ALLOWED = new Set([
  'https://hotelguia.com.br',
  'https://www.hotelguia.com.br',
  ...(Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
]);
const allowedOrigin = (o: string) => ALLOWED.has(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

const ROLES = ['owner', 'admin', 'staff'];

Deno.serve(async (req) => {
  const reqOrigin = req.headers.get('Origin') ?? '';
  // Per request (requests run concurrently — no shared mutable headers).
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin(reqOrigin) ? reqOrigin : 'https://hotelguia.com.br',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  // Chave secreta: a padrão das Edge Functions ou, se o projeto só usar as chaves novas, um secret
  // PLATFORM_SECRET_KEY com a "secret key" (sb_secret_…) — Edge Functions → Secrets.
  const secret = Deno.env.get('PLATFORM_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apikey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!url || !secret) return json({ error: 'Função sem a chave secreta configurada (PLATFORM_SECRET_KEY).' }, 500);
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Faça login.' }, 401);

  // Cliente com o login de QUEM CHAMOU: as funções SQL conferem admin da plataforma + 2FA.
  const asCaller = createClient(url, apikey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: authErr } = await asCaller.rpc('is_platform_admin');
  if (authErr || allowed !== true) return json({ error: 'Acesso negado: apenas administradores da plataforma (com 2FA).' }, 403);

  let body: { hotel_id?: string; email?: string; role?: string; redirect_to?: string; password_reset?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requisição inválida.' }, 400);
  }
  const hotelId = String(body.hotel_id ?? '');
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  const role = String(body.role ?? 'admin');
  if (!/^[a-z0-9-]{2,40}$/.test(hotelId)) return json({ error: 'Hotel inválido.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400);
  if (!ROLES.includes(role)) return json({ error: 'Papel inválido.' }, 400);

  // O link volta para o painel do próprio hotel, no mesmo site de quem convidou.
  const origin = (() => {
    try {
      return new URL(String(body.redirect_to ?? '')).origin;
    } catch {
      return '';
    }
  })();
  if (!origin || !allowedOrigin(origin)) return json({ error: 'Endereço de retorno não permitido.' }, 400);
  const redirectTo = `${origin}/${hotelId}?convite=1`;

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: found, error: findErr } = await asCaller.rpc('platform_find_user', { p_email: email });
  if (findErr) return json({ error: findErr.message }, 400);
  const existing = (found as { user_id: string; signed_in: boolean }[] | null)?.[0];

  let userId = existing?.user_id;
  let link: string | null = null;
  let status: 'invited' | 'pending' | 'linked' | 'reset';

  if (body.password_reset === true) {
    // "Esqueceu a senha": link de uso único para criar uma nova (depois de confirmar a 2FA). Só para quem já tem conta.
    if (!existing) return json({ error: 'Este e-mail não tem conta.' }, 400);
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
    if (error) return json({ error: `Não foi possível gerar o link: ${error.message}` }, 400);
    return json({ status: 'reset', link: data.properties.action_link, email });
  }

  if (!existing) {
    // Novo usuário: cria a conta e gera o link de convite (a pessoa cria a senha e a 2FA ao abrir).
    const { data, error } = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } });
    if (error || !data.user) return json({ error: `Não foi possível criar o convite: ${error?.message}` }, 400);
    userId = data.user.id;
    link = data.properties.action_link;
    status = 'invited';
  } else if (!existing.signed_in) {
    // Já convidado, mas nunca entrou (ex.: link expirou) → novo link para criar a senha.
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
    if (error) return json({ error: `Não foi possível gerar o link: ${error.message}` }, 400);
    link = data.properties.action_link;
    status = 'pending';
  } else {
    // Já usa o sistema (ex.: admin de outro hotel) → só vincula; ele entra com a senha de sempre.
    status = 'linked';
  }

  const { error: linkErr } = await asCaller.rpc('platform_set_admin', { p_hotel: hotelId, p_user: userId, p_role: role });
  if (linkErr) return json({ error: linkErr.message }, 400);

  return json({ status, link, email });
});
