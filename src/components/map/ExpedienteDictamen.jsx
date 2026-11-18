import { useState } from "react"

const eligibleTypes = [
  "certificacion_antecedentes_titulo", "certificacion_copia_titulo",
  "constancia_datos_lote", "constancia_tramite_titulo",
]

export default function ExpedienteDictamen({ expediente, role, apiBase, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  if (!eligibleTypes.includes(expediente.tipo_tramite)) return null

  const dictamen = expediente.movimientos?.find(movement => movement.etapa_destino === "dictamen_legal")
  const closed = ["cerrado", "entregado", "no_procede"].includes(expediente.estado)
  if (!dictamen && (role !== "legal" || closed)) return null

  async function save(event) {
    event.preventDefault()
    if (saving) return
    const data = new FormData(event.currentTarget)
    const decision = data.get("decision")
    const motivo = data.get("motivo").trim()
    if (!motivo) {
      setError("Indica el motivo del dictamen.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`${apiBase}/expedientes/${expediente.id}/dictamen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, motivo }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.expediente || !payload.movimiento) {
        throw new Error(payload.error || "No se pudo registrar el dictamen.")
      }
      onSaved(payload)
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return <section className="expediente-medicion">
    <h4>Dictamen de Legal</h4>
    {dictamen ? <p><strong>{dictamen.estado === "no_procede" ? "No procede" : "Procede"}</strong> · {dictamen.observaciones}</p> :
      <form onSubmit={save}>
        <fieldset disabled={saving}>
          <label className="form-field">Decisión<select name="decision" required defaultValue="">
            <option value="">Selecciona una decisión</option>
            <option value="procede">Procede</option>
            <option value="no_procede">No procede</option>
          </select></label>
          <label className="form-field">Motivo<textarea name="motivo" required maxLength={2000} /></label>
          <button className="primary-action" type="submit">{saving ? "Registrando…" : "Registrar dictamen"}</button>
        </fieldset>
      </form>}
    {error && <p role="alert">{error}</p>}
  </section>
}
