-- Recepción de titulación sin predio previo. Aplicar DESPUÉS de las migraciones
-- de expedientes, usuarios, asignación de topografía y archivos del proyecto.
-- Migración aditiva: conserva nombres, expedientes y mediciones anteriores.
BEGIN;

ALTER TABLE public.solicitantes
  ADD COLUMN IF NOT EXISTS nombres text,
  ADD COLUMN IF NOT EXISTS primer_apellido text,
  ADD COLUMN IF NOT EXISTS segundo_apellido text;
ALTER TABLE public.expedientes ADD COLUMN IF NOT EXISTS recepcion_inicial boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ubicaciones_solicitadas (
  expediente_id bigint PRIMARY KEY REFERENCES public.expedientes(id) ON DELETE RESTRICT,
  municipio text NOT NULL CHECK (length(trim(municipio)) BETWEEN 1 AND 150),
  localidad text NOT NULL CHECK (length(trim(localidad)) BETWEEN 1 AND 150),
  direccion text CHECK (direccion IS NULL OR length(direccion) <= 500),
  referencias text NOT NULL CHECK (length(trim(referencias)) BETWEEN 1 AND 1500),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visitas_iniciales (
  expediente_id bigint PRIMARY KEY REFERENCES public.ubicaciones_solicitadas(expediente_id) ON DELETE RESTRICT,
  estado text NOT NULL CHECK (estado IN ('revision_direccion','revision_jefatura','solicitado','asignado','visitado')),
  responsable_id uuid REFERENCES public.usuarios_locales(id) ON DELETE RESTRICT,
  fecha_compromiso date,
  fecha_visita date,
  superficie_m2 numeric(14,2) CHECK (superficie_m2 > 0),
  observaciones text,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (estado NOT IN ('asignado','visitado') OR (responsable_id IS NOT NULL AND fecha_compromiso IS NOT NULL)),
  CHECK (estado <> 'visitado' OR (fecha_visita IS NOT NULL AND superficie_m2 IS NOT NULL AND observaciones IS NOT NULL AND length(trim(observaciones)) > 0))
);
CREATE INDEX IF NOT EXISTS visitas_iniciales_responsable_idx ON public.visitas_iniciales(responsable_id, estado);

CREATE TABLE IF NOT EXISTS public.archivos_visita_inicial (
  id uuid PRIMARY KEY,
  expediente_id bigint NOT NULL REFERENCES public.visitas_iniciales(expediente_id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  nombre_archivo text NOT NULL CHECK (length(trim(nombre_archivo)) BETWEEN 1 AND 160),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  bytes bigint NOT NULL CHECK (bytes BETWEEN 1 AND 10485760),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  subido_por uuid NOT NULL REFERENCES public.usuarios_locales(id) ON DELETE RESTRICT,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expediente_id, version)
);

GRANT SELECT, INSERT ON public.ubicaciones_solicitadas, public.archivos_visita_inicial TO sigep_editor;
GRANT SELECT, INSERT, UPDATE ON public.visitas_iniciales TO sigep_editor;
GRANT UPDATE (estado, etapa_actual, area_responsable) ON public.expedientes TO sigep_editor;
COMMIT;
