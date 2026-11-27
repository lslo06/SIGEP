# Auditoría de requisitos y roles — 19 de noviembre de 2026

> Auditoría histórica de una versión anterior. Para evaluar el proyecto actual usar [Comparación de requisitos del 26 de noviembre](comparacion-requisitos-2026-11-26.md), que contempla usuarios, permisos compartidos, documentos y recepción inicial implementados después de este corte.

Base de código: e6d50c8. Revisión estática de la aplicación activa, rutas de API, migraciones y pruebas. No se inspeccionó la configuración actual de producción ni se ejecutaron escrituras en HomeLab.

Fuentes funcionales leídas en `../archivos_sigep`: `SGFL_Documento_Requerimientos_v1.0.docx` (versión 1.0, 20/08/2026, propuesta para validación) y `PROCESOS DE FUNDOS LEGALES.pptx` (ambos procesos). Los SQL históricos no acreditan una función si no existe un flujo conectado en la aplicación actual. Los Excel de datos no sustituyen la especificación.

## Resultado

El MVP todavía no cumple los criterios de aceptación de punta a punta. Hay núcleo de expedientes, mediciones, pagos, adjuntos técnicos y dictamen. Faltan gestión documental general, transiciones con requisitos y pagos, autorizaciones, titulación externa, entrega y reportes operativos completos.

“Implementado” significa encontrado en el código; no certifica aceptación funcional ni despliegue. “Parcial” indica un subconjunto. “Pendiente” indica que no se encontró el flujo operativo requerido.

## Matriz funcional

| ID | Estado | Evidencia o brecha |
|---|---|---|
| RF-001 | Implementado | Credenciales individuales, hash y sesiones locales. |
| RF-002 | Parcial | Permisos de API por rol; faltan varias acciones de negocio y separación de geometría/captura. |
| RF-003 | Implementado | Activación, desactivación y cambio de rol sin borrar usuario; falta auditoría administrativa individual. |
| RF-004 | Pendiente | Catálogos de trámites, conceptos y roles definidos en código; no administración completa de catálogos. |
| RF-005 | Parcial | Historial en altas, pagos, medición, geometría, adjuntos y dictamen; no bitácora completa de sesiones y administración. |
| RF-006 | Implementado | Folio generado y restricción UNIQUE. |
| RF-007 | Implementado | Solicitante, contacto y representante en alta. |
| RF-008 | Implementado | Predios vinculados e identificadores. |
| RF-009 | Implementado | Búsqueda con filtros; máximo 100 resultados y aviso de más resultados. |
| RF-010 | Parcial | Historial con fecha, actor, área y observaciones; no integra todas las etapas/documentos requeridos. |
| RF-011 | Parcial | Observación inicial y de operaciones; falta flujo de prevención y respuesta. |
| RF-012 | Pendiente | No hay cierre operativo con verificación de requisitos. |
| RF-013 | Pendiente | Sin listas configurables por trámite. |
| RF-014 | Pendiente | Sin checklist operativo de los cinco documentos de titulación. |
| RF-015 | Parcial | Hay identificación y domicilio; falta gestión de solicitud firmada y requisitos de búsqueda. |
| RF-016 | Parcial | Carga de evidencia de visita y plano, no documentación general por etapa. |
| RF-017 | Parcial | Versiones para adjuntos técnicos; no todas las clases documentales. |
| RF-018 | Parcial | Descarga privada de adjuntos técnicos; roles documentales y vista previa incompletos. |
| RF-019 | Pendiente | Sin aceptar/rechazar documentos con usuario, fecha y motivo. |
| RF-020 | Implementado | Confirmación medido o solicitud de medición. |
| RF-021 | Implementado | Solicitud en bandeja de campo; etapa principal del expediente no cambia. |
| RF-022 | Implementado | Topógrafo activo, asignación, compromiso y registro histórico. |
| RF-023 | Implementado | Visita, superficie, observaciones, referencia y archivo del topógrafo asignado; validar detalle de medidas con usuarios. |
| RF-024 | Implementado con observaciones | Geometría con historial y carga de plano; Captura también puede modificar geometría por permiso compartido. |
| RF-025 | Parcial | TXT preliminar y cálculo local; no registro persistente de cédula/valores. |
| RF-026 | Parcial | Conceptos al registrar un pago; falta configurar conceptos exigibles por trámite. |
| RF-027 | Parcial | Recibo, importe, fecha y referencia de evidencia; no carga general de comprobantes. |
| RF-028 | Implementado | Distingue lote, servicios, búsqueda y documento solicitado. |
| RF-029 | Pendiente | Dictamen no comprueba pago previo; sin controles generales de avance ni excepción motivada. |
| RF-030 | Pendiente | Consulta de propietarios no equivale a captura/revisión de propietarios y valores del expediente. |
| RF-031 | Pendiente | Sin validación registrada contra expediente y cartografía. |
| RF-032 | Parcial | Plano adjunto y consulta de títulos existentes; no generación/registro completo de título en el flujo. |
| RF-033 | Pendiente | Sin revisión formal del título antes de envío. |
| RF-034 | Pendiente | Sin operación de oficio/envío a Consejería. |
| RF-035 | Pendiente | Sin hitos de recepción, firma y retorno de Consejería. |
| RF-036 | Pendiente | Sin envío a RPP con documentos, folio y fecha. |
| RF-037 | Pendiente | Sin registro de inscripción y título inscrito adjunto. |
| RF-038 | Pendiente | Sin afectación final ligada al cierre. |
| RF-039 | Pendiente | El borrador de acuse es para búsqueda; no cubre entrega de título, plano y cédula. |
| RF-040 | Pendiente | Sin ceremonia/entrega y envío a archivo registrados. |
| RF-041 | Implementado | Cuatro tipos de certificación/constancia. |
| RF-042 | Implementado | Legal, motivo, decisión y movimiento en transacción; no duplicación. |
| RF-043 | Parcial | TXT de borrador con espacios vacíos, no plantilla institucional. |
| RF-044 | Pendiente | Sin revisión de Jefatura ni autorización de Dirección persistidas. |
| RF-045 | Parcial | Borrador de acuse, sin guardar receptor, fecha y evidencia de entrega. |
| RF-046 | Parcial | Campo sí limita por topógrafo; Inicio muestra lista general, no bandeja por usuario/área. |
| RF-047 | Pendiente | Sin cómputo operativo de permanencia por etapa; Inicio pone espera vacía. |
| RF-048 | Parcial | Compromiso en campo; sin configuración general de alertas y vencimientos. |
| RF-049 | Parcial | Histórico con búsqueda textual; sin todos los filtros requeridos ni paginación. |
| RF-050 | Pendiente | Sin tiempos promedio por etapa y resolución. |
| RF-051 | Parcial | CSV limitado al listado cargado y print de pantalla; sin documentos institucionales PDF. |
| RF-052 | Parcial | Tablero genérico, sin todos los estados y tiempos; totales basados en lista limitada. |

## Roles: especificación frente a implementación

La especificación enumera 13 roles. La API admite esos 13 más Finanzas. La interfaz conserva también etiquetas heredadas owner/editor, excluidas del formulario administrativo y no admitidas por usuarios_locales. No son tres administradores operativos equivalentes.

| Rol | Operación actual | Brecha principal |
|---|---|---|
| Administración | Módulos, altas, pagos, asignación y planos; administración con clave separada | Catálogos y auditoría de administración incompletos. |
| Ventanilla | Alta de expediente, consulta, medido/solicitud | Requisitos, prevención, conceptos exigibles y entrega. |
| Dirección | Inicio, seguimiento e histórico | Canalizar, autorizar y registrar envíos. |
| Jefatura | Inicio, seguimiento e histórico | Revisar, asignar y validar formalmente. |
| Legal | Consulta y dictamen en certificaciones/constancias | Documentos institucionales, acceso documental y apoyo jurídico trazable en titulación. |
| Cartografía y Valuación | Alta de predio, geometría, asignación, plano, cédula preliminar | Valores/cédula persistidos y avance de etapa. |
| Topografía | Campo asignado, visita y evidencia; consulta de lotes | Delimitar consulta de predios según política; conservar la restricción de escritura por asignación. |
| Caja | Consulta y registro de pagos | Evidencia documental y conceptos exigibles. |
| Finanzas (extra) | Solo consulta de pagos | Confirmar extensión del alcance; distinto de Caja por no escribir. |
| Digitalización | Inicio y seguimiento | No puede cargar documentos: falta su función principal. |
| Captura | Alta de predio/expediente y consultas | No captura/revisa valores y propietarios; permiso de geometría demasiado amplio respecto a su función descrita. |
| Titulación | Inicio, seguimiento, lotes y consulta de títulos | No valida, emite, envía, registra RPP ni cierra; no accede a adjuntos por las rutas actuales. |
| Informática | Inicio y lotes | No tiene seguimiento del expediente ni validación registrada contra BD/cartografía. |
| Consulta/Auditor | Seguimiento, lotes e histórico | No puede consultar adjuntos, aunque su función incluye documentos autorizados. |

## Hallazgos de interfaz y autorización

1. `src/App.jsx`: DetailsDialog no recibe rol y dibuja siempre título, costos, gobierno, municipio, RPP y firmas, incluso para constancias. Muchos valores proceden de emptyFile y nunca se rellenan con la respuesta resumida. Muestra campos vacíos como si fueran información del expediente.
2. `src/App.jsx`: Mi bandeja no filtra por usuario/área. Las tarjetas de pagos y títulos aparecen aunque el rol no pueda abrir esos módulos. El contador de trabajo de campo busca área Topografía, pero registrar mediciones conserva el área principal anterior.
3. `src/components/map/ExpedienteSearch.jsx`: inserta medición para cualquier expediente de titulación independientemente del rol; deshabilitar escritura no equivale a presentar una ficha pertinente. Los borradores de documento no reciben rol y aparecen a cualquier lector de un expediente con dictamen favorable.
4. `api/server.mjs`: routePermission reutiliza altaPredio para correcciones geométricas. Captura queda habilitada para esa escritura; separar alta, edición de datos y corrección cartográfica.
5. `api/server.mjs` y `api/attachments.mjs`: lectura documental restringida a admin/cartografia/topografia. Legal, Digitalización, Titulación y Auditor no tienen el acceso necesario para su trabajo. Ampliar por tipo documental y expediente autorizado, no abrir indiscriminadamente.
6. Plano permite admin además de cartografia. El README dice “solo Cartografía”, pero el requisito RF-024 no afirma exclusividad. Resolver la política de excepción administrativa antes de cambiarla; no es incumplimiento literal demostrado del DOCX.
7. `src/lib/permissions.js` y `src/lib/routes.js` son una política antigua, diferente a localPermissions de la API y a la navegación activa de App. Parte de las pruebas valida esos auxiliares y no la matriz activa.
8. `tests/permissions.test.js` exige excluir TIT-02/03/04/05/15. El documento incluye expresamente esas etapas. Están parcialmente implementadas aparte, pero el test no valida la integración del flujo exigido.
9. Administración se autentica con SIGEP_ADMIN_KEY antes de resolver sesión individual. Protege con un secreto, pero no identifica al administrador concreto para RF-005; no equivale a acceso anónimo sin clave.
10. `ModuleWorkspace.jsx` usa AlertCircle sin importarlo; falla la presentación de errores.
11. `FieldWorkspace.jsx` no pasa predio/folio a ExpedienteMedicion; la cédula preliminar solo está conectada desde Seguimiento.

## No funcionales y aceptación

- RNF-004 y RNF-011: existen hash de contraseña y almacenamiento privado externo a PostgreSQL para adjuntos técnicos.
- RNF-003: el despliegue mostrado usa HTTP local transportado por SSH; el túnel cifra ese tramo, pero no demuestra cumplimiento literal de HTTPS en toda comunicación.
- RNF-001/002/007/010: falta evidencia de disponibilidad, carga/tiempos, respaldo periódico con restauración probada y matriz de navegadores. Conservar un contenedor anterior no respalda BD ni volumen documental.
- RNF-005/006/008/015: parciales por permisos, auditoría y flujos incompletos; hay transacciones en operaciones implementadas.
- RNF-009/012/013/014: interfaz web y logs técnicos presentes; faltan aceptación de usabilidad, parametrización y separación mayor de reglas/SQL del servidor monolítico.
- CA-01 y CA-04 tienen implementación base; CA-02/05/06/08/09/10/11/12 son parciales. CA-03 y CA-07 no están completos. CA-13/14/15 requieren pruebas, recuperación, manuales y evidencia de aceptación/capacitación que no se encontró en el checkout.

## Orden de trabajo propuesto

1. Unificar matriz de permisos de servidor, navegación y pruebas; separar lectura/escritura, corrección geométrica y revisión/autorización. Mantener los roles institucionales y confirmar Finanzas como ampliación.
2. Ficha única con datos comunes y secciones por tipo de trámite, etapa y permiso. Bandejas realmente filtradas; ocultar accesos que no se pueden abrir.
3. Gestión documental y checklist configurables con revisión y versiones; habilitar Digitalización y los lectores autorizados.
4. Transiciones con requisitos, pagos y auditoría; canalización, Legal, Jefatura, Dirección y entrega.
5. Titulación/Consejería/RPP, cédula y valores persistidos, entrega y archivo.
6. Indicadores, exportación completa, respaldos/restauración, pruebas integrales por rol y aceptación institucional.

No se cambió código funcional ni permisos en esta auditoría.
