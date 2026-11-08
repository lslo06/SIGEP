import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorkerHandler } from '../supabase/functions/crear-trabajador/handler.js'

const org='10000000-0000-0000-0000-000000000001'
const verifiedId='20000000-0000-0000-0000-000000000001'
const workerId='20000000-0000-0000-0000-000000000002'
const form={organizacion_id:org,email:' Nuevo@Ejemplo.com ',password:'Test-password-123456',nombre:'Trabajador de prueba',rol:'finanzas'}
function mock(options={}) {
  const calls={created:[],linked:[],deleted:[],auth:[],queries:[]}
  const service={
    auth:{
      getUser:async token => { calls.auth.push(token); return options.authError ? {error:{}} : {data:{user:{id:verifiedId}}} },
      admin:{
        createUser:async data => {calls.created.push(data);return options.createError ? {error:options.createError} : {data:{user:{id:workerId}}}},
        deleteUser:async id => { calls.deleted.push(id);return {error:options.deleteError} },
      },
    },
    from:table => { calls.queries.push(['table',table]); const q={select:()=>q,eq:(key,value)=>{calls.queries.push([key,value]);return q},maybeSingle:async()=>({data:options.member===undefined?{rol:'admin',activo:true}:options.member,error:options.memberError})};return q },
    rpc:async(name,data)=>{calls.linked.push([name,data]);return {error:options.linkError}},
  }
  return {handler:createWorkerHandler(service),calls}
}
const request=(body=form,headers={Authorization:'Bearer verified-token'})=>new Request('https://example.test/crear-trabajador',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)})

test('requiere sesión verificada y no crea cuentas anónimas',async()=>{
  const {handler,calls}=mock()
  assert.equal((await handler(request(form,{}))).status,401)
  assert.equal(calls.created.length,0)
  const invalid=mock({authError:true})
  assert.equal((await invalid.handler(request())).status,401)
  assert.equal(invalid.calls.created.length,0)
})
test('deniega roles operativos, administradores inactivos y otras organizaciones',async()=>{
  for (const member of [{rol:'finanzas',activo:true},{rol:'admin',activo:false},null]) {
    const {handler,calls}=mock({member})
    assert.equal((await handler(request({...form,actor:'forjado',role:'admin'}))).status,403)
    assert.equal(calls.created.length,0)
  }
})
test('alta crea la cuenta confirmada y asigna el rol sin devolver la contraseña',async()=>{
  const {handler,calls}=mock()
  const result=await handler(request({...form,p_actor:'forjado',usuario_id:'forjado'}))
  assert.equal(result.status,201)
  const data=await result.json()
  assert.deepEqual(data,{ok:true,usuario:{id:workerId,email:'nuevo@ejemplo.com',rol:'finanzas'}})
  assert.equal(calls.created[0].email_confirm,true)
  assert.equal(calls.created[0].password,form.password)
  assert.deepEqual(calls.linked[0],['vincular_trabajador_sgfl',{p_actor:verifiedId,p_organizacion_id:org,p_usuario_id:workerId,p_rol:'finanzas'}])
  assert.ok(!JSON.stringify(data).includes(form.password))
  assert.ok(calls.queries.some(([key,value])=>key==='usuario_id'&&value===verifiedId))
})
test('valida correo, organización, contraseña y rol antes de crear',async()=>{
  for (const invalid of [{password:'corta'},{password:'x'.repeat(129)},{email:'incorrecto'},{rol:'owner'},{rol:'editor'},{organizacion_id:'otra'},{password:null}]) {
    const {handler,calls}=mock()
    assert.equal((await handler(request({...form,...invalid}))).status,400)
    assert.equal(calls.created.length,0)
  }
})
test('si falla la asignación revierte exclusivamente la cuenta recién creada',async()=>{
  const {handler,calls}=mock({linkError:{message:'revoked'}})
  const result=await handler(request())
  assert.equal(result.status,503)
  assert.deepEqual(calls.deleted,[workerId])
  assert.ok(!(await result.text()).includes(form.password))
})
test('un correo existente no se modifica ni se elimina',async()=>{
  const {handler,calls}=mock({createError:{code:'email_exists'}})
  const result=await handler(request())
  assert.equal(result.status,409)
  assert.match((await result.json()).error,/cuenta existente/)
  assert.deepEqual(calls.linked,[])
  assert.deepEqual(calls.deleted,[])
})
test('informa si la compensación falla para poder completar el acceso existente',async()=>{
  const {handler}=mock({linkError:{},deleteError:{}})
  const result=await handler(request())
  assert.equal(result.status,503)
  assert.match((await result.json()).error,/Asignar cuenta existente/)
})
test('rechaza peticiones malformadas y atiende preflight sin autenticar',async()=>{
  const {handler,calls}=mock()
  assert.equal((await handler(new Request('https://example.test',{method:'OPTIONS'}))).status,204)
  assert.equal((await handler(new Request('https://example.test'))).status,405)
  assert.equal((await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer token'},body:'{incorrecto'}))).status,400)
  assert.equal(calls.created.length,0)
})
