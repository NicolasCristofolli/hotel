-- ════════════════════════════════════════════════════════════════════
--  Limite de cliques por SESSÃO (não mais só por IP). Rode no SQL Editor depois do 0009
--  (e depois de publicar o site novo). Idempotente.
--
--  Problema do 0008: o limite era 3.000 eventos/hora por hotel + IP. No Wi-Fi do hotel todos os
--  hóspedes saem pelo MESMO IP, então na prática era 3.000/hora para o hotel inteiro — num pico
--  (café da manhã, check-in) os cliques eram descartados em silêncio e os relatórios ficavam errados.
--
--  Agora são dois limites:
--   • por sessão (aba do hóspede):     600 eventos/hora — uma visita normal gera 20–60;
--   • por hotel + IP (teto de abuso): 30.000 eventos/hora — cabe um hotel grande inteiro no mesmo Wi-Fi,
--     e ainda segura quem tenta burlar o limite trocando o id de sessão a cada envio.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.app_schema_version()
returns int language sql immutable as $$ select 10 $$;
grant execute on function public.app_schema_version() to anon, authenticated;

create or replace function public.analytics_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  ip text;
  hr timestamptz := date_trunc('hour', now());
  used int;
begin
  -- Só limita o que chega pela API (hóspedes); inserções feitas no próprio banco passam direto.
  if headers is null then
    return new;
  end if;

  -- 1) Por sessão
  insert into public.analytics_rate as r (bucket, hour, n)
  values (new.hotel_id || ':s:' || md5(coalesce(new.sid, '')), hr, 1)
  on conflict (bucket, hour) do update set n = r.n + 1
  returning r.n into used;
  if used > 600 then
    return null; -- descarta em silêncio
  end if;

  -- 2) Teto por hotel + IP
  ip := coalesce(headers ->> 'cf-connecting-ip', split_part(headers ->> 'x-forwarded-for', ',', 1), '');
  insert into public.analytics_rate as r (bucket, hour, n)
  values (new.hotel_id || ':' || md5(trim(ip)), hr, 1)
  on conflict (bucket, hour) do update set n = r.n + 1
  returning r.n into used;
  if used > 30000 then
    return null;
  end if;

  return new;
end $$;
