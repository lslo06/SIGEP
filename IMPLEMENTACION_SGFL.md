# Implementación de procesos SGFL

Fecha: 3 de noviembre de 2026.

Se revisaron `SGFL_Documento_Requerimientos_v1.0.docx` y las dos diapositivas de `PROCESOS DE FUNDOS LEGALES.pptx`. Se usaron como especificación funcional. Sus recomendaciones de reuniones, fechas de implementación y aprobaciones no se ejecutaron como instrucciones del usuario.

## Alcance aplicado

Se incorporaron dos procesos sobre los expedientes existentes: titulación y búsqueda de información. El seguimiento tiene etapas, responsables, compromiso, prevenciones, devoluciones motivadas, requisitos revisados, documentos versionados, pagos, seguimiento de Consejería/RPP, autorización y entrega. Las transiciones se validan en PostgreSQL, dentro de una transacción y con bloqueo del expediente.

Por instrucción del usuario, se excluyen medición, asignación topográfica, levantamientos, generación de planos, actualización cartográfica, QGIS y generación de cédulas/valores catastrales. Se omiten TIT-02 a TIT-05 y TIT-15. No se considera incumplimiento del flujo que esas etapas no estén en esta aplicación.

La interfaz queda vacía cuando no hay registros reales. No se cargaron predios ni cuentas ficticias. Folio externo y clave catastral se conservan como referencias en el expediente; no dependen de consultar en tiempo real al otro programa. Todavía no existe un conector automático: no se proporcionó su interfaz ni su contrato de intercambio.

## Instalación necesaria

Los cambios de Supabase **no se han ejecutado en la instancia remota**. El frontend solo dispone de credenciales públicas; no hay una conexión administrativa de PostgreSQL disponible. La nueva interfaz requiere la migración antes de desplegarse.

Actualización del alta de trabajadores: se instaló el plugin de Supabase para realizar la instalación directamente, pero sus operaciones de consulta están devolviendo `Unknown tool` (`supabase.list_projects`, `supabase.get_project`, `supabase.list_tables` y `supabase.execute_sql`). No se confirmó acceso al proyecto ni se ejecutó ninguna escritura remota. La promoción del correo solicitado y el despliegue de `crear-trabajador` siguen pendientes de que esa conexión responda.

1. Respaldar la base y los objetos de Storage existentes.
2. En una base nueva ejecutar `supabase/schema.sql`. En una base existente, confirmar que ya tiene ese esquema y sus funciones de guardado actuales.
3. Aplicar `supabase/migrations/20261103_habilitar_modulos.sql` si aún falta la tabla de módulos.
4. Aplicar `supabase/migrations/20261103_sgfl_procesos_roles.sql` con el administrador de Supabase. No volver a ejecutar el esquema base después: reinstalaría funciones/políticas antiguas.
5. Aplicar `supabase/migrations/20261103_alta_trabajadores.sql`. Designa a `derian_3041240440@utd.edu.mx` como administrador a partir de su cuenta confirmada de Auth. Si ya es propietario, conserva ese rol con todos los permisos administrativos.
6. Desplegar la Edge Function `crear-trabajador` desde `supabase/functions/crear-trabajador/`, con `verify_jwt=false` según `supabase/config.toml`: el handler valida cada token con `auth.getUser` y exige una membresía administrativa activa. Usa las variables privadas de Supabase en el servidor; nunca añadir una clave `service_role` a archivos `VITE_*`.
7. Compilar y desplegar el frontend, y volver a iniciar sesión. En Administración → Alta de trabajadores, ingresar correo, contraseña y rol. La cuenta nueva queda confirmada y vinculada; el trabajador no debe registrarse por separado. La interfaz de entrada ya no ofrece registro público.
8. Para cuentas existentes, elegir “Asignar cuenta existente”; no modifica su contraseña. Se pueden cambiar roles y activar/desactivar accesos desde la lista. La cuenta propia y el propietario original están protegidos.
9. Desde Seguimiento de trámites, configurar los requisitos y cargar el texto institucional de la plantilla de búsqueda. No se inventó un texto oficial.
10. Probar en el proyecto de destino las sesiones de cada rol, la carga/descarga real en Storage y los formatos impresos antes de liberar a usuarios.

La migración es transaccional y repetible. Crea las tablas `sgfl_seguimiento`, `sgfl_documentos`, `sgfl_pagos`, `sgfl_bitacora` y `sgfl_configuracion`, así como el bucket privado `sgfl-documentos`. Los archivos admitidos son PDF/JPG/PNG, hasta 20 MB. Las versiones no se sobrescriben ni eliminan desde el cliente.

## Roles y operación

| Perfil | Función |
| --- | --- |
| Responsable / Administración | Usuarios, activación, roles, configuración y supervisión. |
| Ventanilla | Alta/captura inicial, requisitos, prevenciones y entrega. |
| Jefatura | Asignación, compromisos, revisión documental, devolución y revisión de documentos expedidos. |
| Dirección | Canalización, autorizaciones, devoluciones y excepciones de pago motivadas. |
| Legal | Dictamen procede/no procede, generación de documentos y revisión documental. |
| Caja / Recaudación | Registro de pagos y avance de sus etapas. |
| Finanzas | Solo consulta de pagos, folio de expediente/predio y clave catastral. Sin datos personales, archivos, escritura ni administración. |
| Digitalización | Carga de versiones y avance de digitalización. |
| Captura | Datos de identificación, contactos y referencias del predio externo. |
| Titulación | Validaciones, título, Consejería, RPP, revisión y cierre. |
| Informática | Validación del expediente; sin funciones GIS. |
| Consulta / Auditoría | Consulta de expedientes y trazabilidad, sin modificaciones. |
| Editor heredado | Conserva captura general, sin autorización de etapas por área. Se recomienda reasignarlo a un perfil operativo. |

Se pueden asignar tres o más usuarios al mismo perfil Finanzas. No se crearon cuentas sin conocer sus correos. Los roles se validan desde la membresía activa de la base de datos, no desde metadatos editables del navegador. Desactivar un usuario bloquea nuevas operaciones incluso con una sesión abierta. No elimina su historial.

El alta administrativa crea la cuenta con la API oficial de Auth, sin cambiar la sesión del administrador. Luego una función SQL exclusiva del servidor revalida al administrador y asigna el rol dentro de una transacción. Si falla la asignación, se intenta revertir únicamente la cuenta recién creada. Una cuenta existente nunca se modifica o elimina por un intento de alta. La contraseña no se guarda en tablas de negocio, bitácora o almacenamiento del navegador. La creación recibe la contraseña solo por HTTPS.

La lectura inicial es compatible con bases previas que todavía no tienen `miembros_organizacion.activo`. Solo se reintenta sin ese campo cuando PostgreSQL confirma su ausencia; una vez que existe, se respeta su valor. Los errores de carga nunca se interpretan como ausencia de membresía ni provocan nuevas organizaciones. La interfaz de trabajadores sin acceso muestra que falta asignación administrativa.

Finanzas usa exclusivamente `consultar_pagos_sgfl`, que devuelve una proyección sin propietarios, domicilios, evidencia documental o datos internos. RLS impide consultar las tablas originales por otra ruta. Los documentos se abren mediante enlaces firmados de 60 segundos y no están disponibles para Finanzas.

Las pantallas antiguas de lotes/propietarios/títulos conservan sus registros auxiliares. El nuevo seguimiento y los pagos se vinculan al expediente normalizado. Los pagos auxiliares antiguos que no tengan relación verificable con un expediente no se convierten automáticamente en pagos válidos; no deben duplicarse ni vincularse por aproximación. Si existen, se requiere conciliarlos al conectar la otra aplicación.

## Correspondencia con los requisitos

| Requisitos | Implementación / límite |
| --- | --- |
| RF-001 a RF-003 | Supabase Auth, perfiles por área, activación y reasignación conservando historial. |
| RF-004 | Se conservan catálogos existentes de municipios/fundos y tipos. Se parametrizan requisitos y plantilla; las categorías de pago y estados de seguridad siguen controlados por código/SQL. No es todavía un editor universal de catálogos. |
| RF-005 | Auditoría de acceso autenticado a la organización, altas/cambios, roles, documentos, pagos y transiciones. Los eventos de autenticación de Supabase son complementarios. |
| RF-006 a RF-012 | Folio único existente, contactos/representante, identificación externa, filtros, historial, observaciones y prevención; cierre condicionado. |
| RF-013 a RF-019 | Requisitos configurables por proceso, versiones, archivos privados, revisión con usuario/fecha/motivo. Se exige la última versión aceptada. La firma de una solicitud se coteja al revisar el documento; no hay firma electrónica. |
| RF-020 a RF-025 | Excluidos: aplicación externa de medición/cartografía/catastro. |
| RF-026 a RF-029 | Conceptos diferenciados, recibo, importe, fecha y referencia de evidencia. Caja registra; Finanzas consulta. Los pagos condicionan avance; Dirección/Administración puede autorizar una excepción motivada y auditada. No se implementó cobro en línea. |
| RF-030 | Propietarios del núcleo existente y captura. Valores catastrales permanecen en la aplicación externa. |
| RF-031 a RF-038 | Validación documental, registro del título, revisión, oficio/acuse, firma y retorno de Consejería, envío/retorno/inscripción RPP con evidencia aceptada y afectación final. Se excluye cotejo cartográfico. |
| RF-039 a RF-040 | Formato imprimible de acuse, receptor, fecha de ceremonia/entrega y archivo. Se debe incorporar el acuse firmado y aceptarlo antes de cerrar. |
| RF-041 a RF-045 | Cuatro tipos de solicitud, dictamen motivado, plantilla institucional, revisión de Jefatura, autorización de Dirección y entrega. No procede devuelve a recepción, conservando motivo. |
| RF-046 a RF-048 | Bandeja por área/usuario, asignación, compromiso y detección visual de vencimientos. Sin correo/SMS ni tareas programadas. |
| RF-049 a RF-052 | Filtros por tipo, solicitante, municipio/fundo, responsable y periodo; CSV protegido contra fórmulas; documentos/acuse imprimibles a PDF; tablero e indicadores de duración total y por etapa. Los promedios se basan en movimientos capturados, no reconstruyen tiempos históricos inexistentes. |

Reglas relevantes: las etapas no se saltan; devolver requiere motivo y una etapa anterior. Se invalidan autorizaciones al devolver o sustituir el documento expedido. Solo se puede autorizar después de revisión de Jefatura. No se admite sustituir ese documento en la etapa de entrega. El título inscrito necesita datos RPP y evidencia aceptada. No se permite borrar físicamente expedientes ni modificar los ya cerrados.

## Comprobaciones realizadas

`npm.cmd run build`: compilación correcta.

`node --test tests/*.test.js`: 21 pruebas correctas de validación, perfiles, rutas, compatibilidad del acceso, alta de trabajadores y compensación ante fallos.

`node tests/sgfl-database.mjs`: pruebas reales de PostgreSQL embebido con PGlite, en memoria, sin tocar Supabase. Instalar la herramienta temporal con `npm.cmd install --prefix .sgfl-test-tools --no-package-lock --no-save @electric-sql/pglite`.

Las pruebas ejecutan el esquema y las dos migraciones, repiten la migración SGFL y recorren ambos flujos completos. Verifican RLS de Finanzas, aislamiento entre organizaciones, denegación de escritura, usuarios desactivados, separación Jefatura/Dirección, versiones documentales, pagos/excepciones, requisitos, cronología Consejería/RPP, acuse, bloqueo de cierre/edición y métricas.

También se aplica y repite la migración de alta de trabajadores: se comprueba la promoción del correo solicitado con una identidad de prueba confirmada, que el RPC de vinculación sea exclusivo del servidor, que se revalide al administrador, que no se permita asignar propietario o cruzar organizaciones y que la bitácora registre al administrador verificado. Estos usuarios solo existen en la base en memoria de las pruebas.

Estas pruebas simulan el esquema de Auth y metadatos de Storage: no sustituyen probar los servicios de autenticación y almacenamiento reales. No se realizó prueba visual en navegador, prueba de carga ni aceptación por usuarios institucionales.

## Operación y dependencias de producción

- Configurar HTTPS, dominios, políticas de contraseña y proveedores de correo en el entorno de despliegue. Las contraseñas siguen gestionadas por Supabase Auth.
- Configurar y verificar los respaldos de PostgreSQL y **también los objetos de Storage**. Una copia de la base no equivale a una copia de los archivos. Conservar ambos con su fecha y política institucional de retención.
- Probar restauración en un proyecto separado: restaurar esquema/datos, reconstruir el bucket privado, restaurar archivos con sus rutas, iniciar sesiones de prueba y verificar pagos, versiones, historial y RLS. Registrar la fecha y el resultado. No hay evidencia de una restauración real ni garantía de disponibilidad 99% o respuesta inferior a 3 segundos.
- Revisar los logs de Auth, PostgreSQL y Storage en Supabase y los errores de la aplicación; establecer responsables de soporte. No se instaló un servicio externo de monitoreo.
- Si una carga llega a Storage pero falla su registro, no se considera documento del expediente. Esos objetos huérfanos no tienen acceso de lectura por usuarios y deben revisarse administrativamente; no se borran automáticamente.
- El conector con el otro programa, las plantillas oficiales, la conciliación de datos previos, el despliegue y las pruebas institucionales siguen dependiendo de los recursos y accesos del proyecto. No se conectó RPP, Consejería, pasarela de pagos o QGIS.

Este archivo complementa `REVISION.md`; sus notas anteriores sobre inexistencia de bitácora corresponden al estado previo a esta implementación.
