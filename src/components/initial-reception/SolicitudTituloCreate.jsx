import { useEffect, useRef, useState } from 'react'
import './initial-reception.css'

export default function SolicitudTituloCreate({ onClose, onCreated, apiBase = '/api/sigep' }) {
  const dialog = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])

  async function submit(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const personKeys = ['nombres', 'primer_apellido', 'segundo_apellido', 'telefono', 'correo', 'domicilio_notificacion']
    const locationKeys = ['municipio', 'localidad', 'direccion', 'referencias']
    const pick = keys => Object.fromEntries(keys.map(key => [key, String(values.get(key) || '').trim()]))
    setBusy(true); setError('')
    try {
      const response = await fetch(`${apiBase}/solicitudes-titulacion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitante: pick(personKeys), ubicacion: pick(locationKeys), observaciones: values.get('observaciones') }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar la solicitud.')
      onCreated(data)
    } catch (problem) { setError(problem.message) }
    finally { setBusy(false) }
  }

  return <dialog ref={dialog} className="intake-dialog" aria-labelledby="intake-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="intake-heading"><div><small>RECEPCIÓN EN VENTANILLA</small><h2 id="intake-title">Nueva solicitud de título</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar solicitud">Cerrar</button></header>
    <p>Registra al solicitante y cómo llegar al terreno. La visita posterior permitirá identificarlo y medirlo. Los campos con * son obligatorios.</p>
    <form onSubmit={submit} className="intake-form">
      <fieldset disabled={busy}><legend>Datos del solicitante</legend><div className="intake-grid">
        <label>Nombre(s) *<input name="nombres" required maxLength={100} placeholder="Ej. María Elena" autoComplete="given-name" autoFocus /></label>
        <label>Apellido paterno<input name="primer_apellido" maxLength={50} placeholder="Ej. García" /></label>
        <label>Apellido materno<input name="segundo_apellido" maxLength={50} placeholder="Ej. López" /></label>
        <label>Teléfono de contacto<input name="telefono" type="tel" maxLength={50} placeholder="Ej. 618 123 4567" autoComplete="tel" /></label>
        <label>Correo electrónico<input name="correo" type="email" maxLength={254} placeholder="Ej. persona@ejemplo.com" autoComplete="email" /></label>
        <label>Domicilio para notificaciones<input name="domicilio_notificacion" maxLength={500} placeholder="Lugar donde se puede contactar al solicitante" /></label>
      </div><small>Si la persona tiene un solo apellido, deja el otro vacío. El domicilio de notificaciones puede ser distinto al terreno solicitado.</small></fieldset>
      <fieldset disabled={busy}><legend>Ubicación declarada del terreno</legend><div className="intake-grid">
        <label>Municipio *<input name="municipio" required maxLength={150} placeholder="Ej. Durango" /></label>
        <label>Localidad o colonia *<input name="localidad" required maxLength={150} placeholder="Nombre de la localidad o colonia" /></label>
        <label className="intake-wide">Dirección o descripción del lugar<textarea name="direccion" maxLength={500} rows={2} placeholder="Calle y número, o camino y kilómetro si no tiene domicilio formal" /></label>
        <label className="intake-wide">Referencias para la visita *<textarea name="referencias" required maxLength={1500} rows={3} placeholder="Ej. Por el camino a la escuela, 200 m después del puente, junto al portón azul" /></label>
      </div><small>Puede recibirse aunque todavía no tenga calle, número, clave catastral, plano o documentos. Esta ubicación queda pendiente de verificación.</small></fieldset>
      <label>Observaciones de recepción<textarea name="observaciones" maxLength={2000} rows={2} disabled={busy} placeholder="Ej. La persona no presenta documentos y solicita orientación para iniciar" /></label>
      {error && <p role="alert" className="intake-error">{error}</p>}
      <footer className="intake-actions"><button className="secondary-button" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar solicitud y generar folio'}</button></footer>
    </form>
  </dialog>
}
