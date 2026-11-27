import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs/promises'

export const requiredSchema = {
  predios: ['id', 'clave_catastral', 'geom', 'superficie', 'estado_medicion'],
  solicitantes: ['id', 'nombre', 'nombres', 'primer_apellido', 'segundo_apellido'],
  expedientes: ['id', 'folio', 'tipo_tramite', 'estado', 'etapa_actual', 'area_responsable', 'recepcion_inicial'],
  expediente_predios: ['expediente_id', 'predio_id'],
  movimientos_expediente: ['id', 'expediente_id', 'actor', 'created_at'],
  usuarios_locales: ['id', 'rol', 'activo', 'password_hash'],
  sesiones_locales: ['token_hash', 'usuario_id', 'vence_en'],
  ubicaciones_solicitadas: ['expediente_id', 'municipio', 'localidad', 'direccion', 'referencias'],
  visitas_iniciales: ['expediente_id', 'estado', 'responsable_id', 'fecha_visita', 'superficie_m2'],
  archivos_visita_inicial: ['id', 'expediente_id', 'version', 'sha256'],
  mediciones_expediente: ['expediente_id', 'predio_id', 'estado', 'responsable_id', 'asignado_en'],
  archivos_expediente: ['id', 'expediente_id', 'requisito', 'estado_revision', 'revisado_por', 'motivo_revision'],
  requisitos_documentales: ['tipo_tramite', 'nombre', 'activo'],
  datos_catastrales_expediente: ['expediente_id', 'predio_id', 'propietarios', 'estado_revision'],
  pagos_expediente: ['expediente_id', 'concepto', 'recibo', 'importe', 'evidencia'],
}

// Read-only SQL. The only write is a uniquely named probe in the private volume,
// removed after the read check. No business records or credentials are printed.
export async function checkInstallation({ pool, storageDirectory, storage = fs }) {
  const checks = []
  const record = (nombre, ok, detalle = '') => checks.push({ nombre, ok, detalle })
  try {
    const { rows: columns } = await pool.query(`SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY($1::text[])`, [Object.keys(requiredSchema)])
    const available = new Set(columns.map(row => `${row.table_name}.${row.column_name}`))
    for (const [table, names] of Object.entries(requiredSchema)) {
      const missing = names.filter(name => !available.has(`${table}.${name}`))
      record(`Esquema ${table}`, !missing.length, missing.length ? `Faltan: ${missing.join(', ')}` : '')
    }
    const { rows: extensions } = await pool.query("SELECT extname FROM pg_extension WHERE extname='postgis'")
    record('Extensión PostGIS', extensions.length > 0)
    for (const table of Object.keys(requiredSchema).filter(table => available.has(`${table}.${requiredSchema[table][0]}`))) {
      for (const permission of ['SELECT', 'INSERT']) {
        const { rows: [result] } = await pool.query('SELECT has_table_privilege(current_user,$1,$2) AS permitido', [`public.${table}`, permission])
        record(`${permission} ${table}`, result?.permitido === true)
      }
    }
    for (const [table, column] of [['expedientes', 'estado'], ['predios', 'geom'], ['archivos_expediente', 'estado_revision'], ['datos_catastrales_expediente', 'propietarios'], ['visitas_iniciales', 'estado'], ['mediciones_expediente', 'estado']]) {
      if (!available.has(`${table}.${column}`)) { record(`UPDATE ${table}.${column}`, false, 'Columna ausente'); continue }
      const { rows: [result] } = await pool.query('SELECT has_column_privilege(current_user,$1,$2,\'UPDATE\') AS permitido', [`public.${table}`, column])
      record(`UPDATE ${table}.${column}`, result?.permitido === true)
    }
    const sequences = []
    for (const table of ['predios', 'solicitantes', 'expedientes', 'movimientos_expediente']) {
      if (!available.has(`${table}.id`)) continue
      const { rows: [row] } = await pool.query("SELECT pg_get_serial_sequence($1,'id') AS secuencia", [`public.${table}`])
      if (row?.secuencia) sequences.push(row.secuencia)
    }
    const { rows: [folioSequence] } = await pool.query("SELECT to_regclass('public.expedientes_folio_seq')::text AS secuencia")
    record('Secuencia de folios', Boolean(folioSequence?.secuencia))
    if (folioSequence?.secuencia) sequences.push(folioSequence.secuencia)
    for (const sequence of sequences) {
      const { rows: [row] } = await pool.query("SELECT has_sequence_privilege(current_user,$1,'USAGE') AS permitido", [sequence])
      record(`USAGE ${sequence}`, row?.permitido === true)
    }
    const { rows: constraints } = await pool.query(`SELECT convalidated FROM pg_constraint
      WHERE conrelid=to_regclass('public.archivos_expediente') AND conname='archivos_expediente_expediente_fk'`)
    record('Integridad de documentos generales', constraints[0]?.convalidated === true, constraints[0]?.convalidated ? '' : 'Requiere enable_document_integrity.sql')
    if (available.has('usuarios_locales.activo')) {
      const { rows: [result] } = await pool.query("SELECT count(*)::integer AS total FROM public.usuarios_locales WHERE activo AND rol='admin'")
      record('Cuenta administrativa activa', result?.total > 0)
    }
  } catch (error) {
    record('Comprobación de base de datos', false, `Código: ${error.code || 'ERROR'}`)
  }
  const probe = path.join(path.resolve(storageDirectory), `.sigep-check-${randomUUID()}`)
  let created = false
  try {
    const content = Buffer.from('SIGEP installation probe\n')
    await storage.writeFile(probe, content, { flag: 'wx', mode: 0o600 }); created = true
    const read = await storage.readFile(probe)
    record('Lectura y escritura del volumen privado', Buffer.from(read).equals(content))
  } catch (error) {
    record('Lectura y escritura del volumen privado', false, `Código: ${error.code || 'ERROR'}`)
  } finally {
    if (created) {
      try { await storage.unlink(probe) }
      catch (error) { record('Limpieza de archivo de comprobación', false, `Código: ${error.code || 'ERROR'}`) }
    }
  }
  return { ok: checks.every(check => check.ok), checks }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  let pool
  try {
    const { Pool } = await import('pg')
    pool = new Pool({ host: process.env.DB_HOST || 'sigep-postgis', port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'sigep', user: process.env.DB_USER || 'sigep_editor', password: process.env.DB_PASSWORD,
      max: 1, connectionTimeoutMillis: 5000, statement_timeout: 10000 })
    const result = await checkInstallation({ pool,
      storageDirectory: process.env.SIGEP_PRIVATE_STORAGE_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'private-files') })
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exitCode = 1
  } catch (error) { console.error(`No se pudo comprobar la instalación. Código: ${error.code || 'ERROR'}`); process.exitCode = 1 }
  finally { await pool?.end() }
}
