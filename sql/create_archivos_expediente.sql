-- Ejecutar después de create_expedientes.sql, create_mediciones_expediente.sql,
-- create_usuarios_locales.sql y enable_asignacion_topografia.sql.
-- Los archivos se conservan en almacenamiento privado del API; aquí solo quedan sus metadatos.
begin;

create table if not exists public.archivos_expediente (
  id uuid primary key,
  expediente_id bigint not null,
  predio_id bigint not null,
  tipo text not null check (tipo in ('evidencia_visita', 'plano')),
  version integer not null check (version > 0),
  nombre_archivo text not null check (length(trim(nombre_archivo)) between 1 and 160),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  bytes bigint not null check (bytes between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  subido_por uuid not null references public.usuarios_locales(id) on delete restrict,
  creado_en timestamptz not null default now(),
  foreign key (expediente_id, predio_id)
    references public.expediente_predios (expediente_id, predio_id) on delete restrict,
  unique (expediente_id, predio_id, tipo, version)
);

create index if not exists archivos_expediente_lookup_idx
  on public.archivos_expediente (expediente_id, predio_id, tipo, version desc);

grant select, insert on public.archivos_expediente to sigep_editor;
commit;
