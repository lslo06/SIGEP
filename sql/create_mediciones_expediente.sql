-- Ejecutar como administrador en la base sigep de HomeLab.
begin;

create table if not exists public.mediciones_expediente (
  expediente_id bigint not null,
  predio_id bigint not null,
  estado text not null check (estado in ('medido', 'solicitado', 'asignado', 'visitado')),
  responsable text,
  fecha_compromiso date,
  fecha_visita date,
  superficie_m2 numeric(14,2) check (superficie_m2 > 0),
  observaciones text,
  referencia_evidencia text,
  actualizado_en timestamptz not null default now(),
  primary key (expediente_id, predio_id),
  foreign key (expediente_id, predio_id)
    references public.expediente_predios (expediente_id, predio_id) on delete restrict
);

grant select, insert, update on public.mediciones_expediente to sigep_editor;
commit;
