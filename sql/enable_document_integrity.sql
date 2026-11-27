-- Aplicar como administrador después de create_archivos_expediente.sql.
-- Los documentos generales tienen predio_id NULL: necesitan una FK directa.
-- Si hay huérfanos, la validación falla sin borrar ni corregir datos automáticamente.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.archivos_expediente'::regclass
      AND conname='archivos_expediente_expediente_fk'
  ) THEN
    ALTER TABLE public.archivos_expediente
      ADD CONSTRAINT archivos_expediente_expediente_fk
      FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
ALTER TABLE public.archivos_expediente VALIDATE CONSTRAINT archivos_expediente_expediente_fk;
COMMIT;
