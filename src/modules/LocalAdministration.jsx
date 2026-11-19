import { useEffect, useState } from 'react'
import { roles } from '../lib/permissions'
const options = Object.entries(roles)

export default function LocalAdministration({ sessionAdmin = false }) {
  const [key, setKey] = useState('')
  const [users, setUsers] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [removing, setRemoving] = useState(null)

  async function request(path = '', method = 'GET', data) {
    const response = await fetch('/api/sigep/admin/usuarios' + path, {
      method, headers: { ...(!sessionAdmin ? { Authorization: `Bearer ${key.trim()}` } : {}), 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'No se pudo acceder a Administración.')
    return payload
  }
  useEffect(() => {
    if (sessionAdmin) request().then(data => setUsers(data.usuarios)).catch(error => setMessage(error.message))
  }, [sessionAdmin])

  async function run(event, id) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    setBusy(true); setMessage('')
    try {
      if (users !== null) {
        const saved = await request(id ? '/' + id : '', id ? 'PATCH' : 'POST', id ? { ...data, activo: data.activo === 'on' } : data)
        if (saved.reautenticar) { window.location.reload(); return }
      }
      setUsers((await request()).usuarios)
      if (!id) form.reset()
      else form.elements.namedItem('password').value = ''
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!removing || busy) return
    setBusy(true); setMessage('')
    try {
      await request('/' + removing.id, 'DELETE')
      setUsers((await request()).usuarios)
      setRemoving(null)
      setMessage('Usuario eliminado del acceso. Su historial se conserva.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  const roleSelect = current => <label>Rol<select name="rol" defaultValue={current || 'ventanilla'}>
    {current === 'finanzas' && <option value="finanzas">Finanzas (heredado, solo consulta)</option>}
    {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
  </select></label>
  return <section className="users-workspace">
    <header><h1>Administración</h1><p>Usuarios y 13 roles del proceso. Crea cuentas individuales para probar cada función.</p></header>
    <p>Editar un usuario cierra sus sesiones. Eliminarlo impide el acceso y conserva su historial; su correo permanece reservado.</p>
    {message && <p role="alert">{message}</p>}
    {users === null ? sessionAdmin ? <button className="secondary-button" onClick={() => request().then(data => setUsers(data.usuarios)).catch(error => setMessage(error.message))}>Cargar usuarios</button> :
      <form className="users-card sgfl-fields" onSubmit={run}>
        <label>Clave de recuperación administrativa<input type="password" value={key} onChange={e => setKey(e.target.value)} required /></label>
        <button className="primary-button" disabled={busy}>Abrir Administración</button>
      </form> : <>
      <form className="users-card sgfl-fields" onSubmit={run}><h2>Crear usuario</h2>
        <label>Nombre<input name="nombre" required maxLength={160} /></label>
        <label>Correo<input name="correo" type="email" required maxLength={254} /></label>
        {roleSelect()}
        <label>Contraseña inicial<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <button className="primary-button" disabled={busy}>Agregar usuario</button>
      </form>
      <section className="users-card"><h2>Usuarios registrados</h2>
        {users.length === 0 && <p>No hay usuarios registrados.</p>}
        {users.map(user => <form key={JSON.stringify(user)} className="sgfl-fields" onSubmit={event => run(event, user.id)}>
          <label>Nombre<input name="nombre" defaultValue={user.nombre} required maxLength={160} /></label>
          <label>Correo<input name="correo" type="email" defaultValue={user.correo} required maxLength={254} /></label>
          {roleSelect(user.rol)}
          <label><input name="activo" type="checkbox" defaultChecked={user.activo} /> Activo</label>
          <label>Nueva contraseña (opcional)<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} /></label>
          <button className="primary-button" disabled={busy}>Guardar cambios</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => setRemoving(user)}>Eliminar usuario</button>
        </form>)}
      </section>
      {removing && <section className="users-card" role="alertdialog" aria-label="Confirmar eliminación">
        <p>¿Eliminar el acceso de {removing.nombre} ({removing.correo})? Sus expedientes y movimientos se conservarán.</p>
        <button className="primary-button" disabled={busy} onClick={remove}>Confirmar eliminación</button>
        <button className="secondary-button" disabled={busy} onClick={() => setRemoving(null)}>Cancelar</button>
      </section>}
      {!sessionAdmin && <button className="secondary-button" onClick={() => { setKey(''); setUsers(null) }}>Cerrar Administración</button>}
    </>}
  </section>
}
