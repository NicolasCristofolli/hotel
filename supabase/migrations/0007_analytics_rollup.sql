-- ════════════════════════════════════════════════════════════════════
--  Relatórios agregados (fase 3). Rode no SQL Editor depois do 0006. Idempotente.
--
--  Antes: a aba Relatórios baixava TODOS os cliques para o navegador e somava lá.
--  Agora:
--   • analytics_daily  — total por dia/tipo/item (rankings, totais, acessos por dia).
--   • analytics_hourly — só os totais de cada hora (gráfico "Uso por horário"); no máx. 24 linhas/dia.
--     Os dois são atualizados automaticamente a cada lote de cliques (gatilho) e ficam para sempre:
--     ocupam ~1% do espaço dos cliques individuais.
--   • hotel_report()   — calcula o relatório no banco e devolve um JSON pequeno (~15 KB),
--     do mesmo tamanho com 100 ou 10 milhões de cliques.
--   • Cliques individuais (analytics_events) ficam 90 dias — usados no "Exportar CSV" — e são
--     apagados todo dia pelo pg_cron. Os números dos relatórios não mudam: vêm dos resumos.
--   • Dias e horas seguem o fuso do hotel (hotels.timezone, padrão America/Sao_Paulo).
-- ════════════════════════════════════════════════════════════════════

alter table public.hotels add column if not exists timezone text not null default 'America/Sao_Paulo';

create table if not exists public.analytics_daily (
  hotel_id  text not null references public.hotels (id) on delete cascade,
  day       date not null,                   -- dia no fuso do hotel
  type      text not null,
  target    text not null,
  label     text not null,                   -- nome mais recente do item
  n         integer not null default 0,
  primary key (hotel_id, day, type, target)
);

create table if not exists public.analytics_hourly (
  hotel_id      text not null references public.hotels (id) on delete cascade,
  hour          timestamptz not null,        -- início da hora
  sessions      integer not null default 0,  -- acessos ao portal
  interactions  integer not null default 0,  -- tudo menos visualização de página
  primary key (hotel_id, hour)
);

alter table public.analytics_daily  enable row level security;
alter table public.analytics_hourly enable row level security;

drop policy if exists "analytics_daily: admin lê" on public.analytics_daily;
create policy "analytics_daily: admin lê" on public.analytics_daily
  for select to authenticated using (public.is_hotel_admin(hotel_id));
drop policy if exists "analytics_daily: dono apaga" on public.analytics_daily;
create policy "analytics_daily: dono apaga" on public.analytics_daily
  for delete to authenticated using (public.is_hotel_admin(hotel_id, array['owner','admin']));

drop policy if exists "analytics_hourly: admin lê" on public.analytics_hourly;
create policy "analytics_hourly: admin lê" on public.analytics_hourly
  for select to authenticated using (public.is_hotel_admin(hotel_id));
drop policy if exists "analytics_hourly: dono apaga" on public.analytics_hourly;
create policy "analytics_hourly: dono apaga" on public.analytics_hourly
  for delete to authenticated using (public.is_hotel_admin(hotel_id, array['owner','admin']));

grant select, delete on public.analytics_daily, public.analytics_hourly to authenticated;

-- ── Resumo automático ───────────────────────────────────────────────
-- Uma vez por INSERT (o portal envia os cliques em lotes), não uma vez por linha.
create or replace function public.analytics_rollup()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.analytics_daily as d (hotel_id, day, type, target, label, n)
  select e.hotel_id, (e.ts at time zone h.timezone)::date, e.type, e.target,
         (array_agg(e.label order by e.ts desc))[1], count(*)
  from new_rows e
  join public.hotels h on h.id = e.hotel_id
  group by 1, 2, 3, 4
  on conflict (hotel_id, day, type, target)
  do update set n = d.n + excluded.n, label = excluded.label;

  insert into public.analytics_hourly as x (hotel_id, hour, sessions, interactions)
  select hotel_id, date_trunc('hour', ts, 'UTC'),
         count(*) filter (where type = 'session'), count(*) filter (where type <> 'page')
  from new_rows
  group by 1, 2
  on conflict (hotel_id, hour)
  do update set sessions = x.sessions + excluded.sessions, interactions = x.interactions + excluded.interactions;
  return null;
end $$;

drop trigger if exists analytics_events_rollup on public.analytics_events;
create trigger analytics_events_rollup
  after insert on public.analytics_events
  referencing new table as new_rows
  for each statement execute function public.analytics_rollup();

-- Meia-noite (no fuso do hotel) do primeiro dia cujos cliques individuais ainda são guardados.
-- A limpeza e o preenchimento abaixo usam o mesmo limite, então nunca resumem um dia pela metade.
create or replace function public.analytics_retention_start(tz text, keep_days int default 90)
returns timestamptz
language sql stable
as $$ select (((now() at time zone tz)::date - keep_days)::timestamp) at time zone tz $$;

-- Preenche os resumos com o histórico existente. Recalcula a partir dos cliques (valor exato),
-- então rodar de novo não duplica nada.
insert into public.analytics_daily as d (hotel_id, day, type, target, label, n)
select e.hotel_id, (e.ts at time zone h.timezone)::date, e.type, e.target,
       (array_agg(e.label order by e.ts desc))[1], count(*)
from public.analytics_events e
join public.hotels h on h.id = e.hotel_id
where e.ts >= public.analytics_retention_start(h.timezone)
group by 1, 2, 3, 4
on conflict (hotel_id, day, type, target)
do update set n = excluded.n, label = excluded.label;

insert into public.analytics_hourly as x (hotel_id, hour, sessions, interactions)
select e.hotel_id, date_trunc('hour', e.ts, 'UTC'),
       count(*) filter (where e.type = 'session'), count(*) filter (where e.type <> 'page')
from public.analytics_events e
join public.hotels h on h.id = e.hotel_id
where e.ts >= public.analytics_retention_start(h.timezone)
group by 1, 2
on conflict (hotel_id, hour)
do update set sessions = excluded.sessions, interactions = excluded.interactions;

-- ── Limpeza dos cliques antigos ─────────────────────────────────────
create or replace function public.purge_old_analytics(keep_days int default 90)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare deleted bigint;
begin
  delete from public.analytics_events e
  using public.hotels h
  where h.id = e.hotel_id and e.ts < public.analytics_retention_start(h.timezone, keep_days);
  get diagnostics deleted = row_count;
  return deleted;
end $$;
revoke all on function public.purge_old_analytics(int) from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('purge-old-analytics', '30 6 * * *', 'select public.purge_old_analytics(90)'); -- 03:30 em Brasília
exception when others then
  raise notice 'pg_cron indisponível (%). Ative em Database → Extensions → pg_cron e rode este arquivo de novo.', sqlerrm;
end $$;

-- ── Relatório calculado no banco ────────────────────────────────────
-- p_days: 1 = hoje, 7, 30… (dias corridos até hoje, no fuso do hotel); null = tudo.
-- Inclui os totais do período anterior de mesmo tamanho (comparação "vs. período anterior").
create or replace function public.hotel_report(p_hotel text, p_days int default 7)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  tz text;
  today date;
  d_from date;
  result jsonb;
begin
  if not public.is_hotel_admin(p_hotel) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  select h.timezone into tz from public.hotels h where h.id = p_hotel;
  today := (now() at time zone tz)::date;
  d_from := case when p_days is null then date '2000-01-01' else today - (p_days - 1) end;

  with cur as (
    select * from public.analytics_daily where hotel_id = p_hotel and day >= d_from
  )
  select jsonb_build_object(
    'today', today,
    'timezone', tz,
    'totals', coalesce((select jsonb_object_agg(type, n) from (select type, sum(n) n from cur group by type) t), '{}'::jsonb),
    'prev_totals', case when p_days is null then null else coalesce((
        select jsonb_object_agg(type, n) from (
          select type, sum(n) n from public.analytics_daily
          where hotel_id = p_hotel and day >= d_from - p_days and day < d_from
          group by type) t), '{}'::jsonb) end,
    'targets', coalesce((
        select jsonb_agg(jsonb_build_object('type', type, 'target', target, 'label', label, 'n', n) order by n desc)
        from (select type, target, (array_agg(label order by day desc))[1] label, sum(n) n
              from cur group by type, target) t), '[]'::jsonb),
    'by_hour', (
        select jsonb_agg(coalesce(x.n, 0) order by g.h)
        from generate_series(0, 23) g(h)
        left join (select extract(hour from hour at time zone tz)::int hh, sum(interactions) n
                   from public.analytics_hourly
                   where hotel_id = p_hotel and hour >= (d_from::timestamp at time zone tz)
                   group by 1) x on x.hh = g.h),
    'by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day)
        from (select day, sum(n) filter (where type = 'session') n from cur group by day) t
        where n > 0), '[]'::jsonb),
    'first', (select min(day) from public.analytics_daily where hotel_id = p_hotel)
  ) into result;
  return result;
end $$;
revoke all on function public.hotel_report(text, int) from public, anon;
grant execute on function public.hotel_report(text, int) to authenticated;

-- ── Super admin: contagens dos 30 dias vindas do resumo ─────────────
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
