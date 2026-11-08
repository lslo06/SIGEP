import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { canWork, isAdmin } from '../lib/permissions'
import { localDate } from '../lib/validation'
import { documentTypes, requestTypes, stageFor, stagesFor, overdue } from '../lib/workflow'
import './workflow.css'

const common = [
  ['telefono', 'Teléfono', 'text', ['ventanilla', 'captura']],
  ['correo', 'Correo', 'email', ['ventanilla', 'captura']],
  ['domicilio', 'Domicilio para notificaciones', 'text', ['ventanilla', 'captura']],
  ['representante', 'Representante legal', 'text', ['ventanilla', 'captura']],
  ['motivo_solicitud', 'Propósito / motivo de la solicitud', 'text', ['ventanilla']],
  ['folio_predio', 'Folio externo del predio', 'text', ['captura']],
  ['clave_catastral', 'Clave catastral externa', 'text', ['captura']],
  ['responsable', 'Responsable asignado (correo)', 'email', ['jefatura', 'direccion']],
  ['fecha_compromiso', 'Fecha compromiso', 'date', ['jefatura', 'direccion']],
]
const detailFields = {
  'TIT-09': [['validacion', 'Validación del expediente', ['Pendiente', 'Validado']], ['observaciones_validacion', 'Observaciones de validación']],
  'TIT-10': [['titulo_numero', 'Número de título'], ['titulo_revisado', 'Revisión contra expediente', ['Pendiente', 'Revisado']]],
  'TIT-11': [['oficio_consejeria', 'Número de oficio'], ['destinatario_consejeria', 'Destinatario'], ['envio_consejeria', 'Fecha de envío', 'date']],
  'TIT-12': [['recepcion_consejeria', 'Recepción en Consejería', 'date'], ['firmas_consejeria', 'Firmas recabadas', ['Pendiente', 'Firmado']], ['retorno_consejeria', 'Retorno de Consejería', 'date']],
  'TIT-13': [['folio_rpp', 'Folio de seguimiento RPP'], ['documentos_rpp', 'Documentos remitidos'], ['envio_rpp', 'Fecha de envío RPP', 'date']],
  'TIT-14': [['inscripcion_rpp', 'Folio / partida de inscripción'], ['fecha_inscripcion', 'Fecha de inscripción', 'date'], ['retorno_rpp', 'Fecha de retorno RPP', 'date']],
  'TIT-17': [['afectacion_final', 'Revisión y afectación de base de datos', ['Pendiente', 'Completada']], ['receptor', 'Persona que recibe'], ['fecha_entrega', 'Fecha de entrega / ceremonia', 'date'], ['fecha_archivo', 'Fecha de envío al archivo', 'date']],
  'BUS-01': [['tipo_documento', 'Documento solicitado', requestTypes]],
  'BUS-05': [['dictamen', 'Determinación legal', ['Pendiente', 'Procede', 'No procede']], ['motivo_dictamen', 'Justificación legal']],
  'BUS-07': [['documento_texto', 'Texto del documento institucional', 'textarea']],
  'BUS-08': [['revision_jefatura', 'Revisión de Jefatura', ['Pendiente', 'Revisado']], ['autorizacion_direccion', 'Autorización de Dirección', ['Pendiente', 'Autorizado']]],
  'BUS-09': [['receptor', 'Persona que recibe'], ['fecha_entrega', 'Fecha de entrega', 'date'], ['fecha_archivo', 'Fecha de archivo', 'date']],
}

export default function WorkflowWorkspace({ organization, user, role, files }) {
  const [flows, setFlows] = useState([])
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [period, setPeriod] = useState({ from: '', to: '', type: '', responsible: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [documents, setDocuments] = useState([])
  const [events, setEvents] = useState([])
  const [draft, setDraft] = useState({})
  const [note, setNote] = useState('')
  const [docType, setDocType] = useState(documentTypes[0])
  const [fileUpload, setFileUpload] = useState(null)
  const [config, setConfig] = useState(null)
  const [indicators, setIndicators] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [printArtifact, setPrintArtifact] = useState(null)
  const [returnStage, setReturnStage] = useState('')
  const file = files.find(f => f._id === selected)
  const flow = flows.find(f => f.expediente_id === selected)
  const stage = file ? stageFor(file, flow) : null
  const today = localDate()
  useEffect(() => {
    if (!printArtifact) return
    const clear = () => setPrintArtifact(null)
    window.addEventListener('afterprint', clear)
    const timer = setTimeout(() => window.print(), 100)
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', clear) }
  }, [printArtifact])
  async function load() {
    setLoading(true); setError('')
    try {
      const results = await Promise.all([
        supabase.from('sgfl_seguimiento').select('*').eq('organizacion_id', organization.id),
        supabase.rpc('configuracion_sgfl', { p_organizacion_id: organization.id }),
        supabase.rpc('indicadores_sgfl', { p_organizacion_id: organization.id }),
      ])
      for (const result of results) if (result.error) throw result.error
      setFlows(results[0].data || []); setConfig(results[1].data)
      setIndicators(results[2].data)
    } catch { setError('No se pudo cargar el seguimiento. Intenta nuevamente o contacta a soporte.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [organization.id])
  useEffect(() => {
    let alive = true
    setDocuments([]); setEvents([]); setDraft({ ...(flow?.datos || {}), responsable: flow?.responsable || '', fecha_compromiso: flow?.fecha_compromiso || '' }); setNote(''); setFileUpload(null); setReturnStage(''); setPrintArtifact(null)
    if (!selected) return
    setDetailLoading(true)
    Promise.all([
      supabase.from('sgfl_documentos').select('*').eq('organizacion_id', organization.id).eq('expediente_id', selected).order('creado_en', { ascending: false }),
      supabase.from('sgfl_bitacora').select('*').eq('organizacion_id', organization.id).eq('expediente_id', selected).order('creado_en', { ascending: false }),
    ]).then(results => {
      if (!alive) return
      if (results.some(r => r.error)) { setError('No se pudo cargar el expediente completo.'); return }
      setDocuments(results[0].data || []); setEvents(results[1].data || [])
    }).catch(() => { if (alive) setError('No se pudo conectar con el expediente.') }).finally(() => { if (alive) setDetailLoading(false) })
    return () => { alive = false }
  }, [selected, flows])
  async function act(action, data = draft) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const { error } = await supabase.rpc('accion_expediente_sgfl', { p_organizacion_id: organization.id, p_expediente_id: selected, p_accion: action, p_datos: data, p_observacion: note })
      if (error) throw error
      await load()
    } catch (error) { setError(error.message || 'No se pudo guardar el movimiento.') }
    finally { setBusy(false) }
  }
  async function upload(event) {
    event.preventDefault(); if (!fileUpload || busy) return
    if (fileUpload.size > 20 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(fileUpload.type)) { setError('Selecciona PDF, JPG o PNG de hasta 20 MB.'); return }
    setBusy(true); setError('')
    const path = `${organization.id}/${selected}/${crypto.randomUUID()}.${fileUpload.name.split('.').pop().toLowerCase()}`
    try {
      const { error: storageError } = await supabase.storage.from('sgfl-documentos').upload(path, fileUpload, { contentType: fileUpload.type })
      if (storageError) throw storageError
      const { error } = await supabase.rpc('accion_expediente_sgfl', { p_organizacion_id: organization.id, p_expediente_id: selected, p_accion: 'documento', p_datos: { tipo: docType, ruta: path, nombre: fileUpload.name }, p_observacion: note })
      if (error) throw error
      setFileUpload(null); await load()
    } catch (error) { setError(error.message || 'No se pudo guardar el documento.') }
    finally { setBusy(false) }
  }
  async function download(doc) {
    const { data, error } = await supabase.storage.from('sgfl-documentos').createSignedUrl(doc.ruta, 60)
    if (error) { setError('No se pudo abrir el documento.'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }
  const filtered = useMemo(() => files.filter(f => {
    const tracking = flows.find(s => s.expediente_id === f._id)
    const term = search.trim().toLocaleLowerCase('es')
    return (!term || [f.id, f.propietario, f.fundo, f.titulo, f.lote, tracking?.datos?.clave_catastral, tracking?.datos?.folio_predio].some(v => String(v || '').toLocaleLowerCase('es').includes(term)))
      && (!period.from || f.fechaSolicitud >= period.from) && (!period.to || f.fechaSolicitud <= period.to)
      && (!period.type || f.tipo === period.type)
      && (!period.responsible || String(tracking?.responsable || '').toLowerCase().includes(period.responsible.toLowerCase()))
      && (filter !== 'Vencidos' || overdue(tracking, today))
      && (filter !== 'Mis asignados' || tracking?.responsable === user.email)
      && (filter !== 'Cerrados' || tracking?.cerrado)
      && (filter !== 'Mi área' || stagesFor(f.tipo).find(s => s[0] === (tracking?.etapa || stagesFor(f.tipo)[0][0]))?.[2].includes(role))
  }), [files, flows, filter, search, role, user.email, today, period])
  const stageEditable = stage && canWork(role, stage[2]) && !flow?.cerrado
  const latestDocs = documents.filter(d => !documents.some(other => other.tipo === d.tipo && other.version > d.version))
  const required = config?.requisitos?.[file?.tipo === 'Búsqueda de información' ? 'busqueda' : 'titulacion'] || []
  const field = ([key, label, type = 'text'], disabled) => <label key={key}>{label}{Array.isArray(type) ? <select disabled={disabled} value={draft[key] || ''} onChange={e => setDraft({ ...draft, [key]: e.target.value })}><option value="">Seleccionar…</option>{type.map(v => <option key={v}>{v}</option>)}</select> : type === 'textarea' ? <textarea disabled={disabled} value={draft[key] || ''} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /> : <input disabled={disabled} type={type} value={draft[key] || ''} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />}</label>
  function exportCsv() {
    const escape = v => '"' + String(v || '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"'
    const csv = [['Folio', 'Tipo', 'Solicitante', 'Municipio / fundo', 'Etapa', 'Responsable', 'Compromiso', 'Estado', 'Días totales'], ...filtered.map(f => { const s = flows.find(s => s.expediente_id === f._id); return [f.id, f.tipo, f.propietario, f.fundo, stageFor(f, s)[1], s?.responsable, s?.fecha_compromiso, s?.cerrado ? 'Cerrado' : s?.estado || 'Activo', f.fechaSolicitud ? Math.max(0, Math.floor((new Date(s?.cerrado_en || today) - new Date(f.fechaSolicitud)) / 86400000)) : ''] })].map(row => row.map(escape).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'seguimiento-fundos.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="sgfl-workspace"><header><p className="eyebrow">BANDEJA POR ÁREA</p><h1>Seguimiento de trámites</h1><p>Titulación y búsqueda de información, desde la recepción hasta el archivo. Las actividades cartográficas se realizan en la aplicación externa.</p></header>
    <div className="sgfl-stats"><span>{files.length} expedientes</span><span>{flows.filter(s => !s.cerrado).length} en seguimiento</span><span>{flows.filter(s => s.cerrado).length} cerrados</span><span>{flows.filter(s => overdue(s, today)).length} vencidos</span><span>{flows.filter(s => s.estado === 'Prevenido').length} prevenidos</span></div>
    {indicators && <details className="sgfl-card"><summary>Tiempos de atención de la organización</summary><p>Resolución promedio: {indicators.dias_resolucion == null ? 'sin expedientes cerrados' : `${indicators.dias_resolucion} días`}. Se calcula con los movimientos registrados; los expedientes históricos sin seguimiento no se incluyen.</p><ul>{indicators.etapas.map(item => <li key={item.etapa}>{item.etapa}: {item.dias_promedio} días de promedio · {item.completadas} etapas completadas</li>)}</ul></details>}
    <div className="sgfl-search"><input aria-label="Buscar expediente" placeholder="Folio, solicitante, lote, título, municipio o clave catastral" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Filtrar bandeja" value={filter} onChange={e => setFilter(e.target.value)}>{['Todos', 'Mi área', 'Mis asignados', 'Vencidos', 'Cerrados'].map(v => <option key={v}>{v}</option>)}</select><button className="secondary-button" onClick={exportCsv}>Exportar CSV</button><button className="secondary-button" onClick={load} disabled={busy || loading}>Actualizar</button></div>
    <details className="sgfl-card"><summary>Filtros del reporte</summary><div className="sgfl-fields"><label>Solicitud desde<input type="date" value={period.from} onChange={e => setPeriod({ ...period, from: e.target.value })} /></label><label>Solicitud hasta<input type="date" min={period.from} value={period.to} onChange={e => setPeriod({ ...period, to: e.target.value })} /></label><label>Tipo de trámite<select value={period.type} onChange={e => setPeriod({ ...period, type: e.target.value })}><option value="">Todos</option><option>Titulación</option><option>Búsqueda de información</option></select></label><label>Responsable<input type="search" value={period.responsible} onChange={e => setPeriod({ ...period, responsible: e.target.value })} /></label></div><p>{filtered.length} expedientes en el resultado. La exportación respeta estos filtros.</p></details>
    {error && <p className="sgfl-error" role="alert">{error}</p>}
    {loading ? <p role="status">Cargando seguimiento…</p> : !files.length ? <div className="sgfl-card module-empty"><h2>Listo para recibir expedientes</h2><p>Aún no hay predios registrados. Al conectar la otra aplicación podrás vincular su folio y clave catastral y dar seguimiento a los trámites.</p></div> : <div className="sgfl-columns"><aside className="sgfl-bandeja">{filtered.map(f => { const s = flows.find(s => s.expediente_id === f._id); return <button key={f._id} className="sgfl-file" aria-pressed={selected === f._id} onClick={() => { if (!busy) setSelected(f._id) }}><strong>{f.id}</strong><span>{f.propietario}</span><small>{stageFor(f, s)[1]}</small><small>{s?.cerrado ? 'Cerrado' : overdue(s, today) ? 'Compromiso vencido' : s?.estado || 'Sin iniciar seguimiento'}</small></button> })}{!filtered.length && <p>Sin coincidencias.</p>}</aside>
      {!file ? <p>Selecciona un expediente para consultar su proceso.</p> : detailLoading ? <p role="status">Cargando expediente…</p> : <article className="sgfl-detail">
        <section className="sgfl-card"><h2>{file.id} · {file.tipo}</h2><p>{file.propietario} · {file.fundo} · Lote {file.lote}</p><div className="sgfl-pills"><span>{stage[0]} · {stage[1]}</span><span>{flow?.cerrado ? 'Cerrado' : flow?.estado || 'Activo'}</span><span>{flow?.responsable || 'Sin asignar'}</span></div>
          <div className="sgfl-fields">{common.map(([key, label, type, allowed]) => field([key, label, type], busy || flow?.cerrado || !canWork(role, allowed)))}{(detailFields[stage[0]] || []).map(spec => field(spec, busy || !stageEditable || spec[0] === 'revision_jefatura' && !canWork(role, ['jefatura']) || spec[0] === 'autorizacion_direccion' && !canWork(role, ['direccion'])))}</div>
          {!flow?.cerrado && role !== 'viewer' && <><label>Observación / prevención / motivo<textarea value={note} onChange={e => setNote(e.target.value)} /></label><div className="sgfl-actions"><button className="secondary-button" disabled={busy} onClick={() => act('guardar')}>Guardar datos permitidos</button><button className="secondary-button" disabled={busy || !note.trim()} onClick={() => act('observacion', {})}>Registrar observación</button>{canWork(role, ['ventanilla', 'jefatura']) && <button className="secondary-button" disabled={busy || !note.trim()} onClick={() => act('prevenir', {})}>Registrar prevención</button>}{stageEditable && <button className="primary-button" disabled={busy} onClick={() => act('avanzar')}>{stage[0] === stagesFor(file.tipo).at(-1)[0] ? 'Registrar entrega y cerrar' : 'Validar y avanzar'}</button>}</div></>}
          {stage[0] === 'BUS-07' && stageEditable && <button className="secondary-button" disabled={!config?.plantilla_busqueda} onClick={() => setDraft({ ...draft, documento_texto: String(config?.plantilla_busqueda || '').replaceAll('{{folio}}', file.id).replaceAll('{{solicitante}}', file.propietario).replaceAll('{{documento}}', draft.tipo_documento || '').replaceAll('{{fecha}}', today) })}>Preparar desde plantilla institucional</button>}
          {!flow?.cerrado && ['TIT-07', 'BUS-03', 'BUS-06'].includes(stage[0]) && canWork(role, ['direccion']) && <button className="secondary-button" disabled={busy || !note.trim()} onClick={() => act('excepcion_pago', {})}>Autorizar excepción de pago con motivo</button>}
          {!flow?.cerrado && canWork(role, ['jefatura', 'direccion']) && stagesFor(file.tipo)[0][0] !== stage[0] && <div className="sgfl-actions"><label>Devolver para corrección<select value={returnStage} onChange={e => setReturnStage(e.target.value)}><option value="">Seleccionar etapa anterior…</option>{stagesFor(file.tipo).slice(0, stagesFor(file.tipo).findIndex(s => s[0] === stage[0])).map(s => <option key={s[0]} value={s[0]}>{s[0]} · {s[1]}</option>)}</select></label><button className="secondary-button" disabled={busy || !note.trim() || !returnStage} onClick={() => act('devolver', { etapa: returnStage })}>Devolver con motivo</button></div>}
          {flow?.datos?.documento_texto && <details><summary>Documento preparado</summary><p style={{ whiteSpace: 'pre-wrap' }}>{flow.datos.documento_texto}</p>{flow.datos.autorizacion_direccion === 'Autorizado' && <button className="secondary-button" onClick={() => setPrintArtifact({ title: flow.datos.tipo_documento, folio: file.id, text: flow.datos.documento_texto })}>Imprimir / guardar PDF</button>}</details>}
          {['TIT-17', 'BUS-09'].includes(stage[0]) && <button className="secondary-button" onClick={() => setPrintArtifact({ title: 'Acuse de recepción de documentos', folio: file.id, text: `Solicitante: ${file.propietario}\nPredio: ${draft.folio_predio || file.lote}\nClave catastral: ${draft.clave_catastral || 'Pendiente de vinculación'}\nDocumento: ${file.tipo === 'Titulación' ? `Título de propiedad ${draft.titulo_numero || ''}` : draft.tipo_documento || 'Documento solicitado'}\nPersona que recibe: ${draft.receptor || '________________________________'}\nFecha de entrega: ${draft.fecha_entrega || '________________'}\n\nRecibí los documentos indicados.\n\nFirma de recepción: __________________________________\n\nResponsable de entrega: ______________________________` })}>Preparar acuse de recepción</button>}
        </section>
        <section className="sgfl-card"><h2>Requisitos y documentos</h2><p>La carga queda pendiente de revisión. Al sustituir un tipo se conserva la versión anterior.</p><ul>{required.map(type => <li key={type}>{type} · {latestDocs.find(d => d.tipo === type)?.estado || 'Pendiente'}</li>)}</ul>
          {!flow?.cerrado && canWork(role, ['digitalizacion', 'ventanilla', 'titulacion', 'legal']) && <form onSubmit={upload}><div className="sgfl-fields"><label>Clasificación<select value={docType} onChange={e => setDocType(e.target.value)}>{[...new Set([...documentTypes, ...required])].map(type => <option key={type}>{type}</option>)}</select></label><label>Archivo (PDF, JPG o PNG; máximo 20 MB)<input key={selected + documents.length} type="file" accept="application/pdf,image/jpeg,image/png" required onChange={e => setFileUpload(e.target.files[0])} /></label></div><button className="secondary-button" disabled={busy}>Subir nueva versión</button></form>}
          {documents.map(doc => <div className="sgfl-doc" key={doc.id}><div><strong>{doc.tipo} · v{doc.version}</strong><small>{doc.nombre} · {doc.estado} · {doc.etapa}</small><small>{doc.revisado_por ? `Revisión: ${doc.revisado_por} · ${doc.revisado_en} · ${doc.motivo || ''}` : 'Sin revisar'}</small></div><div className="sgfl-actions"><button className="secondary-button" onClick={() => download(doc)}>Abrir</button>{latestDocs.includes(doc) && !flow?.cerrado && canWork(role, ['jefatura', 'titulacion', 'legal']) && <><button className="secondary-button" disabled={busy} onClick={() => act('revisar_documento', { id: doc.id, estado: 'Aceptado' })}>Aceptar</button><button className="secondary-button" disabled={busy || !note.trim()} onClick={() => act('revisar_documento', { id: doc.id, estado: 'Rechazado' })}>Rechazar con motivo</button></>}</div></div>)}
        </section><section className="sgfl-card"><h2>Historial de movimientos</h2><ol className="sgfl-timeline">{events.map(event => <li key={event.id}><strong>{event.accion} · {event.etapa_origen || 'Recepción'} → {event.etapa_destino || event.etapa_origen || 'Recepción'}</strong><span>{new Date(event.creado_en).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} · {event.actor}</span><span>{event.observacion}</span></li>)}</ol>{!events.length && <p>Sin movimientos registrados.</p>}</section>
      </article>}</div>}
    {isAdmin(role) && config && <details className="sgfl-card"><summary>Configurar requisitos y plantilla institucional</summary><p>Escribe un requisito por línea. Los cambios se registran en bitácora.</p><div className="sgfl-fields">{[['titulacion', 'Requisitos de titulación'], ['busqueda', 'Requisitos de búsqueda']].map(([key, label]) => <label key={key}>{label}<textarea value={config.requisitos[key].join('\n')} onChange={e => setConfig({ ...config, requisitos: { ...config.requisitos, [key]: e.target.value.split('\n') } })} /></label>)}</div><label>Plantilla institucional de búsqueda<textarea value={config.plantilla_busqueda} onChange={e => setConfig({ ...config, plantilla_busqueda: e.target.value })} /></label><p>Variables disponibles: {'{{folio}}, {{solicitante}}, {{documento}}, {{fecha}}'}. El área responsable debe proporcionar el texto institucional.</p><button className="primary-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const value = { ...config, requisitos: Object.fromEntries(Object.entries(config.requisitos).map(([key, values]) => [key, [...new Set(values.map(v => v.trim()).filter(Boolean))]])) }; const { error } = await supabase.rpc('guardar_configuracion_sgfl', { p_organizacion_id: organization.id, p_datos: value }); if (error) throw error; await load() } catch (e) { setError(e.message) } finally { setBusy(false) } }}>Guardar configuración</button></details>}
    {printArtifact && <section className="sgfl-print-artifact"><h1>{printArtifact.title}</h1><p>Expediente: {printArtifact.folio}</p><p style={{ whiteSpace: 'pre-wrap' }}>{printArtifact.text}</p></section>}
  </section>
}
