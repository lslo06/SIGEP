import { useState } from 'react'
import { roles } from '../lib/permissions'

const labels = roles
const options = Object.entries(labels).filter(([role]) => !['owner', 'editor'].includes(role))

export default function LocalAdministration() {
  const [key, setKey] = useState('')
  const [users, setUsers] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function request(path = '', method = 'GET', data) {
    const response = await fetch('/api/sigep/admin/usuarios' + path, {
      method,
      headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'No se pudo acceder a Administración.')
    return payload
  }

  async function run(event, id) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    setBusy(true)
    setMessage('')
    try {
      if (users !== null) {
        if (id) await request('/' + id, 'PATCH', { rol: data.rol, activo: data.activo === 'on', password: data.password })
        else await request('', 'POST', data)
      }
      setUsers((await request()).usuarios)
      if (!id) form.reset()
      else form.elements.namedItem('password').value = ''
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="users-workspace">
    <header><h1>Administración</h1><p>Perfiles locales y roles asignados.</p></header>
    {message && <p className="sgfl-error" role="alert">{message}</p>}
    {users === null ? <form className="users-card sgfl-fields" onSubmit={run}>
      <label>Clave administrativa<input type="password" value={key} onChange={e => setKey(e.target.value)} required /></label>
      <button className="primary-button" disabled={busy}>Abrir Administración</button>
    </form> : <>
      <form className="users-card sgfl-fields" onSubmit={run}>
        <label>Nombre<input name="nombre" required maxLength={160} /></label>
        <label>Correo<input name="correo" type="email" required maxLength={254} /></label>
        <label>Rol<select name="rol">{options.map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>
        <label>Contraseña inicial<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <button className="primary-button" disabled={busy}>Agregar perfil</button>
      </form>
      <section className="users-card">
        <h2>Perfiles registrados</h2>
        {users.length === 0 && <p>Aún no hay perfiles registrados.</p>}
        {users.map(user => <form key={`${user.id}:${user.rol}:${user.activo}`} className="sgfl-fields" onSubmit={event => run(event, user.id)}>
          <div><strong>{user.nombre}</strong><p>{user.correo}</p></div>
          <label>Rol<select name="rol" defaultValue={user.rol}>{options.map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>
          <label><input name="activo" type="checkbox" defaultChecked={user.activo} /> Activo</label>
          <label>Nueva contraseña (opcional)<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} /></label>
          <button className="secondary-button" disabled={busy}>Guardar cambios</button>
        </form>)}
      </section>
      <button className="secondary-button" disabled={busy} onClick={() => { setKey(''); setUsers(null); setMessage('') }}>Cerrar Administración</button>
    </>}
  </section>
}
