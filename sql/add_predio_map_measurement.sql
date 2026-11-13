-- Migración del mapa: condición de medición y consulta espacial por área visible.
-- Ejecutar una sola vez en la base sigep como sigep_admin.

ALTER TABLE public.predios
  ADD COLUMN IF NOT EXISTS estado_medicion TEXT NOT NULL DEFAULT 'sin_confirmar',
  ADD COLUMN IF NOT EXISTS fecha_medicion DATE,
  ADD COLUMN IF NOT EXISTS observaciones_medicion TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'predios_estado_medicion_valido'
      AND conrelid = 'public.predios'::regclass
  ) THEN
    ALTER TABLE public.predios
      ADD CONSTRAINT predios_estado_medicion_valido
      CHECK (estado_medicion IN ('medido', 'no_medido', 'sin_confirmar'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_predios_geom_gist
  ON public.predios USING GIST (geom);

COMMENT ON COLUMN public.predios.estado_medicion IS
  'Condición reportada para el prototipo; sin_confirmar evita inferirla de status.';
COMMENT ON COLUMN public.predios.fecha_medicion IS
  'Fecha reportada de medición del predio, si se conoce.';
