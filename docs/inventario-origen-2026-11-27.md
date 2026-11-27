# Inventario de origen confirmado — 27/11/2026

Fuente: salida de `docker ps` y del extractor proporcionadas por Eduardo. No es inspección directa de los contenedores desde este entorno. Sólo se incluyen servicios relacionados o potencialmente relacionados con SIGEP.

| Contenedor | Imagen declarada | Publicación en host |
|---|---|---|
| `sigep-predio-api` | `sigep-predio-api:permisos-20261126-095437` | `127.0.0.1:8100` → 8100. |
| `sigep-postgis` | `postgis/postgis:17-3.5` | `127.0.0.1:5432` → 5432. |
| `qgis-server` | `qgis/qgis-server:ltr` | 8088 → 80; también declara 9993 interno. |
| `sigep-mapeo` | `nginx:alpine` | 8081 → 80. Monta el compilado en `/usr/share/nginx/html`; configuración efectiva de Nginx pendiente de recuperar. |
| `caddy` | `caddy:2` | 80/443; proxy compartido con otros servicios. Extraer sólo configuración relevante, revisada y sin secretos. |

Las etiquetas `ltr`, `alpine` y `2` no fijan por sí solas un digest ni la versión exacta. Recuperar los IDs/digests y versiones efectivas antes de cerrar la entrega. El listado de puertos no acredita cómo se enruta WMS ni qué sirve Nginx.

## Montajes confirmados por inspección del usuario

| Servicio | Origen en el host | Destino en contenedor | Modo |
|---|---|---|---|
| QGIS | `/home/eduardo/homelab/qgis-server/data` | `/io/data` | Sólo lectura. |
| Nginx | `/home/eduardo/sigep-mapeo/dist` | `/usr/share/nginx/html` | Sólo lectura. |

Compose de QGIS: `/home/eduardo/homelab/qgis-server/docker-compose.yml`; directorio de proyecto `/home/eduardo/homelab/qgis-server`. `sigep-mapeo` no reporta etiquetas Compose. El nombre del archivo `.qgs`/`.qgz` aún no se conoce. El compilado desplegado no debe reemplazar las fuentes actuales: se reconstruirá desde la versión de código elegida.

## Extracción inicial

El usuario ejecutó la validación de sintaxis Bash seguida del extractor, con finalización correcta. Resultado:

- Carpeta: `/home/eduardo/sigep-extraccion-20261127-112230-lsnhVc`.
- Archivo: `/home/eduardo/sigep-extraccion-20261127-112230-lsnhVc.tar.gz`.
- Descarga revisada: hash del archivo y 14 hashes internos correctos; PostgreSQL 17.5 / PostGIS 3.5.2. [Resultado de revisión](revision-extraccion-2026-11-27.md).
- Rutas QGIS/Nginx identificadas; pendiente capturar/revisar su contenido y ensayar el instalador.

## Siguiente inspección, de sólo lectura

En el HomeLab:

```bash
docker inspect --format 'Nombre={{.Name}}
Imagen={{.Config.Image}}
Montajes={{json .Mounts}}
Compose={{index .Config.Labels "com.docker.compose.project.config_files"}}
DirectorioCompose={{index .Config.Labels "com.docker.compose.project.working_dir"}}' qgis-server sigep-mapeo
```

La inspección ya confirmó `/io/data`, no `/projects`, para este origen. No reiniciar ni reemplazar servicios para extraer estos archivos. Los comandos de extracción con las rutas confirmadas están en [Preparar entrega, sección 3](preparar-entrega.md).
