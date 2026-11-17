import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LoaderCircle,
  Search, Users,
} from 'lucide-react'
import { modules } from './config'
import LocalAdministration from './LocalAdministration'

export default function ModuleWorkspace({ moduleName, organization }) {
  if (moduleName === 'Configuración y seguridad') return <LocalAdministration />
  const config = modules[moduleName]
  if (!config) return <p>Este apartado no está disponible.</p>
  return <RecordWorkspace key={config.key} config={config} moduleName={moduleName} organization={organization} />
}

function RecordWorkspace({ config, moduleName, organization }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [loadError, setLoadError] = useState('')
  const searchRef = useRef(null)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch(`/api/sigep/modulos/${config.key}`)
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.registros)) {
        throw new Error(response.status === 404 ? 'Actualiza la API de SIGEP en el servidor.' : data.error || 'No fue posible consultar el módulo.')
      }
      setRecords(data.registros)
      return true
    } catch (error) {
      setLoadError(!(error instanceof SyntaxError) ? error.message : 'No se pudo conectar con la base de datos. Comprueba tu conexión y vuelve a intentar.')
      return false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [config.key])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')
    if (!query) return records
    return records.filter((record) => [record.titulo, ...Object.values(record.datos || {})]
      .some((value) => String(value ?? '').toLocaleLowerCase('es').includes(query)))
  }, [records, search])

  const exportCsv = () => {
    const columns = [...new Set(filtered.flatMap(record => Object.keys(record.datos || {})))]
    const rows = filtered.map((record) => columns.map((field) => record.datos?.[field] ?? ''))
    const csv = [columns, ...rows]
      .map((row) => row.map((value) => {
        const text = String(value ?? '')
        const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
        return `"${safe.replaceAll('"', '""')}"`
      }).join(','))
      .join('\r\n')
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${config.key}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const action = (label) => {
    if (/buscar|consulta/i.test(label)) {
      searchRef.current?.focus()
      return
    }
    if (/reporte|exportar/i.test(label)) {
      exportCsv()
      return
    }
    if (/estado de cuenta/i.test(label)) {
      exportCsv()
      return
    }
    if (/imprimir|plano|constancia|título|titulo/i.test(label)) {
      window.print()
      return
    }
  }

  return <section className="module-page">
    <header className="module-heading">
      <div><p className="eyebrow">{organization.nombre.toLocaleUpperCase('es')}</p><h1>{moduleName}</h1><p>{config.description}</p></div>
      <div className="module-actions">
        {config.actions.filter(label => /buscar|consulta|reporte|exportar|imprimir/i.test(label)).map((label) => <button className="module-action-button" key={label} onClick={() => action(label)}>{label}</button>)}
      </div>
    </header>
    <div className="module-layout">
      <section className="capture-card">
        <div className="capture-header"><div><h2>Registros</h2></div><span className="record-count">{config.key === 'historico_reportes' ? filtered.length : records.length} registros</span></div>
        <label className="module-search"><Search size={17} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar en ${moduleName.toLocaleLowerCase('es')}`} /><button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">×</button></label>
        {loading ? <div className="module-empty"><LoaderCircle className="spin" size={21} /> Cargando registros…</div> : loadError ? <div className="module-error-state" role="alert"><AlertCircle size={22} /><strong>No se pudieron cargar los registros</strong><span>{loadError}</span><button type="button" className="secondary-button" onClick={load}>Volver a intentar</button></div> : filtered.length ? <div className="record-list">
          {filtered.map((record) => <article className="record-card" key={record.id}>
            <div className="record-main"><strong>{record.titulo}</strong><small>{Object.entries(record.datos || {}).filter(([, value]) => value && typeof value !== 'boolean').slice(0, 3).map(([, value]) => value).join(' · ') || 'Sin datos adicionales'}</small><small className="record-updated">Actualizado {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(record.actualizado_en))}</small></div>
          </article>)}
        </div> : <div className="module-empty"><Users size={22} /><strong>{search ? 'No hay coincidencias' : 'Todavía no hay registros'}</strong><span>Los registros de este módulo aparecerán aquí.</span></div>}
      </section>
      <aside className="related-card">
        <h2>Información de este apartado</h2>
        <div className="related-table">
          {config.related?.map((row, index) => <div className={index === 0 ? 'related-row related-head' : 'related-row'} key={`${row[0]}-${index}`}><span>{row[0]}</span><span>{row[1]}</span>{row[2] && <span>{row[2]}</span>}</div>)}
        </div>
      </aside>
    </div>
  </section>
}
