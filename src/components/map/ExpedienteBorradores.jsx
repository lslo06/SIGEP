import { useState } from "react"

function descargarBorrador(nombre, lineas) {
  const url = URL.createObjectURL(new Blob([lineas.join("\n")], { type: "text/plain;charset=utf-8" }))
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BorradoresDocumento({ expediente, tipo, role }) {
  const procede = expediente.movimientos?.some(movement =>
    movement.etapa_destino === "dictamen_legal" && movement.estado === "en_proceso")
  if (!procede || role !== 'legal') return null

  const ficha = [
    `Folio: ${expediente.folio}`,
    `Trámite: ${tipo}`,
    `Solicitante: ${expediente.solicitante}`,
  ]
  function descargarAcuse() {
    descargarBorrador(`${expediente.folio}-acuse-borrador.txt`, [
      "BORRADOR DE ACUSE DE ENTREGA", "", ...ficha, "",
      "Documento entregado: ____________________", "Fecha de entrega: ____________________",
      "Nombre y firma de quien recibe: ____________________",
    ])
  }

  function descargarDocumento() {
    descargarBorrador(`${expediente.folio}-documento-borrador.txt`, [
      "BORRADOR DE DOCUMENTO", "", ...ficha,
      `Predios: ${expediente.predios?.map(predio => predio.clave_catastral).filter(Boolean).join(", ") || "Sin clave vinculada"}`,
      "", "Contenido del documento: ____________________", "Revisión de Jefatura: ____________________",
      "Autorización de Dirección: ____________________",
    ])
  }

  return <details className="expediente-medicion">
    <summary>Documentos y acuse</summary>
    <p>Descarga borradores para preparar el documento y el acuse. La revisión, autorización y entrega quedan pendientes de registro oficial.</p>
    <button className="secondary-button" type="button" onClick={descargarDocumento}>Descargar borrador del documento</button>{" "}
    <button className="secondary-button" type="button" onClick={descargarAcuse}>Descargar borrador del acuse</button>
  </details>
}

const pesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })

export function BorradorCedula({ folio, predio, superficie }) {
  const [tarifa, setTarifa] = useState("")
  const area = Number(superficie)
  if (!Number.isFinite(area) || area <= 0) return <p>La cédula preliminar requiere una superficie de predio registrada.</p>

  const unitario = Number(tarifa)
  const importe = area * unitario
  const valido = tarifa !== "" && unitario > 0 && Number.isFinite(importe)

  function descargar(event) {
    event.preventDefault()
    if (!valido) return
    descargarBorrador(`${folio}-cedula-${predio.id}.txt`, [
      "CÉDULA CATASTRAL PRELIMINAR", "",
      `Expediente: ${folio}`, `Clave catastral: ${predio.clave_catastral || "Sin clave"}`,
      `Municipio: ${predio.municipio || "Sin municipio registrado"}`,
      `Superficie: ${area} m²`, `Valor unitario capturado: ${pesos.format(unitario)} MXN/m²`,
      `Estimación del terreno: ${pesos.format(importe)} MXN`,
      "", "Cálculo preliminar sujeto a la validación de Cartografía y Valuación.",
    ])
  }

  return <details className="expediente-medicion">
    <summary>Cédula y estimación del terreno</summary>
    <p>Superficie registrada: {area.toLocaleString("es-MX")} m². Captura un valor unitario para preparar la estimación preliminar.</p>
    <form onSubmit={descargar}>
      <label className="form-field">Valor unitario del terreno (MXN/m²)
        <input type="number" min="0.01" step="0.01" required value={tarifa} onChange={event => setTarifa(event.target.value)} />
      </label>
      {valido && <output>Estimación del terreno: {pesos.format(importe)} MXN</output>}
      <button className="secondary-button" type="submit" disabled={!valido}>Descargar cédula preliminar</button>
    </form>
  </details>
}
