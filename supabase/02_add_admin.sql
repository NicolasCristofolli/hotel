-- ════════════════════════════════════════════════════════════════════
--  Dar acesso de administrador a um usuário
--  1. Authentication → Users → "Add user" → "Create new user"
--     (e-mail + senha forte, marque "Auto Confirm User")
--  2. Troque o e-mail abaixo e rode no SQL Editor.
--  Papéis: owner (tudo) · admin (edita tudo) · staff (só vê relatórios)
-- ════════════════════════════════════════════════════════════════════

insert into public.hotel_admins (hotel_id, user_id, role)
select 'vale-sereno', id, 'owner'
from auth.users
where email = 'SEU-EMAIL@exemplo.com'
on conflict (hotel_id, user_id) do update set role = excluded.role;

-- Conferir:
-- select a.hotel_id, u.email, a.role from public.hotel_admins a join auth.users u on u.id = a.user_id;
