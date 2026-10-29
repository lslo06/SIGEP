import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Check, ChevronRight, FilePlus2, LoaderCircle,
  MapPinned, Pencil, Printer, Search, Trash2, Users, X, MoveUpRight, ZoomIn,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { modules, settingsModule } from './config'

const titleFields = {
  lotes_predios: ['Clave catastral', 'Lote'],
  propietarios: ['Nombre'],
  municipios_fundos: ['Nombre fundo', 'Nombre municipio', 'Clave fundo'],
  pagos_servicios: ['Lote', 'Concepto'],
  titulos_formatos: ['Folio título', 'Número título'],
  historico_reportes: ['Propietario histórico', 'Lote histórico'],
}

function recordTitle(values, id, moduleKey) {
  if (moduleKey === 'propietarios') {
    const fullName = ['Nombre', 'Apellido paterno', 'Apellido materno']
      .map((key) => values[key]).filter(Boolean).join(' ')
    if (fullName) return fullName
  }
  const primary = (titleFields[moduleKey] || []).map((key) => values[key])
    .find((value) => typeof value === 'string' && value.trim())
  if (primary) return primary
  const name = ['Nombre', 'Apellido paterno', 'Apellido materno']
    .map((key) => values[key]).filter(Boolean).join(' ')
  return name || id.slice(0, 8).toUpperCase()
}

function isMissingModuleTableError(error) {
  return error?.code === 'PGRST205'
    || error?.code === '42P01'
    || /could not find the table ['"]?public\.modulo_registros/i.test(error?.message || '')
}

export default function ModuleWorkspace({ moduleName, organization, user, role, onSignOut }) {
  const config = moduleName === 'Configuración y seguridad' ? settingsModule : modules[moduleName]
  if (!config) return <div className="module-error">No se encontró la configuración de este módulo.</div>
  if (moduleName === 'Configuración y seguridad') {
    return <SecurityWorkspace config={config} organization={organization} user={user} role={role} onSignOut={onSignOut} />
  }
  return <RecordWorkspace key={`${organization.id}-${config.key}`} config={config} moduleName={moduleName} organization={organization} user={user} role={role} />
}

function RecordWorkspace({ config, moduleName, organization, user, role }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [values, setValues] = useState({})
  const [appliedFilters, setAppliedFilters] = useState({})
  const [mapOpen, setMapOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [databaseUnavailable, setDatabaseUnavailable] = useState(false)
  const [activeAction, setActiveAction] = useState(null)
  const [actionRecordId, setActionRecordId] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const searchRef = useRef(null)
  const formRef = useRef(null)
  const canEdit = role !== 'viewer'

  useEffect(() => {
    if (activeAction === 'Agregar') {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeAction])

  const load = async () => {
    setLoading(true)
    let request = supabase
      .from('modulo_registros')
      .select('id, titulo, datos, creado_en, actualizado_en')
      .eq('organizacion_id', organization.id)
      .order('actualizado_en', { ascending: false })
    if (config.key !== 'historico_reportes') request = request.eq('modulo', config.key)
    const { data, error } = await request
    if (error) {
      console.error(`No fue posible cargar el módulo ${moduleName}.`, error)
      setRecords([])
      if (isMissingModuleTableError(error)) {
        setDatabaseUnavailable(true)
        setNotice('')
      } else {
        setNotice(`Error al cargar: ${error.message}`)
      }
    } else {
      setRecords(data ?? [])
      setDatabaseUnavailable(false)
    }
    setLoading(false)
    return !error
  }

  useEffect(() => { load() }, [organization.id, config.key])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')
    if (!query) return records
    return records.filter((record) => [record.titulo, ...Object.values(record.datos || {})]
      .some((value) => String(value ?? '').toLocaleLowerCase('es').includes(query)))
  }, [records, search])

  const reportRecords = useMemo(() => {
    if (config.key !== 'historico_reportes') return filtered
    const filters = appliedFilters
    const searchValue = (keys) => keys.map((key) => String(filters[key] || '').trim().toLocaleLowerCase('es')).find(Boolean) || ''
    const exact = (record, keys, value) => {
      if (!value) return true
      return keys.some((key) => String(record.datos?.[key] ?? '').toLocaleLowerCase('es').includes(value))
    }
    const startDate = filters['Fecha inicial']
    const endDate = filters['Fecha final']
    return filtered.filter((record) => {
      const createdDate = record.creado_en?.slice(0, 10) || ''
      if (startDate && createdDate && createdDate < startDate) return false
      if (endDate && createdDate && createdDate > endDate) return false
      return exact(record, ['Municipio', 'Nombre municipio', 'Fundo / Municipio'], searchValue(['Municipio']))
        && exact(record, ['Fundo', 'Nombre fundo', 'Fundo / Municipio'], searchValue(['Fundo']))
        && exact(record, ['Propietario histórico', 'Propietario', 'Nombre'], searchValue(['Propietario histórico']))
        && exact(record, ['Manzana histórica', 'Manzana'], searchValue(['Manzana histórica']))
        && exact(record, ['Lote histórico', 'Lote'], searchValue(['Lote histórico']))
        && exact(record, ['Libro histórico', 'Libro', 'Libro título'], searchValue(['Libro histórico']))
        && exact(record, ['Estado histórico', 'Estado del lote', 'Estado'], searchValue(['Estado histórico']))
    })
  }, [filtered, appliedFilters, config.key])

  const newRecord = () => {
    if (!canEdit) return
    setValues({})
    setSelectedRecord(null)
    setActiveAction('Agregar')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const editRecord = (record) => {
    if (!canEdit) return
    setValues(record.datos || {})
    setSelectedRecord(record)
    setActiveAction('Agregar')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    const payload = {
      organizacion_id: organization.id,
      modulo: config.key,
      titulo: recordTitle(values, selectedRecord?.id || crypto.randomUUID(), config.key),
      datos: values,
    }

    try {
      const result = selectedRecord
        ? await supabase.from('modulo_registros').update(payload)
          .eq('organizacion_id', organization.id).eq('id', selectedRecord.id).select('id').maybeSingle()
        : await supabase.from('modulo_registros').insert({ ...payload, creado_por: user.id }).select('id').single()

      const saveError = result.error || (selectedRecord && !result.data
        ? new Error('No se encontró el registro seleccionado o no tienes permiso para editarlo.')
        : null)
      if (saveError) throw saveError
      setValues({})
      setSelectedRecord(null)
      if (await load()) setNotice('Registro guardado correctamente en Supabase.')
    } catch (error) {
      console.error(`No fue posible guardar un registro de ${moduleName}.`, error)
      if (isMissingModuleTableError(error)) {
        setDatabaseUnavailable(true)
      } else {
        setNotice(`No se pudo guardar: ${error.message}`)
      }
    } finally {
      setBusy(false)
    }
    window.setTimeout(() => setNotice(''), 5000)
  }

  const remove = async (record) => {
    if (!canEdit || !window.confirm(`¿Eliminar "${record.titulo}"? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    const { data, error } = await supabase.from('modulo_registros').delete()
      .eq('organizacion_id', organization.id).eq('id', record.id).select('id').maybeSingle()
    const deleteError = error || (!data ? new Error('No se encontró el registro o no tienes permiso para eliminarlo.') : null)
    if (deleteError) {
      console.error(`No fue posible eliminar un registro de ${moduleName}.`, deleteError)
      if (isMissingModuleTableError(deleteError)) {
        setDatabaseUnavailable(true)
      } else {
        setNotice(`No se pudo eliminar: ${deleteError.message}`)
      }
    } else {
      if (selectedRecord?.id === record.id) {
        setSelectedRecord(null)
        setValues({})
      }
      if (await load()) setNotice('Registro eliminado.')
    }
    setBusy(false)
    window.setTimeout(() => setNotice(''), 5000)
  }

  const exportCsv = () => {
    const columns = config.key === 'historico_reportes'
      ? [...new Set(reportRecords.flatMap((record) => Object.keys(record.datos || {})))]
      : config.fields.map((field) => field.label)
    const rows = reportRecords.map((record) => columns.map((field) => record.datos?.[field] ?? ''))
    const csv = [columns, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\r\n')
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${config.key}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const action = (label) => {
    if (config.key === 'lotes_predios' && ['Buscar lote', 'Plano', 'Vender lote', 'Imprimir'].includes(label)) {
      setActiveAction((current) => current === label ? null : label)
      setActionRecordId('')
      if (label === 'Vender lote') {
        setSaleDate('')
        setSalePrice('')
      }
      setNotice('')
      return
    }
    if (config.key === 'historico_reportes' && /consultar/i.test(label)) {
      setAppliedFilters(values)
      setNotice('Filtros históricos aplicados a los registros de la organización.')
      window.setTimeout(() => setNotice(''), 4000)
      return
    }
    if (/buscar|consulta/i.test(label)) {
      searchRef.current?.focus()
      return
    }
    if (/reporte|exportar/i.test(label)) {
      exportCsv()
      return
    }
    if (/estado de cuenta/i.test(label)) {
      exportCsv()
      return
    }
    if (/imprimir|plano|constancia|título|titulo/i.test(label)) {
      window.print()
      return
    }
    if (/modificar|eliminar/i.test(label)) {
      setNotice(`Selecciona un registro de la lista para ${label.toLocaleLowerCase('es')}.`)
      window.setTimeout(() => setNotice(''), 4000)
      return
    }
    if (/agregar|ampliación|otorgar|masiva|orden|pagar|conceptos/i.test(label)) {
      newRecord()
      return
    }
    newRecord()
  }

  const selectedActionRecord = records.find((record) => record.id === actionRecordId)

  const continueSale = (event) => {
    event.preventDefault()
    if (!selectedActionRecord || !canEdit) return
    setValues({
      ...selectedActionRecord.datos,
      'Estado del lote': 'Vendido',
      'Fecha de venta': saleDate,
      ...(salePrice ? { 'Valor total ($)': salePrice } : {}),
    })
    setSelectedRecord(selectedActionRecord)
    setActiveAction('Agregar')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const printSelectedRecord = () => {
    if (!selectedActionRecord) return
    window.print()
  }

  const actionRecordSelector = <label className="form-field action-record-field">
    <span>Selecciona el lote</span>
    <select required value={actionRecordId} onChange={(event) => setActionRecordId(event.target.value)}>
      <option value="">Seleccionar lote...</option>
      {records.map((record) => <option key={record.id} value={record.id}>{record.titulo}</option>)}
    </select>
  </label>

  return <section className="module-page">
    <header className="module-heading">
      <div><p className="eyebrow">{organization.nombre.toLocaleUpperCase('es')}</p><h1>{moduleName}</h1><p>{config.description}</p></div>
      <div className="module-actions">
        {canEdit && <button className={`module-action-button module-action-primary ${activeAction === 'Agregar' ? 'module-action-active' : ''}`} onClick={newRecord}><FilePlus2 size={20} /> Agregar</button>}
        {config.actions.map((label) => <button className={`module-action-button ${activeAction === label ? 'module-action-active' : ''}`} key={label} onClick={() => action(label)}>{label}</button>)}
      </div>
    </header>
    {config.key === 'lotes_predios' && activeAction && activeAction !== 'Agregar' && <section className="action-panel" aria-labelledby="action-panel-title">
      <div className="action-panel-heading"><h2 id="action-panel-title">{activeAction}</h2><button className="action-panel-close" type="button" onClick={() => setActiveAction(null)} aria-label="Cerrar apartado"><X size={18} /></button></div>
      {activeAction === 'Buscar lote' && <form className="action-form" onSubmit={(event) => { event.preventDefault(); setActiveAction(null); searchRef.current?.focus() }}>
        <label className="form-field"><span>Clave catastral, manzana o lote</span><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Escribe los datos del lote que buscas" /></label>
        <button className="primary-button" type="submit"><Search size={16} /> Buscar lote</button>
      </form>}
      {activeAction === 'Plano' && <div className="action-form">
        {actionRecordSelector}
        <button className="primary-button" type="button" disabled={!selectedActionRecord} onClick={() => { setSelectedRecord(selectedActionRecord); setValues(selectedActionRecord?.datos || {}); setMapOpen(true) }}><MapPinned size={16} /> Ver plano</button>
      </div>}
      {activeAction === 'Vender lote' && <form className="action-form" onSubmit={continueSale}>
        {actionRecordSelector}
        <label className="form-field"><span>Fecha de venta</span><input required type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} /></label>
        <label className="form-field"><span>Precio de venta ($)</span><input type="number" min="0" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} placeholder="Opcional" /></label>
        <button className="primary-button" type="submit" disabled={!selectedActionRecord || !canEdit}><Check size={16} /> Continuar con la venta</button>
      </form>}
      {activeAction === 'Imprimir' && <div className="action-form">
        {actionRecordSelector}
        <button className="primary-button" type="button" disabled={!selectedActionRecord} onClick={printSelectedRecord}><Printer size={16} /> Imprimir lote</button>
        {selectedActionRecord && <article className="print-preview">
          <h2>{selectedActionRecord.titulo}</h2>
          {Object.entries(selectedActionRecord.datos || {}).filter(([, value]) => value !== '' && value != null && value !== false).map(([label, value]) => <p key={label}><strong>{label}:</strong> {String(value)}</p>)}
        </article>}
      </div>}
    </section>}
    <div className="module-layout">
      <section className="capture-card">
        <div className="capture-header"><div><h2>Captura principal</h2><p>Completa solo los campos de {moduleName.toLocaleLowerCase('es')}.</p></div><span className="record-count">{config.key === 'historico_reportes' ? reportRecords.length : records.length} registros</span></div>
        {databaseUnavailable && <div className="schema-notice" role="status"><AlertCircle size={18} /><div><strong>Configuración pendiente de la base de datos</strong><span>Para habilitar estos apartados, ejecuta <code>supabase/schema.sql</code> en el SQL Editor de tu proyecto Supabase y vuelve a cargar.</span></div><button type="button" onClick={load} disabled={loading}>{loading ? 'Revisando…' : 'Volver a intentar'}</button></div>}
        {activeAction === 'Agregar' && <form className="module-inline-form" ref={formRef} onSubmit={save}>
          <div className="module-fields">
            {config.fields.slice(0, config.simpleFieldCount || 6).map((field) => <ModuleField key={field.label} field={field} value={values[field.label]} onChange={(value) => setValues((current) => ({ ...current, [field.label]: value }))} />)}
          </div>
          {config.fields.length > (config.simpleFieldCount || 6) && <details className="more-fields"><summary>Mostrar más datos <span>{config.fields.length - (config.simpleFieldCount || 6)} campos adicionales</span></summary><div className="module-fields">{config.fields.slice(config.simpleFieldCount || 6).map((field) => <ModuleField key={field.label} field={field} value={values[field.label]} onChange={(value) => setValues((current) => ({ ...current, [field.label]: value }))} />)}</div></details>}
          {canEdit && <div className="inline-form-actions">{selectedRecord && <button type="button" className="secondary-button" onClick={() => { setSelectedRecord(null); setValues({}) }}>Cancelar edición</button>}<button type="submit" className="primary-button" disabled={busy || databaseUnavailable}><Check size={16} />{busy ? 'Guardando…' : selectedRecord ? 'Guardar cambios' : 'Guardar registro'}</button></div>}
          {!canEdit && <p className="readonly-message">Tu rol permite consultar la información, pero no modificarla.</p>}
        </form>}
        <label className="module-search"><Search size={17} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar en ${moduleName.toLocaleLowerCase('es')}`} /><button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">×</button></label>
        {loading ? <div className="module-empty"><LoaderCircle className="spin" size={21} /> Cargando registros…</div> : reportRecords.length ? <div className="record-list">
          {reportRecords.map((record) => <article className="record-card" key={record.id}>
            <button className="record-main" disabled={config.key === 'historico_reportes' || !canEdit} onClick={() => editRecord(record)}><strong>{record.titulo}</strong><small>{Object.entries(record.datos || {}).filter(([, value]) => value && typeof value !== 'boolean').slice(0, 3).map(([, value]) => value).join(' · ') || 'Sin datos adicionales'}</small><small className="record-updated">Actualizado {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(record.actualizado_en))}</small></button>
            {canEdit && config.key !== 'historico_reportes' && <div className="record-actions"><button aria-label="Modificar registro" onClick={() => editRecord(record)}><Pencil size={16} /></button><button aria-label="Eliminar registro" onClick={() => remove(record)}><Trash2 size={16} /></button></div>}
            <ChevronRight size={17} className="record-chevron" />
          </article>)}
        </div> : <div className="module-empty"><Users size={22} /><strong>{search ? 'No hay coincidencias' : 'Todavía no hay registros'}</strong><span>{canEdit ? 'Usa “Agregar” para capturar el primer registro.' : 'Los registros de este módulo aparecerán aquí.'}</span></div>}
      </section>
      <aside className="related-card">
        <h2>Información de este apartado</h2>
        <div className="related-table">
          {config.related.map((row, index) => <div className={index === 0 ? 'related-row related-head' : 'related-row'} key={`${row[0]}-${index}`}><span>{row[0]}</span><span>{row[1]}</span>{row[2] && <span>{row[2]}</span>}</div>)}
        </div>
        <p className="related-note">Los campos adicionales se guardan con cada registro y puedes desplegarlos al capturar cuando los necesites.</p>
      </aside>
    </div>
    {mapOpen && <MapPreview values={selectedRecord?.datos || values} onClose={() => setMapOpen(false)} />}
    {notice && <div className={`module-notice ${notice.startsWith('No se pudo') || notice.startsWith('Error') ? 'notice-error' : ''}`}><AlertCircle size={16} />{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
    {busy && <div className="saving-overlay"><LoaderCircle className="spin" size={17} />Guardando en Supabase...</div>}
  </section>
}

function MapPreview({ values, onClose }) {
  const title = values['Clave catastral'] || values['Lote'] || 'Lote de ejemplo'
  const manzana = values['Manzana'] || 'A'
  return <div className="map-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="map-preview" role="dialog" aria-modal="true" aria-labelledby="map-title">
      <header className="map-header"><div><span className="map-title-icon"><MapPinned size={19} /></span><div><h2 id="map-title">Plano del terreno</h2><p>{title} · Manzana {manzana}</p></div></div><button className="icon-button" onClick={onClose} aria-label="Cerrar mapa"><X size={19} /></button></header>
      <div className="map-canvas">
        <div className="map-preview-label"><span className="preview-dot" /> Vista previa ilustrativa</div>
        <div className="map-north"><MoveUpRight size={18} /><strong>N</strong></div>
        <div className="map-road map-road-top"><span>CALLE PRINCIPAL</span></div>
        <div className="map-road map-road-left"><span>AV. DEL FUNDO</span></div>
        <div className="map-block block-ne"><span>MANZANA B</span></div>
        <div className="map-block block-sw"><span>MANZANA C</span></div>
        <div className="map-block block-se"><span>MANZANA D</span></div>
        <div className="parcel parcel-main">
          <span className="parcel-number">{values['Lote'] || 'Lote'}</span>
          <strong>{title}</strong>
          <span className="parcel-size">{values['Superficie real (m²)'] ? `${values['Superficie real (m²)']} m²` : 'Superficie pendiente'}</span>
        </div>
        <div className="map-street-label">CALLE DEL TERRENO</div>
        <div className="map-legend"><span><i className="legend-parcel" /> Lote seleccionado</span><span><i className="legend-block" /> Otros terrenos</span></div>
        <span className="map-scale">0 ───────── 20 m</span>
      </div>
      <div className="map-status"><AlertCircle size={16} /><div><strong>Mapa de demostración</strong><span>Este plano es ilustrativo. La conexión con QGIS y la ubicación catastral todavía no están habilitadas.</span></div></div>
      <footer className="map-footer"><span><ZoomIn size={15} /> Vista previa sin interacción</span><button className="secondary-button" onClick={onClose}>Cerrar</button></footer>
    </section>
  </div>
}

function ModuleField({ field, value, onChange }) {
  return <label className={`form-field ${field.wide ? 'field-wide' : ''} ${field.type === 'checkbox' ? 'module-checkbox' : ''}`}>
    {field.type === 'checkbox' ? <><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{field.label}</span></> : <>
      <span>{field.label}{field.required && <b> *</b>}</span>
      {field.type === 'select' ? <select required={field.required} value={value || ''} onChange={(event) => onChange(event.target.value)}><option value="">Seleccionar...</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select>
        : field.type === 'textarea' ? <textarea rows="3" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || ''} />
          : <input type={field.type} min={field.type === 'number' ? '0' : undefined} required={field.required} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || ''} />}
    </>}
  </label>
}

function SecurityWorkspace({ config, organization, user, role, onSignOut }) {
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [memberRole, setMemberRole] = useState('editor')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const isAdmin = ['owner', 'admin'].includes(role)
  const connectionValues = {
    Usuario: user.email,
    Password: 'Gestionada por Supabase Auth',
    Servidor: import.meta.env.VITE_SUPABASE_URL,
    Puerto: '5432',
    'Base de datos': 'PostgreSQL administrado por Supabase',
    'Ruta Access': 'No aplica con Supabase',
    'Unidad documentos': 'Configurar en Supabase Storage',
    'Ruta IntelliCAD': 'No configurado',
  }
  const permissions = {
    'Acceso fundos': true,
    'Acceso lotes': true,
    'Acceso pagos': true,
    'Acceso histórico': true,
    'Acceso seguridad': isAdmin,
    'Permitir todo': isAdmin,
  }

  const loadMembers = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('listar_miembros_organizacion', { p_organizacion_id: organization.id })
    if (error) {
      console.error('No fue posible consultar los miembros.', error)
      setNotice(`No se pudieron consultar los permisos: ${error.message}. Ejecuta el schema.sql actualizado.`)
    } else setMembers(data || [])
    setLoading(false)
  }
  useEffect(() => { loadMembers() }, [organization.id])

  const addMember = async (event) => {
    event.preventDefault()
    setBusy(true)
    const { error } = await supabase.rpc('agregar_miembro_organizacion', {
      p_organizacion_id: organization.id, p_email: email.trim(), p_rol: memberRole,
    })
    if (error) {
      console.error('No fue posible agregar al miembro.', error)
      setNotice(`No se pudo agregar: ${error.message}`)
    } else {
      setEmail('')
      setNotice('Miembro agregado correctamente.')
      await loadMembers()
    }
    setBusy(false)
  }

  return <section className="module-page">
    <header className="module-heading"><div><p className="eyebrow">{organization.nombre.toLocaleUpperCase('es')}</p><h1>Configuración y seguridad</h1><p>{config.description}</p></div><div className="module-actions"><button className="module-action-button" onClick={onSignOut}>Cerrar sesión</button></div></header>
    <div className="module-layout">
      <section className="capture-card">
        <div className="capture-header"><div><h2>Cuenta y organización</h2><p>Los permisos se aplican por organización mediante Row Level Security.</p></div><span className="record-count">{role}</span></div>
        <div className="security-summary"><div><small>USUARIO</small><strong>{user.email}</strong></div><div><small>ORGANIZACIÓN</small><strong>{organization.nombre}</strong></div><div><small>CONEXIÓN</small><strong>Supabase · PostgreSQL</strong></div><div><small>ROL</small><strong>{role === 'viewer' ? 'Solo consulta' : role === 'owner' ? 'Propietario' : role === 'admin' ? 'Administrador' : 'Editor'}</strong></div></div>
        <div className="settings-block"><h3>Parámetros de conexión</h3><div className="connection-grid">{config.connectionFields.map((field) => <div key={field}><small>{field}</small><strong>{connectionValues[field] || '—'}</strong></div>)}</div><p>La contraseña nunca se muestra ni se almacena en el navegador. Las rutas locales heredadas no aplican a Supabase.</p></div>
        <div className="settings-block"><h3>Permisos de acceso por módulo</h3><div className="permission-grid">{config.permissionFields.map((permission) => <label key={permission}><input type="checkbox" checked={permissions[permission]} disabled /><span>{permission}</span></label>)}</div><p>El rol actual determina las acciones disponibles y se valida también en la base de datos.</p></div>
        <div className="member-heading"><div><h2>Usuarios y permisos</h2><p>Los miembros deben crear una cuenta antes de ser agregados.</p></div></div>
        {isAdmin && <form className="member-form" onSubmit={addMember}><label className="form-field"><span>Correo del usuario registrado</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@ejemplo.com" /></label><label className="form-field"><span>Permiso</span><select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="editor">Editor</option><option value="admin">Administrador</option><option value="viewer">Solo consulta</option></select></label><button className="primary-button" disabled={busy}>{busy ? 'Agregando…' : 'Agregar usuario'}</button></form>}
        {loading ? <div className="module-empty"><LoaderCircle className="spin" size={20} />Cargando usuarios...</div> : <div className="member-list">{members.map((member) => <div className="member-row" key={member.usuario_id}><div className="user-avatar">{(member.email || 'US').slice(0, 2).toUpperCase()}</div><strong>{member.email}</strong><span className="area-pill">{member.rol}</span></div>)}</div>}
      </section>
      <aside className="related-card"><h2>Permisos por módulo</h2><div className="related-table">{config.related.map((row, index) => <div className={`related-row ${index === 0 ? 'related-head' : ''}`} key={`${row[0]}-${index}`}><span>{row[0]}</span><span>{row[1]}</span></div>)}</div><div className="related-screens">{config.screens.map((screen) => <span key={screen}>{screen}</span>)}</div><h2 className="related-subhead">Seguridad de la conexión</h2><p className="related-note">La aplicación usa la clave publishable del frontend. Las claves secretas permanecen fuera del navegador; las políticas RLS aíslan los datos de cada organización.</p></aside>
    </div>
    {notice && <div className={`module-notice ${notice.startsWith('No se pudo') || notice.startsWith('No se pudieron') ? 'notice-error' : ''}`}><AlertCircle size={16} />{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
  </section>
}
