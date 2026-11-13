-- Aplicar después de create_mediciones_expediente.sql y create_usuarios_locales.sql.
begin;
alter table public.mediciones_expediente
  add column if not exists responsable_id uuid references public.usuarios_locales(id),
  add column if not exists asignado_en timestamptz;
create index if not exists mediciones_responsable_idx
  on public.mediciones_expediente(responsable_id, estado);
commit;
