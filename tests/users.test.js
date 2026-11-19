import test from 'node:test'
import assert from 'node:assert/strict'
import { createUserManager } from '../api/users.mjs'
import { roles, localPermissions } from '../api/permissions.mjs'
import { canReadAttachment } from '../api/attachments.mjs'

const target = { id: 'target', nombre: 'Antes', correo: 'antes@test.mx', rol: 'ventanilla', activo: true }
const body = { nombre: 'Después', correo: 'NUEVO@test.mx', rol: 'legal', activo: true }
async function invoke({ method = 'PATCH', id = 'target', data = body, user = { id: 'admin', rol: 'admin', correo: 'admin@test.mx' }, previous = target, count = 1, failAudit = false } = {}) {
  const calls = []; let released = false; let committed = false
  const query = async (sql, params) => {
    calls.push({ sql, params })
    if (sql === 'COMMIT') committed = true
    if (sql.includes('FOR UPDATE')) return { rows: previous ? [previous] : [] }
    if (sql.includes('count(*)')) return { rows: [{ total: count }] }
    if (sql.includes('auditoria_usuarios') && failAudit) throw new Error('audit failed')
    if (sql.includes('UPDATE public.usuarios_locales')) return { rows: [{ ...target, ...data, correo: data.correo?.toLowerCase() }] }
    if (sql.includes('INSERT INTO public.usuarios_locales')) return { rows: [{ ...target, ...data }] }
    return { rows: [] }
  }
  const pool = { query, connect: async () => ({ query, release() { released = true } }) }
  const result = {}
  const handler = createUserManager({ pool, currentLocalUser: async () => user, readJson: async () => data,
    sendJson: (_, status, response) => Object.assign(result, { status, body: response }), passwordHash: async () => 'HASH-SECRET', env: {} })
  await handler({ method, headers: { 'content-type': 'application/json' } }, {}, id)
  return { ...result, calls, committed, released }
}
test('only authenticated admin sessions can change users', async () => {
  for (const [user, status] of [[null, 401], [{ rol: 'legal' }, 403]]) {
    const r = await invoke({ user }); assert.equal(r.status, status); assert.equal(r.calls.length, 0)
  }
})
test('edit saves name/email/role, revokes sessions and audits atomically without secrets', async () => {
  const r = await invoke({ data: { ...body, password: 'valid-password-123' } })
  assert.equal(r.status, 200); assert.ok(r.committed && r.released)
  const update = r.calls.find(c => c.sql.includes('UPDATE public.usuarios_locales'))
  assert.deepEqual(update.params.slice(1, 5), ['Después', 'nuevo@test.mx', 'legal', true])
  assert.ok(r.calls.some(c => c.sql.includes('DELETE FROM public.sesiones_locales')))
  const audit = r.calls.find(c => c.sql.includes('INSERT INTO public.auditoria_usuarios'))
  assert.equal(audit.params[1], 'admin@test.mx')
  assert.doesNotMatch(JSON.stringify(audit.params), /HASH-SECRET|valid-password/)
})
test('delete disables access without deleting user history', async () => {
  const r = await invoke({ method: 'DELETE' })
  assert.equal(r.status, 200); assert.equal(r.body.eliminado, true)
  assert.ok(r.calls.some(c => c.sql.includes('eliminado_en = now()')))
  assert.ok(!r.calls.some(c => /DELETE FROM public.usuarios_locales/.test(c.sql)))
})
test('missing users are rejected and transaction rolled back', async () => {
  const r = await invoke({ previous: null }); assert.equal(r.status, 404)
  assert.equal(r.calls.at(-1).sql, 'ROLLBACK'); assert.ok(r.released)
})
test('last admin cannot be deleted or demoted, including with concurrent serialization', async () => {
  for (const method of ['DELETE', 'PATCH']) {
    const r = await invoke({ method, previous: { ...target, rol: 'admin' } })
    assert.equal(r.status, 409); assert.equal(r.committed, false)
    assert.ok(r.calls.some(c => c.sql.includes('pg_advisory_xact_lock')))
  }
})
test('an administrator cannot remove own access', async () => {
  const r = await invoke({ method: 'DELETE', user: { id: 'target', rol: 'admin' } })
  assert.equal(r.status, 409)
})
test('audit failure rolls back user and session changes', async () => {
  const r = await invoke({ failAudit: true }); assert.equal(r.status, 500)
  assert.equal(r.committed, false); assert.equal(r.calls.at(-1).sql, 'ROLLBACK')
})
test('creation requires password and only institutional roles', async () => {
  for (const data of [body, { ...body, rol: 'owner', password: 'long-password-123' }, { ...body, rol: 'finanzas', password: 'long-password-123' }]) {
    const r = await invoke({ method: 'POST', id: null, data }); assert.equal(r.status, 400)
  }
  const r = await invoke({ method: 'POST', id: null, data: { ...body, password: 'long-password-123' } })
  assert.equal(r.status, 201); assert.equal(r.committed, true)
})
test('13 institutional roles; capture cannot correct geometry and finance remains read-only', () => {
  assert.equal(Object.keys(roles).length, 13)
  assert.equal(localPermissions('captura').geometria, false)
  assert.equal(localPermissions('cartografia').geometria, true)
  assert.equal(localPermissions('finanzas').pagos, false)
  assert.deepEqual(localPermissions('owner').modulos, [])
})
test('document readers can consult technical attachments without acquiring write permissions', () => {
  for (const role of ['legal', 'digitalizacion', 'titulacion', 'informatica', 'viewer']) {
    assert.equal(localPermissions(role).archivos, true)
    assert.equal(canReadAttachment({ type: 'plano', role }), true)
    assert.equal(localPermissions(role).plano, false)
    assert.equal(localPermissions(role).evidenciaVisita, false)
  }
})
