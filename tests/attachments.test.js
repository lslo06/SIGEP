import test from 'node:test'
import assert from 'node:assert/strict'
import { canReadAttachment, canUploadAttachment, readAttachmentUpload } from '../api/attachments.mjs'

function multipartRequest({ boundary = 'sigep-test-boundary', filename = 'evidencia.pdf', bytes = Buffer.from('%PDF-1.7 prueba'), extraPart = false } = {}) {
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="archivo"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`,
    bytes,
    '\r\n',
  ]
  if (extraPart) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="otro"\r\n\r\nno\r\n`)
  parts.push(`--${boundary}--\r\n`)
  const body = Buffer.concat(parts.map(part => Buffer.isBuffer(part) ? part : Buffer.from(part)))
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) },
    async *[Symbol.asyncIterator]() { yield body },
  }
}

test('multipart parser accepts one PDF and returns a server-verified digest', async () => {
  const upload = await readAttachmentUpload(multipartRequest())
  assert.equal(upload.filename, 'evidencia.pdf')
  assert.equal(upload.mimeType, 'application/pdf')
  assert.equal(upload.buffer.toString(), '%PDF-1.7 prueba')
  assert.match(upload.sha256, /^[a-f0-9]{64}$/)
})

test('multipart parser rejects oversized, mismatched and multi-part uploads', async () => {
  await assert.rejects(readAttachmentUpload(multipartRequest({ bytes: Buffer.alloc(32, 65) }), 20), { status: 413 })
  await assert.rejects(readAttachmentUpload(multipartRequest({ filename: 'evidencia.png' })), { status: 415 })
  await assert.rejects(readAttachmentUpload(multipartRequest({ extraPart: true })), { status: 400 })
})

test('only the assigned topographer can attach evidence after recording the visit', () => {
  const measurement = { estado: 'visitado', responsable_id: 'topografo-1' }
  assert.equal(canUploadAttachment({ type: 'evidencia_visita', role: 'topografia', userId: 'topografo-1', measurement }), true)
  assert.equal(canUploadAttachment({ type: 'evidencia_visita', role: 'topografia', userId: 'topografo-2', measurement }), false)
  assert.equal(canUploadAttachment({ type: 'evidencia_visita', role: 'topografia', userId: 'topografo-1', measurement: { ...measurement, estado: 'asignado' } }), false)
})

test('Cartography can access plans after a completed measurement and is denied before it', () => {
  assert.equal(canUploadAttachment({ type: 'plano', role: 'cartografia', measurement: { estado: 'visitado' } }), true)
  assert.equal(canUploadAttachment({ type: 'plano', role: 'cartografia', measurement: { estado: 'medido' } }), true)
  assert.equal(canUploadAttachment({ type: 'plano', role: 'cartografia', measurement: { estado: 'asignado' } }), false)
  assert.equal(canUploadAttachment({ type: 'plano', role: 'topografia', measurement: { estado: 'visitado' } }), false)
  assert.equal(canReadAttachment({ type: 'plano', role: 'cartografia', measurement: { estado: 'visitado' } }), true)
  assert.equal(canReadAttachment({ type: 'evidencia_visita', role: 'topografia', userId: 'topografo-2', measurement: { estado: 'visitado', responsable_id: 'topografo-1' } }), false)
})
