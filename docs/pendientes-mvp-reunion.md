# SIGEP: pendientes, roles y orden del trámite

Revisión del código local: 25 de noviembre de 2026. Base: reunión del 19 de noviembre, documento de requisitos v1.0, presentación PROCESOS DE FUNDOS LEGALES y comportamiento implementado. Este documento distingue funciones existentes de propuestas; no acredita que el servidor tenga desplegada esta versión ni aprueba procedimientos administrativos.

**Prioridad confirmada por Eduardo el 25/11:** el caso principal comienza cuando el ciudadano solicita su título en Ventanilla. Ya está implementado localmente el incremento de recepción sin predio previo, canalización, asignación y registro de visita; requiere migración, despliegue y prueba manual. Ver [Recepción inicial](recepcion-inicial.md). La conciliación de las 17 etapas del Word con las 27 de la presentación está en [Primera titulación desde Ventanilla](flujo-titulacion-desde-ventanilla.md).

El manual de instalación, la intranet y el despliegue de QGIS quedan fuera de esta iteración por indicación de Eduardo. Se retoman después.

## 1. Qué tenemos y qué falta

| Parte | Estado comprobado en código | Pendiente concreto |
|---|---|---|
| Sesiones y usuarios | Hay 13 roles, permisos compartidos entre API/interfaz y administración de usuarios. | Completar acciones y bandejas por responsabilidad; un rol creado no equivale a un proceso implementado. |
| Alta de expediente | Nueva recepción con nombres/apellidos separados y ubicación/referencias, sin predio, clave ni coordenadas. Conserva el alta anterior desde el mapa. | Aplicar migración y probar contra BD real; vincular luego el predio definitivo al mismo expediente. |
| Alta/corrección de predio | Calcula superficie con PostGIS y audita correcciones geométricas. | Permitir clave todavía no asignada; distinguir superficie calculada, medida y validada. Revisar restricciones reales de BD antes de migrar. |
| Medición | Recepción nueva: canalización Dirección/Jefatura, asignación, visita y evidencia sin predio previo. El circuito anterior permite además cargar plano. | Vinculación cartográfica del nuevo circuito, reprogramaciones/incidencias, conciliación formal de superficies y prueba contra servidor real. |
| Documentos | Checklist por trámite, archivos, versiones y aceptación/rechazo. | Reglas por etapa, fuente y vigencia; diferenciar documentos que trae el ciudadano de los que produce la oficina. |
| Cédula y propietarios | Guarda valores, propietarios y revisión; hay un borrador preliminar. | Definir cédula preliminar/final y separar captura de validación técnica. Los propietarios siguen almacenados como nombres en JSON. |
| Pagos | Registra pagos e historial con transacción. | Definir conceptos y momento exigible; comprobar saldo, exención o subsidio autorizado antes de las etapas que lo requieran. |
| Legal | Dictamen para cuatro certificaciones/constancias. | Completar revisiones, autorización y entrega de esas rutas. El dictamen existente no es la validación jurídica de primera titulación. |
| Informática | Acceso a inicio, trámites y lotes. | RF-031: comparación de expediente, datos y cartografía; aprobar/devolver con observaciones. Actualmente tampoco tiene lectura de cédula mediante `lecturaCatastro`. |
| Jefatura/Dirección | Consulta de trámites e histórico. | Acciones de revisión/autorización trazables; RF-044 corresponde a certificados/constancias. Confirmar las firmas de la ruta de título. |
| Titulación | Acceso al módulo de títulos y consulta de expediente. | Preparación oficial del instrumento, revisiones, envíos, devoluciones, inscripción y entrega. Una impresión o borrador no completa esta ruta. |
| Catálogos/reportes | Hay consultas y exportaciones de determinados listados. | Confirmar qué catálogos requieren altas/ediciones y reportes completos; no confundir una vista de consulta con un catálogo administrable. |

## 2. Orden de desarrollo

La reunión pidió pulir lo existente. La instrucción actual de Eduardo fija la entrada desde Ventanilla como caso principal del siguiente desarrollo. El documento de requisitos ya pide el recorrido de recepción a entrega; la implementación actual necesita superar su dependencia de un predio existente. Los primeros ajustes visuales no cubren ese objetivo.

| Orden | Trabajo | Resultado verificable | Dependencia |
|---|---|---|---|
| 1 | Datos y recepción desde Ventanilla como un incremento: nombres estructurados, ubicación preliminar y folio sin predio obligatorio. | Registrar la solicitud sin clave ni geometría; conservar registros anteriores y distinguir atención de admisión formal. | Migración compatible e inventario del esquema destino antes de ejecutarla. |
| 2 | Solicitud y canalización de medición. | Dirección canaliza a Fundos; Jefatura a Cartografía; queda historial y tarea por área. | Conservar los pases de la presentación; cualquier simplificación requiere definición institucional. |
| 3 | Orden de campo independiente del predio definitivo. | Cartografía asigna y el topógrafo registra visita, incidencias y evidencia en su bandeja. | Identificador propio de orden, vínculo al expediente y control por asignación. |
| 4 | Validación cartográfica y regreso a Ventanilla. | Cartografía acepta/devuelve, vincula/completa predio y plano; Ventanilla ve el resultado en el mismo expediente. | Criterio de conciliación de áreas y sistema de referencia. |
| 5 | Integración, checklist por etapa, pagos y captura. | Requisitos revisados, comprobantes y datos de propietarios/valores con fuente. | Reglas por etapa y separación entre captura y validación. |
| 6 | Captura y validación de Informática/Titulación. | RF-031 registra quién revisó qué versión y por qué devuelve/aprueba. Cambios relevantes requieren nueva revisión. | Delimitación entre revisión de consistencia y decisión técnica/jurídica. |
| 7 | Revisiones, autorización y preparación documental. | Titulación revisa contenido; Informática verifica consistencia y apoya generación/impresión; Jefatura prepara oficio y Dirección lo firma. | Conciliar el reparto de impresión del Word/PPTX y recibir plantillas. Se pueden desarrollar estados y trazabilidad antes del formato. |
| 8 | Gestión externa, archivo final y entrega. | Registrar envío a Consejería/RPP, recepción, observaciones, inscripción, título digitalizado y acuse de entrega. | Identificar documentos, datos registrales y responsables reales. No presupone conexión automática con otras dependencias. |
| 9 | Prueba integral y evidencia de aceptación. | Demostrar casos completos, devoluciones, restricciones por rol e historial sin pérdida de datos. | Circuito definido; ambiente de demostración actualizado. |

Los trabajos 1–4 conforman el primer circuito funcional a demostrar desde la solicitud del ciudadano. Después se completa la ruta hasta entrega; los trece roles comparten un expediente y reciben tareas según responsabilidad.

### Próxima unidad de trabajo

Preparar el modelo de recepción preliminar y datos personales, con migración compatible y contrato de API. No basta con quitar `required` del formulario: hoy el servidor exige `predio_ids` existentes y la medición también requiere predio. Deben cambiar juntos datos, API, interfaz y permisos.

Los nombres anteriores se conservan íntegros. No se separan automáticamente por espacios: «María del Carmen» y apellidos compuestos requieren revisión. Los nuevos registros deben distinguir `nombres`, `primer_apellido`, `segundo_apellido` opcional e identificación por tipo/referencia.

## 3. Ajustes de los 13 roles

Se propone conservar los trece roles y aclarar sus acciones. No se han modificado los permisos en esta iteración.

| Rol | Qué hace hoy | Ajuste propuesto |
|---|---|---|
| Administración | Usuarios y varias operaciones técnicas/operativas. | Mantener configuración y soporte. Distinguir permisos administrativos de aprobación institucional; cualquier excepción operativa debe quedar identificada. |
| Ventanilla | Alta con predio, documentación y solicitud de medición. | Nueva atención sin predio, búsqueda previa, recepción de faltantes, canalización y entrega con acuse. |
| Dirección | Consulta de trámites e histórico. | Canalizar inicialmente a Fundos, firmar oficio de envío y certificar copias según el PPTX; registrar cada acción. |
| Jefatura de Fundos Legales | Consulta de trámites e histórico. | Canalizar a Cartografía, elaborar oficio y coordinar envíos; revisión y devolución con motivo. |
| Área Legal | Dictamen de cuatro certificaciones/constancias; lectura documental. | Apoyo jurídico durante titulación, expresamente indicado en ambos documentos. Registrar consultas/respuestas sin reutilizar el dictamen de constancias como aprobación de título. |
| Cartografía y Valuación | Geometría, asignación, plano, cédula y revisión documental. | Validar levantamiento/superficie, controlar claves y planos y validar valores técnicos. Separar la revisión de documentos técnicos de la documental general. |
| Topografía | Visitas asignadas y evidencia. | Agenda, reprogramación/incidencias y registro de método/coordenadas; conservar restricción a órdenes asignadas. |
| Caja/Recaudación | Registro de pagos. | Mostrar cobros exigibles, saldos y beneficios autorizados; definir correcciones/cancelaciones con trazabilidad. |
| Digitalización | Carga y revisión de documentos; lectura de cédula. | Concentrar escaneo, legibilidad, clasificación y versiones. Separar control de calidad del archivo de aceptación de su contenido. |
| Captura | Alta de predio/expediente, carga documental y consulta de cédula. | Capturar/revisar personas, propietarios y valores documentados, según sección 5 del Word y etapa 15 del PPTX. Separar transcripción de aprobación técnica. |
| Titulación | Consulta de expedientes, cédula y módulo de títulos. | Comparar BD con expediente, revisar título, preparar copias y dar seguimiento a firma, RPP y entrega. |
| Informática | Consulta de trámites/lotes; sin acción específica de validación. | Comparar BD/cartografía y apoyar generación/impresión de título y plano, función expresa en etapa 17 del PPTX. Definir validaciones por versión y acceso a los datos necesarios. |
| Consulta/Auditoría | Consulta de módulos e histórico según restricciones. | Reportes y trazabilidad en solo lectura, con alcance documental definido. |

La cuenta heredada `finanzas` se conserva en el código para consulta de pagos; no es un decimocuarto rol del catálogo actual. La existencia de cuentas activas en producción no se ha comprobado en esta revisión.

## 4. Orden del trámite de primera titulación

Síntesis de TIT-01 a TIT-17 y la presentación original. [La correspondencia detallada](flujo-titulacion-desde-ventanilla.md) conserva las canalizaciones y separa las funciones de Titulación/Informática. La captura inicial debe funcionar antes del alta definitiva del predio.

| Paso | Responsable | Qué recibe y qué deja registrado |
|---|---|---|
| 1. Atención y búsqueda | Ventanilla | Motivo, identidad declarada, contacto disponible, ubicación referida y antecedentes. Folio de atención; no exige título ni coordenadas. |
| 2. Clasificar la ruta | Fundos/área competente, por confirmar | Competencia, antecedentes y faltantes; continuar, requerir información o canalizar con motivo. |
| 3. Determinar medición | Ventanilla/Fundos | Revisar si hay levantamiento utilizable; solicitar medición cuando haga falta. |
| 4. Canalizar y asignar visita | Dirección, Jefatura y Cartografía | Dirección canaliza a Fundos, Jefatura a Cartografía; Cartografía asigna topógrafo, fecha e instrucciones. |
| 5. Medir | Topografía | Visita, coordenadas, método, superficie, observaciones y evidencia. Incidencia si no se puede completar. |
| 6. Validar cartografía | Cartografía y Valuación | Geometría, área calculada frente a medida, plano y vínculo al predio. Clave solo cuando esté asignada. |
| 7. Integrar requisitos | Ventanilla | Documentos aplicables, identidad/representación y pendientes resueltos; orden de pago. |
| 8. Registrar pagos | Caja | Conceptos y comprobantes, o beneficio autorizado, conforme al momento aprobado. |
| 9. Digitalizar y capturar | Digitalización/Captura | Archivos, propietarios y valores documentados. |
| 10. Validar, preparar y revisar título | Titulación/Informática; Jefatura/Dirección para oficio | Titulación compara expediente, Informática compara cartografía y apoya impresión; Titulación revisa la versión producida. Jefatura prepara oficio y Dirección lo firma. |
| 11. Firma y registro externo | Titulación/Dirección; Consejería y RPP como instancias externas | Envíos, firmas, devoluciones, acuses e inscripción conforme a TIT-11 a TIT-14. |
| 12. Cédula y archivo final | Cartografía/Digitalización | Cédula/valores y título inscrito digitalizado, según TIT-15/TIT-16. |
| 13. Entrega y cierre | Titulación/Ventanilla | Receptor, calidad en que recibe, fecha, documentos y acuse; cierre con controles resueltos. |

Si existe medición válida, se reutiliza previa revisión; no se obliga a repetir toda visita. La integración documental puede avanzar en paralelo si las reglas lo permiten.

**Dos momentos por precisar:** el PPTX incluye captura de valores antes del título y generación de cédula/valores después del RPP. Confirmar si también existe una cédula preliminar y cuáles datos necesita el título; la cédula final no es requisito de recepción.

**Afectación final:** la etapa 25 del PPTX usa esa denominación, sin un rol homónimo en el Word. Conservar la tarea y confirmar su ejecutor antes de repartir ese permiso.

**Otras rutas:** búsqueda, copia y constancias no deben recorrer automáticamente primera titulación. RF-015 agrega motivo y firma para la solicitud de búsqueda; RF-044 contempla Jefatura/Dirección en certificados/constancias. El dictamen Legal implementado atiende estas últimas cuatro variantes.

## 5. Cambios locales de esta iteración

- Alta de expediente: etiquetas, placeholders y ayudas para nombre, identificación, teléfono, correo, domicilio y representación; se retiró el aviso obsoleto que decía que no había sesión ni permisos. El nombre sigue siendo un campo completo hasta la migración.
- Cédula: mostrar folio, fecha, valores y propietarios a quienes ya tenían permiso de lectura, así como al consultar expedientes cerrados. Se respeta la matriz actual; no se concede acceso nuevo a Informática todavía.
- Medición: mostrar superficie registrada, medida y diferencia cuando hay datos. La API de la bandeja de campo incluye la superficie existente del predio. Esta comparación no guarda una conciliación ni recalcula geometría; el cálculo geométrico ya existe en altas/correcciones.
- Visita: explicar que primero se registra y luego se adjunta evidencia; distinguir referencia textual de archivo y avisar cuando no hay topógrafos activos disponibles para asignar.

Estos cambios no requieren SQL nuevo. Se conservan los cambios previos del directorio de trabajo. No se modificaron cuentas, no se ejecutaron migraciones y no se desplegó al servidor.

## 6. Qué sigue dependiendo de la reunión/plantillas

1. Formato oficial de título y documentos de salida; campos obligatorios, firmas y acuse.
2. Definición de libro, lote y clave, con ejemplos anonimizados y origen de cada dato.
3. Mínimos de atención frente a admisión formal y matriz de requisitos por ruta/etapa.
4. Responsables de revisión, autorización, conciliación de áreas y tratamiento de devoluciones.
5. Momento de pagos, conceptos, beneficios y cédula preliminar/final.

Estas definiciones no impiden avanzar con datos estructurados, ayudas, recepción preliminar, historial o tareas. Sí impiden declarar que el instrumento generado y la ruta administrativa ya son oficiales.

## 7. Verificación

Ampliación posterior de la prueba del 25/11: 61 pruebas aprobadas y compilación correcta. Se añadieron comprobaciones de login, recorrido con predio existente, visita, archivos, documentos, pagos y lectura de cédula mediante controladores reales y respuestas SQL/archivos simulados. El acceso de red local fue bloqueado por el entorno; no se completó validación en navegador o PostgreSQL desplegado. Ver [reporte y guion para el equipo](prueba-flujo-para-equipo.md). La recepción sin predio y los nombres separados siguen pendientes.

Verificación inicial de los ajustes visuales, antes de ampliar las pruebas:

- `node --test tests/*.test.js`: 46 pruebas aprobadas, 0 fallidas.
- `npm.cmd run build`: compilación de producción completada.
- `node --check api/server.mjs`: sintaxis válida.
- `git diff --check`: sin errores de espacios; Git mantiene sus avisos de conversión LF/CRLF.

Las pruebas automatizadas de API usan simulaciones. No se realizó una prueba visual en navegador ni se consultó PostgreSQL o el servidor desplegado; queda pendiente la demostración del flujo con cuentas, base de datos y archivos reales del ambiente de pruebas.

## Referencias

- [Planeación detallada del flujo y datos](planeacion-flujo-ventanilla-y-datos.md).
- [Reunión del 19 de noviembre](https://chatgpt.com/library?file_id=libfile_5056c87fb7788191b0d9ca7458dff42e&account_id=personal).
- Documento local: `../../archivos_sigep/SGFL_Documento_Requerimientos_v1.0.docx`, TIT-01 a TIT-17, RF-014, RF-015, RF-031 y RF-044.
- Implementación revisada: `api/permissions.mjs`, `api/server.mjs`, `src/components/map/ExpedienteCreate.jsx`, `ExpedienteMedicion.jsx`, `ExpedienteDocumentacion.jsx`, `src/modules/FieldWorkspace.jsx`, `ModuleWorkspace.jsx` y `sql/create_expedientes.sql`.
