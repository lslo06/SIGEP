-- Ejecutar una sola vez como sigep_admin en la base sigep.
-- Después asigna la contraseña de forma interactiva con: \password sigep_editor
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigep_editor') THEN
    CREATE ROLE sigep_editor LOGIN;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE sigep TO sigep_editor;
GRANT USAGE ON SCHEMA public TO sigep_editor;
GRANT SELECT, INSERT ON TABLE public.predios TO sigep_editor;

DO $$
DECLARE
  predios_id_sequence text;
BEGIN
  predios_id_sequence := pg_get_serial_sequence('public.predios', 'id');
  IF predios_id_sequence IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO sigep_editor', predios_id_sequence::regclass);
  END IF;
END
$$;
