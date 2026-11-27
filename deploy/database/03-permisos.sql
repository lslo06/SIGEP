-- Privilegios consolidados de las migraciones de la API actual.
-- Usar una BD/instancia nueva; no corrige ACL o membresías heredadas del origen.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO sigep_editor', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO sigep_editor;

GRANT SELECT, INSERT ON public.predios, public.solicitantes, public.expedientes,
  public.expediente_predios, public.movimientos_expediente,
  public.predio_geometria_historial, public.pagos_expediente,
  public.archivos_expediente, public.ubicaciones_solicitadas,
  public.archivos_visita_inicial, public.auditoria_usuarios TO sigep_editor;
GRANT UPDATE (geom, superficie) ON public.predios TO sigep_editor;
-- UPDATE(id) permite el bloqueo transaccional sin autorizar cambios generales.
GRANT UPDATE (id, estado, etapa_actual, area_responsable) ON public.expedientes TO sigep_editor;
GRANT UPDATE (estado_revision, revisado_por, revisado_en, motivo_revision)
  ON public.archivos_expediente TO sigep_editor;

GRANT SELECT, INSERT, UPDATE ON public.usuarios_locales,
  public.mediciones_expediente, public.visitas_iniciales,
  public.datos_catastrales_expediente TO sigep_editor;
GRANT SELECT, INSERT, DELETE ON public.sesiones_locales TO sigep_editor;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisitos_documentales TO sigep_editor;

GRANT SELECT (id, nombre_completo, creado_en, actualizado_en) ON public.propietarios TO sigep_editor;
GRANT SELECT (id, nombre, creado_en, actualizado_en) ON public.fundos TO sigep_editor;
GRANT SELECT (id, nombre, creado_en) ON public.organizaciones TO sigep_editor;
GRANT SELECT (organizacion_id, usuario_id) ON public.miembros_organizacion TO sigep_editor;

GRANT USAGE, SELECT ON SEQUENCE public.expedientes_folio_seq TO sigep_editor;
DO $$
DECLARE sigep_table text; sigep_sequence text;
BEGIN
  FOREACH sigep_table IN ARRAY ARRAY['predios','solicitantes','expedientes',
    'movimientos_expediente','predio_geometria_historial','pagos_expediente','auditoria_usuarios'] LOOP
    sigep_sequence := pg_get_serial_sequence('public.' || sigep_table, 'id');
    IF sigep_sequence IS NOT NULL THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO sigep_editor', sigep_sequence::regclass);
    END IF;
  END LOOP;
END $$;
COMMIT;
