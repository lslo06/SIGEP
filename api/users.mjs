import { createHash, timingSafeEqual } from 'node:crypto'
import { roles } from './permissions.mjs'

const snapshot = user => user ? Object.fromEntries(
  ['id', 'nombre', 'correo', 'rol', 'activo', 'eliminado_en'].map(key => [key, user[key] ?? null]),
) : null
const invalid = (status, message) => Object.assign(new Error(message), { status })

export function createUserManager({ pool, currentLocalUser, readJson, sendJson, passwordHash, env = process.env }) {
  return async function manageLocalUsers(request, response, id) {
    let client
    try {
      const secret = env.SIGEP_ADMIN_KEY
      const digest = value => createHash('sha256').update(value).digest()
      const recovery = secret?.length >= 32 && timingSafeEqual(
        digest(request.headers.authorization || ''), digest(`Bearer ${secret}`))
      const actor = recovery ? null : await currentLocalUser(request)
      if (!recovery && !actor) throw invalid(401, 'Inicia sesión con una cuenta de Administración.')
      if (!recovery && actor.rol !== 'admin') throw invalid(403, 'Solo Administración puede gestionar usuarios.')
      if (!id && request.method === 'GET') {
        const { rows } = await pool.query('SELECT id, nombre, correo, rol, activo FROM public.usuarios_locales WHERE eliminado_en IS NULL ORDER BY nombre, id')
        return sendJson(response, 200, { usuarios: rows })
      }
      if ((!id && request.method !== 'POST') || (id && !['PATCH', 'DELETE'].includes(request.method))) {
        throw invalid(405, 'Método no permitido.')
      }
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw invalid(415, 'Envía la solicitud en JSON.')
      const deleting = request.method === 'DELETE'
      const body = deleting ? {} : await readJson(request)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid(400, 'Indica los datos del usuario.')
      const name = typeof body.nombre === 'string' ? body.nombre.trim() : ''
      const email = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : ''
      if (!deleting && (!name || name.length > 160 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        throw invalid(400, 'Indica un nombre y un correo válidos.')
      }
      if (!deleting && (!Object.hasOwn(roles, body.rol) && !(id && body.rol === 'finanzas'))) throw invalid(400, 'Selecciona un rol válido.')
      if (id && !deleting && typeof body.activo !== 'boolean') throw invalid(400, 'Indica si el usuario está activo.')
      const password = body.password
      if (!deleting && ((!id && !password) || (password !== undefined && password !== '' &&
        (typeof password !== 'string' || password.length < 12 || password.length > 128)))) {
        throw invalid(400, 'Usa una contraseña de 12 a 128 caracteres.')
      }
      const hashed = password ? await passwordHash(password) : null
      client = await pool.connect()
      await client.query('BEGIN')
      // Serializes role changes, including concurrent attempts to remove the last admin.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('sigep.usuarios', 0))")
      let previous = null
      if (id) {
        const { rows } = await client.query('SELECT id, nombre, correo, rol, activo, eliminado_en FROM public.usuarios_locales WHERE id = $1 FOR UPDATE', [id])
        previous = rows[0]
        if (!previous || previous.eliminado_en) throw invalid(404, 'El usuario no existe o ya fue eliminado.')
        if (!deleting && body.rol === 'finanzas' && previous.rol !== 'finanzas') throw invalid(400, 'Finanzas es un perfil heredado; selecciona uno de los roles vigentes.')
        if (actor?.id === id && (deleting || !body.activo || body.rol !== 'admin')) {
          throw invalid(409, 'No puedes eliminar, desactivar ni quitar el rol administrador a tu propia cuenta.')
        }
        if (previous.rol === 'admin' && previous.activo && (deleting || !body.activo || body.rol !== 'admin')) {
          const { rows: [count] } = await client.query("SELECT count(*)::int AS total FROM public.usuarios_locales WHERE rol = 'admin' AND activo AND eliminado_en IS NULL")
          if (count.total <= 1) throw invalid(409, 'Debe quedar al menos una cuenta activa de Administración.')
        }
      }
      let saved
      if (deleting) {
        const { rows } = await client.query('UPDATE public.usuarios_locales SET activo = false, eliminado_en = now() WHERE id = $1 RETURNING id, nombre, correo, rol, activo, eliminado_en', [id])
        saved = rows[0]
      } else if (id) {
        const { rows } = await client.query(`UPDATE public.usuarios_locales SET nombre = $2, correo = $3, rol = $4, activo = $5,
          password_hash = coalesce($6, password_hash) WHERE id = $1 RETURNING id, nombre, correo, rol, activo, eliminado_en`,
        [id, name, email, body.rol, body.activo, hashed])
        saved = rows[0]
      } else {
        const { rows } = await client.query(`INSERT INTO public.usuarios_locales (nombre, correo, rol, password_hash)
          VALUES ($1, $2, $3, $4) RETURNING id, nombre, correo, rol, activo, eliminado_en`, [name, email, body.rol, hashed])
        saved = rows[0]
      }
      if (id) await client.query('DELETE FROM public.sesiones_locales WHERE usuario_id = $1', [id])
      await client.query(`INSERT INTO public.auditoria_usuarios (usuario_id, actor, accion, anterior, nuevo)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`, [saved.id, actor?.correo || 'recuperacion:clave-administrativa',
        deleting ? 'baja' : id ? 'edicion' : 'alta', JSON.stringify(snapshot(previous)), JSON.stringify(snapshot(saved))])
      await client.query('COMMIT')
      return sendJson(response, id ? 200 : 201, { id: saved.id, eliminado: deleting, reautenticar: actor?.id === id })
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      const status = error.status || (error.code === '23505' ? 409 : ['42P01', '42703', '42501'].includes(error.code) ? 503 : 500)
      const message = error.status ? error.message : error.code === '23505' ? 'Ese correo ya está registrado, incluso si el usuario fue dado de baja.'
        : status === 503 ? 'Aplica sql/enable_user_management.sql antes de gestionar usuarios.' : 'No se pudo guardar el usuario.'
      return sendJson(response, status, { error: message })
    } finally { client?.release() }
  }
}
