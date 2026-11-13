import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"

const initialFilters = {
  clave_catastral: "",
  id_predio: "",
  id_predio_cart: "",
  municipio: "",
  fundo: "",
  manzana: "",
  lote: "",
  status: "",
  estado_medicion: "",
  superficie_min: "",
  superficie_max: "",
  libro: "",
  titulo: "",
  fecha_titulo_desde: "",
  fecha_titulo_hasta: "",
}

const fields = [
  { name: "clave_catastral", label: "Clave catastral", placeholder: "Buscar clave" },
  { name: "id_predio", label: "ID de predio", placeholder: "Buscar ID" },
  { name: "id_predio_cart", label: "ID cartográfico", placeholder: "Buscar ID cartográfico" },
  { name: "municipio", label: "Municipio", placeholder: "Municipio" },
  { name: "fundo", label: "Fundo", placeholder: "Fundo" },
  { name: "manzana", label: "Manzana", placeholder: "Manzana" },
  { name: "lote", label: "Lote", placeholder: "Lote" },
  { name: "status", label: "Estatus (código)", placeholder: "Código", inputMode: "numeric" },
  { name: "estado_medicion", label: "Condición de medición", type: "select", options: [["", "Todas"], ["sin_confirmar", "Sin confirmar"], ["medido", "Medido"], ["no_medido", "No medido"]] },
  { name: "superficie_min", label: "Superficie desde (m²)", placeholder: "Mínima", type: "number" },
  { name: "superficie_max", label: "Superficie hasta (m²)", placeholder: "Máxima", type: "number" },
  { name: "libro", label: "Libro", placeholder: "Libro" },
  { name: "titulo", label: "Título", placeholder: "Número o dato del título" },
  { name: "fecha_titulo_desde", label: "Fecha de título desde", type: "date" },
  { name: "fecha_titulo_hasta", label: "Fecha de título hasta", type: "date" },
]

function locationLabel(properties) {
  return [properties.municipio, properties.fundo && `Fundo ${properties.fundo}`, properties.manzana && `Mz. ${properties.manzana}`, properties.lote && `Lote ${properties.lote}`]
    .filter(Boolean)
    .join(" · ")
}

export default function PredioSearch({ onResult, onStartExpediente, onEditGeometry, onShowGeometryHistory, updatedFeature, apiPath = "/api/predios" }) {
  const [filters, setFilters] = useState(initialFilters)
  const [features, setFeatures] = useState([])
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [selectedKey, setSelectedKey] = useState("")
  const [message, setMessage] = useState("")
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!updatedFeature) return
    setFeatures((current) => current.map((feature) => feature.properties.id === updatedFeature.properties.id ? updatedFeature : feature))
    setSelectedFeature((current) => current?.properties.id === updatedFeature.properties.id ? updatedFeature : current)
  }, [updatedFeature])

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function clearSearch() {
    setFilters(initialFilters)
    setFeatures([])
    setSelectedFeature(null)
    setSelectedKey("")
    setMessage("")
    setHasMore(false)
    onResult(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([name, value]) => {
      if (value.trim()) params.set(name, value.trim())
    })
    if (!params.size) {
      setMessage("Escribe al menos un dato para buscar.")
      setFeatures([])
      setSelectedFeature(null)
      onResult(null)
      return
    }

    setLoading(true)
    setMessage("")
    setFeatures([])
    setSelectedFeature(null)
    setSelectedKey("")
    setHasMore(false)
    onResult(null)

    try {
      const response = await fetch(`${apiPath}?${params.toString()}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !Array.isArray(payload.features)) throw new Error(payload.error || "No fue posible consultar la base de datos.")

      const results = Array.isArray(payload.features) ? payload.features : []
      setFeatures(results)
      setHasMore(Boolean(payload.hasMore))
      if (results.length === 0) setMessage("No se encontraron predios con esos filtros.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible conectar con el servicio de búsqueda.")
    } finally {
      setLoading(false)
    }
  }

  function selectFeature(feature) {
    setSelectedKey(feature.properties.clave_catastral)
    setSelectedFeature(feature)
    onResult(feature)
  }

  return (
    <section className="predio-search" aria-label="Buscar predios en la base de datos">
      <form onSubmit={handleSubmit}>
        <div className="predio-search-heading">
          <div>
            <strong className="predio-search-title">Buscar predios</strong>
            <p>Combina filtros y selecciona un resultado para ubicarlo en el mapa.</p>
          </div>
          <button className="predio-search-submit" type="submit" disabled={loading}>
            <Search size={15} /> {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>

        <div className="predio-search-fields">
          {fields.map(({ name, label, placeholder, type = "text", inputMode, options }) => (
            <label className="predio-search-field" key={name}>
              <span>{label}</span>
              {type === "select" ? (
                <select
                  name={name}
                  value={filters[name]}
                  onChange={(event) => updateFilter(name, event.target.value)}
                >
                  {options.map(([value, optionLabel]) => <option value={value} key={value}>{optionLabel}</option>)}
                </select>
              ) : (
                <input
                  name={name}
                  type={type}
                  inputMode={inputMode}
                  step={type === "number" ? "any" : undefined}
                  min={type === "number" ? "0" : undefined}
                  value={filters[name]}
                  onChange={(event) => updateFilter(name, event.target.value)}
                  placeholder={placeholder}
                  autoComplete="off"
                  maxLength={type === "text" ? 100 : undefined}
                />
              )}
            </label>
          ))}
        </div>

        <div className="predio-search-actions">
          <small>Los filtros se aplican juntos.</small>
          <button className="predio-search-clear" type="button" onClick={clearSearch}>
            <X size={14} /> Limpiar
          </button>
        </div>
      </form>

      {message && <p className="predio-search-message" role="status">{message}</p>}

      {features.length > 0 && (
        <div className="predio-search-results" aria-live="polite">
          <div className="predio-search-results-heading">
            <strong>{features.length}{hasMore ? "+" : ""} predios encontrados</strong>
            <span>Selecciona uno para verlo en el mapa</span>
          </div>
          <div className="predio-search-results-list">
            {features.map((feature) => {
              const properties = feature.properties
              const key = properties.clave_catastral
              return (
                <button
                  className={`predio-search-result ${selectedKey === key ? "selected" : ""}`}
                  type="button"
                  key={key}
                  aria-pressed={selectedKey === key}
                  onClick={() => selectFeature(feature)}
                >
                  <span className="predio-search-result-main">
                    <strong>{key}</strong>
                    <small>{locationLabel(properties) || "Ubicación no capturada"}</small>
                  </span>
                  <span className="predio-search-result-meta">
                    {properties.id_predio && <small>ID {properties.id_predio}</small>}
                    {properties.status !== null && properties.status !== undefined && <small>Estatus {properties.status}</small>}
                    {properties.estado_medicion && <small>{properties.estado_medicion.replaceAll("_", " ")}</small>}
                    {properties.superficie !== null && properties.superficie !== undefined && <small>{Number(properties.superficie).toLocaleString("es-MX")} m²</small>}
                    {properties.titulo && <small>Título {properties.titulo}</small>}
                  </span>
                </button>
              )
            })}
          </div>
          {selectedFeature && (onShowGeometryHistory || onEditGeometry || onStartExpediente) && (
            <div className="predio-search-selected-action">
              <span>Seleccionado: <strong>{selectedFeature.properties.clave_catastral}</strong></span>
              <div>
                {onShowGeometryHistory && <button className="secondary-map-action" type="button" onClick={() => onShowGeometryHistory(selectedFeature)}>Historial cartográfico</button>}
                {onEditGeometry && <button className="secondary-map-action" type="button" onClick={() => onEditGeometry(selectedFeature)}>Corregir polígono</button>}
                {onStartExpediente && <button type="button" onClick={() => onStartExpediente(selectedFeature)}>Iniciar trámite con este predio</button>}
              </div>
            </div>
          )}
          {hasMore && <p className="predio-search-message">Hay más coincidencias. Agrega otro filtro para acotar la búsqueda.</p>}
        </div>
      )}

    </section>
  )
}
