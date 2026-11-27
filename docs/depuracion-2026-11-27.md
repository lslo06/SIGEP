# Depuración del proyecto — 27/11/2026

Alcance: código y archivos locales del repositorio. No se modificaron el servidor, la base de datos, volúmenes Docker ni documentos ciudadanos.

## Cambios

- Eliminados `src/modules/RecordEditor.jsx` y `editorSections.js`: editor anterior sin importaciones desde la aplicación ni desde pruebas. Se comprobó el grafo desde `src/main.jsx`, incluyendo importaciones dinámicas, y las referencias por nombre.
- Eliminado `record-editor.css`, su importación global y selectores exclusivos del editor en `visual-refresh.css`. Ningún componente activo usa esas clases.
- Eliminado `users.css`: hoja que no se importaba. El módulo actual `LocalAdministration.jsx` permanece; quitar la hoja desconectada no cambia sus estilos cargados.
- Retirados `formatMoney` sin llamadas en `App.jsx`, dos iconos sin uso y la importación sobrante de `roles` en rutas.
- Eliminada la caché regenerable de Vite: 7.600.322 bytes (7,25 MiB). Se regenerará al iniciar desarrollo; no representa una reducción permanente del tamaño instalado de las dependencias.
- `api/.dockerignore` permite únicamente Dockerfile, configuración de exclusión, manifiestos y módulos de API. Evita enviar dependencias locales, archivos privados, respaldos y entornos al contexto de construcción.
- El respaldo local `sigep_proyecto.zip` se conserva, ahora excluido de Git para evitar incluirlo accidentalmente en una entrega de código.

## Medición y verificación

| Comprobación | Resultado |
|---|---|
| Pruebas automatizadas | 86 aprobadas; 0 fallidas. |
| Compilación Vite | Correcta. |
| CSS principal compilado | 68,48 → 61,32 kB, aproximadamente 10,5 % menos sin comprimir. |
| Total de CSS compilado | 106.297 → 99.135 bytes, 6,7 % menos. |
| Referencias a archivos eliminados | Ninguna en código/pruebas. |
| Revisión de whitespace | `git diff --check` correcto. |

No se realizó una prueba visual en navegador ni se midió tiempo de carga del servidor. La reducción comprobada corresponde al CSS y a archivos locales; no demuestra una mejora equivalente en velocidad de toda la aplicación. La construcción de la imagen Docker queda pendiente en un entorno con Docker disponible.

## Elementos conservados

Las cinco dependencias directas del frontend se usan en importaciones reales. Las herramientas de compilación tienen configuración activa; la API usa `pg`. `node_modules` ocupaba 85,06 MiB antes de limpiar la caché: es el principal consumo local, pero se necesita para desarrollar y compilar. El navegador recibe el compilado, no toda esa carpeta.

Se conserva `dist/` recompilado para revisar/publicar. También se conservan pruebas, SQL, manuales, requisitos extraídos y el ZIP. Borrarlos para ganar unos pocos kilobytes quitaría evidencia o material útil.

`src/lib/memberships.js` no entra en el cliente actual; se mantiene por compatibilidad de instalaciones anteriores y sus pruebas específicas. No agrega peso al JavaScript publicado. El parámetro `_` detectado en una función de mapa es un argumento posicional intencional, no un error de dependencia.

Los cambios de depuración están pendientes de commit y publicación junto con el incremento funcional anterior. No se hizo push ni se reconstruyó la API del HomeLab.
