const layouts = {
  lotes_predios: [
    ['Identificación y ubicación', 'Datos para identificar el terreno.', 9],
    ['Superficies y valores', 'Medidas y valor del lote.', 13],
    ['Observaciones', 'Información adicional sobre el predio.', 14],
    ['Documentación', 'Marca los documentos y características que correspondan.', 20],
    ['Colindancias', 'Vecinos, calles y medidas de cada lado del terreno.', 28],
  ],
  propietarios: [
    ['Datos personales', 'Información de la persona o razón social.', 6],
    ['Información complementaria', 'Datos familiares, ocupación e identificación.', 12],
    ['Domicilio y contacto', 'Ubicación y teléfonos de contacto.', 15],
    ['Características del registro', 'Marca las opciones que correspondan.', 18],
  ],
  municipios_fundos: [
    ['Identificación territorial', 'Claves, nombres y datos de constitución.', 7],
    ['Superficie y distribución', 'Cantidad de manzanas, lotes y hectáreas.', 10],
    ['Autoridades', 'Nombres de los responsables del municipio.', 13],
    ['Historia y documentación', 'Antecedentes y documentos del fundo.', 17],
  ],
  pagos_servicios: [
    ['Lote y concepto', 'Identifica el predio y el motivo del pago.', 4],
    ['Importe y comprobante', 'Monto, recibo y fechas de la operación.', 8],
    ['Cargos, pagos y saldos', 'Completa los importes del estado de cuenta.', 12],
    ['Opciones del registro', 'Marca únicamente las opciones que correspondan.', 15],
  ],
  titulos_formatos: [
    ['Datos del título', 'Folio, libro, número y fechas del documento.', 5],
    ['Autoridades y testigos', 'Personas que intervienen en el título.', 9],
    ['Contenido del título', 'Texto que se conserva con el documento.', 10],
    ['Opciones de titulación', 'Características del registro del título.', 14],
  ],
  historico_reportes: [
    ['Fechas e identificación', 'Periodo, municipio, fundo y propietario.', 6],
    ['Información del predio', 'Datos históricos y observaciones.', 11],
    ['Opciones del registro', 'Marca las opciones que correspondan.', 14],
  ],
}

export function editorSections(config) {
  let start = 0
  const sections = (layouts[config.key] || []).map(([title, description, end]) => {
    const fields = config.fields.slice(start, end)
    start = end
    return { title, description, fields }
  }).filter(section => section.fields.length)
  // Los campos añadidos al catálogo también se muestran, sin quedar ocultos.
  if (start < config.fields.length) sections.push({ title: 'Datos adicionales', description: 'Información complementaria del registro.', fields: config.fields.slice(start) })
  return sections
}
