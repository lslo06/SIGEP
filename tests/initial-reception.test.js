import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { promisify } from 'node:util'
import * as crypto from 'node:crypto'
import { localPermissions, roles } from '../api/permissions.mjs'
import { createInitialReception } from '../api/initial-reception.mjs'
import { createUserManager } from '../api/users.mjs'
import config from '../vite.config.js'

// Real HTTP router/validators/permissions/multipart, simulated SQL and private files.
// This does not replace applying the migration and testing a real PostgreSQL instance.
const source = readFileSync(new URL('../api/server.mjs', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace("path.join(path.dirname(fileURLToPath(import.meta.url)), 'private-files')", "path.join('tests', 'simulated-private')")
const base = '/api/solicitudes-titulacion'
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date())
const topoId = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
const intake = {
  solicitante: { nombres: ' María del Carmen ', primer_apellido: ' López ', segundo_apellido: ' Hernández ', telefono: '6181234567' },
  ubicacion: { municipio: 'Durango', localidad: 'Localidad de prueba', referencias: 'A 200 m del puente, junto al portón azul.' },
  observaciones: 'Sin documentos al momento de la recepción.', actor: 'actor-falso',
}

function harness() {
  let handler, actor, rollback, active = 0, failure = ''
  let db = { file: null, person: null, location: null, visit: null, files: [], movements: [] }
  const calls = [], unexpected = [], bytes = new Map()
  const query = async (statement, params = []) => {
    const sql = statement.replace(/\s+/g, ' ').trim()
    calls.push({ sql, params })
    if (sql.includes('FROM public.sesiones_locales s')) return { rows: actor ? [actor] : [] }
    if (failure && sql.includes(failure)) throw Object.assign(new Error('Injected failure'), { code: 'XX000' })
    const rows = value => ({ rows: structuredClone(value), rowCount: value.length })
    if (sql === 'BEGIN') { rollback = structuredClone(db); return rows([]) }
    if (sql === 'COMMIT') { rollback = null; return rows([]) }
    if (sql === 'ROLLBACK') { if (rollback) db = rollback; rollback = null; return rows([]) }
    if (sql.includes('nextval')) return rows([{ year: 2026, number: 12 }])
    if (sql.startsWith('INSERT INTO public.solicitantes')) { db.person = { id: 20, params: [...params] }; return rows([{ id: 20 }]) }
    if (sql.startsWith('INSERT INTO public.expedientes')) {
      db.file = { id: 12, folio: params[0], tipo_tramite: 'titulacion', estado: 'recibido', etapa_actual: 'recepcion', area_responsable: 'Ventanilla', recepcion_inicial: true }
      return rows([db.file])
    }
    if (sql.startsWith('INSERT INTO public.ubicaciones_solicitadas')) { db.location = { municipio: params[1], localidad: params[2], direccion: params[3], referencias: params[4] }; return rows([]) }
    if (sql.startsWith('INSERT INTO public.movimientos_expediente')) { db.movements.push([...params]); return rows([]) }
    if (sql.includes('FROM public.expedientes WHERE id=$1') && sql.endsWith('FOR UPDATE')) return rows(db.file ? [db.file] : [])
    if (sql.includes('FROM public.visitas_iniciales WHERE expediente_id=$1')) return rows(db.visit ? [db.visit] : [])
    if (sql.includes('FROM public.usuarios_locales')) return rows(sql.includes('WHERE id=$1') && params[0] !== topoId ? [] : [{ id: topoId, nombre: 'Topógrafo de prueba' }])
    if (sql.startsWith('INSERT INTO public.visitas_iniciales')) {
      if (['asignado', 'visitado'].includes(params[1])) {
        // PostgreSQL checks the INSERT row before ON CONFLICT updates it.
        assert.equal(params[2], topoId); assert.ok(params[3])
      }
      db.visit = { expediente_id: params[0], estado: params[1], responsable_id: params[2], fecha_compromiso: params[3], fecha_visita: params[4], superficie_m2: params[5], observaciones: params[6] }
      return rows([])
    }
    if (sql.startsWith('UPDATE public.expedientes')) { Object.assign(db.file, { estado: params[1], etapa_actual: params[2], area_responsable: params[3] }); return rows([]) }
    if (sql.startsWith('SELECT coalesce(max(version)')) return rows([{ version: db.files.length + 1 }])
    if (sql.startsWith('INSERT INTO public.archivos_visita_inicial')) {
      const file = { id: params[0], expediente_id: params[1], version: params[2], nombre_archivo: params[3], mime_type: params[4], bytes: params[5], sha256: params[6], subido_por: params[7] }
      db.files.push(file); return rows([file])
    }
    if (sql.includes('FROM public.archivos_visita_inicial')) return rows(params.length > 1 ? db.files.filter(file => file.id === params[1]) : db.files)
    if (sql.includes('JOIN public.ubicaciones_solicitadas')) {
      const isDetail = sql.includes('WHERE e.id=$1')
      assert.match(sql, /v\.responsable_id=\$[23]/)
      const role = params[isDetail ? 1 : 0], userId = params[isDetail ? 2 : 1]
      let visible = Boolean(db.file) && (role !== 'topografia' || db.visit?.responsable_id === userId)
      if (!isDetail) {
        visible &&= !['cerrado', 'entregado', 'no_procede'].includes(db.file.estado)
        if (role === 'direccion') visible &&= db.visit?.estado === 'revision_direccion'
        if (role === 'jefatura') visible &&= db.visit?.estado === 'revision_jefatura'
        if (role === 'cartografia') visible &&= ['solicitado', 'asignado', 'visitado'].includes(db.visit?.estado)
      }
      return rows(visible ? [{ ...db.file, ...db.location, ...db.visit, estado: db.file.estado, estado_visita: db.visit?.estado || null, solicitante: db.person.params[0] }] : [])
    }
    unexpected.push(sql)
    throw new Error(`Unexpected SQL: ${sql}`)
  }
  const pool = { query, async connect() { active++; return { query, release() { active-- } } } }
  const storage = { mkdir: async () => {}, writeFile: async (target, data) => { assert.ok(!bytes.has(target)); bytes.set(target, Buffer.from(data)) }, readFile: async target => bytes.get(target), unlink: async target => bytes.delete(target) }
  vm.runInNewContext(source, {
    localPermissions, createUserManager, createInitialReception: options => createInitialReception({ ...options, storage }),
    ...crypto, scryptCallback: crypto.scrypt, promisify, URL, Buffer, path,
    Pool: function () { return pool }, http: { createServer(fn) { handler = fn; return { listen() {}, close() {} } } },
    process: { env: {}, on() {} }, console: { log() {}, error() {} },
  })
  async function request(role, url = base, body, { id = topoId, multipart = false, method = body === undefined ? 'GET' : 'POST', type } = {}) {
    actor = role ? { id, rol: role, correo: `${role}@example.test` } : null
    const content = body === undefined ? Buffer.alloc(0) : multipart ? body : Buffer.from(JSON.stringify(body))
    const result = {}
    await handler({ url, method, headers: { cookie: actor ? `sigep_session=${'a'.repeat(64)}` : '',
      'content-type': type || (multipart ? 'multipart/form-data; boundary=intake-test' : 'application/json'), 'content-length': String(content.length) },
    async *[Symbol.asyncIterator]() { if (content.length) yield content } }, {
      writeHead(status, headers) { result.status = status; result.headers = headers },
      end(data) { result.body = Buffer.isBuffer(data) ? data : JSON.parse(data) },
    })
    assert.equal(active, 0, 'Transaction client must be released')
    assert.deepEqual(unexpected, [])
    return result
  }
  return { request, calls, bytes, get db() { return db }, fail(value) { failure = value } }
}

async function reachAssigned(h) {
  assert.equal((await h.request('ventanilla', base, intake)).status, 201)
  for (const [role, accion, extra] of [
    ['ventanilla', 'solicitar'], ['direccion', 'enviar_fundos'], ['jefatura', 'enviar_cartografia'],
    ['cartografia', 'asignar', { responsable_id: topoId, fecha_compromiso: today }],
  ]) assert.equal((await h.request(role, `${base}/12/visita`, { accion, ...extra })).status, 200, accion)
}
const visit = { accion: 'registrar_visita', fecha_visita: today, superficie_m2: '150.25', observaciones: 'Terreno localizado y medido en compañía del solicitante.', actor: 'actor-falso' }
const pdf = Buffer.from('--intake-test\r\nContent-Disposition: form-data; name="archivo"; filename="visita.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7\nPrueba\r\n--intake-test--\r\n')

test('Reception saves separated names and location without parcel, cadastral key, street or documents', async () => {
  const h = harness()
  const result = await h.request('ventanilla', base, intake)
  assert.equal(result.status, 201)
  assert.equal(result.body.folio, 'FL-2026-000012')
  assert.deepEqual(h.db.person.params.slice(0, 4), ['María del Carmen López Hernández', 'María del Carmen', 'López', 'Hernández'])
  assert.equal(h.db.location.direccion, null)
  assert.equal(h.db.location.referencias, intake.ubicacion.referencias)
  assert.equal(h.db.movements[0].at(-1), 'ventanilla@example.test')
  assert.ok(!h.calls.some(({ sql }) => /\bpredios\b|expediente_predios/.test(sql)))
  assert.equal(h.calls.at(-1).sql, 'COMMIT')
})

test('Reception requires useful location data, rejects invalid types, allows one surname', async () => {
  for (const body of [null, {}, { ...intake, solicitante: { nombres: ' ' } }, { ...intake, ubicacion: { ...intake.ubicacion, referencias: ' ' } }, { ...intake, ubicacion: { ...intake.ubicacion, municipio: 123 } }]) {
    const h = harness()
    assert.equal((await h.request('ventanilla', base, body)).status, 400)
    assert.ok(!h.calls.some(({ sql }) => sql === 'BEGIN'))
  }
  const h = harness()
  assert.equal((await h.request('ventanilla', base, { ...intake, solicitante: { nombres: 'Ana', primer_apellido: 'López' } })).status, 201)
  assert.equal(h.db.person.params[3], null)
})

test('Router rejects anonymous access, disallowed creator roles and non-JSON writes', async () => {
  const h = harness()
  assert.equal((await h.request(null)).status, 401)
  assert.equal((await h.request('ventanilla', base, intake, { type: 'text/plain' })).status, 415)
  for (const role of Object.keys(roles).filter(role => !['admin', 'ventanilla', 'captura'].includes(role))) {
    assert.equal((await h.request(role, base, intake)).status, 403, role)
  }
  for (const role of ['admin', 'captura']) assert.equal((await h.request(role, base, intake)).status, 201, role)
})

test('Location or audit failure rolls back the person and case together', async () => {
  for (const fragment of ['INSERT INTO public.ubicaciones_solicitadas', 'INSERT INTO public.movimientos_expediente']) {
    const h = harness(); h.fail(fragment)
    assert.equal((await h.request('ventanilla', base, intake)).status, 500)
    assert.equal(h.db.file, null); assert.equal(h.db.person, null)
    assert.equal(h.calls.at(-1).sql, 'ROLLBACK')
  }
})

test('Initial request follows Dirección, Jefatura, Cartografía and assigned Topografía, with history and evidence', async () => {
  const h = harness()
  await reachAssigned(h)
  assert.equal(h.db.file.area_responsable, 'Topografía')
  assert.equal((await h.request('topografia')).body.solicitudes.length, 1)
  assert.equal((await h.request('topografia', base, undefined, { id: otherId })).body.solicitudes.length, 0)
  assert.equal((await h.request('topografia', `${base}/12`, undefined, { id: otherId })).status, 404)
  assert.equal((await h.request('topografia', `${base}/12/visita`, visit, { id: otherId })).status, 403)
  assert.equal((await h.request('topografia', `${base}/12/evidencia`, pdf, { multipart: true })).status, 409)
  assert.equal((await h.request('topografia', `${base}/12/visita`, visit)).status, 200)
  assert.equal(h.db.visit.superficie_m2, 150.25)
  assert.equal(h.db.visit.responsable_id, topoId)
  assert.equal(h.db.file.area_responsable, 'Cartografía y Valuación')
  assert.equal(h.db.file.etapa_actual, 'revision_cartografica')
  assert.equal(h.db.movements.at(-1)[1], 'medicion_asignado')
  assert.equal(h.db.movements.at(-1)[2], 'revision_cartografica')
  assert.deepEqual(h.db.movements.map(row => row.at(-1)), ['ventanilla', 'ventanilla', 'direccion', 'jefatura', 'cartografia', 'topografia'].map(role => `${role}@example.test`))
  const uploaded = await h.request('topografia', `${base}/12/evidencia`, pdf, { multipart: true })
  assert.equal(uploaded.status, 201)
  assert.equal(uploaded.body.archivo.version, 1)
  const link = `${base}/12/archivos/${uploaded.body.archivo.id}`
  assert.equal((await h.request('topografia', link, undefined, { id: otherId })).status, 404)
  const downloaded = await h.request('cartografia', link)
  assert.equal(downloaded.status, 200)
  assert.match(downloaded.body.toString(), /^%PDF-1.7/)
  assert.equal(downloaded.headers['Cache-Control'], 'private, no-store')
  assert.equal((await h.request('cartografia', `${base}/12`)).body.archivos.length, 1)
})

test('Workflow blocks skipping areas, repeating actions and acting with the wrong role', async () => {
  const h = harness()
  await h.request('ventanilla', base, intake)
  assert.equal((await h.request('direccion', `${base}/12/visita`, { accion: 'enviar_fundos' })).status, 409)
  assert.equal((await h.request('viewer', `${base}/12/visita`, { accion: 'solicitar' })).status, 403)
  assert.equal((await h.request('ventanilla', `${base}/12/visita`, { accion: 'solicitar' })).status, 200)
  assert.equal((await h.request('ventanilla', `${base}/12/visita`, { accion: 'solicitar' })).status, 409)
  assert.equal((await h.request('jefatura')).body.solicitudes.length, 0)
  assert.equal((await h.request('direccion')).body.solicitudes.length, 1)
  assert.equal(h.db.visit.estado, 'revision_direccion')
})

test('Visit validation and audit rollback preserve assignment; closed cases cannot be edited', async () => {
  const h = harness(); await reachAssigned(h)
  for (const invalid of [{ ...visit, superficie_m2: true }, { ...visit, superficie_m2: 0 }, { ...visit, fecha_visita: '2099-01-01' }, { ...visit, fecha_visita: [today] }, { ...visit, observaciones: '' }]) {
    assert.equal((await h.request('topografia', `${base}/12/visita`, invalid)).status, 400)
  }
  h.fail('INSERT INTO public.movimientos_expediente')
  assert.equal((await h.request('topografia', `${base}/12/visita`, visit)).status, 500)
  assert.equal(h.db.visit.estado, 'asignado'); assert.equal(h.db.file.area_responsable, 'Topografía')
  h.fail(''); h.db.file.estado = 'cerrado'
  assert.equal((await h.request('topografia', `${base}/12/visita`, visit)).status, 409)
})

test('Failed evidence audit removes private bytes, rolls back metadata and preserves version sequence', async () => {
  const h = harness(); await reachAssigned(h)
  await h.request('topografia', `${base}/12/visita`, visit)
  assert.equal((await h.request('cartografia', `${base}/12/evidencia`, pdf, { multipart: true })).status, 403)
  assert.equal((await h.request('topografia', `${base}/12/evidencia`, pdf, { multipart: true, id: otherId })).status, 403)
  h.fail('INSERT INTO public.movimientos_expediente')
  assert.equal((await h.request('topografia', `${base}/12/evidencia`, pdf, { multipart: true })).status, 500)
  assert.equal(h.db.files.length, 0); assert.equal(h.bytes.size, 0)
  h.fail('')
  for (const version of [1, 2]) assert.equal((await h.request('topografia', `${base}/12/evidencia`, pdf, { multipart: true })).body.archivo.version, version)
})

test('Vite forwards initial reception routes and blocks cross-origin or malformed writes', () => {
  const [pattern, proxy] = Object.entries(config.server.proxy).find(([key]) => key.includes('solicitudes-titulacion'))
  const prefix = '/api/sigep/solicitudes-titulacion'
  for (const suffix of ['', '/12', '/12/visita', '/12/evidencia', `/12/archivos/${topoId}`]) assert.ok(new RegExp(pattern).test(prefix + suffix))
  const headers = { origin: 'http://localhost:5173', host: 'localhost:5173', 'content-type': 'application/json' }
  assert.equal(proxy.bypass({ method: 'POST', url: prefix, headers }), undefined)
  assert.equal(proxy.bypass({ method: 'POST', url: prefix + '/12/visita', headers }), undefined)
  assert.equal(proxy.bypass({ method: 'POST', url: prefix + '/12/evidencia', headers: { ...headers, 'content-type': 'multipart/form-data; boundary=test' } }), undefined)
  assert.equal(proxy.bypass({ method: 'POST', url: prefix, headers: { ...headers, origin: 'http://foreign.test' } }), false)
  assert.equal(proxy.bypass({ method: 'POST', url: prefix + '/12/evidencia', headers }), false)
  assert.equal(proxy.bypass({ method: 'DELETE', url: prefix, headers }), false)
  assert.equal(proxy.rewrite(prefix), base)
})
