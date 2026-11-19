-- Ejecutar después de create_expedientes.sql, create_mediciones_expediente.sql,
-- create_usuarios_locales.sql y enable_asignacion_topografia.sql.
-- Los archivos se conservan en almacenamiento privado del API; aquí solo quedan sus metadatos.
begin;

create table if not exists public.archivos_expediente (
  id uuid primary key,
  expediente_id bigint not null,
  predio_id bigint,
  tipo text not null check (tipo in ('evidencia_visita', 'plano', 'documento_general')),
  version integer not null check (version > 0),
  nombre_archivo text not null check (length(trim(nombre_archivo)) between 1 and 160),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  bytes bigint not null check (bytes between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  subido_por uuid not null references public.usuarios_locales(id) on delete restrict,
  requisito text,
  etapa text,
  estado_revision text not null default 'pendiente' check (estado_revision in ('pendiente','aceptado','rechazado')),
  revisado_por uuid references public.usuarios_locales(id) on delete restrict,
  revisado_en timestamptz,
  motivo_revision text,
  creado_en timestamptz not null default now(),
  foreign key (expediente_id, predio_id)
    references public.expediente_predios (expediente_id, predio_id) on delete restrict
);

-- RF-013–019: admite documentos generales de expediente además de evidencia y plano.
alter table public.expedientes drop constraint if exists expedientes_tipo_tramite_check;
alter table public.expedientes add constraint expedientes_tipo_tramite_check check (tipo_tramite in (
  'titulacion','busqueda_informacion','certificacion_antecedentes_titulo','certificacion_copia_titulo',
  'constancia_datos_lote','constancia_tramite_titulo'
));
alter table public.archivos_expediente alter column predio_id drop not null;
alter table public.archivos_expediente drop constraint if exists archivos_expediente_tipo_check;
alter table public.archivos_expediente add constraint archivos_expediente_tipo_check
  check (tipo in ('evidencia_visita', 'plano', 'documento_general'));
alter table public.archivos_expediente add column if not exists requisito text;
alter table public.archivos_expediente add column if not exists etapa text;
alter table public.archivos_expediente add column if not exists estado_revision text not null default 'pendiente';
alter table public.archivos_expediente add column if not exists revisado_por uuid references public.usuarios_locales(id) on delete restrict;
alter table public.archivos_expediente add column if not exists revisado_en timestamptz;
alter table public.archivos_expediente add column if not exists motivo_revision text;
alter table public.archivos_expediente drop constraint if exists archivos_expediente_estado_revision_check;
alter table public.archivos_expediente add constraint archivos_expediente_estado_revision_check
  check (estado_revision in ('pendiente','aceptado','rechazado'));
alter table public.archivos_expediente alter column predio_id drop not null;
alter table public.archivos_expediente drop constraint if exists archivos_expediente_expediente_id_predio_id_tipo_version_key;
create unique index if not exists archivos_expediente_version_idx
  on public.archivos_expediente (expediente_id, coalesce(predio_id, 0), tipo, coalesce(requisito, ''), version);

create index if not exists archivos_expediente_lookup_idx
  on public.archivos_expediente (expediente_id, predio_id, tipo, version desc);

grant select, insert on public.archivos_expediente to sigep_editor;
grant update (estado_revision, revisado_por, revisado_en, motivo_revision) on public.archivos_expediente to sigep_editor;

-- RF-025 y RF-030: cédula y propietarios/valores vinculados a cada predio del expediente.
create table if not exists public.datos_catastrales_expediente (
  expediente_id bigint not null,
  predio_id bigint not null,
  cedula_folio text,
  cedula_fecha date,
  valor_terreno numeric(14,2),
  valor_construccion numeric(14,2),
  valor_catastral numeric(14,2),
  propietarios jsonb not null default '[]'::jsonb check (jsonb_typeof(propietarios) = 'array'),
  estado_revision text not null default 'pendiente' check (estado_revision in ('pendiente','aceptado','rechazado')),
  motivo_revision text,
  capturado_por uuid not null references public.usuarios_locales(id) on delete restrict,
  capturado_en timestamptz not null default now(),
  revisado_por uuid references public.usuarios_locales(id) on delete restrict,
  revisado_en timestamptz,
  primary key (expediente_id, predio_id),
  foreign key (expediente_id, predio_id) references public.expediente_predios (expediente_id,predio_id) on delete restrict
);
grant select, insert, update on public.datos_catastrales_expediente to sigep_editor;

create table if not exists public.requisitos_documentales (
  tipo_tramite text not null,
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  primary key (tipo_tramite, nombre)
);
insert into public.requisitos_documentales(tipo_tramite,nombre) values
 ('titulacion','Solicitud de predio'),('titulacion','Constancia de posesión'),('titulacion','Identificación oficial'),('titulacion','Acta de nacimiento'),('titulacion','Comprobante de domicilio'),('titulacion','Cédula catastral'),('titulacion','Otro'),
 ('busqueda_informacion','Identificación oficial'),('busqueda_informacion','Solicitud escrita'),('busqueda_informacion','Otro'),
 ('certificacion_antecedentes_titulo','Identificación oficial'),('certificacion_antecedentes_titulo','Solicitud escrita'),('certificacion_antecedentes_titulo','Otro'),
 ('certificacion_copia_titulo','Identificación oficial'),('certificacion_copia_titulo','Solicitud escrita'),('certificacion_copia_titulo','Otro'),
 ('constancia_datos_lote','Identificación oficial'),('constancia_datos_lote','Solicitud escrita'),('constancia_datos_lote','Otro'),
 ('constancia_tramite_titulo','Identificación oficial'),('constancia_tramite_titulo','Solicitud escrita'),('constancia_tramite_titulo','Otro')
on conflict do nothing;
grant select, insert, update, delete on public.requisitos_documentales to sigep_editor;
commit;
