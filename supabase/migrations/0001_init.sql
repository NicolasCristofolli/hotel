-- ════════════════════════════════════════════════════════════════════
--  Guia do Hóspede — schema inicial
--  Rode inteiro no Supabase: SQL Editor → New query → colar → Run.
--  É idempotente: pode rodar de novo sem quebrar nada.
-- ════════════════════════════════════════════════════════════════════

-- ── Hotéis ──────────────────────────────────────────────────────────
-- Toda a configuração do portal (textos, cores, eventos, atalhos…) fica em `config`.
create table if not exists public.hotels (
  id          text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name        text not null,
  config      jsonb,                       -- null → o portal usa o padrão do código
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

-- ── Administradores ────────────────────────────────────────────────
-- Quem pode editar cada hotel. Usuários são criados em Authentication → Users.
create table if not exists public.hotel_admins (
  hotel_id    text not null references public.hotels (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'admin' check (role in ('owner', 'admin', 'staff')),
  created_at  timestamptz not null default now(),
  primary key (hotel_id, user_id)
);

-- ── Analytics (anônimo) ────────────────────────────────────────────
create table if not exists public.analytics_events (
  id        bigint generated always as identity primary key,
  hotel_id  text not null references public.hotels (id) on delete cascade,
  type      text not null check (type in (
              'session','page','shortcut','request','whatsapp','booking',
              'calendar','event_map','service','pin','wifi','notice_dismiss')),
  target    text not null check (char_length(target) <= 80),
  label     text not null check (char_length(label) <= 120),
  sid       text not null check (char_length(sid) <= 40),
  ts        timestamptz not null default now()   -- definido pelo servidor, não pelo cliente
);
create index if not exists analytics_events_hotel_ts on public.analytics_events (hotel_id, ts desc);

-- ── Funções auxiliares ─────────────────────────────────────────────
-- security definer: consulta hotel_admins sem depender das políticas da própria tabela.
create or replace function public.is_hotel_admin(hid text, roles text[] default array['owner','admin','staff'])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.hotel_admins
    where hotel_id = hid and user_id = auth.uid() and role = any(roles)
  );
$$;

-- Carimba quem/quando editou.
create or replace function public.touch_hotel()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists hotels_touch on public.hotels;
create trigger hotels_touch before update on public.hotels
  for each row execute function public.touch_hotel();

-- ── Row Level Security ─────────────────────────────────────────────
alter table public.hotels           enable row level security;
alter table public.hotel_admins     enable row level security;
alter table public.analytics_events enable row level security;

-- Hotéis: qualquer um lê (é o portal público); só admin do hotel altera.
drop policy if exists "hotels: leitura pública" on public.hotels;
create policy "hotels: leitura pública" on public.hotels
  for select using (true);

drop policy if exists "hotels: admin edita" on public.hotels;
create policy "hotels: admin edita" on public.hotels
  for update to authenticated
  using (public.is_hotel_admin(id, array['owner','admin']))
  with check (public.is_hotel_admin(id, array['owner','admin']));

-- Admins: cada usuário vê apenas os próprios vínculos (gerenciados pelo dashboard do Supabase).
drop policy if exists "hotel_admins: vê o próprio" on public.hotel_admins;
create policy "hotel_admins: vê o próprio" on public.hotel_admins
  for select to authenticated using (user_id = auth.uid());

-- Analytics: hóspedes (anônimos) só INSEREM; só admins LEEM e APAGAM.
drop policy if exists "analytics: hóspede registra" on public.analytics_events;
create policy "analytics: hóspede registra" on public.analytics_events
  for insert to anon, authenticated
  with check (exists (select 1 from public.hotels h where h.id = hotel_id));

drop policy if exists "analytics: admin lê" on public.analytics_events;
create policy "analytics: admin lê" on public.analytics_events
  for select to authenticated using (public.is_hotel_admin(hotel_id));

drop policy if exists "analytics: dono apaga" on public.analytics_events;
create policy "analytics: dono apaga" on public.analytics_events
  for delete to authenticated using (public.is_hotel_admin(hotel_id, array['owner','admin']));

-- Permissões de tabela (RLS acima filtra as linhas).
grant select on public.hotels to anon, authenticated;
grant update (config, name) on public.hotels to authenticated;
grant select on public.hotel_admins to authenticated;
grant insert (hotel_id, type, target, label, sid) on public.analytics_events to anon, authenticated;
grant select, delete on public.analytics_events to authenticated;

-- ── Tempo real ─────────────────────────────────────────────────────
-- Celulares dos hóspedes recebem as alterações do admin na hora.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'hotels') then
    alter publication supabase_realtime add table public.hotels;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'analytics_events') then
    alter publication supabase_realtime add table public.analytics_events;
  end if;
end $$;

-- ── Storage (logos e fotos) ────────────────────────────────────────
-- Arquivos em hotel-assets/<hotel_id>/...  Leitura pública; escrita só do admin daquele hotel.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hotel-assets', 'hotel-assets', true, 1048576,  -- 1 MB (o painel comprime antes de enviar)
        array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "assets: admin envia" on storage.objects;
create policy "assets: admin envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hotel-assets' and public.is_hotel_admin((storage.foldername(name))[1], array['owner','admin']));

drop policy if exists "assets: admin altera" on storage.objects;
create policy "assets: admin altera" on storage.objects
  for update to authenticated
  using (bucket_id = 'hotel-assets' and public.is_hotel_admin((storage.foldername(name))[1], array['owner','admin']));

drop policy if exists "assets: admin apaga" on storage.objects;
create policy "assets: admin apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'hotel-assets' and public.is_hotel_admin((storage.foldername(name))[1], array['owner','admin']));

-- ── Hotel inicial ──────────────────────────────────────────────────
insert into public.hotels (id, name) values ('vale-sereno', 'Hotel Vale Sereno')
on conflict (id) do nothing;
