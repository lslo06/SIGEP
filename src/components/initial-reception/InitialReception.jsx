import { useEffect, useState } from 'react'
import { initialVisitTransitions } from '../../../api/permissions.mjs'
import InitialParcelLink from './InitialParcelLink'
import './initial-reception.css'

const visitLabels = { revision_direccion: 'Pendiente de Dirección', revision_jefatura: 'Pendiente de Jefatura', solicitado: 'Pendiente de asignación', asignado: 'Visita asignada', visitado: 'Visita registrada · pendiente de revisión cartográfica' }
const stateLabel = value => visitLabels[value] || 'En recepción · pendiente de solicitar medición'
const dateLabel = value => value ? String(value).slice(0, 10) : 'Sin programar'
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date())
async function getJson(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'No se pudo procesar la solicitud.')
  return data
}

export function InitialReceptionQueue({ role, apiBase = '/api/sigep', onOpen, revision = 0 }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    setItems(null); setError('')
    fetch(`${apiBase}/solicitudes-titulacion`, { signal: controller.signal }).then(getJson).then(data => {
      if (!controller.signal.aborted) setItems(data.solicitudes || [])
    }).catch(problem => { if (!controller.signal.aborted) setError(problem.message) })
    return () => controller.abort()
  }, [apiBase, role, revision, version])
  return <section className="intake-panel" aria-label="Solicitudes de título desde ventanilla">
    <header className="intake-heading"><div><h2>Solicitudes de título desde ventanilla</h2><p>{role === 'topografia' ? 'Ubicaciones y referencias de las visitas asignadas a tu cuenta.' : 'Recepción y visita inicial de terrenos pendientes de identificación cartográfica.'}</p></div><button className="secondary-button" type="button" onClick={() => setVersion(v => v + 1)}>Actualizar</button></header>
    {error && <p role="alert" className="intake-error">{error}</p>}
    {!error && !items && <p role="status">Cargando solicitudes…</p>}
    {items?.length === 0 && <p>Sin solicitudes iniciales pendientes para tu área.</p>}
    {items?.map(item => <article className="intake-item" key={item.id}>
      <button className="intake-item-button" type="button" aria-expanded={onOpen ? undefined : selected === item.id} onClick={() => onOpen ? onOpen(item.id) : setSelected(selected === item.id ? null : item.id)}>
        <strong>{item.folio} · {item.solicitante}</strong><span>{item.municipio} · {item.localidad}</span><span>{item.etapa_actual === 'integracion_cartografica' ? 'Predio vinculado · integración cartográfica' : stateLabel(item.estado_visita)}</span><small>Área: {item.area_responsable}{item.fecha_compromiso ? ` · Visita: ${dateLabel(item.fecha_compromiso)}` : ''}</small>
      </button>
      {!onOpen && selected === item.id && <InitialVisit expedienteId={item.id} apiBase={apiBase} role={role} onChanged={() => setVersion(v => v + 1)} />}
    </article>)}
    {items?.length === 100 && <small>Se muestran las 100 solicitudes más recientes. Consulta los anteriores por folio en Seguimiento de trámites.</small>}
  </section>
}

export function InitialVisit({ expedienteId, role, apiBase = '/api/sigep', onChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    fetch(`${apiBase}/solicitudes-titulacion/${expedienteId}`, { signal: controller.signal }).then(getJson).then(value => {
      if (!controller.signal.aborted) setData(value)
    }).catch(problem => { if (!controller.signal.aborted) setError(problem.message) })
    return () => controller.abort()
  }, [apiBase, expedienteId, role, revision])

  async function save(event, action) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true); setError(''); setSuccess('')
    try {
      await getJson(await fetch(`${apiBase}/solicitudes-titulacion/${expedienteId}/${action ? 'visita' : 'evidencia'}`, action ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...Object.fromEntries(values.entries()), accion: action }),
      } : { method: 'POST', body: values }))
      form.reset()
      setSuccess(action ? 'Movimiento registrado en el expediente.' : 'Evidencia guardada.')
      setRevision(value => value + 1)
      onChanged?.()
    } catch (problem) { setError(problem.message) }
    finally { setBusy(false) }
  }

  const row = data?.solicitud
  const isClosed = ['cerrado', 'entregado', 'no_procede'].includes(row?.estado)
  const actions = row && !isClosed ? Object.entries(initialVisitTransitions).filter(([, step]) => step.from === (row.estado_visita ?? null) && step.roles.includes(role)) : []
  return <section className="intake-panel" aria-label="Ubicación y visita inicial">
    <h3>Ubicación y visita inicial</h3>
    {error && <p className="intake-error" role="alert">{error}</p>}
    {success && <p role="status">{success}</p>}
    {!error && !data && <p role="status">Cargando ficha de recepción…</p>}
    {row && <>
      <p className="intake-state">{data.predios?.length ? 'Predio vinculado · integración cartográfica' : stateLabel(row.estado_visita)}</p>
      <dl className="intake-facts">
        <div><dt>Solicitante</dt><dd>{row.solicitante}</dd></div>
        <div><dt>Contacto</dt><dd>{[row.telefono, row.correo].filter(Boolean).join(' · ') || 'Sin contacto registrado'}</dd></div>
        <div><dt>Municipio / localidad</dt><dd>{row.municipio} · {row.localidad}</dd></div>
        <div><dt>Dirección declarada</dt><dd>{row.direccion || 'Sin dirección formal; consultar referencias'}</dd></div>
        <div className="intake-wide"><dt>Referencias para localizar el terreno</dt><dd>{row.referencias}</dd></div>
        <div><dt>Topógrafo asignado</dt><dd>{row.responsable || 'Pendiente'}</dd></div>
        <div><dt>Fecha compromiso</dt><dd>{dateLabel(row.fecha_compromiso)}</dd></div>
        {row.estado_visita === 'visitado' && <><div><dt>Visita realizada</dt><dd>{dateLabel(row.fecha_visita)}</dd></div><div><dt>Superficie medida</dt><dd>{Number(row.superficie_m2).toLocaleString('es-MX')} m²</dd></div></>}
        {row.observaciones && <div className="intake-wide"><dt>Observaciones de la última acción</dt><dd>{row.observaciones}</dd></div>}
      </dl>
      {data.predios?.length ? <p>Predio vinculado: {data.predios.map(parcel => parcel.clave_catastral).join(', ')}. Continúa con plano y datos catastrales en la ficha del expediente de Seguimiento de trámites.</p>
        : <p>La dirección es una referencia de recepción. La identificación definitiva del predio queda pendiente de Cartografía.</p>}
      {['admin', 'cartografia'].includes(role) && row.estado_visita === 'visitado' && !isClosed && !data.predios?.length && <InitialParcelLink expedienteId={expedienteId} apiBase={apiBase} measuredArea={row.superficie_m2} onLinked={() => { setRevision(value => value + 1); onChanged?.() }} />}
      {actions.map(([action, step]) => <form className="intake-form" key={action} onSubmit={event => save(event, action)}>
        <fieldset disabled={busy}><legend>{step.label}</legend>
          {action === 'asignar' && <div className="intake-grid">
            <label>Topógrafo *<select name="responsable_id" required defaultValue=""><option value="" disabled>Selecciona una cuenta activa</option>{data.topografos.map(person => <option key={person.id} value={person.id}>{person.nombre}</option>)}</select></label>
            <label>Fecha compromiso *<input type="date" name="fecha_compromiso" required min={today()} /></label>
            {!data.topografos.length && <p>No hay cuentas activas de Topografía disponibles.</p>}
          </div>}
          {action === 'registrar_visita' && <div className="intake-grid">
            <label>Fecha de visita *<input type="date" name="fecha_visita" required max={today()} /></label>
            <label>Superficie medida (m²) *<input type="number" name="superficie_m2" required min="0.01" max="999999999999.99" step="0.01" placeholder="Ej. 150.25" /></label>
          </div>}
          <label>Observaciones{action === 'registrar_visita' ? ' *' : ''}<textarea name="observaciones" required={action === 'registrar_visita'} maxLength={2000} rows={2} placeholder={action === 'registrar_visita' ? 'Describe lo observado, cómo se identificó el terreno y el resultado de la medición' : 'Indicaciones para el área que recibe la solicitud'} /></label>
          <button className="primary-button" disabled={busy || action === 'asignar' && !data.topografos.length}>{busy ? 'Guardando…' : step.label}</button>
        </fieldset>
      </form>)}
      {role === 'topografia' && row.estado_visita === 'visitado' && !isClosed && <form className="intake-form" onSubmit={event => save(event)}><fieldset disabled={busy}><legend>Evidencia de visita</legend><label>Archivo PDF, PNG o JPEG (máximo 10 MB)<input type="file" name="archivo" accept="application/pdf,image/png,image/jpeg" required /></label><button className="primary-button" disabled={busy}>Adjuntar evidencia</button></fieldset></form>}
      <h4>Evidencias de visita</h4>
      {data.archivos.length ? <ul>{data.archivos.map(file => <li key={file.id}><a href={`${apiBase}/solicitudes-titulacion/${expedienteId}/archivos/${file.id}`} download>{file.nombre}</a> · versión {file.version}</li>)}</ul> : <p>Sin evidencias adjuntas.</p>}
    </>}
  </section>
}
