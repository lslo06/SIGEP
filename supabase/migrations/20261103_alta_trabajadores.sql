-- Aplicar después de 20261103_sgfl_procesos_roles.sql.
begin;

-- Las cuentas operativas reciben su espacio de trabajo de Administración.
revoke execute on function public.crear_organizacion(text) from public,anon,authenticated;

-- Esta función se invoca exclusivamente desde la función del servidor.
create or replace function public.vincular_trabajador_sgfl(
 p_actor uuid,p_organizacion_id uuid,p_usuario_id uuid,p_rol text
) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.miembros_organizacion; begin
 if p_rol is null or p_rol not in ('admin','viewer','ventanilla','direccion','jefatura','legal','caja','finanzas','digitalizacion','captura','titulacion','informatica') then raise exception 'Rol inválido.'; end if;
 -- Serializa las altas y reasignaciones administrativas de la organización.
 perform 1 from public.organizaciones where id=p_organizacion_id for update;
 select * into a from public.miembros_organizacion where organizacion_id=p_organizacion_id and usuario_id=p_actor for update;
 if not found or not a.activo or a.rol not in ('owner','admin') then raise exception 'Sin permiso para dar de alta trabajadores.'; end if;
 if p_actor=p_usuario_id then raise exception 'No puedes reasignarte mediante el alta de trabajadores.'; end if;
 if not exists(select 1 from auth.users where id=p_usuario_id) then raise exception 'No existe la cuenta del trabajador.'; end if;
 if exists(select 1 from public.miembros_organizacion where organizacion_id=p_organizacion_id and usuario_id=p_usuario_id) then raise exception 'La cuenta ya tiene una membresía; usa la reasignación de roles.'; end if;
 insert into public.miembros_organizacion(organizacion_id,usuario_id,rol,activo) values(p_organizacion_id,p_usuario_id,p_rol,true);
 insert into public.sgfl_bitacora(organizacion_id,entidad,accion,actor,observacion,nuevo)
 values(p_organizacion_id,'usuario','alta_trabajador',p_actor,'Alta administrativa de trabajador',jsonb_build_object('usuario_id',p_usuario_id,'rol',p_rol));
 return p_usuario_id;
end; $$;
revoke all on function public.vincular_trabajador_sgfl(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.vincular_trabajador_sgfl(uuid,uuid,uuid,text) to service_role;

-- Designación explícitamente solicitada por el responsable del proyecto.
-- Se usa la identidad verificada en Auth, nunca user_metadata ni una comparación en React.
do $$
declare v_usuario uuid; v_org uuid; begin
 select id into v_usuario from auth.users where lower(email)='derian_3041240440@utd.edu.mx' and email_confirmed_at is not null;
 if v_usuario is null then
  raise exception 'No existe una cuenta confirmada para derian_3041240440@utd.edu.mx. Verificar la cuenta en Auth antes de instalar.';
 end if;
 update public.miembros_organizacion set rol=case when rol='owner' then 'owner' else 'admin' end,activo=true where usuario_id=v_usuario;
 if not found then
  select id into v_org from public.organizaciones where creado_por=v_usuario order by creado_en,id limit 1;
  if v_org is null then
   select id into v_org from public.organizaciones where lower(trim(nombre))='fundos legales' order by creado_en,id limit 1;
  end if;
  if v_org is null then
   insert into public.organizaciones(nombre,creado_por) values('Fundos Legales',v_usuario) returning id into v_org;
  end if;
  insert into public.miembros_organizacion(organizacion_id,usuario_id,rol,activo) values(v_org,v_usuario,'admin',true);
 end if;
end $$;
commit;
