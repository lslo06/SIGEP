import { canModule, roles } from './permissions.js'

export const routes = [
  { path: '/inicio', label: 'Inicio', key: 'inicio' },
  { path: '/tramites', label: 'Seguimiento de trámites', key: 'tramites' },
  { path: '/predios', label: 'Lotes y predios', key: 'lotes_predios' },
  { path: '/propietarios', label: 'Propietarios', key: 'propietarios' },
  { path: '/fundos', label: 'Municipios y fundos', key: 'municipios_fundos' },
  { path: '/pagos', label: 'Pagos y servicios', key: 'pagos_servicios' },
  { path: '/titulos', label: 'Títulos y formatos', key: 'titulos_formatos' },
  { path: '/reportes', label: 'Histórico y reportes', key: 'historico_reportes' },
  { path: '/configuracion', label: 'Configuración y seguridad', key: 'configuracion_seguridad' },
]

export function allowedRoute(route, role) {
  return Boolean(route && roles[role] && canModule(role, route.key))
}

export function resolveRoute(hash, role) {
  const route = routes.find(item => item.path === hash.replace(/^#/, ''))
  return allowedRoute(route, role) ? route : routes.find(item => allowedRoute(item, role))
}
