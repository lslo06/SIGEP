import { supabase } from './supabase'

const EXPEDIENTE_SELECT = `
  id, folio, tipo_tramite, libro, numero_titulo, fecha_titulo, estado, observacion,
  fecha_solicitud, fecha_entrega, fecha_pago_servicios, fecha_gobierno,
  fecha_municipio, fecha_registro_publico, costo_terreno, parcialidades_pagadas,
  saldo_pendiente, numero_oficio, seguimiento_firmas, area_actual, siguiente_accion,
  en_espera, predio_id,
  predio:predios!inner (
    manzana, lote, superficie_m2,
    propietario:propietarios!inner (nombre_completo),
    fundo:fundos!inner (nombre)
  )
`

function fromDatabase(row) {
  return {
    _id: row.id,
    _predioId: row.predio_id,
    id: row.folio,
    tipo: row.tipo_tramite,
    propietario: row.predio.propietario.nombre_completo,
    fundo: row.predio.fundo.nombre,
    manzana: row.predio.manzana,
    lote: row.predio.lote,
    superficie: row.predio.superficie_m2 ?? '',
    libro: row.libro ?? '',
    titulo: row.numero_titulo ?? '',
    fechaTitulo: row.fecha_titulo ?? '',
    estado: row.estado,
    observacion: row.observacion ?? '',
    fechaSolicitud: row.fecha_solicitud ?? '',
    fechaEntrega: row.fecha_entrega ?? '',
    fechaPago: row.fecha_pago_servicios ?? '',
    fechaGobierno: row.fecha_gobierno ?? '',
    fechaMunicipio: row.fecha_municipio ?? '',
    fechaRegistro: row.fecha_registro_publico ?? '',
    costoTerreno: row.costo_terreno ?? '',
    parcialidades: row.parcialidades_pagadas ?? '',
    saldoPendiente: row.saldo_pendiente ?? '',
    oficio: row.numero_oficio ?? '',
    seguimientoFirmas: row.seguimiento_firmas,
    areaActual: row.area_actual,
    siguienteAccion: row.siguiente_accion ?? '',
    espera: row.en_espera ?? '',
  }
}

export async function listExpedientes(organizacionId) {
  const { data, error } = await supabase
    .from('expedientes')
    .select(EXPEDIENTE_SELECT)
    .eq('organizacion_id', organizacionId)
    .order('creado_en', { ascending: false })

  if (error) throw error
  return data.map(fromDatabase)
}

export async function saveExpediente(organizacionId, expedienteId, form) {
  const datos = {
    propietario: form.propietario.trim(),
    fundo: form.fundo.trim(),
    manzana: form.manzana.trim(),
    lote: form.lote.trim(),
    superficie_m2: form.superficie === '' ? null : Number(form.superficie),
    tipo_tramite: form.tipo,
    libro: nullable(form.libro),
    numero_titulo: nullable(form.titulo),
    fecha_titulo: nullable(form.fechaTitulo),
    estado: form.estado,
    observacion: nullable(form.observacion),
    fecha_solicitud: nullable(form.fechaSolicitud),
    fecha_entrega: nullable(form.fechaEntrega),
    fecha_pago_servicios: nullable(form.fechaPago),
    fecha_gobierno: nullable(form.fechaGobierno),
    fecha_municipio: nullable(form.fechaMunicipio),
    fecha_registro_publico: nullable(form.fechaRegistro),
    costo_terreno: numericOrNull(form.costoTerreno),
    parcialidades_pagadas: numericOrNull(form.parcialidades),
    saldo_pendiente: numericOrNull(form.saldoPendiente),
    numero_oficio: nullable(form.oficio),
    seguimiento_firmas: form.seguimientoFirmas,
    area_actual: form.areaActual,
    siguiente_accion: nullable(form.siguienteAccion),
    en_espera: nullable(form.espera),
  }

  const { data, error } = await supabase.rpc('guardar_expediente', {
    p_organizacion_id: organizacionId,
    p_expediente_id: expedienteId,
    p_datos: datos,
  })
  if (error) throw error
  return data
}

export async function deleteExpediente(organizacionId, expedienteId) {
  const { error } = await supabase.rpc('eliminar_expediente', {
    p_organizacion_id: organizacionId,
    p_expediente_id: expedienteId,
  })
  if (error) throw error
}

function nullable(value) {
  return value === '' || value == null ? null : value
}

function numericOrNull(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error('Los importes deben ser números mayores o iguales a cero.')
  }
  return number
}

export { fromDatabase }
