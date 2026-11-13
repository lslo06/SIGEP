-- Aplicar en la base sigep después de create_expedientes.sql.
begin;

create table if not exists public.pagos_expediente (
  id bigint generated always as identity primary key,
  expediente_id bigint not null references public.expedientes(id) on delete restrict,
  concepto text not null check (concepto in ('Lote', 'Servicios catastrales', 'Búsqueda de información', 'Documento solicitado')),
  recibo text not null,
  importe numeric(14,2) not null check (importe > 0),
  fecha date not null,
  evidencia text not null,
  creado_en timestamptz not null default now(),
  unique (recibo, concepto)
);

create index if not exists pagos_expediente_folio_idx on public.pagos_expediente (expediente_id);
grant select, insert on public.pagos_expediente to sigep_editor;
grant usage, select on sequence public.pagos_expediente_id_seq to sigep_editor;
commit;
