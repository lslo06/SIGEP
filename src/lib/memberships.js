// Compatibilidad de lectura con instalaciones previas a la migración de roles.
// Nunca se usa este fallback ante errores de permisos, red o relaciones.
export function missingActiveColumn(error) {
  return ['42703', 'PGRST204'].includes(error?.code)
    && /(?:miembros_organizacion\.)?activo\b/i.test(error?.message || '')
}

export async function loadMemberships(client, userId) {
  const query = columns => client.from('miembros_organizacion')
    .select(columns).eq('usuario_id', userId).order('creado_en', { ascending: true })
  let result = await query('organizacion_id, rol, activo, organizacion:organizaciones(id, nombre)')
  if (missingActiveColumn(result.error)) {
    result = await query('organizacion_id, rol, organizacion:organizaciones(id, nombre)')
  }
  if (result.error) throw result.error
  return (result.data || []).filter(item => item.organizacion && item.activo !== false)
}
