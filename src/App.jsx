import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell, ChevronDown, ChevronRight, CircleHelp, ClipboardList, FileText, Folder,
  House, Map, Menu, Plus, Search, Settings, Users, X, Landmark, Wallet,
  CalendarDays, Check, MapPinned, SlidersHorizontal, LogOut, LoaderCircle,
} from 'lucide-react'
import ModuleWorkspace from './modules/ModuleWorkspace'
import PaymentsWorkspace from './modules/PaymentsWorkspace'
import { roles } from './lib/permissions'
import { routes, findRoute } from './lib/routes.js'
import { isPriority } from './lib/validation.js'
import { firmName, productName } from './lib/brand.js'

const MapWorkspace = lazy(() => import('./modules/MapWorkspace'))
const FieldWorkspace = lazy(() => import('./modules/FieldWorkspace'))
const ExpedienteSearch = lazy(() => import('./components/map/ExpedienteSearch'))

const emptyFile = {
  tipo: 'Titulación', propietario: '', fundo: '', manzana: '', lote: '',
  superficie: '', libro: '', titulo: '', fechaTitulo: '', estado: 'En trámite',
  observacion: '', fechaSolicitud: '', fechaEntrega: '', fechaPago: '',
  fechaGobierno: '', fechaMunicipio: '', fechaRegistro: '', costoTerreno: '',
  parcialidades: '', saldoPendiente: '', oficio: '', seguimientoFirmas: 'Sin iniciar',
  areaActual: 'Recepción', siguienteAccion: 'Revisar documentación', espera: 'Hoy',
}

const navItems = [
  { label: 'Inicio', icon: House },
  { label: 'Seguimiento de trámites', icon: ClipboardList },
  { label: 'Medición y topografía', icon: MapPinned },
  { label: 'Lotes y predios', icon: MapPinned },
  { label: 'Propietarios', icon: Users },
  { label: 'Municipios y fundos', icon: Landmark },
  { label: 'Pagos y servicios', icon: Wallet },
  { label: 'Títulos y formatos', icon: FileText },
  { label: 'Histórico y reportes', icon: ClipboardList },
  { label: 'Configuración y seguridad', icon: Settings },
]

function formatMoney(value) {
  if (value === '' || value == null) return '—'
  const amount = Number(value)
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount)
    : '—'
}

function App({ user, organization, organizations, role, onSignOut, onOrganizationChange, permissions }) {
  const [files, setFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [routeHash, setRouteHash] = useState(() => window.location.hash)
  const hasModule = key => key === 'campo' ? permissions?.campo : permissions?.modulos.includes('*') || permissions?.modulos.includes(key)
  const canOpenRoute = item => Boolean(item && hasModule(item.key))
  const requested = findRoute(routeHash)
  const route = canOpenRoute(requested) ? requested : routes.find(canOpenRoute)
  const activeNav = route?.label
  const setActiveNav = label => {
    const next = routes.find(item => item.label === label)
    if (canOpenRoute(next)) window.location.hash = next.path
  }
  useEffect(() => {
    const update = () => setRouteHash(window.location.hash)
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    if (route && window.location.hash !== `#${route.path}`) {
      window.history.replaceState(null, '', `#${route.path}`)
      setRouteHash(`#${route.path}`)
    }
  }, [route?.path, routeHash])
  const [activeTab, setActiveTab] = useState('Mi bandeja')
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const inboxRef = useRef(null)
  const organizationInitials = organization.nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toLocaleUpperCase('es')
  const priorityCount = files.filter(isPriority).length
  const unassignedCount = files.filter((file) => file.areaActual === 'Recepción' && !['Vigente', 'Cancelado'].includes(file.estado)).length
  const reviewInbox = () => {
    setActiveTab('Prioritarios')
    inboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const refreshFiles = async () => {
    if (!hasModule('tramites')) { setFiles([]); setLoadingFiles(false); return }
    setLoadingFiles(true)
    try {
        const response = await fetch('/api/sigep/expedientes?fecha_desde=1900-01-01')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'No fue posible consultar los expedientes.')
        setFiles(data.expedientes.map(file => ({
          ...emptyFile,
          _id: file.id,
          id: file.folio,
          tipo: file.tipo_tramite === 'titulacion' ? 'Titulación' : 'Búsqueda de información',
          propietario: file.solicitante,
          lote: file.claves_catastrales?.join(', ') || '',
          estado: ({ listo_para_entrega: 'Listo para entrega', cerrado: 'Cerrado', entregado: 'Entregado' })[file.estado] || file.estado.replaceAll('_', ' '),
          areaActual: file.area_responsable,
          siguienteAccion: file.etapa_actual.replaceAll('_', ' '),
          fechaSolicitud: file.fecha_recepcion?.slice(0, 10) || '',
          espera: '',
        })))
    } catch (error) {
      console.error('No fue posible cargar los expedientes.', error)
      setNotice(`No se pudieron cargar los expedientes: ${error.message}`)
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => { refreshFiles() }, [organization.id, role])

  const filteredFiles = useMemo(() => files.filter((file) => {
    const query = search.trim().toLocaleLowerCase('es')
    const matchesSearch = !query || [file.id, file.propietario, file.lote, file.fundo]
      .some((value) => (value || '').toLocaleLowerCase('es').includes(query))
    const matchesTab = activeTab !== 'Prioritarios' || isPriority(file)
    const matchesUnassigned = activeTab !== 'Sin asignar' || (file.areaActual === 'Recepción' && !['Vigente', 'Cancelado'].includes(file.estado))
    return matchesSearch && matchesTab && matchesUnassigned
  }), [files, search, activeTab])

  const openDetails = (file) => setDialog({ type: 'details', file })

  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú" />}
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Landmark size={23} strokeWidth={1.8} /></div>
          <div><div className="brand-name">{productName}</div><div className="brand-subtitle">{firmName || 'Gestión territorial'}</div></div>
          <button className="mobile-close icon-button" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <div className="area-switcher">
          <span className="area-avatar">{organizationInitials}</span>
          <span className="area-copy"><small>{organizations.length > 1 ? 'CAMBIAR ORGANIZACIÓN' : 'ORGANIZACIÓN ACTUAL'}</small>{organizations.length > 1 ? <select aria-label="Cambiar organización" value={organization.id} onChange={(event) => onOrganizationChange(event.target.value)}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select> : <><strong>{organization.nombre}</strong><small>Rol: {roles[role] || 'Gestión territorial'}</small></>}</span>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          {navItems.filter(item => canOpenRoute(routes.find(route => route.label === item.label))).map(({ label, icon: Icon, badge }) => (
            <button key={label} className={`nav-link ${activeNav === label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(label); setMobileMenu(false) }}>
              <Icon size={21} strokeWidth={1.8} /><span>{label === 'Configuración y seguridad' ? 'Administración' : label}</span>{badge && <span className="nav-badge">{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user"><div className="user-avatar">{(user.email || 'US').slice(0, 2).toUpperCase()}</div><div><strong>{user.email}</strong><small>{roles[role] || 'Gestión territorial'}</small></div></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Menu size={21} /></button>
          {activeNav === 'Inicio' ? <label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar folio, propietario o lote" aria-label="Buscar folio, propietario o lote" />{search && <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label> : <div className="current-section">{activeNav === 'Configuración y seguridad' ? 'Administración' : activeNav || 'Apartado no disponible'}</div>}
          <div className="topbar-actions">
            {hasModule('inicio') && <button className="notification icon-button" onClick={() => { setActiveNav('Inicio'); setActiveTab('Prioritarios') }} aria-label={`Ver ${priorityCount} expedientes prioritarios`}><Bell size={20} />{priorityCount > 0 && <i />}</button>}
            {onSignOut && <button className="icon-button signout-button" onClick={onSignOut} aria-label="Cerrar sesión" title={`Cerrar sesión de ${user.email}`}><LogOut size={18} /></button>}
            <div className="top-user"><div className="user-avatar small-avatar">{(user.email || 'US').slice(0, 2).toUpperCase()}</div><div><strong>{user.email}</strong><small>{roles[role] || 'Gestión territorial'}</small></div><ChevronDown size={15} /></div>
          </div>
        </header>

        {activeNav !== 'Inicio' ? <div className="content">
          {activeNav === 'Medición y topografía'
            ? <Suspense fallback={<p role="status">Cargando solicitudes…</p>}><FieldWorkspace role={role} /></Suspense>
            : activeNav === 'Lotes y predios'
            ? <Suspense fallback={<p role="status">Cargando mapa…</p>}><MapWorkspace lotes canCreateParcel={permissions.altaPredio} canCreateFile={permissions.altaExpediente} /></Suspense>
            : activeNav === 'Pagos y servicios' ? <PaymentsWorkspace role={role} canRegister={permissions?.pagos} />
              : activeNav === 'Seguimiento de trámites'
                ? <section className="sgfl-workspace local-shell">
                    <header><h1>Seguimiento de trámites</h1><p>Consulta los expedientes, sus predios y movimientos.</p></header>
                    <Suspense fallback={<p role="status">Cargando expedientes…</p>}><ExpedienteSearch apiBase="/api/sigep" canMeasure={permissions.medicion} role={role} /></Suspense>
                  </section>
                : activeNav ? <ModuleWorkspace moduleName={activeNav} organization={organization} />
                    : <p>Este apartado no está disponible.</p>}
        </div> : <div className="content">
          <section className="welcome-row">
            <div><div className="eyebrow date-label">{new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toLocaleUpperCase('es-MX')}</div><h1>Buenos días, {user.user_metadata?.nombre || user.email?.split('@')[0]}</h1><p>Tienes <strong className="orange-text">{files.filter((file) => ['Hoy', '1 día'].includes(file.espera)).length} tareas pendientes</strong> en {organization.nombre}.</p></div>
            {permissions.altaExpediente && <button className="primary-button" onClick={() => setActiveNav('Lotes y predios')}><Plus size={17} /> Nuevo trámite</button>}
          </section>

          <section className="priority-banner">
            <div className="priority-copy"><div className="eyebrow aqua">SEGUIMIENTO DE EXPEDIENTES</div><h2>{loadingFiles ? 'Preparando tu resumen de trabajo' : priorityCount ? `${priorityCount} expedientes requieren atención` : 'Sin expedientes prioritarios'}</h2><p>Revisa los pendientes y los trámites en recepción.</p></div>
            <div className="priority-counts"><div className="priority-count"><span className="dot red-dot" /><div><strong>{priorityCount}</strong><small>Prioritarios</small></div></div><div className="priority-count"><span className="dot gold-dot" /><div><strong>{unassignedCount}</strong><small>En recepción</small></div></div><button onClick={reviewInbox}>Revisar bandeja <ChevronRight size={16} /></button></div>
          </section>

          <section className="stats-grid">
            <StatCard icon={Folder} tone="blue" label="EN MI BANDEJA" value={String(files.length)} caption={`${files.filter((file) => ['Hoy', '1 día'].includes(file.espera)).length} requieren acción`} />
            <StatCard icon={Map} tone="orange" label="EN TRABAJO DE CAMPO" value={String(files.filter((file) => file.areaActual === 'Topografía').length)} caption="Expedientes asignados" />
            <StatCard icon={FileText} tone="green" label="LISTOS PARA ENTREGA" value={String(files.filter((file) => file.estado === 'Listo para entrega').length)} caption="Pendientes de entrega" />
          </section>

          <section className="work-panel" ref={inboxRef}>
            <div className="panel-heading">
              <div><h2>Bandeja de trabajo</h2><p>Acciones que corresponden a tu área.</p></div>
              <div className="tabs" role="tablist" aria-label="Filtrar expedientes">{['Mi bandeja', 'Prioritarios', 'Sin asignar'].map((tab) => <button key={tab} className={activeTab === tab ? 'tab-active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
            </div>
            <div className="table-scroll">
              <div className="table-head"><span>EXPEDIENTE</span><span>SOLICITANTE</span><span>ÁREA ACTUAL</span><span>SIGUIENTE ACCIÓN</span><span>EN ESPERA</span><span /></div>
              {loadingFiles ? <div className="empty-state"><LoaderCircle className="spin" size={22} /><strong>Cargando expedientes…</strong></div> : filteredFiles.length ? filteredFiles.map((file) => <FileRow key={file._id} file={file} onClick={() => openDetails(file)} />) : <div className="empty-state"><SlidersHorizontal size={22} /><strong>No hay expedientes para mostrar</strong><span>Prueba con otro filtro o registra un nuevo trámite.</span></div>}
            </div>
            <div className="panel-footer"><span>Mostrando {filteredFiles.length} de {files.length} expedientes</span><button onClick={() => { setActiveNav('Inicio'); setActiveTab('Mi bandeja') }}>Ver todos los expedientes <ChevronRight size={15} /></button></div>
          </section>

          <section className="lower-grid">
            {hasModule('titulos_formatos') && <div className="lower-card"><div className="lower-card-icon green-icon"><CalendarDays size={19} /></div><div><strong>Próximas entregas</strong><p>{files.filter((file) => file.estado === 'Listo para entrega').length} títulos listos para programar su entrega.</p></div><button onClick={() => setActiveNav('Títulos y formatos')} aria-label="Ver próximas entregas"><ChevronRight size={17} /></button></div>}
            {hasModule('pagos_servicios') && <div className="lower-card"><div className="lower-card-icon amber-icon"><Wallet size={19} /></div><div><strong>Seguimiento de pagos</strong><p>{files.filter((file) => Number(file.saldoPendiente) > 0).length} expedientes con saldo pendiente.</p></div><button onClick={() => setActiveNav('Pagos y servicios')} aria-label="Ver pagos"><ChevronRight size={17} /></button></div>}
          </section>
          <footer className="page-footer">{productName} · {firmName || 'Gestión territorial'} <span>Ayuda y soporte <CircleHelp size={14} /></span></footer>
        </div>}
      </main>

      {notice && <div className="toast"><Check size={17} />{notice}</div>}
      {dialog?.type === 'details' && <DetailsDialog file={dialog.file} onClose={() => setDialog(null)} />}
    </div>
  )
}

function StatCard({ icon: Icon, tone, label, value, caption }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={23} strokeWidth={1.8} /></div><div><div className="eyebrow">{label}</div><strong className="stat-value">{value}</strong><p>{caption}</p></div></div>
}

function FileRow({ file, onClick }) {
  const areaClass = file.areaActual.toLowerCase().replaceAll(' ', '-')
  return <button className="file-row" onClick={onClick}>
    <span className="file-id-cell"><span className="file-icon"><FileText size={21} /></span><span><strong>{file.id}</strong><small>{file.tipo}</small></span></span>
    <span className="table-cell"><small className="cell-label">SOLICITANTE</small><strong>{file.propietario}</strong></span>
    <span className="table-cell"><small className="cell-label">ÁREA ACTUAL</small><span className={`area-pill ${areaClass}`}><i />{file.areaActual}</span></span>
    <span className="table-cell"><small className="cell-label">SIGUIENTE ACCIÓN</small><strong>{file.siguienteAccion || 'Pendiente de asignación'}</strong></span>
    <span className="table-cell"><small className="cell-label">EN ESPERA</small><strong>{file.espera || '—'}</strong></span>
    <ChevronRight className="row-chevron" size={18} />
  </button>
}

function DetailsDialog({ file, onClose }) {
  const group = (title, items) => <section className="detail-group"><h3>{title}</h3><div className="detail-grid">{items.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || '—'}</strong></div>)}</div></section>
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="details-dialog" role="dialog" aria-modal="true" aria-labelledby="details-title">
    <header className="dialog-header detail-header"><div><div className="detail-title-line"><span className="detail-file-icon"><FileText size={21} /></span><div><span className="eyebrow">EXPEDIENTE</span><h2 id="details-title">{file.id}</h2></div></div><p>{file.tipo} <span className="detail-divider">·</span> {file.estado}</p></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
    <div className="details-body">
      <div className="detail-highlight"><span><Users size={17} /> Propietario</span><strong>{file.propietario}</strong><small>{file.fundo} · MZ {file.manzana || '—'} · Lote {file.lote || '—'} · {file.superficie || '—'} m²</small></div>
      {group('Seguimiento', [['Fecha de solicitud', file.fechaSolicitud], ['Estado', file.estado], ['Área actual', file.areaActual], ['Etapa actual', file.siguienteAccion]])}
      <p>Consulta documentos, mediciones e historial en Seguimiento de trámites. Este resumen muestra únicamente los datos recibidos del expediente.</p>
    </div>
    <footer className="dialog-footer details-footer"><div><button className="secondary-button" onClick={onClose}>Cerrar</button></div></footer>
  </section></div>
}

export default App
