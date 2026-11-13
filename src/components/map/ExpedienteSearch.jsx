import ExpedienteMedicion from "./ExpedienteMedicion"
import { useState } from "react"
import { BriefcaseBusiness, CalendarDays, ChevronDown, ChevronUp, Clock3, Search } from "lucide-react"

const initialFilters = { folio: "", solicitante: "", predio: "", estado: "", fecha_desde: "", fecha_hasta: "" }

const labels = {
  titulacion: "Titulación de fundo legal",
  certificacion_antecedentes_titulo: "Certificación de antecedentes de título",
  certificacion_copia_titulo: "Certificación de copia de título",
  constancia_datos_lote: "Constancia de antecedentes o datos de lote",
  constancia_tramite_titulo: "Constancia de trámite de título",
}

function formatDate(value) {
  if (!value) return "Sin fecha"
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("es-MX")
}

function propertyLocation(parcel) {
  return [parcel.municipio, parcel.fundo && `Fundo ${parcel.fundo}`, parcel.manzana && `Mz. ${parcel.manzana}`, parcel.lote && `Lote ${parcel.lote}`].filter(Boolean).join(" · ")
}

export default function ExpedienteSearch({ apiBase = "/api", canMeasure = false, role }) {
  const [filters, setFilters] = useState(initialFilters)
  const [results, setResults] = useState([])
  const [detail, setDetail] = useState(null)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()) })
    if (!params.size) {
      setMessage("Escribe al menos un dato para buscar expedientes.")
      setResults([])
      setDetail(null)
      return
    }
    setLoading(true)
    setMessage("")
    setResults([])
    setDetail(null)
    try {
      const response = await fetch(`${apiBase}/expedientes?${params.toString()}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "No fue posible consultar los expedientes.")
      setResults(Array.isArray(payload.expedientes) ? payload.expedientes : [])
      setHasMore(Boolean(payload.hasMore))
      if (!payload.expedientes?.length) setMessage("No se encontraron expedientes con esos filtros.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible conectar con el servicio.")
    } finally {
      setLoading(false)
    }
  }

  async function openDetail(id) {
    setLoadingDetail(true)
    setMessage("")
    try {
      const response = await fetch(`${apiBase}/expedientes/${id}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "No fue posible abrir el expediente.")
      setDetail(payload)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible abrir el expediente.")
    } finally {
      setLoadingDetail(false)
    }
  }

  function clear() {
    setFilters(initialFilters)
    setResults([])
    setDetail(null)
    setMessage("")
    setHasMore(false)
  }

  return (
    <section className="expediente-search" aria-label="Consultar expedientes">
      <div className="expediente-search-heading">
        <div>
          <strong><BriefcaseBusiness size={15} /> Consultar expedientes</strong>
          <p>Busca por folio, solicitante, predio, estado o fecha y revisa el historial del trámite.</p>
        </div>

      </div>
      <form onSubmit={handleSubmit}>
        <div className="expediente-search-fields">
          <label><span>Folio</span><input maxLength={120} placeholder="Ej. FL-2026-000001" value={filters.folio} onChange={(e) => setFilters({ ...filters, folio: e.target.value })} /></label>
          <label><span>Solicitante</span><input maxLength={120} placeholder="Nombre" value={filters.solicitante} onChange={(e) => setFilters({ ...filters, solicitante: e.target.value })} /></label>
          <label><span>Predio / ubicación / título</span><input maxLength={120} placeholder="Clave, municipio, lote…" value={filters.predio} onChange={(e) => setFilters({ ...filters, predio: e.target.value })} /></label>
          <label><span>Estado actual</span><input maxLength={120} placeholder="Ej. recibido" value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value })} /></label>
          <label><span>Recibido desde</span><input type="date" value={filters.fecha_desde} onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })} /></label>
          <label><span>Recibido hasta</span><input type="date" value={filters.fecha_hasta} onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })} /></label>
        </div>
        <div className="expediente-search-actions">
          <small>Los filtros se combinan. Se muestran como máximo 100 coincidencias.</small>
          <div><button type="button" className="expediente-clear" onClick={clear}>Limpiar</button><button className="predio-search-submit" type="submit" disabled={loading}><Search size={15} />{loading ? "Buscando…" : "Buscar expedientes"}</button></div>
        </div>
      </form>
      {message && <p className="predio-search-message" role="status">{message}</p>}
      {results.length > 0 && <div className="expediente-results">
        <div className="predio-search-results-heading"><strong>{results.length}{hasMore ? "+" : ""} expedientes</strong><span>Selecciona uno para consultar su ficha e historial</span></div>
        <div className="expediente-results-list">
          {results.map((item) => <button className={`expediente-result ${detail?.id === item.id ? "selected" : ""}`} type="button" key={item.id} onClick={() => openDetail(item.id)}>
            <span><strong>{item.folio}</strong><small>{labels[item.tipo_tramite] || item.tipo_tramite.replaceAll("_", " ")} · {item.solicitante}</small><small>{item.claves_catastrales?.join(", ") || "Sin predio vinculado"}</small></span>
            <span className="expediente-result-status"><b>{item.estado.replaceAll("_", " ")}</b><small>{item.etapa_actual.replaceAll("_", " ")} · {formatDate(item.fecha_recepcion)}</small></span>
          </button>)}
        </div>
        {hasMore && <p className="predio-search-message">Hay más resultados; agrega otro filtro para reducir la lista.</p>}
      </div>}
      {loadingDetail && <p className="predio-search-message" role="status">Abriendo ficha del expediente…</p>}
      {detail && <article className="expediente-detail">
        <header><div><span>FICHA DEL EXPEDIENTE</span><h3>{detail.folio}</h3><p>{labels[detail.tipo_tramite] || detail.tipo_tramite.replaceAll("_", " ")}</p></div><span className="expediente-state">{detail.estado.replaceAll("_", " ")}</span></header>
        <div className="expediente-detail-grid">
          <div><small>SOLICITANTE</small><strong>{detail.solicitante}</strong>{detail.representante_nombre && <span>Representante: {detail.representante_nombre}</span>}</div>
          <div><small>ETAPA / ÁREA ACTUAL</small><strong>{detail.etapa_actual.replaceAll("_", " ")}</strong><span>{detail.area_responsable}</span></div>
          <div><small>FECHA DE RECEPCIÓN</small><strong>{formatDate(detail.fecha_recepcion)}</strong></div>
          <div><small>PREDIOS VINCULADOS</small>{detail.predios?.length ? detail.predios.map((parcel) => <span className="detail-parcel" key={parcel.id}><strong>{parcel.clave_catastral}</strong>{propertyLocation(parcel) && <small>{propertyLocation(parcel)}</small>}</span>) : <span>Sin predios vinculados</span>}</div>
        </div>
        {detail.tipo_tramite === "titulacion" && detail.predios?.map(parcel => (
          <section key={`${detail.id}:${parcel.id}`}>
            <strong>{parcel.clave_catastral}</strong>
            <ExpedienteMedicion expedienteId={detail.id} predioId={parcel.id} role={role} apiBase={apiBase}
              closed={!canMeasure || ["cerrado", "entregado", "no_procede"].includes(detail.estado)} />
          </section>
        ))}
        {detail.observaciones && <p className="expediente-observation"><b>Observación inicial:</b> {detail.observaciones}</p>}
        <div className="expediente-timeline-heading"><h4><Clock3 size={15} /> Historial del trámite</h4><span>{detail.movimientos?.length || 0} movimientos</span></div>
        {detail.movimientos?.length ? <ol className="expediente-timeline">{detail.movimientos.map((movement) => <li key={movement.id}><span className="timeline-dot" /><div><strong>{movement.etapa_destino.replaceAll("_", " ")} · {movement.estado.replaceAll("_", " ")}</strong><p>{movement.observaciones || "Sin observaciones registradas"}</p><small><CalendarDays size={12} /> {new Date(movement.created_at).toLocaleString("es-MX")} · {movement.area_destino || "Área sin asignar"}{movement.actor ? ` · ${movement.actor}` : ""}</small></div></li>)}</ol> : <p className="timeline-empty">El expediente todavía no tiene movimientos.</p>}

      </article>}
    </section>
  )
}
