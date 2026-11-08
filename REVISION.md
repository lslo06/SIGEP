# Revisión de Fundos

## Cambios

- «Agregar» y editar abren una pestaña con todos los campos, incluidos los que antes se ocultaban en «Mostrar más». La captura usa tarjetas temáticas, índice de secciones, etiquetas de 13 px, entradas de 14 px (16 px en móvil), indicaciones permanentes y acciones de guardado visibles. Conserva la paleta azul. Se vuelve al listado tras guardar; si se bloquean pestañas nuevas, se usa una vista dedicada en la aplicación.
- La captura conserva los datos si falla el guardado y avisa al intentar salir con cambios pendientes. No se verificó este flujo en un navegador; la comprobación local incluye compilación.

- Paleta azul original conservada, encabezados de tabla visibles y formularios desplazables.
- Prioridades calculadas desde expedientes reales, con el mismo criterio en el resumen y los filtros. Las notificaciones abren la bandeja prioritaria.
- Validación de superficie positiva y fechas de solicitud/entrega; autorización de escritura explícita por rol.
- Fecha inicial del trámite en la zona de Ciudad de México.
- Protección de exportaciones CSV contra fórmulas introducidas como texto.
- En SQL: serialización de guardados por organización y rechazo de cambios de un predio compartido que alterarían otros trámites.

## Base de datos

Diagnóstico remoto confirmado: `organizaciones` responde HTTP 200 y `modulo_registros` responde HTTP 404 / PGRST205 (tabla ausente del esquema expuesto).

La reparación específica está en `supabase/migrations/20261103_habilitar_modulos.sql`: crea la tabla, índices, fecha de actualización, permisos y políticas RLS en una transacción. Ejecutarla en Supabase SQL Editor con un usuario administrador. No se ha ejecutado remotamente porque el proyecto local dispone únicamente de una clave pública del frontend.

La instalación corresponde al responsable de la base de datos y se ejecuta una sola vez en Supabase. La interfaz no ofrece descargas SQL ni instrucciones de instalación a ningún rol. Bloquea nuevas capturas mientras la tabla no esté disponible y distingue fallos de carga de una lista vacía. Tras ejecutar la migración, recargar la aplicación.

La aplicación usa Supabase Auth y PostgreSQL directamente, con políticas RLS. Las tablas de predios y expedientes tienen relaciones compuestas por organización, lo que impide vincular registros entre organizaciones.

Las correcciones de funciones están en `supabase/schema.sql`. Para instalarlas en una base existente, ejecutar ese archivo en Supabase SQL Editor y verificar primero en un entorno de prueba. No se aplicaron cambios remotos desde esta revisión.

## Límites y asuntos pendientes

- Los módulos guardan datos independientes en `modulo_registros`; los propietarios, lotes y pagos capturados allí no se sincronizan con las tablas normalizadas de los expedientes. Unificar esos flujos requiere definir cuál será la fuente de verdad y migrar los datos existentes.
- El histórico consulta registros actuales; no constituye una bitácora inmutable de modificaciones. Se necesita una tabla de auditoría si se requiere trazabilidad completa.
- El plano es una ilustración; no hay integración catastral o QGIS.
- Las prioridades utilizan el campo manual «En espera»; no existe una fecha límite para calcular vencimientos reales.
- No se verificaron sesiones, permisos efectivos, datos existentes ni operaciones reales contra la instancia remota. Tampoco se verificó visualmente en navegador.

## Verificación local

`npm run build`

`node --test tests/validation.test.js`
