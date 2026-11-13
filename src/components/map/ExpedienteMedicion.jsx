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
  const path = `${apiBase}/expedientes/${expedienteId}/predios/${predioId}/medicion`

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

  const canRequest = !record && ['admin', 'ventanilla'].includes(role)
  const canAssign = ['solicitado', 'asignado'].includes(record?.estado) && ['admin', 'cartografia'].includes(role) && topografos.length > 0
  const canVisit = record?.estado === 'asignado' && role === 'topografia'

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
  </details>
}
