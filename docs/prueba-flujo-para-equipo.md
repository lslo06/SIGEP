# Prueba del flujo actual y guía para el equipo

Fecha: 25 de noviembre de 2026, Ciudad de México. Versión revisada: directorio de trabajo local, antes de commit/push.

## Resultado y alcance

La versión incluye recepción de primera titulación sin predio previo, canalización por Dirección/Jefatura, asignación en Cartografía y visita/evidencia en Topografía. También conserva el circuito de predios existentes. El incremento nuevo llega hasta revisión cartográfica pendiente; todavía falta vincular el predio definitivo y completar la titulación hasta entrega. El recorrido nuevo y su activación están en [Recepción inicial](recepcion-inicial.md).

Se ejecutaron 70 pruebas automatizadas, con 70 aprobadas y 0 fallidas. `tests/titulacion-flow.test.js` aporta 15 comprobaciones del circuito existente (incluyendo subpruebas); `tests/initial-reception.test.js` agrega nueve pruebas del nuevo recorrido y del proxy. Se comprobó la sintaxis de API/tests y `git diff --check` no encontró errores de espacios.

Las pruebas nuevas ejecutan los controladores reales, autenticación/hash de contraseña, permisos y lector multipart. Las respuestas SQL se proporcionan mediante fixtures y el almacenamiento de archivos se simula en memoria. No prueban las restricciones, permisos ni transacciones de una instancia real de PostgreSQL. Se intentó consultar la API en `127.0.0.1:8100` y la interfaz en `localhost:5173`, pero el entorno negó el acceso al socket. Por tanto, no se certificó una prueba en navegador ni una operación contra el servidor desplegado.

`npm.cmd run build` completó correctamente la compilación de producción con Vite, incluyendo las nuevas pantallas de recepción y visita inicial.

## Recorrido comprobado en los controladores

| Comprobación | Resultado |
|---|---|
| Acceso sin sesión y contraseña incorrecta | Rechazados. |
| Inicio/cierre de sesión | Se emite cookie de sesión y se revoca el acceso al salir. |
| Ventanilla crea expediente con predio existente | Obtiene folio; el movimiento usa el actor autenticado. |
| Solicitud de medición y asignación por Cartografía | Aceptadas con datos válidos y topógrafo activo en la respuesta simulada. |
| Bandeja de campo | Solicita el filtro por topógrafo y la superficie registrada. La ejecución de ese filtro SQL requiere comprobar PostgreSQL real. |
| Otro topógrafo intenta registrar la visita | Rechazado con 403. |
| Evidencia antes de registrar visita | Rechazada con 409. |
| Topógrafo asignado registra visita y superficie | Aceptado; registra historial. |
| Evidencia y plano después de la visita | Carga y descarga con parser real y archivos en memoria. |
| Caja registra pago | Ejecuta la secuencia transaccional y el movimiento con actor de sesión. |
| Checklist, carga y revisión de documento | Aceptados; rechazar sin motivo se impide. |
| Titulación abre documento pendiente/aceptado | Pendiente: 403. Aceptado: descarga permitida. |
| Ventanilla/Titulación consultan cédula | Reciben folio, valores y propietarios; su escritura se rechaza. |
| Alta inicial sin predio/documentos/dirección formal | Aceptada por `/api/solicitudes-titulacion` con municipio, localidad y referencias. La ruta anterior del mapa conserva su contrato. |
| Alta inicial con nombres/apellidos separados | Aceptada; conserva también nombre completo compatible. |
| Canalización inicial por áreas | Pasa por Ventanilla, Dirección, Jefatura, Cartografía y Topografía; bloquea saltos y repeticiones. |
| Fallos de ubicación, movimiento y evidencia inicial | Se ejecuta rollback; la evidencia física simulada se elimina si falla su historial. |

Estas pruebas no completan generación de título, revisión de Informática, Consejería, RPP ni entrega. Las nuevas canalizaciones iniciales sí cambian etapa y área; no constituyen un motor completo de todos los procesos.

## Campos y normalización

- La migración nueva agrega `nombres`, `primer_apellido` y `segundo_apellido` a `solicitantes`. La recepción nueva los captura por separado y conserva `nombre` completo para las consultas anteriores. El formulario antiguo asociado al mapa conserva su campo completo.
- Se agregaron placeholders y ayudas; la migración está preparada, pero no se ha ejecutado sobre el servidor.
- Tener tablas separadas para solicitantes, expedientes, documentos y movimientos no significa que todos los datos estén estructurados con el detalle solicitado.
- El domicilio de notificaciones sigue siendo un texto y los propietarios catastrales se guardan en un arreglo JSON con nombre. No se ha certificado la normalización integral de la base desplegada.
- La migración conserva nombres anteriores completos, sin partir nombres compuestos automáticamente por espacios. Queda pendiente revisar y estructurar esos datos históricos.

## Documentos del trámite

La migración `sql/create_archivos_expediente.sql` propone para titulación:

1. Solicitud de predio.
2. Constancia de posesión.
3. Identificación oficial.
4. Acta de nacimiento.
5. Comprobante de domicilio.

También incluye `Cédula catastral` y `Otro` en el catálogo. La cédula es un producto de una etapa posterior y `Otro` es una clasificación complementaria; el catálogo actual todavía no expresa esas diferencias mediante reglas de obligatoriedad por etapa. CURP no fue añadido por esta iteración.

La lista que ve cada instalación se consulta en `requisitos_documentales` y Administración puede configurarla; no se consultó la configuración del servidor. Hay carga, versiones y revisión, pero falta completar los controles para impedir avanzar/cerrar con requisitos exigibles pendientes.

## Guion manual del circuito con predio existente

Para el caso prioritario desde cero, seguir primero la tabla de [Recepción inicial](recepcion-inicial.md). La tabla siguiente conserva la regresión del circuito anterior.

Usar cuentas activas por rol y un predio de prueba existente. No ejecutar el reinicio de usuarios para probar estos cambios.

| Paso | Cuenta / pantalla | Acción y resultado esperado |
|---|---|---|
| 1 | Ventanilla → Lotes y predios | Buscar el predio y elegir «Iniciar trámite con este predio». Revisar ejemplos/ayudas. Crear titulación con datos ficticios y conservar folio. |
| 2 | Ventanilla → Seguimiento de trámites | Buscar el folio, abrir «Medición y visita de campo» y solicitar medición. |
| 3 | Cartografía → Medición y topografía | Abrir solicitud y asignar una cuenta activa de Topografía con fecha compromiso vigente. |
| 4 | Topografía asignada → Medición y topografía | Ver la orden y superficie registrada; registrar visita, superficie, observaciones y referencia de evidencia. |
| 5 | Topografía asignada → misma orden | Adjuntar PDF/JPG/PNG de prueba y descargarlo. La comparación debe mostrar medida menos registrada; por ejemplo, 125 − 120 = 5 m². |
| 6 | Cartografía → misma bandeja | Incorporar plano después de la visita y verificar su descarga. |
| 7 | Ventanilla → Documentación, cédula y propietarios | Cargar una identificación ficticia bajo el requisito correspondiente. |
| 8 | Titulación / Digitalización | Titulación no debe abrir el documento pendiente. Digitalización lo acepta; Titulación ya debe poder consultarlo. |
| 9 | Cartografía → Documentación, cédula y propietarios | Usar una cédula de prueba existente o capturar valores y propietarios ficticios. Volver con Titulación/Ventanilla: deben ver datos sin poder editarlos. |
| 10 | Caja → Pagos y servicios | Registrar un recibo de prueba con folio correcto. Confirmar historial del expediente. |
| 11 | Otra cuenta de Topografía | No debe poder operar la orden ajena. |

Actualizar interfaz y API desde la misma versión. Aplicar `sql/enable_recepcion_inicial.sql` para el flujo nuevo y conservar las migraciones anteriores de expedientes, usuarios, pagos, medición y documentos. El nuevo módulo `api/initial-reception.mjs` está incluido en el Dockerfile.

## Preparación del push

No se ejecutó commit ni push. Publicar como recepción inicial hasta visita y mejoras del circuito existente, después de validar el recorrido manual en ambiente de pruebas.

Incluir API, permisos compartidos, Dockerfile, migración, componentes de `src/components/initial-reception`, integración en App/Seguimiento/Topografía, proxy de Vite y pruebas. Conservar las mejoras previas de captura, cédula y medición. El cambio de API conserva además el ajuste previo de login para verificar contraseñas ya provisionadas; no se cambió aquí la política de creación de usuarios.

Seleccionar los archivos explícitamente. `sigep_proyecto.zip`, `sql/reset_demo_users.sql` y el manual pospuesto son trabajo aparte y no son necesarios para este lote. El README local con enlace de invitación permanece fuera de esta entrega.

Mensaje sugerido para el equipo (no enviado):

> La versión agrega Nueva solicitud de título: se recibe sin predio ni papeles, con nombres/apellidos separados y ubicación/referencias. Después pasa por Dirección → Jefatura → Cartografía → topógrafo asignado, quien registra visita y evidencia. Requiere la nueva migración y actualizar API/interfaz. Falta vincular el predio definitivo y completar las etapas hasta entrega. Reporten rol, folio ficticio, pantalla, pasos y resultado.
