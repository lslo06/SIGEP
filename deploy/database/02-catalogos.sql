-- Catálogo de trabajo del origen; pendiente de validación institucional.
-- No incluye usuarios, sesiones, personas, pagos, expedientes ni geometrías.
-- Las fechas se generan en destino; no se copian timestamps del origen.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.requisitos_documentales (tipo_tramite,nombre,activo) VALUES
 ('titulacion','Solicitud de predio',true),
 ('titulacion','Constancia de posesión',true),
 ('titulacion','Identificación oficial',true),
 ('titulacion','Acta de nacimiento',true),
 ('titulacion','Comprobante de domicilio',true),
 ('titulacion','Cédula catastral',true),
 ('titulacion','Otro',true),
 ('busqueda_informacion','Identificación oficial',true),
 ('busqueda_informacion','Solicitud escrita',true),
 ('busqueda_informacion','Otro',true),
 ('certificacion_antecedentes_titulo','Identificación oficial',true),
 ('certificacion_antecedentes_titulo','Solicitud escrita',true),
 ('certificacion_antecedentes_titulo','Otro',true),
 ('certificacion_copia_titulo','Identificación oficial',true),
 ('certificacion_copia_titulo','Solicitud escrita',true),
 ('certificacion_copia_titulo','Otro',true),
 ('constancia_datos_lote','Identificación oficial',true),
 ('constancia_datos_lote','Solicitud escrita',true),
 ('constancia_datos_lote','Otro',true),
 ('constancia_tramite_titulo','Identificación oficial',true),
 ('constancia_tramite_titulo','Solicitud escrita',true),
 ('constancia_tramite_titulo','Otro',true);
COMMIT;
