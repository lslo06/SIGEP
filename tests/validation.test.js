import test from 'node:test'
import assert from 'node:assert/strict'
import { positiveArea, validateDates, isPriority, localDate } from '../src/lib/validation.js'

test('superficie opcional, positiva y finita', () => {
  assert.equal(positiveArea(''), null)
  assert.equal(positiveArea('123.45'), 123.45)
  for (const value of [0, -1, 'abc', Infinity]) assert.throws(() => positiveArea(value))
})

test('entrega posterior o igual a solicitud', () => {
  assert.throws(() => validateDates({ fechaSolicitud: '2026-11-02', fechaEntrega: '2026-11-01' }))
  assert.doesNotThrow(() => validateDates({ fechaSolicitud: '2026-11-02', fechaEntrega: '2026-11-02' }))
  assert.doesNotThrow(() => validateDates({ fechaSolicitud: '2026-11-02', fechaEntrega: '' }))
})

test('prioridades coherentes, excluyendo expedientes cerrados', () => {
  for (const espera of ['Hoy', '1 día', '2 días']) assert.equal(isPriority({ estado: 'En trámite', espera }), true)
  for (const estado of ['Vigente', 'Cancelado']) assert.equal(isPriority({ estado, espera: 'Hoy' }), false)
  assert.equal(isPriority({ estado: 'En trámite', espera: '1 semana' }), false)
})

test('fecha de solicitud respeta el día de Ciudad de México', () => {
  assert.equal(localDate(new Date('2026-11-03T03:00:00Z')), '2026-11-02')
})
