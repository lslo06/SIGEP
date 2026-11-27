# Revisión de extracción del servidor — 27/11/2026

Se encontró y extrajo localmente `entrega-privada/sigep-extraccion-20261127-112230-lsnhVc.tar.gz`. El SHA256 coincide con el archivo descargado; los **14 archivos** del manifiesto interno también coinciden. Los archivos privados permanecen excluidos de Git.

## Hallazgos

- Origen PostgreSQL 17.5 / PostGIS 3.5.2, linux/amd64. El inventario confirma persistencia de PostgreSQL mediante bind mount a `/var/lib/postgresql/data`.
- Estructura: **24 tablas**, incluyendo tablas históricas bajo `fundos_legales`. No se encontraron definiciones de vistas SQL, funciones de aplicación, servidores externos ni user mappings en el SQL exportado.
- No hay inserciones de usuarios ni expedientes en el esquema. La aparición de `password` corresponde a la definición de la columna `password_hash`, no a un valor recuperado.
- Catálogo: **22 requisitos documentales**, correspondientes a los seis tipos de trámite. No representa validación legal/institucional de esos requisitos.
- Falta en el origen exportado la FK directa `archivos_expediente_expediente_fk`, ya preparada como migración local.
- La carpeta QGIS sólo contiene `PENDIENTE.txt`; no se recibió `.qgs`/`.qgz`, cartografía ni inventario de montajes de QGIS/Nginx.

## Trabajo preparado

Se generó [base de instalación candidata](../deploy/database/README.md), con roles, esquema, catálogos y permisos separados. Conserva estructura compatible con el origen e incorpora la FK local pendiente. No contiene registros de negocio, contraseñas ni ACL de origen.

Validación realizada: hashes, revisión de estructura y catálogo, contraste de columnas del verificador de instalación y permisos con migraciones locales. **No se ejecutó el SQL en PostgreSQL/PostGIS**: falta el ensayo en una instancia aislada. La comparación estática no acredita restricciones, privilegios efectivos, rendimiento ni restauración real.

## Siguiente insumo necesario

La salida de montajes/configuración de `qgis-server` y `sigep-mapeo` permitirá ubicar qué copiar. No asumir rutas del proyecto. El comando de sólo lectura está en [Inventario del origen](inventario-origen-2026-11-27.md). Después se recuperan recursos cartográficos y configuración, se revisan secretos/rutas, se completa Compose y se ensaya una instalación limpia.
