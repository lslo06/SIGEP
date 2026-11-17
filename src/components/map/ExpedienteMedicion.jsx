import { useEffect, useState } from "react"

const labels = {
  medido: "Medido",
  solicitado: "Medición solicitada",
  asignado: "Visita asignada",
  visitado: "Visita registrada",
}

export default function ExpedienteMedicion({ expedienteId, predioId, closed, role, topografos = [], onSaved, apiBase = "/api" }) {
  const [record, setRecord] = useState(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [attachments, setAttachments] = useState([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState("")
  const [uploading, setUploading] = useState("")
  const path = `${apiBase}/expedientes/${expedienteId}/predios/${predioId}/medicion`
  const attachmentsPath = `${apiBase}/expedientes/${expedienteId}/predios/${predioId}/archivos`
  const canListAttachments = ["admin", "cartografia", "topografia"].includes(role)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(path, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "No se pudo consultar la medición.")
        if (!controller.signal.aborted) {
          setRecord(data.medicion)
          setReady(true)
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message)
      }
    }
    load()
    return () => controller.abort()
  }, [path])

  async function loadAttachments(signal) {
    if (!canListAttachments) return
    setAttachmentsLoading(true)
    setAttachmentsError("")
    try {
      const response = await fetch(attachmentsPath, { signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudieron consultar los archivos.")
      if (!signal?.aborted) setAttachments(data.archivos || [])
    } catch (error) {
      if (!signal?.aborted) setAttachmentsError(error.message)
    } finally {
      if (!signal?.aborted) setAttachmentsLoading(false)
    }
  }

  useEffect(() => {
    if (!canListAttachments) return undefined
    const controller = new AbortController()
    loadAttachments(controller.signal)
    return () => controller.abort()
  }, [attachmentsPath, canListAttachments])

  async function save(event) {
    event.preventDefault()
    if (saving) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    values.accion = event.nativeEvent.submitter?.value
    setSaving(true)
    setError("")
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la medición.")
      setRecord(data.medicion)
      onSaved?.()
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadAttachment(event, kind) {
    event.preventDefault()
    if (uploading) return
    const form = event.currentTarget
    const file = new FormData(form).get("archivo")
    if (!(file instanceof File) || !file.size) return
    setUploading(kind)
    setAttachmentsError("")
    try {
      const response = await fetch(`${attachmentsPath}/${kind}`, { method: "POST", body: new FormData(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "No se pudo adjuntar el archivo.")
      form.reset()
      await loadAttachments()
    } catch (error) {
      setAttachmentsError(error.message)
    } finally {
      setUploading("")
    }
  }

  const canRequest = !record && ['admin', 'ventanilla'].includes(role)
  const canAssign = ['solicitado', 'asignado'].includes(record?.estado) && ['admin', 'cartografia'].includes(role) && topografos.length > 0
  const canVisit = record?.estado === 'asignado' && role === 'topografia'
  const canUploadEvidence = !closed && record?.estado === 'visitado' && role === 'topografia'
  const canUploadPlan = !closed && ['medido', 'visitado'].includes(record?.estado) && ['admin', 'cartografia'].includes(role)

  return <details className="expediente-medicion">
    <summary>Medición y visita de campo</summary>
    {!ready && !error && <p role="status">Cargando medición…</p>}
    {error && <p role="alert">{error}</p>}
    {ready && <p>Estado: <strong>{labels[record?.estado] || "Por confirmar"}</strong></p>}
    {record?.responsable && <p>Responsable: {record.responsable} · Compromiso: {record.fecha_compromiso?.slice(0, 10)}</p>}
    {record?.fecha_visita && <p>Visita: {record.fecha_visita.slice(0, 10)} · {record.superficie_m2} m² · {record.observaciones} · Evidencia: {record.referencia_evidencia}</p>}
    {ready && !closed && (canRequest || canAssign || canVisit) && <form onSubmit={save}>
      <fieldset disabled={saving}>
        {canRequest && <>
          <button className="secondary-action" type="submit" value="medido">Confirmar medido</button>
          <button className="primary-action" type="submit" value="solicitado">Solicitar medición</button>
        </>}
        {canAssign && <>
          <label className="form-field">Responsable de campo<select name="responsable_id" required defaultValue=""><option value="">Selecciona un topógrafo</option>{topografos.map(person => <option key={person.id} value={person.id}>{person.nombre}</option>)}</select></label>
          <label className="form-field">Fecha compromiso<input name="fecha_compromiso" type="date" required /></label>
          <button className="primary-action" type="submit" value="asignado">Asignar visita</button>
        </>}
        {canVisit && <>
          <label className="form-field">Fecha de visita<input name="fecha_visita" type="date" required /></label>
          <label className="form-field">Superficie medida (m²)<input name="superficie_m2" type="number" min="0.01" step="0.01" required /></label>
          <label className="form-field">Observaciones<textarea name="observaciones" maxLength={2000} required /></label>
          <label className="form-field">Referencia de evidencia<input name="referencia_evidencia" maxLength={500} required /></label>
          <button className="primary-action" type="submit" value="visitado">Registrar visita</button>
        </>}
      </fieldset>
    </form>}
    {canListAttachments && <section className="expediente-attachments" aria-label="Evidencia y plano del predio">
      <h4>Archivos del expediente</h4>
      {canUploadEvidence && <form className="attachment-upload" onSubmit={event => uploadAttachment(event, "evidencia-visita")}>
        <label>Evidencia de visita del topógrafo
          <input name="archivo" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required disabled={Boolean(uploading)} />
        </label>
        <small>PDF, JPG o PNG · máximo 10 MB</small>
        <button className="secondary-button" type="submit" disabled={Boolean(uploading)}>{uploading === "evidencia-visita" ? "Subiendo evidencia…" : "Adjuntar evidencia"}</button>
      </form>}
      {canUploadPlan && <form className="attachment-upload" onSubmit={event => uploadAttachment(event, "plano")}>
        <label>Plano de Cartografía
          <input name="archivo" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required disabled={Boolean(uploading)} />
        </label>
        <small>Disponible después de completar o confirmar la medición · PDF, JPG o PNG · máximo 10 MB</small>
        <button className="secondary-button" type="submit" disabled={Boolean(uploading)}>{uploading === "plano" ? "Subiendo plano…" : "Adjuntar plano"}</button>
      </form>}
      {attachmentsError && <p role="alert">{attachmentsError}</p>}
      {attachmentsLoading ? <p role="status">Consultando archivos…</p> : attachments.length === 0
        ? <p>No hay archivos disponibles para este expediente y predio.</p>
        : <ul className="expediente-attachment-list">{attachments.map(file => <li key={file.id}>
          <span><strong>{file.tipo === "plano" ? "Plano" : "Evidencia de visita"} · v{file.version}</strong><small>{file.nombre} · {(file.bytes / 1024 / 1024).toFixed(2)} MB</small></span>
          <a className="secondary-button" href={`${attachmentsPath}/${file.id}`}>Descargar</a>
        </li>)}</ul>}
    </section>}
  </details>
}
