export const roles = {
  owner: 'Administrador principal', admin: 'Administración', editor: 'Captura general (heredado)',
  ventanilla: 'Ventanilla', direccion: 'Dirección', jefatura: 'Jefatura de Fundos Legales',
  legal: 'Área Legal', caja: 'Caja / Recaudación', finanzas: 'Finanzas · solo consulta',
  digitalizacion: 'Digitalización', captura: 'Captura', titulacion: 'Titulación',
  informatica: 'Informática', viewer: 'Consulta / Auditoría',
}
export const isAdmin = role => ['owner', 'admin'].includes(role)
export const canCapture = role => ['owner', 'admin', 'editor', 'ventanilla', 'captura'].includes(role)
export function canModule(role, key, write = false) {
  if (!roles[role]) return false
  if (role === 'finanzas') return !write && key === 'pagos_servicios'
  if (isAdmin(role)) return true
  if (key === 'configuracion_seguridad') return false
  if (!write) return true
  return ({
    lotes_predios: ['editor', 'captura'], propietarios: ['editor', 'ventanilla', 'captura'],
    municipios_fundos: [], pagos_servicios: ['caja'], titulos_formatos: ['titulacion'],
  }[key] || []).includes(role)
}
export const canWork = (role, allowed) => isAdmin(role) || allowed.includes(role)
