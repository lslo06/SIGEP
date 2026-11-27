-- SIGEP: esquema inicial candidato 2026-11-27; PostgreSQL 17 / PostGIS 3.5.
-- Revisado estáticamente; pendiente de ensayo en PostgreSQL real.
-- Origen SHA256: 6b98b75f2fed14497f7411d6c752f57c87e55432ce1776bad83bd4820f39df2d
-- Sin filas de negocio ni ACL/propietarios del servidor origen.
-- Incluye estructura histórica fundos_legales para conservar dependencias.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['fundos_legales.expedientes','fundos_legales.predios','public.archivos_expediente','public.archivos_visita_inicial','public.auditoria_usuarios','public.datos_catastrales_expediente','public.expediente_predios','public.expedientes','public.fundos','public.mediciones_expediente','public.miembros_organizacion','public.modulo_registros','public.movimientos_expediente','public.organizaciones','public.pagos_expediente','public.predio_geometria_historial','public.predios','public.propietarios','public.requisitos_documentales','public.sesiones_locales','public.solicitantes','public.ubicaciones_solicitadas','public.usuarios_locales','public.visitas_iniciales']::text[]) AS expected(name) WHERE to_regclass(expected.name) IS NOT NULL) THEN
    RAISE EXCEPTION 'La instalación inicial requiere una base sin tablas SIGEP. No ejecutar sobre la base activa.';
  END IF;
END $$;
--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Debian 17.5-1.pgdg110+1)
-- Dumped by pg_dump version 17.5 (Debian 17.5-1.pgdg110+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: fundos_legales; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS fundos_legales;


--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS tiger;


--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS tiger_data;


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS topology;


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: folio_expediente_seq; Type: SEQUENCE; Schema: fundos_legales; Owner: -
--

CREATE SEQUENCE fundos_legales.folio_expediente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_table_access_method = heap;

--
-- Name: expedientes; Type: TABLE; Schema: fundos_legales; Owner: -
--

CREATE TABLE fundos_legales.expedientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacion_id uuid NOT NULL,
    predio_id uuid NOT NULL,
    folio text DEFAULT ((('FL-'::text || to_char((CURRENT_DATE)::timestamp with time zone, 'YYYY'::text)) || '-'::text) || lpad((nextval('fundos_legales.folio_expediente_seq'::regclass))::text, 5, '0'::text)) NOT NULL,
    tipo_tramite text DEFAULT 'Titulación'::text NOT NULL,
    libro text,
    numero_titulo text,
    fecha_titulo date,
    estado text DEFAULT 'En trámite'::text NOT NULL,
    observacion text,
    fecha_solicitud date,
    fecha_entrega date,
    fecha_pago_servicios date,
    fecha_gobierno date,
    fecha_municipio date,
    fecha_registro_publico date,
    costo_terreno numeric(14,2),
    parcialidades_pagadas numeric(14,2),
    saldo_pendiente numeric(14,2),
    numero_oficio text,
    seguimiento_firmas text DEFAULT 'Sin iniciar'::text NOT NULL,
    area_actual text DEFAULT 'Recepción'::text NOT NULL,
    siguiente_accion text,
    en_espera text,
    creado_por uuid NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expedientes_costo_terreno_check CHECK (((costo_terreno IS NULL) OR (costo_terreno >= (0)::numeric))),
    CONSTRAINT expedientes_estado_check CHECK ((estado = ANY (ARRAY['En trámite'::text, 'En revisión'::text, 'Vigente'::text, 'Cancelado'::text, 'Pendiente'::text, 'Listo para entrega'::text]))),
    CONSTRAINT expedientes_parcialidades_pagadas_check CHECK (((parcialidades_pagadas IS NULL) OR (parcialidades_pagadas >= (0)::numeric))),
    CONSTRAINT expedientes_saldo_pendiente_check CHECK (((saldo_pendiente IS NULL) OR (saldo_pendiente >= (0)::numeric))),
    CONSTRAINT expedientes_seguimiento_firmas_check CHECK ((seguimiento_firmas = ANY (ARRAY['Sin iniciar'::text, 'En espera de firma'::text, 'En revisión'::text, 'Firmado'::text]))),
    CONSTRAINT expedientes_tipo_tramite_check CHECK ((tipo_tramite = ANY (ARRAY['Titulación'::text, 'Búsqueda de información'::text, 'Partición de terrenos'::text, 'Actualización de datos'::text, 'Otro'::text])))
);


--
-- Name: predios; Type: TABLE; Schema: fundos_legales; Owner: -
--

CREATE TABLE fundos_legales.predios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacion_id uuid NOT NULL,
    propietario_id uuid NOT NULL,
    fundo_id uuid NOT NULL,
    manzana text DEFAULT ''::text NOT NULL,
    lote text NOT NULL,
    superficie_m2 numeric(14,2),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT predios_lote_check CHECK (((char_length(TRIM(BOTH FROM lote)) >= 1) AND (char_length(TRIM(BOTH FROM lote)) <= 80))),
    CONSTRAINT predios_superficie_m2_check CHECK (((superficie_m2 IS NULL) OR (superficie_m2 > (0)::numeric)))
);


--
-- Name: archivos_expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archivos_expediente (
    id uuid NOT NULL,
    expediente_id bigint NOT NULL,
    predio_id bigint,
    tipo text NOT NULL,
    version integer NOT NULL,
    nombre_archivo text NOT NULL,
    mime_type text NOT NULL,
    bytes bigint NOT NULL,
    sha256 text NOT NULL,
    subido_por uuid NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    requisito text,
    etapa text,
    estado_revision text DEFAULT 'pendiente'::text NOT NULL,
    revisado_por uuid,
    revisado_en timestamp with time zone,
    motivo_revision text,
    CONSTRAINT archivos_expediente_bytes_check CHECK (((bytes >= 1) AND (bytes <= 10485760))),
    CONSTRAINT archivos_expediente_estado_revision_check CHECK ((estado_revision = ANY (ARRAY['pendiente'::text, 'aceptado'::text, 'rechazado'::text]))),
    CONSTRAINT archivos_expediente_mime_type_check CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text]))),
    CONSTRAINT archivos_expediente_nombre_archivo_check CHECK (((length(TRIM(BOTH FROM nombre_archivo)) >= 1) AND (length(TRIM(BOTH FROM nombre_archivo)) <= 160))),
    CONSTRAINT archivos_expediente_sha256_check CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT archivos_expediente_tipo_check CHECK ((tipo = ANY (ARRAY['evidencia_visita'::text, 'plano'::text, 'documento_general'::text]))),
    CONSTRAINT archivos_expediente_version_check CHECK ((version > 0))
);


--
-- Name: archivos_visita_inicial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archivos_visita_inicial (
    id uuid NOT NULL,
    expediente_id bigint NOT NULL,
    version integer NOT NULL,
    nombre_archivo text NOT NULL,
    mime_type text NOT NULL,
    bytes bigint NOT NULL,
    sha256 text NOT NULL,
    subido_por uuid NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT archivos_visita_inicial_bytes_check CHECK (((bytes >= 1) AND (bytes <= 10485760))),
    CONSTRAINT archivos_visita_inicial_mime_type_check CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/jpeg'::text, 'image/png'::text]))),
    CONSTRAINT archivos_visita_inicial_nombre_archivo_check CHECK (((length(TRIM(BOTH FROM nombre_archivo)) >= 1) AND (length(TRIM(BOTH FROM nombre_archivo)) <= 160))),
    CONSTRAINT archivos_visita_inicial_sha256_check CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT archivos_visita_inicial_version_check CHECK ((version > 0))
);


--
-- Name: auditoria_usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_usuarios (
    id bigint NOT NULL,
    usuario_id uuid NOT NULL,
    actor text NOT NULL,
    accion text NOT NULL,
    anterior jsonb,
    nuevo jsonb,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auditoria_usuarios_accion_check CHECK ((accion = ANY (ARRAY['alta'::text, 'edicion'::text, 'baja'::text])))
);


--
-- Name: auditoria_usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auditoria_usuarios ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auditoria_usuarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: datos_catastrales_expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.datos_catastrales_expediente (
    expediente_id bigint NOT NULL,
    predio_id bigint NOT NULL,
    cedula_folio text,
    cedula_fecha date,
    valor_terreno numeric(14,2),
    valor_construccion numeric(14,2),
    valor_catastral numeric(14,2),
    propietarios jsonb DEFAULT '[]'::jsonb NOT NULL,
    estado_revision text DEFAULT 'pendiente'::text NOT NULL,
    motivo_revision text,
    capturado_por uuid NOT NULL,
    capturado_en timestamp with time zone DEFAULT now() NOT NULL,
    revisado_por uuid,
    revisado_en timestamp with time zone,
    CONSTRAINT datos_catastrales_expediente_estado_revision_check CHECK ((estado_revision = ANY (ARRAY['pendiente'::text, 'aceptado'::text, 'rechazado'::text]))),
    CONSTRAINT datos_catastrales_expediente_propietarios_check CHECK ((jsonb_typeof(propietarios) = 'array'::text))
);


--
-- Name: expediente_predios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expediente_predios (
    expediente_id bigint NOT NULL,
    predio_id bigint NOT NULL
);


--
-- Name: expedientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expedientes (
    id bigint NOT NULL,
    folio text NOT NULL,
    tipo_tramite text NOT NULL,
    fecha_recepcion date DEFAULT CURRENT_DATE NOT NULL,
    estado text DEFAULT 'recibido'::text NOT NULL,
    etapa_actual text DEFAULT 'recepcion'::text NOT NULL,
    area_responsable text DEFAULT 'Ventanilla'::text NOT NULL,
    solicitante_id bigint NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    id_fundos uuid,
    organizacion_id uuid,
    predio_principal_id bigint,
    tipo_tramite_fundos text,
    libro text,
    numero_titulo text,
    fecha_titulo date,
    estado_fundos text,
    fecha_solicitud date,
    fecha_entrega date,
    fecha_pago_servicios date,
    fecha_gobierno date,
    fecha_municipio date,
    fecha_registro_publico date,
    costo_terreno numeric(14,2),
    parcialidades_pagadas numeric(14,2),
    saldo_pendiente numeric(14,2),
    numero_oficio text,
    seguimiento_firmas text,
    area_actual text,
    siguiente_accion text,
    en_espera text,
    creado_por uuid,
    actualizado_en timestamp with time zone,
    recepcion_inicial boolean DEFAULT false NOT NULL,
    CONSTRAINT expedientes_costo_terreno_check CHECK ((costo_terreno >= (0)::numeric)),
    CONSTRAINT expedientes_datos_fundos_check CHECK ((((id_fundos IS NULL) AND (predio_principal_id IS NULL)) OR (organizacion_id IS NOT NULL))),
    CONSTRAINT expedientes_estado_check CHECK ((estado = ANY (ARRAY['recibido'::text, 'en_revision'::text, 'prevenido'::text, 'en_proceso'::text, 'listo_para_entrega'::text, 'entregado'::text, 'no_procede'::text, 'cerrado'::text]))),
    CONSTRAINT expedientes_estado_fundos_check CHECK ((estado_fundos = ANY (ARRAY['En trámite'::text, 'En revisión'::text, 'Vigente'::text, 'Cancelado'::text, 'Pendiente'::text, 'Listo para entrega'::text]))),
    CONSTRAINT expedientes_parcialidades_pagadas_check CHECK ((parcialidades_pagadas >= (0)::numeric)),
    CONSTRAINT expedientes_saldo_pendiente_check CHECK ((saldo_pendiente >= (0)::numeric)),
    CONSTRAINT expedientes_seguimiento_firmas_check CHECK ((seguimiento_firmas = ANY (ARRAY['Sin iniciar'::text, 'En espera de firma'::text, 'En revisión'::text, 'Firmado'::text]))),
    CONSTRAINT expedientes_tipo_tramite_check CHECK ((tipo_tramite = ANY (ARRAY['titulacion'::text, 'busqueda_informacion'::text, 'certificacion_antecedentes_titulo'::text, 'certificacion_copia_titulo'::text, 'constancia_datos_lote'::text, 'constancia_tramite_titulo'::text]))),
    CONSTRAINT expedientes_tipo_tramite_fundos_check CHECK ((tipo_tramite_fundos = ANY (ARRAY['Titulación'::text, 'Búsqueda de información'::text, 'Partición de terrenos'::text, 'Actualización de datos'::text, 'Otro'::text])))
);


--
-- Name: expedientes_folio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expedientes_folio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expedientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.expedientes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.expedientes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fundos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fundos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacion_id uuid NOT NULL,
    nombre text NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fundos_nombre_check CHECK (((char_length(TRIM(BOTH FROM nombre)) >= 1) AND (char_length(TRIM(BOTH FROM nombre)) <= 160)))
);


--
-- Name: mediciones_expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mediciones_expediente (
    expediente_id bigint NOT NULL,
    predio_id bigint NOT NULL,
    estado text NOT NULL,
    responsable text,
    fecha_compromiso date,
    fecha_visita date,
    superficie_m2 numeric(14,2),
    observaciones text,
    referencia_evidencia text,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    responsable_id uuid,
    asignado_en timestamp with time zone,
    CONSTRAINT mediciones_expediente_estado_check CHECK ((estado = ANY (ARRAY['medido'::text, 'solicitado'::text, 'asignado'::text, 'visitado'::text]))),
    CONSTRAINT mediciones_expediente_superficie_m2_check CHECK ((superficie_m2 > (0)::numeric))
);


--
-- Name: miembros_organizacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.miembros_organizacion (
    organizacion_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    rol text DEFAULT 'editor'::text NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT miembros_organizacion_rol_check CHECK ((rol = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text, 'viewer'::text])))
);


--
-- Name: modulo_registros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modulo_registros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacion_id uuid NOT NULL,
    modulo text NOT NULL,
    titulo text NOT NULL,
    datos jsonb DEFAULT '{}'::jsonb NOT NULL,
    creado_por uuid NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT modulo_registros_datos_check CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT modulo_registros_modulo_check CHECK ((modulo = ANY (ARRAY['lotes_predios'::text, 'propietarios'::text, 'municipios_fundos'::text, 'pagos_servicios'::text, 'titulos_formatos'::text, 'historico_reportes'::text]))),
    CONSTRAINT modulo_registros_titulo_check CHECK (((char_length(TRIM(BOTH FROM titulo)) >= 1) AND (char_length(TRIM(BOTH FROM titulo)) <= 240)))
);


--
-- Name: movimientos_expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_expediente (
    id bigint NOT NULL,
    expediente_id bigint NOT NULL,
    etapa_origen text,
    etapa_destino text NOT NULL,
    estado text NOT NULL,
    area_origen text,
    area_destino text,
    actor text,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: movimientos_expediente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.movimientos_expediente ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.movimientos_expediente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: organizaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    creado_por uuid NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organizaciones_nombre_check CHECK (((char_length(TRIM(BOTH FROM nombre)) >= 2) AND (char_length(TRIM(BOTH FROM nombre)) <= 120)))
);


--
-- Name: pagos_expediente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_expediente (
    id bigint NOT NULL,
    expediente_id bigint NOT NULL,
    concepto text NOT NULL,
    recibo text NOT NULL,
    importe numeric(14,2) NOT NULL,
    fecha date NOT NULL,
    evidencia text NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pagos_expediente_concepto_check CHECK ((concepto = ANY (ARRAY['Lote'::text, 'Servicios catastrales'::text, 'Búsqueda de información'::text, 'Documento solicitado'::text]))),
    CONSTRAINT pagos_expediente_importe_check CHECK ((importe > (0)::numeric))
);


--
-- Name: pagos_expediente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.pagos_expediente ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.pagos_expediente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: predio_geometria_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.predio_geometria_historial (
    id bigint NOT NULL,
    predio_id bigint NOT NULL,
    clave_catastral text NOT NULL,
    geom_anterior public.geometry(MultiPolygon,4326) NOT NULL,
    geom_nueva public.geometry(MultiPolygon,4326) NOT NULL,
    superficie_anterior numeric(14,2),
    superficie_nueva numeric(14,2) NOT NULL,
    actor text NOT NULL,
    motivo text NOT NULL,
    fecha_cambio timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT predio_geometria_historial_actor_check CHECK ((length(TRIM(BOTH FROM actor)) > 0)),
    CONSTRAINT predio_geometria_historial_motivo_check CHECK ((length(TRIM(BOTH FROM motivo)) > 0)),
    CONSTRAINT predio_geometria_historial_superficie_nueva_check CHECK ((superficie_nueva >= (0)::numeric))
);


--
-- Name: predio_geometria_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.predio_geometria_historial ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.predio_geometria_historial_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: predios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.predios (
    id bigint NOT NULL,
    clave_catastral text NOT NULL,
    id_predio text,
    id_predio_cart text,
    status integer,
    municipio text,
    fundo text,
    manzana text,
    lote text,
    superficie numeric(14,2),
    libro text,
    titulo text,
    fecha_titulo date,
    geom public.geometry(MultiPolygon,4326) NOT NULL,
    estado_medicion text DEFAULT 'sin_confirmar'::text NOT NULL,
    fecha_medicion date,
    observaciones_medicion text,
    id_fundos uuid,
    organizacion_id uuid,
    propietario_id uuid,
    fundo_id uuid,
    creado_en timestamp with time zone,
    actualizado_en timestamp with time zone,
    CONSTRAINT predios_datos_fundos_check CHECK ((((id_fundos IS NULL) AND (propietario_id IS NULL) AND (fundo_id IS NULL)) OR (organizacion_id IS NOT NULL))),
    CONSTRAINT predios_estado_medicion_valido CHECK ((estado_medicion = ANY (ARRAY['medido'::text, 'no_medido'::text, 'sin_confirmar'::text])))
);


--
-- Name: predios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.predios ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.predios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: propietarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.propietarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizacion_id uuid NOT NULL,
    nombre_completo text NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT propietarios_nombre_completo_check CHECK (((char_length(TRIM(BOTH FROM nombre_completo)) >= 2) AND (char_length(TRIM(BOTH FROM nombre_completo)) <= 200)))
);


--
-- Name: requisitos_documentales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requisitos_documentales (
    tipo_tramite text NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT requisitos_documentales_nombre_check CHECK (((length(TRIM(BOTH FROM nombre)) >= 1) AND (length(TRIM(BOTH FROM nombre)) <= 120)))
);


--
-- Name: sesiones_locales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesiones_locales (
    token_hash text NOT NULL,
    usuario_id uuid NOT NULL,
    vence_en timestamp with time zone NOT NULL
);


--
-- Name: solicitantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitantes (
    id bigint NOT NULL,
    nombre text NOT NULL,
    identificacion text,
    telefono text,
    correo text,
    domicilio_notificacion text,
    representante_nombre text,
    representante_identificacion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    nombres text,
    primer_apellido text,
    segundo_apellido text,
    CONSTRAINT solicitantes_nombre_no_vacio CHECK ((length(TRIM(BOTH FROM nombre)) > 0))
);


--
-- Name: solicitantes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.solicitantes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.solicitantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ubicaciones_solicitadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ubicaciones_solicitadas (
    expediente_id bigint NOT NULL,
    municipio text NOT NULL,
    localidad text NOT NULL,
    direccion text,
    referencias text NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ubicaciones_solicitadas_direccion_check CHECK (((direccion IS NULL) OR (length(direccion) <= 500))),
    CONSTRAINT ubicaciones_solicitadas_localidad_check CHECK (((length(TRIM(BOTH FROM localidad)) >= 1) AND (length(TRIM(BOTH FROM localidad)) <= 150))),
    CONSTRAINT ubicaciones_solicitadas_municipio_check CHECK (((length(TRIM(BOTH FROM municipio)) >= 1) AND (length(TRIM(BOTH FROM municipio)) <= 150))),
    CONSTRAINT ubicaciones_solicitadas_referencias_check CHECK (((length(TRIM(BOTH FROM referencias)) >= 1) AND (length(TRIM(BOTH FROM referencias)) <= 1500)))
);


--
-- Name: usuarios_locales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios_locales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    correo text NOT NULL,
    rol text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    password_hash text,
    eliminado_en timestamp with time zone,
    CONSTRAINT usuarios_locales_rol_check CHECK ((rol = ANY (ARRAY['admin'::text, 'ventanilla'::text, 'direccion'::text, 'jefatura'::text, 'legal'::text, 'caja'::text, 'finanzas'::text, 'digitalizacion'::text, 'captura'::text, 'titulacion'::text, 'informatica'::text, 'viewer'::text, 'topografia'::text, 'cartografia'::text])))
);


--
-- Name: visitas_iniciales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitas_iniciales (
    expediente_id bigint NOT NULL,
    estado text NOT NULL,
    responsable_id uuid,
    fecha_compromiso date,
    fecha_visita date,
    superficie_m2 numeric(14,2),
    observaciones text,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT visitas_iniciales_check CHECK (((estado <> ALL (ARRAY['asignado'::text, 'visitado'::text])) OR ((responsable_id IS NOT NULL) AND (fecha_compromiso IS NOT NULL)))),
    CONSTRAINT visitas_iniciales_check1 CHECK (((estado <> 'visitado'::text) OR ((fecha_visita IS NOT NULL) AND (superficie_m2 IS NOT NULL) AND (observaciones IS NOT NULL) AND (length(TRIM(BOTH FROM observaciones)) > 0)))),
    CONSTRAINT visitas_iniciales_estado_check CHECK ((estado = ANY (ARRAY['revision_direccion'::text, 'revision_jefatura'::text, 'solicitado'::text, 'asignado'::text, 'visitado'::text]))),
    CONSTRAINT visitas_iniciales_superficie_m2_check CHECK ((superficie_m2 > (0)::numeric))
);


--
-- Name: expedientes expedientes_organizacion_id_folio_key; Type: CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.expedientes
    ADD CONSTRAINT expedientes_organizacion_id_folio_key UNIQUE (organizacion_id, folio);


--
-- Name: expedientes expedientes_pkey; Type: CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.expedientes
    ADD CONSTRAINT expedientes_pkey PRIMARY KEY (id);


--
-- Name: predios predios_organizacion_id_fundo_id_manzana_lote_key; Type: CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.predios
    ADD CONSTRAINT predios_organizacion_id_fundo_id_manzana_lote_key UNIQUE (organizacion_id, fundo_id, manzana, lote);


--
-- Name: predios predios_organizacion_id_id_key; Type: CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.predios
    ADD CONSTRAINT predios_organizacion_id_id_key UNIQUE (organizacion_id, id);


--
-- Name: predios predios_pkey; Type: CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.predios
    ADD CONSTRAINT predios_pkey PRIMARY KEY (id);


--
-- Name: archivos_expediente archivos_expediente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos_expediente
    ADD CONSTRAINT archivos_expediente_pkey PRIMARY KEY (id);


--
-- Name: archivos_visita_inicial archivos_visita_inicial_expediente_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos_visita_inicial
    ADD CONSTRAINT archivos_visita_inicial_expediente_id_version_key UNIQUE (expediente_id, version);


--
-- Name: archivos_visita_inicial archivos_visita_inicial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos_visita_inicial
    ADD CONSTRAINT archivos_visita_inicial_pkey PRIMARY KEY (id);


--
-- Name: auditoria_usuarios auditoria_usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_usuarios
    ADD CONSTRAINT auditoria_usuarios_pkey PRIMARY KEY (id);


--
-- Name: datos_catastrales_expediente datos_catastrales_expediente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datos_catastrales_expediente
    ADD CONSTRAINT datos_catastrales_expediente_pkey PRIMARY KEY (expediente_id, predio_id);


--
-- Name: expediente_predios expediente_predios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_predios
    ADD CONSTRAINT expediente_predios_pkey PRIMARY KEY (expediente_id, predio_id);


--
-- Name: expedientes expedientes_folio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes
    ADD CONSTRAINT expedientes_folio_key UNIQUE (folio);


--
-- Name: expedientes expedientes_id_fundos_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes
    ADD CONSTRAINT expedientes_id_fundos_key UNIQUE (id_fundos);


--
-- Name: expedientes expedientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes
    ADD CONSTRAINT expedientes_pkey PRIMARY KEY (id);


--
-- Name: fundos fundos_organizacion_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundos
    ADD CONSTRAINT fundos_organizacion_id_id_key UNIQUE (organizacion_id, id);


--
-- Name: fundos fundos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundos
    ADD CONSTRAINT fundos_pkey PRIMARY KEY (id);


--
-- Name: mediciones_expediente mediciones_expediente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mediciones_expediente
    ADD CONSTRAINT mediciones_expediente_pkey PRIMARY KEY (expediente_id, predio_id);


--
-- Name: miembros_organizacion miembros_organizacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_organizacion
    ADD CONSTRAINT miembros_organizacion_pkey PRIMARY KEY (organizacion_id, usuario_id);


--
-- Name: modulo_registros modulo_registros_organizacion_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo_registros
    ADD CONSTRAINT modulo_registros_organizacion_id_id_key UNIQUE (organizacion_id, id);


--
-- Name: modulo_registros modulo_registros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo_registros
    ADD CONSTRAINT modulo_registros_pkey PRIMARY KEY (id);


--
-- Name: movimientos_expediente movimientos_expediente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_expediente
    ADD CONSTRAINT movimientos_expediente_pkey PRIMARY KEY (id);


--
-- Name: organizaciones organizaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizaciones
    ADD CONSTRAINT organizaciones_pkey PRIMARY KEY (id);


--
-- Name: pagos_expediente pagos_expediente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_expediente
    ADD CONSTRAINT pagos_expediente_pkey PRIMARY KEY (id);


--
-- Name: pagos_expediente pagos_expediente_recibo_concepto_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_expediente
    ADD CONSTRAINT pagos_expediente_recibo_concepto_key UNIQUE (recibo, concepto);


--
-- Name: predio_geometria_historial predio_geometria_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predio_geometria_historial
    ADD CONSTRAINT predio_geometria_historial_pkey PRIMARY KEY (id);


--
-- Name: predios predios_clave_catastral_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predios
    ADD CONSTRAINT predios_clave_catastral_key UNIQUE (clave_catastral);


--
-- Name: predios predios_id_fundos_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predios
    ADD CONSTRAINT predios_id_fundos_key UNIQUE (id_fundos);


--
-- Name: predios predios_organizacion_id_sigep_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predios
    ADD CONSTRAINT predios_organizacion_id_sigep_key UNIQUE (organizacion_id, id);


--
-- Name: predios predios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predios
    ADD CONSTRAINT predios_pkey PRIMARY KEY (id);


--
-- Name: propietarios propietarios_organizacion_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propietarios
    ADD CONSTRAINT propietarios_organizacion_id_id_key UNIQUE (organizacion_id, id);


--
-- Name: propietarios propietarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propietarios
    ADD CONSTRAINT propietarios_pkey PRIMARY KEY (id);


--
-- Name: requisitos_documentales requisitos_documentales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitos_documentales
    ADD CONSTRAINT requisitos_documentales_pkey PRIMARY KEY (tipo_tramite, nombre);


--
-- Name: sesiones_locales sesiones_locales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_locales
    ADD CONSTRAINT sesiones_locales_pkey PRIMARY KEY (token_hash);


--
-- Name: solicitantes solicitantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitantes
    ADD CONSTRAINT solicitantes_pkey PRIMARY KEY (id);


--
-- Name: ubicaciones_solicitadas ubicaciones_solicitadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones_solicitadas
    ADD CONSTRAINT ubicaciones_solicitadas_pkey PRIMARY KEY (expediente_id);


--
-- Name: usuarios_locales usuarios_locales_correo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_locales
    ADD CONSTRAINT usuarios_locales_correo_key UNIQUE (correo);


--
-- Name: usuarios_locales usuarios_locales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_locales
    ADD CONSTRAINT usuarios_locales_pkey PRIMARY KEY (id);


--
-- Name: visitas_iniciales visitas_iniciales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas_iniciales
    ADD CONSTRAINT visitas_iniciales_pkey PRIMARY KEY (expediente_id);


--
-- Name: expedientes_estado_idx; Type: INDEX; Schema: fundos_legales; Owner: -
--

CREATE INDEX expedientes_estado_idx ON fundos_legales.expedientes USING btree (organizacion_id, estado);


--
-- Name: expedientes_fecha_solicitud_idx; Type: INDEX; Schema: fundos_legales; Owner: -
--

CREATE INDEX expedientes_fecha_solicitud_idx ON fundos_legales.expedientes USING btree (organizacion_id, fecha_solicitud DESC);


--
-- Name: expedientes_predio_idx; Type: INDEX; Schema: fundos_legales; Owner: -
--

CREATE INDEX expedientes_predio_idx ON fundos_legales.expedientes USING btree (organizacion_id, predio_id);


--
-- Name: predios_propietario_idx; Type: INDEX; Schema: fundos_legales; Owner: -
--

CREATE INDEX predios_propietario_idx ON fundos_legales.predios USING btree (organizacion_id, propietario_id);


--
-- Name: archivos_expediente_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX archivos_expediente_lookup_idx ON public.archivos_expediente USING btree (expediente_id, predio_id, tipo, version DESC);


--
-- Name: archivos_expediente_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX archivos_expediente_version_idx ON public.archivos_expediente USING btree (expediente_id, COALESCE(predio_id, (0)::bigint), tipo, COALESCE(requisito, ''::text), version);


--
-- Name: fundos_nombre_por_organizacion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fundos_nombre_por_organizacion_idx ON public.fundos USING btree (organizacion_id, lower(nombre));


--
-- Name: idx_expediente_predios_predio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expediente_predios_predio ON public.expediente_predios USING btree (predio_id);


--
-- Name: idx_expedientes_estado_etapa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expedientes_estado_etapa ON public.expedientes USING btree (estado, etapa_actual);


--
-- Name: idx_expedientes_fecha_recepcion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expedientes_fecha_recepcion ON public.expedientes USING btree (fecha_recepcion);


--
-- Name: idx_expedientes_folio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expedientes_folio ON public.expedientes USING btree (folio);


--
-- Name: idx_movimientos_expediente_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_expediente_fecha ON public.movimientos_expediente USING btree (expediente_id, created_at DESC);


--
-- Name: idx_predio_geometria_historial_predio_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_predio_geometria_historial_predio_fecha ON public.predio_geometria_historial USING btree (predio_id, fecha_cambio DESC);


--
-- Name: idx_predios_geom_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_predios_geom_gist ON public.predios USING gist (geom);


--
-- Name: mediciones_responsable_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mediciones_responsable_idx ON public.mediciones_expediente USING btree (responsable_id, estado);


--
-- Name: modulo_registros_busqueda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX modulo_registros_busqueda_idx ON public.modulo_registros USING btree (organizacion_id, modulo, actualizado_en DESC);


--
-- Name: pagos_expediente_folio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagos_expediente_folio_idx ON public.pagos_expediente USING btree (expediente_id);


--
-- Name: predios_geom_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX predios_geom_gix ON public.predios USING gist (geom);


--
-- Name: propietarios_nombre_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX propietarios_nombre_idx ON public.propietarios USING btree (organizacion_id, lower(nombre_completo));


--
-- Name: sesiones_locales_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sesiones_locales_usuario_idx ON public.sesiones_locales USING btree (usuario_id);


--
-- Name: visitas_iniciales_responsable_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visitas_iniciales_responsable_idx ON public.visitas_iniciales USING btree (responsable_id, estado);


--
-- Name: expedientes expedientes_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.expedientes
    ADD CONSTRAINT expedientes_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;


--
-- Name: expedientes expedientes_organizacion_id_predio_id_fkey; Type: FK CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.expedientes
    ADD CONSTRAINT expedientes_organizacion_id_predio_id_fkey FOREIGN KEY (organizacion_id, predio_id) REFERENCES fundos_legales.predios(organizacion_id, id) ON DELETE RESTRICT;


--
-- Name: predios predios_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.predios
    ADD CONSTRAINT predios_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;


--
-- Name: predios predios_organizacion_id_fundo_id_fkey; Type: FK CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.predios
    ADD CONSTRAINT predios_organizacion_id_fundo_id_fkey FOREIGN KEY (organizacion_id, fundo_id) REFERENCES public.fundos(organizacion_id, id) ON DELETE RESTRICT;


--
-- Name: predios predios_organizacion_id_propietario_id_fkey; Type: FK CONSTRAINT; Schema: fundos_legales; Owner: -
--

ALTER TABLE ONLY fundos_legales.predios
    ADD CONSTRAINT predios_organizacion_id_propietario_id_fkey FOREIGN KEY (organizacion_id, propietario_id) REFERENCES public.propietarios(organizacion_id, id) ON DELETE RESTRICT;


--
-- Name: archivos_expediente archivos_expediente_expediente_id_predio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos_expediente
    ADD CONSTRAINT archivos_expediente_expediente_id_predio_id_fkey FOREIGN KEY (expediente_id, predio_id) REFERENCES public.expediente_predios(expediente_id, predio_id) ON DELETE RESTRICT;


--
-- Name: archivos_expediente archivos_expediente_revisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos_expediente
    ADD CONSTRAINT archivos_expediente_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES public.usuarios_locales(id) ON DELETE RESTRICT;


--
-- Name: archivos_expediente archivos_expediente_subido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos_expediente
    ADD CONSTRAINT archivos_expediente_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.usuarios_locales(id) ON DELETE RESTRICT;


--
-- Name: archivos_visita_inicial archivos_visita_inicial_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos_visita_inicial
    ADD CONSTRAINT archivos_visita_inicial_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.visitas_iniciales(expediente_id) ON DELETE RESTRICT;


--
-- Name: archivos_visita_inicial archivos_visita_inicial_subido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos_visita_inicial
    ADD CONSTRAINT archivos_visita_inicial_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.usuarios_locales(id) ON DELETE RESTRICT;


--
-- Name: auditoria_usuarios auditoria_usuarios_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_usuarios
    ADD CONSTRAINT auditoria_usuarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_locales(id);


--
-- Name: datos_catastrales_expediente datos_catastrales_expediente_capturado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datos_catastrales_expediente
    ADD CONSTRAINT datos_catastrales_expediente_capturado_por_fkey FOREIGN KEY (capturado_por) REFERENCES public.usuarios_locales(id) ON DELETE RESTRICT;


--
-- Name: datos_catastrales_expediente datos_catastrales_expediente_expediente_id_predio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datos_catastrales_expediente
    ADD CONSTRAINT datos_catastrales_expediente_expediente_id_predio_id_fkey FOREIGN KEY (expediente_id, predio_id) REFERENCES public.expediente_predios(expediente_id, predio_id) ON DELETE RESTRICT;


--
-- Name: datos_catastrales_expediente datos_catastrales_expediente_revisado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datos_catastrales_expediente
    ADD CONSTRAINT datos_catastrales_expediente_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES public.usuarios_locales(id) ON DELETE RESTRICT;


--
-- Name: expediente_predios expediente_predios_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_predios
    ADD CONSTRAINT expediente_predios_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id) ON DELETE RESTRICT;


--
-- Name: expediente_predios expediente_predios_predio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expediente_predios
    ADD CONSTRAINT expediente_predios_predio_id_fkey FOREIGN KEY (predio_id) REFERENCES public.predios(id) ON DELETE RESTRICT;


--
-- Name: expedientes expedientes_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes
    ADD CONSTRAINT expedientes_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id);


--
-- Name: expedientes expedientes_predio_principal_org_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes
    ADD CONSTRAINT expedientes_predio_principal_org_fk FOREIGN KEY (organizacion_id, predio_principal_id) REFERENCES public.predios(organizacion_id, id);


--
-- Name: expedientes expedientes_predio_principal_vinculo_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes
    ADD CONSTRAINT expedientes_predio_principal_vinculo_fk FOREIGN KEY (id, predio_principal_id) REFERENCES public.expediente_predios(expediente_id, predio_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: expedientes expedientes_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expedientes
    ADD CONSTRAINT expedientes_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.solicitantes(id) ON DELETE RESTRICT;


--
-- Name: fundos fundos_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundos
    ADD CONSTRAINT fundos_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;


--
-- Name: mediciones_expediente mediciones_expediente_expediente_id_predio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mediciones_expediente
    ADD CONSTRAINT mediciones_expediente_expediente_id_predio_id_fkey FOREIGN KEY (expediente_id, predio_id) REFERENCES public.expediente_predios(expediente_id, predio_id) ON DELETE RESTRICT;


--
-- Name: mediciones_expediente mediciones_expediente_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mediciones_expediente
    ADD CONSTRAINT mediciones_expediente_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.usuarios_locales(id);


--
-- Name: miembros_organizacion miembros_organizacion_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miembros_organizacion
    ADD CONSTRAINT miembros_organizacion_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;


--
-- Name: modulo_registros modulo_registros_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo_registros
    ADD CONSTRAINT modulo_registros_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;


--
-- Name: movimientos_expediente movimientos_expediente_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_expediente
    ADD CONSTRAINT movimientos_expediente_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id) ON DELETE RESTRICT;


--
-- Name: pagos_expediente pagos_expediente_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_expediente
    ADD CONSTRAINT pagos_expediente_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id) ON DELETE RESTRICT;


--
-- Name: predio_geometria_historial predio_geometria_historial_predio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predio_geometria_historial
    ADD CONSTRAINT predio_geometria_historial_predio_id_fkey FOREIGN KEY (predio_id) REFERENCES public.predios(id) ON DELETE RESTRICT;


--
-- Name: predios predios_fundo_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predios
    ADD CONSTRAINT predios_fundo_fk FOREIGN KEY (organizacion_id, fundo_id) REFERENCES public.fundos(organizacion_id, id);


--
-- Name: predios predios_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predios
    ADD CONSTRAINT predios_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id);


--
-- Name: predios predios_propietario_fundos_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.predios
    ADD CONSTRAINT predios_propietario_fundos_fk FOREIGN KEY (organizacion_id, propietario_id) REFERENCES public.propietarios(organizacion_id, id);


--
-- Name: propietarios propietarios_organizacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.propietarios
    ADD CONSTRAINT propietarios_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;


--
-- Name: sesiones_locales sesiones_locales_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_locales
    ADD CONSTRAINT sesiones_locales_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios_locales(id) ON DELETE CASCADE;


--
-- Name: ubicaciones_solicitadas ubicaciones_solicitadas_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones_solicitadas
    ADD CONSTRAINT ubicaciones_solicitadas_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id) ON DELETE RESTRICT;


--
-- Name: visitas_iniciales visitas_iniciales_expediente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas_iniciales
    ADD CONSTRAINT visitas_iniciales_expediente_id_fkey FOREIGN KEY (expediente_id) REFERENCES public.ubicaciones_solicitadas(expediente_id) ON DELETE RESTRICT;


--
-- Name: visitas_iniciales visitas_iniciales_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas_iniciales
    ADD CONSTRAINT visitas_iniciales_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.usuarios_locales(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--


-- Cambio local posterior a la extracción: integridad de documentos generales.
ALTER TABLE public.archivos_expediente
  ADD CONSTRAINT archivos_expediente_expediente_fk
  FOREIGN KEY (expediente_id) REFERENCES public.expedientes(id) ON DELETE RESTRICT;
COMMIT;
