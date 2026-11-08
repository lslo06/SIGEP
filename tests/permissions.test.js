import test from 'node:test'
import assert from 'node:assert/strict'
import { roles, canModule, canCapture, canWork } from '../src/lib/permissions.js'
import { stagesFor, stageFor, overdue } from '../src/lib/workflow.js'

test('Finanzas consulta únicamente pagos y nunca captura o autoriza', () => {
  for (const key of ['lotes_predios','propietarios','municipios_fundos','pagos_servicios','titulos_formatos','historico_reportes','configuracion_seguridad']) {
    assert.equal(canModule('finanzas', key), key === 'pagos_servicios')
    assert.equal(canModule('finanzas', key, true), false)
  }
  assert.equal(canCapture('finanzas'), false)
  assert.equal(canWork('finanzas', ['caja']), false)
})
test('Roles operativos separan captura, documentos, títulos y administración', () => {
  assert.equal(canCapture('ventanilla'), true)
  assert.equal(canCapture('direccion'), false)
  assert.equal(canModule('viewer','titulos_formatos',true),false)
  assert.equal(canModule('titulacion','titulos_formatos',true),true)
  assert.equal(canModule('legal','propietarios',true),false)
  assert.equal(canModule('jefatura','configuracion_seguridad'),false)
  assert.equal(canModule('desconocido','pagos_servicios'),false)
  assert.ok(roles.digitalizacion && roles.informatica)
})
test('Procesos conservan el orden y excluyen las etapas cartográficas externas', () => {
  assert.equal(stagesFor('Titulación').length,12)
  assert.equal(stagesFor('Búsqueda de información').length,9)
  for (const excluded of ['TIT-02','TIT-03','TIT-04','TIT-05','TIT-15']) assert.ok(!stagesFor('Titulación').some(s => s[0]===excluded))
  assert.equal(stageFor({tipo:'Búsqueda de información'},null)[0],'BUS-01')
  assert.equal(overdue({ fecha_compromiso:'2026-11-01',cerrado:false },'2026-11-03'),true)
  assert.equal(overdue({ fecha_compromiso:'2026-11-01',cerrado:true },'2026-11-03'),false)
})
