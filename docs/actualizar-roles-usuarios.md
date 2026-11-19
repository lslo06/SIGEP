# Actualización de roles y usuarios

Fecha: 19/11/2026. Aplicar después de la versión a60a5d4 ya desplegada en HomeLab.

## Cambios

- 13 roles institucionales disponibles para nuevas cuentas. owner/editor dejan de ser roles válidos; no existían en la tabla de usuarios locales. Finanzas existente conserva consulta de pagos y puede reasignarse, pero ya no se ofrece al crear cuentas.
- Una matriz compartida en api/permissions.mjs define módulos y capacidades para API, navegación y pruebas.
- Captura no puede modificar geometría. Cartografía y Administración sí.
- Los lectores de expedientes (Ventanilla, Legal, Digitalización, Captura, Titulación, Informática, Dirección, Jefatura y Auditor) pueden consultar sus adjuntos técnicos. La escritura sigue separada: evidencia por topógrafo asignado; plano por Cartografía/Administración. La consulta general de expedientes sigue siendo común; todavía no hay asignación por área de todos los trámites.
- Panel administrativo con sesión individual admin; clave de recuperación conservada para acceso inicial o recuperación. Esta vía queda identificada en auditoría como recuperación, no como una persona.
- Edita nombre, correo, rol, activo y contraseña. Cada edición revoca sesiones. Editar la propia cuenta obliga a iniciar sesión de nuevo.
- Elimina mediante baja lógica: desactiva, revoca sesiones y oculta del listado. Conserva usuario, correo reservado, documentos e historial. No se puede eliminar/desactivar/degradar al último administrador ni quitarse el acceso a uno mismo.
- Cambios administrativos y auditoría se guardan en la misma transacción. No se registran contraseñas ni hashes en la bitácora.
- Resumen de Inicio sin campos de título/costos/RPP que no se cargaban. Tarjetas de pagos/títulos visibles solo a roles con ese módulo. Borradores de documentos solo para Legal.
- Integración con 4ce223a: Digitalización ya puede cargar y revisar documentos generales; Cartografía/Administración capturan y revisan datos catastrales. Autorizaciones y titulación completa permanecen pendientes.

## 1. PowerShell en la PC

Ejecutar desde el proyecto; no hace falta Git en HomeLab:

```powershell
cd C:\Proyectos\SIGEP\menu
ssh eduardo@192.168.1.74 "mkdir -p ~/sigep-api-roles-20261119"
scp api/server.mjs api/attachments.mjs api/permissions.mjs api/users.mjs api/package.json api/package-lock.json api/Dockerfile sql/enable_user_management.sql sql/create_archivos_expediente.sql eduardo@192.168.1.74:~/sigep-api-roles-20261119/
ssh eduardo@192.168.1.74
```

## 2. SSH en HomeLab

Construir antes de parar el servicio. No continuar si un paso falla.

```bash
docker build -t sigep-predio-api:roles-20261119 ~/sigep-api-roles-20261119 &&
docker exec -i sigep-postgis psql -U sigep_admin -d sigep -v ON_ERROR_STOP=1 < ~/sigep-api-roles-20261119/enable_user_management.sql &&
docker exec -i sigep-postgis psql -U sigep_admin -d sigep -v ON_ERROR_STOP=1 < ~/sigep-api-roles-20261119/create_archivos_expediente.sql
```

Las migraciones agregan auditoría de usuarios, documentos generales, requisitos configurables y datos catastrales. El segundo SQL actualiza también instalaciones que ya tenían evidencia y planos. No elimina usuarios ni cambia sus roles. Conservar el volumen existente sigep-archivos.

```bash
(umask 077; docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' sigep-predio-api > ~/sigep-api-roles-20261119/runtime.env) &&
docker volume inspect sigep-archivos >/dev/null &&
docker stop sigep-predio-api &&
docker rename sigep-predio-api sigep-predio-api-respaldo-roles-20261119 &&
docker run -d --name sigep-predio-api --restart unless-stopped \
  --network qgis-server_default -p 127.0.0.1:8100:8100 \
  --env-file ~/sigep-api-roles-20261119/runtime.env \
  -e SIGEP_PRIVATE_STORAGE_DIR=/data/private \
  --mount source=sigep-archivos,target=/data/private \
  sigep-predio-api:roles-20261119
```

```bash
docker logs --tail 30 sigep-predio-api
curl --retry 5 --retry-connrefused --retry-delay 2 -i http://127.0.0.1:8100/health
```

Esperado: HTTP 200 y status ok. No repetir la sustitución si ya se creó el contenedor; primero revisar logs. No compartir runtime.env.

Si la nueva API falla después de crear el contenedor, conservarlo para diagnóstico y restaurar el anterior:

```bash
docker stop sigep-predio-api &&
docker rename sigep-predio-api sigep-predio-api-fallido-roles-20261119 &&
docker rename sigep-predio-api-respaldo-roles-20261119 sigep-predio-api &&
docker start sigep-predio-api
```

La migración es aditiva y no requiere revertirse para recuperar la API anterior. Volver también a la interfaz anterior si se hace rollback. Estas copias de contenedores no sustituyen respaldos de BD y archivos.

## 3. Probar desde la PC

Reiniciar Vite con Ctrl+C y npm run dev; mantener el túnel SSH abierto. Cerrar sesión y volver a entrar para recibir los permisos actualizados.

En Administración crear manualmente una cuenta individual para cada rol de prueba, con correo de prueba y contraseña propia de al menos 12 caracteres. No hay contraseñas predefinidas ni se crearon cuentas en producción automáticamente.

| Rol | Sección principal y prueba |
|---|---|
| Administración | Crear/editar/baja de un usuario ficticio; verificar que ya no puede entrar tras la baja. |
| Ventanilla | Lotes y predios: alta de expediente; Seguimiento: solicitar medición. |
| Cartografía | Medición y topografía: asignar; adjuntar plano cuando corresponda. |
| Topografía | Solo visitas asignadas; registrar visita y evidencia. |
| Caja | Pagos: registrar pago ficticio vinculado a expediente de prueba. |
| Legal | Seguimiento: dictamen de certificación/constancia y borrador; no titulación. |
| Digitalización | Seguimiento y consulta de adjuntos; carga y revisión de documentos generales habilitadas. |
| Captura | Alta de predio/expediente; corrección de geometría debe responder 403. |
| Titulación | Seguimiento, adjuntos y consulta de títulos; flujo completo aún pendiente. |
| Informática | Seguimiento y lotes, lectura de adjuntos; validación formal pendiente. |
| Jefatura | Seguimiento e histórico; revisión formal pendiente. |
| Dirección | Seguimiento e histórico; autorización formal pendiente. |
| Consulta / Auditoría | Solo lectura de expedientes, títulos, adjuntos e histórico. |

Probar también intento de edición/eliminación de usuarios desde rol no administrador (403), sesión ausente (401), correo duplicado (409), eliminación del último administrador (409), edición con cambio de rol y revocación de sesión. Hacer las escrituras funcionales con usuarios y expedientes ficticios en un entorno de pruebas.
