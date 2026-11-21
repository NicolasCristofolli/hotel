-- ════════════════════════════════════════════════════════════════════
--  Exige verificação em 2 etapas (2FA) no próprio banco.
--  Rode no SQL Editor depois do 0001_init.sql. Idempotente.
--
--  Antes: bastava senha para editar/ver relatórios.
--  Agora: só uma sessão com 2FA verificado (aal2) passa nas regras de admin —
--  mesmo que alguém descubra a senha e chame a API direto, sem o código não edita nada.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.is_hotel_admin(hid text, roles text[] default array['owner','admin','staff'])
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.hotel_admins
       where hotel_id = hid and user_id = auth.uid() and role = any(roles)
     );
$$;

-- ── Se alguém perder o celular ──────────────────────────────────────
-- Apaga a 2FA do usuário; no próximo login ele cadastra o app de novo.
-- (Troque o e-mail e rode só esta parte quando precisar.)
--
-- delete from auth.mfa_factors
-- where user_id = (select id from auth.users where email = 'EMAIL-DO-USUARIO@exemplo.com');
