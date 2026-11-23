-- ════════════════════════════════════════════════════════════════════
--  Multi-hotel por endereço: hotelguia.com.br/<id-do-hotel>
--  Rode no SQL Editor depois do 0004. Idempotente.
--
--  O id do hotel vira o caminho da URL, então alguns nomes ficam reservados para páginas da
--  plataforma (mesma lista de RESERVED em src/lib/tenant.ts — mantenha as duas iguais).
-- ════════════════════════════════════════════════════════════════════

alter table public.hotels drop constraint if exists hotels_id_not_reserved;
alter table public.hotels add constraint hotels_id_not_reserved check (id not in (
  'assets','admin','api','app','www','static','public','login','painel','hoteis','sobre','contato'
));
