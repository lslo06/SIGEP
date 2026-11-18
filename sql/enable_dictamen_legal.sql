-- Permisos de escritura para la operación de dictamen de la API local.
GRANT UPDATE (estado, etapa_actual, area_responsable) ON public.expedientes TO sigep_editor;
