import { localPermissions } from '../../../api/permissions.mjs'
import { useEffect, useState } from 'react'

const stages = ['Recepción', 'Cartografía', 'Valuación', 'Titulación', 'Legal', 'Entrega']
const statusNames = { pendiente: 'Pendiente de revisión', aceptado: 'Aceptado', rechazado: 'Rechazado' }
const money = value => value == null || value === '' ? '' : Number(value).toFixed(2)

export default function ExpedienteDocumentacion({ expediente, role, apiBase = '/api', onChanged }) {
  const [requirements, setRequirements] = useState([])
  const [documents, setDocuments] = useState([])
  const [requirementText, setRequirementText] = useState('')
  const [catastres, setCatastres] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const canManage = localPermissions(role).documentacion
  const canReview = localPermissions(role).revisionDocumentos
  const canCaptureCatastro = localPermissions(role).catastro
  const canReadCatastro = localPermissions(role).lecturaCatastro

  async function load() {
    const response = await fetch(`${apiBase}/expedientes/${expediente.id}/documentos`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudieron consultar los documentos.')
    setRequirements(data.requisitos || [])
    setRequirementText((data.requisitos || []).join('\n'))
    setDocuments(data.documentos || [])
    const rows = canReadCatastro ? await Promise.all((expediente.predios || []).map(async predio => {
      const result = await fetch(`${apiBase}/expedientes/${expediente.id}/predios/${predio.id}/catastro`)
      const payload = await result.json()
      if (!result.ok) throw new Error(payload.error || 'No se pudieron consultar los datos catastrales.')
      return [predio.id, payload.datos]
    })) : []
    setCatastres(Object.fromEntries(rows))
  }

  useEffect(() => {
    let alive = true
    load().catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [expediente.id, canReadCatastro])

  async function upload(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const requisito = String(data.get('requisito') || '').trim()
    const etapa = String(data.get('etapa') || '').trim()
    const query = new URLSearchParams({ requisito, etapa })
    setBusy('upload'); setError('')
    try {
      const fileForm = new FormData()
      fileForm.append('archivo', data.get('archivo'))
      const response = await fetch(`${apiBase}/expedientes/${expediente.id}/documentos?${query}`, { method: 'POST', body: fileForm })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar el documento.')
      form.reset(); await load(); onChanged?.()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function saveRequirements(event) {
    event.preventDefault(); setBusy('requirements'); setError('')
    try {
      const response = await fetch(`${apiBase}/requisitos-documentales`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_tramite: expediente.tipo_tramite, nombres: requirementText.split('\n').map(name => name.trim()).filter(Boolean) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el checklist.')
      await load()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function review(doc, estado_revision) {
    const motivo = estado_revision === 'rechazado' ? window.prompt('Escribe el motivo del rechazo:') : ''
    if (estado_revision === 'rechazado' && !motivo?.trim()) return
    setBusy(doc.id); setError('')
    try {
      const response = await fetch(`${apiBase}/expedientes/${expediente.id}/documentos/${doc.id}/revision`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado_revision, motivo }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar la revisión.')
      await load(); onChanged?.()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function saveCatastro(event, predio) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    const propietarios = String(values.propietarios || '').split('\n').map(nombre => nombre.trim()).filter(Boolean).map(nombre => ({ nombre }))
    setBusy(`catastro-${predio.id}`); setError('')
    try {
      const response = await fetch(`${apiBase}/expedientes/${expediente.id}/predios/${predio.id}/catastro`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, propietarios }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudieron guardar los datos catastrales.')
      setCatastres(current => ({ ...current, [predio.id]: data.datos })); onChanged?.()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function reviewCatastro(predio, estado_revision) {
    const motivo = estado_revision === 'rechazado' ? window.prompt('Escribe el motivo del rechazo:') : ''
    if (estado_revision === 'rechazado' && !motivo?.trim()) return
    try {
      const response = await fetch(`${apiBase}/expedientes/${expediente.id}/predios/${predio.id}/catastro`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado_revision, motivo }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo revisar la cédula.')
      setCatastres(old => ({ ...old, [predio.id]: data.datos })); onChanged?.()
    } catch (e) { setError(e.message) }
  }

  return <details className="expediente-medicion expediente-documentacion">
    <summary>Documentación, cédula y propietarios</summary>
    {error && <p role="alert">{error}</p>}
    <h4>Checklist y documentos del trámite</h4>
    {role === 'admin' && <form className="attachment-upload" onSubmit={saveRequirements}>
      <label className="full-field">Configurar requisitos de este tipo de trámite (uno por línea)
        <textarea value={requirementText} onChange={event => setRequirementText(event.target.value)} rows={5} maxLength={4000} />
      </label>
      <button className="secondary-button" disabled={Boolean(busy)}>{busy === 'requirements' ? 'Guardando…' : 'Guardar checklist'}</button>
    </form>}
    <ul className="expediente-attachment-list">
      {requirements.map(name => {
        const latest = documents.find(doc => doc.requisito === name)
        return <li key={name}><span><strong>{name}</strong><small>{latest ? `${statusNames[latest.estado_revision]} · versión ${latest.version}` : 'Sin documento cargado'}</small></span></li>
      })}
    </ul>
    {canManage && !['cerrado', 'entregado', 'no_procede'].includes(expediente.estado) && <form className="attachment-upload" onSubmit={upload}>
      <label>Requisito<select name="requisito" required defaultValue=""><option value="" disabled>Selecciona un requisito</option>{requirements.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Etapa<select name="etapa" required defaultValue=""><option value="" disabled>Selecciona la etapa</option>{stages.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Archivo<input name="archivo" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required /></label>
      <small>PDF, JPG o PNG · hasta 10 MB. Las nuevas cargas conservan las versiones anteriores.</small>
      <button className="secondary-button" type="submit" disabled={Boolean(busy)}>{busy === 'upload' ? 'Cargando…' : 'Adjuntar documento'}</button>
    </form>}
    <ul className="expediente-attachment-list">
      {documents.map(doc => <li key={doc.id}>
        <span><strong>{doc.requisito} · v{doc.version}</strong><small>{doc.nombre} · {doc.etapa} · {statusNames[doc.estado_revision]}{doc.motivo_revision ? ` · ${doc.motivo_revision}` : ''}</small></span>
        <a className="secondary-button" href={`${apiBase}/expedientes/${expediente.id}/documentos/${doc.id}?inline=1`} target="_blank" rel="noreferrer">Ver</a>
        <a className="secondary-button" href={`${apiBase}/expedientes/${expediente.id}/documentos/${doc.id}`}>Descargar</a>
        {canReview && <div className="document-review"><button type="button" disabled={Boolean(busy)} onClick={() => review(doc, 'aceptado')}>Aceptar</button><button type="button" disabled={Boolean(busy)} onClick={() => review(doc, 'rechazado')}>Rechazar</button><button type="button" disabled={Boolean(busy)} onClick={() => review(doc, 'pendiente')}>Pendiente</button></div>}
      </li>)}
    </ul>
    {canReadCatastro && (expediente.predios || []).map(predio => {
      const data = catastres[predio.id]
      return <section className="expediente-catastro" key={predio.id}>
        <h4>Cédula catastral y propietarios · {predio.clave_catastral}</h4>
        {canCaptureCatastro && !['cerrado', 'entregado', 'no_procede'].includes(expediente.estado) ? <form key={`${predio.id}:${data?.capturado_en || 'nuevo'}`} className="attachment-upload catastro-form" onSubmit={event => saveCatastro(event, predio)}>
          <label>Folio de cédula<input name="cedula_folio" maxLength="100" defaultValue={data?.cedula_folio || ''} /></label>
          <label>Fecha<input name="cedula_fecha" type="date" defaultValue={data?.cedula_fecha?.slice(0,10) || ''} /></label>
          <label>Valor del terreno<input name="valor_terreno" type="number" min="0" step="0.01" defaultValue={money(data?.valor_terreno)} /></label>
          <label>Valor construcción<input name="valor_construccion" type="number" min="0" step="0.01" defaultValue={money(data?.valor_construccion)} /></label>
          <label>Valor catastral<input name="valor_catastral" type="number" min="0" step="0.01" defaultValue={money(data?.valor_catastral)} /></label>
          <label className="full-field">Propietarios (uno por línea)<textarea name="propietarios" required defaultValue={(data?.propietarios || []).map(owner => owner.nombre).join('\n')} /></label>
          <button className="secondary-button" disabled={Boolean(busy)}>{busy === `catastro-${predio.id}` ? 'Guardando…' : 'Guardar cédula y propietarios'}</button>
        </form> : null}
        <p>Estado: <strong>{statusNames[data?.estado_revision] || 'Sin captura'}</strong>{data?.motivo_revision ? ` · ${data.motivo_revision}` : ''}</p>
        {canCaptureCatastro && data && !['cerrado', 'entregado', 'no_procede'].includes(expediente.estado) && <div className="document-review"><button type="button" onClick={() => reviewCatastro(predio,'aceptado')}>Aceptar datos</button><button type="button" onClick={() => reviewCatastro(predio,'rechazado')}>Rechazar datos</button></div>}
      </section>
    })}
  </details>
}
