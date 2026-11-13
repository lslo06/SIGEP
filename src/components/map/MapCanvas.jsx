import { Crosshair, Layers3, MousePointer2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import L from "leaflet"
import {
  GeoJSON,
  MapContainer,
  WMSTileLayer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet"
import {
  MAP_CENTER,
  MAP_ZOOM,
  BASEMAPS,
  isWmsConfigured,
  wmsConfig,
} from "../../config/map"

function MapControls({ onCoordinatesChange }) {
  const map = useMap()

  useMapEvents({
    mousemove: ({ latlng }) =>
      onCoordinatesChange(`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`),
    mouseout: () => onCoordinatesChange("Mueve el cursor sobre el mapa"),
  })

  return (
    <button
      className="center-map"
      type="button"
      onClick={() => map.setView(MAP_CENTER, MAP_ZOOM)}
    >
      <Crosshair size={17} />
      Centrar en Durango
    </button>
  )
}

function ZoomToFeature({ feature }) {
  const map = useMap()

  useEffect(() => {
    if (!feature) return
    const bounds = L.geoJSON(feature).getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 19 })
  }, [feature, map])

  return null
}

function ViewportParcels({ enabled, onFeatures, onStatus, reloadKey, apiPath }) {
  const map = useMap()

  useEffect(() => {
    if (!enabled) {
      onFeatures(null)
      onStatus("idle")
      return undefined
    }

    let controller
    let timer
    let requestId = 0
    const loadParcels = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(async () => {
        const currentZoom = map.getZoom()
        if (currentZoom < 12) {
          controller?.abort()
          onFeatures(null)
          onStatus("zoom")
          return
        }
        controller?.abort()
        controller = new AbortController()
        const currentRequest = ++requestId
        const bounds = map.getBounds()
        const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(",")
        onStatus("loading")
        try {
          const response = await fetch(`${apiPath}?bbox=${encodeURIComponent(bbox)}&zoom=${currentZoom}`, { signal: controller.signal })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(payload.error || "No fue posible cargar los predios.")
          if (currentRequest !== requestId) return
          onFeatures(payload)
          onStatus(payload.hasMore ? "many" : "loaded")
        } catch (error) {
          if (error.name === "AbortError" || currentRequest !== requestId) return
          onFeatures(null)
          onStatus("error")
        }
      }, 180)
    }

    loadParcels()
    map.on("moveend", loadParcels)
    map.on("zoomend", loadParcels)
    return () => {
      window.clearTimeout(timer)
      controller?.abort()
      map.off("moveend", loadParcels)
      map.off("zoomend", loadParcels)
    }
  }, [enabled, map, onFeatures, onStatus, reloadKey, apiPath])

  return null
}

function bindParcelPopup(feature, layer) {
  const properties = feature.properties ?? {}
  const content = document.createElement("div")
  const title = document.createElement("strong")
  title.textContent = properties.clave_catastral || "Predio"
  content.appendChild(title)
  const details = [
    ["Municipio", properties.municipio],
    ["Fundo", properties.fundo],
    ["Manzana", properties.manzana],
    ["Lote", properties.lote],
    ["Superficie", properties.superficie == null ? "" : `${Number(properties.superficie).toLocaleString("es-MX")} m²`],
    ["Medición", properties.estado_medicion?.replaceAll("_", " ")],
  ].filter(([, value]) => value)
  for (const [label, value] of details) {
    const row = document.createElement("div")
    row.textContent = `${label}: ${value}`
    content.appendChild(row)
  }
  layer.bindPopup(content)
}

const predioStyle = {
  color: "#b63f2f",
  weight: 3,
  opacity: 1,
  fillColor: "#e66a4d",
  fillOpacity: 0.28,
}

export default function MapCanvas({
  basemap,
  searchFeature,
  onParcelSelect,
  parcelReloadKey,
  onWmsLoad,
  onWmsError,
  viewportApiPath = "/api/predios/mapa",
  fallbackTiles = false,
}) {
  const [coordinates, setCoordinates] = useState(
    "Mueve el cursor sobre el mapa",
  )
  const [showParcels, setShowParcels] = useState(false)
  const [parcelCollection, setParcelCollection] = useState(null)
  const [parcelStatus, setParcelStatus] = useState("idle")
  const wmsParams = useMemo(
    () => ({
      MAP: wmsConfig.map,
      layers: BASEMAPS[basemap].layer,
      format: "image/png",
      transparent: false,
      version: "1.3.0",
    }),
    [basemap],
  )
  const wmsEventHandlers = useMemo(
    () => ({ load: onWmsLoad, tileerror: onWmsError }),
    [onWmsLoad, onWmsError],
  )

  return (
    <div className="map-shell">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        scrollWheelZoom
        className="leaflet-map"
      >
        {isWmsConfigured && (
          <WMSTileLayer
            key={basemap}
            url={wmsConfig.url}
            params={wmsParams}
            attribution={BASEMAPS[basemap].attribution}
            eventHandlers={wmsEventHandlers}
          />
        )}

        {!isWmsConfigured && fallbackTiles && (
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution={BASEMAPS.streets.attribution} />
        )}

        <ViewportParcels enabled={showParcels} onFeatures={setParcelCollection} onStatus={setParcelStatus} reloadKey={parcelReloadKey} apiPath={viewportApiPath} />

        <MapControls onCoordinatesChange={setCoordinates} />

        {showParcels && parcelCollection?.features?.length > 0 && (
          <GeoJSON
            key={`parcel-overlay-${parcelCollection.features.map((feature) => feature.properties.id).join(",")}`}
            data={parcelCollection}
            style={(feature) => feature.properties.clave_catastral === searchFeature?.properties?.clave_catastral
              ? predioStyle
              : { color: "#1761a0", weight: 1.5, opacity: 0.9, fillColor: "#4c9ed8", fillOpacity: 0.16 }}
            onEachFeature={(feature, layer) => {
              bindParcelPopup(feature, layer)
              layer.on("click", () => onParcelSelect?.(feature))
            }}
          />
        )}

        {searchFeature && (
          <>
            <GeoJSON
              key={searchFeature.properties.clave_catastral}
              data={searchFeature}
              style={predioStyle}
            />
            <ZoomToFeature feature={searchFeature} />
          </>
        )}

      </MapContainer>

      <div className="parcel-map-toolbar">
        <button type="button" aria-pressed={showParcels} onClick={() => setShowParcels((current) => !current)}>
          <Layers3 size={15} /> {showParcels ? "Ocultar predios" : "Mostrar predios"}
        </button>
        {showParcels && (
          <small aria-live="polite">
            {parcelStatus === "zoom" ? "Acerca el mapa hasta nivel 12 para cargar lotes"
              : parcelStatus === "loading" ? "Cargando lotes…"
                : parcelStatus === "loaded" ? `${parcelCollection?.features?.length ?? 0} lotes en esta zona`
                  : parcelStatus === "many" ? "Se muestran 300 lotes; acerca para ver más detalle"
                    : parcelStatus === "error" ? "No se pudieron cargar los lotes"
                      : "Activa la capa para consultar lotes"}
          </small>
        )}
      </div>

      <div className="coordinates" aria-live="polite">
        <MousePointer2 size={15} />
        <span>Coordenadas</span>
        <strong>{coordinates}</strong>
      </div>
    </div>
  )
}
