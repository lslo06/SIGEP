import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { promisify } from 'node:util'
import * as crypto from 'node:crypto'

// Exercise the actual HTTP router and handlers without a live database or listener.
const source = readFileSync(new URL('../api/server.mjs', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
const user = { id: 'test-user', correo: 'caja@sigep.test', rol: 'admin' }
const file = { id: 12, etapa_actual: 'recepcion', estado: 'recibido', area_responsable: 'Ventanilla' }
const geometry = { type: 'Polygon', coordinates: [[[-104, 24], [-104.01, 24], [-104, 24.01], [-104, 24]]] }
const payment = { folio: 'FL-2026-000012', concepto: 'Lote', recibo: 'R-123', importe: 125.50, fecha: '2026-01-01', evidencia: 'archivo/123', actor: 'suplantado' }

async function invoke(path, body, { fail, missing = false, authenticated = true, role = 'admin', method = 'POST' } = {}) {
  const calls = []
  let handler
  let released = false
  let committed = false
  const query = async (sql, params) => {
    calls.push({ sql, params })
    if (fail && sql.includes(fail)) throw Object.assign(new Error('Injected database failure'), { code: fail.includes('pagos_expediente') ? '23505' : 'XX000' })
    if (sql === 'COMMIT') committed = true
    if (sql.includes('FROM public.sesiones_locales')) return { rows: authenticated ? [{ ...user, rol: role }] : [] }
    if (sql.includes('FROM public.expedientes') && sql.includes('FOR UPDATE')) return { rows: missing ? [] : [file] }
    if (sql.includes('FROM predios WHERE')) return { rows: [{ id: 1, clave_catastral: 'P-1' }] }
    if (sql.includes('nextval')) return { rows: [{ year: 2026, number: 1 }] }
    if (sql.includes('INSERT INTO expedientes')) return { rows: [file] }
    if (sql.includes('FROM public.predios WHERE')) return { rows: [{ id: 1, clave_catastral: 'P-1', superficie: 100, geometry }] }
    if (sql.includes('ST_IsValid')) return { rows: [{ valid: true, area_m2: 110 }] }
    if (sql.includes('UPDATE public.predios')) return { rows: [{ id: 1, geometry }] }
    return { rows: [{ id: 25 }] }
  }
  const client = { query, release() { released = true } }
  const pool = { query: async (sql, params) => {
    assert.match(sql, /FROM public.sesiones_locales|FROM public.pagos_expediente/, 'Writes must use the transaction client')
    return query(sql, params)
  }, connect: async () => client }
  vm.runInNewContext(source, {
    ...crypto, scryptCallback: crypto.scrypt, promisify, URL, Buffer,
    Pool: function () { return pool },
    http: { createServer(fn) { handler = fn; return { listen() {}, close() {} } } },
    process: { env: {}, on() {} }, console: { log() {}, error() {} },
  })
  const request = { url: path, method, headers: { cookie: authenticated ? `sigep_session=${'a'.repeat(64)}` : '' },
    async *[Symbol.asyncIterator]() { yield JSON.stringify(body) } }
  const result = {}
  const response = { writeHead(status) { result.status = status }, end(data) { result.body = JSON.parse(data); result.committedAtResponse = committed } }
  await handler(request, response)
  return { ...result, calls, released }
}

test('Payment and history use one transaction and the authenticated actor', async () => {
  const result = await invoke('/api/pagos', payment)
  assert.equal(result.status, 201)
  assert.equal(result.committedAtResponse, true)
  assert.equal(result.released, true)
  const writes = result.calls.slice(1)
  assert.equal(writes[0].sql, 'BEGIN')
  assert.match(writes[1].sql, /FOR UPDATE/)
  assert.match(writes[2].sql, /INSERT INTO public.pagos_expediente/)
  assert.match(writes[3].sql, /INSERT INTO public.movimientos_expediente/)
  assert.equal(writes[3].params.at(-1), user.correo)
  assert.match(writes[3].params[4], /Pago 25: Lote.*R-123.*125.5.*2026-01-01.*archivo\/123/)
  assert.equal(writes[4].sql, 'COMMIT')
})

for (const [label, options, status] of [
  ['history failure', { fail: 'INSERT INTO public.movimientos_expediente' }, 500],
  ['duplicate receipt', { fail: 'INSERT INTO public.pagos_expediente' }, 409],
  ['closed or missing expediente', { missing: true }, 404],
]) {
  test(`Payment rolls back on ${label}`, async () => {
    const result = await invoke('/api/pagos', payment, options)
    assert.equal(result.status, status)
    assert.equal(result.calls.at(-1).sql, 'ROLLBACK')
    assert.equal(result.calls.some(({ sql }) => sql === 'COMMIT'), false)
    assert.equal(result.released, true)
  })
}

test('Invalid payment is rejected before opening a transaction', async () => {
  const result = await invoke('/api/pagos', { ...payment, importe: -1 })
  assert.equal(result.status, 400)
  assert.equal(result.released, false)
})

test('Expediente creation records the session actor in its initial movement', async () => {
  const result = await invoke('/api/expedientes', { tipo_tramite: 'titulacion', solicitante: { nombre: 'Prueba' }, predio_ids: [1], actor: 'suplantado' })
  assert.equal(result.status, 201)
  const movement = result.calls.find(({ sql }) => sql.includes('INSERT INTO movimientos_expediente'))
  assert.equal(movement.params.at(-1), user.correo)
  assert.equal(result.committedAtResponse, true)
})

for (const actor of [undefined, 'suplantado']) {
  test(`Geometry correction uses the session actor (submitted actor: ${actor})`, async () => {
    const result = await invoke('/api/predios/1/geometria', { geometry, motivo: 'Ajuste de lindero', actor }, { method: 'PATCH' })
    assert.equal(result.status, 200)
    const history = result.calls.find(({ sql }) => sql.includes('INSERT INTO public.predio_geometria_historial'))
    assert.equal(history.params[6], user.correo)
    assert.equal(result.body.geometry_change.actor, user.correo)
  })
}

for (const [path, method] of [['/api/pagos', 'POST'], ['/api/expedientes', 'POST'], ['/api/predios/1/geometria', 'PATCH']]) {
  test(`${path} rejects missing sessions and unauthorized roles before writing`, async () => {
    for (const options of [{ authenticated: false }, { role: 'viewer' }]) {
      const result = await invoke(path, {}, { ...options, method })
      assert.equal(result.status, options.authenticated === false ? 401 : 403)
      assert.equal(result.calls.some(({ sql }) => sql === 'BEGIN'), false)
    }
  })
}
