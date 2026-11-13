import { useEffect, useState } from 'react'
import App from './App'
import LocalAdministration from './modules/LocalAdministration'
import { firmName, productName } from './lib/brand'
import './local-workspace.css'

const workspace = { nombre: firmName }

export default function LocalApp() {
  const [session, setSession] = useState(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')

  async function loadSession(signal) {
    const response = await fetch('/api/sigep/sesion', { signal })
    if (response.status === 401) {
      setSession(null)
      return
    }
    if (response.status === 404) throw new Error('HomeLab todavía usa una versión de la API sin inicio de sesión.')
    if (!response.ok) throw new Error('No se pudo consultar la sesión en HomeLab.')
    setSession(await response.json())
  }

  useEffect(() => {
    const controller = new AbortController()
    loadSession(controller.signal).catch(error => {
      if (!controller.signal.aborted) setMessage(error.message)
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false)
    })
    return () => controller.abort()
  }, [])

  async function signIn(event) {
    event.preventDefault()
    if (busy) return
    const data = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/sigep/sesion/entrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      const result = await response.json()
      if (response.status === 404) throw new Error('HomeLab todavía usa una versión de la API sin inicio de sesión.')
      if (!response.ok) throw new Error(result.error)
      await loadSession()
    } catch (error) {
      setMessage(error instanceof SyntaxError ? 'Actualiza la API de HomeLab para iniciar sesión.' : error.message)
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    try {
      const response = await fetch('/api/sigep/sesion/salir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error()
      setSession(null)
    } catch {
      setMessage('No se pudo cerrar la sesión. Vuelve a intentarlo.')
    }
  }

  if (session) {
    const { usuario, permisos } = session
    return <>
      {message && <p role="alert">{message}</p>}
      <App key={usuario.id} local permissions={permisos} role={usuario.rol} onSignOut={signOut}
        user={{ email: usuario.correo, user_metadata: { nombre: usuario.nombre } }}
        organization={workspace} organizations={[workspace]} />
    </>
  }

  if (setupOpen) return <main className="auth-screen">
    <section className="auth-card">
      <button className="secondary-button" onClick={() => setSetupOpen(false)}>Volver al inicio de sesión</button>
      <LocalAdministration />
    </section>
  </main>

  return <main className="auth-screen"><section className="auth-card">
    <h1>{productName} · {firmName}</h1>
    <p>Ingresa con tu cuenta de trabajo.</p>
    <form className="auth-form" onSubmit={signIn}>
      <label className="auth-field">Correo<input name="correo" type="email" autoComplete="username" required /></label>
      <label className="auth-field">Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      {message && <p role="alert">{message}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Comprobando…' : 'Entrar'}</button>
    </form>
    <button className="signout-link" onClick={() => setSetupOpen(true)}>Administrar con clave</button>
  </section></main>
}
