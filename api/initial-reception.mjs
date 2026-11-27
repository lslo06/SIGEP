import { randomUUID } from 'node:crypto'
import path from 'node:path'
import * as disk from 'node:fs/promises'
import { documentReaders, initialVisitTransitions, localPermissions } from './permissions.mjs'
import { readAttachmentUpload } from './attachments.mjs'

const closed = new Set(['cerrado', 'entregado', 'no_procede'])
const error = (status, message) => Object.assign(new Error(message), { status })
const metadata = row => ({ id: row.id, version: row.version, nombre: row.nombre_archivo,
  mime_type: row.mime_type, bytes: Number(row.bytes), creado_en: row.creado_en })

export function createInitialReception({ pool, readJson, sendJson, optionalText, optionalNumber,
  isValidIsoDate, privateStorageDirectory, storage = disk }) {
  const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date())
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw error(400, `Captura ${label}.`)
    return value
  }
  function required(body, key, length, label) {
    const value = optionalText(body, key, length)
    if (!value) throw error(400, `Captura ${label}.`)
    return value
  }
  function fail(response, problem) {
    if (problem.status) return sendJson(response, problem.status, { error: problem.message })
    if (['42P01', '42703', '42501'].includes(problem.code)) {
      return sendJson(response, 503, { error: 'La recepción inicial requiere aplicar sql/enable_recepcion_inicial.sql.' })
    }
    console.error('Recepción inicial:', problem.code || problem.message)
    return sendJson(response, 500, { error: 'No se pudo procesar la solicitud inicial.' })
  }
  async function audit(client, file, user, description, destination = file) {
    await client.query(`INSERT INTO public.movimientos_expediente
      (expediente_id, etapa_origen, etapa_destino, estado, area_origen, area_destino, observaciones, actor)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [file.id, file.etapa_actual, destination.etapa_actual, destination.estado,
      file.area_responsable, destination.area_responsable, description, user.correo])
  }
  async function lockedFile(client, id) {
    const { rows: [file] } = await client.query(`SELECT id, tipo_tramite, estado, etapa_actual, area_responsable
      FROM public.expedientes WHERE id=$1 AND recepcion_inicial=true FOR UPDATE`, [id])
    if (!file) throw error(404, 'No se encontró la solicitud inicial.')
    if (closed.has(file.estado)) throw error(409, 'El expediente está cerrado.')
    return file
  }
  async function create(request, response, user) {
    if (!localPermissions(user.rol).altaExpediente) throw error(403, 'Tu rol no permite registrar solicitudes.')
    const body = object(await readJson(request), 'los datos de la solicitud')
    const person = object(body.solicitante, 'los datos del solicitante')
    const location = object(body.ubicacion, 'la ubicación del terreno')
    const names = required(person, 'nombres', 100, 'el nombre o nombres del solicitante')
    const first = optionalText(person, 'primer_apellido', 50)
    const second = optionalText(person, 'segundo_apellido', 50)
    const fullName = [names, first, second].filter(Boolean).join(' ')
    if (fullName.length > 200) throw error(400, 'El nombre completo debe tener hasta 200 caracteres.')
    const personValues = [fullName, names, first, second,
      optionalText(person, 'identificacion', 100), optionalText(person, 'telefono', 50),
      optionalText(person, 'correo', 254), optionalText(person, 'domicilio_notificacion', 500),
      optionalText(person, 'representante_nombre', 200), optionalText(person, 'representante_identificacion', 100)]
    const locationValues = [required(location, 'municipio', 150, 'el municipio del terreno'),
      required(location, 'localidad', 150, 'la localidad o colonia del terreno'),
      optionalText(location, 'direccion', 500), required(location, 'referencias', 1500, 'referencias para localizar el terreno')]
    const notes = optionalText(body, 'observaciones', 2000)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [sequence] } = await client.query("SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS year, nextval('public.expedientes_folio_seq') AS number")
      const folio = `FL-${sequence.year}-${String(sequence.number).padStart(6, '0')}`
      const { rows: [personRow] } = await client.query(`INSERT INTO public.solicitantes
        (nombre,nombres,primer_apellido,segundo_apellido,identificacion,telefono,correo,domicilio_notificacion,representante_nombre,representante_identificacion)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, personValues)
      const { rows: [file] } = await client.query(`INSERT INTO public.expedientes
        (folio,tipo_tramite,solicitante_id,observaciones,recepcion_inicial)
        VALUES ($1,'titulacion',$2,$3,true)
        RETURNING id,folio,tipo_tramite,estado,etapa_actual,area_responsable,recepcion_inicial`, [folio, personRow.id, notes])
      await client.query(`INSERT INTO public.ubicaciones_solicitadas
        (expediente_id,municipio,localidad,direccion,referencias) VALUES ($1,$2,$3,$4,$5)`, [file.id, ...locationValues])
      await audit(client, file, user, 'Recepción inicial: ubicación declarada, pendiente de identificación cartográfica.')
      await client.query('COMMIT')
      return sendJson(response, 201, file)
    } catch (problem) { await client.query('ROLLBACK').catch(() => {}); throw problem }
    finally { client.release() }
  }
  async function list(response, user) {
    const { rows } = await pool.query(`SELECT e.id,e.folio,e.estado,e.etapa_actual,e.area_responsable,
      s.nombre AS solicitante,u.municipio,u.localidad,u.direccion,u.referencias,
      v.estado AS estado_visita,v.fecha_compromiso
      FROM public.expedientes e JOIN public.ubicaciones_solicitadas u ON u.expediente_id=e.id
      JOIN public.solicitantes s ON s.id=e.solicitante_id
      LEFT JOIN public.visitas_iniciales v ON v.expediente_id=e.id
      WHERE e.estado NOT IN ('cerrado','entregado','no_procede')
        AND ($1 <> 'topografia' OR v.responsable_id=$2)
        AND ($1 <> 'direccion' OR v.estado='revision_direccion')
        AND ($1 <> 'jefatura' OR v.estado='revision_jefatura')
        AND ($1 <> 'cartografia' OR v.estado IN ('solicitado','asignado','visitado'))
      ORDER BY e.id DESC LIMIT 100`, [user.rol, user.id])
    return sendJson(response, 200, { solicitudes: rows })
  }
  async function readable(id, user) {
    const { rows: [row] } = await pool.query(`SELECT e.id,e.folio,e.estado,e.etapa_actual,e.area_responsable,
      s.nombre AS solicitante,s.nombres,s.primer_apellido,s.segundo_apellido,s.telefono,s.correo,
      u.municipio,u.localidad,u.direccion,u.referencias,
      v.estado AS estado_visita,v.responsable_id,v.fecha_compromiso,v.fecha_visita,v.superficie_m2,v.observaciones,
      r.nombre AS responsable
      FROM public.expedientes e JOIN public.ubicaciones_solicitadas u ON u.expediente_id=e.id
      JOIN public.solicitantes s ON s.id=e.solicitante_id
      LEFT JOIN public.visitas_iniciales v ON v.expediente_id=e.id
      LEFT JOIN public.usuarios_locales r ON r.id=v.responsable_id
      WHERE e.id=$1 AND ($2 <> 'topografia' OR v.responsable_id=$3)`, [id, user.rol, user.id])
    if (!row) throw error(404, 'No se encontró una solicitud disponible para tu cuenta.')
    return row
  }
  async function detail(id, response, user) {
    const row = await readable(id, user)
    const { rows: parcels } = await pool.query(`SELECT p.id,p.clave_catastral,p.superficie
      FROM public.expediente_predios ep JOIN public.predios p ON p.id=ep.predio_id
      WHERE ep.expediente_id=$1 ORDER BY p.id`, [id])
    const { rows: files } = await pool.query('SELECT id,version,nombre_archivo,mime_type,bytes,creado_en FROM public.archivos_visita_inicial WHERE expediente_id=$1 ORDER BY version DESC', [id])
    const topografos = ['admin', 'cartografia'].includes(user.rol)
      ? (await pool.query("SELECT id,nombre FROM public.usuarios_locales WHERE activo AND rol='topografia' ORDER BY nombre,id")).rows : []
    return sendJson(response, 200, { solicitud: row, predios: parcels, archivos: files.map(metadata), topografos })
  }
  async function linkParcel(request, response, id, user) {
    if (!['admin', 'cartografia'].includes(user.rol)) throw error(403, 'Solo Cartografía puede vincular el predio de la visita.')
    const body = object(await readJson(request), 'la vinculación cartográfica')
    if (!['number', 'string'].includes(typeof body.predio_id)) throw error(400, 'Selecciona un predio válido.')
    const parcelId = optionalNumber(body, 'predio_id', { integer: true, min: 1 })
    const reason = required(body, 'observaciones', 2000, 'el resultado de la identificación cartográfica')
    if (parcelId == null) throw error(400, 'Selecciona un predio válido.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const file = await lockedFile(client, id)
      const { rows: [visit] } = await client.query('SELECT * FROM public.visitas_iniciales WHERE expediente_id=$1 FOR UPDATE', [id])
      if (visit?.estado !== 'visitado' || file.etapa_actual !== 'revision_cartografica') throw error(409, 'La solicitud debe tener una visita registrada y estar en revisión cartográfica.')
      const { rowCount: linked } = await client.query('SELECT predio_id FROM public.expediente_predios WHERE expediente_id=$1', [id])
      if (linked) throw error(409, 'Esta solicitud ya tiene un predio vinculado. Actualiza la ficha.')
      const { rowCount: evidence } = await client.query('SELECT id FROM public.archivos_visita_inicial WHERE expediente_id=$1 LIMIT 1', [id])
      if (!evidence) throw error(409, 'Adjunta la evidencia de la visita antes de vincular el predio.')
      const { rows: [parcel] } = await client.query(`SELECT id,clave_catastral,superficie,
        (geom IS NOT NULL AND NOT ST_IsEmpty(geom) AND ST_IsValid(geom)
          AND GeometryType(geom) IN ('POLYGON','MULTIPOLYGON')) AS geometria_valida
        FROM public.predios WHERE id=$1 FOR UPDATE`, [parcelId])
      if (!parcel) throw error(404, 'No se encontró el predio seleccionado.')
      if (!parcel.geometria_valida) throw error(409, 'El predio necesita una geometría poligonal válida antes de vincularlo.')
      await client.query('INSERT INTO public.expediente_predios (expediente_id,predio_id) VALUES ($1,$2)', [id, parcelId])
      await client.query(`INSERT INTO public.mediciones_expediente
        (expediente_id,predio_id,estado,responsable_id,responsable,fecha_compromiso,fecha_visita,superficie_m2,observaciones,referencia_evidencia)
        VALUES ($1,$2,'visitado',$3,(SELECT nombre FROM public.usuarios_locales WHERE id=$3),$4,$5,$6,$7,$8)`,
      [id, parcelId, visit.responsable_id, visit.fecha_compromiso, visit.fecha_visita, visit.superficie_m2,
        visit.observaciones, `Evidencia conservada en la visita inicial del expediente ${file.id}`])
      const destination = { estado: 'en_proceso', etapa_actual: 'integracion_cartografica', area_responsable: 'Cartografía y Valuación' }
      await client.query('UPDATE public.expedientes SET estado=$2,etapa_actual=$3,area_responsable=$4 WHERE id=$1',
        [id, destination.estado, destination.etapa_actual, destination.area_responsable])
      await audit(client, file, user, `Predio vinculado: ${parcel.clave_catastral} (ID ${parcelId}). Superficie medida: ${visit.superficie_m2} m²; registrada: ${parcel.superficie ?? 'sin dato'} m². ${reason}`, destination)
      await client.query('COMMIT')
      return sendJson(response, 200, { predio: parcel, etapa_actual: destination.etapa_actual })
    } catch (problem) { await client.query('ROLLBACK').catch(() => {}); throw problem }
    finally { client.release() }
  }
  async function change(request, response, id, user) {
    const body = object(await readJson(request), 'la acción')
    const transition = Object.hasOwn(initialVisitTransitions, body.accion) ? initialVisitTransitions[body.accion] : null
    if (!transition || !transition.roles.includes(user.rol)) throw error(403, 'Tu rol no permite esta acción.')
    const reason = optionalText(body, 'observaciones', 2000)
    const responsibleId = optionalText(body, 'responsable_id', 36)
    const date = today()
    if (body.accion === 'asignar' && (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(responsibleId || '')
      || typeof body.fecha_compromiso !== 'string' || !isValidIsoDate(body.fecha_compromiso) || body.fecha_compromiso < date)) throw error(400, 'Selecciona un topógrafo y una fecha compromiso vigente.')
    if (body.superficie_m2 != null && !['string', 'number'].includes(typeof body.superficie_m2)) throw error(400, 'Indica una superficie numérica.')
    const area = optionalNumber(body, 'superficie_m2', { min: 0.01 })
    if (body.accion === 'registrar_visita' && (typeof body.fecha_visita !== 'string' || !isValidIsoDate(body.fecha_visita) || body.fecha_visita > date
      || area == null || area > 999999999999.99 || !reason)) throw error(400, 'Indica fecha de visita, superficie positiva y observaciones.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const file = await lockedFile(client, id)
      const { rows: [visit] } = await client.query('SELECT * FROM public.visitas_iniciales WHERE expediente_id=$1 FOR UPDATE', [id])
      if ((visit?.estado ?? null) !== transition.from) throw error(409, 'La solicitud cambió de etapa. Actualiza la ficha.')
      if (body.accion === 'registrar_visita' && visit.responsable_id !== user.id) throw error(403, 'Solo el topógrafo asignado puede registrar esta visita.')
      if (body.accion === 'asignar') {
        const { rows: [topographer] } = await client.query("SELECT id FROM public.usuarios_locales WHERE id=$1 AND activo AND rol='topografia'", [responsibleId])
        if (!topographer) throw error(400, 'Selecciona una cuenta activa de Topografía.')
      }
      await client.query(`INSERT INTO public.visitas_iniciales
        (expediente_id,estado,responsable_id,fecha_compromiso,fecha_visita,superficie_m2,observaciones)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (expediente_id) DO UPDATE SET estado=excluded.estado,
          responsable_id=coalesce(excluded.responsable_id,visitas_iniciales.responsable_id),
          fecha_compromiso=coalesce(excluded.fecha_compromiso,visitas_iniciales.fecha_compromiso),
          fecha_visita=excluded.fecha_visita,superficie_m2=excluded.superficie_m2,
          observaciones=excluded.observaciones,actualizado_en=now()`,
      [id, transition.to, body.accion === 'asignar' ? responsibleId : visit?.responsable_id || null,
        body.accion === 'asignar' ? body.fecha_compromiso : visit?.fecha_compromiso || null,
        body.accion === 'registrar_visita' ? body.fecha_visita : null,
        body.accion === 'registrar_visita' ? area : null, reason])
      const stage = body.accion === 'registrar_visita' ? 'revision_cartografica' : `medicion_${transition.to}`
      const destination = { estado: 'en_proceso', etapa_actual: stage, area_responsable: transition.area }
      await client.query('UPDATE public.expedientes SET estado=$2,etapa_actual=$3,area_responsable=$4 WHERE id=$1',
        [id, destination.estado, destination.etapa_actual, destination.area_responsable])
      const details = body.accion === 'asignar' ? ` · Responsable ${responsibleId}, compromiso ${body.fecha_compromiso}`
        : body.accion === 'registrar_visita' ? ` · Fecha ${body.fecha_visita}, superficie ${area} m²` : ''
      await audit(client, file, user, `${transition.label}${details}${reason ? ` · ${reason}` : ''}`, destination)
      await client.query('COMMIT')
      return sendJson(response, 200, { ok: true, estado_visita: transition.to })
    } catch (problem) { await client.query('ROLLBACK').catch(() => {}); throw problem }
    finally { client.release() }
  }
  async function upload(request, response, id, user) {
    if (user.rol !== 'topografia') throw error(403, 'Solo el topógrafo asignado puede adjuntar evidencia.')
    const fileData = await readAttachmentUpload(request)
    const client = await pool.connect()
    let target
    try {
      await client.query('BEGIN')
      const file = await lockedFile(client, id)
      const { rows: [visit] } = await client.query('SELECT * FROM public.visitas_iniciales WHERE expediente_id=$1 FOR UPDATE', [id])
      if (visit?.responsable_id !== user.id) throw error(403, 'Solo el topógrafo asignado puede adjuntar evidencia.')
      if (visit.estado !== 'visitado') throw error(409, 'Registra la visita antes de adjuntar evidencia.')
      const { rows: [last] } = await client.query('SELECT coalesce(max(version),0)+1 AS version FROM public.archivos_visita_inicial WHERE expediente_id=$1', [id])
      const fileId = randomUUID()
      await storage.mkdir(privateStorageDirectory, { recursive: true, mode: 0o700 })
      target = path.join(privateStorageDirectory, fileId)
      await storage.writeFile(target, fileData.buffer, { flag: 'wx', mode: 0o600 })
      const { rows: [saved] } = await client.query(`INSERT INTO public.archivos_visita_inicial
        (id,expediente_id,version,nombre_archivo,mime_type,bytes,sha256,subido_por)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [fileId, id, last.version, fileData.filename, fileData.mimeType, fileData.size, fileData.sha256, user.id])
      await audit(client, file, user, `Evidencia de visita inicial v${last.version}: ${fileData.filename}`)
      await client.query('COMMIT'); target = null
      return sendJson(response, 201, { archivo: metadata(saved) })
    } catch (problem) {
      await client.query('ROLLBACK').catch(() => {})
      if (target) await storage.unlink(target).catch(() => {})
      throw problem
    } finally { client.release() }
  }
  async function download(response, id, fileId, user) {
    await readable(id, user)
    const { rows: [file] } = await pool.query('SELECT * FROM public.archivos_visita_inicial WHERE expediente_id=$1 AND id=$2', [id, fileId])
    if (!file) throw error(404, 'No se encontró el archivo.')
    const bytes = await storage.readFile(path.join(privateStorageDirectory, file.id)).catch(() => null)
    if (!bytes) throw error(503, 'El archivo privado no está disponible.')
    response.writeHead(200, { 'Content-Type': file.mime_type, 'Content-Length': bytes.length,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.nombre_archivo)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    response.end(bytes)
  }
  return async (request, response, user, { id, action, fileId } = {}) => {
    try {
      if (!user) throw error(401, 'Inicia sesión.')
      if (!documentReaders.includes(user.rol)) throw error(403, 'Tu rol no permite consultar solicitudes iniciales.')
      if (request.method === 'POST' && action !== 'evidencia' && request.headers['content-type']?.split(';')[0] !== 'application/json') {
        throw error(415, 'Envía los datos como JSON.')
      }
      if (!id && request.method === 'POST') return await create(request, response, user)
      if (!id && request.method === 'GET') return await list(response, user)
      if (id && !action && request.method === 'GET') return await detail(id, response, user)
      if (action === 'visita' && request.method === 'POST') return await change(request, response, id, user)
      if (action === 'predio' && request.method === 'POST') return await linkParcel(request, response, id, user)
      if (action === 'evidencia' && request.method === 'POST') return await upload(request, response, id, user)
      if (action === 'archivos' && fileId && request.method === 'GET') return await download(response, id, fileId, user)
      return sendJson(response, 405, { error: 'Método no permitido.' })
    } catch (problem) { return fail(response, problem) }
  }
}
