-- ════════════════════════════════════════════════════════════════════
--  Histórico de versões + edição simultânea + limite contra spam. Rode no SQL Editor depois do 0007.
--  Idempotente (pode rodar de novo sem problema).
--
--   • hotel_config_versions — cada sessão de edição vira uma versão (edições seguidas da mesma
--     pessoa, com menos de 15 min entre elas, ficam na mesma versão). O painel lista e restaura.
--     Guarda as 100 últimas por hotel.
--   • hotels.config_rev — número que sobe a cada alteração do conteúdo. O painel só salva se
--     ninguém salvou no meio; senão, junta as duas alterações (em vez de apagar a do outro).
--   • Limite contra spam nos cliques anônimos: no máx. 3.000 por hora por IP e hotel (o Wi-Fi do
--     hotel deixa todos os hóspedes com o mesmo IP, por isso o limite é folgado). O excesso é
--     descartado em silêncio. O IP não é guardado, só um hash dele, por até 1 dia.
--   • app_schema_version() — o site confere se o banco tem todas as migrações.
-- ════════════════════════════════════════════════════════════════════

-- ── Versão do banco ─────────────────────────────────────────────────
-- Cada migração nova redefine este número; o site avisa quando o banco está atrás.
create or replace function public.app_schema_version()
returns int language sql immutable as $$ select 8 $$;
grant execute on function public.app_schema_version() to anon, authenticated;

-- ── Histórico de versões ────────────────────────────────────────────
alter table public.hotels add column if not exists config_rev bigint not null default 0;

create table if not exists public.hotel_config_versions (
  id              bigint generated always as identity primary key,
  hotel_id        text not null references public.hotels (id) on delete cascade,
  config          jsonb not null,
  started_at      timestamptz not null default now(),  -- início da sessão de edição
  saved_at        timestamptz not null default now(),  -- último salvamento da sessão
  saved_by        uuid,                                -- null = versão inicial / sistema
  saved_by_email  text,
  edits           int not null default 1
);
create index if not exists hotel_config_versions_hotel on public.hotel_config_versions (hotel_id, id desc);

-- Só pelas funções abaixo (com a checagem de permissão); nada de acesso direto à tabela.
alter table public.hotel_config_versions enable row level security;
revoke all on public.hotel_config_versions from anon, authenticated;

create or replace function public.hotels_config_history()
returns trigger
language plpgsql security definer set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  last public.hotel_config_versions%rowtype;
begin
  if new.config is not distinct from old.config then
    return new;
  end if;
  new.config_rev := old.config_rev + 1;
  if new.config is null then
    return new;
  end if;

  select * into last from public.hotel_config_versions where hotel_id = new.id order by id desc limit 1;
  if last.id is not null and uid is not null and last.saved_by = uid and last.saved_at > now() - interval '15 minutes' then
    update public.hotel_config_versions
      set config = new.config, saved_at = now(), edits = edits + 1
      where id = last.id;
  else
    insert into public.hotel_config_versions (hotel_id, config, saved_by, saved_by_email)
    values (new.id, new.config, uid, (select email from auth.users where id = uid));
    delete from public.hotel_config_versions v
      where v.hotel_id = new.id
        and v.id < (select min(id) from (select id from public.hotel_config_versions
                                         where hotel_id = new.id order by id desc limit 100) keep);
  end if;
  return new;
end $$;

drop trigger if exists hotels_config_history on public.hotels;
create trigger hotels_config_history before update of config on public.hotels
  for each row execute function public.hotels_config_history();

-- Ponto de partida: o conteúdo atual de cada hotel vira a "versão inicial".
insert into public.hotel_config_versions (hotel_id, config, started_at, saved_at, saved_by, saved_by_email, edits)
select h.id, h.config, h.updated_at, h.updated_at, null, null, 0
from public.hotels h
where h.config is not null
  and not exists (select 1 from public.hotel_config_versions v where v.hotel_id = h.id);

create or replace function public.hotel_versions(p_hotel text)
returns table (id bigint, started_at timestamptz, saved_at timestamptz, saved_by_email text, edits int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_hotel_admin(p_hotel, array['owner','admin']) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  return query
  select v.id, v.started_at, v.saved_at, v.saved_by_email, v.edits
  from public.hotel_config_versions v
  where v.hotel_id = p_hotel
  order by v.id desc
  limit 100;
end $$;

create or replace function public.hotel_version_config(p_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  hid text;
  cfg jsonb;
begin
  select v.hotel_id, v.config into hid, cfg from public.hotel_config_versions v where v.id = p_id;
  if hid is null or not public.is_hotel_admin(hid, array['owner','admin']) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  return cfg;
end $$;

revoke all on function public.hotel_versions(text) from public, anon;
revoke all on function public.hotel_version_config(bigint) from public, anon;
grant execute on function public.hotel_versions(text) to authenticated;
grant execute on function public.hotel_version_config(bigint) to authenticated;

-- ── Limite contra spam nos cliques ──────────────────────────────────
create table if not exists public.analytics_rate (
  bucket  text not null,         -- hotel + hash do IP
  hour    timestamptz not null,
  n       int not null default 0,
  primary key (bucket, hour)
);
alter table public.analytics_rate enable row level security;
revoke all on public.analytics_rate from anon, authenticated;

create or replace function public.analytics_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  ip text;
  used int;
begin
  -- Só limita o que chega pela API (hóspedes); inserções feitas no próprio banco passam direto.
  if headers is null then
    return new;
  end if;
  ip := coalesce(headers ->> 'cf-connecting-ip', split_part(headers ->> 'x-forwarded-for', ',', 1), '');
  insert into public.analytics_rate as r (bucket, hour, n)
  values (new.hotel_id || ':' || md5(trim(ip)), date_trunc('hour', now()), 1)
  on conflict (bucket, hour) do update set n = r.n + 1
  returning r.n into used;
  if used > 3000 then
    return null; -- descarta em silêncio
  end if;
  return new;
end $$;

drop trigger if exists analytics_events_guard on public.analytics_events;
create trigger analytics_events_guard before insert on public.analytics_events
  for each row execute function public.analytics_guard();

-- A limpeza diária (0007) passa a apagar também os contadores do limite.
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
  delete from public.analytics_rate where hour < now() - interval '1 day';
  return deleted;
end $$;
revoke all on function public.purge_old_analytics(int) from public, anon, authenticated;
