# Preparar el paquete instalable de SIGEP

27/11/2026. Para quien prepara la entrega, antes de seguir el [manual de instalación](manual-instalacion.md).

## 1. Qué hay y qué falta

| Material | Resultado de la revisión local |
|---|---|
| Web, API, dependencias fijadas por lockfiles y Dockerfile API | Presentes. |
| SQL incrementales | Presentes; parten de una base territorial existente. |
| Esquema completo del servidor | Descargado y verificado; base candidata en `deploy/database`, pendiente de ensayo en PostgreSQL. |
| Catálogos iniciales aprobados | Recuperados 22 requisitos documentales de trabajo; falta validación institucional y definir otros datos iniciales. |
| Proyecto QGIS y fuentes de las tres capas | No están en este checkout. |
| Compose de todos los servicios y proxy | No están en este checkout. Hay que recuperar configuración y convertirla en plantillas. |
| Cambios recientes | Modificados/nuevos sin commit; no forman parte del commit actual `dbba868`. |
| Comparación en vivo con GitHub | No verificada: la consulta remota falló por conexión. La referencia local `origin/main` coincide con HEAD, pero puede estar desactualizada. |

Un commit no contiene modificaciones sin guardar en Git. El ZIP local tampoco acredita que represente la versión instalada. La extracción del servidor y el código deben conciliarse antes de etiquetar una entrega.

Revisión realizada sobre la primera descarga: [Hallazgos y base candidata](revision-extraccion-2026-11-27.md). QGIS todavía no estaba incluido.

## 2. Copiar el extractor desde Windows al HomeLab

En PowerShell, desde la carpeta del proyecto:

```powershell
cd C:\Proyectos\SIGEP\menu
scp .\scripts\extraer-instalacion.sh eduardo@192.168.1.74:~/extraer-instalacion.sh
ssh eduardo@192.168.1.74
```

En la terminal Linux que se abre:

```bash
bash ~/extraer-instalacion.sh
```

Con los nombres conocidos extrae la estructura de `sigep` desde `sigep-postgis` usando `sigep_admin`; no pide ni imprime las contraseñas del contenedor. Si la autenticación local exige credenciales, usar el mecanismo privado de PostgreSQL del operador; no pegar contraseñas en la línea de comandos.

El script crea una carpeta única y un `.tar.gz` en el home del operador. No reinicia contenedores ni modifica registros del servidor. Sin la ruta QGIS, deja un aviso de que esa parte falta.

Contenido recuperado:

- `sql/01-esquema-origen.sql`: tablas, vistas SQL, secuencias, funciones, restricciones y demás estructura exportable, sin filas ni propietarios/permisos originales.
- `sql/02-requisitos-origen.sql`: únicamente el catálogo de requisitos documentales, si existe. Ningún otro conjunto de filas se exporta automáticamente.
- `inventario/`: imágenes, versiones, extensiones, nombres de tablas/vistas/columnas, redes y montajes. Omite variables de entorno y líneas de ejecución.
- `qgis/`: proyecto y archivos de la carpeta que se indique, o un aviso de pendiente.
- `SHA256SUMS` y un checksum del archivo comprimido.

Un esquema sin filas no garantiza ausencia de secretos: funciones SQL, servidores externos y conexiones del proyecto pueden contener credenciales literales. El material se trata como privado hasta revisarlo. No se exporta `pg_dumpall --globals-only` porque incluye roles y puede incluir hashes de contraseñas.

## 3. Identificar y recuperar QGIS

**Rutas del HomeLab ya confirmadas:** proyecto/recursos en `/io/data` dentro de `qgis-server`; Compose en `/home/eduardo/homelab/qgis-server/docker-compose.yml`; frontend servido por `sigep-mapeo`. Tras volver a copiar la versión actualizada de `scripts/extraer-instalacion.sh`, usar en el HomeLab:

```bash
bash -n ~/extraer-instalacion.sh && \
SIGEP_QGIS_CONTAINER=qgis-server \
SIGEP_QGIS_DIR=/io/data \
SIGEP_QGIS_COMPOSE=/home/eduardo/homelab/qgis-server/docker-compose.yml \
SIGEP_WEB_CONTAINER=sigep-mapeo \
bash ~/extraer-instalacion.sh
```

Genera una extracción nueva, conservando la anterior. Añade proyecto/recursos de esa carpeta, inventario de QGIS/Nginx, Compose original y salida de `nginx -T` en archivos privados. No reinicia ni recarga Nginx. El Compose puede incluir claves: no pegar su contenido en el chat ni publicarlo sin revisión. No copia automáticamente fuentes cartográficas fuera de `/io/data` ni el contenido de `dist`, que debe reconstruirse desde el código de la entrega.

La versión básica del extractor ya se ejecutó en el servidor. Las opciones nuevas de Compose/Nginx requieren validar sintaxis y ejecución allí. El procedimiento general siguiente queda para otros despliegues con rutas distintas.

En el HomeLab:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

Identificar el nombre real del contenedor QGIS. Sustituir el marcador siguiente:

```bash
sigep_qgis='NOMBRE_REAL_DEL_CONTENEDOR_QGIS'
docker inspect --format 'Imagen={{.Config.Image}} Montajes={{json .Mounts}} Puertos={{json .HostConfig.PortBindings}}' "$sigep_qgis"
```

En los montajes, `Source` es la ruta/volumen del host; `Destination` es la ruta **dentro del contenedor**. Identificar el montaje del proyecto. También puede consultarse el valor ya configurado de `VITE_QGIS_MAP` en la PC; es una ruta del proyecto que debe contrastarse con los montajes.

Si, por ejemplo, la carpeta dedicada del proyecto dentro del contenedor es `/projects/sigep`, ejecutar:

```bash
SIGEP_QGIS_CONTAINER="$sigep_qgis" \
SIGEP_QGIS_DIR='/projects/sigep' \
bash ~/extraer-instalacion.sh
```

La ruta del ejemplo se debe reemplazar; no se confirmó esa ruta en el servidor. Para ver qué contiene un directorio montado, si la imagen dispone de `ls`, usar `docker exec "$sigep_qgis" ls -la /RUTA_REAL`. No listar todas las variables de entorno ni copiar la raíz del contenedor.

Copiar el proyecto no copia automáticamente todas sus fuentes. Revisar en QGIS Desktop, para cada capa:

| Fuente | Qué llevar |
|---|---|
| GeoPackage / ráster / Shapefile | Archivos completos y sus complementos. En Shapefile, incluir al menos `.shp`, `.shx`, `.dbf` y referencia espacial; preferir el conjunto completo. |
| PostGIS | Tablas/vistas de estructura y datos cartográficos autorizados. El extractor de esquema no incluye las geometrías almacenadas como filas. |
| XYZ / WMS externo | Conexión y derechos de uso; el `.qgz` sólo conserva la referencia, no todas las imágenes. |
| Estilos, SVG, fuentes y diseños | Archivos externos utilizados por el proyecto, con rutas portables. |
| `authcfg` o servicios de conexión | Configurar credenciales nuevas en el destino; no distribuir la base de autenticación personal de QGIS. |

Los botones actuales son Calles, Satélite y Topográfico. Si por “vistas” se hace referencia a vistas SQL, sus definiciones van en el esquema; los tres fondos del mapa se publican desde QGIS Server. PostGIS es la extensión espacial de PostgreSQL. Los scripts `.sql` y `.sh` automatizan su preparación; PostScript es otro formato y no es necesario para instalar SIGEP.

## 4. Descargar la extracción a una carpeta privada de la PC

El script imprime el nombre exacto del `.tar.gz`. En una **nueva terminal PowerShell local**, reemplazar el nombre del ejemplo:

```powershell
cd C:\Proyectos\SIGEP\menu
New-Item -ItemType Directory -Force -Path .\entrega-privada | Out-Null
scp eduardo@192.168.1.74:~/sigep-extraccion-FECHA-SUFIJO.tar.gz .\entrega-privada\
scp eduardo@192.168.1.74:~/sigep-extraccion-FECHA-SUFIJO.tar.gz.sha256 .\entrega-privada\
Get-FileHash .\entrega-privada\sigep-extraccion-FECHA-SUFIJO.tar.gz -Algorithm SHA256
Get-Content .\entrega-privada\sigep-extraccion-FECHA-SUFIJO.tar.gz.sha256
tar -tzf .\entrega-privada\sigep-extraccion-FECHA-SUFIJO.tar.gz
```

Comparar los hashes. Revisar la lista y extraer el archivo propio en esa carpeta con `tar -xzf ARCHIVO -C .\entrega-privada`. Esta carpeta está excluida de Git. El contenido exportado todavía no debe sustituir el SQL del proyecto ni ejecutarse sobre la base activa.

## 5. Convertir el material recuperado en instalador

1. Conciliar la estructura exportada con el código nuevo, incluyendo `enable_document_integrity.sql`. No aplicar nuevamente todas las migraciones sobre un esquema que ya las contiene.
2. Preparar un SQL base versionado y revisado. El esquema inicial debe funcionar en una BD nueva; retirar dependencias históricas sólo después de comprobar que no se necesitan. Verificar extensiones, funciones, triggers, vistas, secuencias, restricciones y permisos.
3. Preparar catálogos mínimos aprobados. Excluir usuarios, sesiones, personas, pagos y expedientes reales; seleccionar por separado cartografía pública/autorizada si corresponde.
4. Crear roles de servicio nuevos y permisos mínimos. Una exportación `--no-privileges --no-owner` no da permisos a la API. Crear las cuentas y contraseñas en destino; no reutilizar las de HomeLab.
5. Revisar proyecto QGIS sin claves incrustadas, normalizar rutas, incorporar sus fuentes y comprobar los nombres WMS que solicita el cliente.
6. Recuperar de forma privada el Compose/Dockerfile del QGIS actual y la configuración de su servidor HTTP/proxy. Usarlos como referencia para plantillas sin secretos. No ejecutar ni publicar una salida completa de `docker compose config` con variables resueltas.
7. Consolidar Compose con servicios separados `db`, `api`, `qgis` y `web`. Si QGIS requiere FastCGI, incluir su pasarela HTTP según la imagen. Preparar redes, volúmenes, health checks y variables con las versiones verificadas.
8. Ensayar una instalación en otro servidor/VM o proyecto Compose y volúmenes vacíos. Luego probar restauración y los roles. Sólo después etiquetar la versión y comprimir el paquete final.

## 6. Estructura objetivo de la entrega

Los nombres siguientes describen lo que falta consolidar; no son archivos ya generados ni un instalador ejecutable hoy.

| Ruta del paquete | Contenido |
|---|---|
| `VERSION.txt` / `SHA256SUMS` | Commit de aplicación, versión de esquema, imágenes/digests y hashes. |
| `compose.yaml` | Servicios, red, volúmenes, dependencias y salud. |
| `config/*.env.example` | Variables sin claves y documentación de su uso. |
| `sql/00-roles.sql` | Roles de aplicación/lectura; credenciales por mecanismo privado. |
| `sql/01-esquema.sql` | Esquema inicial validado contra esa versión. |
| `sql/02-catalogos.sql` / `03-permisos.sql` | Catálogos iniciales y privilegios mínimos. |
| `sql/migraciones/` | Cambios posteriores a la versión base, con registro de aplicación. |
| `qgis/proyecto.qgz`, `qgis/datos/`, `qgis/estilos/` | Proyecto y recursos revisados. |
| `proxy/` | Publicación web, API y WMS; plantilla de TLS institucional. |
| `web/`, `api/` o imágenes OCI | Compilado e imágenes de la misma versión; fuentes aparte si se entregan. |
| `scripts/` | Inicialización, validación, respaldo y restauración ensayados. |
| `docs/` | Manuales y evidencia de instalación/pruebas. |

En intranet desconectada incluir también las imágenes para `docker load`, las fuentes cartográficas locales y dependencias que la instalación necesite. Un paquete con sólo `.qgz` y enlaces XYZ externos no funciona completamente sin Internet.

## 7. Verificar y publicar el código pendiente

En PowerShell local:

```powershell
git status --short
git diff --stat
git fetch origin
git log --oneline --left-right HEAD...origin/main
npm.cmd test
npm.cmd run build
```

Revisar los nuevos archivos además de los diffs: `git diff` no muestra archivos sin seguimiento. Elegir explícitamente qué se agrega al commit; incluir las eliminaciones del editor antiguo y los módulos nuevos que ahora importa el código. Excluir `entrega-privada`, entornos, invitaciones, ZIPs y `sql/reset_demo_users.sql` del paquete institucional. Antes de confirmar, revisar `git diff --cached --stat` y `git diff --cached`; después crear el commit y hacer push a la rama acordada. Si el remoto avanzó, integrar esos cambios antes de publicar.

Subir a GitHub no reconstruye por sí solo los contenedores ni actualiza el esquema. La entrega debe registrar la misma versión para web, API y base.

## Fuentes técnicas

- [PostgreSQL: pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html).
- [Docker: copiar archivos desde contenedores](https://docs.docker.com/reference/cli/docker/container/cp/).
- [Docker: Compose en producción](https://docs.docker.com/compose/how-tos/production/).
- [QGIS Server: publicar y configurar proyectos](https://docs.qgis.org/3.44/en/docs/server_manual/getting_started.html).

Consultadas el 27/11/2026. El extractor requiere Bash y Docker en Linux. La validación local de Bash no pudo arrancar por permisos de MSYS. Posteriormente Eduardo ejecutó `bash -n ~/extraer-instalacion.sh && bash ~/extraer-instalacion.sh` en el HomeLab y aportó salida de finalización correcta: `/home/eduardo/sigep-extraccion-20261127-112230-lsnhVc.tar.gz`. Esto acredita que terminó la extracción básica en el origen; el contenido aún no se ha descargado/revisado aquí ni probado como instalador. QGIS todavía requiere indicar su carpeta. Ver [Inventario confirmado del origen](inventario-origen-2026-11-27.md).
