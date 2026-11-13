begin;
create table if not exists public.usuarios_locales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  correo text not null unique,
  rol text not null check (rol in ('admin','ventanilla','direccion','jefatura','legal','caja','finanzas','digitalizacion','captura','titulacion','informatica','viewer','topografia','cartografia')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
grant select, insert, update on public.usuarios_locales to sigep_editor;
commit;
