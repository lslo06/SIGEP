# SIGEP: comparación del proyecto con los requisitos

Fecha de corte: 26 de noviembre de 2026, Ciudad de México.

**Actualización posterior:** consultar [Resultados y cambios del 27/11](resultado-pruebas-2026-11-27.md). El código local ya incorpora vinculación de predio al mismo folio y ajustes de roles/documentación. Las cifras y pendientes de este documento describen el corte del 26/11; no deben leerse como estado actualizado de esos cambios.

## Dictamen del avance

**Está disponible para pruebas la recepción de una solicitud de título desde cero, hasta registrar la visita y evidencia del topógrafo. No está terminado el trámite completo hasta emitir, inscribir y entregar un título de propiedad.**

El recorrido nuevo conserva el mismo expediente al pasar por Ventanilla, Dirección, Jefatura, Cartografía y Topografía. Al terminar la visita queda pendiente de revisión cartográfica. Todavía falta convertir o vincular esa ubicación declarada con un predio definitivo dentro del mismo expediente. Las funciones existentes de plano y cédula trabajan con predios ya vinculados; su existencia no resuelve automáticamente esa conexión.

También hay funciones probables de reutilizar después de ese punto: documentos y versiones, revisión documental, pagos, datos catastrales, geometría, búsqueda e historial. Deben probarse como componentes o como recorrido de predio existente, sin presentarlos como una titulación completa.

## Fuentes y evidencia

- Fuente principal: `C:\Proyectos\SIGEP\archivos_sigep\SGFL_Documento_Requerimientos_v1.0.docx`, versión 1.0 del 20/08/2026. Contiene **52 RF, 14 RN, 15 RNF y 15 criterios de aceptación**. El propio documento está marcado como propuesta para validación funcional y técnica.
- Fuente de proceso: `C:\Proyectos\SIGEP\archivos_sigep\PROCESOS DE FUNDOS LEGALES.pptx`. Se revisaron sus dos diapositivas: titulación y búsqueda de información. El Word agrupa la titulación en 17 etapas; la presentación detalla 27. Son niveles distintos del proceso, no cantidades de funciones completadas.
- Código: commit local `dbba8680868979fb782d41c415e32ccde30cd89d`, más los cambios locales presentes en `api/Dockerfile`, `src/modules/MapWorkspace.jsx` y `tests/initial-reception.test.js`. Estos cambios locales no deben suponerse publicados por existir en esta carpeta.
- Pruebas ejecutadas en esta revisión: `node --test tests/*.test.js`: **71 aprobadas, 0 fallidas**. `npm run build`: compilación correcta.
- Los tests usan controladores reales con respuestas SQL y almacenamiento simulados. No sustituyen una prueba de navegador ni una prueba de restricciones y permisos de PostgreSQL real.
- Evidencia aportada por Eduardo: migración `enable_recepcion_inicial.sql` con `COMMIT`; lectura del código como UID 1000; nuevo contenedor respondiendo `HTTP 200` y `{"status":"ok"}`. El controlador `/health` también ejecuta `SELECT 1`, por lo que esa respuesta acredita conectividad básica con la BD en ese momento.
- No se accedió desde esta revisión al servidor ni se ejecutó allí un expediente real. El health check no certifica todas las migraciones, permisos SQL, almacenamiento documental, frontend ni aceptación de las áreas.
- Esta comparación usa los documentos locales anteriores y el caso desde cero aclarado por Eduardo. No atribuye nuevos acuerdos a una minuta de reunión no revisada en esta auditoría.

Guía de ejecución: [Pruebas del equipo desde cero](pruebas-equipo-desde-cero.md).

## Cómo interpretar los estados

- **I — Implementado para prueba:** existe un recorrido funcional identificable en código para ese requisito. Falta aceptación manual en el ambiente compartido; no equivale a aprobación institucional.
- **P — Parcial:** existe una parte, pero falta completar datos, acciones, controles o conexión con el recorrido principal.
- **N — Pendiente:** no se encontró un recorrido operativo que resuelva el requisito. Una etiqueta, un estado declarado o un archivo de configuración no cuenta como implementación.
- **V — Por verificar:** se necesita evidencia de infraestructura, carga, operación o aceptación que el código no aporta. Se usa para requisitos no funcionales y criterios de aceptación.

No se calcula un porcentaje de terminación: autenticar y completar la inscripción del título tienen esfuerzos e impactos distintos.

Resultado de la matriz funcional: **17 RF implementados para prueba, 20 parciales y 15 pendientes**. Son categorías de esta revisión, no requisitos aceptados formalmente ni porcentajes de esfuerzo restante.

## Referencias del código

| Referencia | Archivos / comportamiento revisado |
|---|---|
| A | [API principal](../api/server.mjs): sesiones, expedientes, búsqueda, pagos, dictamen, documentos, catastro, geometría y rutas. |
| U | [Usuarios](../api/users.mjs), [permisos compartidos](../api/permissions.mjs), [administración](../src/modules/LocalAdministration.jsx). |
| R | [Recepción inicial API](../api/initial-reception.mjs), [formulario](../src/components/initial-reception/SolicitudTituloCreate.jsx), [bandeja y visita](../src/components/initial-reception/InitialReception.jsx), [migración](../sql/enable_recepcion_inicial.sql). |
| D | [Documentación y catastro](../src/components/map/ExpedienteDocumentacion.jsx), [archivos](../api/attachments.mjs), [migración documental](../sql/create_archivos_expediente.sql). |
| M | [Medición de predio vinculado](../src/components/map/ExpedienteMedicion.jsx), [campo](../src/modules/FieldWorkspace.jsx), [mapa](../src/modules/MapWorkspace.jsx), rutas de medición/geometría/archivos en A. |
| P | [Pagos](../src/modules/PaymentsWorkspace.jsx) y `pagosExpediente` en A. |
| B | [Alta desde predio](../src/components/map/ExpedienteCreate.jsx), [dictamen](../src/components/map/ExpedienteDictamen.jsx), [borradores](../src/components/map/ExpedienteBorradores.jsx). |
| S | [Buscador](../src/components/map/ExpedienteSearch.jsx), [inicio](../src/App.jsx), [módulos de consulta](../src/modules/ModuleWorkspace.jsx), consultas `catalogQueries` en A. |

## Matriz de los 52 requisitos funcionales

Los nombres se resumen; el Word conserva el texto completo de cada requisito.

| ID | Requisito | Estado | Evidencia y límite actual |
|---|---|:---:|---|
| RF-001 | Autenticación individual | I | A/U: sesiones locales, contraseña con hash, cierre de sesión y comprobación de usuario activo. |
| RF-002 | Permisos por rol y área | P | U: 13 roles y permisos compartidos entre API e interfaz; control de acciones y asignación inicial. Faltan funciones y alcances por área del proceso completo. |
| RF-003 | Activar, desactivar y reasignar usuarios conservando historial | I | U: alta, edición, cambio de rol y baja lógica; revoca sesiones y protege al último administrador. |
| RF-004 | Administración de catálogos | P | D/U: requisitos configurables y usuarios. Varios catálogos son consultas o listas fijas; faltan mantenimiento de tipos, conceptos, estados, localidades, motivos y áreas. |
| RF-005 | Bitácora de todas las operaciones críticas | P | A/R/U: movimientos de recepción, canalización, visita, pagos, geometría y usuarios. No hay cobertura completa de inicios de sesión, revisiones documentales/catastrales, autorizaciones y cierre. |
| RF-006 | Folio único por expediente | I | A/R y `create_expedientes.sql`: secuencia y unicidad de folio; alta transaccional. |
| RF-007 | Solicitante, representante y contacto | P | R captura nombres separados y contacto. El formulario antiguo B incluye representante; el nuevo no expone representante ni identificación, aunque la API admite esos datos. |
| RF-008 | Ubicación e identificación del predio | P | R registra municipio, localidad, dirección y referencias sin predio previo. A/B vinculan predio existente; falta vincular el definitivo después de la visita inicial. |
| RF-009 | Búsqueda por folio, persona, predio, ubicación, título, estado y fechas | P | A/S tienen filtros de expediente y predios vinculados. El filtro de ubicación no consulta `ubicaciones_solicitadas`; una solicitud nueva debe localizarse por folio o solicitante. |
| RF-010 | Línea de tiempo completa | P | A/S muestran movimientos con actor, fecha y áreas. No todos los cambios documentales/catastrales ni todas las etapas generan eventos; los documentos se consultan en sección separada. |
| RF-011 | Observaciones y prevenciones al ciudadano | P | A/R permiten observaciones; falta prevención formal con causa, requisitos a subsanar, plazo, notificación y respuesta. |
| RF-012 | Bloquear cierre con requisitos pendientes | N | No existe cierre operativo con validación integral de requisitos obligatorios. La ausencia de botón de cierre no implementa esta regla. |
| RF-013 | Checklist configurable por trámite | I | D/A: Administración modifica la lista activa por tipo; conserva entradas desactivadas. Falta ampliar el modelo para reglas de obligatoriedad/etapa, cubiertas como pendiente en RN-14/RF-012. |
| RF-014 | Cinco documentos mínimos de titulación | I | D: catálogo inicial con solicitud, constancia de posesión, identificación, acta y comprobante. Su presencia no obliga a entregarlos en recepción ni valida el contenido por sí sola. |
| RF-015 | Documentos y contenido mínimo de búsqueda | P | D: identificación y solicitud escrita. No se controla integralmente domicilio, motivo y firma/representación de esa solicitud. |
| RF-016 | Cargar, clasificar y asociar documentos a etapa | I | D/A: PDF, PNG y JPEG hasta 10 MB, requisito y etapa, almacenamiento privado y metadatos. Las etapas disponibles son una lista fija. |
| RF-017 | Versiones al sustituir archivos | I | D/A/R: nuevas cargas numeradas, conservación de archivos previos y restricciones de unicidad. |
| RF-018 | Visualizar y descargar según permisos | I | D/A: vista y descarga autenticadas; roles lectores acceden a documentos generales aceptados. Evidencia y plano técnico tienen reglas propias. |
| RF-019 | Revisar, rechazar o dejar pendiente | I | D/A: estado, revisor, fecha y motivo obligatorio al rechazar. Guarda la última revisión; un historial completo de revisiones queda en RF-005. |
| RF-020 | Condición medido/no medido | I | M/A: consulta/registro de condición en el circuito de predio vinculado. R conserva la ubicación inicial pendiente de identificación. |
| RF-021 | Solicitar medición y canalizar | I | R: solicitud sin predio, Dirección, Jefatura y Cartografía. M: solicitud para predio existente. Se inicia con una acción explícita del operador. |
| RF-022 | Topógrafo y fecha compromiso | I | R/M: asignación a cuenta activa de Topografía y fecha; verificación de permisos. Reprogramaciones e incidencias siguen pendientes. |
| RF-023 | Visita, mediciones, observaciones y evidencia | I | R/M: fecha, superficie positiva en m², observaciones y archivos; escritura restringida al topógrafo asignado. No incluye levantamiento estructurado de vértices, método e incidencias. |
| RF-024 | Actualización cartográfica y plano | P | A/M: geometría auditada y carga de plano con predio vinculado. Falta continuar desde la visita inicial y conciliar formalmente superficie medida/calculada/validada. |
| RF-025 | Cédula y valores asociados | P | D/A: folio, fecha, valores, propietarios y revisión. B ofrece TXT preliminar. Falta cédula institucional final y su relación inequívoca con el documento emitido. |
| RF-026 | Conceptos exigibles por trámite | P | P/A: cuatro conceptos al registrar pago. Falta orden de pago y catálogo que determine importes, exigibilidad, exenciones o subsidios por procedimiento. |
| RF-027 | Recibo, fecha, importe y evidencia de pago | I | P/A: captura y transacción con movimiento; duplicados controlados. La evidencia es una referencia de texto, no un archivo cargado desde Caja ni una verificación bancaria. |
| RF-028 | Distinguir tipos de pago | I | P/A: lote, servicios catastrales, búsqueda de información y documento solicitado. |
| RF-029 | Bloquear avance sin pago o excepción autorizada | N | No hay control de avance por saldo/pago validado ni autorización excepcional motivada. |
| RF-030 | Captura/revisión de propietarios y valores | P | D/A: existe con Cartografía/Administración. El rol Captura sólo consulta estos datos; falta separar captura, revisión y normalizar propietarios. |
| RF-031 | Validación contra expediente y cartografía | N | Informática y Titulación no tienen aprobación/devolución formal con evidencias y resultado persistido. Consultar el mapa no satisface esta validación. |
| RF-032 | Título y plano asociados al expediente | P | M permite plano; S consulta títulos con datos existentes. Falta registrar/generar formalmente el título nuevo, con versión y enlace documental. |
| RF-033 | Revisión del título antes de envío | N | No hay acción ni registro específico que bloquee el envío hasta revisión. |
| RF-034 | Oficio y envío a Consejería | N | Faltan número de oficio, destinatario, fecha, acuse y transición operativa. |
| RF-035 | Recepción, firmas y retorno de Consejería | N | Faltan hitos persistidos y gestión de devolución/observaciones. |
| RF-036 | Envío al RPP | N | Faltan paquete documental, folio, fecha y seguimiento. |
| RF-037 | Datos de inscripción y título inscrito | N | La carga genérica de un archivo no registra una inscripción; faltan datos, control y vínculo del documento inscrito. |
| RF-038 | Afectación final de la BD | N | Falta operación transaccional que consolide datos aprobados, marque afectación y habilite cierre. |
| RF-039 | Acuse de entrega de título, plano y cédula | N | No hay acuse formal para primera titulación. El TXT de B corresponde a borradores de búsqueda, sin entrega registrada. |
| RF-040 | Ceremonia/entrega y archivo | N | Faltan fecha, receptor, constancia de entrega, responsable y transferencia a archivo. |
| RF-041 | Seleccionar cuatro certificaciones/constancias | I | B/A/D: cuatro tipos diferenciados con requisitos. El alta actual de esta ruta se hace sobre un predio existente. |
| RF-042 | Dictamen Legal procede/no procede | I | B/A: sólo Legal, motivo obligatorio, transacción con movimiento; limitado a los cuatro tipos anteriores. No es el dictamen de primera titulación. |
| RF-043 | Documento con plantilla institucional | P | B descarga un TXT de preparación después de proceder. Falta plantilla aprobada, generación formal, versión y almacenamiento del resultado. |
| RF-044 | Revisión Jefatura y autorización Dirección | N | No existe circuito formal de autorización del documento de búsqueda. Las canalizaciones iniciales de titulación son otra función. |
| RF-045 | Entrega de certificación/constancia | N | Falta guardar receptor, fecha, acuse y cierre; descargar un borrador no registra entrega. |
| RF-046 | Bandeja por persona/área y prioridad | P | R/M: pendientes iniciales por área y visitas asignadas. Faltan asignación/prioridad del resto del trámite y una bandeja integral. |
| RF-047 | Detectar detenidos y tiempo excedido | N | No hay cálculo operativo confiable de vencimiento por etapa. La columna de espera del inicio se llena vacía desde la consulta actual. |
| RF-048 | Fechas compromiso y alertas | P | R/M permiten compromiso de visita; faltan plazos por etapa, configuración general y alertas. |
| RF-049 | Reportes multidimensionales | P | S: histórico y listados con búsqueda/CSV, limitados a 100 registros. Falta reporte completo por responsable, área, período, tipo y ubicación. |
| RF-050 | Promedios por etapa y resolución | N | No hay cálculo y reporte de tiempos operativos de punta a punta. |
| RF-051 | Exportación CSV/Excel y documentos PDF | P | S exporta CSV e imprime la pantalla. No genera los documentos institucionales PDF ni garantiza exportar todos los resultados del servidor. |
| RF-052 | Tablero de estados y tiempos | P | S muestra conteos básicos. No cubre detenidos, tiempos y todas las métricas; no debe usarse todavía como indicador oficial. |

## Reglas de negocio

| ID | Estado | Evaluación |
|---|:---:|---|
| RN-01 | I | Folio basado en secuencia y unicidad en esquema. |
| RN-02 | P | El recorrido inicial impide saltos, repeticiones y acciones con rol incorrecto. Faltan puertas de documentos/pagos del proceso completo. |
| RN-03 | P | Las transiciones iniciales guardan usuario, fecha, áreas y observaciones en transacción. Faltan transiciones posteriores. |
| RN-04 | P | Subir deja documento pendiente, aceptar es acción separada. Falta obligatoriedad por etapa y una regla consistente para la versión vigente. |
| RN-05 | P | El plano del circuito existente tiene condición de medición; falta conectar la revisión inicial y asegurar el bloqueo transversal de actualización cartográfica. |
| RN-06 | P | Responsable y asignación quedan registrados. Falta un flujo explícito de reasignación/reprogramación con motivos. |
| RN-07 | I | Pago vinculado a concepto, recibo y referencia de evidencia. |
| RN-08 | P | Legal registra motivo y estado no procede. Falta devolución/subsanación y autorización según el procedimiento definitivo. |
| RN-09 | N | No hay circuito completo de revisión/autorización de documentos generados para entrega. |
| RN-10 | N | No existe transición operativa de inscripción con sus validaciones. |
| RN-11 | N | No existe cierre formal condicionado a entrega o motivo autorizado. |
| RN-12 | P | La API no ofrece edición de movimientos y el SQL revisado concede consulta/inserción. Verificar permisos efectivos de BD; las revisiones de documentos conservan sólo su último estado. |
| RN-13 | P | No se exponen borrados operativos de expedientes/archivos; usuarios tienen baja lógica. Falta política completa de archivo, retención y bajas autorizadas. |
| RN-14 | P | Checklist configurable; tipos, etapas y conceptos siguen fijados en código. No hay gestión de plantillas institucionales. |

## Requisitos no funcionales

| ID | Estado | Evidencia / trabajo pendiente |
|---|:---:|---|
| RNF-001 | V | Un health check correcto no acredita disponibilidad de 99%; requiere monitoreo y período de medición. |
| RNF-002 | V | No se ejecutó prueba de carga de búsquedas/fichas menor a 3 segundos sobre datos y concurrencia representativos. |
| RNF-003 | P | Sesiones autenticadas; HTTPS y cookie Secure dependen del despliegue. El HTTP local mostrado no prueba la configuración del acceso institucional. |
| RNF-004 | I | Contraseñas con scrypt y sal; no se guardan en texto plano en usuarios locales. Verificar las cuentas realmente provisionadas. |
| RNF-005 | P | RBAC aplicado en rutas y UI. Falta validar alcance por expediente/área y completar permisos de las funciones pendientes. |
| RNF-006 | P | Hay auditoría en operaciones principales, pero no historial completo e inmutable de cada revisión y catálogo. |
| RNF-007 | P | Se aportó respaldo manual de BD/archivos durante despliegue. Falta periodicidad, retención y restauración completa probada. |
| RNF-008 | P | Transacciones/bloqueos en recepción, movimientos, pagos y cargas; tests simulan rollback. Faltan concurrencia y fallos sobre PostgreSQL real y revisión de todas las operaciones. |
| RNF-009 | V | UI web con ayudas y placeholders; falta aceptación en resoluciones y flujos reales. |
| RNF-010 | V | Build correcto no sustituye prueba en Chrome/Edge institucionales. |
| RNF-011 | I | Archivos privados fuera de BD, metadatos, versiones, hash y acceso autenticado. Falta comprobar carga/descarga en el volumen desplegado. |
| RNF-012 | P | Requisitos configurables, pero un nuevo tipo aún requiere cambios de código y restricciones SQL. |
| RNF-013 | P | Componentes y algunos módulos API separados; muchas reglas, consultas y transporte siguen reunidos en `server.mjs`. |
| RNF-014 | P | Logs técnicos y errores existen; falta correlación de solicitudes, retención y cobertura sistemática de eventos. |
| RNF-015 | P | Autenticación/permisos y archivos privados; falta validación institucional de alcance de acceso, tratamiento y retención de datos personales. |

## Criterios de aceptación del MVP

Ningún criterio se firma como aceptado por las áreas mediante esta revisión de código.

| Criterio | Evaluación actual |
|---|---|
| CA-01 — Crear expediente con folio | Implementado; ejecutar A01–A02 de la guía contra servidor. |
| CA-02 — Ficha integral | Parcial: datos, documentos e historial; pagos en su módulo, vinculación inicial pendiente y responsabilidades incompletas. |
| CA-03 — Titulación completa | Pendiente: se detiene después de visita inicial. |
| CA-04 — Medición/asignación | Base implementada; probar ambos recorridos, inicial y predio existente. |
| CA-05 — Gestión documental | Base implementada; probar cargas reales, versiones, revisión y lectura autorizada. |
| CA-06 — Pago y bloqueo de avance | Parcial: registra pagos; falta exigirlos por etapa. |
| CA-07 — Consejería/RPP | Pendiente. |
| CA-08 — Título, plano, cédula, acuse | Parcial: plano y datos catastrales en circuito existente; no paquete oficial final. |
| CA-09 — Búsqueda completa | Parcial: alta, pago, documentos y dictamen; falta generación, autorización y entrega. |
| CA-10 — Auditoría crítica | Parcial: falta cobertura completa de revisiones, autenticación y etapas posteriores. |
| CA-11 — Restricciones por rol | Base probada automáticamente; requiere matriz de pruebas manuales y completar responsabilidades. |
| CA-12 — Reportes y tiempos | Parcial. |
| CA-13 — Respaldo, logs y recuperación | Parcial; restauración y operación recurrente por verificar. |
| CA-14 — Aceptación sin defectos críticos | Pendiente del equipo y las áreas; no reemplazable por tests automatizados. |
| CA-15 — Manuales y capacitación | Pendiente de entrega/validación. La carpeta contiene material preliminar; el manual de instalación e intranet se pospusieron por indicación de Eduardo. |

## Los 13 roles: qué pueden probar y qué falta

| Rol | Función disponible | Ajuste o función faltante |
|---|---|---|
| Administración | Usuarios, roles, bajas lógicas, checklist y diversas operaciones. | Catálogos/plantillas, parámetros y supervisión completa. No suplantar a Legal ni al topógrafo: sus acciones específicas se prueban con esas cuentas. |
| Ventanilla | Alta desde cero, contacto/ubicación, solicitar medición, consulta y carga documental. | Representación en formulario nuevo, prevención formal, revisión documental según responsabilidad institucional, entrega. Puede consultar mapa; no debe crear/corregir polígonos. |
| Dirección | Canalizar recepción inicial a Fundos Legales, consultas/histórico. | Autorización/firma, control de oficios y documentos para entrega. |
| Jefatura | Canalizar recepción inicial a Cartografía, consultas/histórico. | Revisión formal, devolución, coordinación y visto bueno de instrumentos. |
| Legal | Dictamen motivado de las cuatro certificaciones/constancias. | Apoyo jurídico formal a primera titulación y generación institucional de documentos. |
| Cartografía y Valuación | Asignar visita, crear/corregir predios, plano y datos catastrales de predios vinculados. | Vincular visita inicial al predio definitivo, revisión de levantamiento, superficies, cédula final. |
| Topografía | Visitas asignadas, fecha, superficie, observaciones y evidencia. | Reprogramación, incidencias, visitas incompletas y levantamiento estructurado. |
| Caja / Recaudación | Registrar/consultar pagos y recibos por folio. | Orden de pago, validación real, saldos, exención/subsidio y evidencia documental integrada. |
| Digitalización | Cargar, clasificar, versionar y revisar documentos generales. | Revisar con la institución si le corresponde aceptar contenido o sólo digitalizar; título inscrito y archivo final. |
| Captura | Alta de solicitudes/predios, carga documental, consulta catastral. | Habilitar captura de propietarios y valores con revisión separada; hoy esa escritura está en Cartografía/Admin. Captura puede crear solicitud, pero no tiene la acción inicial de solicitar medición. |
| Titulación | Consulta de expediente, cédula y títulos existentes. | Validación, instrumento oficial, revisiones, Consejería, RPP y afectación final. |
| Informática | Consulta de inicio, trámites y lotes. | Actualmente ni siquiera tiene `lecturaCatastro`; agregar consulta pertinente y aprobación/devolución de consistencia conforme a RF-031. No convertirlo en administrador general para cubrir este hueco. |
| Consulta / Auditoría | Lectura autorizada de trámites, documentos aceptados e histórico. | Reportes completos y alcance de auditoría por definir; debe conservarse sin escritura. |

`finanzas` existe como compatibilidad de sólo lectura de pagos, pero no es uno de los 13 roles del catálogo institucional actual.

## Datos, nombres y documentos

1. **Sí hay nombres y apellidos separados en la recepción nueva**: `solicitantes.nombres`, `primer_apellido`, `segundo_apellido`. Se conserva `nombre` completo para compatibilidad. Se admite un solo apellido; la API exige al menos uno.
2. **No está uniformado en todo el proyecto**: el alta desde predio sigue usando nombre completo; los propietarios catastrales siguen en JSON con nombre completo, y el catálogo de propietarios usa `nombre_completo`.
3. La dirección del terreno y el domicilio para notificaciones son diferentes. Se conservan como texto; municipio/localidad de recepción también son texto libre. Faltan catálogos y estructura acordada cuando corresponda, sin impedir recibir terrenos sin calle/número.
4. La recepción crea una fila de solicitante por trámite; no hay flujo completo de búsqueda/reutilización de personas ni resolución de duplicados. Separar apellidos no equivale a normalizar toda la base.
5. Los cinco documentos mínimos provienen del Word/PPT. Pueden integrarse después de recibir la solicitud; **registrar desde cero no significa expedir el título sin evidencia o validación posterior**.
6. El catálogo mezcla documentos del ciudadano, documentos producidos por el área y “Otro”. Falta modelar origen, obligatoriedad, etapa exigible, vigencia, motivo de excepción y versión vigente. Una plantilla aprobada ayudará al formato, pero no reemplaza estas reglas.
7. Una migración futura de personas/propietarios debe conservar relaciones e historial; no dividir automáticamente nombres históricos por espacios ni borrar expedientes para acomodar el nuevo modelo.

## Hallazgos que el equipo debe conocer

| Prioridad | Hallazgo | Consecuencia / acción |
|---|---|---|
| Alta | No existe vínculo del predio definitivo después de visita inicial. | Bloquea continuar el caso principal. Implementar dentro del mismo folio, con revisión y auditoría. |
| Alta | Falta control completo de requisitos, pagos y autorizaciones por etapa. | No puede presentarse el sistema como emisor operativo de títulos. Definir y aplicar transiciones en API/BD. |
| Alta | Revisión de documento general cambia la última revisión sin insertar movimiento y no comprueba expediente cerrado. | Completar historial de revisiones y bloqueo de modificaciones después de cierre; validar concurrencia. No confundir metadatos del último revisor con bitácora completa. |
| Alta | Documento general usa FK compuesta `(expediente_id,predio_id)` y permite `predio_id=NULL`. | En PostgreSQL esa FK compuesta no asegura por sí sola la existencia del expediente cuando un componente es NULL. La API consulta el expediente, pero conviene agregar FK directa para integridad de documentos generales. Verificar antes el esquema real. |
| Media | La consulta de pagos muestra el texto “Válido” para todo pago guardado. | Ese rótulo no acredita validación de Caja/banco. Definir estados reales y distinguir captura de validación. |
| Media | Al subir una versión nueva pendiente, un lector puede seguir viendo la anterior aceptada. | Definir vigencia y aviso de sustitución; no interpretar su checklist como aprobación de la nueva versión. |
| Media | El buscador por ubicación consulta sólo predios vinculados. | No encuentra la ubicación declarada de una solicitud inicial; agregar esa fuente y probar filtros. |
| Media | Inicio cuenta tareas usando `espera`, pero los expedientes cargados reciben `espera=''`. | Puede indicar cero pendientes aunque existan expedientes. Usar bandejas específicas y no reportar ese indicador como métrica validada. |
| Media | Reportes/listados cargan hasta 100 registros y el CSV exporta lo cargado. | Falta paginación/exportación completa; no usar ese CSV como universo total. |

Estos hallazgos se basan en lectura del código. No se ejecutaron modificaciones de documentos cerrados ni consultas destructivas sobre el servidor.

## Orden recomendado para continuar

| Orden | Entregable | Se considera listo cuando… |
|---|---|---|
| 1 | Prueba compartida de recepción y visita | El equipo completa el caso A con sus roles reales, evidencia y el mismo folio; pruebas de rechazo no dejan cambios parciales. |
| 2 | Revisión cartográfica y vínculo definitivo | Cartografía valida/devuelve levantamiento, vincula o crea el predio sin duplicar expediente, guarda plano y conserva trazabilidad. |
| 3 | Reglas del expediente y reparto de roles | Requisitos por etapa/origen, prevenciones, captura/revisión separadas, pagos/exenciones y validación de Informática/Titulación bloquean avances indebidos. Resolver los hallazgos de integridad/auditoría asociados. |
| 4 | Título y seguimiento externo | Título versionado y revisado; oficios, Consejería, RPP, devoluciones, firma e inscripción quedan registrados. El MVP admite seguimiento manual: no requiere esperar una API externa. |
| 5 | Entrega y cierre | Afectación final, título/plano/cédula, receptor, fecha, acuse y envío a archivo quedan guardados; no puede cerrarse incompleto. |
| 6 | Completar certificaciones/constancias | Plantilla, revisión Jefatura, autorización Dirección y entrega conectadas con dictamen y pagos. |
| 7 | Reportes y aceptación productiva | Tiempos/alertas, exportaciones completas, prueba de carga, restauración, permisos, capacitación y documentación institucional validados. |

Mientras llegan plantillas pueden avanzarse los puntos 1–3 y los registros de seguimiento externo. Para finalizar instrumentos y reglas se requieren formatos aprobados, responsable de cada validación, documentos exigibles por etapa, conceptos/importes o exenciones y datos mínimos de inscripción/entrega. El manual de instalación se mantiene pospuesto según lo acordado.
