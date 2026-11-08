-- Ejecutar una vez en Supabase > SQL Editor con el rol administrador.
-- Conserva los datos existentes y habilita todos los módulos de captura.
begin;

create table if not exists public.modulo_registros (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  modulo text not null check (modulo in (
    'lotes_predios', 'propietarios', 'municipios_fundos',
    'pagos_servicios', 'titulos_formatos', 'historico_reportes'
  )),
  titulo text not null check (char_length(trim(titulo)) between 1 and 240),
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  creado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (organizacion_id, id)
);

create index if not exists modulo_registros_busqueda_idx
  on public.modulo_registros (organizacion_id, modulo, actualizado_en desc);

create or replace function public.actualizar_fecha_modificacion()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists modulo_registros_actualizar_fecha on public.modulo_registros;
create trigger modulo_registros_actualizar_fecha
  before update on public.modulo_registros
  for each row execute function public.actualizar_fecha_modificacion();

alter table public.modulo_registros enable row level security;

drop policy if exists modulo_registros_select_miembros on public.modulo_registros;
create policy modulo_registros_select_miembros on public.modulo_registros
  for select to authenticated
  using (public.es_miembro_organizacion(organizacion_id));

drop policy if exists modulo_registros_insert_editores on public.modulo_registros;
create policy modulo_registros_insert_editores on public.modulo_registros
  for insert to authenticated with check (
    public.puede_editar_organizacion(organizacion_id)
    and creado_por = (select auth.uid())
  );

drop policy if exists modulo_registros_update_editores on public.modulo_registros;
create policy modulo_registros_update_editores on public.modulo_registros
  for update to authenticated
  using (public.puede_editar_organizacion(organizacion_id))
  with check (public.puede_editar_organizacion(organizacion_id));

drop policy if exists modulo_registros_delete_editores on public.modulo_registros;
create policy modulo_registros_delete_editores on public.modulo_registros
  for delete to authenticated
  using (public.puede_editar_organizacion(organizacion_id));

revoke all on public.modulo_registros from anon;
grant select, insert, update, delete on public.modulo_registros to authenticated;
revoke all on function public.actualizar_fecha_modificacion() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
