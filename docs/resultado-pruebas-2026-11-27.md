# SIGEP — Resultados de pruebas y cambios del 27/11/2026

Fecha: 27 de noviembre de 2026, Ciudad de México. Base del checkout: `dbba8680868979fb782d41c415e32ccde30cd89d`, más cambios locales. No se hizo push ni despliegue. Este informe actualiza el corte del [26/11](comparacion-requisitos-2026-11-26.md), sin recalcular sus porcentajes de requisitos.

## Resultado y alcance

**86 pruebas automatizadas aprobadas, 0 fallidas.** Compilación de producción comprobada con `npm run build`. La suite inicial tenía 71 casos; se amplió la cobertura de recorrido, permisos, rechazos y fallos transaccionales.

Las pruebas llaman controladores y enrutadores reales con consultas SQL y almacenamiento de negocio simulados. Los casos de vista renderizan JSX real en servidor, sin navegador ni efectos. El verificador de instalación se prueba con consultas simuladas y archivos temporales reales. Esto comprueba reglas y manejo de errores, pero no demuestra que PostgreSQL, Docker, QGIS o el proxy real estén correctamente configurados.

No se obtuvo acceso utilizable al HomeLab desde este entorno; las comprobaciones de red intentadas fueron bloqueadas por las restricciones del entorno. No se insertaron expedientes reales ni se modificaron cuentas/volúmenes del servidor. El HTTP 200 aportado por Eduardo corresponde a la versión previamente desplegada, no a todos los cambios de este informe.

## Casos ejecutados

| Área de la guía | Cobertura automatizada | Pendiente de aceptación real |
|---|---|---|
| A01–A09: recepción y visita | Nombres separados, ubicación sin predio/documentos, folio, canalización por áreas, asignación, visita y evidencia con actor. | Interacción en navegador y persistencia en PostgreSQL. |
| A10: mismo folio | Vinculación de predio válido, conservación de visita/evidencia/superficie, permisos y rechazo repetido. | Geometría real PostGIS, cotejo cartográfico humano. |
| A11 y B: integración | Visita transferida al circuito existente; regresión de medición/plano y captura/revisión catastral. | Recorrido combinado visual, comparación de archivos y recarga de pantalla. |
| N: validaciones | Datos mínimos, un solo apellido, rol incorrecto, etapa repetida, topógrafo ajeno, fechas/superficie, tamaño/formato y fallos de auditoría. | Permisos SQL y concurrencia en motor real; descargas mediante proxy. |
| D: documentos | Estado pendiente/aceptado/rechazado, lectura restringida, versiones, cierre concurrente, transacción e historial. | Volumen persistente, versiones reales y criterio documental del área. |
| P: pagos | Actor de sesión, duplicado, inválidos, cierre y rollback de pago/historial; solicitante y referencia en consulta. | Operación visual de Caja; no hay validación bancaria. |
| C: Legal | Los cuatro tipos admitidos, procede/no procede, rol/motivo, duplicados, rollback y rechazo de búsqueda genérica. | Formatos y firmas oficiales; autorizaciones posteriores. |
| U: usuarios | Autenticación, revocación, restricciones, gestión y protección del último administrador. | Sesión HTTPS/proxy y prueba de cada menú con cuentas reales de prueba. |
| Instalación | Verificador: faltantes de esquema/permisos, errores sin secretos, prueba de escritura/lectura/limpieza. | Ejecutarlo en el contenedor, construir imagen y ensayar restauración. |

## Errores y ajustes realizados

1. **Se interrumpía el recorrido tras la visita inicial.** Se agregó vinculación del predio identificado al mismo folio por Cartografía/Administración. Exige visita registrada, evidencia, predio existente y polígono válido. Conserva la evidencia original, copia la referencia de medición al circuito de predios vinculados y registra el movimiento en una transacción. No altera automáticamente geometría ni superficie del predio.
2. **Captura e Informática no coincidían con las responsabilidades catastrales previstas.** Captura ahora guarda datos pendientes sin aprobarlos; Informática los consulta sin editarlos. La revisión queda en Cartografía/Administración. Se comprobaron permisos en la API y representación de la sección.
3. **La bandeja mezclaba trabajo y mostraba indicadores sin respaldo suficiente.** Mi área usa el rol autenticado para filtrar pendientes; se conserva Consulta general. Se eliminan indicadores no sustentados y se aclara que los conteos son de registros cargados. La búsqueda de ubicación incluye también la declaración inicial.
4. **Documentación no auditaba de forma completa carga/revisión y admitía riesgo de cambio tras cierre concurrente.** Se agregan transacción, bloqueo del expediente y movimiento con actor; un fallo de historial revierte el cambio. La interfaz oculta escrituras en expedientes cerrados.
5. **Un documento general podía quedar sin una FK directa válida al expediente al ser nulo el predio.** Se agrega `sql/enable_document_integrity.sql`: valida integridad sin borrar huérfanos. Pendiente de ejecutar en PostgreSQL real.
6. **Pagos mostraba “Válido” sin validación bancaria y un dato no devuelto por la consulta.** Ahora muestra “Registrado”, solicitante y referencia del comprobante. Se explica que la referencia es texto, no carga de archivo.
7. **La API permitía dictamen para búsqueda genérica aunque la interfaz lo reservaba a cuatro tipos.** Se limita a certificaciones/constancias admitidas; la prueba nueva detectó la falla antes de corregirla.
8. **Había textos ambiguos.** Identificación ahora pide el tipo de documento presentado, opcional, con ejemplo y explicación de la carga posterior. Se distingue la identificación del representante. Fecha de cédula e importes MXN se explicitan, y la recepción aclara el mínimo de un apellido.
9. **Faltaba una comprobación operativa más útil que `/health`.** Se agregó `api/check-installation.mjs`, incluido en la imagen, para revisar esquema principal, permisos, secuencias, administrador activo y volumen. No sustituye pruebas funcionales ni de recuperación. Se conserva la corrección del Dockerfile que normaliza permisos para lectura por `node`.

## Información: qué está resuelto y qué falta

| Tema | Estado actual |
|---|---|
| Nombres separados en recepción desde cero | Implementado en formulario y columnas `nombres`, `primer_apellido`, `segundo_apellido`. |
| Formularios anteriores / históricos | Siguen usando nombre completo; no se dividieron nombres históricos automáticamente. |
| Identificación | Etiqueta y ayuda aclaradas. Sigue siendo texto libre opcional, no un catálogo normalizado de tipos/números/autoridades. |
| Solicitud sin documentos | Permitida; no equivale a acreditar propiedad. |
| Requisitos definitivos | Checklist configurable existente; falta validación institucional de documento, condiciones, etapa y responsable. |
| Solicitante / propietario | Se distinguen en la recepción y pagos; la cédula registra lo documentado. Falta completar conciliación y validación integral. |

Separar nombres mejora la estructura de un dato, pero no significa que toda la base haya completado su normalización. Faltan el esquema base canónico de instalación y la conciliación con estructuras históricas.

## Cómo verificar y desplegar este incremento

En el código local: `npm test` y `npm run build`. La evidencia de consola de esta ejecución se conserva localmente en `.sgfl-test-tools/pruebas-2026-11-27.log` (carpeta ignorada).

Para publicar: incluir los archivos nuevos junto con los modificados, construir la API y el frontend de la misma versión, respaldar BD/archivos y aplicar sólo migraciones pendientes. La nueva migración de este incremento es `sql/enable_document_integrity.sql`; la recepción depende de `enable_recepcion_inicial.sql` y las migraciones anteriores. No ejecutar `reset_demo_users.sql`.

Tras desplegar, ejecutar `docker exec -w /app sigep-predio-api node check-installation.mjs` y completar [A01–A11 y rechazos](pruebas-equipo-desde-cero.md). Un verificador correcto no convierte en aprobado un caso manual no ejecutado.

## Orden recomendado para continuar

1. Desplegar este incremento en pruebas; ejecutar el circuito con cuentas por rol y archivos ficticios.
2. Validar institucionalmente visibilidad de datos, responsables de revisión documental, identificación y requisitos por etapa. La consulta general es amplia; Mi área no constituye aislamiento de datos.
3. Cerrar integración y revisión cartográfica/catastral, diferencias de superficie y condiciones de avance.
4. Completar validaciones de pago, revisión de Informática, titulación y autorizaciones siguientes según requisitos.
5. Integrar plantillas oficiales, Consejería/RPP y entrega con acuse; probar el trámite completo.
6. Consolidar instalación reproducible: esquema base/catálogos, imágenes/versiones, proyecto QGIS con tres fondos, configuración de intranet, respaldo y restauración probados.

Entregables iniciados: [Manual de usuario](manual-usuario.md) y [Manual de instalación](manual-instalacion.md). Son borradores verificables contra el código, no una certificación de puesta en producción.
