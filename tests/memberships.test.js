import test from 'node:test'
import assert from 'node:assert/strict'
import { loadMemberships } from '../src/lib/memberships.js'

function fakeClient(results) {
  const selects = []
  return { selects, from: () => ({ select(columns) {
    selects.push(columns)
    return { eq: () => ({ order: async () => results.shift() }) }
  } }) }
}
test('recupera membresías antiguas cuando falta activo, sin crear organizaciones', async () => {
  const client = fakeClient([
    { error: { code:'42703',message:'column miembros_organizacion.activo does not exist' } },
    { data:[{ rol:'owner',organizacion:{ id:'org',nombre:'Fundos' } }],error:null },
  ])
  assert.equal((await loadMemberships(client,'usuario'))[0].rol,'owner')
  assert.equal(client.selects.length,2)
  assert.ok(!client.selects[1].includes('activo'))
})
test('respeta desactivación cuando existe activo', async () => {
  const client = fakeClient([{data:[{activo:false,organizacion:{id:'inactivo'}},{activo:true,organizacion:{id:'activo'}}],error:null}])
  assert.deepEqual((await loadMemberships(client,'usuario')).map(m => m.organizacion.id),['activo'])
  assert.equal(client.selects.length,1)
})
test('no confunde errores de permisos o red con ausencia de organizaciones', async () => {
  for (const error of [{code:'42501',message:'permission denied'}, {code:'42703',message:'otra_columna does not exist'}, {message:'Failed to fetch'}]) {
    const client = fakeClient([{error}])
    await assert.rejects(() => loadMemberships(client,'usuario'))
    assert.equal(client.selects.length,1)
  }
})
