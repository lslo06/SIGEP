import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { promisify } from 'node:util'
import * as crypto from 'node:crypto'
import { localPermissions } from '../api/permissions.mjs'
import { createUserManager } from '../api/users.mjs'
import { createInitialReception } from '../api/initial-reception.mjs'
import { canReadAttachment, canUploadAttachment, readAttachmentUpload } from '../api/attachments.mjs'

// Runs the real HTTP handlers, password hashing, permissions and multipart parser.
// SQL responses and private file storage are simulated: this is NOT PostgreSQL/browser E2E.
const source = readFileSync(new URL('../api/server.mjs', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace("path.join(path.dirname(fileURLToPath(import.meta.url)), 'private-files')", "path.join('tests', 'private-files-simulated')")
const password = 'solo-pruebas-123'
const salt = 'test-flow-salt'
const hash = `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date())
const identities = ['ventanilla', 'cartografia', 'topografia', 'otro_topografo', 'digitalizacion', 'titulacion', 'caja']
const users = Object.fromEntries(identities.map((key, index) => [key, {
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  nombre: `Prueba ${key}`, correo: `${key}@example.test`,
  rol: key === 'otro_topografo' ? 'topografia' : key, password_hash: hash,
}]))
const parcel = { id: 1, clave_catastral: 'PRUEBA-001', superficie: '120.00' }
const file = { id: 12, folio: 'FL-2026-000012', tipo_tramite: 'titulacion', estado: 'recibido', etapa_actual: 'recepcion', area_responsable: 'Ventanilla' }
const measurementPath = '/api/expedientes/12/predios/1/medicion'
const attachmentPath = '/api/expedientes/12/predios/1'
const documentPath = '/api/expedientes/12/documentos'
const q = (pattern, rows = [], params) => ({ pattern, rows, params })
const transaction = steps => [q(/^BEGIN$/), ...steps, q(/^COMMIT$/)]
const context = () => q(/FROM public\.expedientes e JOIN public\.expediente_predios/, [file], ['12', '1'])
const currentMeasurement = row => q(/SELECT estado, responsable_id FROM public\.mediciones_expediente/, row ? [row] : [], ['12', '1'])
const movement = actor => q(/INSERT INTO public\.movimientos_expediente/, [], args => assert.equal(args.at(-1), users[actor].correo))

function harness() {
  let handler, scheduled = [], dbErrors = [], activeClients = 0
  const sessions = new Map(), cookies = new Map(), storage = new Map()
  async function query(raw, args = []) {
    const sql = raw.replace(/\s+/g, ' ').trim()
    if (sql.includes('FROM public.sesiones_locales s')) {
      const user = sessions.get(args[0])
      return { rows: user ? [user] : [] }
    }
    if (sql.startsWith('SELECT id, nombre, correo, rol, password_hash')) {
      return { rows: Object.values(users).filter(user => user.correo === args[0]) }
    }
    if (sql.startsWith('INSERT INTO public.sesiones_locales')) {
      const user = Object.values(users).find(user => user.id === args[1] && user.password_hash === args[2])
      if (user) sessions.set(args[0], user)
      return { rows: user ? [{ usuario_id: user.id }] : [], rowCount: user ? 1 : 0 }
    }
    if (sql.startsWith('DELETE FROM public.sesiones_locales')) {
      sessions.delete(args[0]); return { rows: [] }
    }
    try {
      const next = scheduled.shift()
      assert.ok(next, `Unexpected SQL: ${sql}`)
      assert.match(sql, next.pattern)
      if (typeof next.params === 'function') next.params(args)
      else if (next.params) assert.deepEqual(Array.from(args), next.params)
      return { rows: next.rows, rowCount: next.rows.length }
    } catch (error) {
      dbErrors.push(error)
      throw error
    }
  }
  const pool = { query, async connect() {
    activeClients++
    return { query, release() { activeClients-- } }
  } }
  vm.runInNewContext(source, {
    localPermissions, createUserManager, createInitialReception, canReadAttachment, canUploadAttachment, readAttachmentUpload,
    ...crypto, scryptCallback: crypto.scrypt, promisify, URL, Buffer, path,
    Pool: function () { return pool },
    http: { createServer(callback) { handler = callback; return { listen() {}, close() {} } } },
    process: { env: {}, on() {} }, console: { log() {}, error() {} },
    mkdir: async () => {},
    writeFile: async (target, bytes) => { assert.equal(storage.has(target), false); storage.set(target, Buffer.from(bytes)) },
    readFile: async target => { assert.ok(storage.has(target)); return storage.get(target) },
    unlink: async target => { storage.delete(target) },
  })
  async function request(actor, url, { method = 'GET', body, multipart = false, steps = [] } = {}) {
    scheduled = [...steps]; dbErrors = []
    const bytes = multipart ? body : body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body))
    const result = { headers: {} }
    await handler({ url, method, socket: { remoteAddress: 'test' }, headers: {
      cookie: cookies.get(actor) || '',
      'content-type': multipart ? 'multipart/form-data; boundary=flow-test' : 'application/json',
      'content-length': String(bytes.length),
    }, async *[Symbol.asyncIterator]() { if (bytes.length) yield bytes } }, {
      setHeader(name, value) { result.headers[name] = value },
      writeHead(status, headers = {}) { result.status = status; Object.assign(result.headers, headers) },
      end(value) { result.body = Buffer.isBuffer(value) ? value : JSON.parse(value) },
    })
    assert.equal(dbErrors.length, 0, dbErrors.map(error => error.message).join('\n'))
    assert.equal(scheduled.length, 0, 'The handler did not execute all expected queries')
    assert.equal(activeClients, 0, 'A transaction client was not released')
    return result
  }
  async function login(actor) {
    const result = await request(actor, '/api/sesion/entrar', { method: 'POST', body: { correo: users[actor].correo, password } })
    assert.equal(result.status, 200)
    assert.match(result.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/)
    cookies.set(actor, result.headers['Set-Cookie'].split(';')[0])
    return result
  }
  return { request, login }
}

function uploadBytes(filename) {
  return Buffer.from(`--flow-test\r\nContent-Disposition: form-data; name="archivo"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7\nfixture ${filename}\r\n--flow-test--\r\n`)
}

function measurementSteps(previous, saved, actor) {
  return transaction([
    q(/SELECT pg_advisory_xact_lock/), context(), currentMeasurement(previous),
    ...(saved.estado === 'asignado' ? [q(/SELECT nombre FROM public\.usuarios_locales/, [{ nombre: users.topografia.nombre }], [users.topografia.id])] : []),
    q(/INSERT INTO public\.mediciones_expediente/, [saved], args => {
      assert.equal(args[2], saved.estado)
      if (saved.estado === 'asignado') assert.equal(args[9], users.topografia.id)
      if (saved.estado === 'visitado') assert.equal(args[6], saved.superficie_m2)
    }), movement(actor),
  ])
}

test('Login rejects a wrong password and logout revokes the issued session', async () => {
  const h = harness()
  assert.equal((await h.request('ventanilla', '/api/expedientes')).status, 401)
  assert.equal((await h.request('ventanilla', '/api/sesion/entrar', { method: 'POST', body: { correo: users.ventanilla.correo, password: 'incorrecta' } })).status, 401)
  await h.login('ventanilla')
  const session = await h.request('ventanilla', '/api/sesion')
  assert.equal(session.body.usuario.rol, 'ventanilla')
  assert.equal((await h.request('ventanilla', '/api/sesion/salir', { method: 'POST', body: {} })).status, 200)
  assert.equal((await h.request('ventanilla', '/api/sesion')).status, 401)
})

test('Legacy map route requires a parcel; new reception uses solicitudes-titulacion', async () => {
  const h = harness()
  await h.login('ventanilla')
  const result = await h.request('ventanilla', '/api/expedientes', { method: 'POST', body: {
    tipo_tramite: 'titulacion', solicitante: { nombre: 'María del Carmen López Hernández' }, predio_ids: [],
  } })
  assert.equal(result.status, 400)
  assert.match(result.body.error, /Selecciona de uno a veinte predios/)
})

test('Legacy map route keeps its full-name contract', async () => {
  const h = harness()
  await h.login('ventanilla')
  const result = await h.request('ventanilla', '/api/expedientes', { method: 'POST', body: {
    tipo_tramite: 'titulacion', predio_ids: [1],
    solicitante: { nombres: 'María del Carmen', primer_apellido: 'López', segundo_apellido: 'Hernández' },
  } })
  assert.equal(result.status, 400)
  assert.match(result.body.error, /nombre del solicitante es obligatorio/)
})

test('Existing-parcel flow: intake, assignment, visit, attachments and payment through real handlers', async t => {
  const h = harness()
  for (const actor of ['ventanilla', 'cartografia', 'topografia', 'otro_topografo', 'caja']) await h.login(actor)
  const requested = { expediente_id: 12, predio_id: 1, estado: 'solicitado', responsable_id: null }
  const assigned = { ...requested, estado: 'asignado', responsable_id: users.topografia.id, fecha_compromiso: today }
  const visited = { ...assigned, estado: 'visitado', fecha_visita: today, superficie_m2: 125 }

  await t.test('Ventanilla creates the case and audit records its authenticated actor', async () => {
    const result = await h.request('ventanilla', '/api/expedientes', { method: 'POST', body: {
      tipo_tramite: 'titulacion', predio_ids: [1], solicitante: { nombre: 'María del Carmen López Hernández' }, actor: 'suplantado',
    }, steps: transaction([
      q(/FROM predios WHERE/, [parcel]), q(/SELECT EXTRACT/, [{ year: 2026, number: 12 }]),
      q(/INSERT INTO solicitantes/, [{ id: 20 }], args => assert.equal(args[0], 'María del Carmen López Hernández')),
      q(/INSERT INTO expedientes/, [file]), q(/INSERT INTO expediente_predios/, [], [12, 1]),
      q(/INSERT INTO movimientos_expediente/, [], args => assert.equal(args.at(-1), users.ventanilla.correo)),
    ]) })
    assert.equal(result.status, 201)
    assert.equal(result.body.folio, file.folio)
  })

  await t.test('Ventanilla requests measurement; Cartography assigns an active topographer', async () => {
    const requestedResponse = await h.request('ventanilla', measurementPath, { method: 'POST', body: { accion: 'solicitado' }, steps: measurementSteps(null, requested, 'ventanilla') })
    assert.equal(requestedResponse.status, 200)
    const assignedResponse = await h.request('cartografia', measurementPath, { method: 'POST', body: {
      accion: 'asignado', responsable_id: users.topografia.id, fecha_compromiso: today,
    }, steps: measurementSteps(requested, assigned, 'cartografia') })
    assert.equal(assignedResponse.body.medicion.responsable_id, users.topografia.id)
  })

  await t.test('Field queue includes registered area and scopes requests to the logged-in topographer', async () => {
    const result = await h.request('topografia', '/api/campo', { steps: [
      q(/SELECT m\.expediente_id.*p\.superficie.*m\.responsable_id = \$2/, [{ ...assigned, superficie: parcel.superficie }], ['topografia', users.topografia.id]),
    ] })
    assert.equal(result.status, 200)
    assert.equal(result.body.mediciones[0].superficie, '120.00')
  })

  await t.test('A different topographer cannot register the visit', async () => {
    const result = await h.request('otro_topografo', measurementPath, { method: 'POST', body: {
      accion: 'visitado', fecha_visita: today, superficie_m2: 125, observaciones: 'Levantamiento', referencia_evidencia: 'Fotos',
    }, steps: [q(/^BEGIN$/), q(/SELECT pg_advisory_xact_lock/), context(), currentMeasurement(assigned), q(/^ROLLBACK$/)] })
    assert.equal(result.status, 403)
  })

  await t.test('Evidence is blocked until the assigned visit is recorded', async () => {
    const result = await h.request('topografia', `${attachmentPath}/evidencia-visita`, { method: 'POST', multipart: true, body: uploadBytes('evidencia.pdf'),
      steps: [q(/^BEGIN$/), context(), currentMeasurement(assigned), q(/^ROLLBACK$/)] })
    assert.equal(result.status, 409)
  })

  await t.test('The assigned topographer records the measurement and actor history', async () => {
    const result = await h.request('topografia', measurementPath, { method: 'POST', body: {
      accion: 'visitado', fecha_visita: today, superficie_m2: 125, observaciones: 'Diferencia de 5 m² respecto al registro', referencia_evidencia: 'Informe y fotografías',
    }, steps: measurementSteps(assigned, visited, 'topografia') })
    assert.equal(result.status, 200)
    assert.equal(result.body.medicion.superficie_m2, 125)
  })

  for (const [actor, route, type] of [['topografia', 'evidencia-visita', 'evidencia_visita'], ['cartografia', 'plano', 'plano']]) {
    await t.test(`${actor} uploads and downloads ${route} after the visit`, async () => {
      let attachment
      const metadata = { tipo: type, version: 1, nombre_archivo: `${route}.pdf`, mime_type: 'application/pdf', bytes: 40 }
      const result = await h.request(actor, `${attachmentPath}/${route}`, { method: 'POST', multipart: true, body: uploadBytes(metadata.nombre_archivo), steps: transaction([
        context(), currentMeasurement(visited), q(/SELECT COALESCE\(MAX\(version\)/, [{ version: 1 }]),
        q(/INSERT INTO public\.archivos_expediente/, [metadata], args => {
          metadata.id = args[0]; metadata.bytes = args[7]; attachment = { ...metadata }
          assert.equal(args[3], type); assert.equal(args[9], users[actor].id)
          assert.match(args[8], /^[a-f0-9]{64}$/)
        }), movement(actor),
      ]) })
      assert.equal(result.status, 201)
      const download = await h.request(actor, `${attachmentPath}/archivos/${attachment.id}`, { steps: [
        context(), currentMeasurement(visited), q(/FROM public\.archivos_expediente/, [attachment]),
      ] })
      assert.equal(download.status, 200)
      assert.match(download.body.toString(), new RegExp(`fixture ${route}\\.pdf`))
    })
  }

  await t.test('Caja records payment and its audit entry in a transaction', async () => {
    const result = await h.request('caja', '/api/pagos', { method: 'POST', body: {
      folio: file.folio, concepto: 'Lote', recibo: 'PRUEBA-001', importe: 100, fecha: today, evidencia: 'Comprobante de prueba',
    }, steps: transaction([
      q(/FROM public\.expedientes.*FOR UPDATE/, [file], [file.folio]),
      q(/INSERT INTO public\.pagos_expediente/, [{ id: 1 }]), movement('caja'),
    ]) })
    assert.equal(result.status, 201)
  })
})

test('Document checklist, upload, review and accepted-only visibility through real handlers', async () => {
  const h = harness()
  for (const actor of ['ventanilla', 'digitalizacion', 'titulacion']) await h.login(actor)
  const requirements = ['Solicitud de predio', 'Constancia de posesión', 'Identificación oficial', 'Acta de nacimiento', 'Comprobante de domicilio', 'Cédula catastral', 'Otro']
  const documentContext = () => q(/SELECT id, tipo_tramite, estado FROM public\.expedientes/, [file], ['12'])
  const checklist = await h.request('ventanilla', documentPath, { steps: [
    documentContext(), q(/FROM public\.archivos_expediente d/, []),
    q(/SELECT nombre FROM public\.requisitos_documentales/, requirements.map(nombre => ({ nombre })), ['titulacion']),
  ] })
  assert.equal(checklist.status, 200)
  assert.deepEqual(checklist.body.requisitos, requirements)
  const document = { requisito: 'Identificación oficial', etapa: 'Recepción', version: 1,
    nombre_archivo: 'identificacion.pdf', mime_type: 'application/pdf', bytes: 40, estado_revision: 'pendiente' }
  const result = await h.request('ventanilla', `${documentPath}?${new URLSearchParams({ requisito: document.requisito, etapa: document.etapa })}`, {
    method: 'POST', multipart: true, body: uploadBytes(document.nombre_archivo), steps: [
      documentContext(), q(/SELECT 1 FROM public\.requisitos_documentales/, [{}]), ...transaction([
        q(/SELECT id FROM public\.expedientes.*FOR UPDATE/, [{ id: 12 }]),
        q(/SELECT COALESCE\(MAX\(version\)/, [{ version: 1 }]),
        q(/INSERT INTO public\.archivos_expediente/, [document], args => { document.id = args[0]; document.bytes = args[5]; assert.equal(args[7], users.ventanilla.id) }),
      ]),
    ],
  })
  assert.equal(result.status, 201)
  const documentUrl = `${documentPath}/${document.id}`
  const pending = await h.request('titulacion', documentUrl, { steps: [documentContext(), q(/FROM public\.archivos_expediente/, [document])] })
  assert.equal(pending.status, 403)
  const rejectedWithoutReason = await h.request('digitalizacion', `${documentUrl}/revision`, { method: 'PATCH', body: { estado_revision: 'rechazado' }, steps: [documentContext()] })
  assert.equal(rejectedWithoutReason.status, 400)
  const accepted = { ...document, estado_revision: 'aceptado' }
  const review = await h.request('digitalizacion', `${documentUrl}/revision`, { method: 'PATCH', body: { estado_revision: 'aceptado' }, steps: [
    documentContext(), q(/UPDATE public\.archivos_expediente/, [accepted], args => assert.equal(args[4], users.digitalizacion.id)),
  ] })
  assert.equal(review.status, 200)
  const download = await h.request('titulacion', documentUrl, { steps: [documentContext(), q(/FROM public\.archivos_expediente/, [accepted])] })
  assert.equal(download.status, 200)
  assert.match(download.body.toString(), /fixture identificacion\.pdf/)
})

test('Cadastral readers receive folio, values and owners without acquiring write permission', async () => {
  const h = harness()
  for (const actor of ['ventanilla', 'titulacion']) await h.login(actor)
  const data = { expediente_id: 12, predio_id: 1, cedula_folio: 'CED-PRUEBA', cedula_fecha: today,
    valor_terreno: '10000.00', valor_construccion: '0.00', valor_catastral: '10000.00',
    propietarios: [{ nombre: 'María del Carmen López Hernández' }], estado_revision: 'aceptado' }
  for (const actor of ['ventanilla', 'titulacion']) {
    const result = await h.request(actor, `${attachmentPath}/catastro`, { steps: [
      q(/SELECT 1 FROM public\.expediente_predios/, [{}], ['12', '1']),
      q(/FROM public\.datos_catastrales_expediente c/, [data], ['12', '1']),
    ] })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.datos, data)
    const denied = await h.request(actor, `${attachmentPath}/catastro`, { method: 'PUT', body: data })
    assert.equal(denied.status, 403)
  }
})
