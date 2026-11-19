BEGIN;
ALTER TABLE public.usuarios_locales ADD COLUMN IF NOT EXISTS eliminado_en timestamptz;
CREATE TABLE IF NOT EXISTS public.auditoria_usuarios (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios_locales(id),
  actor text NOT NULL,
  accion text NOT NULL CHECK (accion IN ('alta', 'edicion', 'baja')),
  anterior jsonb,
  nuevo jsonb,
  creado_en timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.auditoria_usuarios TO sigep_editor;
GRANT USAGE, SELECT ON SEQUENCE public.auditoria_usuarios_id_seq TO sigep_editor;
GRANT SELECT, INSERT, UPDATE ON public.usuarios_locales TO sigep_editor;
COMMIT;
