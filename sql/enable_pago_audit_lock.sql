-- Aplicar como sigep_admin después de create_expedientes.sql.
-- PostgreSQL exige UPDATE sobre al menos una columna para SELECT FOR UPDATE.
-- La API solo bloquea la fila; no modifica su identificador ni su estado.
BEGIN;
GRANT UPDATE (id) ON public.expedientes TO sigep_editor;
COMMIT;
