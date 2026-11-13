-- Ejecutar en sigep después de la unificación de Fundos y Mapeo.
begin;
grant select (id, nombre_completo, creado_en, actualizado_en) on public.propietarios to sigep_editor;
grant select (id, nombre, creado_en, actualizado_en) on public.fundos to sigep_editor;
grant select (id, nombre, creado_en) on public.organizaciones to sigep_editor;
grant select (organizacion_id, usuario_id) on public.miembros_organizacion to sigep_editor;
grant select (id, municipio, fundo, manzana, lote, libro) on public.predios to sigep_editor;
commit;
