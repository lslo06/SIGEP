# Base de instalación candidata — SIGEP

Preparada el 27/11/2026 a partir de la extracción verificada del HomeLab. **Revisada estáticamente; todavía no ejecutada sobre PostgreSQL/PostGIS real.** No usar en la base activa ni tratarla como instalador completo.

## Contenido

| Archivo | Propósito |
|---|---|
| `00-roles.sql` | Crear cuenta de aplicación sin contraseña incrustada. |
| `01-esquema.sql` | 24 tablas y sus restricciones/índices/secuencias; incorpora la FK directa de documentos al expediente. |
| `02-catalogos.sql` | 22 requisitos documentales de trabajo, pendientes de validación institucional. |
| `03-permisos.sql` | Permisos de tablas/columnas/secuencias requeridos por la API. |

Origen comprobado: PostgreSQL **17.5**, PostGIS **3.5.2**, arquitectura **linux/amd64**. Imagen del origen: `postgis/postgis:17-3.5`, digest reportado `postgis/postgis@sha256:01a6a70e41e6c4467c8f55f6063555ed72db2d6662cd0d571040d42eadaeb6f6`. El digest sirve para reproducir el ensayo del origen, no implica que sea una actualización de seguridad reciente ni que corresponda a otra arquitectura.

Se conservan los esquemas históricos `fundos_legales` y extensiones del origen para no romper dependencias durante el primer ensayo. No se exportaron ni agregaron personas, usuarios, sesiones, expedientes, pagos, documentos ni geometrías. Las tablas cartográficas comienzan vacías. No hay definiciones de vistas SQL en esta extracción.

## Diferencias respecto de la extracción privada

- El esquema inicial usa una transacción y rechaza bases con alguna tabla SIGEP ya existente; no hace `DROP` ni elimina datos.
- Los esquemas auxiliares de extensiones usan `IF NOT EXISTS` para convivir con la inicialización de la imagen PostGIS.
- Se agregó `archivos_expediente_expediente_fk`, equivalente al cambio local `sql/enable_document_integrity.sql`. No repetir esa migración como requisito de esta base nueva; sí sigue siendo necesaria para actualizar un origen que no la tenga.
- Catálogos sin timestamps del servidor; las fechas se generan en destino.
- Permisos consolidados desde los SQL del repositorio. No se copiaron ACL ni propietarios del origen. No se configuró cuenta de QGIS: depende de las capas que finalmente publique.

## Ensayo pendiente en instancia aislada

1. Preparar contenedor PostgreSQL/PostGIS compatible con volumen nuevo, base `sigep` y administrador propio. No usar el volumen ni las credenciales del HomeLab activo.
2. Ejecutar con `psql -X -v ON_ERROR_STOP=1` los cuatro archivos en orden. Cada archivo confirma su propia transacción; registrar cada resultado. No ejecutar el resto si uno falla.
3. Establecer una contraseña nueva para `sigep_editor` mediante `\password sigep_editor` en sesión administrativa interactiva. Una cuenta creada sin contraseña no permite a la API autenticar por contraseña.
4. Arrancar una API de prueba con ese destino y un volumen de archivos nuevo; crear el primer administrador desde la recuperación de la web.
5. Ejecutar `check-installation.mjs`, la guía de pruebas por rol y verificar recarga, archivos, bloqueos/concurrencia y SQL real.
6. Comprobar que no hay expedientes/usuarios heredados y que sólo se cargó el catálogo esperado. Ensayar recuperación antes de declarar la entrega instalable.

No volver a ejecutar `01-esquema.sql` como actualización. Las migraciones históricas ya representadas aquí no se aplican de nuevo. Tampoco copiar este directorio sin más a `docker-entrypoint-initdb.d` mientras no estén resueltas la provisión privada de credenciales y la prueba completa.

Faltan para la entrega completa: proyecto/fuentes QGIS, configuración Nginx/proxy revisada, Compose integrado, variables definitivas, comprobación del esquema en motor real y aceptación. Ver [Preparar entrega](../../docs/preparar-entrega.md).
