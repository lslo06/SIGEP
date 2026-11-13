import { promisify } from 'node:util'
import { createHash, timingSafeEqual, randomBytes, scrypt as scryptCallback } from 'node:crypto'
import http from "node:http"
import { Pool } from "pg"

const port = Number(process.env.PORT || 8100)
const pool = new Pool({
  host: process.env.DB_HOST || "sigep-postgis",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "sigep",
  user: process.env.DB_USER || "sigep_editor",
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  let body = ""
  for await (const chunk of request) {
    body += chunk
    if (body.length > 64_000) throw Object.assign(new Error("La solicitud es demasiado grande."), { status: 413 })
  }
  try {
    return JSON.parse(body)
  } catch {
    throw Object.assign(new Error("El contenido enviado no es JSON válido."), { status: 400 })
  }
}

function optionalText(body, field, maxLength = 200) {
  const value = body[field]
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw Object.assign(new Error(`El campo ${field} no es válido.`), { status: 400 })
  }
  return value.trim()
}

function optionalNumber(body, field, { integer = false, min = -Infinity } = {}) {
  const value = body[field]
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || (integer && !Number.isSafeInteger(parsed))) {
    throw Object.assign(new Error(`El campo ${field} debe ser ${integer ? "un número entero" : "un número válido"}.`), { status: 400 })
  }
  return parsed
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function parseGeometry(value) {
  const geometry = Array.isArray(value)
    ? { type: "Polygon", coordinates: [value] }
    : value
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type) || !Array.isArray(geometry.coordinates)) {
    throw Object.assign(new Error("Envía un polígono o multipolígono válido."), { status: 400 })
  }

  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
  if (polygons.length === 0) throw Object.assign(new Error("El multipolígono no contiene partes."), { status: 400 })
  let vertexCount = 0
  const cleanPolygons = polygons.map((polygon) => {
    if (!Array.isArray(polygon) || polygon.length === 0) throw Object.assign(new Error("Cada polígono debe tener un contorno."), { status: 400 })
    return polygon.map((ring) => {
      if (!Array.isArray(ring) || ring.length < 3) throw Object.assign(new Error("Cada contorno necesita al menos tres puntos."), { status: 400 })
      const points = ring.map((point) => {
        if (!Array.isArray(point) || point.length < 2 || point[0] === "" || point[1] === "" || point[0] === null || point[1] === null) {
          throw Object.assign(new Error("Cada punto debe incluir longitud y latitud."), { status: 400 })
        }
        const longitude = Number(point[0])
        const latitude = Number(point[1])
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
          throw Object.assign(new Error("Hay coordenadas fuera del rango de longitud/latitud."), { status: 400 })
        }
        return [longitude, latitude]
      })
      const distinctCount = new Set(points.map((point) => point.join(","))).size
      if (distinctCount < 3) throw Object.assign(new Error("Cada contorno requiere tres puntos distintos."), { status: 400 })
      vertexCount += distinctCount
      const first = points[0]
      const last = points.at(-1)
      if (last[0] !== first[0] || last[1] !== first[1]) points.push(first)
      return points
    })
  })
  if (vertexCount > 30) throw Object.assign(new Error("El polígono supera el máximo de 30 vértices."), { status: 400 })

  return geometry.type === "Polygon"
    ? { type: "Polygon", coordinates: cleanPolygons[0] }
    : { type: "MultiPolygon", coordinates: cleanPolygons }
}

async function createPredio(request, response) {
  let body
  try {
    body = await readJson(request)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendJson(response, 400, { error: "El cuerpo debe ser un objeto JSON." })
    }
    const clave = optionalText(body, "clave_catastral", 100)
    if (!clave) return sendJson(response, 400, { error: "La clave catastral es obligatoria." })
    const geometry = parseGeometry(body.geometry || body.coordinates)
    const values = [
      clave,
      optionalText(body, "id_predio", 100),
      optionalText(body, "id_predio_cart", 100),
      optionalNumber(body, "status", { integer: true }),
      optionalText(body, "municipio"),
      optionalText(body, "fundo"),
      optionalText(body, "manzana"),
      optionalText(body, "lote"),
      optionalNumber(body, "superficie", { min: 0 }),
      optionalText(body, "libro", 100),
      optionalText(body, "titulo", 100),
      optionalText(body, "fecha_titulo", 10),
      optionalText(body, "estado_medicion", 20) || "sin_confirmar",
      optionalText(body, "fecha_medicion", 10),
      optionalText(body, "observaciones_medicion", 1000),
      JSON.stringify(geometry),
    ]
    if (values[11] && !isValidIsoDate(values[11])) {
      return sendJson(response, 400, { error: "La fecha del título no es válida." })
    }
    if (!["medido", "no_medido", "sin_confirmar"].includes(values[12])) {
      return sendJson(response, 400, { error: "La condición de medición debe ser medido, no medido o sin confirmar." })
    }
    if (values[13] && !isValidIsoDate(values[13])) {
      return sendJson(response, 400, { error: "La fecha de medición no es válida." })
    }
    if (values[13] && values[12] !== "medido") {
      return sendJson(response, 400, { error: "Registra fecha de medición únicamente cuando la condición sea Medido." })
    }

    const { rows: validityRows } = await pool.query(
      `SELECT ST_IsValid(g.geom) AS valid, ST_IsValidReason(g.geom) AS reason,
         ST_Area(g.geom::geography) AS area_m2
       FROM (SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS geom) AS g`,
      [values[15]],
    )
    if (!validityRows[0]?.valid) {
      return sendJson(response, 422, { error: `El polígono no es válido: ${validityRows[0]?.reason || "revisa los puntos"}.` })
    }
    values[8] = Number(validityRows[0].area_m2)
    if (!Number.isFinite(values[8])) {
      return sendJson(response, 422, { error: "No se pudo calcular la superficie del polígono." })
    }

    const { rows } = await pool.query(
      `INSERT INTO predios (
         clave_catastral, id_predio, id_predio_cart, status, municipio,
         fundo, manzana, lote, superficie, libro, titulo, fecha_titulo,
         estado_medicion, fecha_medicion, observaciones_medicion, geom
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULLIF($12, '')::date,
         $13, NULLIF($14, '')::date, $15,
         ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($16), 4326))
       )
       ON CONFLICT (clave_catastral) DO NOTHING
       RETURNING id, clave_catastral, id_predio, id_predio_cart, status,
         municipio, fundo, manzana, lote, superficie, libro, titulo, fecha_titulo,
         estado_medicion, fecha_medicion, observaciones_medicion,
         ST_AsGeoJSON(geom)::json AS geometry`,
      values,
    )
    if (rows.length === 0) return sendJson(response, 409, { error: "Ya existe un predio con esa clave catastral." })

    const { geometry: savedGeometry, ...properties } = rows[0]
    return sendJson(response, 201, { type: "Feature", geometry: savedGeometry, properties })
  } catch (error) {
    if (error?.status) return sendJson(response, error.status, { error: error.message })
    if (error?.code === "42501") return sendJson(response, 503, { error: "La API no tiene permiso para registrar predios. Configura el usuario sigep_editor en el servidor." })
    if (error?.code === "23502") return sendJson(response, 400, { error: `Falta un campo obligatorio en la base de datos (${error.column || "revisa el esquema"}).` })
    console.error("No se pudo registrar el predio:", error?.message || error)
    return sendJson(response, 500, { error: "No fue posible guardar el predio. Revisa el esquema y los permisos de la base de datos." })
  }
}

async function getMapPredios(url, response) {
  const rawBbox = url.searchParams.get("bbox")?.trim()
  if (!rawBbox) return sendJson(response, 400, { error: "El mapa debe enviar sus límites visibles." })
  const bbox = rawBbox.split(",").map(Number)
  if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) {
    return sendJson(response, 400, { error: "Los límites del mapa no son válidos." })
  }
  const [west, south, east, north] = bbox
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) {
    return sendJson(response, 400, { error: "El área visible del mapa está fuera del rango permitido." })
  }
  const zoom = Number(url.searchParams.get("zoom"))
  if (!Number.isFinite(zoom) || zoom < 12 || zoom > 24) {
    return sendJson(response, 400, { error: "Acerca el mapa hasta el nivel 12 para consultar los predios de esa zona." })
  }
  try {
    const { rows } = await pool.query(
      `WITH area AS (SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS geom)
       SELECT p.id, p.clave_catastral, p.id_predio, p.id_predio_cart, p.status,
         p.municipio, p.fundo, p.manzana, p.lote, p.superficie, p.libro,
         p.titulo, p.fecha_titulo, p.estado_medicion, p.fecha_medicion,
         p.observaciones_medicion, ST_AsGeoJSON(p.geom)::json AS geometry
       FROM public.predios p CROSS JOIN area a
       WHERE p.geom && a.geom AND ST_Intersects(p.geom, a.geom)
       ORDER BY p.clave_catastral
       LIMIT 301`,
      [west, south, east, north],
    )
    const features = rows.slice(0, 300).map(({ geometry, ...properties }) => ({ type: "Feature", geometry, properties }))
    return sendJson(response, 200, { type: "FeatureCollection", features, hasMore: rows.length > 300 })
  } catch (error) {
    console.error("No se pudieron consultar los predios del mapa:", error?.message || error)
    return sendJson(response, 500, { error: "No fue posible cargar los predios. Comprueba que la migración cartográfica esté aplicada." })
  }
}

async function updatePredioGeometry(request, response, predioId) {
  let client
  try {
    const body = await readJson(request)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendJson(response, 400, { error: "El contenido enviado no es válido." })
    }
    const actor = optionalText(body, "actor", 200)
    const reason = optionalText(body, "motivo", 1000)
    if (!actor) return sendJson(response, 400, { error: "Indica quién registra la corrección." })
    if (!reason) return sendJson(response, 400, { error: "Indica el motivo de la corrección." })
    const geometry = parseGeometry(body.geometry)
    client = await pool.connect()
    await client.query("BEGIN")
    const { rows: currentRows } = await client.query(
      `SELECT id, clave_catastral, superficie, ST_AsGeoJSON(geom)::json AS geometry
       FROM public.predios WHERE id = $1 FOR UPDATE`,
      [predioId],
    )
    if (!currentRows.length) {
      await client.query("ROLLBACK")
      return sendJson(response, 404, { error: "No se encontró el predio que quieres corregir." })
    }
    const current = currentRows[0]
    const geometryJson = JSON.stringify(geometry)
    const { rows: validityRows } = await client.query(
      `SELECT ST_IsValid(g.geom) AS valid, ST_IsValidReason(g.geom) AS reason,
         ST_Area(g.geom::geography) AS area_m2
       FROM (SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS geom) AS g`,
      [geometryJson],
    )
    if (!validityRows[0]?.valid) {
      await client.query("ROLLBACK")
      return sendJson(response, 422, { error: `El polígono no es válido: ${validityRows[0]?.reason || "revisa los puntos"}.` })
    }
    const area = Number(validityRows[0].area_m2)
    if (!Number.isFinite(area)) {
      await client.query("ROLLBACK")
      return sendJson(response, 422, { error: "No se pudo calcular la superficie del nuevo polígono." })
    }
    const { rows: historyRows } = await client.query(
      `INSERT INTO public.predio_geometria_historial (
         predio_id, clave_catastral, geom_anterior, geom_nueva,
         superficie_anterior, superficie_nueva, actor, motivo
       ) VALUES (
         $1, $2, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)),
         ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)), $5, $6, $7, $8
       ) RETURNING id, fecha_cambio`,
      [current.id, current.clave_catastral, JSON.stringify(current.geometry), geometryJson,
        current.superficie, area, actor, reason],
    )
    const { rows: updatedRows } = await client.query(
      `UPDATE public.predios SET geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
         superficie = $2
       WHERE id = $3
       RETURNING id, clave_catastral, id_predio, id_predio_cart, status,
         municipio, fundo, manzana, lote, superficie, libro, titulo, fecha_titulo,
         estado_medicion, fecha_medicion, observaciones_medicion,
         ST_AsGeoJSON(geom)::json AS geometry`,
      [geometryJson, area, predioId],
    )
    await client.query("COMMIT")
    const { geometry: savedGeometry, ...properties } = updatedRows[0]
    return sendJson(response, 200, {
      type: "Feature",
      geometry: savedGeometry,
      properties,
      geometry_change: { id: historyRows[0].id, fecha_cambio: historyRows[0].fecha_cambio, actor, motivo: reason },
    })
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {})
    if (error?.status) return sendJson(response, error.status, { error: error.message })
    if (error?.code === "42501") return sendJson(response, 503, { error: "La API no tiene permisos para actualizar la geometría. Aplica la migración cartográfica." })
    console.error("No se pudo actualizar la geometría:", error?.message || error)
    return sendJson(response, 500, { error: "No fue posible guardar la corrección cartográfica. Revisa la migración y los permisos." })
  } finally {
    client?.release()
  }
}

async function getPredioGeometryHistory(predioId, response) {
  try {
    const { rows } = await pool.query(
      `SELECT id, predio_id, clave_catastral, superficie_anterior,
         superficie_nueva, actor, motivo, fecha_cambio,
         ST_AsGeoJSON(geom_anterior)::json AS geom_anterior,
         ST_AsGeoJSON(geom_nueva)::json AS geom_nueva
       FROM public.predio_geometria_historial
       WHERE predio_id = $1
       ORDER BY fecha_cambio DESC, id DESC`,
      [predioId],
    )
    return sendJson(response, 200, { cambios: rows })
  } catch (error) {
    console.error("No se pudo consultar el historial cartográfico:", error?.message || error)
    return sendJson(response, 500, { error: "No fue posible consultar el historial cartográfico." })
  }
}

const expedienteTypes = new Set([
  "titulacion",
  "certificacion_antecedentes_titulo",
  "certificacion_copia_titulo",
  "constancia_datos_lote",
  "constancia_tramite_titulo",
])

async function createExpediente(request, response) {
  let client
  try {
    const body = await readJson(request)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendJson(response, 400, { error: "El contenido enviado no es válido." })
    }

    const tipoTramite = optionalText(body, "tipo_tramite", 60)
    if (!expedienteTypes.has(tipoTramite)) {
      return sendJson(response, 400, { error: "Selecciona un tipo de trámite válido." })
    }

    const rawApplicant = body.solicitante
    if (!rawApplicant || typeof rawApplicant !== "object" || Array.isArray(rawApplicant)) {
      return sendJson(response, 400, { error: "Captura los datos del solicitante." })
    }
    const applicant = {
      nombre: optionalText(rawApplicant, "nombre", 200),
      identificacion: optionalText(rawApplicant, "identificacion", 100),
      telefono: optionalText(rawApplicant, "telefono", 50),
      correo: optionalText(rawApplicant, "correo", 254),
      domicilio_notificacion: optionalText(rawApplicant, "domicilio_notificacion", 500),
      representante_nombre: optionalText(rawApplicant, "representante_nombre", 200),
      representante_identificacion: optionalText(rawApplicant, "representante_identificacion", 100),
    }
    if (!applicant.nombre) return sendJson(response, 400, { error: "El nombre del solicitante es obligatorio." })

    const predioIds = body.predio_ids
    if (!Array.isArray(predioIds) || predioIds.length < 1 || predioIds.length > 20) {
      return sendJson(response, 400, { error: "Selecciona de uno a veinte predios para el expediente." })
    }
    const ids = [...new Set(predioIds.map(Number))]
    if (ids.length !== predioIds.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
      return sendJson(response, 400, { error: "La lista de predios contiene identificadores no válidos o repetidos." })
    }
    const observations = optionalText(body, "observaciones", 2000)

    client = await pool.connect()
    await client.query("BEGIN")
    const { rows: foundParcels } = await client.query(
      "SELECT id, clave_catastral FROM predios WHERE id = ANY($1::bigint[]) ORDER BY id",
      [ids],
    )
    if (foundParcels.length !== ids.length) {
      await client.query("ROLLBACK")
      return sendJson(response, 400, { error: "Uno o más predios seleccionados ya no están disponibles." })
    }

    const { rows: [folioNumber] } = await client.query(
      "SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS year, nextval('public.expedientes_folio_seq') AS number",
    )
    const folio = `FL-${folioNumber.year}-${String(folioNumber.number).padStart(6, "0")}`
    const { rows: [savedApplicant] } = await client.query(
      `INSERT INTO solicitantes (
         nombre, identificacion, telefono, correo, domicilio_notificacion,
         representante_nombre, representante_identificacion
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [applicant.nombre, applicant.identificacion, applicant.telefono, applicant.correo,
        applicant.domicilio_notificacion, applicant.representante_nombre, applicant.representante_identificacion],
    )
    const { rows: [expediente] } = await client.query(
      `INSERT INTO expedientes (folio, tipo_tramite, solicitante_id, observaciones)
       VALUES ($1, $2, $3, $4)
       RETURNING id, folio, tipo_tramite, fecha_recepcion, estado, etapa_actual, area_responsable`,
      [folio, tipoTramite, savedApplicant.id, observations],
    )
    for (const predioId of ids) {
      await client.query(
        "INSERT INTO expediente_predios (expediente_id, predio_id) VALUES ($1, $2)",
        [expediente.id, predioId],
      )
    }
    await client.query(
      `INSERT INTO movimientos_expediente (
         expediente_id, etapa_destino, estado, area_destino, observaciones
       ) VALUES ($1, $2, $3, $4, $5)`,
      [expediente.id, expediente.etapa_actual, expediente.estado, expediente.area_responsable, "Alta inicial del expediente"],
    )
    await client.query("COMMIT")

    return sendJson(response, 201, {
      ...expediente,
      predios: foundParcels.map(({ id, clave_catastral }) => ({ id, clave_catastral })),
    })
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {})
    if (error?.status) return sendJson(response, error.status, { error: error.message })
    if (error?.code === "42501") return sendJson(response, 503, { error: "La API no tiene permiso para crear expedientes. Ejecuta la migración SQL con sigep_admin." })
    console.error("No se pudo crear el expediente:", error?.message || error)
    return sendJson(response, 500, { error: "No fue posible crear el expediente. Revisa que la migración SQL esté aplicada." })
  } finally {
    client?.release()
  }
}

async function searchExpedientes(url, response) {
  try {
    const conditions = []
    const values = []
    const addValue = (value) => {
      values.push(value)
      return `$${values.length}`
    }
    const textFilters = [
      ["folio", (p) => `e.folio ILIKE ${p}`],
      ["solicitante", (p) => `s.nombre ILIKE ${p}`],
      ["estado", (p) => `e.estado = ${p}`],
    ]
    for (const [parameter, predicate] of textFilters) {
      const raw = url.searchParams.get(parameter)?.trim()
      if (!raw) continue
      if (raw.length > 120) return sendJson(response, 400, { error: `El filtro ${parameter} es demasiado largo.` })
      const value = addValue(parameter === "estado" ? raw : `%${raw}%`)
      conditions.push(predicate(value))
    }

    const parcelSearch = url.searchParams.get("predio")?.trim()
    if (parcelSearch) {
      if (parcelSearch.length > 120) return sendJson(response, 400, { error: "El filtro predio es demasiado largo." })
      const value = addValue(`%${parcelSearch}%`)
      conditions.push(`EXISTS (
        SELECT 1 FROM public.expediente_predios ep
        JOIN public.predios p ON p.id = ep.predio_id
        WHERE ep.expediente_id = e.id AND (
          p.clave_catastral ILIKE ${value} OR p.id_predio ILIKE ${value} OR
          p.id_predio_cart ILIKE ${value} OR p.municipio ILIKE ${value} OR
          p.fundo ILIKE ${value} OR p.manzana ILIKE ${value} OR
          p.lote ILIKE ${value} OR p.titulo ILIKE ${value}
        )
      )`)
    }

    const validDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false
      const [year, month, day] = value.split("-").map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    }
    const from = url.searchParams.get("fecha_desde")?.trim()
    const to = url.searchParams.get("fecha_hasta")?.trim()
    if (from && !validDate(from)) return sendJson(response, 400, { error: "La fecha inicial debe tener formato AAAA-MM-DD." })
    if (to && !validDate(to)) return sendJson(response, 400, { error: "La fecha final debe tener formato AAAA-MM-DD." })
    if (from && to && from > to) return sendJson(response, 400, { error: "La fecha inicial no puede ser posterior a la fecha final." })
    if (from) conditions.push(`e.fecha_recepcion >= ${addValue(from)}::date`)
    if (to) conditions.push(`e.fecha_recepcion <= ${addValue(to)}::date`)
    if (conditions.length === 0) return sendJson(response, 400, { error: "Indica al menos un filtro para buscar expedientes." })

    const { rows } = await pool.query(
      `SELECT e.id, e.folio, e.tipo_tramite, e.fecha_recepcion, e.estado,
         e.etapa_actual, e.area_responsable,
         s.nombre AS solicitante,
         COALESCE(array_agg(DISTINCT p.clave_catastral) FILTER (WHERE p.id IS NOT NULL), '{}') AS claves_catastrales
       FROM public.expedientes e
       JOIN public.solicitantes s ON s.id = e.solicitante_id
       LEFT JOIN public.expediente_predios ep ON ep.expediente_id = e.id
       LEFT JOIN public.predios p ON p.id = ep.predio_id
       WHERE ${conditions.join(" AND ")}
       GROUP BY e.id, s.nombre
       ORDER BY e.fecha_recepcion DESC, e.id DESC
       LIMIT 101`,
      values,
    )
    return sendJson(response, 200, { expedientes: rows.slice(0, 100), hasMore: rows.length > 100 })
  } catch (error) {
    console.error("No se pudieron consultar expedientes:", error?.message || error)
    return sendJson(response, 500, { error: "No fue posible consultar los expedientes. Revisa que la migración esté aplicada." })
  }
}

async function getExpediente(id, response) {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.folio, e.tipo_tramite, e.fecha_recepcion, e.estado,
         e.etapa_actual, e.area_responsable, e.observaciones, e.created_at,
         s.nombre AS solicitante, s.representante_nombre
       FROM public.expedientes e
       JOIN public.solicitantes s ON s.id = e.solicitante_id
       WHERE e.id = $1`,
      [id],
    )
    if (rows.length === 0) return sendJson(response, 404, { error: "No se encontró el expediente." })
    const [predios, { rows: movimientos }] = await Promise.all([
      pool.query(
        `SELECT p.id, p.clave_catastral, p.id_predio, p.id_predio_cart,
           p.municipio, p.fundo, p.manzana, p.lote, p.superficie, p.titulo
         FROM public.expediente_predios ep
         JOIN public.predios p ON p.id = ep.predio_id
         WHERE ep.expediente_id = $1
         ORDER BY p.clave_catastral`,
        [id],
      ),
      pool.query(
        `SELECT id, etapa_origen, etapa_destino, estado, area_origen,
           area_destino, actor, observaciones, created_at
         FROM public.movimientos_expediente
         WHERE expediente_id = $1
         ORDER BY created_at ASC, id ASC`,
        [id],
      ),
    ])
    return sendJson(response, 200, { ...rows[0], predios: predios.rows, movimientos })
  } catch (error) {
    console.error("No se pudo abrir el expediente:", error?.message || error)
    return sendJson(response, 500, { error: "No fue posible abrir el expediente. Revisa que la migración esté aplicada." })
  }
}

async function pagosExpediente(request, response, url) {
  try {
    if (request.method === "GET") {
      const search = optionalText({ search: url.searchParams.get("busqueda") }, "search", 120) || ""
      const { rows } = await pool.query(
        `SELECT pe.id, e.folio, pe.concepto, pe.recibo, pe.importe, pe.fecha::text,
           'Válido' AS estado, predios.claves AS clave_catastral
         FROM public.pagos_expediente pe
         JOIN public.expedientes e ON e.id = pe.expediente_id
         LEFT JOIN LATERAL (
           SELECT string_agg(p.clave_catastral, ', ' ORDER BY p.clave_catastral) AS claves
           FROM public.expediente_predios ep JOIN public.predios p ON p.id = ep.predio_id
           WHERE ep.expediente_id = e.id
         ) predios ON true
         WHERE $1 = '' OR position(lower($1) in lower(e.folio)) > 0
           OR position(lower($1) in lower(coalesce(predios.claves, ''))) > 0
         ORDER BY pe.fecha DESC, pe.id DESC LIMIT 100`,
        [search],
      )
      return sendJson(response, 200, { pagos: rows })
    }

    const body = await readJson(request)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendJson(response, 400, { error: "Indica los datos del pago." })
    }
    const folio = optionalText(body, "folio", 120)
    const recibo = optionalText(body, "recibo", 120)
    const evidencia = optionalText(body, "evidencia", 500)
    const importe = optionalNumber(body, "importe", { min: 0.01 })
    const conceptos = ["Lote", "Servicios catastrales", "Búsqueda de información", "Documento solicitado"]
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }).format(new Date())
    if (!folio || !recibo || !evidencia || importe == null || importe > 999999999999.99 || !conceptos.includes(body.concepto)
      || !isValidIsoDate(body.fecha) || body.fecha > today) {
      return sendJson(response, 400, { error: "Indica folio, concepto, recibo, importe, fecha y evidencia válidos." })
    }
    const { rows: [payment] } = await pool.query(
      `INSERT INTO public.pagos_expediente (expediente_id, concepto, recibo, importe, fecha, evidencia)
       SELECT id,$2,$3,$4,$5,$6 FROM public.expedientes
       WHERE folio = $1 AND estado NOT IN ('cerrado', 'entregado', 'no_procede')
       RETURNING id`,
      [folio, body.concepto, recibo, importe, body.fecha, evidencia],
    )
    if (!payment) return sendJson(response, 404, { error: "No se encontró un expediente abierto con ese folio." })
    return sendJson(response, 201, { id: payment.id })
  } catch (error) {
    if (error.status) return sendJson(response, error.status, { error: error.message })
    if (error.code === "23505") return sendJson(response, 409, { error: "El recibo ya se registró para ese concepto." })
    if (error.code === "42P01") return sendJson(response, 503, { error: "Pagos aún no está habilitado en SIGEP." })
    console.error("No se pudo procesar el pago:", error.message)
    return sendJson(response, 500, { error: "No fue posible procesar el pago." })
  }
}

async function expedienteMedicion(request, response, expedienteId, predioId, user) {
  let client
  try {
    if (request.method === "GET") {
      const { rows } = await pool.query(
        "SELECT * FROM public.mediciones_expediente WHERE expediente_id = $1 AND predio_id = $2 AND ($3 IS DISTINCT FROM 'topografia' OR responsable_id = $4)",
        [expedienteId, predioId, user.rol, user.id],
      )
      return sendJson(response, 200, { medicion: rows[0] ?? null })
    }

    const body = await readJson(request)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendJson(response, 400, { error: "Indica los datos de la medición." })
    }
    const action = body.accion
    const allowed = {
      medido: ["ventanilla", "admin"],
      solicitado: ["ventanilla", "admin"],
      asignado: ["cartografia", "admin"],
      visitado: ["topografia"],
    }
    if (!Object.hasOwn(allowed, action) || !allowed[action].includes(user.rol)) {
      return sendJson(response, 403, { error: "Tu rol no permite esta acción de medición." })
    }
    if (!["medido", "solicitado", "asignado", "visitado"].includes(action)) {
      return sendJson(response, 400, { error: "La acción de medición no es válida." })
    }

    const responsibleId = optionalText(body, "responsable_id", 36)
    const commitment = body.fecha_compromiso
    const visit = body.fecha_visita
    const area = optionalNumber(body, "superficie_m2", { min: 0.01 })
    const notes = optionalText(body, "observaciones", 2000)
    const evidence = optionalText(body, "referencia_evidencia", 500)
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }).format(new Date())
    if (action === "asignado" && (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(responsibleId || "") || !isValidIsoDate(commitment) || commitment < today)) {
      return sendJson(response, 400, { error: "Indica el responsable y una fecha compromiso vigente." })
    }
    if (action === "visitado" && (!isValidIsoDate(visit) || visit > today || area == null || !notes || !evidence)) {
      return sendJson(response, 400, { error: "Indica fecha de visita, superficie, observaciones y referencia de evidencia." })
    }

    client = await pool.connect()
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('sigep.medicion:' || $1::text, 0))", [expedienteId])
    const { rows: [file] } = await client.query(
      `SELECT e.tipo_tramite, e.estado, e.etapa_actual, e.area_responsable
       FROM public.expedientes e JOIN public.expediente_predios ep ON ep.expediente_id = e.id
       WHERE e.id = $1 AND ep.predio_id = $2`,
      [expedienteId, predioId],
    )
    if (!file || file.tipo_tramite !== "titulacion" || ["cerrado", "entregado", "no_procede"].includes(file.estado)) {
      throw Object.assign(new Error("Selecciona un predio vinculado a un expediente de titulación abierto."), { status: 409 })
    }
    const { rows: [current] } = await client.query(
      "SELECT estado, responsable_id FROM public.mediciones_expediente WHERE expediente_id = $1 AND predio_id = $2",
      [expedienteId, predioId],
    )
    const requiredState = { medido: null, solicitado: null, asignado: "solicitado", visitado: "asignado" }
    const canReassign = action === "asignado" && current?.estado === "asignado"
    if (action === "visitado" && current?.responsable_id !== user.id) {
      throw Object.assign(new Error("Solo el topógrafo asignado puede registrar esta visita."), { status: 403 })
    }
    if (!canReassign && (current?.estado ?? null) !== requiredState[action]) {
      throw Object.assign(new Error("La medición cambió de estado. Vuelve a abrir el expediente."), { status: 409 })
    }
    let responsible = null
    if (action === "asignado") {
      const { rows: [profile] } = await client.query(
        "SELECT nombre FROM public.usuarios_locales WHERE id = $1 AND activo AND rol = 'topografia'",
        [responsibleId],
      )
      if (!profile) throw Object.assign(new Error("Selecciona una cuenta activa de Topografía."), { status: 400 })
      responsible = profile.nombre
    }
    const { rows: [measurement] } = await client.query(
      `INSERT INTO public.mediciones_expediente
         (expediente_id, predio_id, estado, responsable, fecha_compromiso, fecha_visita,
          superficie_m2, observaciones, referencia_evidencia, responsable_id, asignado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $10::uuid IS NOT NULL THEN now() END)
       ON CONFLICT (expediente_id, predio_id) DO UPDATE SET estado = EXCLUDED.estado,
         responsable_id = COALESCE(EXCLUDED.responsable_id, mediciones_expediente.responsable_id),
         asignado_en = COALESCE(EXCLUDED.asignado_en, mediciones_expediente.asignado_en),
         responsable = COALESCE(EXCLUDED.responsable, mediciones_expediente.responsable),
         fecha_compromiso = COALESCE(EXCLUDED.fecha_compromiso, mediciones_expediente.fecha_compromiso),
         fecha_visita = EXCLUDED.fecha_visita, superficie_m2 = EXCLUDED.superficie_m2,
         observaciones = EXCLUDED.observaciones, referencia_evidencia = EXCLUDED.referencia_evidencia,
         actualizado_en = now()
       RETURNING *`,
      [expedienteId, predioId, action, action === "asignado" ? responsible : null,
        action === "asignado" ? commitment : null, action === "visitado" ? visit : null,
        action === "visitado" ? area : null, action === "visitado" ? notes : null,
        action === "visitado" ? evidence : null, action === "asignado" ? responsibleId : null],
    )
    const descriptions = {
      medido: "Predio confirmado como medido",
      solicitado: "Medición solicitada",
      asignado: `Visita asignada a ${responsible} (${responsibleId}) para el ${commitment}`,
      visitado: `Visita registrada el ${visit}. Evidencia: ${evidence}`,
    }
    await client.query(
      `INSERT INTO public.movimientos_expediente
         (expediente_id, etapa_origen, etapa_destino, estado, area_origen, area_destino, observaciones, actor)
       VALUES ($1,$2,$2,$3,$4,$4,$5,$6)`,
      [expedienteId, file.etapa_actual, file.estado, file.area_responsable,
        `Predio ${predioId}: ${descriptions[action]}`, user.correo],
    )
    await client.query("COMMIT")
    return sendJson(response, 200, { medicion: measurement })
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {})
    if (error.status) return sendJson(response, error.status, { error: error.message })
    if (error.code === "42P01") return sendJson(response, 503, { error: "El registro de mediciones aún no está habilitado." })
    console.error("No se pudo procesar la medición:", error.message)
    return sendJson(response, 500, { error: "No fue posible procesar la medición." })
  } finally {
    client?.release()
  }
}

async function getFundosPredio(url, response) {
  const organizationId = url.searchParams.get("organizacion_id")?.trim()
  const fundosId = url.searchParams.get("id_fundos")?.trim()
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

  if (!uuid.test(organizationId || "") || !uuid.test(fundosId || "")) {
    return sendJson(response, 400, { error: "Indica organizacion_id e id_fundos como UUID válidos." })
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, clave_catastral, municipio, fundo, manzana, lote, superficie,
         estado_medicion, ST_AsGeoJSON(geom)::json AS geometry
       FROM public.predios
       WHERE organizacion_id = $1::uuid AND id_fundos = $2::uuid`,
      [organizationId, fundosId],
    )
    if (rows.length === 0) {
      return sendJson(response, 404, { error: "El predio de Fundos todavía no está vinculado en SIGEP." })
    }

    const { geometry, ...properties } = rows[0]
    return sendJson(response, 200, { type: "Feature", geometry, properties })
  } catch (error) {
    console.error("No se pudo consultar el predio de Fundos:", error?.message || error)
    return sendJson(response, 500, { error: "No fue posible consultar el predio de Fundos en SIGEP." })
  }
}

const scrypt = promisify(scryptCallback)
const digest = value => createHash("sha256").update(value).digest("hex")
const sessionCookie = "sigep_session"
const cookieFlags = `Path=/api/sigep; HttpOnly; SameSite=Strict${process.env.SIGEP_SECURE_COOKIE === "1" ? "; Secure" : ""}`
const loginAttempts = new Map()

async function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  const key = await scrypt(password, salt, 64)
  return `${salt}:${key.toString("hex")}`
}

function sessionToken(request) {
  return (request.headers.cookie || "").match(/(?:^|;\s*)sigep_session=([a-f0-9]{64})(?:;|$)/)?.[1]
}

async function currentLocalUser(request) {
  const token = sessionToken(request)
  if (!token) return null
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.correo, u.rol FROM public.sesiones_locales s
     JOIN public.usuarios_locales u ON u.id = s.usuario_id
     WHERE s.token_hash = $1 AND s.vence_en > now() AND u.activo`,
    [digest(token)],
  )
  return rows[0] || null
}

const roleModules = {
  ventanilla: ["inicio", "tramites", "lotes_predios", "propietarios", "municipios_fundos"],
  caja: ["pagos_servicios"],
  finanzas: ["pagos_servicios"],
  topografia: ["lotes_predios"],
  cartografia: ["inicio", "tramites", "lotes_predios", "municipios_fundos"],
  titulacion: ["inicio", "tramites", "lotes_predios", "titulos_formatos"],
  viewer: ["inicio", "tramites", "lotes_predios", "historico_reportes"],
  direccion: ["inicio", "tramites", "historico_reportes"],
  jefatura: ["inicio", "tramites", "historico_reportes"],
  legal: ["inicio", "tramites"],
  digitalizacion: ["inicio", "tramites"],
  captura: ["inicio", "tramites", "lotes_predios", "propietarios"],
  informatica: ["inicio", "lotes_predios"],
}

function localPermissions(role) {
  return {
    modulos: role === "admin" ? ["*"] : roleModules[role] || [],
    altaPredio: ["admin", "cartografia", "captura"].includes(role),
    altaExpediente: ["admin", "ventanilla", "captura"].includes(role),
    pagos: ["admin", "caja"].includes(role),
    campo: ["admin", "cartografia", "topografia"].includes(role),
    medicion: ["admin", "ventanilla", "cartografia", "topografia"].includes(role),
  }
}

function routePermission(path, method, permissions) {
  const has = key => permissions.modulos.includes("*") || permissions.modulos.includes(key)
  if (path === "/api/campo") return method === "GET" && permissions.campo
  if (path === "/api/pagos") return method === "GET" ? has("pagos_servicios") : permissions.pagos
  if (path.startsWith("/api/expedientes/") || path === "/api/expedientes") {
    if (method === "GET") return has("tramites") || path.endsWith("/medicion") && permissions.campo
    return path.endsWith("/medicion") ? permissions.medicion : path === "/api/expedientes" && permissions.altaExpediente
  }
  if (path.startsWith("/api/predios/") || path === "/api/predios" || path === "/api/fundos/predio") {
    if (method === "GET") return has("lotes_predios")
    return permissions.altaPredio
  }
  if (path.startsWith("/api/modulos/")) return method === "GET" && has(path.split("/").at(-1))
  return false
}

async function localSession(request, response, path) {
  if (request.method === "POST" && request.headers["content-type"]?.split(";")[0] !== "application/json") {
    return sendJson(response, 415, { error: "Envía la solicitud en JSON." })
  }
  try {
    if (path === "/api/sesion" && request.method === "GET") {
      const user = await currentLocalUser(request)
      return user
        ? sendJson(response, 200, { usuario: user, permisos: localPermissions(user.rol) })
        : sendJson(response, 401, { error: "Inicia sesión." })
    }
    if (path === "/api/sesion/salir" && request.method === "POST") {
      const token = sessionToken(request)
      if (token) await pool.query("DELETE FROM public.sesiones_locales WHERE token_hash = $1", [digest(token)])
      response.setHeader("Set-Cookie", `${sessionCookie}=; ${cookieFlags}; Max-Age=0`)
      return sendJson(response, 200, { ok: true })
    }
    if (path !== "/api/sesion/entrar" || request.method !== "POST") {
      return sendJson(response, 405, { error: "Método no permitido." })
    }
    const now = Date.now()
    const ip = request.socket.remoteAddress
    for (const [key, attempt] of loginAttempts) if (attempt.until <= now) loginAttempts.delete(key)
    const attempt = loginAttempts.get(ip) || { count: 0, until: now + 60_000 }
    if (attempt.count >= 15) return sendJson(response, 429, { error: "Espera un minuto y vuelve a intentar." })
    attempt.count++
    loginAttempts.set(ip, attempt)

    const body = await readJson(request)
    const email = optionalText(body || {}, "correo", 254)?.toLowerCase()
    const password = body?.password
    if (typeof password !== "string" || password.length < 12 || password.length > 128 || !email) {
      return sendJson(response, 401, { error: "Correo o contraseña incorrectos." })
    }
    const { rows: [user] } = await pool.query(
      "SELECT id, nombre, correo, rol, password_hash FROM public.usuarios_locales WHERE correo = $1 AND activo",
      [email],
    )
    const stored = user?.password_hash || "00000000000000000000000000000000:" + "0".repeat(128)
    const calculated = await passwordHash(password, stored.split(":")[0])
    if (!user?.password_hash || !timingSafeEqual(Buffer.from(digest(calculated)), Buffer.from(digest(stored)))) {
      return sendJson(response, 401, { error: "Correo o contraseña incorrectos." })
    }
    const token = randomBytes(32).toString("hex")
    const result = await pool.query(
      `INSERT INTO public.sesiones_locales (token_hash, usuario_id, vence_en)
       SELECT $1, id, now() + interval '8 hours' FROM public.usuarios_locales
       WHERE id = $2 AND activo AND password_hash = $3 RETURNING usuario_id`,
      [digest(token), user.id, stored],
    )
    if (!result.rowCount) return sendJson(response, 401, { error: "El acceso cambió. Intenta nuevamente." })
    response.setHeader("Set-Cookie", `${sessionCookie}=${token}; ${cookieFlags}; Max-Age=28800`)
    return sendJson(response, 200, { ok: true })
  } catch (error) {
    if (error.status) return sendJson(response, error.status, { error: error.message })
    console.error("Error en sesión local:", error.code)
    return sendJson(response, 503, { error: "El acceso local no está disponible. Revisa la migración de sesiones." })
  }
}

const adminRoles = new Set([
  "admin", "ventanilla", "direccion", "jefatura", "legal", "caja", "finanzas",
  "digitalizacion", "captura", "titulacion", "informatica", "viewer", "topografia", "cartografia",
])

async function manageLocalUsers(request, response, id) {
  const secret = process.env.SIGEP_ADMIN_KEY
  if (!secret || secret.length < 32) {
    return sendJson(response, 503, { error: "Configura una clave administrativa de al menos 32 caracteres en el servidor." })
  }
  const hash = value => createHash("sha256").update(value).digest()
  if (!timingSafeEqual(hash(request.headers.authorization || ""), hash(`Bearer ${secret}`))) {
    return sendJson(response, 401, { error: "Clave administrativa incorrecta." })
  }

  try {
    if (!id && request.method === "GET") {
      const { rows } = await pool.query(
        "SELECT id, nombre, correo, rol, activo FROM public.usuarios_locales ORDER BY nombre, id",
      )
      return sendJson(response, 200, { usuarios: rows })
    }
    if ((!id && request.method !== "POST") || (id && request.method !== "PATCH")) {
      return sendJson(response, 405, { error: "Método no permitido." })
    }
    const body = await readJson(request)
    if (!body || typeof body !== "object" || Array.isArray(body) || !adminRoles.has(body.rol)) {
      return sendJson(response, 400, { error: "Selecciona un rol válido." })
    }
    const password = body.password
    if (password !== undefined && password !== "" &&
      (typeof password !== "string" || password.length < 12 || password.length > 128)) {
      return sendJson(response, 400, { error: "Usa una contraseña de 12 a 128 caracteres." })
    }
    const hashed = password ? await passwordHash(password) : null
    if (id) {
      if (typeof body.activo !== "boolean") {
        return sendJson(response, 400, { error: "Indica si el perfil está activo." })
      }
      const result = await pool.query(
        `WITH changed AS (
           UPDATE public.usuarios_locales SET rol = $2, activo = $3,
             password_hash = coalesce($4, password_hash) WHERE id = $1 RETURNING id
         ), revoked AS (
           DELETE FROM public.sesiones_locales WHERE usuario_id IN (SELECT id FROM changed)
             AND (NOT $3 OR $4 IS NOT NULL)
         ) SELECT id FROM changed`,
        [id, body.rol, body.activo, hashed],
      )
      return result.rowCount
        ? sendJson(response, 200, { id })
        : sendJson(response, 404, { error: "El perfil no existe." })
    }
    const name = optionalText(body, "nombre", 160)
    const email = optionalText(body, "correo", 254)?.toLowerCase()
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(response, 400, { error: "Indica un nombre y un correo válidos." })
    }
    const { rows } = await pool.query(
      "INSERT INTO public.usuarios_locales (nombre, correo, rol, password_hash) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, email, body.rol, hashed],
    )
    return sendJson(response, 201, rows[0])
  } catch (error) {
    if (error.status) return sendJson(response, error.status, { error: error.message })
    if (error.code === "23505") return sendJson(response, 409, { error: "Ya existe un perfil con ese correo." })
    if (["42P01", "42501"].includes(error.code)) {
      return sendJson(response, 503, { error: "Aplica el SQL de usuarios locales en SIGEP." })
    }
    console.error("Error en administración local:", error.code)
    return sendJson(response, 500, { error: "No fue posible procesar el perfil." })
  }
}
const catalogQueries = {
  propietarios: `SELECT id, nombre_completo AS titulo,
    jsonb_build_object('Nombre', nombre_completo) AS datos, creado_en, actualizado_en
    FROM public.propietarios ORDER BY nombre_completo, id LIMIT 100`,
  municipios_fundos: `SELECT id, nombre AS titulo,
    jsonb_build_object('Nombre fundo', nombre) AS datos, creado_en, actualizado_en
    FROM public.fundos ORDER BY nombre, id LIMIT 100`,
  titulos_formatos: `SELECT id, folio AS titulo, jsonb_strip_nulls(jsonb_build_object(
      'Folio título', folio, 'Número título', numero_titulo, 'Libro título', libro,
      'Fecha del título', fecha_titulo, 'Estado', coalesce(estado_fundos, estado))) AS datos,
    created_at AS creado_en, coalesce(actualizado_en, created_at) AS actualizado_en
    FROM public.expedientes
    WHERE numero_titulo IS NOT NULL OR libro IS NOT NULL OR fecha_titulo IS NOT NULL
    ORDER BY created_at DESC, id DESC LIMIT 100`,
  historico_reportes: `SELECT m.id, e.folio AS titulo, jsonb_strip_nulls(jsonb_build_object(
      'Folio', e.folio, 'Estado', m.estado, 'Etapa', m.etapa_destino,
      'Área', m.area_destino, 'Observaciones', m.observaciones,
      'Nombre', s.nombre, 'Municipio', predios.municipios, 'Fundo', predios.fundos,
      'Manzana', predios.manzanas, 'Lote', predios.lotes, 'Libro', predios.libros)) AS datos,
    m.created_at AS creado_en, m.created_at AS actualizado_en
    FROM public.movimientos_expediente m JOIN public.expedientes e ON e.id = m.expediente_id
    JOIN public.solicitantes s ON s.id = e.solicitante_id
    LEFT JOIN LATERAL (
      SELECT string_agg(DISTINCT p.municipio::text, ', ') AS municipios,
        string_agg(DISTINCT p.fundo::text, ', ') AS fundos,
        string_agg(DISTINCT p.manzana::text, ', ') AS manzanas,
        string_agg(DISTINCT p.lote::text, ', ') AS lotes,
        string_agg(DISTINCT p.libro::text, ', ') AS libros
      FROM public.expediente_predios ep JOIN public.predios p ON p.id = ep.predio_id
      WHERE ep.expediente_id = e.id
    ) predios ON true
    ORDER BY m.created_at DESC, m.id DESC LIMIT 100`,
  configuracion_seguridad: `SELECT o.id, o.nombre AS titulo,
    jsonb_build_object('Membresías registradas', count(m.usuario_id)) AS datos,
    o.creado_en, o.creado_en AS actualizado_en
    FROM public.organizaciones o LEFT JOIN public.miembros_organizacion m ON m.organizacion_id = o.id
    GROUP BY o.id, o.nombre, o.creado_en ORDER BY o.nombre, o.id LIMIT 100`,
}

async function listModuleRecords(module, response) {
  try {
    const { rows } = await pool.query(catalogQueries[module])
    return sendJson(response, 200, { registros: rows })
  } catch (error) {
    console.error("No se pudo consultar el módulo:", module, error.code)
    if (["42P01", "42703", "42501"].includes(error.code)) {
      return sendJson(response, 503, { error: "El módulo requiere el esquema unificado y los permisos de lectura de SIGEP." })
    }
    return sendJson(response, 500, { error: "No fue posible consultar el módulo." })
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost")

  if (url.pathname === "/health" && request.method === "GET") {
    try {
      await pool.query("SELECT 1")
      return sendJson(response, 200, { status: "ok" })
    } catch {
      return sendJson(response, 503, { status: "database_unavailable" })
    }
  }

  const adminMatch = url.pathname.match(/^\/api\/admin\/usuarios(?:\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}))?$/i)
  if (adminMatch) return manageLocalUsers(request, response, adminMatch[1])

  if (["/api/sesion", "/api/sesion/entrar", "/api/sesion/salir"].includes(url.pathname)) {
    return localSession(request, response, url.pathname)
  }

  let user
  try {
    user = await currentLocalUser(request)
    if (!user) return sendJson(response, 401, { error: "Inicia sesión en SIGEP." })
    if (!routePermission(url.pathname, request.method, localPermissions(user.rol))) {
      return sendJson(response, 403, { error: "Tu rol no permite esta operación." })
    }
  } catch (error) {
    console.error("Error al validar sesión:", error.code)
    return sendJson(response, 503, { error: "El acceso local no está disponible." })
  }

  if (url.pathname === "/api/campo") {
    try {
      const { rows: mediciones } = await pool.query(
        `SELECT m.expediente_id, m.predio_id, m.estado, m.fecha_compromiso,
           e.folio, p.clave_catastral
         FROM public.mediciones_expediente m
         JOIN public.expedientes e ON e.id = m.expediente_id
         JOIN public.predios p ON p.id = m.predio_id
         WHERE m.estado IN ('solicitado', 'asignado', 'visitado')
           AND e.estado NOT IN ('cerrado', 'entregado', 'no_procede')
           AND ($1 IS DISTINCT FROM 'topografia' OR m.responsable_id = $2)
         ORDER BY m.fecha_compromiso NULLS LAST, m.expediente_id, m.predio_id`,
        [user.rol, user.id],
      )
      const topografos = user.rol === "topografia" ? [] : (await pool.query(
        "SELECT id, nombre FROM public.usuarios_locales WHERE rol = 'topografia' AND activo ORDER BY nombre, id",
      )).rows
      return sendJson(response, 200, { mediciones, topografos })
    } catch (error) {
      console.error("Error en bandeja de campo:", error.code)
      return sendJson(response, 503, { error: "No se pudo consultar la bandeja. Verifica las migraciones de medición." })
    }
  }

  const moduleMatch = url.pathname.match(/^\/api\/modulos\/([a-z_]+)$/)
  if (moduleMatch && Object.hasOwn(catalogQueries, moduleMatch[1])) {
    if (request.method === "GET") return listModuleRecords(moduleMatch[1], response)
    return sendJson(response, 405, { error: "Método no permitido." })
  }

  if (url.pathname === "/api/pagos") {
    if (request.method === "GET" || request.method === "POST") return pagosExpediente(request, response, url)
    return sendJson(response, 405, { error: "Método no permitido." })
  }

  if (url.pathname === "/api/expedientes") {
    if (request.method === "POST") return createExpediente(request, response)
    if (request.method === "GET") return searchExpedientes(url, response)
    return sendJson(response, 405, { error: "Método no permitido." })
  }

  const measurementMatch = url.pathname.match(/^\/api\/expedientes\/(\d+)\/predios\/(\d+)\/medicion$/)
  if (measurementMatch) {
    if (request.method === "GET" || request.method === "POST") {
      return expedienteMedicion(request, response, measurementMatch[1], measurementMatch[2], user)
    }
    return sendJson(response, 405, { error: "Método no permitido." })
  }

  const expedienteMatch = url.pathname.match(/^\/api\/expedientes\/(\d+)$/)
  if (expedienteMatch) {
    if (request.method === "GET") return getExpediente(expedienteMatch[1], response)
    return sendJson(response, 405, { error: "Método no permitido." })
  }

  if (url.pathname === "/api/fundos/predio") {
    if (request.method === "GET") return getFundosPredio(url, response)
    return sendJson(response, 405, { error: "Método no permitido." })
  }

  if (url.pathname === "/api/predios/mapa") {
    if (request.method === "GET") return getMapPredios(url, response)
    return sendJson(response, 405, { error: "Método no permitido." })
  }

  const geometryMatch = url.pathname.match(/^\/api\/predios\/(\d+)\/geometria$/)
  if (geometryMatch) {
    if (request.method === "PATCH") return updatePredioGeometry(request, response, geometryMatch[1])
    return sendJson(response, 405, { error: "Método no permitido." })
  }

  const geometryHistoryMatch = url.pathname.match(/^\/api\/predios\/(\d+)\/historial-geometria$/)
  if (geometryHistoryMatch) {
    if (request.method === "GET") return getPredioGeometryHistory(geometryHistoryMatch[1], response)
    return sendJson(response, 405, { error: "Método no permitido." })
  }

  if (url.pathname !== "/api/predios") {
    return sendJson(response, 404, { error: "Ruta no encontrada." })
  }

  if (request.method === "POST") return createPredio(request, response)
  if (request.method !== "GET") return sendJson(response, 405, { error: "Método no permitido." })

  try {
    const textFilters = [
      ["clave_catastral", "clave_catastral"],
      ["id_predio", "id_predio"],
      ["id_predio_cart", "id_predio_cart"],
      ["municipio", "municipio"],
      ["fundo", "fundo"],
      ["manzana", "manzana"],
      ["lote", "lote"],
      ["libro", "libro"],
      ["titulo", "titulo"],
    ]
    const conditions = []
    const values = []
    const addValue = (value) => {
      values.push(value)
      return `$${values.length}`
    }

    for (const [parameter, column] of textFilters) {
      // Keep compatibility with the first version of the map search.
      const raw = url.searchParams.get(parameter) || (parameter === "clave_catastral" ? url.searchParams.get("clave") : "")
      const value = raw?.trim()
      if (!value) continue
      if (value.length > 100) return sendJson(response, 400, { error: `El filtro ${parameter} es demasiado largo.` })
      conditions.push(`COALESCE(${column}, '') ILIKE ${addValue(`%${value}%`)}`)
    }

    const status = url.searchParams.get("status")?.trim()
    if (status) {
      if (!/^-?\d+$/.test(status)) return sendJson(response, 400, { error: "El estatus debe ser un código numérico." })
      conditions.push(`status = ${addValue(Number(status))}`)
    }

    const estadoMedicion = url.searchParams.get("estado_medicion")?.trim()
    if (estadoMedicion) {
      if (!["medido", "no_medido", "sin_confirmar"].includes(estadoMedicion)) {
        return sendJson(response, 400, { error: "Selecciona una condición de medición válida." })
      }
      conditions.push(`estado_medicion = ${addValue(estadoMedicion)}`)
    }

    for (const [parameter, operator] of [["superficie_min", ">="], ["superficie_max", "<="]]) {
      const raw = url.searchParams.get(parameter)?.trim()
      if (!raw) continue
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 0) return sendJson(response, 400, { error: `El filtro ${parameter} debe ser un número positivo.` })
      conditions.push(`superficie ${operator} ${addValue(value)}`)
    }

    const validDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false
      const [year, month, day] = value.split("-").map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    }
    const dateFrom = url.searchParams.get("fecha_titulo_desde")?.trim()
    const dateTo = url.searchParams.get("fecha_titulo_hasta")?.trim()
    if (dateFrom && !validDate(dateFrom)) return sendJson(response, 400, { error: "La fecha inicial debe tener formato AAAA-MM-DD." })
    if (dateTo && !validDate(dateTo)) return sendJson(response, 400, { error: "La fecha final debe tener formato AAAA-MM-DD." })
    if (dateFrom && dateTo && dateFrom > dateTo) return sendJson(response, 400, { error: "La fecha inicial no puede ser posterior a la fecha final." })
    if (dateFrom) conditions.push(`fecha_titulo >= ${addValue(dateFrom)}::date`)
    if (dateTo) conditions.push(`fecha_titulo <= ${addValue(dateTo)}::date`)

    if (conditions.length === 0) {
      return sendJson(response, 400, { error: "Indica al menos un filtro para buscar predios." })
    }

    const { rows } = await pool.query(
      `SELECT id, clave_catastral, id_predio, id_predio_cart, status,
         municipio, fundo, manzana, lote, superficie, libro, titulo,
         fecha_titulo, estado_medicion, fecha_medicion, observaciones_medicion,
         ST_AsGeoJSON(geom)::json AS geometry
       FROM predios
       WHERE ${conditions.join(" AND ")}
       ORDER BY clave_catastral
       LIMIT 101`,
      values,
    )
    const hasMore = rows.length > 100
    const features = rows.slice(0, 100).map(({ geometry, ...properties }) => ({
      type: "Feature",
      geometry,
      properties,
    }))
    return sendJson(response, 200, { type: "FeatureCollection", features, hasMore })
  } catch {
    return sendJson(response, 500, { error: "No fue posible consultar el predio." })
  }
})

server.listen(port, "0.0.0.0", () => {
  console.log(`SIGEP predio API listening on ${port}`)
})

async function shutdown() {
  server.close()
  await pool.end()
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
