import { useState } from 'react'

export default function InitialParcelLink({ expedienteId, apiBase, measuredArea, onLinked }) {
  const [query, setQuery] = useState('')
  const [parcels, setParcels] = useState([])
  const [selected, setSelected] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  async function search(event) {
    event.preventDefault()
    setBusy(true); setError(''); setSelected(''); setParcels([]); setSearched(false)
    try {
      const response = await fetch(`${apiBase}/predios?${new URLSearchParams({ clave_catastral: query.trim() })}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo buscar el predio.')
      setParcels((data.features || []).map(feature => feature.properties)); setSearched(true)
    } catch (problem) { setError(problem.message) } finally { setBusy(false) }
  }
  async function link(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch(`${apiBase}/solicitudes-titulacion/${expedienteId}/predio`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predio_id: Number(selected), observaciones: reason }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo vincular el predio.')
      onLinked()
    } catch (problem) { setError(problem.message) } finally { setBusy(false) }
  }
  return <section className="intake-panel" aria-label="Vincular predio identificado">
    <h4>Identificación cartográfica del terreno</h4>
    <p>Revisa la visita y su evidencia. Vincula la ficha del terreno identificado para continuar con plano, cédula y propietarios en este mismo folio.</p>
    <p>Si el terreno aún no tiene ficha, regístralo en <a href="#/predios">Lotes y predios</a> y regresa a este expediente. La clave debe corresponder al registro autorizado por Cartografía.</p>
    <form onSubmit={search} className="intake-form"><label>Buscar por clave catastral<input required maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="Clave del terreno identificado" /></label><button className="secondary-button" disabled={busy}>Buscar predio</button></form>
    {searched && !parcels.length && <p>No se encontraron predios con esa clave.</p>}
    {parcels.length > 0 && <form onSubmit={link} className="intake-form"><fieldset disabled={busy}>
      <legend>Vincular al expediente</legend>
      <label>Predio identificado<select required value={selected} onChange={event => setSelected(event.target.value)}><option value="">Selecciona el terreno verificado</option>{parcels.map(parcel => <option key={parcel.id} value={parcel.id}>{parcel.clave_catastral} · {parcel.municipio} · {parcel.superficie ?? 'Sin superficie'} m²</option>)}</select></label>
      <p>Superficie de la visita: {measuredArea} m². La vinculación conserva las superficies y la geometría existentes; documenta cualquier diferencia.</p>
      <label>Resultado de la identificación y diferencias encontradas<textarea required maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Cómo se comprobó que el predio corresponde al terreno visitado" /></label>
      <button className="primary-button" disabled={!selected || busy}>{busy ? 'Guardando…' : 'Vincular predio al mismo folio'}</button>
    </fieldset></form>}
    {error && <p className="intake-error" role="alert">{error}</p>}
  </section>
}
