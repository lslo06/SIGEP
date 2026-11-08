const workerRoles = new Set(['admin', 'viewer', 'ventanilla', 'direccion', 'jefatura', 'legal', 'caja', 'finanzas', 'digitalizacion', 'captura', 'titulacion', 'informatica'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const response = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Las dependencias se inyectan para probar autorización y compensación sin crear cuentas reales.
export function createWorkerHandler(service) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return response(405, { error: 'Método no permitido.' })
    const authorization = request.headers.get('Authorization') || ''
    if (!/^Bearer\s+\S+$/i.test(authorization)) return response(401, { error: 'Inicia sesión nuevamente.' })
    let createdId = null
    try {
      // getUser verifica el token con Auth; nunca se acepta el usuario o rol enviado por el cliente.
      const { data: auth, error: authError } = await service.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
      if (authError || !auth?.user) return response(401, { error: 'Tu sesión venció. Inicia sesión nuevamente.' })
      const size = Number(request.headers.get('Content-Length') || 0)
      if (size > 16384) return response(413, { error: 'Solicitud demasiado grande.' })
      const raw = await request.text()
      if (raw.length > 16384) return response(413, { error: 'Solicitud demasiado grande.' })
      let body
      try { body = JSON.parse(raw) } catch { return response(400, { error: 'Solicitud inválida.' }) }
      if (!body || Array.isArray(body) || typeof body !== 'object') return response(400, { error: 'Solicitud inválida.' })
      const { organizacion_id: org, rol, password } = body
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
      if (!uuid.test(org || '') || !workerRoles.has(rol)) return response(400, { error: 'Selecciona una organización y un rol válidos.' })
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || nombre.length > 160) return response(400, { error: 'Revisa el nombre y el correo del trabajador.' })
      if (typeof password !== 'string' || password.length < 12 || password.length > 128) return response(400, { error: 'La contraseña debe tener de 12 a 128 caracteres.' })
      const { data: membership, error: memberError } = await service.from('miembros_organizacion')
        .select('rol, activo').eq('organizacion_id', org).eq('usuario_id', auth.user.id).maybeSingle()
      if (memberError) return response(503, { error: 'El alta de trabajadores aún no está habilitada. Contacta al responsable de instalación.' })
      if (!membership?.activo || !['owner', 'admin'].includes(membership.rol)) return response(403, { error: 'Solo el personal administrativo puede dar de alta trabajadores.' })

      const { data: created, error: createError } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } })
      if (createError) {
        if (['email_exists', 'user_already_exists'].includes(createError.code) || createError.status === 422 && /already.*registered|already.*exists/i.test(createError.message || '')) {
          return response(409, { error: 'Ese correo ya tiene una cuenta. Usa “Asignar cuenta existente” para darle acceso sin cambiar su contraseña.' })
        }
        if (createError.code === 'weak_password') return response(400, { error: 'La contraseña no cumple la política de seguridad. Usa una contraseña más larga y evita contraseñas comunes.' })
        return response(502, { error: 'No se pudo crear la cuenta. Revisa los datos e intenta nuevamente.' })
      }
      if (!created?.user?.id) return response(502, { error: 'No se pudo confirmar la creación de la cuenta.' })
      createdId = created.user.id
      // Revalida al administrador dentro de la transacción que asigna la membresía.
      const { error: linkError } = await service.rpc('vincular_trabajador_sgfl', {
        p_actor: auth.user.id, p_organizacion_id: org, p_usuario_id: createdId, p_rol: rol,
      })
      if (linkError) throw new Error('membership_failed')
      createdId = null
      return response(201, { ok: true, usuario: { id: created.user.id, email, rol } })
    } catch {
      if (createdId) {
        try {
          const { error } = await service.auth.admin.deleteUser(createdId)
          if (error) return response(503, { error: 'La cuenta se creó, pero no se pudo asignar el acceso. Usa “Asignar cuenta existente” para completar el alta; no vuelvas a crearla.' })
        } catch {
          return response(503, { error: 'La cuenta se creó, pero no se pudo confirmar el acceso. Revisa la lista y usa “Asignar cuenta existente” si hace falta.' })
        }
      }
      return response(503, { error: 'No se pudo completar el alta. Intenta nuevamente.' })
    }
  }
}
