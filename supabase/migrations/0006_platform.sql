-- ════════════════════════════════════════════════════════════════════
--  Plataforma (super admin) — hotelguia.com.br/painel
--  Rode no SQL Editor depois do 0005. Idempotente.
--
--  • platform_admins: quem administra a plataforma (você). Cadastre com supabase/03_add_platform_admin.sql.
--  • Todas as operações passam por funções que conferem, no banco, que quem chama é admin da
--    plataforma COM 2FA verificado (aal2). Chamar a API direto sem isso não faz nada.
--  • Admin da plataforma também entra no painel de qualquer hotel (suporte).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

drop policy if exists "platform_admins: vê o próprio" on public.platform_admins;
create policy "platform_admins: vê o próprio" on public.platform_admins
  for select to authenticated using (user_id = auth.uid());
grant select on public.platform_admins to authenticated;

alter table public.hotels add column if not exists created_at timestamptz not null default now();

-- ── Quem é quem ─────────────────────────────────────────────────────
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- Admin do hotel OU admin da plataforma (suporte), sempre com 2FA.
create or replace function public.is_hotel_admin(hid text, roles text[] default array['owner','admin','staff'])
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and (
       exists (select 1 from public.hotel_admins where hotel_id = hid and user_id = auth.uid() and role = any(roles))
       or exists (select 1 from public.platform_admins where user_id = auth.uid())
     );
$$;

create or replace function public.assert_platform_admin()
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso negado: apenas administradores da plataforma (com 2FA).' using errcode = '42501';
  end if;
end $$;

-- ── Hotéis ──────────────────────────────────────────────────────────
-- Lista com números dos últimos 30 dias (contagem no banco — não baixa os eventos).
create or replace function public.platform_hotels()
returns table (
  id text, name text, created_at timestamptz, updated_at timestamptz, configured boolean,
  admins int, pending_admins int, sessions_30d bigint, events_30d bigint, last_activity timestamptz
)
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  perform public.assert_platform_admin();
  return query
  select h.id, h.name, h.created_at, h.updated_at, h.config is not null,
         (select count(*)::int from public.hotel_admins a where a.hotel_id = h.id),
         (select count(*)::int from public.hotel_admins a join auth.users u on u.id = a.user_id
            where a.hotel_id = h.id and u.last_sign_in_at is null),
         coalesce(e.sessions, 0), coalesce(e.events, 0), e.last_ts
  from public.hotels h
  left join lateral (
    select count(*) filter (where ev.type = 'session') as sessions, count(*) as events, max(ev.ts) as last_ts
    from public.analytics_events ev
    where ev.hotel_id = h.id and ev.ts > now() - interval '30 days'
  ) e on true
  order by h.name;
end $$;

create or replace function public.platform_create_hotel(p_id text, p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  if p_id !~ '^[a-z0-9-]{2,40}$' then
    raise exception 'Endereço inválido: use de 2 a 40 letras minúsculas, números ou hífen.';
  end if;
  if exists (select 1 from public.hotels where id = p_id) then
    raise exception 'Já existe um hotel com o endereço "%".', p_id;
  end if;
  if char_length(trim(p_name)) < 2 then
    raise exception 'Informe o nome do hotel.';
  end if;
  insert into public.hotels (id, name) values (p_id, trim(p_name));
exception
  when check_violation then
    raise exception 'O endereço "%" é reservado pela plataforma. Escolha outro.', p_id;
end $$;

create or replace function public.platform_rename_hotel(p_id text, p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  if char_length(trim(p_name)) < 2 then raise exception 'Informe o nome do hotel.'; end if;
  update public.hotels set name = trim(p_name) where id = p_id;
end $$;

-- Apaga o hotel, seus admins (vínculos) e analytics. As fotos no Storage ficam (apague pelo dashboard, se quiser).
create or replace function public.platform_delete_hotel(p_id text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  delete from public.hotels where id = p_id;
end $$;

-- ── Admins dos hotéis ───────────────────────────────────────────────
create or replace function public.platform_hotel_admins(p_hotel text)
returns table (user_id uuid, email text, role text, created_at timestamptz, last_sign_in_at timestamptz, has_2fa boolean)
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  perform public.assert_platform_admin();
  return query
  select a.user_id, u.email::text, a.role, a.created_at, u.last_sign_in_at,
         exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified')
  from public.hotel_admins a
  join auth.users u on u.id = a.user_id
  where a.hotel_id = p_hotel
  order by a.created_at;
end $$;

-- Usada pela Edge Function de convite: o usuário já existe? Já entrou alguma vez?
create or replace function public.platform_find_user(p_email text)
returns table (user_id uuid, signed_in boolean)
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  perform public.assert_platform_admin();
  return query
  select u.id, u.last_sign_in_at is not null
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
end $$;

create or replace function public.platform_set_admin(p_hotel text, p_user uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  if p_role not in ('owner','admin','staff') then raise exception 'Papel inválido.'; end if;
  insert into public.hotel_admins (hotel_id, user_id, role) values (p_hotel, p_user, p_role)
  on conflict (hotel_id, user_id) do update set role = excluded.role;
end $$;

create or replace function public.platform_remove_admin(p_hotel text, p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  delete from public.hotel_admins where hotel_id = p_hotel and user_id = p_user;
end $$;

-- Perdeu o celular: apaga a 2FA e encerra as sessões. No próximo login a pessoa cadastra o app de novo.
create or replace function public.platform_reset_2fa(p_user uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  perform public.assert_platform_admin();
  if p_user = auth.uid() then
    raise exception 'Você não pode redefinir a sua própria 2FA por aqui (use o SQL Editor).';
  end if;
  delete from auth.mfa_factors where user_id = p_user;
  delete from auth.sessions where user_id = p_user;
end $$;

-- ── Permissões ──────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'is_platform_admin()', 'assert_platform_admin()', 'platform_hotels()',
    'platform_create_hotel(text,text)', 'platform_rename_hotel(text,text)', 'platform_delete_hotel(text)',
    'platform_hotel_admins(text)', 'platform_find_user(text)', 'platform_set_admin(text,uuid,text)',
    'platform_remove_admin(text,uuid)', 'platform_reset_2fa(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
