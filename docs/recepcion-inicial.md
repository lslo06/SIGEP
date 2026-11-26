# Recepción de titulación sin predio previo

Cambio implementado en el directorio local el 25 de noviembre de 2026. Pendiente de aplicar la migración y desplegar en el servidor.

## Qué cambia

En Inicio y Seguimiento de trámites aparece **Nueva solicitud de título** para Ventanilla, Captura y Administración. Ya no necesita seleccionar un predio del mapa para iniciar este caso.

El formulario recibe:

- Nombre(s), apellido paterno y apellido materno por separado. Los apellidos admiten vacío si no corresponden a la persona.
- Teléfono, correo y domicilio de notificaciones, opcionales en esta recepción.
- Municipio y localidad/colonia del terreno, obligatorios.
- Dirección o descripción del lugar, opcional si no tiene domicilio formal.
- Referencias para localizar el terreno, obligatorias.
- Observaciones de recepción, opcionales; por ejemplo, que aún no presenta documentos.

Genera folio y expediente de titulación con ubicación declarada. No solicita clave catastral, superficie, polígono ni archivos para recibir la solicitud. La recepción no acredita propiedad ni sustituye la revisión posterior de requisitos.

## Recorrido para probar

| Paso | Cuenta y pantalla | Acción / resultado esperado |
|---|---|---|
| 1 | Ventanilla → Seguimiento de trámites → Nueva solicitud de título | Usar datos ficticios. Dejar dirección vacía y escribir referencias claras. Guardar; debe abrir la ficha con un folio y sin predios vinculados. |
| 2 | Ventanilla → ficha → Ubicación y visita inicial | Pulsar Solicitar medición. El expediente pasa a Dirección. |
| 3 | Dirección → Seguimiento de trámites | En la bandeja de solicitudes iniciales, abrir el folio y canalizar a Fundos Legales. |
| 4 | Jefatura → Seguimiento de trámites | Abrir la solicitud y canalizar a Cartografía. |
| 5 | Cartografía → Medición y topografía o Seguimiento de trámites | Asignar un topógrafo activo y fecha compromiso vigente. |
| 6 | Topografía asignada → Medición y topografía | Abrir la solicitud inicial. Debe ver contacto, dirección/referencias y fecha. Registrar fecha de visita, superficie y observaciones. |
| 7 | Topografía asignada → misma ficha | Adjuntar evidencia PDF, PNG o JPEG, hasta 10 MB por archivo. Verificar descarga. |
| 8 | Cartografía → bandeja / ficha | Consultar visita y evidencia. El expediente queda en revisión cartográfica. |
| 9 | Otra cuenta de Topografía | La solicitud ajena no debe aparecer ni permitir registrar visita o descargar evidencia. |

Administración puede capturar y canalizar/asignar. El registro de visita y la carga de evidencia corresponden exclusivamente al topógrafo asignado. Captura puede recibir solicitudes; Ventanilla inicia su canalización. Los demás lectores conservan acceso de consulta según sus permisos. Caja no tiene acceso a estas fichas.

No se permite saltar las canalizaciones, repetir una transición ya realizada ni modificar solicitudes cerradas. Cada cambio registra el usuario autenticado, etapa y área anterior/nueva. Los movimientos y datos de cada operación se guardan en la misma transacción.

## Base de datos

Aplicar `sql/enable_recepcion_inicial.sql` con un usuario administrador sobre la base SIGEP, después de las migraciones existentes de expedientes y usuarios. La interfaz completa usa también las migraciones anteriores de documentos y mediciones.

La migración agrega:

| Tabla | Cambio |
|---|---|
| `solicitantes` | `nombres`, `primer_apellido`, `segundo_apellido`. Conserva `nombre` completo para compatibilidad con las pantallas y consultas existentes. |
| `expedientes` | Marca `recepcion_inicial`, falsa en los expedientes anteriores. |
| `ubicaciones_solicitadas` | Ubicación declarada, ligada uno a uno al expediente. No es un predio catastral. |
| `visitas_iniciales` | Canalización, asignación, fecha, responsable, resultado y superficie de la visita inicial. |
| `archivos_visita_inicial` | Metadatos/versiones de evidencia; el archivo físico se conserva en el almacenamiento privado de la API. |

No borra registros anteriores ni intenta dividir automáticamente nombres históricos. No cambia la obligatoriedad de clave/geometría en `predios`. No se ha aplicado desde este entorno.

## Activación de esta versión

1. Aplicar la migración anterior en un ambiente de pruebas.
2. Reconstruir la API desde la carpeta `api` de esta misma versión: su Dockerfile ahora copia también `initial-reception.mjs`. Conservar la configuración de conexión y el volumen privado de archivos del despliegue existente.
3. Actualizar la interfaz; en desarrollo reiniciar Vite por el cambio de proxy. En producción publicar la nueva compilación y asegurar que el proxy existente envíe `/api/sigep/solicitudes-titulacion` a la API, igual que las demás rutas.
4. Ejecutar el recorrido de la tabla con cuentas activas. No hace falta borrar ni reiniciar usuarios.

La API informa que falta aplicar la migración si encuentra tablas/columnas/permisos ausentes. No se ejecutó push ni se reemplazó el contenedor desde este entorno.

## Validación y límites

`tests/initial-reception.test.js` ejecuta el router real con respuestas SQL y almacenamiento simulados. Cubre recepción sin predio/documentos, nombres separados, campos obligatorios, roles, canalizaciones, topógrafo asignado, fechas/superficie, bloqueo de expedientes cerrados, historial y reversión ante fallos, evidencia/descarga y reglas del proxy de Vite. Las pruebas previas siguen cubriendo el flujo basado en predios existentes.

No equivale a una prueba de navegador ni a validar restricciones/permisos contra PostgreSQL real. El entorno negó conexiones locales a la API y a Vite; el recorrido manual queda por hacer en el ambiente de pruebas antes de recomendarlo como listo para el equipo.

Este incremento llega hasta **visita registrada y revisión cartográfica pendiente**. Aún falta la pantalla para que Cartografía concilie o cree el predio definitivo y lo vincule al mismo expediente, así como reprogramaciones/incidencias y el resto de revisiones hasta la expedición/entrega del título. No se debe abrir un segundo expediente para continuar el caso.

La ubicación sigue guardada en campos de texto; los nombres de municipio/localidad todavía no se validan contra catálogos. Los propietarios catastrales y las personas históricas conservan su estructura anterior. Esto no constituye una normalización integral de toda la base.
