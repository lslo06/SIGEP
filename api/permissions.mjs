// Shared by the API, navigation and permission tests.
export const roles = {
  admin: 'Administración', ventanilla: 'Ventanilla', direccion: 'Dirección',
  jefatura: 'Jefatura de Fundos Legales', legal: 'Área Legal',
  cartografia: 'Cartografía y Valuación', topografia: 'Topografía',
  caja: 'Caja / Recaudación', digitalizacion: 'Digitalización', captura: 'Captura',
  titulacion: 'Titulación', informatica: 'Informática', viewer: 'Consulta / Auditoría',
}
export const roleModules = {
  admin: ['*'],
  ventanilla: ['inicio', 'tramites', 'lotes_predios', 'propietarios', 'municipios_fundos'],
  caja: ['pagos_servicios'], finanzas: ['pagos_servicios'],
  topografia: ['lotes_predios'],
  cartografia: ['inicio', 'tramites', 'lotes_predios', 'municipios_fundos'],
  titulacion: ['inicio', 'tramites', 'lotes_predios', 'titulos_formatos'],
  viewer: ['inicio', 'tramites', 'lotes_predios', 'titulos_formatos', 'historico_reportes'],
  direccion: ['inicio', 'tramites', 'historico_reportes'],
  jefatura: ['inicio', 'tramites', 'historico_reportes'],
  legal: ['inicio', 'tramites'], digitalizacion: ['inicio', 'tramites'],
  captura: ['inicio', 'tramites', 'lotes_predios', 'propietarios'],
  informatica: ['inicio', 'tramites', 'lotes_predios'],
}
export const documentReaders = ['admin', 'ventanilla', 'direccion', 'jefatura', 'legal',
  'digitalizacion', 'captura', 'titulacion', 'informatica', 'viewer', 'cartografia', 'topografia']
// Reception orders are independent of a definitive parcel. Both UI and API use this map.
export const initialVisitTransitions = {
  solicitar: { from: null, to: 'revision_direccion', roles: ['ventanilla', 'admin'], area: 'Dirección', label: 'Solicitar medición' },
  enviar_fundos: { from: 'revision_direccion', to: 'revision_jefatura', roles: ['direccion', 'admin'], area: 'Jefatura de Fundos Legales', label: 'Canalizar a Fundos Legales' },
  enviar_cartografia: { from: 'revision_jefatura', to: 'solicitado', roles: ['jefatura', 'admin'], area: 'Cartografía y Valuación', label: 'Canalizar a Cartografía' },
  asignar: { from: 'solicitado', to: 'asignado', roles: ['cartografia', 'admin'], area: 'Topografía', label: 'Asignar visita' },
  registrar_visita: { from: 'asignado', to: 'visitado', roles: ['topografia'], area: 'Cartografía y Valuación', label: 'Registrar visita' },
}
export function localPermissions(role) {
  return {
    modulos: Object.hasOwn(roleModules, role) ? roleModules[role] : [],
    altaPredio: ['admin', 'cartografia', 'captura'].includes(role),
    geometria: ['admin', 'cartografia'].includes(role),
    altaExpediente: ['admin', 'ventanilla', 'captura'].includes(role),
    dictamen: role === 'legal', pagos: ['admin', 'caja'].includes(role),
    campo: ['admin', 'cartografia', 'topografia'].includes(role),
    medicion: ['admin', 'ventanilla', 'cartografia', 'topografia'].includes(role),
    archivos: documentReaders.includes(role), evidenciaVisita: role === 'topografia',
    plano: ['admin', 'cartografia'].includes(role),
    documentacion: ['admin', 'cartografia', 'digitalizacion', 'captura', 'ventanilla'].includes(role),
    revisionDocumentos: ['admin', 'cartografia', 'digitalizacion'].includes(role),
    catastro: ['admin', 'cartografia'].includes(role),
    lecturaCatastro: ['admin', 'cartografia', 'digitalizacion', 'captura', 'ventanilla', 'titulacion'].includes(role),
  }
}
