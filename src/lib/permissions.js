import { roles, localPermissions } from '../../api/permissions.mjs'
export { roles, localPermissions }
export const isAdmin = role => role === 'admin'
export const canCapture = role => localPermissions(role).altaExpediente
export function canModule(role, key, write = false) {
 const p = localPermissions(role)
 if (!write) return key === 'campo' ? p.campo : p.modulos.includes('*') || p.modulos.includes(key)
 if (key === 'pagos_servicios') return p.pagos
 if (key === 'lotes_predios') return p.altaPredio
 if (key === 'tramites') return p.altaExpediente
 if (key === 'configuracion_seguridad') return isAdmin(role)
 return false
}
export const canWork = (role, allowed) => isAdmin(role) || allowed.includes(role)
