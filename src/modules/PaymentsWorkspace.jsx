import { useEffect, useState } from 'react'
import { localDate } from '../lib/validation'
import { canWork } from '../lib/permissions'
import { paymentConcepts } from '../lib/workflow'
import './workflow.css'

export default function PaymentsWorkspace({ organization, role, local = false, canRegister = false }) {
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ folio: '', concepto: paymentConcepts[0], recibo: '', importe: '', fecha: localDate(), evidencia: '' })
  const editable = local ? canRegister : canWork(role, ['caja'])
  async function load() {
    setLoading(true); setError('')
    try {
      if (local) {
        const params = new URLSearchParams({ busqueda: query.trim() })
        const response = await fetch(`/api/sigep/pagos?${params}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setRows(data.pagos || [])
        return
      }
      const { supabase } = await import('../lib/supabase')
      const { data, error } = await supabase.rpc('consultar_pagos_sgfl', { p_organizacion_id: organization.id, p_busqueda: query.trim() })
      if (error) throw error
      setRows(data || [])
    } catch (error) { setRows([]); setError(local && !(error instanceof SyntaxError) ? error.message : 'No se pudo consultar el área de pagos. Intenta nuevamente o contacta a soporte.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [organization?.id, local])
  async function save(event) {
    event.preventDefault(); if (!editable || busy) return
    setBusy(true); setError('')
    try {
      if (local) {
        const response = await fetch('/api/sigep/pagos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
      } else {
        const { supabase } = await import('../lib/supabase')
        const { error } = await supabase.rpc('registrar_pago_sgfl', { p_organizacion_id: organization.id, p_datos: form })
        if (error) throw error
      }
      setForm({ ...form, recibo: '', importe: '', evidencia: '' }); await load()
    } catch (error) { setError(error.message || 'No se pudo guardar el pago.') }
    finally { setBusy(false) }
  }
  return <section className="sgfl-workspace">
    <header><p className="eyebrow">CONTROL DE PAGOS</p><h1>Pagos y servicios</h1><p>{role === 'finanzas' ? 'Consulta de pagos por folio del predio o clave catastral. Acceso de solo lectura.' : 'Recibos y conceptos vinculados al expediente.'}</p></header>
    <form className="sgfl-search" onSubmit={event => { event.preventDefault(); load() }}><input aria-label="Folio del predio o clave catastral" placeholder="Folio del predio, expediente o clave catastral" value={query} onChange={event => setQuery(event.target.value)} /><button className="primary-button" disabled={loading}>Consultar</button></form>
    {error && <p role="alert" className="sgfl-error">{error}</p>}
    {loading ? <p role="status">Consultando pagos…</p> : <div className="sgfl-card sgfl-table"><table><thead><tr>{['Expediente', 'Folio del predio', 'Clave catastral', 'Concepto', 'Recibo', 'Fecha', 'Importe', 'Estado'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.folio}</td><td>{row.folio_predio || 'Pendiente de vinculación'}</td><td>{row.clave_catastral || 'Pendiente de vinculación'}</td><td>{row.concepto}</td><td>{row.recibo}</td><td>{row.fecha}</td><td>{Number(row.importe).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td><td>{row.estado}</td></tr>)}</tbody></table>{!rows.length && !error && <div className="module-empty"><h2>Sin pagos registrados</h2><p>Los pagos registrados por folio aparecerán en esta tabla.</p></div>}</div>}
    {editable && <form className="sgfl-card" onSubmit={save}><h2>Registrar evidencia de pago</h2><div className="sgfl-fields">
      <label>Folio del expediente<input required value={form.folio} onChange={e => setForm({ ...form, folio: e.target.value })} /></label>
      <label>Concepto<select value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })}>{paymentConcepts.map(c => <option key={c}>{c}</option>)}</select></label>
      {['recibo', 'importe', 'fecha'].map(key => <label key={key}>{({ recibo: 'Folio / recibo', importe: 'Importe ($)', fecha: 'Fecha de pago' })[key]}<input required type={key === 'importe' ? 'number' : key === 'fecha' ? 'date' : 'text'} min={key === 'importe' ? '0.01' : undefined} step={key === 'importe' ? '0.01' : undefined} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label>Referencia de evidencia<input required placeholder="Folio de documento del expediente o referencia del recibo" value={form.evidencia} onChange={e => setForm({ ...form, evidencia: e.target.value })} /></label>
    </div><button className="primary-button" disabled={busy}>{busy ? 'Guardando…' : 'Registrar pago'}</button></form>}
  </section>
}
