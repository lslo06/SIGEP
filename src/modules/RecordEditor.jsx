import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Check, LoaderCircle, Landmark, FileText, MapPinned, Users, Wallet, ClipboardList, Info } from 'lucide-react'
import { editorSections } from './editorSections'

const instructions = {
  'Clave catastral': 'Copia la clave que aparece en el documento catastral. Conserva sus letras, números y guiones.',
  'Fundo / Municipio': 'Escribe el nombre del fundo y del municipio al que pertenece el lote.',
  Manzana: 'Escribe el número o letra que identifica la manzana.',
  Lote: 'Escribe el número o clave del lote tal como aparece en sus documentos.',
  Nombre: 'Escribe el nombre de la persona o la razón social, según el tipo de persona seleccionado.',
  'Apellido paterno': 'Escribe el primer apellido tal como aparece en la identificación.',
  'Apellido materno': 'Escribe el segundo apellido, si corresponde.',
  'Tipo de persona': 'Selecciona Física para una persona o Moral para una empresa u organización.',
  'Nombre municipio': 'Escribe el nombre completo del municipio.',
  'Nombre fundo': 'Escribe el nombre oficial del fundo que deseas registrar.',
  'Clave municipio': 'Copia la clave oficial del municipio, si la conoces.',
  'Clave fundo': 'Escribe la clave con la que se identifica este fundo.',
  Propietario: 'Escribe el nombre completo de la persona titular del lote.',
  Concepto: 'Indica el servicio o motivo del cobro. Por ejemplo: trámite de titulación.',
  Recibo: 'Copia el número del comprobante de pago, si ya fue emitido.',
  'Folio título': 'Copia el folio que identifica el título de propiedad.',
  'Identificación oficial': 'Indica el tipo y número de identificación, según el documento presentado.',
  Teléfonos: 'Escribe un teléfono de contacto con sus 10 dígitos. Puedes agregar otro número.',
}

function instruction(field) {
  if (field.help) return field.help
  if (instructions[field.label]) return instructions[field.label]
  if (field.type === 'checkbox') return 'Marca esta opción únicamente si corresponde al registro.'
  if (field.type === 'select') return 'Abre la lista y elige la opción que corresponda.'
  if (field.type === 'date') return 'Selecciona la fecha en el calendario o escríbela en el formato indicado.'
  if (field.type === 'number') {
    if (field.label.includes('$')) return 'Escribe el importe en pesos, sin el signo $ ni separadores de miles. Ejemplo: 1500.50.'
    if (/superficie|hectáreas|metros/i.test(field.label)) return `Escribe la medida en ${/hectáreas/i.test(field.label) ? 'hectáreas' : /m²/.test(field.label) ? 'metros cuadrados' : 'metros'}, solo con números. Puedes usar decimales.`
    return 'Escribe la cantidad con números, sin letras ni separadores de miles.'
  }
  if (field.type === 'textarea') return 'Describe la información con tus propias palabras. Puedes escribir varias líneas.'
  if (/colindancia/i.test(field.label)) return 'Escribe el nombre del vecino, calle o terreno que limita con este lado del lote.'
  if (/nombre|gobernador|secretario|testigo|presidente|director/i.test(field.label)) return 'Escribe el nombre completo tal como aparece en los documentos.'
  if (/dirección|colonia|cabecera/i.test(field.label)) return 'Escribe la ubicación completa según la información disponible.'
  return `Escribe el dato de «${field.label}» tal como aparece en tus documentos.${field.placeholder ? ` Ejemplo: ${field.placeholder}.` : ''}`
}

export default function RecordEditor({ config, moduleName, values, setValues, editing, busy, error, target, onSave, onCancel }) {
  const headingRef = useRef(null)
  const prefix = useId()
  useEffect(() => { headingRef.current?.focus() }, [])
  const sections = editorSections(config)
  const Icon = { Landmark, FileText, MapPinned, Users, Wallet, ClipboardList }[config.icon] || FileText
  const renderField = (field, index) => {
    const id = `${prefix}-${index}`
    const helpId = `${id}-help`
    const value = values[field.label]
    const change = event => setValues(current => ({ ...current, [field.label]: field.type === 'checkbox' ? event.target.checked : event.target.value }))
    const props = { id, 'aria-describedby': helpId, required: field.required, disabled: busy, onChange: change }
    return <div className={`editor-field ${field.wide ? 'editor-field-wide' : ''} ${field.type === 'checkbox' ? 'editor-check' : ''}`} key={field.label}>
      {field.type === 'checkbox' ? <label htmlFor={id}><input {...props} type="checkbox" checked={Boolean(value)} /><span>{field.label}</span></label> : <>
        <label htmlFor={id}>{field.label}{field.required && <span className="editor-required" aria-label="obligatorio"> *</span>}</label>
        {field.type === 'select' ? <select {...props} value={value ?? ''}><option value="">Selecciona una opción</option>{field.options.map(option => <option key={option}>{option}</option>)}</select>
          : field.type === 'textarea' ? <textarea {...props} value={value ?? ''} rows={4} placeholder={field.placeholder || ''} />
            : <input {...props} type={field.type} value={value ?? ''} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 'any' : undefined} placeholder={field.placeholder || ''} />}
      </>}
      <p id={helpId}>{instruction(field)}</p>
    </div>
  }
  const content = <main className="record-editor">
    <div className="editor-container">
      <div className="editor-topline"><span className="editor-brand"><Landmark size={19} /> Fundos <span>/ Gestión territorial</span></span><button type="button" className="editor-back" disabled={busy} onClick={onCancel}><ArrowLeft size={17} /> Volver al listado</button></div>
      <header className="editor-heading"><div className="editor-title-icon"><Icon size={26} strokeWidth={1.7} /></div><div><p>{moduleName}</p><h1 ref={headingRef} tabIndex={-1}>{editing ? 'Editar registro' : 'Agregar registro'}</h1><p>Completa la información y revisa los datos antes de guardar.</p></div><span className="editor-field-count">{config.fields.length} campos disponibles</span></header>
      <div className="editor-guidance"><Info size={17} /><span>Los campos con <b>*</b> son obligatorios. Los demás pueden quedar vacíos. Todas las secciones están abiertas.</span></div>
      <div className="editor-workspace">
      <nav className="editor-index" aria-label="Secciones del formulario"><span>EN ESTE FORMULARIO</span>{sections.map((section, index) => <a href={`#${prefix}-section-${index}`} key={section.title}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</a>)}<p>Las indicaciones debajo de cada campo te ayudan a llenarlo.</p></nav>
      <form onSubmit={onSave} className="editor-form">
        {sections.map((section, index) => <section id={`${prefix}-section-${index}`} aria-labelledby={`${prefix}-heading-${index}`} key={section.title}><header className="editor-section-heading"><span>{String(index + 1).padStart(2, '0')}</span><div><h2 id={`${prefix}-heading-${index}`}>{section.title}</h2><p>{section.description}</p></div></header><div className="editor-fields">{section.fields.map(field => renderField(field, config.fields.indexOf(field)))}</div></section>)}
        {error && <div className="editor-error" role="alert">{error}</div>}
        <footer className="editor-footer"><span>Revisa los datos antes de guardar.</span><div><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={21} /> : <Check size={21} />}{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar registro'}</button></div></footer>
      </form>
      </div>
    </div>
  </main>
  return target ? createPortal(content, target) : content
}
