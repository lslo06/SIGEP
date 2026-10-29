import { useEffect, useMemo, useState } from 'react'
import {
  Bell, ChevronDown, ChevronRight, CircleHelp, ClipboardList, FileText, Folder,
  House, Map, Menu, Plus, Search, Settings, Users, X, Landmark, Wallet,
  CalendarDays, Pencil, Check, MapPinned, Trash2, SlidersHorizontal, LogOut, LoaderCircle,
} from 'lucide-react'
import { deleteExpediente, listExpedientes, saveExpediente } from './lib/expedientes'
import ModuleWorkspace from './modules/ModuleWorkspace'

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

function App({ user, organization, organizations, role, onSignOut, onOrganizationChange }) {
  const [files, setFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeNav, setActiveNav] = useState('Inicio')
  const [activeTab, setActiveTab] = useState('Mi bandeja')
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(emptyFile)
  const [editingId, setEditingId] = useState(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const canEdit = role !== 'viewer'

  const refreshFiles = async () => {
    setLoadingFiles(true)
    try {
      setFiles(await listExpedientes(organization.id))
    } catch (error) {
      console.error('No fue posible cargar los expedientes desde Supabase.', error)
      setNotice(`No se pudieron cargar los expedientes: ${error.message}`)
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => { refreshFiles() }, [organization.id])

  const filteredFiles = useMemo(() => files.filter((file) => {
    const query = search.trim().toLocaleLowerCase('es')
    const matchesSearch = !query || [file.id, file.propietario, file.lote, file.fundo]
      .some((value) => (value || '').toLocaleLowerCase('es').includes(query))
    const matchesTab = activeTab !== 'Prioritarios' || ['Hoy', '2 días'].includes(file.espera)
    const matchesUnassigned = activeTab !== 'Sin asignar' || file.areaActual === 'Recepción'
    return matchesSearch && matchesTab && matchesUnassigned
  }), [files, search, activeTab])

  const openNew = () => {
    if (!canEdit) return
    setForm({ ...emptyFile, fechaSolicitud: new Date().toISOString().slice(0, 10) })
    setEditingId(null)
    setDialog('form')
  }

  const openEdit = (file) => {
    if (!canEdit) return
    setForm({ ...emptyFile, ...file })
    setEditingId(file._id)
    setDialog('form')
  }

  const saveFile = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await saveExpediente(organization.id, editingId, form)
      setDialog(null)
      await refreshFiles()
      setNotice(editingId ? 'Expediente actualizado correctamente en Supabase.' : 'Nuevo trámite registrado en Supabase.')
      window.setTimeout(() => setNotice(''), 3500)
    } catch (error) {
      console.error('No fue posible guardar el expediente en Supabase.', error)
      setNotice(`No se pudo guardar: ${error.message}`)
      window.setTimeout(() => setNotice(''), 6000)
    } finally {
      setSaving(false)
    }
  }

  const deleteFile = async (id) => {
    if (!canEdit) return
    if (!window.confirm('¿Quieres eliminar este expediente? Esta acción no se puede deshacer.')) return
    setSaving(true)
    try {
      await deleteExpediente(organization.id, id)
      setDialog(null)
      await refreshFiles()
      setNotice('Expediente eliminado de Supabase.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (error) {
      console.error('No fue posible eliminar el expediente en Supabase.', error)
      setNotice(`No se pudo eliminar: ${error.message}`)
      window.setTimeout(() => setNotice(''), 6000)
    } finally {
      setSaving(false)
    }
  }

  const openDetails = (file) => setDialog({ type: 'details', file })

  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú" />}
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Landmark size={23} strokeWidth={1.8} /></div>
          <div><div className="brand-name">Fundos</div><div className="brand-subtitle">GESTIÓN TERRITORIAL</div></div>
          <button className="mobile-close icon-button" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <div className="area-switcher">
          <span className="area-avatar">FL</span>
          <span className="area-copy"><small>ÁREA ACTUAL</small>{organizations.length > 1 ? <select aria-label="Cambiar organización" value={organization.id} onChange={(event) => onOrganizationChange(event.target.value)}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select> : <><strong>{organization.nombre}</strong><small>Rol: {role}</small></>}</span>
          <ChevronRight size={17} />
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          {navItems.map(({ label, icon: Icon, badge }) => (
            <button key={label} className={`nav-link ${activeNav === label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(label); setMobileMenu(false) }}>
              <Icon size={21} strokeWidth={1.8} /><span>{label}</span>{badge && <span className="nav-badge">{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user"><div className="user-avatar">{(user.email || 'US').slice(0, 2).toUpperCase()}</div><div><strong>{user.email}</strong><small>{role}</small></div></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Menu size={21} /></button>
          {activeNav === 'Inicio' ? <label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar folio, propietario o lote" aria-label="Buscar folio, propietario o lote" />{search && <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label> : <div className="current-section">{activeNav}</div>}
          <div className="topbar-actions">
            <button className="notification icon-button" aria-label="Notificaciones"><Bell size={20} /><i /></button>
            <button className="icon-button signout-button" onClick={onSignOut} aria-label="Cerrar sesión" title={`Cerrar sesión de ${user.email}`}><LogOut size={18} /></button>
            <div className="top-user"><div className="user-avatar small-avatar">{(user.email || 'US').slice(0, 2).toUpperCase()}</div><div><strong>{user.email}</strong><small>{role}</small></div><ChevronDown size={15} /></div>
          </div>
        </header>

        {activeNav !== 'Inicio' ? <div className="content"><ModuleWorkspace moduleName={activeNav} organization={organization} user={user} role={role} onSignOut={onSignOut} /></div> : <div className="content">
          <section className="welcome-row">
            <div><div className="eyebrow date-label">{new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toLocaleUpperCase('es-MX')}</div><h1>Buenos días, {user.user_metadata?.nombre || user.email?.split('@')[0]}</h1><p>Tienes <strong className="orange-text">{files.filter((file) => ['Hoy', '1 día'].includes(file.espera)).length} tareas pendientes</strong> en {organization.nombre}.</p></div>
            {canEdit && <button className="primary-button" onClick={openNew}><Plus size={17} /> Nuevo trámite</button>}
          </section>

          <section className="priority-banner">
            <div className="priority-copy"><div className="eyebrow aqua">PRIORIDAD DEL DÍA</div><h2>3 expedientes requieren atención hoy</h2><p>Uno está próximo a vencer y dos esperan canalización.</p></div>
            <div className="priority-counts"><div className="priority-count"><span className="dot red-dot" /><div><strong>1</strong><small>Por vencer</small></div></div><div className="priority-count"><span className="dot gold-dot" /><div><strong>2</strong><small>Sin asignar</small></div></div><button onClick={() => { setActiveTab('Prioritarios'); setActiveNav('Inicio') }}>Revisar ahora <ChevronRight size={16} /></button></div>
          </section>

          <section className="stats-grid">
            <StatCard icon={Folder} tone="blue" label="EN MI BANDEJA" value={String(files.length)} caption={`${files.filter((file) => ['Hoy', '1 día'].includes(file.espera)).length} requieren acción`} />
            <StatCard icon={Map} tone="orange" label="EN TRABAJO DE CAMPO" value={String(files.filter((file) => file.areaActual === 'Topografía').length)} caption="Expedientes asignados" />
            <StatCard icon={FileText} tone="green" label="LISTOS PARA ENTREGA" value={String(files.filter((file) => file.estado === 'Listo para entrega').length)} caption="Pendientes de entrega" />
          </section>

          <section className="work-panel">
            <div className="panel-heading">
              <div><h2>Bandeja de trabajo</h2><p>Acciones que corresponden a tu área.</p></div>
              <div className="tabs" role="tablist" aria-label="Filtrar expedientes">{['Mi bandeja', 'Prioritarios', 'Sin asignar'].map((tab) => <button key={tab} className={activeTab === tab ? 'tab-active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
            </div>
            <div className="table-scroll">
              <div className="table-head"><span>EXPEDIENTE</span><span>SOLICITANTE</span><span>ÁREA ACTUAL</span><span>SIGUIENTE ACCIÓN</span><span>EN ESPERA</span><span /></div>
              {loadingFiles ? <div className="empty-state"><LoaderCircle className="spin" size={22} /><strong>Cargando expedientes desde Supabase...</strong></div> : filteredFiles.length ? filteredFiles.map((file) => <FileRow key={file._id} file={file} onClick={() => openDetails(file)} />) : <div className="empty-state"><SlidersHorizontal size={22} /><strong>No hay expedientes para mostrar</strong><span>Prueba con otro filtro o registra un nuevo trámite.</span></div>}
            </div>
            <div className="panel-footer"><span>Mostrando {filteredFiles.length} de {files.length} expedientes</span><button onClick={() => { setActiveNav('Inicio'); setActiveTab('Mi bandeja') }}>Ver todos los expedientes <ChevronRight size={15} /></button></div>
          </section>

          <section className="lower-grid">
            <div className="lower-card"><div className="lower-card-icon green-icon"><CalendarDays size={19} /></div><div><strong>Próximas entregas</strong><p>{files.filter((file) => file.estado === 'Listo para entrega').length} títulos listos para programar su entrega.</p></div><button onClick={() => setActiveNav('Títulos y formatos')} aria-label="Ver próximas entregas"><ChevronRight size={17} /></button></div>
            <div className="lower-card"><div className="lower-card-icon amber-icon"><Wallet size={19} /></div><div><strong>Seguimiento de pagos</strong><p>{files.filter((file) => Number(file.saldoPendiente) > 0).length} expedientes con saldo pendiente.</p></div><button onClick={() => setActiveNav('Pagos y servicios')} aria-label="Ver pagos"><ChevronRight size={17} /></button></div>
          </section>
          <footer className="page-footer">Fundos · Gestión territorial <span>Ayuda y soporte <CircleHelp size={14} /></span></footer>
        </div>}
      </main>

      {notice && <div className="toast"><Check size={17} />{notice}</div>}
      {saving && <div className="saving-overlay"><LoaderCircle className="spin" size={17} />Guardando en Supabase...</div>}
      {dialog === 'form' && <FormDialog form={form} setForm={setForm} editing={Boolean(editingId)} saving={saving} onClose={() => setDialog(null)} onSave={saveFile} />}
      {dialog?.type === 'details' && <DetailsDialog file={dialog.file} canEdit={canEdit} onClose={() => setDialog(null)} onEdit={() => openEdit(dialog.file)} onDelete={() => deleteFile(dialog.file._id)} />}
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

function FormDialog({ form, setForm, editing, saving, onClose, onSave }) {
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const field = (label, name, options = {}) => <label className={`form-field ${options.wide ? 'field-wide' : ''}`} key={name}><span>{label}{options.required && <b> *</b>}</span>{options.select ? <select name={name} value={form[name] || ''} onChange={change}>{options.select.map((item) => <option key={item}>{item}</option>)}</select> : options.textarea ? <textarea name={name} value={form[name] || ''} onChange={change} rows="3" placeholder={options.placeholder || ''} /> : <input name={name} value={form[name] || ''} onChange={change} type={options.type || 'text'} min={options.type === 'number' ? '0' : undefined} step={options.type === 'number' ? 'any' : undefined} required={options.required} placeholder={options.placeholder || ''} />}</label>

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="form-title">
    <header className="dialog-header"><div><span className="eyebrow">GESTIÓN DE EXPEDIENTES</span><h2 id="form-title">{editing ? 'Editar expediente' : 'Nuevo trámite'}</h2><p>Completa la información del propietario, predio y seguimiento.</p></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
    <form onSubmit={onSave}>
      <div className="form-body">
        <FormSection icon={Users} title="Identificación del propietario y predio" description="Datos de la persona titular y ubicación del terreno." />
        <div className="form-grid">{field('Nombre completo del propietario', 'propietario', { required: true, wide: true, placeholder: 'Ej. María Elena Ruiz' })}{field('Fundo o zona territorial', 'fundo', { required: true, placeholder: 'Nombre del fundo' })}{field('Tipo de trámite', 'tipo', { select: ['Titulación', 'Búsqueda de información', 'Partición de terrenos', 'Actualización de datos', 'Otro'] })}{field('Manzana (MZ)', 'manzana', { placeholder: 'Ej. A' })}{field('Lote', 'lote', { required: true, placeholder: 'Número o clave' })}{field('Superficie (m²)', 'superficie', { type: 'number', placeholder: '0' })}</div>
        <FormSection icon={FileText} title="Datos del título de propiedad" description="Información registral y estado legal actual." />
        <div className="form-grid">{field('Libro', 'libro')}{field('Número de título', 'titulo')}{field('Fecha de título', 'fechaTitulo', { type: 'date' })}{field('Estado del predio', 'estado', { select: ['En trámite', 'En revisión', 'Vigente', 'Cancelado', 'Pendiente', 'Listo para entrega'] })}{field('Observaciones', 'observacion', { textarea: true, wide: true, placeholder: 'Notas adicionales sobre el estatus del cliente o predio' })}</div>
        <FormSection icon={CalendarDays} title="Fechas y seguimiento" description="Fechas de solicitud, entrega, pagos y gestiones con dependencias." />
        <div className="form-grid">{field('Fecha de solicitud', 'fechaSolicitud', { type: 'date' })}{field('Fecha de entrega', 'fechaEntrega', { type: 'date' })}{field('Fecha de pago de servicios', 'fechaPago', { type: 'date' })}{field('Fecha ante Gobierno', 'fechaGobierno', { type: 'date' })}{field('Fecha ante Municipio', 'fechaMunicipio', { type: 'date' })}{field('Fecha de Registro Público', 'fechaRegistro', { type: 'date' })}</div>
        <FormSection icon={Wallet} title="Costos y saldos" description="Control de costos del terreno y parcialidades recibidas." />
        <div className="form-grid">{field('Costo del terreno (MXN)', 'costoTerreno', { type: 'number', placeholder: '0.00' })}{field('Parcialidades pagadas (MXN)', 'parcialidades', { type: 'number', placeholder: '0.00' })}{field('Saldo pendiente (MXN)', 'saldoPendiente', { type: 'number', placeholder: '0.00' })}</div>
        <FormSection icon={ClipboardList} title="Oficios y flujo de trabajo" description="Seguimiento de oficios, firmas y próxima acción." />
        <div className="form-grid">{field('Número de oficio', 'oficio')}{field('Seguimiento de firmas', 'seguimientoFirmas', { select: ['Sin iniciar', 'En espera de firma', 'En revisión', 'Firmado'] })}{field('Área actual', 'areaActual', { select: ['Recepción', 'Legal', 'Topografía', 'Cartografía', 'Titulación', 'Entrega'] })}{field('En espera', 'espera', { select: ['Hoy', '1 día', '2 días', '3 días', '4 días', '1 semana', 'Sin asignar'] })}{field('Siguiente acción', 'siguienteAccion', { wide: true, placeholder: 'Ej. Asignar visita de campo' })}</div>
      </div>
      <footer className="dialog-footer"><span><b>*</b> Campos obligatorios</span><div><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}><Check size={16} />{editing ? 'Guardar cambios' : 'Crear trámite'}</button></div></footer>
    </form>
  </section></div>
}

function FormSection({ icon: Icon, title, description }) {
  return <div className="form-section"><span className="section-icon"><Icon size={18} /></span><div><h3>{title}</h3><p>{description}</p></div></div>
}

function DetailsDialog({ file, canEdit, onClose, onEdit, onDelete }) {
  const group = (title, items) => <section className="detail-group"><h3>{title}</h3><div className="detail-grid">{items.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || '—'}</strong></div>)}</div></section>
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="details-dialog" role="dialog" aria-modal="true" aria-labelledby="details-title">
    <header className="dialog-header detail-header"><div><div className="detail-title-line"><span className="detail-file-icon"><FileText size={21} /></span><div><span className="eyebrow">EXPEDIENTE</span><h2 id="details-title">{file.id}</h2></div></div><p>{file.tipo} <span className="detail-divider">·</span> {file.estado}</p></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
    <div className="details-body">
      <div className="detail-highlight"><span><Users size={17} /> Propietario</span><strong>{file.propietario}</strong><small>{file.fundo} · MZ {file.manzana || '—'} · Lote {file.lote || '—'} · {file.superficie || '—'} m²</small></div>
      {group('Título de propiedad', [['Libro', file.libro], ['Número de título', file.titulo], ['Fecha de título', file.fechaTitulo], ['Estado', file.estado], ['Observación', file.observacion]])}
      {group('Fechas y trámites', [['Solicitud', file.fechaSolicitud], ['Entrega', file.fechaEntrega], ['Pago de servicios', file.fechaPago], ['Gobierno', file.fechaGobierno], ['Municipio', file.fechaMunicipio], ['Registro Público', file.fechaRegistro]])}
      {group('Costos y saldos', [['Costo del terreno', formatMoney(file.costoTerreno)], ['Parcialidades pagadas', formatMoney(file.parcialidades)], ['Saldo pendiente', formatMoney(file.saldoPendiente)]])}
      {group('Oficios y seguimiento', [['Número de oficio', file.oficio], ['Seguimiento de firmas', file.seguimientoFirmas], ['Área actual', file.areaActual], ['Siguiente acción', file.siguienteAccion], ['En espera', file.espera]])}
    </div>
    <footer className="dialog-footer details-footer">{canEdit && <button className="delete-button" onClick={onDelete}><Trash2 size={16} /> Eliminar</button>}<div><button className="secondary-button" onClick={onClose}>Cerrar</button>{canEdit && <button className="primary-button" onClick={onEdit}><Pencil size={15} /> Editar expediente</button>}</div></footer>
  </section></div>
}

export default App
