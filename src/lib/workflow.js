export const titleStages = [
  ['TIT-01', 'Recepción y verificación', ['ventanilla']],
  ['TIT-06', 'Integración de requisitos', ['ventanilla']],
  ['TIT-07', 'Pago de lote y servicios', ['caja']],
  ['TIT-08', 'Digitalización y captura', ['digitalizacion', 'captura']],
  ['TIT-09', 'Validación del expediente', ['titulacion', 'informatica']],
  ['TIT-10', 'Generación y revisión del título', ['titulacion']],
  ['TIT-11', 'Envío a Consejería Jurídica', ['titulacion', 'direccion']],
  ['TIT-12', 'Firma y retorno de Consejería', ['titulacion']],
  ['TIT-13', 'Envío al RPP', ['titulacion']],
  ['TIT-14', 'Inscripción y retorno del RPP', ['titulacion']],
  ['TIT-16', 'Digitalización del título inscrito', ['digitalizacion']],
  ['TIT-17', 'Afectación final, entrega y archivo', ['titulacion', 'ventanilla']],
]
export const searchStages = [
  ['BUS-01', 'Recepción de solicitud', ['ventanilla']],
  ['BUS-02', 'Canalización a Fundos Legales', ['direccion']],
  ['BUS-03', 'Pago de búsqueda', ['caja']],
  ['BUS-04', 'Digitalización', ['digitalizacion']],
  ['BUS-05', 'Determinación legal', ['legal']],
  ['BUS-06', 'Pago del documento', ['caja']],
  ['BUS-07', 'Generación del documento', ['legal']],
  ['BUS-08', 'Revisión y autorización', ['jefatura', 'direccion']],
  ['BUS-09', 'Entrega y archivo', ['ventanilla']],
]
export const stagesFor = tipo => tipo === 'Búsqueda de información' ? searchStages : titleStages
export const documentTypes = ['Solicitud de predio', 'Constancia de posesión', 'Identificación oficial', 'Acta de nacimiento', 'Comprobante de domicilio', 'Solicitud escrita', 'Título', 'Título inscrito', 'Acuse de entrega', 'Evidencia de pago', 'Documento expedido', 'Acuse Consejería', 'Acuse RPP', 'Otro']
export const requestTypes = ['Certificación de antecedentes de expedición de título', 'Certificación de copia de título', 'Constancia de antecedentes / datos de lote', 'Constancia de trámite de título']
export const paymentConcepts = ['Lote', 'Servicios catastrales', 'Búsqueda de información', 'Documento solicitado']
export function stageFor(file, flow) {
  const stages = stagesFor(file.tipo)
  return stages.find(s => s[0] === flow?.etapa) || stages[0]
}
export function overdue(flow, today) {
  return Boolean(flow?.fecha_compromiso && flow.fecha_compromiso < today && !flow.cerrado)
}
