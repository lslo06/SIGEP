import { localPermissions } from '../api/permissions.mjs'
import { createUserManager } from '../api/users.mjs'
import { createInitialReception } from '../api/initial-reception.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { promisify } from 'node:util'
import * as crypto from 'node:crypto'
import pathModule from 'node:path'

// Exercise the actual HTTP router and handlers without a live database or listener.
const source = readFileSync(new URL('../api/server.mjs', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  // The handler runs in a CommonJS-style VM sandbox; give the ESM-only
  // import.meta-based storage default a harmless test path in that sandbox.
  .replace("path.join(path.dirname(fileURLToPath(import.meta.url)), 'private-files')", "path.join('api', 'private-files')")
const user = { id: 'test-user', correo: 'caja@sigep.test', rol: 'admin' }
const file = { id: 12, etapa_actual: 'recepcion', estado: 'recibido', area_responsable: 'Ventanilla' }
const geometry = { type: 'Polygon', coordinates: [[[-104, 24], [-104.01, 24], [-104, 24.01], [-104, 24]]] }
const payment = { folio: 'FL-2026-000012', concepto: 'Lote', recibo: 'R-123', importe: 125.50, fecha: '2026-01-01', evidencia: 'archivo/123', actor: 'suplantado' }

async function invoke(path, body, { fail, missing = false, authenticated = true, role = 'admin', method = 'POST', tipoTramite, priorDictamen = false, readResponses = {} } = {}) {
  const calls = []
  let handler
  let released = false
  let committed = false
  const query = async (sql, params) => {
    calls.push({ sql, params })
    if (fail && sql.includes(fail)) throw Object.assign(new Error('Injected database failure'), { code: fail.includes('pagos_expediente') ? '23505' : 'XX000' })
    if (sql === 'COMMIT') committed = true
    if (sql.includes('FROM public.sesiones_locales')) return { rows: authenticated ? [{ ...user, rol: role }] : [] }
    if (sql.includes('FROM public.expedientes') && sql.includes('FOR UPDATE')) return { rows: missing ? [] : [{ ...file, tipo_tramite: tipoTramite }] }
    if (sql.includes("etapa_destino = 'dictamen_legal'")) return { rows: priorDictamen ? [{ id: 25 }] : [] }
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
    const match = Object.keys(readResponses).find(fragment => sql.includes(fragment))
    if (match) { assert.match(sql.trim(), /^SELECT/); return { rows: readResponses[match] } }
    assert.match(sql, /FROM public.sesiones_locales|FROM public.pagos_expediente/, 'Writes must use the transaction client')
    return query(sql, params)
  }, connect: async () => client }
  vm.runInNewContext(source, {
    localPermissions, createUserManager, createInitialReception, ...crypto, scryptCallback: crypto.scrypt, promisify, URL, Buffer, path: pathModule,
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

test('Merged document routes preserve role restrictions and accepted-only reading', async () => {
  const id = '11111111-1111-4111-8111-111111111111'
  for (const [role, path, method] of [
    ['viewer', '/api/expedientes/12/documentos', 'POST'],
    ['captura', `/api/expedientes/12/documentos/${id}/revision`, 'PATCH'],
    ['digitalizacion', '/api/expedientes/12/predios/1/catastro', 'PATCH'],
    ['caja', '/api/expedientes/12/documentos', 'GET'],
  ]) {
    const r = await invoke(path, {}, { role, method })
    assert.equal(r.status, 403, `${role} ${path}`)
    assert.equal(r.calls.some(c => c.sql === 'BEGIN'), false)
  }
  const readResponses = {
    'SELECT id, tipo_tramite, estado FROM public.expedientes': [{ id: 12, tipo_tramite: 'titulacion', estado: 'recibido' }],
    'FROM public.archivos_expediente d': [{ id, estado_revision: 'pendiente', bytes: 10 }, { id: 'accepted', estado_revision: 'aceptado', bytes: 20 }],
    'SELECT nombre FROM public.requisitos_documentales': [{ nombre: 'Identificación oficial' }],
  }
  const reader = await invoke('/api/expedientes/12/documentos', {}, { role: 'legal', method: 'GET', readResponses })
  assert.equal(reader.status, 200)
  assert.deepEqual(reader.body.documentos.map(d => d.id), ['accepted'])
  const uploader = await invoke('/api/expedientes/12/documentos', {}, { role: 'digitalizacion', method: 'GET', readResponses })
  assert.equal(uploader.status, 200)
  assert.equal(uploader.body.documentos.length, 2)
})

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

const dictamenPath = '/api/expedientes/12/dictamen'
const legal = { role: 'legal', tipoTramite: 'constancia_tramite_titulo' }
const dictamen = { decision: 'procede', motivo: '  Datos cotejados  ', actor: 'suplantado' }

for (const [decision, estado] of [['procede', 'en_proceso'], ['no_procede', 'no_procede']]) {
  test(`Legal guarda ${decision} y el historial en la misma transacción`, async () => {
    const result = await invoke(dictamenPath, { ...dictamen, decision }, legal)
    assert.equal(result.status, 201)
    assert.equal(result.committedAtResponse, true)
    const writes = result.calls.slice(1)
    assert.equal(writes[0].sql, 'BEGIN')
    assert.match(writes[1].sql, /FOR UPDATE/)
    assert.match(writes[3].sql, /UPDATE public.expedientes/)
    assert.equal(writes[3].params[1], estado)
    assert.match(writes[4].sql, /INSERT INTO public.movimientos_expediente/)
    assert.equal(writes[4].params[2], estado)
    assert.equal(writes[4].params[4], 'Datos cotejados')
    assert.equal(writes[4].params[5], user.correo)
  })
}

test('Dictamen rechaza una cuenta de consulta y un motivo vacío antes de escribir', async () => {
  const denied = await invoke(dictamenPath, dictamen, { ...legal, role: 'viewer' })
  const missingReason = await invoke(dictamenPath, { ...dictamen, motivo: '   ' }, legal)
  assert.equal(denied.status, 403)
  assert.equal(missingReason.status, 400)
  for (const result of [denied, missingReason]) assert.equal(result.calls.some(({ sql }) => sql === 'BEGIN'), false)
})

for (const [label, options, status] of [
  ['titulación', { tipoTramite: 'titulacion' }, 409],
  ['dictamen previo', { priorDictamen: true }, 409],
  ['fallo al insertar el historial', { fail: 'INSERT INTO public.movimientos_expediente' }, 500],
]) {
  test(`Dictamen revierte la transacción ante ${label}`, async () => {
    const result = await invoke(dictamenPath, dictamen, { ...legal, ...options })
    assert.equal(result.status, status)
    assert.equal(result.calls.at(-1).sql, 'ROLLBACK')
    assert.equal(result.committedAtResponse, false)
    assert.equal(result.released, true)
  })
}

test('Expediente creation records the session actor in its initial movement', async () => {
  const result = await invoke('/api/expedientes', { tipo_tramite: 'titulacion', solicitante: { nombre: 'Prueba' }, predio_ids: [1], actor: 'suplantado' })
  assert.equal(result.status, 201)
  const movement = result.calls.find(({ sql }) => sql.includes('INSERT INTO movimientos_expediente'))
  assert.equal(movement.params.at(-1), user.correo)
  assert.equal(result.committedAtResponse, true)
})

test('Actual router denies geometry writes to capture while allowing cartography', async () => {
  const denied = await invoke('/api/predios/1/geometria', { geometry, motivo: 'Corrección' }, { role: 'captura', method: 'PATCH' })
  assert.equal(denied.status, 403)
  assert.equal(denied.calls.some(c => c.sql === 'BEGIN'), false)
  const allowed = await invoke('/api/predios/1/geometria', { geometry, motivo: 'Corrección' }, { role: 'cartografia', method: 'PATCH' })
  assert.equal(allowed.status, 200)
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
