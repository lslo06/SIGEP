import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithEsbuild } from 'vite'

// Render the actual JSX without a browser/network. Effects and user interaction
// are not executed here; API tests cover the write and review permissions.
const sourceUrl = new URL('../src/components/map/ExpedienteDocumentacion.jsx', import.meta.url)
const require = createRequire(sourceUrl)
const { code } = await transformWithEsbuild(readFileSync(sourceUrl, 'utf8'), sourceUrl.pathname, { loader: 'jsx', jsx: 'automatic' })
const resolved = code.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
  const url = name.startsWith('.') ? new URL(name, sourceUrl) : pathToFileURL(require.resolve(name))
  return `from ${JSON.stringify(url.href)}`
})
const { default: Documentation } = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`)
const expediente = { id: 12, tipo_tramite: 'titulacion', estado: 'recibido', predios: [{ id: 31, clave_catastral: 'PRUEBA-031' }] }

test('Capture has the cadastral form while Informatics and reception have read-only cadastral sections', () => {
  const capture = renderToStaticMarkup(createElement(Documentation, { expediente, role: 'captura' }))
  assert.match(capture, /Guardar cédula y propietarios/)
  for (const role of ['informatica', 'ventanilla', 'titulacion']) {
    const html = renderToStaticMarkup(createElement(Documentation, { expediente, role }))
    assert.match(html, /Cédula catastral y propietarios/)
    assert.doesNotMatch(html, /Guardar cédula y propietarios/)
    assert.doesNotMatch(html, /Aceptar datos|Rechazar datos/)
  }
})

test('Closed-case documentation hides upload and cadastral editing forms', () => {
  for (const role of ['admin', 'cartografia', 'captura', 'digitalizacion']) {
    const html = renderToStaticMarkup(createElement(Documentation, { expediente: { ...expediente, estado: 'cerrado' }, role }))
    assert.doesNotMatch(html, /Guardar cédula y propietarios|Adjuntar documento/)
  }
})
