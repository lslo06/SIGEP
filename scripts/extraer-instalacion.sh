#!/usr/bin/env bash
# Execute on the Linux Docker host. Read-only against running services.
set -Eeuo pipefail
umask 077

sigep_db_container=${SIGEP_DB_CONTAINER:-sigep-postgis}
sigep_db_user=${SIGEP_DB_ADMIN:-sigep_admin}
sigep_db_name=${SIGEP_DB_NAME:-sigep}
sigep_api_container=${SIGEP_API_CONTAINER:-sigep-predio-api}
sigep_qgis_container=${SIGEP_QGIS_CONTAINER:-}
sigep_qgis_dir=${SIGEP_QGIS_DIR:-}
sigep_qgis_compose=${SIGEP_QGIS_COMPOSE:-}
sigep_web_container=${SIGEP_WEB_CONTAINER:-}
sigep_output=''

if [[ ${1:-} == --help ]]; then
  cat <<'HELP'
Uso: bash extraer-instalacion.sh
Variables opcionales: SIGEP_DB_CONTAINER, SIGEP_DB_ADMIN, SIGEP_DB_NAME,
SIGEP_API_CONTAINER, SIGEP_QGIS_CONTAINER, SIGEP_QGIS_DIR,
SIGEP_QGIS_COMPOSE (archivo del host) y SIGEP_WEB_CONTAINER (Nginx).
SIGEP_QGIS_DIR debe ser la carpeta dedicada del proyecto dentro del contenedor.
Sin ella se exportan SQL e inventario, dejando QGIS pendiente.
La carpeta generada es material PRIVADO para revisión, no un instalador listo.
El Compose original puede contener secretos; no publicarlo sin revisión.
HELP
  exit 0
fi
if [[ $# -ne 0 ]]; then printf 'Argumento desconocido; usa --help.\n' >&2; exit 2; fi
for sigep_command in docker mktemp tar sha256sum find sort xargs chmod date dirname basename mkdir; do
  command -v "$sigep_command" >/dev/null || { printf 'Falta: %s\n' "$sigep_command" >&2; exit 1; }
done
if [[ -n "$sigep_qgis_compose" ]]; then
  [[ "$sigep_qgis_compose" == /* && -f "$sigep_qgis_compose" && -r "$sigep_qgis_compose" ]] || {
    printf 'El Compose indicado debe ser un archivo absoluto legible del host.\n' >&2; exit 2;
  }
fi
if [[ -n "$sigep_qgis_dir" ]]; then
  [[ -n "$sigep_qgis_container" && "$sigep_qgis_dir" == /* ]] || {
    printf 'Para copiar QGIS indica contenedor y ruta absoluta de su proyecto.\n' >&2; exit 2;
  }
  case "$sigep_qgis_dir" in /|/etc|/var|/home|/usr|/data)
    printf 'Indica la carpeta dedicada del proyecto, no una raíz genérica.\n' >&2; exit 2;;
  esac
fi
docker inspect "$sigep_db_container" >/dev/null
sigep_output=$(mktemp -d "$HOME/sigep-extraccion-$(date +%Y%m%d-%H%M%S)-XXXXXX")
trap 'printf "Extracción incompleta. Conservada para diagnóstico: %s\n" "$sigep_output" >&2' ERR
mkdir "$sigep_output/sql" "$sigep_output/inventario" "$sigep_output/qgis" "$sigep_output/config"
date -u +%FT%TZ > "$sigep_output/inventario/fecha-utc.txt"
docker version --format '{{json .}}' > "$sigep_output/inventario/docker-version.json"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' > "$sigep_output/inventario/contenedores.txt"

# Deliberately omit environment, labels, command lines and complete inspect output.
sigep_inventory() {
  local sigep_container=$1 sigep_label=$2 sigep_image_id
  if ! docker inspect "$sigep_container" >/dev/null 2>&1; then
    printf 'No encontrado: %s\n' "$sigep_container" > "$sigep_output/inventario/$sigep_label-pendiente.txt"
    return
  fi
  docker inspect --format '{"nombre":{{json .Name}},"imagen":{{json .Config.Image}},"image_id":{{json .Image}},"usuario":{{json .Config.User}},"reinicio":{{json .HostConfig.RestartPolicy}},"puertos":{{json .HostConfig.PortBindings}},"montajes":{{json .Mounts}},"redes":{{json .NetworkSettings.Networks}}}' \
    "$sigep_container" > "$sigep_output/inventario/$sigep_label.json"
  sigep_image_id=$(docker inspect --format '{{.Image}}' "$sigep_container")
  docker image inspect --format '{"id":{{json .Id}},"digests":{{json .RepoDigests}},"os":{{json .Os}},"arquitectura":{{json .Architecture}}}' \
    "$sigep_image_id" > "$sigep_output/inventario/$sigep_label-imagen.json"
}
sigep_inventory "$sigep_db_container" postgres
sigep_inventory "$sigep_api_container" api
if [[ -n "$sigep_qgis_container" ]]; then sigep_inventory "$sigep_qgis_container" qgis; fi
if [[ -n "$sigep_web_container" ]]; then sigep_inventory "$sigep_web_container" web; fi

sigep_psql() {
  docker exec "$sigep_db_container" psql -X -U "$sigep_db_user" -d "$sigep_db_name" -v ON_ERROR_STOP=1 "$@"
}
sigep_psql -c 'SELECT version(); SELECT extname, extversion FROM pg_extension ORDER BY extname;' > "$sigep_output/inventario/postgres-extensiones.txt"
sigep_psql -c "SELECT table_schema,table_name,table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1,2;" > "$sigep_output/inventario/tablas-vistas.txt"
sigep_psql -c "SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema,table_name,ordinal_position;" > "$sigep_output/inventario/columnas.txt"

# Structure only: no rows, passwords/roles dump, or production ACLs.
# Functions, foreign-server definitions and QGIS connections still need review.
docker exec "$sigep_db_container" pg_dump -U "$sigep_db_user" -d "$sigep_db_name" \
  --schema-only --no-owner --no-privileges --no-comments --no-security-labels --no-tablespaces \
  > "$sigep_output/sql/01-esquema-origen.sql"
test -s "$sigep_output/sql/01-esquema-origen.sql"

# The only data export is the documentary-requirements catalogue.
sigep_catalog=$(sigep_psql -Atc "SELECT to_regclass('public.requisitos_documentales') IS NOT NULL;")
if [[ "$sigep_catalog" == t ]]; then
  docker exec "$sigep_db_container" pg_dump -U "$sigep_db_user" -d "$sigep_db_name" \
    --data-only --table=public.requisitos_documentales --column-inserts --no-owner --no-privileges \
    > "$sigep_output/sql/02-requisitos-origen.sql"
fi

if [[ -n "$sigep_qgis_dir" ]]; then
  docker cp "$sigep_qgis_container:${sigep_qgis_dir%/}/." "$sigep_output/qgis/"
  # Protect recovered files even if their original mode allowed broad access.
  find "$sigep_output/qgis" -type d -exec chmod 700 {} +
  find "$sigep_output/qgis" -type f -exec chmod 600 {} +
else
  printf 'Pendiente copiar proyecto y fuentes QGIS. No está completo el paquete.\n' > "$sigep_output/qgis/PENDIENTE.txt"
fi
if [[ -n "$sigep_qgis_compose" ]]; then
  # Copy the source file without expanding environment variables or printing it.
  cat -- "$sigep_qgis_compose" > "$sigep_output/config/qgis-compose-origen.yaml"
fi
if [[ -n "$sigep_web_container" ]]; then
  # Dumps and checks the running Nginx configuration; does not reload the service.
  docker exec "$sigep_web_container" nginx -T > "$sigep_output/config/nginx-origen.txt" 2>&1
fi
cat > "$sigep_output/LEEME-PRIVADO.txt" <<'NOTE'
EXTRACCIÓN PARA REVISIÓN; NO ES UN INSTALADOR VALIDADO.
No contiene un volcado de filas de expedientes, personas, usuarios ni sesiones.
Sí contiene estructura SQL y, si existe, catálogo de requisitos documentales.
Revisar funciones/servidores externos del SQL: pueden contener secretos literales.
Revisar el catálogo antes de distribuirlo. No incluye otros catálogos ni cartografía PostGIS.
QGIS puede contener claves, authcfg, rutas privadas o datos dentro de archivos locales.
No publicar esta carpeta directamente en GitHub. No se consulta Config.Env.
El Compose original y la configuración Nginx pueden contener claves o rutas privadas.
No se copian archivos .env por separado ni se expanden variables del Compose.
El copiado QGIS sólo incluye la carpeta indicada: dependencias externas quedan pendientes.
Los enlaces simbólicos no garantizan que su destino forme parte del paquete.
No hubo reinicio, migración, escritura en BD ni cambio de permisos en el origen.
El esquema es del servidor; hay que conciliarlo con las migraciones del release.
NOTE
(
  cd "$sigep_output"
  find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
)
tar -czf "$sigep_output.tar.gz" -C "$(dirname "$sigep_output")" "$(basename "$sigep_output")"
sha256sum "$sigep_output.tar.gz" > "$sigep_output.tar.gz.sha256"
trap - ERR
printf '\nExtracción terminada para REVISIÓN.\nCarpeta: %s\nArchivo: %s.tar.gz\n' "$sigep_output" "$sigep_output"
