import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Check, ChevronRight, FilePlus2, LoaderCircle,
  MapPinned, Pencil, Printer, Search, Trash2, Users, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { modules, settingsModule } from './config'
import RecordEditor from './RecordEditor'
import { canModule } from '../lib/permissions'
import UsersWorkspace from './UsersWorkspace'
import LocalAdministration from './LocalAdministration'

const MapWorkspace = lazy(() => import('./MapWorkspace'))

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

export default function ModuleWorkspace({ moduleName, organization, user, role, onSignOut, local = false }) {
  const config = moduleName === 'Configuración y seguridad' ? settingsModule : modules[moduleName]
  if (!config) return <div className="module-error">No se encontró la configuración de este módulo.</div>
  if (!local && moduleName === 'Configuración y seguridad') {
    return <SecurityWorkspace config={config} organization={organization} user={user} role={role} onSignOut={onSignOut} />
  }
  if (local && moduleName === 'Configuración y seguridad') return <LocalAdministration />
  return <RecordWorkspace key={`${organization.id}-${config.key}`} config={config} moduleName={moduleName} organization={organization} user={user} role={role} local={local} />
}

function RecordWorkspace({ config, moduleName, organization, user, role, local }) {
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
  const [loadError, setLoadError] = useState('')
  const [activeAction, setActiveAction] = useState(null)
  const [actionRecordId, setActionRecordId] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const searchRef = useRef(null)
  const editorWindowRef = useRef(null)
  const [editorTarget, setEditorTarget] = useState(null)
  const [editorError, setEditorError] = useState('')
  const initialValuesRef = useRef('{}')
  const canEdit = !local && canModule(role, config.key, true)

  const openEditor = (initialValues = {}) => {
    if (editorWindowRef.current && !editorWindowRef.current.closed) {
      editorWindowRef.current.focus()
      return
    }
    initialValuesRef.current = JSON.stringify(initialValues)
    setEditorError('')
    const tab = window.open('', '_blank')
    if (tab) {
      tab.document.title = `${moduleName} · Captura · Fundos`
      tab.document.documentElement.lang = 'es'
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => tab.document.head.appendChild(node.cloneNode(true)))
      const viewport = tab.document.createElement('meta')
      viewport.name = 'viewport'
      viewport.content = 'width=device-width, initial-scale=1'
      tab.document.head.appendChild(viewport)
      const root = tab.document.createElement('div')
      tab.document.body.appendChild(root)
      editorWindowRef.current = tab
      setEditorTarget(root)
      tab.addEventListener('pagehide', () => {
        if (editorWindowRef.current === tab) {
          editorWindowRef.current = null
          setEditorTarget(null)
          setActiveAction(null)
        }
      })
      tab.focus()
    }
    setActiveAction('Agregar')
  }

  const closeEditor = () => {
    const tab = editorWindowRef.current
    editorWindowRef.current = null
    if (tab && !tab.closed) tab.close()
    setEditorTarget(null)
    setActiveAction(null)
    setEditorError('')
  }

  const cancelEditor = () => {
    if (busy) return
    const changed = JSON.stringify(values) !== initialValuesRef.current
    if (changed && !(editorWindowRef.current || window).confirm('Tienes cambios sin guardar. ¿Quieres descartarlos y volver al listado?')) return
    closeEditor()
  }

  useEffect(() => () => {
    const tab = editorWindowRef.current
    editorWindowRef.current = null
    if (tab && !tab.closed) tab.close()
  }, [])

  useEffect(() => {
    if (activeAction !== 'Agregar') return undefined
    const tab = editorWindowRef.current || window
    const warn = event => {
      if (tab !== window && editorWindowRef.current !== tab) return
      if (busy || JSON.stringify(values) !== initialValuesRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    tab.addEventListener('beforeunload', warn)
    if (tab !== window) window.addEventListener('beforeunload', warn)
    return () => {
      tab.removeEventListener('beforeunload', warn)
      if (tab !== window) window.removeEventListener('beforeunload', warn)
    }
  }, [activeAction, values, busy])

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      if (local) {
        const response = await fetch(`/api/sigep/modulos/${config.key}`)
        const data = await response.json()
        if (!response.ok || !Array.isArray(data.registros)) {
          throw new Error(response.status === 404 ? 'Actualiza la API de SIGEP en el servidor.' : data.error || 'No fue posible consultar el módulo.')
        }
        setRecords(data.registros)
        setDatabaseUnavailable(false)
        return true
      }
    let request = supabase
      .from('modulo_registros')
      .select('id, titulo, datos, creado_en, actualizado_en')
      .eq('organizacion_id', organization.id)
      .order('actualizado_en', { ascending: false })
    if (config.key !== 'historico_reportes') request = request.eq('modulo', config.key)
    const { data, error } = await request
    if (error) {
      setLoadError('No fue posible consultar los registros. Vuelve a intentar.')
      console.error(`No fue posible cargar el módulo ${moduleName}.`, error)
      setRecords([])
      if (isMissingModuleTableError(error)) {
        setDatabaseUnavailable(true)
        setNotice('')
      } else {
        setNotice('Error al cargar los registros. Vuelve a intentar en unos momentos.')
      }
    } else {
      setRecords(data ?? [])
      setDatabaseUnavailable(false)
    }
    return !error
    } catch (error) {
      setLoadError(local && !(error instanceof SyntaxError) ? error.message : 'No se pudo conectar con la base de datos. Comprueba tu conexión y vuelve a intentar.')
      return false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [organization.id, config.key, local])

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
    if (!canEdit || databaseUnavailable || loadError || loading) return
    setValues({})
    setSelectedRecord(null)
    openEditor()
  }

  const editRecord = (record) => {
    if (!canEdit) return
    setValues(record.datos || {})
    setSelectedRecord(record)
    openEditor(record.datos || {})
  }

  const save = async (event) => {
    event.preventDefault()
    if (!canEdit || busy || databaseUnavailable || loadError) return
    setBusy(true)
    setNotice('')
    setEditorError('')
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
      closeEditor()
      if (await load()) setNotice('Registro guardado correctamente.')
    } catch (error) {
      console.error(`No fue posible guardar un registro de ${moduleName}.`, error)
      setEditorError('No se pudo guardar el registro. Tus datos siguen en el formulario. Revisa la conexión y vuelve a intentar.')
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
    if (!['owner', 'admin'].includes(role) || !window.confirm(`¿Eliminar "${record.titulo}"? Esta acción no se puede deshacer.`)) return
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
    const columns = local ? [...new Set(reportRecords.flatMap(record => Object.keys(record.datos || {})))] : config.key === 'historico_reportes'
      ? [...new Set(reportRecords.flatMap((record) => Object.keys(record.datos || {})))]
      : config.fields.map((field) => field.label)
    const rows = reportRecords.map((record) => columns.map((field) => record.datos?.[field] ?? ''))
    const csv = [columns, ...rows]
      .map((row) => row.map((value) => {
        const text = String(value ?? '')
        const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
        return `"${safe.replaceAll('"', '""')}"`
      }).join(','))
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
    openEditor({ ...selectedActionRecord.datos, 'Estado del lote': 'Vendido', 'Fecha de venta': saleDate, ...(salePrice ? { 'Valor total ($)': salePrice } : {}) })
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

  const editor = activeAction === 'Agregar' && <RecordEditor config={config} moduleName={moduleName} values={values} setValues={setValues} editing={Boolean(selectedRecord)} busy={busy} error={editorError} target={editorTarget} onSave={save} onCancel={cancelEditor} />
  if (activeAction === 'Agregar') return <>{editor}{editorTarget && <section className="editor-open-message"><FilePlus2 size={32} /><h1>Captura abierta en otra pestaña</h1><p>Completa el formulario y guarda el registro para volver al listado.</p><button className="primary-button" onClick={() => editorWindowRef.current?.focus()}>Ir al formulario</button></section>}</>

  return <section className="module-page">
    <header className="module-heading">
      <div><p className="eyebrow">{organization.nombre.toLocaleUpperCase('es')}</p><h1>{moduleName}</h1><p>{local && config.key === 'configuracion_seguridad' ? 'Organizaciones y membresías. La gestión de cuentas requiere autenticación local.' : config.description}</p></div>
      <div className="module-actions">
        {canEdit && <button disabled={loading || databaseUnavailable || Boolean(loadError)} className={`module-action-button module-action-primary ${activeAction === 'Agregar' ? 'module-action-active' : ''}`} onClick={newRecord}><FilePlus2 size={20} /> Agregar</button>}
        {(local ? config.actions.filter(label => /buscar|consulta|reporte|exportar|imprimir/i.test(label)) : config.actions).map((label) => <button className={`module-action-button ${activeAction === label ? 'module-action-active' : ''}`} key={label} onClick={() => action(label)}>{label}</button>)}
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
        <div className="capture-header"><div><h2>{local ? 'Registros' : 'Captura principal'}</h2>{!local && <p>Completa solo los campos de {moduleName.toLocaleLowerCase('es')}.</p>}</div><span className="record-count">{config.key === 'historico_reportes' ? reportRecords.length : records.length} registros</span></div>
        {databaseUnavailable && <div className="schema-notice" role="alert"><AlertCircle size={18} /><div><strong>Este apartado no está disponible por el momento</strong><span>{local ? 'Este apartado todavía no está conectado a los registros de SIGEP.' : 'Intenta nuevamente en unos minutos. Si el problema continúa, comunícate con soporte.'}</span></div><button type="button" onClick={load} disabled={loading}>{loading ? 'Revisando…' : 'Volver a intentar'}</button></div>}
        <label className="module-search"><Search size={17} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar en ${moduleName.toLocaleLowerCase('es')}`} /><button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">×</button></label>
        {loading ? <div className="module-empty"><LoaderCircle className="spin" size={21} /> Cargando registros…</div> : databaseUnavailable ? null : loadError ? <div className="module-error-state" role="alert"><AlertCircle size={22} /><strong>No se pudieron cargar los registros</strong><span>{loadError}</span><button type="button" className="secondary-button" onClick={load}>Volver a intentar</button></div> : reportRecords.length ? <div className="record-list">
          {reportRecords.map((record) => <article className="record-card" key={record.id}>
            <button className="record-main" disabled={config.key === 'historico_reportes' || !canEdit} onClick={() => editRecord(record)}><strong>{record.titulo}</strong><small>{Object.entries(record.datos || {}).filter(([, value]) => value && typeof value !== 'boolean').slice(0, 3).map(([, value]) => value).join(' · ') || 'Sin datos adicionales'}</small><small className="record-updated">Actualizado {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(record.actualizado_en))}</small></button>
            {canEdit && config.key !== 'historico_reportes' && <div className="record-actions"><button aria-label="Modificar registro" onClick={() => editRecord(record)}><Pencil size={16} /></button>{['owner', 'admin'].includes(role) && <button aria-label="Eliminar registro" onClick={() => remove(record)}><Trash2 size={16} /></button>}</div>}
            <ChevronRight size={17} className="record-chevron" />
          </article>)}
        </div> : <div className="module-empty"><Users size={22} /><strong>{search ? 'No hay coincidencias' : 'Todavía no hay registros'}</strong><span>{canEdit ? 'Usa “Agregar” para capturar el primer registro.' : 'Los registros de este módulo aparecerán aquí.'}</span></div>}
      </section>
      <aside className="related-card">
        <h2>Información de este apartado</h2>
        <div className="related-table">
          {config.related?.map((row, index) => <div className={index === 0 ? 'related-row related-head' : 'related-row'} key={`${row[0]}-${index}`}><span>{row[0]}</span><span>{row[1]}</span>{row[2] && <span>{row[2]}</span>}</div>)}
        </div>
        <p className="related-note">Al agregar o editar, encontrarás todos los campos organizados en secciones dentro del formulario de captura.</p>
      </aside>
    </div>
    {mapOpen && <MapPreview values={selectedRecord?.datos || values} canViewMap={canModule(role, 'mapa')} onClose={() => setMapOpen(false)} />}
    {notice && <div className={`module-notice ${notice.startsWith('No se pudo') || notice.startsWith('Error') ? 'notice-error' : ''}`}><AlertCircle size={16} />{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
    {busy && <div className="saving-overlay"><LoaderCircle className="spin" size={17} />Guardando registro…</div>}
  </section>
}

function MapPreview({ values, canViewMap, onClose }) {
  const key = String(values['Clave catastral'] || '').trim()
  return <div className="map-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="map-preview" role="dialog" aria-modal="true" aria-labelledby="map-title">
      <header className="map-header">
        <div>
          <span className="map-title-icon"><MapPinned size={19} /></span>
          <div><h2 id="map-title">Plano del terreno</h2><p>{key || 'Consulta por clave catastral'}</p></div>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar mapa"><X size={19} /></button>
      </header>
      {canViewMap
        ? <Suspense fallback={<p role="status">Cargando mapa…</p>}><MapWorkspace initialKey={key} parcelOnly /></Suspense>
        : <div className="map-status"><AlertCircle size={16} /> Tu perfil no tiene acceso a la consulta cartográfica.</div>}
    </section>
  </div>
}

function SecurityWorkspace({ organization, user, role }) {
  return <UsersWorkspace organization={organization} user={user} role={role} />
}
