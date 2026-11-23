-- ════════════════════════════════════════════════════════════════════
--  Tornar um usuário administrador da PLATAFORMA (acesso a hotelguia.com.br/painel
--  e ao painel de todos os hotéis). Rode depois do 0006_platform.sql.
--  O usuário precisa já existir (Authentication → Users). Troque o e-mail e rode.
-- ════════════════════════════════════════════════════════════════════

insert into public.platform_admins (user_id)
select id from auth.users where email = 'SEU-EMAIL@exemplo.com'
on conflict do nothing;

-- Conferir:
-- select u.email from public.platform_admins p join auth.users u on u.id = p.user_id;

-- Remover:
-- delete from public.platform_admins where user_id = (select id from auth.users where email = 'EMAIL@exemplo.com');

-- Se VOCÊ perder o celular (2FA), rode no SQL Editor:
-- delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'SEU-EMAIL@exemplo.com');
