// Ejecutar con: node tests/sgfl-database.mjs
// Herramienta temporal: npm install --prefix .sgfl-test-tools --no-save @electric-sql/pglite
import { PGlite } from '../.sgfl-test-tools/node_modules/@electric-sql/pglite/dist/index.js'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite()
await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth,storage to authenticated;
 grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
`)
await db.exec((await readFile('supabase/schema.sql', 'utf8')).replace('create extension if not exists pgcrypto with schema extensions;', ''))
await db.exec(await readFile('supabase/migrations/20261103_habilitar_modulos.sql', 'utf8'))
const migration = await readFile('supabase/migrations/20261103_sgfl_procesos_roles.sql', 'utf8')
await db.exec(migration)
await db.exec(migration) // instalación repetible
const org = '10000000-0000-0000-0000-000000000001'
const owner = '20000000-0000-0000-0000-000000000001'
const finance = '20000000-0000-0000-0000-000000000002'
const caja = '20000000-0000-0000-0000-000000000003'
const windowUser = '20000000-0000-0000-0000-000000000004'
const other = '10000000-0000-0000-0000-000000000002'
await db.exec(`insert into auth.users(id,email) values ('${owner}','admin@test.local'),('${finance}','finanzas@test.local'),('${caja}','caja@test.local'),('${windowUser}','ventanilla@test.local');
 select set_config('request.jwt.claim.sub','${owner}',false);
 insert into public.organizaciones(id,nombre,creado_por) values('${org}','Prueba','${owner}'),('${other}','Otra','${owner}');
 insert into public.miembros_organizacion(organizacion_id,usuario_id,rol) values('${org}','${owner}','owner'),('${org}','${finance}','finanzas'),('${org}','${caja}','caja'),('${org}','${windowUser}','ventanilla');`)
async function asUser(id) { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`) }
async function rpc(name, args) { return (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`, args)).rows[0]?.result }
async function denied(fn, pattern) { await assert.rejects(fn, pattern) }
await asUser(windowUser)
let exp = await rpc('guardar_expediente', [org, null, { propietario:'Persona de prueba',fundo:'Fundo de prueba',lote:'1',tipo_tramite:'Búsqueda de información',estado:'En trámite',area_actual:'Recepción',seguimiento_firmas:'Sin iniciar',fecha_solicitud:'2026-01-01' }])
assert.ok(exp)
console.log('OK: Ventanilla crea expediente con folio único')
await rpc('accion_expediente_sgfl', [org, exp, 'guardar', { domicilio:'Domicilio',motivo_solicitud:'Antecedentes',tipo_documento:'Constancia de trámite de título' }, 'Recepción'])
await denied(() => rpc('accion_expediente_sgfl', [org, exp, 'guardar', { autorizacion_direccion:'Autorizado' }, '']), /rol no puede/)
await rpc('accion_expediente_sgfl', [org, exp, 'avanzar', {}, 'Solicitud completa'])
await denied(() => rpc('accion_expediente_sgfl', [org, exp, 'avanzar', {}, 'Canalizar']), /área responsable/)
console.log('OK: etapas y campos protegidos por rol')
await asUser(owner)
await rpc('accion_expediente_sgfl', [org, exp, 'avanzar', {}, 'Canalizado'])
await denied(() => rpc('accion_expediente_sgfl', [org, exp, 'avanzar', {}, 'Intento sin pago']), /pago válido/)
await asUser(caja)
const folio = (await db.query('select folio from public.expedientes where id=$1', [exp])).rows[0].folio
await rpc('registrar_pago_sgfl', [org, { folio,concepto:'Búsqueda de información',recibo:'R-001',importe:100,fecha:'2026-01-01',evidencia:'Recibo R-001' }])
await rpc('accion_expediente_sgfl', [org, exp, 'avanzar', {}, 'Pago registrado'])
console.log('OK: avance bloqueado sin pago y permitido con recibo')
await asUser(finance)
for (const table of ['expedientes','propietarios','predios','fundos','modulo_registros','sgfl_seguimiento','sgfl_documentos','sgfl_pagos','sgfl_bitacora','sgfl_configuracion']) {
 assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0, table)
}
// Una función SETOF retorna filas individuales al invocarse en SELECT; consultar explícitamente.
const safeRows = (await db.query('select * from public.consultar_pagos_sgfl($1,$2)',[org,folio])).rows
assert.equal(safeRows.length, 1)
assert.deepEqual(Object.keys(safeRows[0]).sort(), ['id','folio','folio_predio','clave_catastral','concepto','recibo','fecha','importe','estado'].sort())
await denied(() => rpc('registrar_pago_sgfl', [org, {}]), /Solo Caja/)
await denied(() => rpc('accion_expediente_sgfl', [org, exp, 'guardar', {}, '']), /Sin permiso/)
await denied(() => rpc('listar_miembros_organizacion', [org]), /Solo administración/)
await denied(() => rpc('consultar_pagos_sgfl', [other, '']), /Sin permiso/)
await denied(() => db.query('update public.sgfl_bitacora set accion=$1', ['Alterado']), /permission denied/)
console.log('OK: Finanzas solo consulta la proyección autorizada de pagos; aislamiento por organización y auditoría protegida')
await asUser(owner)
await rpc('activar_miembro_sgfl', [org, finance, false])
await asUser(finance)
await denied(() => rpc('consultar_pagos_sgfl', [org, '']), /Sin permiso/)
console.log('OK: desactivar usuario revoca acceso con sesión existente')
await asUser(owner)
await denied(() => rpc('accion_expediente_sgfl', [org, exp, 'avanzar', {}, 'Sin documentos']), /requisito aceptado/)
const audited = (await db.query('select * from public.sgfl_bitacora where expediente_id=$1',[exp])).rows
assert.ok(audited.length > 5)
console.log('OK: requisitos obligatorios y bitácora persistente')

// Versionado: cargar no equivale a aceptar; una nueva versión vuelve a estar pendiente.
async function document(type) {
 const path = `${org}/${exp}/${crypto.randomUUID()}.pdf`
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['sgfl-documentos',path])
 await rpc('accion_expediente_sgfl', [org,exp,'documento',{ tipo:type,ruta:path,nombre:'prueba.pdf' },'Documento recibido'])
 return (await db.query('select id from public.sgfl_documentos where expediente_id=$1 and tipo=$2 order by version desc limit 1',[exp,type])).rows[0].id
}
async function accept(id) { await rpc('accion_expediente_sgfl', [org,exp,'revisar_documento',{ id,estado:'Aceptado' },'Cotejado']) }
await accept(await document('Identificación oficial'))
await accept(await document('Solicitud escrita'))
const newVersion = await document('Identificación oficial')
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Nueva versión pendiente']),/requisito aceptado/)
await accept(newVersion)
assert.equal((await db.query("select * from public.sgfl_documentos where tipo='Identificación oficial'")).rows.length,2)
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Requisitos revisados'])
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ dictamen:'No procede' },'Dictamen incompleto']),/justificación/)
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ dictamen:'Procede',motivo_dictamen:'Se localizaron antecedentes' },'Procede'])
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Sin pago de documento']),/pago válido/)
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'excepcion_pago',{},'']),/motivo/)
await rpc('accion_expediente_sgfl',[org,exp,'excepcion_pago',{},'Exención institucional de prueba'])
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Exención autorizada'])
await accept(await document('Documento expedido'))
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ documento_texto:'Constancia preparada para prueba' },'Documento generado'])
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'guardar',{ autorizacion_direccion:'Autorizado' },'']),/Jefatura debe revisar/)
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'devolver',{ etapa:'BUS-09' },'Intento saltar']),/etapa anterior/)
await rpc('accion_expediente_sgfl',[org,exp,'devolver',{ etapa:'BUS-07' },'Corregir redacción'])
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ documento_texto:'Constancia corregida para prueba' },'Documento corregido'])
await rpc('agregar_miembro_organizacion',[org,'caja@test.local','jefatura'])
await rpc('agregar_miembro_organizacion',[org,'ventanilla@test.local','direccion'])
await asUser(caja)
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'guardar',{ autorizacion_direccion:'Autorizado' },'']),/rol no puede/)
await rpc('accion_expediente_sgfl',[org,exp,'guardar',{ revision_jefatura:'Revisado' },'Revisión de Jefatura'])
await asUser(windowUser)
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'guardar',{ revision_jefatura:'Pendiente' },'']),/rol no puede/)
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ autorizacion_direccion:'Autorizado' },'Autorización de Dirección'])
await asUser(owner)
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Sin entrega']),/receptor/)
await denied(() => document('Documento expedido'),/no puede sustituirse/)
await accept(await document('Acuse de entrega'))
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ receptor:'Solicitante',fecha_entrega:'2026-01-02',fecha_archivo:'2026-01-03' },'Entregado y archivado'])
assert.equal((await db.query('select cerrado from public.sgfl_seguimiento where expediente_id=$1',[exp])).rows[0].cerrado,true)
assert.equal((await db.query('select estado from public.expedientes where id=$1',[exp])).rows[0].estado,'Vigente')
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'guardar',{},'']),/cerrado/)
await denied(() => db.query("update public.expedientes set estado='Pendiente' where id=$1",[exp]),/cerrado/)
assert.equal((await db.query('delete from public.expedientes where id=$1 returning id',[exp])).rows.length,0)
console.log('OK: flujo BUS completo, versiones, autorización previa, excepción motivada, entrega y cierre protegido')
exp = await rpc('guardar_expediente', [org,null,{ propietario:'Otra persona',fundo:'Fundo de prueba',lote:'2',tipo_tramite:'Titulación',estado:'En trámite',area_actual:'Recepción',seguimiento_firmas:'Sin iniciar',fecha_solicitud:'2026-01-01' }])
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Recepción'])
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Requisitos incompletos']),/requisito aceptado/)
for (const type of ['Solicitud de predio','Constancia de posesión','Identificación oficial','Acta de nacimiento','Comprobante de domicilio']) await accept(await document(type))
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Requisitos completos'])
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Sin pagos']),/pagos válidos/)
const titleFolio = (await db.query('select folio from public.expedientes where id=$1',[exp])).rows[0].folio
for (const concepto of ['Lote','Servicios catastrales']) await rpc('registrar_pago_sgfl',[org,{ folio:titleFolio,concepto,recibo:'REC-TIT',importe:200,fecha:'2026-01-02',evidencia:'Referencia documental de prueba' }])
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Pagos completos'])
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Digitalización y captura'])
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Sin validación']),/validación/)
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ validacion:'Validado' },'Expediente cotejado'])
await accept(await document('Título'))
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ titulo_numero:'TIT-001',titulo_revisado:'Revisado' },'Título cotejado'])
await accept(await document('Acuse Consejería'))
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ oficio_consejeria:'OF-001',destinatario_consejeria:'Consejería',envio_consejeria:'2026-01-03' },'Oficio enviado'])
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ recepcion_consejeria:'2026-01-02',retorno_consejeria:'2026-01-04',firmas_consejeria:'Firmado' },'Fechas invertidas']),/orden del proceso/)
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ recepcion_consejeria:'2026-01-03',retorno_consejeria:'2026-01-04',firmas_consejeria:'Firmado' },'Retorno firmado'])
await accept(await document('Acuse RPP'))
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ folio_rpp:'RPP-001',documentos_rpp:'Título y copias',envio_rpp:'2026-01-05' },'Enviado al RPP'])
await denied(() => rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ inscripcion_rpp:'Partida-001',fecha_inscripcion:'2026-01-06',retorno_rpp:'2026-01-07' },'Falta evidencia']),/título inscrito aceptado/)
await accept(await document('Título inscrito'))
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ inscripcion_rpp:'Partida-001',fecha_inscripcion:'2026-01-06',retorno_rpp:'2026-01-07' },'Inscripción recibida'])
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{},'Digitalización final'])
await accept(await document('Acuse de entrega'))
await rpc('accion_expediente_sgfl',[org,exp,'avanzar',{ afectacion_final:'Completada',receptor:'Solicitante',fecha_entrega:'2026-01-08',fecha_archivo:'2026-01-09' },'Título entregado y archivado'])
assert.equal((await db.query('select cerrado from public.sgfl_seguimiento where expediente_id=$1',[exp])).rows[0].cerrado,true)
const indicators = await rpc('indicadores_sgfl',[org])
assert.equal(indicators.etapas.length,21)
assert.ok(indicators.dias_resolucion >= 0)
console.log('OK: flujo TIT completo, Consejería, RPP, cronología, evidencia y tiempos por etapa; cartografía excluida')
await rpc('activar_miembro_sgfl',[org,finance,true])
await db.exec('reset role; create policy prueba_storage_general on storage.objects for all to authenticated using(true) with check(true);')
await asUser(finance)
assert.equal((await db.query('select * from public.sgfl_documentos')).rows.length,0)
assert.equal((await db.query("select * from storage.objects where bucket_id='sgfl-documentos'")).rows.length,0)
await denied(() => db.query("insert into storage.objects(bucket_id,name) values('sgfl-documentos',$1)",[`${org}/${exp}/${crypto.randomUUID()}.pdf`]),/row-level security/)
await denied(() => rpc('configuracion_sgfl',[org]),/Sin permiso/)
await denied(() => rpc('indicadores_sgfl',[org]),/Sin permiso/)
await asUser(owner)
assert.equal((await db.query("update storage.objects set name='alterado' where bucket_id='sgfl-documentos' returning id")).rows.length,0)
assert.equal((await db.query("delete from storage.objects where bucket_id='sgfl-documentos' returning id")).rows.length,0)
console.log('OK: archivos privados y versiones protegidas incluso ante políticas generales de Storage preexistentes')

// Alta administrativa: promoción solicitada e invocación exclusivamente desde el servidor.
await db.exec('reset role')
const designated = crypto.randomUUID()
const newWorker = crypto.randomUUID()
await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())', [designated,'derian_3041240440@utd.edu.mx',newWorker,'nuevo@test.local'])
await db.query("insert into public.miembros_organizacion(organizacion_id,usuario_id,rol,activo) values($1,$2,'viewer',false)",[org,designated])
const workerMigration = await readFile('supabase/migrations/20261103_alta_trabajadores.sql','utf8')
await db.exec(workerMigration)
await db.exec(workerMigration)
assert.deepEqual((await db.query('select rol,activo from public.miembros_organizacion where organizacion_id=$1 and usuario_id=$2',[org,designated])).rows[0],{rol:'admin',activo:true})
await asUser(designated)
await denied(() => rpc('vincular_trabajador_sgfl',[designated,org,newWorker,'finanzas']),/permission denied/)
await denied(() => rpc('crear_organizacion',['Espacio no autorizado']),/permission denied/)
await db.exec("reset role; select set_config('request.jwt.claim.sub','',false); set role service_role;")
await denied(() => rpc('vincular_trabajador_sgfl',[finance,org,newWorker,'finanzas']),/Sin permiso/)
await denied(() => rpc('vincular_trabajador_sgfl',[designated,org,newWorker,'owner']),/Rol inválido/)
await denied(() => rpc('vincular_trabajador_sgfl',[designated,other,newWorker,'finanzas']),/Sin permiso/)
await rpc('vincular_trabajador_sgfl',[designated,org,newWorker,'finanzas'])
await denied(() => rpc('vincular_trabajador_sgfl',[designated,org,newWorker,'admin']),/ya tiene una membresía/)
await asUser(designated)
assert.equal((await db.query('select rol from public.miembros_organizacion where organizacion_id=$1 and usuario_id=$2',[org,newWorker])).rows[0].rol,'finanzas')
assert.equal((await db.query("select actor from public.sgfl_bitacora where accion='alta_trabajador'")).rows[0].actor,designated)
console.log('OK: cuenta solicitada administradora, alta de trabajadores restringida al servidor y bitácora con actor verificado')
await db.close()
