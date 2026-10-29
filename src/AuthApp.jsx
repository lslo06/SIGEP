import { useEffect, useState } from 'react'
import { AlertCircle, Check, Eye, EyeOff, Landmark, LoaderCircle, LogIn } from 'lucide-react'
import App from './App.jsx'
import { supabase, supabaseConfigured } from './lib/supabase'

export default function AuthApp() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabase) return undefined

    let alive = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) console.error('No fue posible recuperar la sesión de Supabase.', error)
      setSession(data?.session ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  if (!supabaseConfigured) return <SetupScreen />
  if (loading) return <LoadingScreen message="Conectando con Supabase..." />
  if (!session) return <AuthScreen />
  return <OrganizationGate key={session.user.id} session={session} />
}

function SetupScreen() {
  return <AuthFrame>
    <div className="auth-eyebrow">CONFIGURACIÓN REQUERIDA</div>
    <h1>Conecta tu proyecto Supabase</h1>
    <p className="auth-description">La clave publishable ya está guardada. Falta agregar la URL del proyecto para habilitar el inicio de sesión y la base de datos.</p>
    <div className="setup-steps">
      <span>1</span><div><strong>Abre Project Settings → API</strong><small>Copia el valor de Project URL (empieza con https:// y termina en .supabase.co).</small></div>
      <span>2</span><div><strong>Completa el archivo .env.local</strong><code>VITE_SUPABASE_URL=https://tu-proyecto.supabase.co</code></div>
      <span>3</span><div><strong>Reinicia Vite</strong><small>Detén el servidor con Ctrl+C y ejecuta npm run dev otra vez.</small></div>
    </div>
    <p className="auth-note"><AlertCircle size={15} /> No compartas claves secretas ni service_role. El frontend solo debe usar la clave publishable.</p>
  </AuthFrame>
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password })
      if (result.error) throw result.error
      if (mode === 'signup' && !result.data.session) {
        setMessage('Cuenta creada. Revisa tu correo para confirmar la dirección y después inicia sesión.')
        setMode('login')
      }
    } catch (authError) {
      console.error('Error de autenticación de Supabase.', authError)
      setError(authError.message || 'No se pudo completar el inicio de sesión.')
    } finally {
      setBusy(false)
    }
  }

  return <AuthFrame>
    <div className="auth-eyebrow">{mode === 'login' ? 'BIENVENIDA DE NUEVO' : 'CREA TU ACCESO'}</div>
    <h1>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
    <p className="auth-description">{mode === 'login' ? 'Ingresa a tu espacio de gestión territorial.' : 'Registra tu correo para acceder a Fundos.'}</p>
    <form className="auth-form" onSubmit={submit}>
      <label className="auth-field"><span>Correo electrónico</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@ejemplo.com" /></label>
      <label className="auth-field"><span>Contraseña</span><span className="password-input"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
      {error && <div className="auth-alert error-alert"><AlertCircle size={16} />{error}</div>}
      {message && <div className="auth-alert success-alert"><Check size={16} />{message}</div>}
      <button className="primary-button auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <LogIn size={17} />}{busy ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
    </form>
    <p className="auth-switch">{mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'} <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}>{mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}</button></p>
    <p className="auth-note"><AlertCircle size={15} /> El acceso está protegido por Supabase Auth y los permisos de la base de datos.</p>
  </AuthFrame>
}

function OrganizationGate({ session }) {
  const [organizations, setOrganizations] = useState([])
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('Fundos Legales')
  const [error, setError] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setError('')
      const { data, error: loadError } = await supabase
        .from('miembros_organizacion')
        .select('organizacion_id, rol, organizacion:organizaciones(id, nombre)')
        .eq('usuario_id', session.user.id)
      if (!alive) return
      if (loadError) {
        console.error('No fue posible cargar las organizaciones del usuario.', loadError)
        setError(`${loadError.message} Si acabas de actualizar el esquema, vuelve a ejecutar supabase/schema.sql en Supabase SQL Editor.`)
      } else {
        const memberships = (data ?? []).filter((item) => item.organizacion)
        setOrganizations(memberships.map((item) => ({ ...item.organizacion, rol: item.rol })))
        if (memberships.length) {
          const preferred = memberships[0]
          setOrganization(preferred.organizacion)
          setRole(preferred.rol)
        }
      }
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [session.user.id])

  const createOrganization = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { data, error: createError } = await supabase.rpc('crear_organizacion', { p_nombre: name.trim() })
    if (createError) {
      console.error('No fue posible crear la organización.', createError)
      setError(createError.message)
      setBusy(false)
      return
    }
    const { data: membership, error: membershipError } = await supabase
      .from('miembros_organizacion')
      .select('organizacion_id, rol, organizacion:organizaciones(id, nombre)')
      .eq('organizacion_id', data)
      .single()
    if (membershipError) {
      console.error('La organización se creó, pero no se pudo cargar su información.', membershipError)
      setError(membershipError.message)
    } else {
      const nextOrganization = { ...membership.organizacion, rol: membership.rol }
      setOrganizations((current) => [...current, nextOrganization])
      setOrganization(nextOrganization)
      setRole(membership.rol)
    }
    setBusy(false)
  }

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
    <div className="auth-eyebrow">CONFIGURA TU ESPACIO</div>
    <h1>Crea tu organización</h1>
    <p className="auth-description">Tu usuario todavía no pertenece a una organización. Esta será el espacio seguro para tus fundos y expedientes.</p>
    <form className="auth-form" onSubmit={createOrganization}>
      <label className="auth-field"><span>Nombre de la organización</span><input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
      {error && <div className="auth-alert error-alert"><AlertCircle size={16} />{error}</div>}
      <button className="primary-button auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{busy ? 'Creando...' : 'Crear organización'}</button>
    </form>
    <button className="signout-link" onClick={signOut}>Cerrar sesión</button>
  </AuthFrame>

  return <div className="authenticated-app">
    {error && <div className="organization-error"><AlertCircle size={15} />{error}<button onClick={() => setError('')}>Cerrar</button></div>}
    <App key={organization.id} user={session.user} organization={organization} organizations={organizations} role={role} onSignOut={signOut} onOrganizationChange={selectOrganization} />
  </div>
}

function LoadingScreen({ message }) {
  return <div className="auth-loading"><LoaderCircle className="spin" size={24} />{message}</div>
}

function AuthFrame({ children }) {
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><div className="brand-mark"><Landmark size={23} /></div><div><strong>Fundos</strong><small>GESTIÓN TERRITORIAL</small></div></div>{children}</section><footer>Gestión segura de expedientes y predios</footer></main>
}
