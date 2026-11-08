import test from 'node:test'
import assert from 'node:assert/strict'
import { routes, allowedRoute, resolveRoute } from '../src/lib/routes.js'

test('Finanzas cannot open restricted deep links', () => {
  for (const route of routes) {
    assert.equal(allowedRoute(route, 'finanzas'), route.path === '/pagos')
    assert.equal(resolveRoute(`#${route.path}`, 'finanzas').path, '/pagos')
  }
})

test('Administration routes require an administrative membership', () => {
  for (const role of ['viewer', 'captura', 'legal', 'jefatura']) {
    assert.equal(resolveRoute('#/configuracion', role).path, '/inicio')
  }
  assert.equal(resolveRoute('#/configuracion', 'admin').path, '/configuracion')
  assert.equal(resolveRoute('#/configuracion', 'owner').path, '/configuracion')
})

test('Unknown roles fail closed and invalid URLs fall back internally', () => {
  assert.equal(resolveRoute('#/pagos', 'unknown'), undefined)
  assert.equal(resolveRoute('#https://example.com', 'viewer').path, '/inicio')
  assert.equal(resolveRoute('#/tramites', 'legal').path, '/tramites')
})
