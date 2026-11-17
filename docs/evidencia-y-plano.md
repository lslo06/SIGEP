# Evidencia de visita y plano de Cartografía

Esta implementación guarda evidencia y planos privados asociados a una combinación de expediente y predio. PostgreSQL conserva metadatos y versiones; el archivo binario vive en el almacenamiento privado del API y se sirve solo después de validar sesión, rol y asignación.

## Preparar una instancia de desarrollo

1. Aplicar las migraciones existentes de expedientes, usuarios locales y mediciones, incluyendo `sql/enable_asignacion_topografia.sql`.
2. Ejecutar `sql/create_archivos_expediente.sql` como el administrador de la base de desarrollo. La migración concede `SELECT` e `INSERT` sobre los metadatos al rol `sigep_editor`.
3. En la instancia del API, establecer `SIGEP_PRIVATE_STORAGE_DIR` en una carpeta privada persistente, accesible para el usuario del proceso. En Docker Compose, montar un volumen persistente en `/data/private`; no publicar esa carpeta con el servidor web.
4. Reiniciar el API. Para desarrollo local se usa por defecto `api/private-files/`, excluida de Git.

## Flujo y permisos

- La persona topógrafa asignada registra la visita y después puede adjuntar evidencia.
- Cartografía puede adjuntar y consultar planos cuando la medición está confirmada (`medido`) o la visita está registrada (`visitado`).
- La administración puede consultar ambos tipos de archivo.
- Se admiten PDF, JPG y PNG, con límite de 10 MB. El API comprueba la extensión, firma del contenido, tamaño y rol. Los archivos no tienen URL pública.
- Cada carga crea una versión nueva y agrega un movimiento al historial del expediente.

## Verificación en desarrollo

Con Node.js 22 o posterior:

```sh
node --test tests/*.test.js
npm run build
```

Los tests unitarios cubren la validación del archivo, el límite de tamaño, roles y estados permitidos. Para comprobar el flujo integrado se requieren una base de desarrollo con las migraciones aplicadas, sesiones de prueba de Cartografía y Topografía, y una carpeta privada escribible. No ejecutar las pruebas integradas contra producción.

La especificación funcional RF-020–025 y el diagrama mencionados en el encargo no están incluidos en este checkout; validar con esos documentos antes de desplegar en un entorno compartido.
