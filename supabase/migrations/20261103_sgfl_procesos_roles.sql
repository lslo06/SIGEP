-- Aplicar DESPUÉS de schema.sql y 20261103_habilitar_modulos.sql.
begin;

alter table public.miembros_organizacion add column if not exists activo boolean not null default true;
alter table public.miembros_organizacion drop constraint if exists miembros_organizacion_rol_check;
alter table public.miembros_organizacion add constraint miembros_organizacion_rol_check
  check (rol in ('owner','admin','editor','viewer','ventanilla','direccion','jefatura','legal','caja','finanzas','digitalizacion','captura','titulacion','informatica'));

create or replace function public.rol_sgfl(p_org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select rol from public.miembros_organizacion where organizacion_id=p_org and usuario_id=auth.uid() and activo;
$$;
create or replace function public.es_miembro_organizacion(p_organizacion_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.rol_sgfl(p_organizacion_id) is not null; $$;
create or replace function public.es_admin_organizacion(p_organizacion_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(public.rol_sgfl(p_organizacion_id) in ('owner','admin'),false); $$;
create or replace function public.puede_editar_organizacion(p_organizacion_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(public.rol_sgfl(p_organizacion_id) in ('owner','admin','editor','ventanilla','captura'),false); $$;
create or replace function public.lectura_sgfl(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(public.rol_sgfl(p_org) <> 'finanzas',false); $$;
create or replace function public.permiso_modulo_sgfl(p_org uuid,p_modulo text,p_escritura boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(case
 when public.rol_sgfl(p_org) in ('owner','admin') then true
 when public.rol_sgfl(p_org)='finanzas' then false
 when not p_escritura then public.rol_sgfl(p_org) is not null
 when p_modulo='lotes_predios' then public.rol_sgfl(p_org) in ('editor','captura')
 when p_modulo='propietarios' then public.rol_sgfl(p_org) in ('editor','ventanilla','captura')
 when p_modulo='pagos_servicios' then false -- los pagos se registran únicamente en sgfl_pagos
 when p_modulo='titulos_formatos' then public.rol_sgfl(p_org)='titulacion'
 else false end,false);
$$;

-- Las políticas restrictivas se combinan con las políticas existentes.
do $$ declare t text; begin
 foreach t in array array['fundos','propietarios','predios','expedientes'] loop
  execute format('drop policy if exists sgfl_restringir_lectura on public.%I',t);
  execute format('create policy sgfl_restringir_lectura on public.%I as restrictive for select to authenticated using (public.lectura_sgfl(organizacion_id))',t);
  execute format('drop policy if exists sgfl_restringir_borrado on public.%I',t);
  execute format('create policy sgfl_restringir_borrado on public.%I as restrictive for delete to authenticated using (public.es_admin_organizacion(organizacion_id))',t);
 end loop;
end $$;
drop policy if exists sgfl_modulo_lectura on public.modulo_registros;
create policy sgfl_modulo_lectura on public.modulo_registros as restrictive for select to authenticated using (public.permiso_modulo_sgfl(organizacion_id,modulo,false));
drop policy if exists sgfl_modulo_insert on public.modulo_registros;
create policy sgfl_modulo_insert on public.modulo_registros as restrictive for insert to authenticated with check (public.permiso_modulo_sgfl(organizacion_id,modulo,true));
drop policy if exists sgfl_modulo_update on public.modulo_registros;
create policy sgfl_modulo_update on public.modulo_registros as restrictive for update to authenticated using (public.permiso_modulo_sgfl(organizacion_id,modulo,true)) with check (public.permiso_modulo_sgfl(organizacion_id,modulo,true));
drop policy if exists sgfl_modulo_delete on public.modulo_registros;
create policy sgfl_modulo_delete on public.modulo_registros as restrictive for delete to authenticated using (public.es_admin_organizacion(organizacion_id));
-- Habilita los roles operativos que no estaban contemplados por la política heredada.
drop policy if exists modulo_registros_insert_editores on public.modulo_registros;
create policy modulo_registros_insert_editores on public.modulo_registros for insert to authenticated with check (public.permiso_modulo_sgfl(organizacion_id,modulo,true) and creado_por=auth.uid());
drop policy if exists modulo_registros_update_editores on public.modulo_registros;
create policy modulo_registros_update_editores on public.modulo_registros for update to authenticated using (public.permiso_modulo_sgfl(organizacion_id,modulo,true)) with check (public.permiso_modulo_sgfl(organizacion_id,modulo,true));

-- Finanzas y los usuarios operativos no consultan el directorio de otros usuarios.
drop policy if exists sgfl_directorio_privado on public.miembros_organizacion;
create policy sgfl_directorio_privado on public.miembros_organizacion as restrictive for select to authenticated using (usuario_id=auth.uid() or public.es_admin_organizacion(organizacion_id));
drop function if exists public.listar_miembros_organizacion(uuid);
create function public.listar_miembros_organizacion(p_organizacion_id uuid)
returns table(usuario_id uuid,email text,rol text,activo boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.es_admin_organizacion(p_organizacion_id) then raise exception 'Solo administración puede consultar usuarios.'; end if;
 return query select m.usuario_id,u.email::text,m.rol,m.activo from public.miembros_organizacion m join auth.users u on u.id=m.usuario_id where m.organizacion_id=p_organizacion_id order by lower(u.email);
end; $$;
create or replace function public.agregar_miembro_organizacion(p_organizacion_id uuid,p_email text,p_rol text default 'ventanilla') returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; begin
 if not public.es_admin_organizacion(p_organizacion_id) then raise exception 'Sin permiso para administrar usuarios.'; end if;
 if p_rol is null or p_rol not in ('admin','editor','viewer','ventanilla','direccion','jefatura','legal','caja','finanzas','digitalizacion','captura','titulacion','informatica') then raise exception 'Rol inválido.'; end if;
 perform 1 from public.organizaciones where id=p_organizacion_id for update;
 select id into v_id from auth.users where lower(email)=lower(trim(p_email));
 if v_id is null then raise exception 'El usuario debe registrar su cuenta antes de asignarle un rol.'; end if;
 if v_id=auth.uid() then raise exception 'Otro administrador debe reasignar tu propio rol.'; end if;
 if exists(select 1 from public.miembros_organizacion where organizacion_id=p_organizacion_id and usuario_id=v_id and rol='owner') then raise exception 'No se puede reasignar al responsable del sistema.'; end if;
 insert into public.miembros_organizacion(organizacion_id,usuario_id,rol) values(p_organizacion_id,v_id,p_rol)
 on conflict(organizacion_id,usuario_id) do update set rol=excluded.rol;
 return v_id;
end; $$;
create or replace function public.activar_miembro_sgfl(p_organizacion_id uuid,p_usuario_id uuid,p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$ begin
 if not public.es_admin_organizacion(p_organizacion_id) or p_usuario_id=auth.uid() or p_activo is null then raise exception 'Sin permiso para cambiar este acceso.'; end if;
 update public.miembros_organizacion set activo=p_activo where organizacion_id=p_organizacion_id and usuario_id=p_usuario_id and rol<>'owner';
 if not found then raise exception 'Usuario no encontrado o protegido.'; end if;
end; $$;

create table if not exists public.sgfl_seguimiento (
 expediente_id uuid primary key references public.expedientes(id) on delete restrict,
 organizacion_id uuid not null references public.organizaciones(id),
 etapa text not null, estado text not null default 'Activo' check(estado in ('Activo','Prevenido','Cerrado')),
 responsable text, fecha_compromiso date, datos jsonb not null default '{}',
 cerrado boolean not null default false, cerrado_en timestamptz,
 actualizado_en timestamptz not null default now()
);
create table if not exists public.sgfl_documentos (
 id uuid primary key default gen_random_uuid(), organizacion_id uuid not null references public.organizaciones(id),
 expediente_id uuid not null references public.expedientes(id) on delete restrict,
 tipo text not null, version integer not null, ruta text not null unique, nombre text not null, etapa text not null,
 estado text not null default 'Pendiente' check(estado in ('Pendiente','Aceptado','Rechazado')),
 revisado_por uuid references auth.users(id), revisado_en timestamptz, motivo text,
 creado_por uuid not null default auth.uid() references auth.users(id), creado_en timestamptz not null default now(),
 unique(expediente_id,tipo,version)
);
create table if not exists public.sgfl_pagos (
 id uuid primary key default gen_random_uuid(), organizacion_id uuid not null references public.organizaciones(id),
 expediente_id uuid not null references public.expedientes(id) on delete restrict,
 concepto text not null check(concepto in ('Lote','Servicios catastrales','Búsqueda de información','Documento solicitado')),
 recibo text not null, importe numeric(14,2) not null check(importe>0), fecha date not null, evidencia text not null,
 estado text not null default 'Válido', creado_por uuid not null default auth.uid() references auth.users(id), creado_en timestamptz not null default now(),
 unique(organizacion_id,recibo,concepto)
);
create table if not exists public.sgfl_bitacora (
 id uuid primary key default gen_random_uuid(), organizacion_id uuid not null references public.organizaciones(id),
 expediente_id uuid references public.expedientes(id) on delete restrict, entidad text not null,
 accion text not null, actor uuid default auth.uid() references auth.users(id), creado_en timestamptz not null default now(),
 etapa_origen text, etapa_destino text, observacion text, anterior jsonb, nuevo jsonb
);
create table if not exists public.sgfl_configuracion (
 organizacion_id uuid primary key references public.organizaciones(id), datos jsonb not null
);
create index if not exists sgfl_documentos_expediente on public.sgfl_documentos(organizacion_id,expediente_id,tipo,version desc);
create index if not exists sgfl_pagos_expediente on public.sgfl_pagos(organizacion_id,expediente_id);
create index if not exists sgfl_bitacora_expediente on public.sgfl_bitacora(organizacion_id,expediente_id,creado_en desc);
create or replace function public.registrar_acceso_sgfl(p_organizacion_id uuid) returns void
language plpgsql security definer set search_path = '' as $$ begin
 if not public.es_miembro_organizacion(p_organizacion_id) then raise exception 'Sin permiso.'; end if;
 insert into public.sgfl_bitacora(organizacion_id,entidad,accion,observacion) values(p_organizacion_id,'sesion','acceso','Acceso autenticado a la organización');
end; $$;

create or replace function public.indicadores_sgfl(p_organizacion_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare tiempos jsonb; total numeric; begin
 if not public.lectura_sgfl(p_organizacion_id) then raise exception 'Sin permiso.'; end if;
 select round(avg(extract(epoch from (s.cerrado_en-e.creado_en))/86400)::numeric,1) into total
 from public.sgfl_seguimiento s join public.expedientes e on e.id=s.expediente_id where s.organizacion_id=p_organizacion_id and s.cerrado;
 select jsonb_agg(to_jsonb(x)) into tiempos from (
  select b.etapa_origen as etapa, count(*) as completadas,
   round(avg(extract(epoch from (b.creado_en-coalesce((select max(prev.creado_en) from public.sgfl_bitacora prev where prev.expediente_id=b.expediente_id and prev.accion='avanzar' and prev.etapa_destino=b.etapa_origen and prev.creado_en<b.creado_en),e.creado_en)))/86400)::numeric,1) as dias_promedio
  from public.sgfl_bitacora b join public.expedientes e on e.id=b.expediente_id
  where b.organizacion_id=p_organizacion_id and b.accion='avanzar' group by b.etapa_origen order by b.etapa_origen
 ) x;
 return jsonb_build_object('dias_resolucion',total,'etapas',coalesce(tiempos,'[]'::jsonb));
end; $$;
do $$ declare t text; begin
 foreach t in array array['sgfl_seguimiento','sgfl_documentos','sgfl_pagos','sgfl_bitacora','sgfl_configuracion'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists sgfl_lectura on public.%I',t);
  execute format('create policy sgfl_lectura on public.%I for select to authenticated using (public.lectura_sgfl(organizacion_id))',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

create or replace function public.configuracion_sgfl(p_organizacion_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; begin
 if not public.lectura_sgfl(p_organizacion_id) then raise exception 'Sin permiso.'; end if;
 select datos into v from public.sgfl_configuracion where organizacion_id=p_organizacion_id;
 return coalesce(v,'{"requisitos":{"titulacion":["Solicitud de predio","Constancia de posesión","Identificación oficial","Acta de nacimiento","Comprobante de domicilio"],"busqueda":["Identificación oficial","Solicitud escrita"]},"plantilla_busqueda":""}'::jsonb);
end; $$;
create or replace function public.guardar_configuracion_sgfl(p_organizacion_id uuid,p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k text; begin
 if not public.es_admin_organizacion(p_organizacion_id) then raise exception 'Solo administración configura requisitos.'; end if;
 if jsonb_typeof(p_datos)<>'object' or jsonb_typeof(p_datos->'requisitos') is distinct from 'object' or jsonb_typeof(p_datos->'plantilla_busqueda') is distinct from 'string' then raise exception 'Configuración inválida.'; end if;
 foreach k in array array['titulacion','busqueda'] loop
  if jsonb_typeof(p_datos->'requisitos'->k) is distinct from 'array' then raise exception 'Los requisitos deben ser listas.'; end if;
  if exists(select 1 from jsonb_array_elements(p_datos->'requisitos'->k) e where jsonb_typeof(e)<>'string' or length(trim(e#>>'{}'))=0) then raise exception 'Cada requisito debe tener nombre.'; end if;
 end loop;
 insert into public.sgfl_configuracion values(p_organizacion_id,p_datos) on conflict(organizacion_id) do update set datos=excluded.datos;
end; $$;

create or replace function public.consultar_pagos_sgfl(p_organizacion_id uuid,p_busqueda text default '')
returns table(id uuid,folio text,folio_predio text,clave_catastral text,concepto text,recibo text,fecha date,importe numeric,estado text)
language plpgsql stable security definer set search_path = '' as $$ begin
 if public.rol_sgfl(p_organizacion_id) is null then raise exception 'Sin permiso.'; end if;
 return query select p.id,e.folio,s.datos->>'folio_predio',s.datos->>'clave_catastral',p.concepto,p.recibo,p.fecha,p.importe,p.estado
 from public.sgfl_pagos p join public.expedientes e on e.id=p.expediente_id and e.organizacion_id=p.organizacion_id
 left join public.sgfl_seguimiento s on s.expediente_id=e.id and s.organizacion_id=e.organizacion_id
 where p.organizacion_id=p_organizacion_id and (coalesce(trim(p_busqueda),'')='' or
 position(lower(trim(p_busqueda)) in lower(e.folio))>0 or position(lower(trim(p_busqueda)) in lower(s.datos->>'folio_predio'))>0 or position(lower(trim(p_busqueda)) in lower(s.datos->>'clave_catastral'))>0)
 order by p.creado_en desc;
end; $$;
create or replace function public.registrar_pago_sgfl(p_organizacion_id uuid,p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e uuid; v_id uuid; begin
 if coalesce(public.rol_sgfl(p_organizacion_id),'') not in ('owner','admin','caja') then raise exception 'Solo Caja puede registrar pagos.'; end if;
 select id into e from public.expedientes where organizacion_id=p_organizacion_id and folio=trim(p_datos->>'folio') for update;
 if e is null then raise exception 'No existe el expediente indicado.'; end if;
 if exists(select 1 from public.sgfl_seguimiento where expediente_id=e and cerrado) then raise exception 'El expediente está cerrado.'; end if;
 if coalesce(trim(p_datos->>'recibo'),'')='' or coalesce(trim(p_datos->>'evidencia'),'')='' then raise exception 'El recibo y la referencia de evidencia son obligatorios.'; end if;
 if (p_datos->>'fecha')::date > (now() at time zone 'America/Mexico_City')::date then raise exception 'La fecha de pago no puede estar en el futuro.'; end if;
 insert into public.sgfl_pagos(organizacion_id,expediente_id,concepto,recibo,importe,fecha,evidencia)
 values(p_organizacion_id,e,p_datos->>'concepto',trim(p_datos->>'recibo'),(p_datos->>'importe')::numeric,(p_datos->>'fecha')::date,p_datos->>'evidencia') returning id into v_id;
 return v_id;
end; $$;

-- Etapas cartográficas TIT-02..05 y TIT-15 excluidas por alcance del usuario.
create or replace function public.etapas_sgfl(p_busqueda boolean) returns jsonb
language sql immutable set search_path = '' as $$ select case when p_busqueda then
 '[ ["BUS-01","ventanilla"],["BUS-02","direccion"],["BUS-03","caja"],["BUS-04","digitalizacion"],["BUS-05","legal"],["BUS-06","caja"],["BUS-07","legal"],["BUS-08","jefatura","direccion"],["BUS-09","ventanilla"] ]'::jsonb
 else '[ ["TIT-01","ventanilla"],["TIT-06","ventanilla"],["TIT-07","caja"],["TIT-08","digitalizacion","captura"],["TIT-09","titulacion","informatica"],["TIT-10","titulacion"],["TIT-11","titulacion","direccion"],["TIT-12","titulacion"],["TIT-13","titulacion"],["TIT-14","titulacion"],["TIT-16","digitalizacion"],["TIT-17","titulacion","ventanilla"] ]'::jsonb end; $$;
create or replace function public.documento_aceptado_sgfl(p_exp uuid,p_tipo text) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select estado='Aceptado' from public.sgfl_documentos where expediente_id=p_exp and tipo=p_tipo order by version desc limit 1),false);
$$;

create or replace function public.accion_expediente_sgfl(p_organizacion_id uuid,p_expediente_id uuid,p_accion text,p_datos jsonb default '{}',p_observacion text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
 r text:=public.rol_sgfl(p_organizacion_id); e public.expedientes; s public.sgfl_seguimiento;
 etapas jsonb; etapa jsonb; idx integer; d jsonb; k text; v jsonb; permitidos text[]:='{}'; admin boolean;
 req text; doc public.sgfl_documentos; siguiente text; ver integer;
begin
 if r is null or r in ('finanzas','viewer') then raise exception 'Sin permiso para modificar expedientes.'; end if;
 if p_datos is null or jsonb_typeof(p_datos)<>'object' then raise exception 'Datos inválidos.'; end if;
 admin:=r in ('owner','admin');
 select * into e from public.expedientes where organizacion_id=p_organizacion_id and id=p_expediente_id for update;
 if not found then raise exception 'Expediente no encontrado.'; end if;
 if e.tipo_tramite not in ('Titulación','Búsqueda de información') then raise exception 'El seguimiento está disponible para titulación y búsqueda de información.'; end if;
 etapas:=public.etapas_sgfl(e.tipo_tramite='Búsqueda de información');
 insert into public.sgfl_seguimiento(expediente_id,organizacion_id,etapa) values(e.id,p_organizacion_id,etapas->0->>0) on conflict do nothing;
 select * into s from public.sgfl_seguimiento where expediente_id=e.id for update;
 if s.cerrado then raise exception 'El expediente está cerrado; su historial se conserva.'; end if;
 select ord::integer-1,value into idx,etapa from jsonb_array_elements(etapas) with ordinality as x(value,ord) where value->>0=s.etapa;
 if etapa is null then raise exception 'Etapa no reconocida.'; end if;
 d:=s.datos;
 if p_accion in ('guardar','avanzar') then
  if admin or r in ('ventanilla','captura') then permitidos:=permitidos||array['telefono','correo','domicilio','representante']; end if;
  if admin or r='ventanilla' then permitidos:=permitidos||array['motivo_solicitud']; end if;
  if admin or r='captura' then permitidos:=permitidos||array['folio_predio','clave_catastral']; end if;
  if admin or r in ('jefatura','direccion') then permitidos:=permitidos||array['responsable','fecha_compromiso']; end if;
  if admin or etapa ? r then
   permitidos:=permitidos||case s.etapa
    when 'TIT-09' then array['validacion','observaciones_validacion']
    when 'TIT-10' then array['titulo_numero','titulo_revisado']
    when 'TIT-11' then array['oficio_consejeria','destinatario_consejeria','envio_consejeria']
    when 'TIT-12' then array['recepcion_consejeria','firmas_consejeria','retorno_consejeria']
    when 'TIT-13' then array['folio_rpp','documentos_rpp','envio_rpp']
    when 'TIT-14' then array['inscripcion_rpp','fecha_inscripcion','retorno_rpp']
    when 'TIT-17' then array['afectacion_final','receptor','fecha_entrega','fecha_archivo']
    when 'BUS-01' then array['tipo_documento'] when 'BUS-05' then array['dictamen','motivo_dictamen']
    when 'BUS-07' then array['documento_texto'] when 'BUS-09' then array['receptor','fecha_entrega','fecha_archivo']
    else '{}'::text[] end;
  end if;
  if s.etapa='BUS-08' then
   if admin or r='jefatura' then permitidos:=permitidos||array['revision_jefatura']; end if;
   if admin or r='direccion' then permitidos:=permitidos||array['autorizacion_direccion']; end if;
  end if;
  for k,v in select * from jsonb_each(p_datos) loop
   if k in ('responsable','fecha_compromiso') then
    if (k='responsable' and coalesce(v#>>'{}','')=coalesce(s.responsable,'')) or (k='fecha_compromiso' and coalesce(v#>>'{}','')=coalesce(s.fecha_compromiso::text,'')) then continue; end if;
   elsif coalesce(d->k,'""'::jsonb)=v then continue;
   end if;
   if not k=any(permitidos) then raise exception 'Tu rol no puede modificar el campo % en esta etapa.',k; end if;
   if jsonb_typeof(v)<>'string' then raise exception 'El campo % debe ser texto.',k; end if;
   if k='responsable' then
    if nullif(v#>>'{}','') is not null and not exists(select 1 from public.miembros_organizacion m join auth.users u on m.usuario_id=u.id where m.organizacion_id=p_organizacion_id and m.activo and m.rol not in ('finanzas','viewer') and lower(u.email)=lower(v#>>'{}')) then raise exception 'El responsable debe ser un usuario activo de esta organización.'; end if;
    s.responsable:=nullif(v#>>'{}','');
   elsif k='fecha_compromiso' then s.fecha_compromiso:=nullif(v#>>'{}','')::date;
   else d:=jsonb_set(d,array[k],v); end if;
  end loop;
  if d->>'autorizacion_direccion'='Autorizado' and coalesce(d->>'revision_jefatura','')<>'Revisado' then raise exception 'Jefatura debe revisar antes de la autorización de Dirección.'; end if;
  -- Validación de fechas institucionales.
  foreach k in array array['envio_consejeria','recepcion_consejeria','retorno_consejeria','envio_rpp','fecha_inscripcion','retorno_rpp','fecha_entrega','fecha_archivo'] loop
   if nullif(d->>k,'') is not null then
    if (d->>k)::date < coalesce(e.fecha_solicitud,e.creado_en::date) or (d->>k)::date > (now() at time zone 'America/Mexico_City')::date then raise exception 'Fecha inválida en %.',k; end if;
   end if;
  end loop;
  if nullif(d->>'recepcion_consejeria','')::date < nullif(d->>'envio_consejeria','')::date or nullif(d->>'retorno_consejeria','')::date < nullif(d->>'recepcion_consejeria','')::date or nullif(d->>'envio_rpp','')::date < nullif(d->>'retorno_consejeria','')::date or nullif(d->>'fecha_inscripcion','')::date < nullif(d->>'envio_rpp','')::date or nullif(d->>'retorno_rpp','')::date < nullif(d->>'fecha_inscripcion','')::date or nullif(d->>'fecha_archivo','')::date < nullif(d->>'fecha_entrega','')::date then raise exception 'Las fechas deben respetar el orden del proceso.'; end if;
  if p_accion='avanzar' then
   if not admin and not etapa ? r then raise exception 'Solo el área responsable puede avanzar esta etapa.'; end if;
   if coalesce(trim(p_observacion),'')='' then raise exception 'Registra una observación para el cambio de etapa.'; end if;
   if s.etapa in ('TIT-06','TIT-17','BUS-04','BUS-09') then
    for req in select jsonb_array_elements_text(public.configuracion_sgfl(p_organizacion_id)->'requisitos'->(case when e.tipo_tramite='Búsqueda de información' then 'busqueda' else 'titulacion' end)) loop
     if not public.documento_aceptado_sgfl(e.id,req) then raise exception 'Falta un requisito aceptado en su última versión: %.',req; end if;
    end loop;
   end if;
   if s.etapa='TIT-07' and not coalesce(d->'excepciones_pago','{}'::jsonb) ? s.etapa and (not exists(select 1 from public.sgfl_pagos where expediente_id=e.id and concepto='Lote' and estado='Válido') or not exists(select 1 from public.sgfl_pagos where expediente_id=e.id and concepto='Servicios catastrales' and estado='Válido')) then raise exception 'Registra los pagos válidos de lote y servicios catastrales.'; end if;
   if s.etapa='BUS-03' and not coalesce(d->'excepciones_pago','{}'::jsonb) ? s.etapa and not exists(select 1 from public.sgfl_pagos where expediente_id=e.id and concepto='Búsqueda de información' and estado='Válido') then raise exception 'Falta el pago válido de búsqueda.'; end if;
   if s.etapa='BUS-06' and not coalesce(d->'excepciones_pago','{}'::jsonb) ? s.etapa and not exists(select 1 from public.sgfl_pagos where expediente_id=e.id and concepto='Documento solicitado' and estado='Válido') then raise exception 'Falta el pago válido del documento.'; end if;
   if s.etapa='BUS-01' and (coalesce(d->>'tipo_documento','')='' or coalesce(d->>'domicilio','')='' or coalesce(d->>'motivo_solicitud','')='') then raise exception 'Registra tipo de documento, domicilio y propósito de la solicitud.'; end if;
   if s.etapa='TIT-09' and coalesce(d->>'validacion','')<>'Validado' then raise exception 'Falta la validación del expediente.'; end if;
   if s.etapa='TIT-10' and (coalesce(d->>'titulo_numero','')='' or coalesce(d->>'titulo_revisado','')<>'Revisado' or not public.documento_aceptado_sgfl(e.id,'Título')) then raise exception 'Registra número, revisión y documento de título aceptado.'; end if;
   if s.etapa='TIT-11' and (coalesce(d->>'oficio_consejeria','')='' or coalesce(d->>'destinatario_consejeria','')='' or coalesce(d->>'envio_consejeria','')='' or not public.documento_aceptado_sgfl(e.id,'Acuse Consejería')) then raise exception 'Falta oficio, destinatario, fecha o acuse de Consejería aceptado.'; end if;
   if s.etapa='TIT-12' and (coalesce(d->>'recepcion_consejeria','')='' or coalesce(d->>'retorno_consejeria','')='' or coalesce(d->>'firmas_consejeria','')<>'Firmado') then raise exception 'Registra recepción, firmas y retorno de Consejería.'; end if;
   if s.etapa='TIT-13' and (coalesce(d->>'folio_rpp','')='' or coalesce(d->>'documentos_rpp','')='' or coalesce(d->>'envio_rpp','')='' or not public.documento_aceptado_sgfl(e.id,'Acuse RPP')) then raise exception 'Falta folio, documentos, envío o acuse RPP aceptado.'; end if;
   if s.etapa='TIT-14' and (coalesce(d->>'inscripcion_rpp','')='' or coalesce(d->>'fecha_inscripcion','')='' or coalesce(d->>'retorno_rpp','')='' or not public.documento_aceptado_sgfl(e.id,'Título inscrito')) then raise exception 'Faltan datos de inscripción, retorno o título inscrito aceptado.'; end if;
   if s.etapa='TIT-16' and not public.documento_aceptado_sgfl(e.id,'Título inscrito') then raise exception 'Falta el título inscrito aceptado.'; end if;
   if s.etapa='BUS-05' then
    if coalesce(d->>'dictamen','') not in ('Procede','No procede') or coalesce(trim(d->>'motivo_dictamen'),'')='' then raise exception 'Registra procede / no procede y la justificación.'; end if;
    if d->>'dictamen'='No procede' then
     -- Se devuelve formalmente a recepción, conservando dictamen e historial.
     siguiente:='BUS-01';
     d:=d-'documento_texto'-'revision_jefatura'-'autorizacion_direccion';
    end if;
   end if;
   if s.etapa='BUS-07' and (coalesce(trim(d->>'documento_texto'),'')='' or not public.documento_aceptado_sgfl(e.id,'Documento expedido')) then raise exception 'Prepara y adjunta el documento expedido para revisión.'; end if;
   if s.etapa='BUS-08' and (coalesce(d->>'revision_jefatura','')<>'Revisado' or coalesce(d->>'autorizacion_direccion','')<>'Autorizado') then raise exception 'Falta revisión de Jefatura o autorización de Dirección.'; end if;
   if s.etapa in ('TIT-17','BUS-09') then
    if coalesce(trim(d->>'receptor'),'')='' or coalesce(d->>'fecha_entrega','')='' or coalesce(d->>'fecha_archivo','')='' or not public.documento_aceptado_sgfl(e.id,'Acuse de entrega') then raise exception 'Registra receptor, entrega, archivo y acuse aceptado antes de cerrar.'; end if;
    if s.etapa='TIT-17' and (coalesce(d->>'afectacion_final','')<>'Completada' or not public.documento_aceptado_sgfl(e.id,'Título') or not public.documento_aceptado_sgfl(e.id,'Título inscrito')) then raise exception 'Falta la afectación final o los documentos de título aceptados.'; end if;
    if s.etapa='BUS-09' and (coalesce(d->>'dictamen','')<>'Procede' or coalesce(d->>'revision_jefatura','')<>'Revisado' or coalesce(d->>'autorizacion_direccion','')<>'Autorizado' or not public.documento_aceptado_sgfl(e.id,'Documento expedido')) then raise exception 'Falta dictamen, revisión, autorización o documento expedido aceptado.'; end if;
    s.cerrado:=true; s.cerrado_en:=now(); s.estado:='Cerrado';
   else
    s.etapa:=coalesce(siguiente,etapas->(idx+1)->>0); s.estado:=case when siguiente='BUS-01' then 'Prevenido' else 'Activo' end;
    s.fecha_compromiso:=null;
   end if;
  end if;
  update public.sgfl_seguimiento set datos=d,etapa=s.etapa,estado=s.estado,responsable=s.responsable,fecha_compromiso=s.fecha_compromiso,cerrado=s.cerrado,cerrado_en=s.cerrado_en,actualizado_en=now() where expediente_id=e.id;
  if s.cerrado then update public.expedientes set estado='Vigente',fecha_entrega=(d->>'fecha_entrega')::date,area_actual='Archivo',siguiente_accion='Expediente cerrado' where id=e.id; end if;
 elsif p_accion='documento' then
  if not admin and r not in ('digitalizacion','ventanilla','titulacion','legal') then raise exception 'Sin permiso para cargar documentos.'; end if;
  if coalesce(trim(p_datos->>'tipo'),'')='' or coalesce(trim(p_datos->>'nombre'),'')='' or p_datos->>'ruta' not like p_organizacion_id::text||'/'||e.id::text||'/%' then raise exception 'Documento inválido.'; end if;
  if s.etapa='BUS-09' and p_datos->>'tipo'='Documento expedido' then raise exception 'El documento autorizado para entrega no puede sustituirse.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='sgfl-documentos' and name=p_datos->>'ruta') then raise exception 'El archivo no está disponible.'; end if;
  select coalesce(max(version),0)+1 into ver from public.sgfl_documentos where expediente_id=e.id and tipo=p_datos->>'tipo';
  insert into public.sgfl_documentos(organizacion_id,expediente_id,tipo,version,ruta,nombre,etapa) values(p_organizacion_id,e.id,p_datos->>'tipo',ver,p_datos->>'ruta',p_datos->>'nombre',s.etapa);
  -- Una nueva versión invalida autorizaciones previas del documento expedido.
  if p_datos->>'tipo'='Documento expedido' then update public.sgfl_seguimiento set datos=datos- 'revision_jefatura'- 'autorizacion_direccion' where expediente_id=e.id; end if;
 elsif p_accion='revisar_documento' then
  if not admin and r not in ('jefatura','titulacion','legal') then raise exception 'Sin permiso para revisar documentos.'; end if;
  if coalesce(p_datos->>'estado','') not in ('Aceptado','Rechazado') then raise exception 'Estado de revisión inválido.'; end if;
  if p_datos->>'estado'='Rechazado' and coalesce(trim(p_observacion),'')='' then raise exception 'El rechazo requiere motivo.'; end if;
  select * into doc from public.sgfl_documentos where id=(p_datos->>'id')::uuid and expediente_id=e.id;
  if not found or exists(select 1 from public.sgfl_documentos where expediente_id=e.id and tipo=doc.tipo and version>doc.version) then raise exception 'Solo se revisa la última versión de un documento.'; end if;
  update public.sgfl_documentos set estado=p_datos->>'estado',revisado_por=auth.uid(),revisado_en=now(),motivo=p_observacion where id=doc.id;
 elsif p_accion='devolver' then
  if not admin and r not in ('jefatura','direccion') then raise exception 'Solo Jefatura o Dirección puede devolver un expediente.'; end if;
  if coalesce(trim(p_observacion),'')='' then raise exception 'La devolución requiere motivo.'; end if;
  if not exists(select 1 from jsonb_array_elements(etapas) with ordinality as x(value,ord) where value->>0=p_datos->>'etapa' and ord-1<idx) then raise exception 'Solo se puede devolver a una etapa anterior del mismo proceso.'; end if;
  s.etapa:=p_datos->>'etapa';
  update public.sgfl_seguimiento set etapa=s.etapa,estado='Prevenido',datos=datos-'revision_jefatura'-'autorizacion_direccion',fecha_compromiso=null,actualizado_en=now() where expediente_id=e.id;
 elsif p_accion='excepcion_pago' then
  if not admin and r<>'direccion' then raise exception 'Solo Dirección o Administración autoriza excepciones de pago.'; end if;
  if s.etapa not in ('TIT-07','BUS-03','BUS-06') or coalesce(trim(p_observacion),'')='' then raise exception 'La excepción requiere una etapa de pago y un motivo.'; end if;
  update public.sgfl_seguimiento set datos=jsonb_set(datos,'{excepciones_pago}',coalesce(datos->'excepciones_pago','{}'::jsonb)||jsonb_build_object(s.etapa,jsonb_build_object('motivo',p_observacion,'usuario',auth.uid(),'fecha',now()))),actualizado_en=now() where expediente_id=e.id;
 elsif p_accion in ('observacion','prevenir') then
  if coalesce(trim(p_observacion),'')='' then raise exception 'La observación es obligatoria.'; end if;
  if p_accion='prevenir' then
   if not admin and r not in ('ventanilla','jefatura') then raise exception 'Sin permiso para prevenir.'; end if;
   update public.sgfl_seguimiento set estado='Prevenido',actualizado_en=now() where expediente_id=e.id;
  end if;
 else raise exception 'Acción desconocida.';
 end if;
 insert into public.sgfl_bitacora(organizacion_id,expediente_id,entidad,accion,etapa_origen,etapa_destino,observacion)
 values(p_organizacion_id,e.id,'expediente',p_accion,etapa->>0,s.etapa,p_observacion);
end; $$;

create or replace function public.proteger_cierre_sgfl() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.organizacion_id<>old.organizacion_id or new.folio<>old.folio then raise exception 'La identidad del expediente es inmutable.'; end if;
  if exists(select 1 from public.sgfl_seguimiento where expediente_id=old.id) and (new.predio_id<>old.predio_id or new.tipo_tramite<>old.tipo_tramite) then raise exception 'No se puede cambiar el predio o proceso de un expediente en seguimiento.'; end if;
 end if;
 if tg_op='UPDATE' and exists(select 1 from public.sgfl_seguimiento s where s.expediente_id=old.id and s.cerrado) then
  -- Solo el cierre transaccional puede efectuar la primera actualización final.
  if old.estado='Vigente' then raise exception 'El expediente cerrado no admite modificaciones.'; end if;
 end if;
 if (new.estado='Vigente' and not exists(select 1 from public.sgfl_seguimiento s where s.expediente_id=new.id and s.cerrado)) or
    (new.estado='Listo para entrega' and not exists(select 1 from public.sgfl_seguimiento s where s.expediente_id=new.id and s.etapa in ('TIT-17','BUS-09'))) then
  if tg_op='INSERT' or old.estado is distinct from new.estado then raise exception 'Utiliza el seguimiento del proceso para autorizar la entrega o cerrar el expediente.'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists sgfl_control_cierre on public.expedientes;
create trigger sgfl_control_cierre before insert or update on public.expedientes for each row execute function public.proteger_cierre_sgfl();

-- Auditoría adicional para altas y modificaciones directas del núcleo y datos nuevos.
create or replace function public.auditar_sgfl() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb; n jsonb; exp uuid; org uuid; begin
 if tg_op<>'INSERT' then a:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then n:=to_jsonb(new); end if;
 org:=coalesce(n->>'organizacion_id',a->>'organizacion_id')::uuid;
 if tg_table_name='expedientes' then exp:=coalesce(n->>'id',a->>'id')::uuid;
 elsif tg_table_name in ('sgfl_seguimiento','sgfl_documentos','sgfl_pagos') then exp:=coalesce(n->>'expediente_id',a->>'expediente_id')::uuid; end if;
 insert into public.sgfl_bitacora(organizacion_id,expediente_id,entidad,accion,anterior,nuevo)
 values(org,exp,tg_table_name,tg_op,a,n);
 return coalesce(new,old);
end; $$;
do $$ declare t text; begin
 foreach t in array array['expedientes','propietarios','predios','modulo_registros','miembros_organizacion','sgfl_seguimiento','sgfl_documentos','sgfl_pagos','sgfl_configuracion'] loop
  execute format('drop trigger if exists sgfl_auditoria on public.%I',t);
  execute format('create trigger sgfl_auditoria after insert or update or delete on public.%I for each row execute function public.auditar_sgfl()',t);
 end loop;
end $$;
-- Los registros de expedientes se conservan; no se eliminan físicamente.
drop policy if exists sgfl_no_eliminar_expedientes on public.expedientes;
create policy sgfl_no_eliminar_expedientes on public.expedientes as restrictive for delete to authenticated using(false);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sgfl-documentos','sgfl-documentos',false,20971520,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists sgfl_archivos_lectura on storage.objects;
create policy sgfl_archivos_lectura on storage.objects for select to authenticated using (
 bucket_id='sgfl-documentos' and exists(select 1 from public.sgfl_documentos d where d.ruta=name and public.lectura_sgfl(d.organizacion_id))
);
drop policy if exists sgfl_archivos_carga on storage.objects;
create policy sgfl_archivos_carga on storage.objects for insert to authenticated with check (
 bucket_id='sgfl-documentos' and exists(select 1 from public.expedientes e where e.organizacion_id::text=(storage.foldername(name))[1] and e.id::text=(storage.foldername(name))[2]
 and public.rol_sgfl(e.organizacion_id) in ('owner','admin','digitalizacion','ventanilla','titulacion','legal')
 and not exists(select 1 from public.sgfl_seguimiento s where s.expediente_id=e.id and s.cerrado))
);
-- Ningún usuario operativo puede sobrescribir o eliminar las versiones almacenadas.
-- Estas restricciones también prevalecen sobre políticas generales preexistentes de Storage.
create or replace function public.acceso_archivo_sgfl(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.sgfl_documentos d where d.ruta=p_ruta and public.lectura_sgfl(d.organizacion_id));
$$;
drop policy if exists sgfl_archivos_lectura_restringida on storage.objects;
create policy sgfl_archivos_lectura_restringida on storage.objects as restrictive for select to public
using(bucket_id<>'sgfl-documentos' or public.acceso_archivo_sgfl(name));
drop policy if exists sgfl_archivos_insert_restringido on storage.objects;
create policy sgfl_archivos_insert_restringido on storage.objects as restrictive for insert to public
with check(bucket_id<>'sgfl-documentos' or exists(select 1 from public.expedientes e where e.organizacion_id::text=(storage.foldername(name))[1] and e.id::text=(storage.foldername(name))[2]
 and public.rol_sgfl(e.organizacion_id) in ('owner','admin','digitalizacion','ventanilla','titulacion','legal')
 and not exists(select 1 from public.sgfl_seguimiento s where s.expediente_id=e.id and s.cerrado)));
drop policy if exists sgfl_archivos_sin_update on storage.objects;
create policy sgfl_archivos_sin_update on storage.objects as restrictive for update to public using(bucket_id<>'sgfl-documentos') with check(bucket_id<>'sgfl-documentos');
drop policy if exists sgfl_archivos_sin_delete on storage.objects;
create policy sgfl_archivos_sin_delete on storage.objects as restrictive for delete to public using(bucket_id<>'sgfl-documentos');

do $$ declare f record; begin
 for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '%sgfl' or p.proname in ('agregar_miembro_organizacion','listar_miembros_organizacion','es_miembro_organizacion','es_admin_organizacion','puede_editar_organizacion')) loop
  execute format('revoke all on function %s from public,anon',f.firma);
  if f.firma::text not like '%auditar_sgfl%' and f.firma::text not like '%documento_aceptado_sgfl%' then execute format('grant execute on function %s to authenticated',f.firma); end if;
 end loop;
end $$;
revoke all on function public.auditar_sgfl() from authenticated;
revoke all on function public.proteger_cierre_sgfl() from authenticated;
revoke all on function public.documento_aceptado_sgfl(uuid,text) from authenticated;
grant execute on function public.acceso_archivo_sgfl(text) to anon;
commit;
