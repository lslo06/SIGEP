import { useEffect, useState } from 'react'
import { AlertCircle, Check, Eye, EyeOff, LoaderCircle, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isAdmin, roles } from '../lib/permissions'
import './users.css'

const assignableRoles = Object.entries(roles).filter(([key]) => !['owner', 'editor'].includes(key))

export default function UsersWorkspace({ organization, user, role }) {
  const [members, setMembers] = useState([])
  const [roleDrafts, setRoleDrafts] = useState({})
  const [mode, setMode] = useState('create')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [memberRole, setMemberRole] = useState('ventanilla')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('listar_miembros_organizacion', { p_organizacion_id: organization.id })
      if (error) throw error
      setMembers(data || []); setRoleDrafts(Object.fromEntries((data || []).map(member => [member.usuario_id, member.rol])))
    } catch { setError('No se pudo cargar la lista de trabajadores. Intenta nuevamente.'); }
    finally { setLoading(false) }
  }
  useEffect(() => { if (isAdmin(role)) load() }, [organization.id, role])
  if (!isAdmin(role)) return <p>No tienes permiso para administrar trabajadores.</p>

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setSuccess('')
    try {
      if (mode === 'create') {
        const { data, error } = await supabase.functions.invoke('crear-trabajador', {
          body: { organizacion_id: organization.id, email: email.trim(), password, nombre: name.trim(), rol: memberRole },
        })
        if (error) {
          let message = 'No se pudo dar de alta al trabajador. El servicio de altas debe estar instalado y disponible.'
          try { const details = await error.context?.json(); if (typeof details?.error === 'string') message = details.error } catch { /* Sin respuesta del servidor. */ }
          throw new Error(message)
        }
        if (!data?.ok) throw new Error('No se pudo confirmar el alta. Revisa la lista antes de volver a intentarlo.')
      } else {
        const { error } = await supabase.rpc('agregar_miembro_organizacion', { p_organizacion_id: organization.id, p_email: email.trim(), p_rol: memberRole })
        if (error) throw new Error('No se pudo asignar el acceso. Verifica que la cuenta exista y que puedas modificarla.')
      }
      setSuccess(mode === 'create' ? `Trabajador ${email.trim()} dado de alta. Ya puede iniciar sesión con la contraseña que le asignaste.` : 'Acceso y rol guardados correctamente.')
      setPassword(''); setShowPassword(false); setEmail(''); setName('')
      await load()
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  async function changeMember(member, action) {
    if (busy || member.usuario_id === user.id || member.rol === 'owner') return
    setBusy(true); setError(''); setSuccess('')
    try {
      const { error } = action === 'role'
        ? await supabase.rpc('agregar_miembro_organizacion', { p_organizacion_id: organization.id, p_email: member.email, p_rol: roleDrafts[member.usuario_id] })
        : await supabase.rpc('activar_miembro_sgfl', { p_organizacion_id: organization.id, p_usuario_id: member.usuario_id, p_activo: member.activo === false })
      if (error) throw error
      setSuccess(action === 'role' ? 'Rol actualizado.' : member.activo === false ? 'Acceso activado.' : 'Acceso desactivado.')
      await load()
    } catch { setError('No se pudo actualizar el acceso del trabajador. Intenta nuevamente.') }
    finally { setBusy(false) }
  }
  return <section className="users-workspace">
    <header><p className="eyebrow">ADMINISTRACIÓN</p><h1>Trabajadores y roles</h1><p>Da de alta al personal y define el área a la que puede acceder.</p></header>
    {error && <div className="users-alert users-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
    {success && <div className="users-alert users-success" role="status"><Check size={18} /><span>{success}</span></div>}
    <section className="users-card"><h2><UserPlus size={21} /> Alta de trabajadores</h2>
      <div className="users-modes" role="group" aria-label="Tipo de alta">{[['create', 'Nuevo trabajador'], ['existing', 'Asignar cuenta existente']].map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key} disabled={busy} onClick={() => { setMode(key); setPassword(''); setShowPassword(false); setError(''); setSuccess('') }}>{label}</button>)}</div>
      <p>{mode === 'create' ? 'Captura su correo, asigna una contraseña y selecciona su rol. El trabajador podrá entrar directamente al sistema.' : 'Asigna un rol a alguien que ya tiene cuenta. Su contraseña se conserva.'}</p>
      <form onSubmit={submit} className="users-form"><fieldset disabled={busy}>
        {mode === 'create' && <label>Nombre del trabajador<input maxLength={160} autoComplete="off" value={name} onChange={event => setName(event.target.value)} placeholder="Nombre completo" /></label>}
        <label>Correo del trabajador<input type="email" maxLength={254} required autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} placeholder="trabajador@ejemplo.com" /></label>
        {mode === 'create' && <label>Contraseña asignada<span className="users-password"><input type={showPassword ? 'text' : 'password'} required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo 12 caracteres" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña asignada' : 'Mostrar contraseña asignada'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>}
        <label>Rol del trabajador<select value={memberRole} onChange={event => setMemberRole(event.target.value)}>{assignableRoles.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </fieldset><p className="users-role-description">{memberRole === 'finanzas' ? 'Finanzas solo podrá consultar pagos por folio o clave catastral; no podrá modificar datos.' : memberRole === 'admin' ? 'Administración podrá dar de alta trabajadores, asignar roles y controlar accesos.' : `El trabajador tendrá los permisos del área: ${roles[memberRole]}.`}</p>
      <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <UserPlus size={17} />}{busy ? 'Guardando…' : mode === 'create' ? 'Dar de alta trabajador' : 'Guardar acceso y rol'}</button></form>
    </section>
    <section className="users-card"><div className="users-list-heading"><div><h2>Personal registrado</h2><p>{organization.nombre} · {members.length} trabajadores</p></div><button className="secondary-button" disabled={busy || loading} onClick={() => { setError(''); load() }}>Actualizar lista</button></div>
      {loading ? <p role="status">Cargando trabajadores…</p> : members.length ? <ul className="users-list">{members.map(member => {
        const protectedMember = member.rol === 'owner' || member.usuario_id === user.id
        return <li key={member.usuario_id}><div className="users-identity"><strong>{member.email}</strong><small>{member.activo === false ? 'Inactivo' : 'Activo'}{member.usuario_id === user.id ? ' · Tu cuenta' : ''}</small></div><label><span className="sr-only">Rol de {member.email}</span><select disabled={busy || protectedMember} value={roleDrafts[member.usuario_id] || member.rol} onChange={event => setRoleDrafts({ ...roleDrafts, [member.usuario_id]: event.target.value })}>{member.rol === 'owner' && <option value="owner">Responsable / Administrador</option>}{member.rol === 'editor' && <option value="editor">Captura general (heredado)</option>}{assignableRoles.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{!protectedMember && <div className="users-row-actions"><button className="secondary-button" disabled={busy || roleDrafts[member.usuario_id] === member.rol} onClick={() => changeMember(member, 'role')}>Guardar rol</button><button className="secondary-button" disabled={busy} onClick={() => changeMember(member, 'active')}>{member.activo === false ? 'Activar' : 'Desactivar'}</button></div>}</li>
      })}</ul> : <p>No hay trabajadores registrados.</p>}
    </section>
  </section>
}
