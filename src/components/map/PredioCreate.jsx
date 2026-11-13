import { useEffect, useMemo, useState } from "react"
import L from "leaflet"
import { MapContainer, WMSTileLayer, GeoJSON, useMap } from "react-leaflet"
import { AlertCircle, ArrowLeft, ArrowRight, Check, LoaderCircle, MapPinned, Plus, Trash2, X } from "lucide-react"
import { BASEMAPS, MAP_CENTER, MAP_ZOOM, isWmsConfigured, wmsConfig } from "../../config/map"

const emptyCoordinates = () => Array.from({ length: 3 }, () => ({ longitude: "", latitude: "" }))

const sampleWkt = "MULTIPOLYGON (((-103.96885108632499 23.72138950657929, -103.96885654790724 23.721388441131168, -103.96891672546654 23.721376708309055, -103.96904091515924 23.72135249414221, -103.96906095978507 23.721452361203543, -103.96887137457642 23.72148619344572, -103.96885108632499 23.72138950657929)))"

function splitWktParts(text) {
  const parts = []
  let depth = 0
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1
    else if (text[index] === ")") depth -= 1
    else if (text[index] === "," && depth === 0) {
      parts.push(text.slice(start, index).trim())
      start = index + 1
    }
    if (depth < 0) throw new Error("Sobran paréntesis de cierre.")
  }
  if (depth !== 0) throw new Error("Revisa los paréntesis del polígono.")
  parts.push(text.slice(start).trim())
  return parts
}

function unwrapWktGroup(text) {
  const value = text.trim()
  if (!value.startsWith("(") || !value.endsWith(")")) throw new Error("Revisa los paréntesis del polígono.")
  let depth = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") depth += 1
    else if (value[index] === ")") depth -= 1
    if (depth === 0 && index < value.length - 1) throw new Error("El formato del polígono no es válido.")
  }
  return value.slice(1, -1)
}

function parseWktRing(text) {
  const points = unwrapWktGroup(text).split(",").map((pair) => {
    const values = pair.trim().split(/\s+/).map(Number)
    if (values.length < 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1])) {
      throw new Error("Cada punto debe tener longitud y latitud numéricas.")
    }
    const [longitude, latitude] = values
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new Error("Las coordenadas deben estar en longitud/latitud (X, Y) y dentro del rango válido.")
    }
    return [longitude, latitude]
  })
  const distinctCount = new Set(points.map((point) => point.join(","))).size
  if (distinctCount < 3) throw new Error("Cada contorno necesita al menos tres puntos distintos.")
  const first = points[0]
  const last = points.at(-1)
  const closed = last[0] === first[0] && last[1] === first[1] ? points : [...points, first]
  return { ring: closed, vertices: distinctCount }
}

export function parseWktFeature(raw) {
  const value = raw.trim()
  if (!value) return { feature: null, error: "Pega aquí el MULTIPOLYGON que recibiste." }
  let text = value
  const sridMatch = text.match(/^SRID=(\d+);/i)
  if (sridMatch) {
    if (sridMatch[1] !== "4326") return { feature: null, error: `El WKT indica SRID ${sridMatch[1]}; esta página espera EPSG:4326 (longitud, latitud).` }
    text = text.slice(sridMatch[0].length).trim()
  }
  const match = text.match(/^(MULTIPOLYGON|POLYGON)\s*\(([\s\S]*)\)$/i)
  if (!match) return { feature: null, error: "Formato no reconocido. Pega POLYGON o MULTIPOLYGON con coordenadas X Y." }
  try {
    const wktType = match[1].toUpperCase()
    const geometryType = wktType === "MULTIPOLYGON" ? "MultiPolygon" : "Polygon"
    const polygons = wktType === "MULTIPOLYGON"
      ? splitWktParts(match[2]).map((polygonText) => splitWktParts(unwrapWktGroup(polygonText)))
      : [splitWktParts(match[2])]
    let vertexCount = 0
    const coordinates = polygons.map((rings) => rings.map((ringText) => {
      const parsed = parseWktRing(ringText)
      vertexCount += parsed.vertices
      return parsed.ring
    }))
    if (vertexCount > 30) throw new Error("El polígono supera el máximo de 30 vértices.")
    return {
      feature: { type: "Feature", properties: {}, geometry: { type: geometryType, coordinates: geometryType === "Polygon" ? coordinates[0] : coordinates } },
      error: "",
      vertexCount,
    }
  } catch (error) {
    return { feature: null, error: error instanceof Error ? error.message : "No se pudo leer el polígono." }
  }
}

function buildFeature(coordinates) {
  if (coordinates.length < 3) return null
  if (coordinates.some(({ longitude, latitude }) => longitude.trim() === "" || latitude.trim() === "")) return null
  const points = coordinates.map(({ longitude, latitude }) => [Number(longitude), Number(latitude)])
  if (points.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)) return null
  const unique = new Set(points.map((point) => point.join(",")))
  if (unique.size < 3) return null
  const first = points[0]
  const last = points.at(-1)
  const ring = last[0] === first[0] && last[1] === first[1] ? points : [...points, first]
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }
}

function ringAreaSquareMeters(ring) {
  const earthRadiusMeters = 6371008.8
  let sum = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [longitude1, latitude1] = ring[index]
    const [longitude2, latitude2] = ring[index + 1]
    const longitudeDelta = (longitude2 - longitude1) * Math.PI / 180
    const latitude1Radians = latitude1 * Math.PI / 180
    const latitude2Radians = latitude2 * Math.PI / 180
    sum += longitudeDelta * (2 + Math.sin(latitude1Radians) + Math.sin(latitude2Radians))
  }
  return Math.abs(sum * earthRadiusMeters * earthRadiusMeters / 2)
}

export function calculateFeatureArea(feature) {
  if (!feature) return 0
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates
  return polygons.reduce((total, rings) => {
    const exteriorArea = ringAreaSquareMeters(rings[0] ?? [])
    const holesArea = rings.slice(1).reduce((sum, ring) => sum + ringAreaSquareMeters(ring), 0)
    return total + Math.max(0, exteriorArea - holesArea)
  }, 0)
}

function FitBounds({ feature }) {
  const map = useMap()
  useEffect(() => {
    if (!feature) return
    const bounds = L.geoJSON(feature).getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [18, 18], maxZoom: 18 })
  }, [feature, map])
  return null
}

export function PreviewMap({ feature, vertexCount = 0 }) {
  const positions = feature
    ? feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0]?.[0] ?? []
    : []
  const center = positions.length ? [positions[0][1], positions[0][0]] : MAP_CENTER
  return (
    <div className="predio-preview-map" aria-label="Vista previa del polígono">
      <MapContainer center={center} zoom={feature ? 17 : MAP_ZOOM} scrollWheelZoom={false} zoomControl className="predio-preview-leaflet">
        {isWmsConfigured ? (
          <WMSTileLayer url={wmsConfig.url} params={{ MAP: wmsConfig.map, layers: BASEMAPS.streets.layer, format: "image/png", transparent: false, version: "1.3.0" }} />
        ) : null}
        {feature && <GeoJSON data={feature} style={{ color: "#1761a0", weight: 3, fillColor: "#51a6ed", fillOpacity: 0.35 }} />}
        <FitBounds feature={feature} />
      </MapContainer>
      {!feature && <div className="preview-empty"><MapPinned size={21} /><span>Completa tres coordenadas válidas<br />para previsualizar el polígono</span></div>}
      {feature && <span className="preview-count">{vertexCount} vértices</span>}
    </div>
  )
}

const fields = [
  { name: "id_predio", label: "ID de predio", type: "text" },
  { name: "id_predio_cart", label: "ID cartográfico", type: "text" },
  { name: "status", label: "Estatus", type: "number" },
  { name: "municipio", label: "Municipio", type: "text" },
  { name: "fundo", label: "Fundo", type: "text" },
  { name: "manzana", label: "Manzana", type: "text" },
  { name: "lote", label: "Lote", type: "text" },
  { name: "superficie", label: "Superficie (m²)", type: "number", step: "any" },
  { name: "libro", label: "Libro", type: "text" },
  { name: "titulo", label: "Título", type: "text" },
  { name: "fecha_titulo", label: "Fecha del título", type: "date" },
]

export default function PredioCreate({ onClose, onCreated, apiPath = "/api/predios" }) {
  const [step, setStep] = useState(1)
  const [inputMode, setInputMode] = useState("wkt")
  const [wkt, setWkt] = useState("")
  const [coordinates, setCoordinates] = useState(emptyCoordinates)
  const [feature, setFeature] = useState(null)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ clave_catastral: "", estado_medicion: "sin_confirmar" })
  const wktResult = useMemo(() => parseWktFeature(wkt), [wkt])
  const manualPreview = useMemo(() => buildFeature(coordinates), [coordinates])
  const preview = inputMode === "wkt" ? wktResult.feature : manualPreview
  const previewVertices = inputMode === "wkt" ? wktResult.vertexCount : (manualPreview ? manualPreview.geometry.coordinates[0].length - 1 : 0)
  const previewArea = useMemo(() => calculateFeatureArea(preview), [preview])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape" && !saving) onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, saving])

  function updateCoordinate(index, field, value) {
    setCoordinates((current) => current.map((point, pointIndex) => pointIndex === index ? { ...point, [field]: value } : point))
    setFeature(null)
  }

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function confirmGeometry() {
    if (!preview) {
      setMessage("Captura al menos tres puntos distintos con longitud y latitud válidas.")
      return
    }
    setFeature(preview)
    setForm((current) => ({ ...current, superficie: previewArea.toFixed(2) }))
    setMessage("")
    setStep(2)
  }

  async function savePredio(event) {
    event.preventDefault()
    if (!form.clave_catastral.trim()) {
      setMessage("La clave catastral es obligatoria.")
      return
    }
    setSaving(true)
    setMessage("")
    const body = {
      ...form,
      clave_catastral: form.clave_catastral.trim(),
      geometry: feature.geometry,
    }
    for (const field of ["id_predio", "id_predio_cart", "status", "municipio", "fundo", "manzana", "lote", "superficie", "libro", "titulo", "fecha_titulo"]) {
      if (!body[field]) delete body[field]
    }
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "No fue posible guardar el predio.")
      onCreated(payload)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible conectar con el servidor.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="create-dialog-backdrop">
      <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-predio-title">
        <header className="create-dialog-header">
          <div className="create-dialog-icon"><MapPinned size={19} /></div>
          <div className="create-dialog-heading">
            <span>REGISTRO CARTOGRÁFICO · PASO {step} DE 2</span>
            <h2 id="create-predio-title">{step === 1 ? "Define la forma del predio" : "Información del predio"}</h2>
          </div>
          <button className="dialog-close" type="button" aria-label="Cerrar" disabled={saving} onClick={onClose}><X size={19} /></button>
        </header>

        <div className="create-dialog-body">
          {step === 1 ? (
            <>
              <p className="dialog-description">Si ya te compartieron el polígono, pega el texto completo tal como lo recibiste. También puedes capturar sus puntos manualmente.</p>
              <div className="geometry-tabs" role="tablist" aria-label="Forma de ingresar el polígono">
                <button type="button" role="tab" aria-selected={inputMode === "wkt"} className={inputMode === "wkt" ? "active" : ""} onClick={() => { setInputMode("wkt"); setMessage("") }}>Pegar polígono</button>
                <button type="button" role="tab" aria-selected={inputMode === "manual"} className={inputMode === "manual" ? "active" : ""} onClick={() => { setInputMode("manual"); setMessage("") }}>Capturar puntos</button>
              </div>
              {inputMode === "wkt" ? (
                <div className="geometry-layout">
                  <div className="wkt-editor">
                    <label className="wkt-label" htmlFor="predio-wkt">Pega el texto del polígono</label>
                    <textarea id="predio-wkt" value={wkt} onChange={(event) => { setWkt(event.target.value); setFeature(null) }} placeholder="Pega aquí el texto completo, por ejemplo: MULTIPOLYGON (((-103.9688 23.7213, ...)))" spellCheck="false" />
                    <div className="wkt-helper"><strong>Copia y pega, sin modificar el texto</strong><span>Acepta POLYGON o MULTIPOLYGON. Las coordenadas deben venir como longitud y latitud, en EPSG:4326. No cambies ni borres los paréntesis.</span><details><summary>Ver ejemplo</summary><code>{sampleWkt}</code><button type="button" onClick={() => { setWkt(sampleWkt); setFeature(null) }}>Probar con este ejemplo</button></details></div>
                    {wkt && !preview && wktResult.error && <p className="wkt-error" role="status"><AlertCircle size={15} />{wktResult.error}</p>}
                    {preview && <p className="wkt-valid"><Check size={15} />Formato reconocido · {previewVertices} vértices · aprox. {previewArea.toFixed(2)} m² · EPSG:4326</p>}
                  </div>
                  <PreviewMap feature={preview} vertexCount={previewVertices} />
                </div>
              ) : (
                <div className="geometry-layout">
                <div className="coordinate-editor">
                  <div className="coordinate-table-head"><span>PUNTO</span><span>LONGITUD (X)</span><span>LATITUD (Y)</span><span></span></div>
                  <div className="coordinate-list">
                    {coordinates.map((point, index) => (
                      <div className="coordinate-row" key={index}>
                        <span className="coordinate-index">{index + 1}</span>
                        <input aria-label={`Longitud punto ${index + 1}`} inputMode="decimal" placeholder="-104.76657" value={point.longitude} onChange={(event) => updateCoordinate(index, "longitude", event.target.value)} />
                        <input aria-label={`Latitud punto ${index + 1}`} inputMode="decimal" placeholder="24.53273" value={point.latitude} onChange={(event) => updateCoordinate(index, "latitude", event.target.value)} />
                        <button type="button" className="remove-coordinate" disabled={coordinates.length <= 3} aria-label={`Eliminar punto ${index + 1}`} onClick={() => setCoordinates((current) => current.filter((_, pointIndex) => pointIndex !== index))}><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                  <button className="add-coordinate" type="button" disabled={coordinates.length >= 30} onClick={() => setCoordinates((current) => [...current, { longitude: "", latitude: "" }])}><Plus size={15} /> Agregar punto <span>{coordinates.length}/30</span></button>
                  <p className="coordinate-hint">El sistema cerrará el polígono uniendo automáticamente el último punto con el primero.</p>
                </div>
                <PreviewMap feature={preview} vertexCount={previewVertices} />
                </div>
              )}
              {message && <p className="dialog-error" role="alert"><AlertCircle size={16} />{message}</p>}
              <footer className="dialog-footer"><button className="secondary-action" type="button" onClick={onClose}>Cancelar</button><button className="primary-action" type="button" disabled={!preview} onClick={confirmGeometry}>Confirmar polígono · {previewVertices || 0} puntos <ArrowRight size={16} /></button></footer>
            </>
          ) : (
            <form onSubmit={savePredio}>
              <p className="dialog-description">El polígono quedó listo. Agrega la clave catastral y los datos que tengas disponibles.</p>
              <div className="confirmed-shape"><Check size={17} /><span>Polígono listo · {previewVertices} vértices</span><button type="button" onClick={() => { setStep(1); setMessage("") }}><ArrowLeft size={14} /> Revisar polígono</button></div>
              <label className="form-field full-field"><span>Clave catastral <b>*</b></span><input required maxLength={100} value={form.clave_catastral} onChange={(event) => updateForm("clave_catastral", event.target.value)} placeholder="Ej. 1000400114000100402500004000000" autoFocus /></label>
              <label className="form-field"><span>Condición de medición</span><select value={form.estado_medicion} onChange={(event) => updateForm("estado_medicion", event.target.value)}><option value="sin_confirmar">Sin confirmar</option><option value="medido">Medido</option><option value="no_medido">No medido</option></select></label>
              {form.estado_medicion === "medido" && <label className="form-field"><span>Fecha de medición</span><input type="date" value={form.fecha_medicion ?? ""} onChange={(event) => updateForm("fecha_medicion", event.target.value)} /></label>}
              <div className="predio-fields-grid">
                {fields.map(({ name, label, type, step: inputStep }) => (
                  <label className={`form-field ${name === "superficie" ? "computed-field" : ""}`} key={name}><span>{name === "superficie" ? "Superficie calculada (m²)" : label}</span><input type={type} step={inputStep} value={form[name] ?? ""} readOnly={name === "superficie"} onChange={(event) => updateForm(name, event.target.value)} />{name === "superficie" && <small>Calculada desde el polígono; el servidor la vuelve a calcular al guardar.</small>}</label>
                ))}
              </div>
              {message && <p className="dialog-error" role="alert"><AlertCircle size={16} />{message}</p>}
              <footer className="dialog-footer"><button className="secondary-action" type="button" disabled={saving} onClick={() => { setStep(1); setMessage("") }}><ArrowLeft size={15} /> Atrás</button><button className="primary-action" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16} /> Guardando…</> : <>Guardar predio <Check size={16} /></>}</button></footer>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
