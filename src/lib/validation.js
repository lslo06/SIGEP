export function positiveArea(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new Error('La superficie debe ser mayor que cero.')
  return number
}

export function validateDates(form) {
  if (form.fechaSolicitud && form.fechaEntrega && form.fechaEntrega < form.fechaSolicitud) {
    throw new Error('La fecha de entrega no puede ser anterior a la solicitud.')
  }
}

export function isPriority(file) {
  return !['Vigente', 'Cancelado'].includes(file.estado) && ['Hoy', '1 día', '2 días'].includes(file.espera)
}

export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
