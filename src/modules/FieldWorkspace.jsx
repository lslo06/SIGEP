import { useEffect, useState } from 'react'
import ExpedienteMedicion from '../components/map/ExpedienteMedicion'

export default function FieldWorkspace({ role }) {
  const [queue, setQueue] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/sigep/campo', { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        if (!controller.signal.aborted) {
          setQueue(data)
          setError('')
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message || 'No se pudo cargar la bandeja.')
      }
    }
    load()
    return () => controller.abort()
  }, [revision])

  return <section className="sgfl-workspace local-shell">
    <header><h1>Medición y topografía</h1><p>{role === 'topografia' ? 'Visitas asignadas a tu cuenta.' : 'Solicitudes de medición y asignaciones de campo.'}</p></header>
    {error && <p role="alert">{error}</p>}
    {!error && !queue && <p role="status">Cargando solicitudes…</p>}
    {queue?.mediciones.length === 0 && <p>Sin solicitudes para mostrar.</p>}
    {queue?.mediciones.map(item => {
      const key = item.expediente_id + ':' + item.predio_id
      return <article className="sgfl-card" key={key}>
        <button className="secondary-button" type="button" onClick={() => setSelected(selected === key ? null : key)} aria-expanded={selected === key}>
          {item.folio} · {item.clave_catastral || 'Predio ' + item.predio_id}
        </button>
        <p>{item.estado}{item.fecha_compromiso && ' · Compromiso ' + item.fecha_compromiso.slice(0, 10)}</p>
        {selected === key && <ExpedienteMedicion expedienteId={item.expediente_id} predioId={item.predio_id}
          role={role} topografos={queue.topografos} apiBase="/api/sigep" onSaved={() => setRevision(value => value + 1)} />}
      </article>
    })}
  </section>
}
