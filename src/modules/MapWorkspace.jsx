import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Map, Mountain, Plus, Satellite } from 'lucide-react'
import MapCanvas from '../components/map/MapCanvas'
import PredioSearch from '../components/map/PredioSearch'
import ExpedienteCreate from '../components/map/ExpedienteCreate'
import PredioCreate from '../components/map/PredioCreate'
import { isWmsConfigured } from '../config/map'
import 'leaflet/dist/leaflet.css'
import './map-workspace.css'
import './map-predio-create.css'

const basemapOptions = [
  { id: 'streets', label: 'Calles', Icon: Map },
  { id: 'satellite', label: 'Satélite', Icon: Satellite },
  { id: 'topographic', label: 'Topográfico', Icon: Mountain },
]

export default function MapWorkspace({ initialKey = '', parcelOnly = false, lotes = false, altas = false, canCreateParcel = false, canCreateFile = false }) {
  const [key, setKey] = useState(initialKey)
  const [basemap, setBasemap] = useState('streets')
  const [parcelRevision, setParcelRevision] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [expedientePredio, setExpedientePredio] = useState(null)
  const [createdExpediente, setCreatedExpediente] = useState('')
  const [createdKey, setCreatedKey] = useState('')
  const method = parcelOnly ? 'clave' : 'fundos'
  const [organizationId, setOrganizationId] = useState('')
  const [fundosId, setFundosId] = useState('')
  const [query, setQuery] = useState(() => initialKey ? { key: initialKey } : null)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(Boolean(initialKey))

  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    const params = new URLSearchParams(query.key
      ? { clave_catastral: query.key }
      : { organizacion_id: query.organizationId, id_fundos: query.fundosId })
    const path = query.key ? 'predios' : 'fundos/predio'

    async function loadParcel() {
      try {
        const response = await fetch(`/api/sigep/${path}?${params}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'La consulta del predio falló.')
        const feature = query.key
          ? data.features?.find(item => String(item.properties?.clave_catastral).trim() === query.key)
          : data
        if (!feature) throw new Error('No se encontró un predio con esa clave catastral exacta.')
        if (!feature.geometry) throw new Error('El predio existe, pero todavía no tiene geometría.')
        if (!controller.signal.aborted) setResult(feature)
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage(error instanceof SyntaxError ? 'El servicio cartográfico no está disponible.' : error.message)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadParcel()
    return () => controller.abort()
  }, [query])

  function search(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setResult(null)
    setQuery(method === 'clave'
      ? { key: key.trim() }
      : { organizationId: organizationId.trim(), fundosId: fundosId.trim() })
  }

  function onCreated(feature) {
    setCreateOpen(false)
    setQuery(null)
    setLoading(false)
    setMessage('')
    setResult(feature)
    setCreatedKey(feature.properties?.clave_catastral || '')
    setParcelRevision(revision => revision + 1)
  }

  const parcel = result?.properties
  return (
    <section className="map-workspace" aria-label="Consulta cartográfica de SIGEP">
      {!parcelOnly && (
        <header className="map-workspace-header">
          <div>
            <h1>{altas ? 'Altas' : lotes ? 'Lotes y predios' : 'Mapa territorial'}</h1>
            <p>{altas ? 'Registra un predio o selecciona uno para iniciar un expediente.' : 'Consulta y registra predios en la cartografía de Durango.'}</p>
          </div>
          {canCreateParcel && (
            <button className="primary-button" type="button" disabled={loading} onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> {lotes ? 'Agregar predio' : 'Registrar predio'}
            </button>
          )}
        </header>
      )}
      {!parcelOnly && <PredioSearch apiPath="/api/sigep/predios" onResult={setResult} onStartExpediente={canCreateFile ? setExpedientePredio : undefined} />}
      {(!parcelOnly || !initialKey) && (
        <details className="sigep-map-reference" open={parcelOnly || undefined}>
          <summary>{parcelOnly ? 'Consultar por clave catastral' : 'Buscar por referencia de Fundos'}</summary>
          <form className="sigep-map-search" onSubmit={search}>
          {method === 'clave' ? (
            <label className="form-field">Clave catastral
              <input value={key} onChange={event => setKey(event.target.value)} required maxLength={100} />
            </label>
          ) : (
            <>
              <label className="form-field">UUID de la organización
                <input value={organizationId} onChange={event => setOrganizationId(event.target.value)} required maxLength={36} />
              </label>
              <label className="form-field">UUID del predio de Fundos
                <input value={fundosId} onChange={event => setFundosId(event.target.value)} required maxLength={36} />
              </label>
            </>
          )}
          <button className="primary-button" type="submit" disabled={loading || (method === 'clave' ? !key.trim() : !organizationId.trim() || !fundosId.trim())}>
            {loading ? 'Buscando…' : 'Buscar predio'}
          </button>
          </form>
        </details>
      )}
      {loading && <p role="status">Buscando predio…</p>}
      {message && <p className="sigep-map-error" role="alert">{message}</p>}
      {createdExpediente && <p role="status">Expediente registrado · {createdExpediente}</p>}
      {createdKey && <p role="status">Predio registrado · {createdKey}</p>}
      <div className="sigep-map-controls">
        <div role="group" aria-label="Tipo de mapa">
          {basemapOptions.map(({ id, label, Icon }) => (
            <button className="secondary-button" key={id} type="button"
              aria-pressed={basemap === id} disabled={!isWmsConfigured && id !== 'streets'}
              onClick={() => setBasemap(id)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </div>
      {!isWmsConfigured && <p>Las vistas satelital y topográfica no están disponibles en este momento.</p>}
      <MapCanvas
        basemap={basemap}
        searchFeature={result?.geometry ? result : null}
        onParcelSelect={setResult}
        parcelReloadKey={parcelRevision}
        viewportApiPath="/api/sigep/predios/mapa"
        fallbackTiles
      />
      {expedientePredio && createPortal(
        <div className="sigep-predio-create">
          <ExpedienteCreate apiPath="/api/sigep/expedientes" predioFeature={expedientePredio}
            onClose={() => setExpedientePredio(null)}
            onCreated={file => { setCreatedExpediente(file.folio); setExpedientePredio(null) }} />
        </div>,
        document.body,
      )}
      {createOpen && createPortal(
        <div className="sigep-predio-create">
          <PredioCreate apiPath="/api/sigep/predios" onClose={() => setCreateOpen(false)} onCreated={onCreated} />
        </div>,
        document.body,
      )}
      {parcel && (
        <dl className="sigep-map-details">
          <div><dt>Clave catastral</dt><dd>{parcel.clave_catastral || 'Sin clave'}</dd></div>
          <div><dt>Municipio</dt><dd>{parcel.municipio || 'Sin dato'}</dd></div>
          <div><dt>Manzana y lote</dt><dd>{parcel.manzana || '—'} / {parcel.lote || '—'}</dd></div>
          <div><dt>Superficie</dt><dd>{parcel.superficie == null ? 'Sin dato' : `${parcel.superficie} m²`}</dd></div>
          <div><dt>Medición</dt><dd>{parcel.estado_medicion?.replaceAll('_', ' ') || 'Sin confirmar'}</dd></div>
        </dl>
      )}
    </section>
  )
}
