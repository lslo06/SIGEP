-- SOLO DEMOSTRACION: deja una cuenta activa por rol con clave 1234567890.
-- Da de baja las otras cuentas, conserva referencias y revoca todas las sesiones.
-- Ejecutar como administrador de PostgreSQL con ON_ERROR_STOP=1.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('sigep.usuarios', 0));
LOCK TABLE public.usuarios_locales IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE demo_accounts (nombre text, correo text PRIMARY KEY, rol text, password_hash text) ON COMMIT DROP;
INSERT INTO demo_accounts VALUES
('Administración', 'administracion@gmail.com', 'admin', '69214e7976a0fffe2a0ba5390a8a8d7c:ba9426c56f747e78756e7601fd12b31c028a792d71fded3a0882f1ab9d19f1b20c8bbf576eb843326406a82fcdfcd479c9498e4ee5a5875b4622c7895d0622df'),
('Ventanilla', 'ventanilla@gmail.com', 'ventanilla', 'e73d0ab73c5b933f2851db8f38f8a0b1:070dc04aafcd1782e931324ccd35e74b10e21c58be2cc78da4765f261710fbe7a58616bd98204badeeb85bc9706ae1dea37b0d61cad238de84165bf7ae56b62b'),
('Dirección', 'direccion@gmail.com', 'direccion', '17f97b28cf403dcc9e9d61a95e217db6:5669e670587eaf3a7e111acfeab265bcb0885c608d8b671ed7ac9eded41209b2171b3f314d4a9fff1ee21d1397b281d280fe3571e201cfd86c00a8209ad32508'),
('Jefatura de Fundos Legales', 'jefatura@gmail.com', 'jefatura', 'eb2d58b42979d025ae066663ca836fb8:d484ef7928f3807e26e2ae0bd6e49bb44e60c398a1de09d630c8748b5a350189f981a56e72db32555987734eb53e17260e2f7cc02ab32d68925ce19dde704534'),
('Área Legal', 'legal@gmail.com', 'legal', 'f05e67185678655fa40a7c6f5958c4cb:736405ce09ba438714a8f88773fabfa12af6e7755ee84d23737897929e202bf38f924a0cbc23d8dabbc9667c460e3c05480a64b6869bd2ae95c0b08d18eea9f1'),
('Cartografía y Valuación', 'cartografia@gmail.com', 'cartografia', '8e14990f23068e8eedf3816766279b0a:b206e9ee57fefa6dbfeb04178e9173ec21368adf88a7e9fe9100e339b8d82126f0290bfe330a43c2c431f23fec164a99b0c27dfb5ed8596a0a3890e4311bd9cf'),
('Topografía', 'topografia@gmail.com', 'topografia', 'cd63482ca6e40751ac461e61ee655575:b1507dbf5f1229f35e9aae58f2ec2a63fe34762daa9707014c1dc63b53cc0ed0bd490e8443fe6667a7cb75026fd98b6e240a14339a1017d5cd3cfb02700451a3'),
('Caja / Recaudación', 'caja@gmail.com', 'caja', '04b3623cbd500c0bc53aad05438da0ce:38b0acbe22d2f64fd645a9c809313b60baba4023bd1991f712062aeff6767cc479e9c7de44be02796edbbcfc0b70edd264cbe10739f9290f9d969bdeeba957ff'),
('Digitalización', 'digitalizacion@gmail.com', 'digitalizacion', 'c9df0501a126eb79fc069544d64a140f:828f976d6513fdd21a88c057f93fab14451d8274b1ccaa13faecea81a05967cde2fa9319b3b32e34c6807b30df24872cdd1f435ccc4813737c17d74940fe357b'),
('Captura', 'captura@gmail.com', 'captura', '4964e9fc649d6acd959be7b3733fe34e:67b6efe080dfe52632ec93efca33eda8e1a528c1d83903c27dfacbdd901e3ce8480cfc5bac0ebe6d1b352a7f2d133b78960b49c572329348f2a5fdac231dfe4f'),
('Titulación', 'titulacion@gmail.com', 'titulacion', '04068f847d2f0c60d5e7002d33ff08f1:b9baae9268cfcafd475b87e6cbb669f6abf27502e23a869d7e0a2b9a3b4c4381c0afbf215e8532fd62acdfde1ab717909dfdcb8bd1471590e79bd25703a7a219'),
('Informática', 'informatica@gmail.com', 'informatica', 'b2cab809790cd458ba117c4c0a03cab1:bf3542af5a27b27f576408c0af33a1c93153b21e4204af7fa20898a4b0a496fe56560dbe3abd76f3f0f883036c4df75dd6d28b7e390c238e0d253f9dd64ac7d2'),
('Consulta / Auditoría', 'consulta@gmail.com', 'viewer', '91f17f857f7f40911ceafae1a636ee9c:46d66cc8e47309b820b8b45007997da4728edf38cec50de756f5785127168ffe4c2ef87cb2a9617afa534e14125d86870987d55eccdcfc8d0aee8a790d43ee56');
CREATE TEMP TABLE demo_previous ON COMMIT DROP AS
SELECT id, nombre, correo, rol, activo, eliminado_en FROM public.usuarios_locales;
INSERT INTO public.usuarios_locales (nombre, correo, rol, password_hash, activo, eliminado_en)
SELECT nombre, correo, rol, password_hash, true, NULL FROM demo_accounts
ON CONFLICT (correo) DO UPDATE SET nombre = EXCLUDED.nombre, rol = EXCLUDED.rol,
password_hash = EXCLUDED.password_hash, activo = true, eliminado_en = NULL;
UPDATE public.usuarios_locales SET activo = false, eliminado_en = coalesce(eliminado_en, now())
WHERE correo NOT IN (SELECT correo FROM demo_accounts) AND (activo OR eliminado_en IS NULL);
DELETE FROM public.sesiones_locales;
INSERT INTO public.auditoria_usuarios (usuario_id, actor, accion, anterior, nuevo)
SELECT u.id, 'mantenimiento:cuentas-demo',
CASE WHEN d.correo IS NULL THEN 'baja' WHEN p.id IS NULL THEN 'alta' ELSE 'edicion' END,
CASE WHEN p.id IS NULL THEN NULL ELSE to_jsonb(p) END,
jsonb_build_object('id', u.id, 'nombre', u.nombre, 'correo', u.correo, 'rol', u.rol,
'activo', u.activo, 'eliminado_en', u.eliminado_en)
FROM public.usuarios_locales u
LEFT JOIN demo_previous p ON p.id = u.id
LEFT JOIN demo_accounts d ON d.correo = u.correo
WHERE d.correo IS NOT NULL OR p.activo OR p.eliminado_en IS NULL;
DO $$ BEGIN
IF (SELECT count(*) FROM public.usuarios_locales WHERE activo AND eliminado_en IS NULL) <> 13
OR (SELECT count(DISTINCT rol) FROM public.usuarios_locales WHERE activo AND eliminado_en IS NULL) <> 13
THEN RAISE EXCEPTION 'Se esperaban 13 cuentas activas, una por rol'; END IF;
END $$;
COMMIT;
SELECT nombre, correo, rol FROM public.usuarios_locales WHERE activo AND eliminado_en IS NULL ORDER BY nombre;
