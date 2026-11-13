import { useEffect, useState } from 'react'
import { AlertCircle, Eye, EyeOff, Landmark, LoaderCircle, LogIn } from 'lucide-react'
import App from './App.jsx'
import { supabase, supabaseConfigured } from './lib/supabase'
import { loadMemberships } from './lib/memberships'
import { firmName, productName } from './lib/brand.js'

export default function AuthApp() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabase) return undefined

    let alive = true
    // INITIAL_SESSION restores the session; a separate getSession request could
    // overwrite a newer SIGNED_OUT event with a stale session.
    let subscription
    try {
      const result = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!alive) return
        setSession(nextSession)
        setLoading(false)
      })
      subscription = result.data.subscription
    } catch (error) {
      console.error('No fue posible iniciar la autenticación de Supabase.', error)
      if (!alive) return
      setSession(null)
      setLoading(false)
    }

    return () => {
      alive = false
      subscription?.unsubscribe()
    }
  }, [])

  if (!supabaseConfigured) return <SetupScreen />
  if (loading) return <LoadingScreen message="Validando acceso…" />
  if (!session) return <AuthScreen />
  return <OrganizationGate key={session.user.id} session={session} />
}

function SetupScreen() {
  return <AuthFrame>
    <h1>Acceso no disponible</h1>
    <p className="auth-description">Contacta a la administración de tu organización para habilitar el acceso.</p>
  </AuthFrame>
}

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
    } catch {
      setError('No fue posible iniciar sesión. Revisa tu correo y contraseña e intenta nuevamente.')
    } finally {
      setBusy(false)
    }
  }

  return <AuthFrame>
    <div className="auth-eyebrow">ACCESO DE TRABAJADORES</div>
    <h1>Iniciar sesión</h1>
    <p className="auth-description">Ingresa con el correo y la contraseña que te proporcionó Administración.</p>
    <form className="auth-form" onSubmit={submit}>
      <label className="auth-field"><span>Correo electrónico</span><input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@ejemplo.com" /></label>
      <label className="auth-field"><span>Contraseña</span><span className="password-input"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword(visible => !visible)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
      {error && <div className="auth-alert error-alert"><AlertCircle size={16} />{error}</div>}
      <button className="primary-button auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <LogIn size={17} />}{busy ? 'Ingresando...' : 'Entrar'}</button>
    </form>
    <p className="auth-note">Las cuentas y los roles los asigna el personal administrativo.</p>
  </AuthFrame>
}

function OrganizationGate({ session }) {
  const [organizations, setOrganizations] = useState([])
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    if (!organization?.id) return
    supabase.rpc('registrar_acceso_sgfl', { p_organizacion_id: organization.id }).then(({ error }) => {
      if (error) console.error('No se pudo registrar el acceso autenticado.', error.code)
    }).catch(() => console.error('No se pudo registrar el acceso autenticado.'))
  }, [organization?.id])

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const memberships = await loadMemberships(supabase, session.user.id)
        if (!alive) return
        setOrganizations(memberships.map(item => ({ ...item.organizacion, rol: item.rol })))
        const preferred = memberships[0]
        setOrganization(preferred?.organizacion || null)
        setRole(preferred?.rol || '')
      } catch {
        if (alive) setError('No pudimos cargar tu acceso. Intenta nuevamente.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [session.user.id, retry])

  const selectOrganization = (id) => {
    const selected = organizations.find((item) => item.id === id)
    if (!selected) return
    setOrganization(selected)
    setRole(selected.rol)
  }

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      console.error('No fue posible cerrar la sesión.', signOutError)
      setError(signOutError.message)
    }
  }

  if (loading) return <LoadingScreen message="Cargando tu espacio de trabajo..." />

  if (!organization) return <AuthFrame>
    <div className="auth-eyebrow">ACCESO AL SISTEMA</div>
    <h1>{error ? 'No se pudo cargar tu acceso' : 'Acceso pendiente de asignación'}</h1>
    <p className="auth-description">{error || 'Tu cuenta no tiene un acceso activo asignado. Pide al personal administrativo que te incorpore y asigne tu rol.'}</p>
    <button className="primary-button auth-submit" onClick={() => setRetry(value => value + 1)}>Volver a intentar</button>
    <button className="signout-link" onClick={signOut}>Cerrar sesión</button>
  </AuthFrame>

  return <div className="authenticated-app">
    {error && <div className="organization-error"><AlertCircle size={15} />{error}<button onClick={() => setError('')}>Cerrar</button></div>}
    <App key={`${organization.id}:${role}`} user={session.user} organization={organization} organizations={organizations} role={role} onSignOut={signOut} onOrganizationChange={selectOrganization} />
  </div>
}

function LoadingScreen({ message }) {
  return <div className="auth-loading"><LoaderCircle className="spin" size={24} />{message}</div>
}

function AuthFrame({ children }) {
  return (
    <main className="auth-screen">
      <aside className="auth-story">
        <span className="auth-story-label">{firmName || productName}</span>
        <div className="territory-art" aria-hidden="true"><span /><span /><span /><Landmark size={52} strokeWidth={1} /></div>
        <div>
          <h2>Gestión territorial<br /><em>y catastral</em></h2>
          <p>Cartografía de predios, expedientes de titulación y seguimiento de trámites.</p>
        </div>
      </aside>
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark"><Landmark size={23} /></div>
          <div><strong>{productName}</strong><small>{firmName || 'Gestión territorial'}</small></div>
        </div>
        {children}
      </section>
      {firmName && <footer>{firmName}</footer>}
    </main>
  )
}
