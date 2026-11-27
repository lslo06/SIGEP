# SIGEP: pruebas del equipo desde cero

Actualización: 27 de noviembre de 2026. Complemento de la [comparación con requisitos](comparacion-requisitos-2026-11-26.md). La ejecución automatizada y sus límites se registran en [Resultados del 27/11](resultado-pruebas-2026-11-27.md). Los cambios de esta actualización aún requieren publicarse en API y frontend.

## Objetivo y límite

Probar a una persona que solicita por primera vez un título, sin predio dado de alta, clave catastral, coordenadas ni documentos iniciales. La versión actual permite recibir, canalizar, asignar visita, registrar superficie/observaciones y adjuntar evidencia.

**El recorrido local ahora permite vincular el predio identificado al mismo folio y continuar con plano y datos catastrales.** El estado posterior es “Predio vinculado · integración cartográfica”. No crea un segundo expediente. Siguen pendientes las validaciones completas, generación de título, Consejería, RPP y entrega.

En paralelo pueden probarse documentación y pagos del mismo folio. Plano/cédula se verifican después de vincular el predio o en el caso B de regresión. No se dará por emitido ningún título.

## Preparación

1. Usar la URL compartida del frontend actualizado y una base/ambiente autorizado para pruebas. Reiniciar o reconstruir la API no actualiza por sí solo el frontend.
2. Confirmar acceso individual a Ventanilla, Dirección, Jefatura, Cartografía, Topografía, Digitalización, Caja, Titulación, Informática, Consulta/Auditoría y Administración. Usar las credenciales vigentes de Administración; esta guía no presupone correos ni contraseñas.
3. Para probar asignación ajena, se necesita una segunda cuenta activa de Topografía. No borrar las cuentas actuales: Administración puede dar de alta una cuenta de prueba adicional y desactivarla al terminar.
4. Cada persona usa su propia sesión; si una persona prueba varios roles, cerrar sesión y entrar con el siguiente, o usar perfiles de navegador separados. No ejecutar todo como Administración.
5. Preparar un PDF o imagen de prueba sin datos personales reales, con texto visible “PRUEBA SIGEP — SIN VALIDEZ”. Se permiten PDF/PNG/JPEG hasta 10 MB.
6. Tener anotado quién coordina y recoger los resultados en la tabla del final. No ejecutar `reset_demo_users.sql` ni eliminar expedientes para estas pruebas.
7. El despliegue aportado ya respondió `200 OK` y la migración inicial terminó en `COMMIT`. Aún deben comprobarse cargas de archivos y permisos reales. Si aparece error de migración o 503, detener ese caso y reportarlo; no ejecutar todos los SQL indiscriminadamente.

## Datos del caso A

Datos ficticios; utilizar un sufijo propio para distinguir pruebas de varias personas.

| Campo | Valor de prueba |
|---|---|
| Nombre(s) | María Elena PRUEBA-A01 |
| Apellido paterno | García |
| Apellido materno | López |
| Teléfono | Dejar vacío; es opcional. |
| Correo | `sigep-prueba-a01@example.com` |
| Domicilio para notificaciones | Oficina de pruebas SIGEP, domicilio ficticio. |
| Municipio | Durango |
| Localidad o colonia | Localidad de prueba A01 |
| Dirección del terreno | Dejar vacía para probar que no requiere domicilio formal. |
| Referencias | Terreno de prueba: por el camino de la escuela, 200 m después del puente, junto al portón azul. |
| Observaciones | PRUEBA A01. Solicita iniciar titulación; no presenta documentos ni clave catastral. |
| Fecha compromiso y visita | Fecha del día de la prueba, para completar todo el recorrido ese día. |
| Superficie | 150.25 m², dato ficticio de prueba. |
| Observaciones de visita | PRUEBA A01: se ubicó el terreno con las referencias; superficie de ejemplo 150.25 m². Pendiente validación cartográfica. |

## Caso A: solicitud sin predio previo

Registrar el folio que entregue el sistema: **________________**. Usar ese mismo folio en todos los pasos.

| Paso | Rol y pantalla | Acción | Resultado esperado |
|---|---|---|---|
| A01 | Ventanilla → Seguimiento de trámites → Nueva solicitud de título | Capturar los datos anteriores y pulsar “Guardar solicitud y generar folio”. | Genera folio y abre ficha. No exige predio, clave, coordenadas, calle ni documentos. Se ve ubicación declarada pendiente de verificación. |
| A02 | Ventanilla → ficha / Consultar expedientes | Recargar y buscar por folio; después probar por solicitante. | Persisten nombre, ubicación, observaciones y folio. El historial identifica a quien recibió. No hay predio definitivo vinculado. |
| A03 | Ventanilla → Ubicación y visita inicial | Pulsar “Solicitar medición”, con observación de prueba. | Estado “Pendiente de Dirección”; área Dirección; nuevo movimiento con actor/fecha. No vuelve a permitir solicitar la misma medición. |
| A04 | Dirección → Seguimiento de trámites → Solicitudes de título desde ventanilla | Abrir el folio y pulsar “Canalizar a Fundos Legales”. | Estado “Pendiente de Jefatura”; movimiento con área origen/destino y actor de Dirección. |
| A05 | Jefatura → misma bandeja | Abrir y pulsar “Canalizar a Cartografía”. | Estado “Pendiente de asignación”; área Cartografía y Valuación. |
| A06 | Cartografía → Medición y topografía → Solicitudes de título desde ventanilla | Abrir, elegir topógrafo activo, fecha de hoy y pulsar “Asignar visita”. | Estado “Visita asignada”; responsable y fecha visibles; área Topografía. |
| A07 | Topografía ASIGNADA → Medición y topografía | Abrir la solicitud; capturar fecha, 150.25 m² y observaciones; pulsar “Registrar visita”. | Estado “Visita registrada · pendiente de revisión cartográfica”; área Cartografía y Valuación; fecha y superficie persistidas. |
| A08 | Misma cuenta de Topografía → Evidencia de visita | Adjuntar el archivo de prueba, descargarlo y comprobar que abre. Adjuntar un segundo archivo. | Ambas versiones quedan disponibles y el historial registra carga. Ningún archivo previo se pierde. |
| A09 | Cartografía → bandeja; Ventanilla → búsqueda por folio | Abrir el expediente y revisar ubicación, visita, evidencia e historial. | Se conserva el mismo folio y los actores correctos. Estado pendiente de revisión cartográfica. |
| A10 | Cartografía → Ubicación y visita inicial → Identificación cartográfica | Buscar la clave del predio identificado, seleccionarlo, explicar el cotejo y pulsar “Vincular predio al mismo folio”. Si aún no tiene ficha, registrarla primero en Lotes y predios, con la clave autorizada por Cartografía. | Exige visita, evidencia y geometría válida. Conserva folio, superficie medida y evidencia; no sobrescribe geometría/superficie del predio. Estado integración cartográfica. |
| A11 | Cartografía → Seguimiento → mismo folio | Abrir el predio vinculado, adjuntar plano en Medición y visita de campo y capturar/revisar datos catastrales según permisos. | Se habilita el circuito de predio vinculado; la visita original sigue consultable arriba. Repetir la vinculación se rechaza. |

Las bandejas de Dirección y Jefatura muestran los pendientes de su etapa: que el expediente desaparezca de su bandeja después de canalizar puede ser correcto. Para consultar su historial usar el folio. Topografía sólo debe recibir las visitas asignadas a su cuenta.

## Caso A: pruebas de rechazo

Usar otra solicitud ficticia cuando sea necesario. En solicitudes rechazadas no deben crearse movimientos ni cambios parciales.

| ID | Intento | Resultado esperado |
|---|---|---|
| N01 | Alta sin nombre, sin ningún apellido, sin municipio, sin localidad o sin referencias. | Rechazo con explicación. Un único apellido sí se admite; probar ese caso por separado. |
| N02 | Caja o Consulta intenta crear solicitud. | No tiene acción disponible; una petición directa tampoco debe autorizarse. |
| N03 | Cartografía intenta asignar antes de canalizar Dirección/Jefatura. | No muestra acción aplicable; API rechaza salto de etapa. |
| N04 | Repetir una canalización desde una pestaña desactualizada. | Rechazo de transición repetida, sin movimiento duplicado. |
| N05 | Asignar sin topógrafo, con cuenta inactiva/de otro rol o sin fecha. | Rechazo. La lista sólo debe ofrecer Topografía activa. |
| N06 | Topógrafo no asignado intenta abrir/modificar el caso. | No aparece en su bandeja; acceso/escritura rechazados por servidor. |
| N07 | Registrar superficie cero/negativa, fecha futura o visita sin observaciones. | Rechazo sin perder asignación. |
| N08 | Subir evidencia antes de registrar visita. | No disponible; petición directa rechazada. |
| N09 | Subir archivo de más de 10 MB o contenido distinto de PDF/PNG/JPEG. | Rechazo sin registro ni archivo parcial. Cambiar sólo la extensión no debe hacerlo válido. |
| N10 | Cerrar sesión y reutilizar una URL de descarga. | Sin sesión válida no descarga contenido privado. |

Las pruebas que requieran peticiones directas puede ejecutarlas el integrante encargado de API. No confundir un botón oculto con autorización comprobada en servidor; la suite automática cubre varios de estos rechazos, pero la aceptación compartida debe confirmar los casos críticos.

## Caso D: documentación sobre el folio inicial

Puede probarse sin vincular un predio. Abrir la ficha en Seguimiento y desplegar “Documentación, cédula y propietarios”.

| ID | Rol | Prueba y resultado |
|---|---|---|
| D01 | Ventanilla o Digitalización | Consultar checklist de titulación. Deben existir solicitud, posesión, identificación, acta y domicilio, si el catálogo no fue modificado. El expediente recibido sin documentos muestra faltantes y sigue existiendo. |
| D02 | Ventanilla o Digitalización | Subir PDF de prueba, clasificar “Solicitud de predio”, etapa Recepción. Estado inicial: pendiente de revisión. |
| D03 | Titulación o Consulta | Documento general pendiente no debe estar disponible para descarga. |
| D04 | Digitalización o Cartografía | Rechazar sin motivo: impedir. Rechazar con motivo: guardar estado/revisor/fecha y mostrar motivo. |
| D05 | Ventanilla o Digitalización | Subir versión corregida del mismo requisito. Conservar versión anterior y crear nueva pendiente. |
| D06 | Digitalización o Cartografía | Aceptar nueva versión; Titulación/Consulta deben poder verla y descargarla al actualizar. |
| D07 | Ventanilla | Puede cargar y consultar, pero no aceptar/rechazar documentos en la configuración actual. Reportar como ajuste de responsabilidad a validar, no como autorización ya implementada. |
| D08 | Administración, sólo en ambiente aislado | Cambiar checklist del tipo, guardar y comprobar lectura. Afecta a todas las solicitudes de ese tipo: registrar la lista original y restaurarla al terminar. |

El sistema no comprueba automáticamente que el PDF sea una identificación auténtica ni que la información sea suficiente: la revisión corresponde al área autorizada. Las plantillas oficiales siguen pendientes. El comportamiento de versión anterior aceptada frente a nueva pendiente debe acordarse; está señalado en el comparativo.

## Caso P: pagos por folio

La prueba comprueba captura, duplicados e historial, no cobro real ni autorización para continuar.

| ID | Rol | Prueba y resultado |
|---|---|---|
| P01 | Caja → Pagos y servicios | Registrar el folio A, concepto “Servicios catastrales”, recibo único `PRUEBA-A01-001`, importe ficticio 100.00, fecha de hoy, referencia “Comprobante de prueba A01, sin validez”. Debe guardarse y poder consultarse por folio. |
| P02 | Ventanilla → ficha/historial | Debe aparecer movimiento del pago con actor de Caja, concepto e importe. |
| P03 | Caja | Repetir mismo recibo y concepto: debe rechazarse sin duplicado. Fecha futura, importe no positivo y folio inexistente también deben rechazarse. |
| P04 | Consulta / rol sin permiso de pagos | No puede registrar pagos. |

El rótulo actual es “Registrado”, sin afirmar validación bancaria. La tabla muestra solicitante y referencia de evidencia. Caja captura esa referencia; la carga de archivos se hace por documentación con un rol autorizado y requisito configurado. No hay todavía orden de pago, saldo, exención ni bloqueo de etapas por falta de pago.

## Caso B: regresión con un predio existente

Este caso usa OTRO folio y un predio de prueba ya registrado. Sirve para revisar funciones existentes que aún no están conectadas al caso A.

1. **Ventanilla**, Lotes y predios: buscar el predio de prueba, seleccionarlo e iniciar trámite de titulación. El formulario antiguo requiere ese predio y usa nombre completo. Esto es distinto de “Nueva solicitud de título”.
2. Abrir el expediente, “Medición y visita de campo”, solicitar medición. **Cartografía** asigna topógrafo y compromiso desde Medición y topografía → Mediciones de predios vinculados.
3. **Topografía asignada** registra visita, superficie y evidencia; otra cuenta no debe hacerlo.
4. **Cartografía** adjunta plano después de la condición de medición requerida. Revisar descarga y versiones. Los roles lectores no deben adquirir permiso de carga de plano.
5. **Cartografía**, Documentación, cédula y propietarios: guardar folio/fecha de cédula, valores y propietarios ficticios; revisar/aceptar o rechazar con motivo. Recargar y confirmar persistencia.
6. **Captura** guarda propietarios/valores como pendientes, sin poder aprobarlos. **Cartografía** los acepta/rechaza. **Ventanilla y Titulación** consultan sin sobrescribir.
7. **Informática** consulta también propietarios/valores/cédula, sin editarlos. La validación formal de consistencia todavía sigue pendiente.
8. Si se prueba corrección de geometría, hacerlo sólo con Cartografía en un predio desechable de prueba, registrar motivo y verificar historial. No modificar geometría real para una demostración.

## Caso C: certificaciones/constancias

1. Ventanilla inicia desde un predio de prueba cada tipo que se quiera revisar: certificación de antecedentes de título, copia de título, constancia de datos de lote y constancia de trámite de título.
2. Adjuntar identificación y solicitud escrita de prueba; Caja registra los conceptos que se estén probando. Estas acciones todavía no obligan un orden completo.
3. Legal emite “procede” con motivo; en otro folio emite “no procede” con motivo. Deben cambiar estado y registrar historial. No permitir dictamen repetido ni que lo emita otro rol.
4. Con “procede”, Legal puede descargar borradores TXT. **No son formatos oficiales ni constancia de autorización o entrega.**
5. No usar el tipo genérico “Búsqueda de información” para probar esos cuatro dictámenes ni usar el dictamen de certificación como dictamen de primera titulación.

Pendiente de este proceso: plantilla institucional, revisión Jefatura, autorización Dirección y entrega con acuse.

## Caso U: usuarios y permisos

- Administración crea una cuenta ficticia de Consulta, cambia su nombre/rol y la desactiva. Confirmar que conserva historial y pierde acceso; no borrar usuarios de compañeros.
- Una cuenta operativa no debe abrir la administración mediante URL directa ni cambiar usuarios.
- El último administrador no debe poder desactivarse ni perder ese rol. No hace falta alterar administradores reales para probarlo: el caso automatizado ya existe; cualquier prueba manual se realiza en una base aislada.
- Comprobar menú y escritura por rol con la matriz de 13 roles del comparativo. Ventanilla puede ver Lotes y predios para consulta: eso no le permite editar cartografía.

## Cómo registrar resultados

Una fila por caso o incidencia. “No probado” no equivale a aprobado.

| Caso | Persona / rol | Folio | Resultado: aprobado / falló / bloqueado / no probado | Esperado y obtenido | Evidencia / hora |
|---|---|---|---|---|---|
| A01–A11 | | | | | |
| N01–N10 | | | | | |
| D01–D08 | | | | | |
| P01–P04 | | | | | |
| B | | | | | |
| C | | | | | |
| U | | | | | |

En una incidencia guardar rol, pantalla, folio, acción exacta, mensaje y hora; agregar captura y estado HTTP si se conoce. No incluir contraseñas, cookies, tokens ni datos personales reales. Si falló después de guardar, recargar antes de repetir para comprobar si ya existe registro.

## Criterio de salida de esta ronda

El incremento inicial puede darse por **probado en el servidor** cuando A01–A11 funcionan, N01–N10 rechazan lo indebido, archivos sobreviven recarga/cambio de sesión y cada movimiento conserva el actor correcto. También deben rechazarse vinculación sin evidencia, predio inexistente o sin polígono válido, vinculación repetida y revisión documental de expediente cerrado. Documentos, pagos y circuito previo se reportan con sus propios resultados.

Aunque todo lo anterior pase, permanecen pendientes la conciliación/aprobación cartográfica completa, validaciones por etapa, título, Consejería, RPP, entrega y cierre. Esta ronda permite validar el incremento y detectar problemas antes de continuar; no constituye aceptación del MVP completo.
