-- ════════════════════════════════════════════════════════════════════
--  Limite de tamanho das imagens no Storage.
--  Rode no SQL Editor depois do 0001_init.sql. Idempotente.
--
--  O painel já reduz e comprime cada foto antes de enviar (até ~600 KB, no caso do mapa).
--  Este limite é a garantia no servidor: mesmo chamando a API direto, nada acima de 1 MB entra.
-- ════════════════════════════════════════════════════════════════════

update storage.buckets
set file_size_limit = 1048576,  -- 1 MB
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml']
where id = 'hotel-assets';
