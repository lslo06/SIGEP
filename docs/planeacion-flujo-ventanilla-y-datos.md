# SIGEP: propuesta de recepción, expediente y datos

Fecha de análisis: 24 de noviembre de 2026. Estado: propuesta para validar; no constituye un procedimiento administrativo aprobado ni una migración ejecutada.

**Estado posterior de desarrollo:** el primer incremento de recepción sin predio y visita inicial ya está en el código local, pendiente de migración/despliegue. Consultar [Recepción inicial](recepcion-inicial.md) para distinguir lo implementado de las propuestas restantes de este análisis.

Actualización del 25/11/2026: Eduardo confirmó como caso principal la solicitud de título que inicia en Ventanilla y continúa con medición registrada por el topógrafo. Se revisó también la presentación original de procesos. La correspondencia entre sus 27 etapas y las 17 del Word, las responsabilidades aclaradas y el primer incremento están en [Primera titulación desde Ventanilla](flujo-titulacion-desde-ventanilla.md). Esa conciliación guía el siguiente desarrollo; los apartados exploratorios de este documento no deben sustituir las tareas expresas del proceso local.

## 1. Decisión recomendada

Conservar el MVP interno y su integración cartográfica. Planear una entrada nueva por Ventanilla que permita registrar una solicitud sin predio preexistente, clave catastral ni polígono. Después de la revisión de competencia, las áreas completan un expediente único mediante tareas. Una solicitud registrada no acredita propiedad ni garantiza titulación.

La reunión del 19 de noviembre (PDF, pp. 1–3 y 11–14) acordó pulir el MVP y entregar código y manual, sin aplicación móvil ni ampliación indiscriminada de datos. La instrucción del 25/11 prioriza ahora la recepción sin predio previo como entrada al circuito principal de titulación; el manual y la intranet se posponen. La distinción histórica de alcance no debe usarse para postergar ese caso.

## 2. Evidencia y límites

- Reunión: el ciudadano puede llegar sin coordenadas ni clave; la superficie calculada debe contrastarse con el levantamiento; falta aclarar libro/lote y recibir el formato de título.
- Documento de requisitos v1.0, sección 5: roles institucionales; TIT-01 a TIT-17: proceso interno; RF-014: cinco documentos mínimos; RF-031: validación de expediente y cartografía. La propuesta original requiere validación institucional.
- Presentación PROCESOS DE FUNDOS LEGALES, diapositiva 1: Dirección y Jefatura canalizan antes de Cartografía; Informática compara cartografía e imprime título/plano; Titulación revisa expediente y título; Legal apoya el proceso. El Word agrupa algunas de estas acciones. Hay una tarea de Afectación final cuyo ejecutor debe confirmarse.
- Código local: `ExpedienteCreate.jsx` exige `predioFeature.properties.id`; `api/server.mjs` exige entre uno y veinte `predio_ids` existentes. `PredioCreate.jsx` y la API exigen clave catastral y geometría.
- `solicitantes` almacena nombre y domicilio completos, además del representante como texto. `datos_catastrales_expediente.propietarios` es JSON. `requisitos_documentales` identifica requisitos por su nombre y tipo de trámite; no define etapa exigible, alternativa, fuente ni versión normativa.
- `mediciones_expediente` requiere expediente y predio: la medición actual no resuelve por sí sola el caso anterior al alta del predio.
- El CSV y SQL históricos contienen modelos distintos del esquema usado por la API actual. No deben tratarse como una descripción vigente de producción. Hace falta un inventario de solo lectura de PostgreSQL antes de diseñar la migración definitiva.
- No se consultó la base de datos desplegada ni se modificó la aplicación para este análisis.

## 3. Referencias oficiales comparadas

Las referencias externas son modelos de comparación, no requisitos importados automáticamente a Durango. No se fijan costos ni plazos a partir de estas páginas.

| Fuente | Hallazgo útil para el diseño |
|---|---|
| S1. Durango, expedición de título en fundo legal | Referencia local directa: recepción, integración documental y pagos. Incluye CURP, ausente en la lista inicial de SIGEP. |
| S2. COESVI Durango, regularización | Comprueba procedencia del lote y contempla captura, revisión jurídica, gestión entre dependencias y entrega. |
| S3. INSUS, acuerdo de simplificación de 2025 | Distingue pruebas de posesión y alternativas bajo condiciones; inspira requisitos condicionales, no una excepción genérica “sin papeles”. |
| S4. Yucatán, INSEJUPY-1301 | Un oficio catastral digital es una salida intermedia, distinta del título final. |
| S5. Estado de México, inmatriculación | La vía depende de antecedentes y régimen de la tierra. |
| S6. RAN, títulos sobre parcelas | La vía agraria debe identificarse y canalizarse; no se confunde con la ruta local de Fundos Legales. |
| S7. W3C, instrucciones de formularios | Los ejemplos dentro del campo complementan las etiquetas e instrucciones; no las sustituyen. |

En S1 y S2 se recuperaron fichas indexadas oficiales, pero la apertura directa devolvió errores de servidor. Confirmar con Catastro la ficha y formatos vigentes. El resto de fuentes y la transcripción no resuelven automáticamente qué autoridad firma cada acto local.

## 4. Casos de entrada

| Situación | Tratamiento propuesto |
|---|---|
| No tiene título ni medición | Recepción preliminar, localización y revisión de competencia; después solicitud de medición cuando proceda. |
| Tiene identificación pero no acredita posesión | Registrar orientación y faltantes; revisión jurídica de alternativas aceptables. No aprobar ni expedir por simple declaración. |
| No trae identificación | Registrar atención orientativa con identidad declarada y pendiente de verificar. La admisión formal dependerá de reglas aprobadas. |
| Ya tiene título y necesita copia o constancia | Búsqueda y servicio documental; no repetir el circuito de primera titulación. |
| Régimen desconocido, ejidal, comunal o conflicto de derechos | Clasificación por el área competente y canalización o suspensión motivada. No asignar automáticamente la ruta de fundo legal. |
| Campaña gubernamental | Asociar programa y jornada a solicitudes individuales. Registrar subsidio o exención únicamente con autorización y fundamento, nunca como pago ficticio. |

“Sin papeles” puede significar sin título, sin comprobantes o expediente digital sin impresiones. Son tres necesidades diferentes. La propuesta principal cubre al ciudadano sin título ni datos técnicos. La validez de firma, cotejo, originales y entrega digital se confirma aparte.

## 5. Módulos y pantallas

Los módulos agrupan tareas; los trece roles no requieren trece aplicaciones ni trece fichas diferentes.

| Módulo | Pantallas y motivo | Usuarios principales |
|---|---|---|
| Mi bandeja | Pendientes asignados, devueltos, vencimientos definidos y siguiente acción. Evita usar un tablero general como bandeja personal. | Cada área; Jefatura supervisa. |
| Ventanilla | Nueva atención/solicitud, búsqueda de antecedentes, recepción de faltantes, citas, consulta y entrega. Permite empezar antes de tener cartografía. | Ventanilla. |
| Expedientes | Ficha única con resumen, personas, ubicación, requisitos, medición, pagos, revisiones, título/envíos, entrega e historial. | Según lectura y acciones permitidas. |
| Territorio y cartografía | Mapa, lotes, fundos/ámbitos, catálogos territoriales, geometrías y conciliación de superficies. | Cartografía; consulta autorizada. |
| Campo | Órdenes de medición, agenda, visita, incidencias, levantamientos y evidencias. | Cartografía asigna; Topografía ejecuta. |
| Caja y pagos | Conceptos exigibles, cobros, comprobantes, saldos, exenciones y subsidios autorizados. | Caja; lectura autorizada. |
| Titulación y gestión externa | Validaciones, borradores, revisiones, firmas, envíos, devoluciones e inscripción. | Titulación, Informática, Legal, Jefatura y Dirección según acto. |
| Personas e interesados | Identidad reutilizable y participación en cada caso. Sustituye el supuesto de que todo solicitante ya es propietario. | Ventanilla/Captura; consulta restringida. |
| Reportes y administración | Informes y bitácora por un lado; usuarios, roles, catálogos, plantillas y versiones de requisitos por otro. | Auditoría/Dirección; Administración configura. |

Digitalización trabaja desde la pestaña Documentos y su bandeja de pendientes, sin obligar a cambiar de expediente. Una interfaz compartida no implica permisos compartidos: validar cada acción en servidor.

### Asistente de recepción

1. Motivo y búsqueda previa: primera titulación, información, copia/constancia, seguimiento; folio existente si lo conoce.
2. Persona y representación: nombres, apellidos, contacto o alternativa, identidad declarada/verificada; representante solo si aplica.
3. Ubicación: municipio, localidad/asentamiento, referencias, dirección si existe y punto aproximado opcional marcado como no verificado.
4. Documentación disponible: lo presentado, faltantes, ilegibles y requisitos por determinar. Nunca llenar un dato desconocido con cero o “N/A”.
5. Resumen y comprobante: folio de atención, fecha, área siguiente y lista de pendientes. Distinguirlo del acuse formal de admisión.

Botones: Guardar borrador, Registrar atención, Emitir comprobante, Turnar a revisión. “Solicitar medición” aparece cuando las condiciones de la ruta lo permitan. Los datos técnicos no son obligatorios para guardar la atención.

## 6. Flujo propuesto de primera titulación

| Paso | Entrada / responsable | Salida y control |
|---|---|---|
| 0. Configurar campaña, si aplica | Administración/Dirección | Programa, ámbito, vigencia y reglas aprobadas. No genera derechos por sí mismo. |
| 1. Recibir | Ventanilla, identidad declarada y ubicación referida | Solicitud con folio propio; no exige título, clave ni coordenadas. |
| 2. Buscar y clasificar | Ventanilla + área competente | Detectar expediente previo, ámbito/régimen y posibles conflictos; originar solicitud de medición cuando falte un levantamiento utilizable. No fusionar personas automáticamente por coincidencia de nombre. |
| 3. Revisar y canalizar | Dirección/Jefatura; apoyo Legal cuando corresponda | Según PPTX, Dirección canaliza a Fundos y Jefatura a Cartografía; conservar motivo, responsable y evidencia. |
| 4. Asignar medición | Cartografía, después de canalización | Orden vinculada al expediente y ubicación preliminar, aunque no exista predio. Topógrafo y fecha. |
| 5. Visitar y levantar | Topografía asignada | Coordenadas, sistema de referencia, método, superficie medida, fecha, observaciones y evidencias. Si no localiza o hay oposición, registrar incidencia. |
| 6. Validar cartografía | Cartografía | Geometría versionada, superficie calculada, medida y validada; motivo de diferencias. Vincular o crear lote técnico sin inventar clave oficial. |
| 7. Integrar expediente | Ventanilla/Digitalización/Captura | Requisitos aplicables y cotejados; identidad y representación verificadas. Vinculación a solicitud sin recaptura. |
| 8. Liquidar conceptos | Caja | Pago, saldo, subsidio o exención autorizada. Reglas por concepto y momento aprobado. |
| 9. Validar información | Titulación/Informática | Titulación compara expediente y BD; Informática compara BD/cartografía. Registrar revisiones separadas por versión y devoluciones motivadas. |
| 10. Generar y revisar | Informática/Titulación; Jefatura/Dirección para oficio | El PPTX ubica impresión en Informática y revisión del título en Titulación. Jefatura elabora oficio y Dirección lo firma. Conciliar permiso de generación con el Word y conservar versión/revisión. |
| 11. Firma y gestión externa | Titulación/Dirección | Consejería y RPP según TIT-11 a TIT-14: oficios, folios, acuses, fechas, devoluciones y archivos. No presuponer integración automática. |
| 12. Cédula y archivo final | Cartografía/Digitalización | TIT-15/TIT-16: cédula, valores y título inscrito incorporados. Confirmar si hay también una cédula preliminar antes de esta etapa. |
| 13. Entregar/cerrar | Ventanilla/Titulación | Receptor y carácter, identidad verificada, fecha, documentos y acuse. Cierre con pendientes resueltos. |

El PPTX incluye captura de valores antes del título y cédula/valores después del RPP. Confirmar los productos preliminares frente a la cédula final; no exigir esta última en la recepción. Las tareas documentales y técnicas pueden avanzar en paralelo cuando se autorice; los puntos de control bloquean la emisión final si hay pendientes.

### Caso de uso de ejemplo

María del Carmen López Hernández llega a una jornada gubernamental. Quiere su primer título y ubica su casa frente a la cancha de la localidad. No conoce clave ni coordenadas.

Ventanilla registra su identidad declarada, contacto disponible, ubicación y papeles presentados. Entrega el folio de solicitud. El área competente comprueba que el caso corresponde al programa/ruta y qué acredita la posesión; si falta evidencia, emite orientación o requerimiento. Si procede la intervención técnica, Cartografía asigna una visita. Topografía levanta el terreno; Cartografía revisa el resultado y se vincula el lote. Se completa la documentación y se determinan pagos o beneficio autorizado. Informática compara las versiones; Titulación prepara el instrumento con formato oficial, obtiene revisiones y registra gestiones externas. Solo después de completar la ruta se registra la entrega.

Si se determina que el terreno requiere vía agraria, el caso se canaliza con trazabilidad. Dibujar un polígono no sustituye esa decisión. Si la persona no acredita identidad/posesión, la atención puede conservarse, pero no se marca como apta para titular.

## 7. Requisitos: catálogo por etapa

| Elemento | Origen y responsable | Momento propuesto |
|---|---|---|
| Solicitud de predio/lote | RF-014; Ventanilla | Formalización, con formato aprobado. |
| Identificación oficial | RF-014 | Cotejo para admisión formal; orientación preliminar registra pendiente. |
| Acta de nacimiento | RF-014 | Integración. |
| Constancia/prueba de posesión | RF-014 y ruta aplicable | Integración/revisión de procedencia; alternativas solo aprobadas. |
| Comprobante de domicilio | RF-014 | Integración; distinguir domicilio del lote y de notificaciones. |
| CURP | Ficha oficial local S1, no listado RF-014 | Confirmar incorporación y casos aplicables. |
| Representación y documentos de cotitulares | Condicional, por validar | Cuando comparezca representante o se solicite cotitularidad. |
| Levantamiento y plano | Elaboración técnica interna | Después de visita y validación. |
| Recibos de terreno/servicios | Operación de pagos | En el punto de control aprobado, no al primer contacto. |
| Cédula catastral | Producto técnico | Según definición local de preliminar/final y TIT-15. |
| Título y constancia de inscripción | Producto del proceso | Antes de entrega, conforme a la ruta. |
| Otro | Adjunto complementario | Nunca requisito obligatorio genérico ni sustituto de un documento definido. |

Cada requisito debe guardar código estable, nombre visible, fuente, versión/vigencia, trámite/ruta, etapa exigible, condición, alternativas aceptadas, quién lo aporta, quién lo valida y qué transición bloquea. Estados por expediente: pendiente, recibido, en revisión, aceptado, rechazado, no aplica con motivo. Mantener revisiones anteriores y evidencia del cotejo.

No reutilizar la lista de titulación para búsquedas, copias y constancias. RF-015 exige propósito/motivo y firma en la solicitud de búsqueda; el campo actual de observación no define esa obligación. Confirmar las correspondencias exactas entre las seis opciones del sistema y los nombres oficiales de trámites.

## 8. Diccionario inicial de datos y ejemplos

Separar nombres y apellidos es estructuración de datos; evitar redundancias y diseñar relaciones es normalización. El resultado se documenta mediante modelo entidad-relación y diccionario de datos.

Todos los ejemplos siguientes son ilustrativos. La columna de obligatoriedad describe propuesta de captura, no una nueva obligación legal.

| Dato / columna propuesta | Etiqueta / ejemplo | Regla y momento |
|---|---|---|
| `personas.nombres` | Nombre(s): María del Carmen | Identidad declarada al registrar solicitud; conservar nombres compuestos. |
| `primer_apellido` | Primer apellido (paterno): López | Según documento; admitir excepción documentada. |
| `segundo_apellido` | Segundo apellido (materno): Hernández | Opcional si no figura; no inventar. |
| `nombre_original` | Nombre en registro anterior | Preservar al migrar; no dividir automáticamente por espacios. |
| `estado_identidad` | Declarada / verificada / por corregir | Separar captura de validación. |
| `curp` | CURP: 18 caracteres de tu constancia | Texto; formato no equivale a verificación oficial. Condicional. |
| `tipo_identificacion` | Selecciona el documento presentado | Catálogo de documentos admitidos confirmado por autoridad. |
| `numero_identificacion` | Folio del documento seleccionado | Texto separado del tipo y archivo; no pedir número ambiguo. |
| `telefono` | Ej. 618 123 4567 | Texto, no entero; aceptar prefijo y documentar ausencia. |
| `correo` | Ej. persona@example.com | Opcional salvo regla confirmada; no exigir cuenta al ciudadano para atención interna. |
| `medio_contacto` | Teléfono / correo / domicilio / alternativa | Registrar medio disponible, no fabricar correo o teléfono. |
| `tipo_domicilio` | Notificaciones / ubicación del lote | Dos finalidades distintas; opción “usar mismo domicilio”. |
| `calle` | Ej. Calle Hidalgo | Aceptar ubicación sin nomenclatura oficial mediante referencias. |
| `numero_exterior` | Ej. 25 o 25-A | Texto; indicador sin número cuando aplique. |
| `numero_interior` | Ej. 2-B | Opcional. |
| `asentamiento` | Colonia, barrio o localidad | Catálogo cuando esté disponible; no confundir con municipio. |
| `codigo_postal` | Ej. 34000 | Texto de cinco caracteres cuando se conozca; conservar ceros. |
| `municipio_id` | Selecciona municipio | Catálogo; sin valor numérico inventado. |
| `localidad_id` | Selecciona localidad | Dependiente de municipio; permitir pendiente si aún se verifica. |
| `referencias` | Frente a la cancha, casa de puerta azul | Requerir información suficiente para localizar antes de asignar visita. |
| `punto_aproximado` | Marcar ubicación aproximada | Opcional; origen y precisión declarada; no es polígono oficial. |
| `calidad_interesado` | Solicitante / poseedor declarado / representante / titular acreditado | Participación en el caso, distinta de rol de acceso. |
| `representado_id` | Persona a quien representa | Relación entre personas más documento de representación. |
| `regimen_declarado` | No sabe / privado / ejidal / comunal / público | Declaración del ciudadano, no dictamen. |
| `regimen_validado` | Resultado de revisión | Solo área autorizada; registrar fuente y fecha. |
| `clave_catastral` | Si ya fue asignada, cópiala de tu documento | Nullable; asignación oficial independiente del ID interno. |
| `codigo_manzana`, `codigo_lote` | Según catálogo o antecedente | Texto para conservar ceros y sufijos; fuente y ámbito. |
| `superficie_declarada_m2` | Ej. 120.00 | Opcional; no convertir desconocido en cero. |
| `superficie_calculada_m2` | Calculada desde geometría | Solo lectura y vinculada a versión geométrica/método. |
| `superficie_medida_m2` | Resultado del levantamiento | Captura técnica, instrumento, fecha y responsable. |
| `superficie_validada_m2` | Resultado conciliado | Cartografía confirma y justifica diferencias. |
| `sistema_referencia` | CRS/EPSG y origen del levantamiento | Técnico; no confundir UTM con longitud/latitud. |
| `folio_titulo` | Según título emitido | Nunca requisito de primera solicitud. |
| `libro` | Pendiente definir tipo de libro | No asignarlo a RPP por suposición. Añadir origen/catálogo solo después de aclararlo. |
| `folio_registral` | Según respuesta del RPP | Posterior y diferente del folio SIGEP. |
| `programa_id` | Programa/jornada, si aplica | Relaciona solicitudes sin fusionarlas. |

Nombres: admitir acentos, ñ, apóstrofos y guiones; recortar espacios sobrantes sin alterar el contenido. No deducir género, parentesco o propiedad por nombres. Razón social necesita un tratamiento distinto si la dependencia confirma atención a personas morales.

## 9. Modelo lógico propuesto

| Entidad | Contenido y relación |
|---|---|
| `personas` | Identidad; una persona puede intervenir en varios casos. |
| `domicilios` y contactos | Datos estructurados y finalidad; la notificación relevante queda versionada en el expediente. |
| `solicitudes` | Primera atención, folio, motivo, canal, programa y estado preliminar. No requiere predio. |
| `solicitud_personas` | Participantes, carácter y representación en esa solicitud. |
| `ubicaciones_preliminares` | Dirección/referencias/punto aproximado, varias si procede; vínculo posterior a lote. |
| `ordenes_medicion` | Ubicación preliminar y solicitud; vínculo opcional a predio existente. |
| `visitas` / `levantamientos` | Múltiples intentos, técnicos, fechas, evidencia y versiones. |
| `predios` y geometrías versionadas | Registro técnico estable; clave oficial nullable. No duplicar predios al repetir trámite. |
| `expedientes` | Caso formal admitido, tipo/ruta, versión del proceso y enlace único a solicitud de origen. |
| `expediente_personas` / `expediente_predios` | Participantes y objetos del trámite; no suponer un único dueño ni un único predio. |
| `derechos_predio` | Titularidad/posesión acreditada, instrumento, vigencia y, si aplica, participación. Solo crear derecho tras acto competente. |
| `requisitos_versionados` | Catálogo estable y condiciones aprobadas por trámite/etapa. |
| `documentos`, versiones y revisiones | Archivo privado, tipo, requisito, autor, fecha y resultado; evita perder el rechazo anterior. |
| `tareas`, `transiciones`, `validaciones` | Área, persona, estado, plazos aprobados, motivos y versión de datos revisada. |
| `conceptos`, `cargos`, `pagos`, `beneficios` | Cobro y liquidación separados de exención/subsidio. |
| `titulos`, `envios`, `inscripciones`, `entregas` | Instrumentos y actos finales con identificadores propios y evidencia. |
| `usuarios`, `roles`, `auditoria` | Personal y permisos; separados de ciudadanos. |

No se requiere crear todas estas tablas de una sola vez. Primero documentar cuál entidad actual se conserva, amplía o sustituye. No mezclar sin análisis UUID del esquema histórico con BIGINT de la API actual.

### Reglas de integridad

- NULL significa dato desconocido/no capturado; “no aplica” requiere estado o motivo independiente.
- Mantener estados separados: situación jurídica, etapa de trámite, medición, revisión documental y pago. No reutilizar `status` numérico sin catálogo.
- Identificadores oficiales son texto y no sustituyen claves primarias internas. Definir unicidad de clave catastral con ámbito institucional.
- Cambios de identidad o geometría relevantes invalidan aprobaciones anteriores para la emisión, conservando las versiones auditadas.
- El nombre completo de presentación se calcula; el nombre del título emitido queda congelado con su versión de datos, no cambia si luego editan a la persona.
- Las transiciones se autorizan en API y se guardan con movimiento en una transacción. El estado nuevo no se elige libremente en un select.
- Evitar expedientes duplicados mediante búsqueda y advertencia; resolver coincidencias con revisión humana.
- No borrar personas con historial ni crear titulares legales a partir de texto libre de solicitante.

## 10. Formularios y ayudas

Cada campo: etiqueta visible, ejemplo breve, ayuda permanente cuando sea necesaria, obligatoriedad por etapa y error concreto. Un placeholder no es valor por defecto. En selects usar una opción inicial sin valor; en fecha/mapa usar el control adecuado. Un formato visual no debe imponer una regla catastral no confirmada.

Ejemplo: etiqueta “Segundo apellido (opcional)”; placeholder “Ej. Hernández”; ayuda “Déjalo vacío si no aparece en tu documento”; error de otro campo “Indica el municipio para localizar el terreno”. En medición: “Superficie medida (m²)”, sin pedir a la persona ciudadana un polígono WKT.

No prellenar fecha del título con la fecha actual para un registro que todavía no lo tiene. Preservar datos al volver de un paso y permitir guardar borrador. Señalar los errores junto al campo y en un resumen accesible. Separar mensajes de orientación, prevención formal y rechazo.

## 11. Plan de ejecución

Prioridad actualizada: implementar primero el circuito de recepción, canalización, asignación y regreso de campo descrito en [el incremento funcional del flujo principal](flujo-titulacion-desde-ventanilla.md). Los ajustes visuales ya realizados sirven a ese circuito. La preparación del manual y despliegue de intranet queda pospuesta por instrucción de Eduardo.

### Cierre del MVP acordado

1. Confirmar/fijar listado de defectos reproducibles: carga de evidencia, textos obsoletos de prototipo, estados y permisos visibles.
2. Documentar alcance real: uso interno con lote técnico disponible; lista explícita de procesos pendientes.
3. Recibir formato de título y distinguir borrador de documento oficial. No declarar cerrada titulación por generar un archivo.
4. Entregar manual: API, PostgreSQL/PostGIS, almacenamiento privado, QGIS/contenedor del mapa, red/puertos y túnel de desarrollo, configuración de intranet, respaldos/restauración y despliegue reproducible.

### Iteración A: recepción desde cero

Dependencias: autoridad aprueba mínimos de atención y criterio de admisión. Crear solicitud/ubicación preliminar, folio, búsqueda de antecedentes, asistente de Ventanilla y orden de medición independiente de predio. Adaptar lista, detalle, API y permisos. Permitir clave ausente en el registro técnico cuando corresponda, sin cambiarla por una ficticia.

### Iteración B: datos y requisitos

Inventario de BD, diccionario, nombres/domicilios estructurados, vínculo entre personas e interesados, catálogo versionado de requisitos, ejemplos y ayudas. Aplicar migraciones aditivas y compatibilidad temporal; no partir nombres anteriores automáticamente.

### Iteración C: revisiones y cierre

Implementar RF-031 y tareas de revisión, devoluciones y aprobación. Incorporar formato oficial, seguimiento externo y entrega. Las automatizaciones externas requieren acuerdos y capacidades reales, no se simulan como integraciones.

### Migración sin pérdida

Respaldo con restauración comprobada; añadir columnas/tablas nuevas; conservar valores originales; listado de registros ambiguos para revisión; adaptar API y formularios; validar reportes y plantillas; comparar conteos y referencias; retirar campos antiguos solo cuando ya no haya consumidores y se haya aprobado el cambio. No ejecutar este plan directamente sobre producción.

## 12. Criterios de aceptación

1. Se registra una atención sin título, clave, polígono ni predio; obtiene folio y próximos pasos.
2. Sin identidad o posesión acreditada, la atención no aparece como expediente apto para emitir título.
3. Se detecta un posible expediente previo sin borrar ni fusionar automáticamente.
4. Una orden de medición puede nacer de ubicación preliminar; el topógrafo solo modifica órdenes asignadas.
5. Visita fallida se registra y reprograma sin perder la anterior.
6. Geometría y superficie medida pueden diferir; el sistema exige conciliación, no sobrescribe silenciosamente.
7. Cada requisito indica origen, responsable y etapa; un documento futuro no bloquea la atención preliminar.
8. Correo, segundo apellido y clave desconocidos no se rellenan con datos ficticios.
9. Informática registra validación con versión de datos; cambios posteriores quedan pendientes de nueva revisión.
10. Caja distingue pago, saldo y beneficio autorizado; una campaña no marca todos los conceptos como pagados.
11. Un caso ejidal/desconocido puede canalizarse con razón y evidencia.
12. La emisión/entrega no procede con controles finales pendientes; el historial identifica actor y fechas.
13. Los trámites de búsqueda/copia/constancia no recorren medición y primera titulación innecesariamente.
14. Una migración conserva solicitantes, expedientes, adjuntos y referencias antiguas.

## 13. Preguntas que cierran decisiones

1. ¿Qué acto define el ámbito/fundo habilitado y qué oficina confirma que el lote puede titularse por esta vía?
2. ¿Cuáles datos bastan para atención preliminar y cuáles convierten la solicitud en admisión formal? ¿Cuándo comienza cada plazo?
3. ¿Quién expide la constancia de posesión y qué alternativas se aceptan localmente? ¿Cómo se tratan oposición, fallecimiento, representación y cotitularidad?
4. ¿La clave se asigna antes o después de qué acto? Confirmar segmentos, longitud, ceros, ámbito y responsable.
5. ¿Qué significa libro en el Excel? Pedir dos registros anonimizados y el documento del que se obtiene. ¿Lote es número local o registro catastral?
6. ¿Quién valida superficie, con qué tolerancia y sistema de referencia? ¿Cuándo se exige nueva visita?
7. ¿La cédula de TIT-15 es final, existe una preliminar y qué datos requiere el título antes de emitirse?
8. ¿Ventanilla cobra o solo consulta/canaliza a Caja? La conversación y la matriz de permisos no dicen lo mismo.
9. ¿Qué conceptos paga la persona en cada etapa? ¿Qué beneficio cubre la campaña y cómo se autoriza?
10. ¿Qué revisa Informática y qué revisa Titulación? ¿Quién puede devolver, corregir y aprobar?
11. ¿Qué formato de título, firmas, acuses y datos registrales son oficiales? ¿Qué entregas digitales se admiten?
12. ¿El número de habitantes de la vivienda es requisito autorizado de este programa? De momento dejarlo fuera, conforme al alcance de la reunión.

## Fuentes

- Reunión 19/11/2026, PDF disponible en la conversación: https://chatgpt.com/library?file_id=libfile_5056c87fb7788191b0d9ca7458dff42e&account_id=personal
- Documento local: `../archivos_sigep/SGFL_Documento_Requerimientos_v1.0.docx`.
- S1: https://www.durango.gob.mx/tramites-y-servicios/secretaria_de_educacion/secretaria_de_finanzas__y_de_administracion/expedicion_de_titulo_de_propiedad_del_lote_dentro_del_fundo_legal
- S2: https://www.durango.gob.mx/tramites-y-servicios/secretarias/comision_estatal_de_suelo_y_vivienda/programa_de_regularizacion
- S3: https://sidof.segob.gob.mx/notas/docFuente/5761213
- S4: https://tramites.yucatan.gob.mx/tramite/aee434f1
- S5: https://caravanas.edomex.gob.mx/node/278
- S6: https://www.gob.mx/tramites/ficha/expedicion-de-titulos-de-propiedad-sobre-parcelas-ante-el-ran/RAN1410
- S7: https://www.w3.org/WAI/tutorials/forms/instructions/

Consulta: 24/11/2026. Las fuentes comparativas sustentan el análisis; las pantallas, entidades y prioridades son propuestas de diseño para SIGEP, sujetas a validación local.
