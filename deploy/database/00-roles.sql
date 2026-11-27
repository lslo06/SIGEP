-- Instalación candidata: ejecutar como administrador en la BD destino aislada.
-- No contiene contraseñas. Configurar \password sigep_editor después del esquema.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sigep_editor') THEN
    CREATE ROLE sigep_editor LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSIF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname='sigep_editor'
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'La cuenta sigep_editor existente tiene privilegios administrativos. Revisar el destino.';
  END IF;
END $$;
COMMIT;
