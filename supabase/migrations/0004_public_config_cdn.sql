-- ════════════════════════════════════════════════════════════════════
--  Config publicada no CDN (cache) — o portal dos hóspedes para de consultar o banco.
--  Rode no SQL Editor depois do 0001/0002/0003. Idempotente.
--
--  Antes: cada visita de hóspede = 1 consulta na tabela hotels + 1 conexão de tempo real aberta.
--  Agora: a cada salvamento, o painel publica hotel-assets/<hotel_id>/config.json.
--         O hóspede lê esse arquivo pelo CDN do Storage; o banco só é tocado quando o admin altera algo.
-- ════════════════════════════════════════════════════════════════════

-- Permite o arquivo JSON no bucket (além das imagens).
update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml','application/json']
where id = 'hotel-assets';

-- Sobrescrever um arquivo (upsert) exige também permissão de leitura dos metadados.
-- (Os hóspedes leem pela URL pública do CDN, que não passa por estas regras.)
drop policy if exists "assets: admin lê" on storage.objects;
create policy "assets: admin lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'hotel-assets' and public.is_hotel_admin((storage.foldername(name))[1], array['owner','admin']));
