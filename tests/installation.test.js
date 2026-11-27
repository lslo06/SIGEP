import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import * as fs from 'node:fs/promises'
import { checkInstallation, requiredSchema } from '../api/check-installation.mjs'

function database({ missing, denied, failure } = {}) {
  return { async query(sql, params = []) {
    assert.match(sql.trim(), /^SELECT/, 'The installation check must not write business data')
    if (failure) throw Object.assign(new Error('PRIVATE CONNECTION STRING MUST NOT BE PRINTED'), { code: 'ECONNREFUSED' })
    if (sql.includes('information_schema.columns')) return { rows: Object.entries(requiredSchema).flatMap(([table_name, columns]) =>
      columns.filter(column => `${table_name}.${column}` !== missing).map(column_name => ({ table_name, column_name }))) }
    if (sql.includes('pg_extension')) return { rows: [{ extname: 'postgis' }] }
    if (sql.includes('has_')) return { rows: [{ permitido: params[0] !== denied }] }
    if (sql.includes('pg_get_serial_sequence')) return { rows: [{ secuencia: `${params[0]}_id_seq` }] }
    if (sql.includes('expedientes_folio_seq')) return { rows: [{ secuencia: 'public.expedientes_folio_seq' }] }
    if (sql.includes('pg_constraint')) return { rows: [{ convalidated: true }] }
    if (sql.includes('count(*)')) return { rows: [{ total: 1 }] }
    throw new Error('Unexpected installation query: ' + sql)
  } }
}

test('Installation preflight reads schema/permissions and writes, reads and cleans a real temporary probe', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sigep-check-'))
  try {
    const result = await checkInstallation({ pool: database(), storageDirectory: directory })
    assert.equal(result.ok, true, JSON.stringify(result.checks.filter(check => !check.ok)))
    assert.deepEqual(await fs.readdir(directory), [])
  } finally { await fs.rmdir(directory) }
})

test('Installation preflight reports missing migrations and privileges without exposing credentials', async () => {
  const storage = { writeFile: async () => {}, readFile: async () => Buffer.from('SIGEP installation probe\n'), unlink: async () => {} }
  const result = await checkInstallation({ pool: database({ missing: 'expedientes.recepcion_inicial', denied: 'public.visitas_iniciales' }), storageDirectory: os.tmpdir(), storage })
  assert.equal(result.ok, false)
  assert.ok(result.checks.some(check => check.nombre === 'Esquema expedientes' && !check.ok))
  assert.ok(result.checks.some(check => check.nombre === 'INSERT visitas_iniciales' && !check.ok))
  const refused = await checkInstallation({ pool: database({ failure: true }), storageDirectory: os.tmpdir(), storage })
  assert.equal(refused.ok, false)
  assert.doesNotMatch(JSON.stringify(refused), /PRIVATE CONNECTION/)
  assert.match(JSON.stringify(refused), /ECONNREFUSED/)
})

test('Installation preflight reports private-volume permission and cleanup failures', async () => {
  let removed = false
  const storage = {
    writeFile: async () => { throw Object.assign(new Error('private path'), { code: 'EACCES' }) },
    unlink: async () => { removed = true },
  }
  const result = await checkInstallation({ pool: database(), storageDirectory: os.tmpdir(), storage })
  assert.equal(result.ok, false); assert.equal(removed, false)
  assert.match(JSON.stringify(result), /EACCES/)
  const cleanup = await checkInstallation({ pool: database(), storageDirectory: os.tmpdir(), storage: {
    writeFile: async () => {}, readFile: async () => Buffer.from('SIGEP installation probe\n'),
    unlink: async () => { throw Object.assign(new Error('private path'), { code: 'EACCES' }) },
  } })
  assert.equal(cleanup.ok, false)
  assert.ok(cleanup.checks.some(check => check.nombre === 'Limpieza de archivo de comprobación' && !check.ok))
})
