import { useState } from "react"
import { AlertCircle, BriefcaseBusiness, Check, LoaderCircle, X } from "lucide-react"

const types = [
  ["titulacion", "Titulación de fundo legal"],
  ["busqueda_informacion", "Búsqueda de información"],
  ["certificacion_antecedentes_titulo", "Certificación de antecedentes de título"],
  ["certificacion_copia_titulo", "Certificación de copia de título"],
  ["constancia_datos_lote", "Constancia de antecedentes o datos de lote"],
  ["constancia_tramite_titulo", "Constancia de trámite de título"],
]

const emptyApplicant = {
  nombre: "",
  identificacion: "",
  telefono: "",
  correo: "",
  domicilio_notificacion: "",
  representante_nombre: "",
  representante_identificacion: "",
}

export default function ExpedienteCreate({ predioFeature, onClose, onCreated, apiPath = "/api/expedientes" }) {
  const [tipoTramite, setTipoTramite] = useState("")
  const [applicant, setApplicant] = useState(emptyApplicant)
  const [observaciones, setObservaciones] = useState("")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const properties = predioFeature?.properties ?? {}
  const location = [properties.municipio, properties.fundo && `Fundo ${properties.fundo}`, properties.manzana && `Mz. ${properties.manzana}`, properties.lote && `Lote ${properties.lote}`]
    .filter(Boolean)
    .join(" · ")

  function updateApplicant(field, value) {
    setApplicant((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage("")
    if (!properties.id) {
      setMessage("El predio no tiene un identificador de base de datos; vuelve a buscarlo.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_tramite: tipoTramite,
          solicitante: applicant,
          predio_ids: [properties.id],
          observaciones,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "No fue posible crear el expediente.")
      onCreated(payload)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible conectar con el servicio.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="create-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <section className="create-dialog expediente-dialog" role="dialog" aria-modal="true" aria-labelledby="create-expediente-title">
        <header className="create-dialog-header">
          <span className="create-dialog-icon"><BriefcaseBusiness size={19} /></span>
          <div className="create-dialog-heading">
            <span>ALTA DE EXPEDIENTE</span>
            <h2 id="create-expediente-title">Iniciar trámite</h2>
          </div>
          <button className="dialog-close" type="button" aria-label="Cerrar" disabled={saving} onClick={onClose}><X size={19} /></button>
        </header>

        <div className="create-dialog-body">
          <p className="dialog-description">El sistema generará un folio y guardará el expediente vinculado al predio seleccionado.</p>
          <div className="expediente-predio-card">
            <strong>{properties.clave_catastral || "Predio seleccionado"}</strong>
            <span>{location || "Ubicación no capturada"}</span>
            {properties.superficie !== null && properties.superficie !== undefined && <small>{Number(properties.superficie).toLocaleString("es-MX")} m²</small>}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="expediente-form-grid">
              <label className="form-field full-field">
                <span>Tipo de trámite <b>*</b></span>
                <select required value={tipoTramite} onChange={(event) => setTipoTramite(event.target.value)}>
                  <option value="">Selecciona un trámite</option>
                  {types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="form-field full-field"><span>Nombre completo del solicitante <b>*</b></span><input required maxLength={200} placeholder="Ej. María del Carmen López Hernández" value={applicant.nombre} onChange={(event) => updateApplicant("nombre", event.target.value)} autoComplete="name" /><small>Captura nombres y apellidos tal como aparecen en el documento presentado.</small></label>
              <label className="form-field"><span>Tipo de identificación presentada (opcional)</span><input maxLength={100} placeholder="Ej. credencial para votar (INE)" value={applicant.identificacion} onChange={(event) => updateApplicant("identificacion", event.target.value)} /><small>Escribe el nombre del documento presentado. Si no lo presenta, deja este campo vacío. La copia se adjunta después en Documentación y queda sujeta a revisión.</small></label>
              <label className="form-field"><span>Teléfono</span><input type="tel" maxLength={50} placeholder="Ej. 618 123 4567" value={applicant.telefono} onChange={(event) => updateApplicant("telefono", event.target.value)} autoComplete="tel" /></label>
              <label className="form-field full-field"><span>Correo (opcional)</span><input type="email" maxLength={254} placeholder="Ej. persona@example.com" value={applicant.correo} onChange={(event) => updateApplicant("correo", event.target.value)} autoComplete="email" /></label>
              <label className="form-field full-field"><span>Domicilio para notificaciones</span><input maxLength={500} placeholder="Calle, número, colonia, localidad y municipio" value={applicant.domicilio_notificacion} onChange={(event) => updateApplicant("domicilio_notificacion", event.target.value)} autoComplete="street-address" /><small>Puede ser distinto de la ubicación del terreno.</small></label>
              <label className="form-field full-field"><span>Representante legal, si aplica</span><input maxLength={200} placeholder="Nombre completo de quien representa al solicitante" value={applicant.representante_nombre} onChange={(event) => updateApplicant("representante_nombre", event.target.value)} /></label>
              {applicant.representante_nombre && <label className="form-field full-field"><span>Tipo de identificación del representante (opcional)</span><input maxLength={100} placeholder="Nombre del documento presentado por el representante" value={applicant.representante_identificacion} onChange={(event) => updateApplicant("representante_identificacion", event.target.value)} /><small>Este campo corresponde al representante, no al solicitante. La representación y sus documentos requieren revisión.</small></label>}
              <label className="form-field full-field"><span>Observación inicial</span><textarea rows={3} maxLength={2000} placeholder="Describe el motivo de la solicitud y los pendientes conocidos." value={observaciones} onChange={(event) => setObservaciones(event.target.value)} /></label>
            </div>
            <p className="expediente-prototype-note">Los campos con * son obligatorios para este registro. El alta queda asociada a tu sesión; después podrás integrar los documentos desde Seguimiento de trámites.</p>
            {message && <p className="dialog-error" role="alert"><AlertCircle size={16} />{message}</p>}
            <footer className="dialog-footer">
              <button className="secondary-action" type="button" disabled={saving} onClick={onClose}>Cancelar</button>
              <button className="primary-action" type="submit" disabled={saving}>
                {saving ? <><LoaderCircle className="spin" size={16} /> Guardando…</> : <>Crear expediente <Check size={16} /></>}
              </button>
            </footer>
          </form>
        </div>
      </section>
    </div>
  )
}
