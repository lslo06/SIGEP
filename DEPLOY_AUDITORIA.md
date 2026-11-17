# Actualizar auditoría en HomeLab

El alta de expedientes y las correcciones cartográficas usan el correo de la sesión. Cada pago agrega un movimiento con identificador de pago, concepto, recibo, importe, fecha, evidencia y correo. Pago y movimiento se confirman juntos; cualquier fallo revierte ambos. El expediente se bloquea durante el registro para coordinarlo con cambios de estado concurrentes.

No se reconstruye el actor de registros anteriores. No hay cambios de interfaz.

## 1. Publicar desde la computadora de desarrollo

Después de revisar el diff, desde `C:\Proyectos\SIGEP\menu`:

```powershell
git add api/server.mjs sql/enable_pago_audit_lock.sql tests/audit.test.js DEPLOY_AUDITORIA.md
git commit -m "Corrige actores de auditoria y registra pagos con historial atomico"
git push
```

Si trabajas en una rama, integra primero por el flujo habitual del equipo. HomeLab debe descargar la rama que contenga estos cambios. El README existente no forma parte de este cambio.

## 2. Identificar el despliegue existente

Conéctate por SSH y localiza el contenedor de la API:

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Para despliegues Compose, consulta las etiquetas del contenedor (sustituye `CONTENEDOR_API`):

```bash
docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' CONTENEDOR_API
docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' CONTENEDOR_API
docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' CONTENEDOR_API
```

El repositorio no incluye Compose ni confirma su ubicación o nombre de servicio en HomeLab. Conserva el entorno, red y puertos existentes. Comprueba que el contexto de construcción del servicio apunte al directorio `api/` del checkout actualizado. Si no usa Compose, reconstruye y recrea con el mecanismo original; reiniciar el contenedor no incorpora el código nuevo.

## 3. Actualizar código y permiso SQL

En el checkout del repositorio en HomeLab, con la rama de despliegue seleccionada:

```bash
git pull --ff-only
docker exec -i sigep-postgis psql -U sigep_admin -d sigep -v ON_ERROR_STOP=1 < sql/enable_pago_audit_lock.sql
```

Sustituye el contenedor de PostgreSQL si tiene otro nombre y usa la autenticación administrativa existente. La migración es repetible y requiere que ya exista `public.expedientes`. Concede `UPDATE (id)` porque PostgreSQL requiere permiso de actualización sobre al menos una columna para `SELECT FOR UPDATE`; la API no modifica ese identificador. También deben estar aplicadas las migraciones existentes de expedientes, pagos, historial cartográfico y sesiones locales.

## 4. Reconstruir y verificar

Desde el directorio del Compose real (sustituye archivo y servicio con los valores identificados):

```bash
docker compose -f RUTA_COMPOSE up -d --build SERVICIO_API
docker compose -f RUTA_COMPOSE logs --tail=80 SERVICIO_API
curl -i http://127.0.0.1:8100/health
curl -i http://127.0.0.1:8100/api/sesion
```

Se espera salud `200` y sesión sin autenticar `401`. Si el Compose solo referencia una imagen, primero constrúyela con `docker build -t IMAGEN_DEL_SERVICIO api` desde el checkout, usando exactamente la etiqueta del servicio, y recréalo con Compose.

En una instancia de pruebas con datos ficticios, verifica el correo en el alta y en una corrección sin enviar actor; registra un pago y consulta el movimiento en Seguimiento. Repite recibo y concepto: debe responder `409` sin agregar otro pago ni movimiento. La validación automatizada usa un cliente SQL simulado; no sustituye esta comprobación con PostgreSQL/PostGIS real.

## Pruebas locales

```powershell
node --test tests/*.test.js
node --check api/server.mjs
npm.cmd run build
```
