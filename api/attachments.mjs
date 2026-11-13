import { createHash } from 'node:crypto'
import path from 'node:path'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const MAX_MULTIPART_OVERHEAD = 64 * 1024
const CRLF = Buffer.from('\r\n')

function httpError(status, message) {
  return Object.assign(new Error(message), { status })
}

function safeFilename(value) {
  const base = path.posix.basename(String(value).replaceAll('\\', '/'))
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 160)
  if (!base || base === '.' || base === '..') throw httpError(400, 'El nombre del archivo no es válido.')
  return base
}

function mediaTypeFor(buffer, filename) {
  const extension = path.extname(filename).toLocaleLowerCase('en-US')
  if (buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) && extension === '.pdf') return 'application/pdf'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && extension === '.png') return 'image/png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && ['.jpg', '.jpeg'].includes(extension)) return 'image/jpeg'
  throw httpError(415, 'Formato no permitido. Usa PDF, JPG o PNG sin cambiar su extensión.')
}

/** Read exactly one multipart field named "archivo", with a strict total size cap. */
export async function readAttachmentUpload(request, maxBytes = MAX_ATTACHMENT_BYTES) {
  const contentType = request.headers['content-type'] || ''
  const boundaryMatch = contentType.match(/^multipart\/form-data\s*;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i)
  if (!boundaryMatch) throw httpError(415, 'Adjunta un archivo con el formulario de carga.')
  const boundary = boundaryMatch[1] || boundaryMatch[2]
  if (!boundary || boundary.length > 70 || /[^\x21-\x7e]/.test(boundary)) throw httpError(400, 'El formulario de carga no es válido.')

  const requestLimit = maxBytes + MAX_MULTIPART_OVERHEAD
  const declaredLength = Number(request.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > requestLimit) throw httpError(413, 'El archivo no puede superar 10 MB.')

  const chunks = []
  let total = 0
  for await (const chunk of request) {
    total += chunk.length
    if (total > requestLimit) throw httpError(413, 'El archivo no puede superar 10 MB.')
    chunks.push(Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks, total)
  const delimiter = Buffer.from(`--${boundary}`)
  const headerSeparator = Buffer.from('\r\n\r\n')
  if (!body.subarray(0, delimiter.length).equals(delimiter) || body.subarray(delimiter.length, delimiter.length + 2).toString() !== '\r\n') {
    throw httpError(400, 'El formulario de carga no es válido.')
  }

  const headersStart = delimiter.length + 2
  const headersEnd = body.indexOf(headerSeparator, headersStart)
  if (headersEnd < 0) throw httpError(400, 'El formulario de carga no es válido.')
  const headers = body.subarray(headersStart, headersEnd).toString('latin1')
  const disposition = headers.match(/^content-disposition:\s*form-data;\s*name="archivo";\s*filename="((?:\\.|[^"])*)"\s*$/im)
  if (!disposition) throw httpError(400, 'El formulario debe contener un único archivo en el campo archivo.')
  const rawName = disposition[1].replace(/\\(["\\])/g, '$1')
  const dataStart = headersEnd + headerSeparator.length
  const nextBoundary = body.indexOf(Buffer.concat([CRLF, delimiter]), dataStart)
  if (nextBoundary < 0) throw httpError(400, 'El formulario de carga está incompleto.')
  const endStart = nextBoundary + CRLF.length + delimiter.length
  if (body.subarray(endStart, endStart + 2).toString() !== '--') {
    throw httpError(400, 'El formulario debe contener un único archivo.')
  }

  const filename = safeFilename(rawName)
  const buffer = body.subarray(dataStart, nextBoundary)
  if (!buffer.length) throw httpError(400, 'El archivo está vacío.')
  if (buffer.length > maxBytes) throw httpError(413, 'El archivo no puede superar 10 MB.')
  const mimeType = mediaTypeFor(buffer, filename)
  return {
    filename,
    mimeType,
    buffer,
    size: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}

export function canUploadAttachment({ type, role, userId, measurement }) {
  if (type === 'evidencia_visita') {
    return role === 'topografia'
      && measurement?.estado === 'visitado'
      && measurement?.responsable_id === userId
  }
  if (type === 'plano') {
    return ['admin', 'cartografia'].includes(role)
      && ['medido', 'visitado'].includes(measurement?.estado)
  }
  return false
}

export function canReadAttachment({ type, role, userId, measurement }) {
  if (role === 'admin') return true
  const measurementComplete = ['medido', 'visitado'].includes(measurement?.estado)
  if (role === 'cartografia') return measurementComplete
  return type === 'evidencia_visita'
    && role === 'topografia'
    && measurement?.estado === 'visitado'
    && measurement?.responsable_id === userId
}
