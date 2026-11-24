-- ════════════════════════════════════════════════════════════════════
--  Vitrine de hotéis + reforços de segurança. Rode no SQL Editor depois do 0008
--  (e depois de publicar o site novo). Idempotente.
--
--   • public_hotels() — lista pública para a página inicial (nome, cidade, foto, logo, cor).
--     Só hotéis com conteúdo salvo e marcados como "na vitrine" (hotels.listed, padrão: sim).
--     O super admin liga/desliga no /painel (platform_set_listed).
--   • Visitantes deixam de ver colunas internas de hotels (ex.: updated_by, o id de quem salvou).
--   • Upload de SVG desativado: um SVG pode conter código. O painel converte logos SVG em PNG/WebP.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.app_schema_version()
returns int language sql immutable as $$ select 9 $$;
grant execute on function public.app_schema_version() to anon, authenticated;

-- ── Colunas que visitantes podem ler ────────────────────────────────
alter table public.hotels add column if not exists listed boolean not null default true;

revoke select on public.hotels from anon;
grant select (id, name, config, config_rev, updated_at) on public.hotels to anon;

-- ── Vitrine ─────────────────────────────────────────────────────────
create or replace function public.public_hotels()
returns table (id text, name text, city text, region text, image text, logo text, monogram text, color text)
language sql stable security definer set search_path = public
as $$
  select h.id,
         coalesce(nullif(h.config #>> '{identity,name}', ''), h.name),
         coalesce(h.config #>> '{identity,city}', ''),
         coalesce(h.config #>> '{identity,region}', ''),
         coalesce(h.config #>> '{identity,heroImage}', ''),
         coalesce(h.config #>> '{identity,logo}', ''),
         coalesce(h.config #>> '{identity,monogram}', ''),
         coalesce(h.config #>> '{theme,primary}', '')
  from public.hotels h
  where h.listed and h.config is not null
  order by 2;
$$;
revoke all on function public.public_hotels() from public;
grant execute on function public.public_hotels() to anon, authenticated;

create or replace function public.platform_set_listed(p_id text, p_listed boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  update public.hotels set listed = p_listed where id = p_id;
  if not found then raise exception 'Hotel não encontrado.'; end if;
end $$;
revoke all on function public.platform_set_listed(text, boolean) from public, anon;
grant execute on function public.platform_set_listed(text, boolean) to authenticated;

-- platform_hotels() passa a dizer se o hotel está na vitrine (muda o retorno → recria).
drop function if exists public.platform_hotels();
create function public.platform_hotels()
returns table (
  id text, name text, created_at timestamptz, updated_at timestamptz, configured boolean, listed boolean,
  admins int, pending_admins int, sessions_30d bigint, events_30d bigint, last_activity timestamptz
)
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  perform public.assert_platform_admin();
  return query
  select h.id, h.name, h.created_at, h.updated_at, h.config is not null, h.listed,
         (select count(*)::int from public.hotel_admins a where a.hotel_id = h.id),
         (select count(*)::int from public.hotel_admins a join auth.users u on u.id = a.user_id
            where a.hotel_id = h.id and u.last_sign_in_at is null),
         coalesce(e.sessions, 0), coalesce(e.events, 0),
         (select max(ev.ts) from public.analytics_events ev where ev.hotel_id = h.id)
  from public.hotels h
  left join lateral (
    select sum(x.n) filter (where x.type = 'session')::bigint as sessions, sum(x.n)::bigint as events
    from public.analytics_daily x
    where x.hotel_id = h.id and x.day > (now() at time zone h.timezone)::date - 30
  ) e on true
  order by h.name;
end $$;
revoke all on function public.platform_hotels() from public, anon;
grant execute on function public.platform_hotels() to authenticated;

-- ── Storage: sem SVG ────────────────────────────────────────────────
update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','application/json']
where id = 'hotel-assets';
