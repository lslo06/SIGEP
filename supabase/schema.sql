-- Fundos | Esquema inicial para Supabase (PostgreSQL)
-- Ejecuta este archivo en Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create sequence if not exists public.folio_expediente_seq;

create table if not exists public.organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 2 and 120),
  creado_por uuid not null references auth.users(id) on delete restrict,
  creado_en timestamptz not null default now()
);

create table if not exists public.miembros_organizacion (
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'editor' check (rol in ('owner', 'admin', 'editor', 'viewer')),
  creado_en timestamptz not null default now(),
  primary key (organizacion_id, usuario_id)
);

create table if not exists public.fundos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 160),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (organizacion_id, id)
);

create unique index if not exists fundos_nombre_por_organizacion_idx
  on public.fundos (organizacion_id, lower(nombre));

create table if not exists public.propietarios (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  nombre_completo text not null check (char_length(trim(nombre_completo)) between 2 and 200),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (organizacion_id, id)
);

create index if not exists propietarios_nombre_idx
  on public.propietarios (organizacion_id, lower(nombre_completo));

create table if not exists public.predios (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  propietario_id uuid not null,
  fundo_id uuid not null,
  manzana text not null default '',
  lote text not null check (char_length(trim(lote)) between 1 and 80),
  superficie_m2 numeric(14, 2) check (superficie_m2 is null or superficie_m2 > 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (organizacion_id, id),
  unique (organizacion_id, fundo_id, manzana, lote),
  foreign key (organizacion_id, propietario_id)
    references public.propietarios (organizacion_id, id) on delete restrict,
  foreign key (organizacion_id, fundo_id)
    references public.fundos (organizacion_id, id) on delete restrict
);

create index if not exists predios_propietario_idx
  on public.predios (organizacion_id, propietario_id);

create table if not exists public.expedientes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  predio_id uuid not null,
  folio text not null default (
    'FL-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.folio_expediente_seq')::text, 5, '0')
  ),
  tipo_tramite text not null default 'Titulación'
    check (tipo_tramite in (
      'Titulación', 'Búsqueda de información', 'Partición de terrenos',
      'Actualización de datos', 'Otro'
    )),
  libro text,
  numero_titulo text,
  fecha_titulo date,
  estado text not null default 'En trámite'
    check (estado in (
      'En trámite', 'En revisión', 'Vigente', 'Cancelado',
      'Pendiente', 'Listo para entrega'
    )),
  observacion text,
  fecha_solicitud date,
  fecha_entrega date,
  fecha_pago_servicios date,
  fecha_gobierno date,
  fecha_municipio date,
  fecha_registro_publico date,
  costo_terreno numeric(14, 2) check (costo_terreno is null or costo_terreno >= 0),
  parcialidades_pagadas numeric(14, 2) check (parcialidades_pagadas is null or parcialidades_pagadas >= 0),
  saldo_pendiente numeric(14, 2) check (saldo_pendiente is null or saldo_pendiente >= 0),
  numero_oficio text,
  seguimiento_firmas text not null default 'Sin iniciar'
    check (seguimiento_firmas in ('Sin iniciar', 'En espera de firma', 'En revisión', 'Firmado')),
  area_actual text not null default 'Recepción',
  siguiente_accion text,
  en_espera text,
  creado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (organizacion_id, folio),
  foreign key (organizacion_id, predio_id)
    references public.predios (organizacion_id, id) on delete restrict
);

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

create index if not exists expedientes_estado_idx
  on public.expedientes (organizacion_id, estado);

create index if not exists expedientes_predio_idx
  on public.expedientes (organizacion_id, predio_id);

create index if not exists expedientes_fecha_solicitud_idx
  on public.expedientes (organizacion_id, fecha_solicitud desc);

create or replace function public.actualizar_fecha_modificacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create or replace function public.es_miembro_organizacion(p_organizacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros_organizacion m
    where m.organizacion_id = p_organizacion_id
      and m.usuario_id = (select auth.uid())
  );
$$;

create or replace function public.puede_editar_organizacion(p_organizacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros_organizacion m
    where m.organizacion_id = p_organizacion_id
      and m.usuario_id = (select auth.uid())
      and m.rol in ('owner', 'admin', 'editor')
  );
$$;

create or replace function public.es_admin_organizacion(p_organizacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros_organizacion m
    where m.organizacion_id = p_organizacion_id
      and m.usuario_id = (select auth.uid())
      and m.rol in ('owner', 'admin')
  );
$$;

create or replace function public.listar_miembros_organizacion(p_organizacion_id uuid)
returns table (usuario_id uuid, email text, rol text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_miembro_organizacion(p_organizacion_id) then
    raise exception 'No tienes acceso a los miembros de esta organización.';
  end if;

  return query
  select m.usuario_id, u.email::text, m.rol
  from public.miembros_organizacion m
  join auth.users u on u.id = m.usuario_id
  where m.organizacion_id = p_organizacion_id
  order by case m.rol when 'owner' then 0 when 'admin' then 1 else 2 end, lower(u.email);
end;
$$;

create or replace function public.crear_organizacion(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organizacion_id uuid;
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para crear una organización.';
  end if;

  if p_nombre is null or char_length(trim(p_nombre)) not between 2 and 120 then
    raise exception 'El nombre de la organización debe tener entre 2 y 120 caracteres.';
  end if;

  insert into public.organizaciones (nombre, creado_por)
  values (trim(p_nombre), v_usuario_id)
  returning id into v_organizacion_id;

  insert into public.miembros_organizacion (organizacion_id, usuario_id, rol)
  values (v_organizacion_id, v_usuario_id, 'owner');

  return v_organizacion_id;
end;
$$;

create or replace function public.agregar_miembro_organizacion(
  p_organizacion_id uuid,
  p_email text,
  p_rol text default 'editor'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
  v_resultado uuid;
begin
  if auth.uid() is null
    or not public.es_admin_organizacion(p_organizacion_id) then
    raise exception 'No tienes permisos para administrar esta organización.';
  end if;

  if p_rol not in ('admin', 'editor', 'viewer') then
    raise exception 'El rol debe ser admin, editor o viewer.';
  end if;

  select u.id into v_usuario_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_usuario_id is null then
    raise exception 'No existe una cuenta registrada con ese correo.';
  end if;

  insert into public.miembros_organizacion (organizacion_id, usuario_id, rol)
  values (p_organizacion_id, v_usuario_id, p_rol)
  on conflict (organizacion_id, usuario_id)
  do update set rol = excluded.rol
  where public.miembros_organizacion.rol <> 'owner'
  returning usuario_id into v_resultado;

  if v_resultado is null then
    raise exception 'No se puede cambiar el rol del propietario de la organización.';
  end if;

  return v_resultado;
end;
$$;

create or replace function public.guardar_expediente(
  p_organizacion_id uuid,
  p_expediente_id uuid,
  p_datos jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fundo_id uuid;
  v_propietario_id uuid;
  v_predio_id uuid;
  v_expediente_id uuid;
  v_fundo_nombre text := nullif(trim(p_datos->>'fundo'), '');
  v_propietario_nombre text := nullif(trim(p_datos->>'propietario'), '');
  v_manzana text := coalesce(p_datos->>'manzana', '');
  v_lote text := nullif(trim(p_datos->>'lote'), '');
begin
  if not public.puede_editar_organizacion(p_organizacion_id) then
    raise exception 'No tienes permisos para crear o modificar expedientes en esta organización.';
  end if;

  if v_fundo_nombre is null or v_propietario_nombre is null or v_lote is null then
    raise exception 'El propietario, el fundo y el lote son obligatorios.';
  end if;

  select f.id into v_fundo_id
  from public.fundos f
  where f.organizacion_id = p_organizacion_id
    and lower(f.nombre) = lower(v_fundo_nombre)
  limit 1;

  if v_fundo_id is null then
    insert into public.fundos (organizacion_id, nombre)
    values (p_organizacion_id, v_fundo_nombre)
    returning id into v_fundo_id;
  end if;

  select p.id into v_propietario_id
  from public.propietarios p
  where p.organizacion_id = p_organizacion_id
    and lower(p.nombre_completo) = lower(v_propietario_nombre)
  order by p.creado_en
  limit 1;

  if v_propietario_id is null then
    insert into public.propietarios (organizacion_id, nombre_completo)
    values (p_organizacion_id, v_propietario_nombre)
    returning id into v_propietario_id;
  end if;

  if p_expediente_id is not null then
    select e.predio_id into v_predio_id
    from public.expedientes e
    where e.organizacion_id = p_organizacion_id
      and e.id = p_expediente_id
    for update;

    if v_predio_id is null then
      raise exception 'No se encontró el expediente que intentas modificar.';
    end if;
  else
    select p.id into v_predio_id
    from public.predios p
    where p.organizacion_id = p_organizacion_id
      and p.fundo_id = v_fundo_id
      and p.manzana = v_manzana
      and p.lote = v_lote
    limit 1;
  end if;

  if v_predio_id is null then
    insert into public.predios (
      organizacion_id, propietario_id, fundo_id, manzana, lote, superficie_m2
    )
    values (
      p_organizacion_id, v_propietario_id, v_fundo_id, v_manzana, v_lote,
      nullif(p_datos->>'superficie_m2', '')::numeric
    )
    returning id into v_predio_id;
  else
    update public.predios
    set propietario_id = v_propietario_id,
        fundo_id = v_fundo_id,
        manzana = v_manzana,
        lote = v_lote,
        superficie_m2 = nullif(p_datos->>'superficie_m2', '')::numeric
    where id = v_predio_id
      and organizacion_id = p_organizacion_id;
  end if;

  if p_expediente_id is null then
    insert into public.expedientes (
      organizacion_id, predio_id, tipo_tramite, libro, numero_titulo,
      fecha_titulo, estado, observacion, fecha_solicitud, fecha_entrega,
      fecha_pago_servicios, fecha_gobierno, fecha_municipio,
      fecha_registro_publico, costo_terreno, parcialidades_pagadas,
      saldo_pendiente, numero_oficio, seguimiento_firmas, area_actual,
      siguiente_accion, en_espera, creado_por
    )
    values (
      p_organizacion_id, v_predio_id, p_datos->>'tipo_tramite',
      nullif(p_datos->>'libro', ''), nullif(p_datos->>'numero_titulo', ''),
      nullif(p_datos->>'fecha_titulo', '')::date, p_datos->>'estado',
      nullif(p_datos->>'observacion', ''),
      nullif(p_datos->>'fecha_solicitud', '')::date,
      nullif(p_datos->>'fecha_entrega', '')::date,
      nullif(p_datos->>'fecha_pago_servicios', '')::date,
      nullif(p_datos->>'fecha_gobierno', '')::date,
      nullif(p_datos->>'fecha_municipio', '')::date,
      nullif(p_datos->>'fecha_registro_publico', '')::date,
      nullif(p_datos->>'costo_terreno', '')::numeric,
      nullif(p_datos->>'parcialidades_pagadas', '')::numeric,
      nullif(p_datos->>'saldo_pendiente', '')::numeric,
      nullif(p_datos->>'numero_oficio', ''),
      coalesce(p_datos->>'seguimiento_firmas', 'Sin iniciar'),
      coalesce(p_datos->>'area_actual', 'Recepción'),
      nullif(p_datos->>'siguiente_accion', ''),
      nullif(p_datos->>'en_espera', ''),
      auth.uid()
    )
    returning id into v_expediente_id;
  else
    update public.expedientes
    set predio_id = v_predio_id,
        tipo_tramite = p_datos->>'tipo_tramite',
        libro = nullif(p_datos->>'libro', ''),
        numero_titulo = nullif(p_datos->>'numero_titulo', ''),
        fecha_titulo = nullif(p_datos->>'fecha_titulo', '')::date,
        estado = p_datos->>'estado',
        observacion = nullif(p_datos->>'observacion', ''),
        fecha_solicitud = nullif(p_datos->>'fecha_solicitud', '')::date,
        fecha_entrega = nullif(p_datos->>'fecha_entrega', '')::date,
        fecha_pago_servicios = nullif(p_datos->>'fecha_pago_servicios', '')::date,
        fecha_gobierno = nullif(p_datos->>'fecha_gobierno', '')::date,
        fecha_municipio = nullif(p_datos->>'fecha_municipio', '')::date,
        fecha_registro_publico = nullif(p_datos->>'fecha_registro_publico', '')::date,
        costo_terreno = nullif(p_datos->>'costo_terreno', '')::numeric,
        parcialidades_pagadas = nullif(p_datos->>'parcialidades_pagadas', '')::numeric,
        saldo_pendiente = nullif(p_datos->>'saldo_pendiente', '')::numeric,
        numero_oficio = nullif(p_datos->>'numero_oficio', ''),
        seguimiento_firmas = coalesce(p_datos->>'seguimiento_firmas', 'Sin iniciar'),
        area_actual = coalesce(p_datos->>'area_actual', 'Recepción'),
        siguiente_accion = nullif(p_datos->>'siguiente_accion', ''),
        en_espera = nullif(p_datos->>'en_espera', '')
    where id = p_expediente_id
      and organizacion_id = p_organizacion_id
    returning id into v_expediente_id;

    if v_expediente_id is null then
      raise exception 'No se encontró el expediente que intentas modificar.';
    end if;
  end if;

  return v_expediente_id;
end;
$$;

create or replace function public.eliminar_expediente(
  p_organizacion_id uuid,
  p_expediente_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_predio_id uuid;
begin
  if not public.puede_editar_organizacion(p_organizacion_id) then
    raise exception 'No tienes permisos para eliminar expedientes en esta organización.';
  end if;

  delete from public.expedientes
  where organizacion_id = p_organizacion_id
    and id = p_expediente_id
  returning predio_id into v_predio_id;

  if v_predio_id is null then
    raise exception 'No se encontró el expediente que intentas eliminar.';
  end if;

  delete from public.predios p
  where p.organizacion_id = p_organizacion_id
    and p.id = v_predio_id
    and not exists (
      select 1 from public.expedientes e where e.predio_id = p.id
    );
end;
$$;

drop trigger if exists fundos_actualizar_fecha on public.fundos;
create trigger fundos_actualizar_fecha
  before update on public.fundos
  for each row execute function public.actualizar_fecha_modificacion();

drop trigger if exists propietarios_actualizar_fecha on public.propietarios;
create trigger propietarios_actualizar_fecha
  before update on public.propietarios
  for each row execute function public.actualizar_fecha_modificacion();

drop trigger if exists predios_actualizar_fecha on public.predios;
create trigger predios_actualizar_fecha
  before update on public.predios
  for each row execute function public.actualizar_fecha_modificacion();

drop trigger if exists expedientes_actualizar_fecha on public.expedientes;
create trigger expedientes_actualizar_fecha
  before update on public.expedientes
  for each row execute function public.actualizar_fecha_modificacion();

drop trigger if exists modulo_registros_actualizar_fecha on public.modulo_registros;
create trigger modulo_registros_actualizar_fecha
  before update on public.modulo_registros
  for each row execute function public.actualizar_fecha_modificacion();

alter table public.organizaciones enable row level security;
alter table public.miembros_organizacion enable row level security;
alter table public.fundos enable row level security;
alter table public.propietarios enable row level security;
alter table public.predios enable row level security;
alter table public.expedientes enable row level security;
alter table public.modulo_registros enable row level security;

drop policy if exists organizaciones_select_miembros on public.organizaciones;
create policy organizaciones_select_miembros on public.organizaciones
  for select to authenticated
  using (public.es_miembro_organizacion(id));

drop policy if exists miembros_select_misma_organizacion on public.miembros_organizacion;
create policy miembros_select_misma_organizacion on public.miembros_organizacion
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or public.es_admin_organizacion(organizacion_id)
  );

drop policy if exists fundos_select_miembros on public.fundos;
create policy fundos_select_miembros on public.fundos
  for select to authenticated using (public.es_miembro_organizacion(organizacion_id));
drop policy if exists fundos_insert_editores on public.fundos;
create policy fundos_insert_editores on public.fundos
  for insert to authenticated with check (public.puede_editar_organizacion(organizacion_id));
drop policy if exists fundos_update_editores on public.fundos;
create policy fundos_update_editores on public.fundos
  for update to authenticated
  using (public.puede_editar_organizacion(organizacion_id))
  with check (public.puede_editar_organizacion(organizacion_id));
drop policy if exists fundos_delete_editores on public.fundos;
create policy fundos_delete_editores on public.fundos
  for delete to authenticated using (public.puede_editar_organizacion(organizacion_id));

drop policy if exists propietarios_select_miembros on public.propietarios;
create policy propietarios_select_miembros on public.propietarios
  for select to authenticated using (public.es_miembro_organizacion(organizacion_id));
drop policy if exists propietarios_insert_editores on public.propietarios;
create policy propietarios_insert_editores on public.propietarios
  for insert to authenticated with check (public.puede_editar_organizacion(organizacion_id));
drop policy if exists propietarios_update_editores on public.propietarios;
create policy propietarios_update_editores on public.propietarios
  for update to authenticated
  using (public.puede_editar_organizacion(organizacion_id))
  with check (public.puede_editar_organizacion(organizacion_id));
drop policy if exists propietarios_delete_editores on public.propietarios;
create policy propietarios_delete_editores on public.propietarios
  for delete to authenticated using (public.puede_editar_organizacion(organizacion_id));

drop policy if exists predios_select_miembros on public.predios;
create policy predios_select_miembros on public.predios
  for select to authenticated using (public.es_miembro_organizacion(organizacion_id));
drop policy if exists predios_insert_editores on public.predios;
create policy predios_insert_editores on public.predios
  for insert to authenticated with check (public.puede_editar_organizacion(organizacion_id));
drop policy if exists predios_update_editores on public.predios;
create policy predios_update_editores on public.predios
  for update to authenticated
  using (public.puede_editar_organizacion(organizacion_id))
  with check (public.puede_editar_organizacion(organizacion_id));
drop policy if exists predios_delete_editores on public.predios;
create policy predios_delete_editores on public.predios
  for delete to authenticated using (public.puede_editar_organizacion(organizacion_id));

drop policy if exists expedientes_select_miembros on public.expedientes;
create policy expedientes_select_miembros on public.expedientes
  for select to authenticated using (public.es_miembro_organizacion(organizacion_id));
drop policy if exists expedientes_insert_editores on public.expedientes;
create policy expedientes_insert_editores on public.expedientes
  for insert to authenticated with check (
    public.puede_editar_organizacion(organizacion_id)
    and (creado_por = (select auth.uid()))
  );
drop policy if exists expedientes_update_editores on public.expedientes;
create policy expedientes_update_editores on public.expedientes
  for update to authenticated
  using (public.puede_editar_organizacion(organizacion_id))
  with check (public.puede_editar_organizacion(organizacion_id));
drop policy if exists expedientes_delete_editores on public.expedientes;
create policy expedientes_delete_editores on public.expedientes
  for delete to authenticated using (public.puede_editar_organizacion(organizacion_id));

drop policy if exists modulo_registros_select_miembros on public.modulo_registros;
create policy modulo_registros_select_miembros on public.modulo_registros
  for select to authenticated using (public.es_miembro_organizacion(organizacion_id));
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
  for delete to authenticated using (public.puede_editar_organizacion(organizacion_id));

grant select on public.organizaciones to authenticated;
grant select on public.miembros_organizacion to authenticated;
grant select, insert, update, delete on
  public.fundos, public.propietarios, public.predios, public.expedientes, public.modulo_registros
  to authenticated;
grant usage, select on sequence public.folio_expediente_seq to authenticated;

revoke all on function public.actualizar_fecha_modificacion() from public, anon, authenticated;
revoke all on function public.es_miembro_organizacion(uuid) from public, anon;
revoke all on function public.puede_editar_organizacion(uuid) from public, anon;
revoke all on function public.es_admin_organizacion(uuid) from public, anon;
revoke all on function public.listar_miembros_organizacion(uuid) from public, anon;
revoke all on function public.crear_organizacion(text) from public, anon;
revoke all on function public.agregar_miembro_organizacion(uuid, text, text) from public, anon;
revoke all on function public.guardar_expediente(uuid, uuid, jsonb) from public, anon;
revoke all on function public.eliminar_expediente(uuid, uuid) from public, anon;

grant execute on function public.es_miembro_organizacion(uuid) to authenticated;
grant execute on function public.puede_editar_organizacion(uuid) to authenticated;
grant execute on function public.es_admin_organizacion(uuid) to authenticated;
grant execute on function public.listar_miembros_organizacion(uuid) to authenticated;
grant execute on function public.crear_organizacion(text) to authenticated;
grant execute on function public.agregar_miembro_organizacion(uuid, text, text) to authenticated;
grant execute on function public.guardar_expediente(uuid, uuid, jsonb) to authenticated;
grant execute on function public.eliminar_expediente(uuid, uuid) to authenticated;
