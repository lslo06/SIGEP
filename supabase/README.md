# Base de datos de Fundos en Supabase

## Configurar el proyecto

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor**, pega el contenido actualizado de [`schema.sql`](./schema.sql) y ejecútalo. Si ya habías ejecutado una versión anterior de este esquema, vuelve a ejecutar el archivo completo para agregar las funciones de guardado transaccional.
3. Copia **Project URL** y la **publishable key** desde **Project Settings → API**. En `.env.local`, configura:

   ```env
   VITE_SUPABASE_URL=https://TU-PROJECT-REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tu_clave
   ```

   No uses una clave `service_role` en el navegador. Reinicia Vite (`Ctrl+C`, luego `npm run dev`) para cargar cambios al archivo de entorno.

4. Registra el usuario desde la pantalla de acceso de la aplicación o habilita un usuario en **Authentication**. Si Supabase requiere confirmar el correo, revisa tu bandeja de entrada antes de iniciar sesión.
5. Si no existe una organización para el usuario, la app permite crearla después de iniciar sesión. También puedes crearla desde SQL Editor sustituyendo el correo por el del usuario registrado:

   ```sql
   with nuevo as (
     insert into public.organizaciones (nombre, creado_por)
     select 'Fundos Legales', id
     from auth.users
     where lower(email) = lower('admin@ejemplo.com')
     returning id, creado_por
   )
   insert into public.miembros_organizacion (organizacion_id, usuario_id, rol)
   select id, creado_por, 'owner'
   from nuevo
   returning organizacion_id;
   ```

   Guarda el `organizacion_id` que devuelve la consulta. Si no devuelve filas, verifica que el usuario ya esté registrado y que el correo coincida.

6. Las organizaciones también se crean desde una sesión autenticada con Supabase RPC:

   ```js
   const { data: organizacionId, error } = await supabase.rpc('crear_organizacion', {
     p_nombre: 'Fundos Legales',
   })
   ```

   El usuario autenticado que la crea queda como su propietario.

7. Para agregar a otro usuario que ya se haya registrado, un propietario o administrador llama:

   ```js
   const { data: usuarioId, error } = await supabase.rpc('agregar_miembro_organizacion', {
     p_organizacion_id: organizacionId,
     p_email: 'persona@ejemplo.com',
     p_rol: 'editor',
   })
   ```

   Los roles disponibles son `admin`, `editor` y `viewer`. Admin y editor pueden crear, modificar y eliminar registros; viewer solo puede consultarlos.

## Tablas

- `organizaciones`: espacio de trabajo de un departamento o entidad.
- `miembros_organizacion`: usuarios y permisos dentro de cada espacio.
- `fundos`: fundos o zonas territoriales.
- `propietarios`: personas titulares.
- `predios`: manzana, lote y superficie; cada predio pertenece a un fundo y a un propietario.
- `expedientes`: folio, trámite, libro, título, estado, observaciones, fechas, importes, oficio y seguimiento.
- `modulo_registros`: capturas adicionales de lotes, propietarios, municipios/fundos, pagos, títulos e histórico de los módulos de la interfaz.

Cada tabla con datos de la organización aplica Row Level Security. Los miembros no pueden consultar datos de otras organizaciones; los usuarios `viewer` tampoco pueden modificarlos. Los importes y el saldo se guardan como columnas editables, para reflejar pagos parciales y correcciones sin imponer un cálculo que no contemple las reglas del negocio.

## Ejecutar la aplicación

Instala dependencias con `npm install` y arranca Vite con `npm run dev`. Al iniciar sesión, la app muestra la bandeja de expedientes y los módulos de captura. Los módulos de lotes, propietarios, municipios/fundos, pagos, títulos e histórico guardan sus campos en `modulo_registros`; cada registro tiene organización, módulo y datos JSON, y está protegido por RLS. Los expedientes del tablero usan las tablas relacionales existentes; crear y editar llaman `guardar_expediente` y eliminar llama `eliminar_expediente`. Las claves de servicio no son necesarias.
