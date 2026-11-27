# SIGEP — Manual de usuario

Versión 0.1 · 27 de noviembre de 2026. Borrador operativo correspondiente al código local; pendiente de publicación y aceptación en el servidor. No contiene contraseñas ni datos ciudadanos reales.

## 1. Para qué sirve esta versión

SIGEP permite recibir una solicitud de título aunque la persona no tenga documentos, clave catastral ni un predio previamente registrado. Conserva un folio durante la canalización, visita, identificación cartográfica e integración de documentos.

Recibir una solicitud no reconoce propiedad ni garantiza que se otorgará un título. Esta versión aún no completa la emisión oficial, Consejería, inscripción en RPP, entrega y cierre del trámite. Los requisitos documentales del sistema son una configuración de trabajo que debe validar la institución.

## 2. Entrar y localizar el trabajo

1. Conectarse a la red institucional y abrir la dirección proporcionada por Informática.
2. Iniciar sesión con la cuenta individual asignada. Comprobar el rol mostrado en la barra lateral.
3. Abrir el módulo correspondiente. El menú cambia según el puesto.
4. En Seguimiento, usar **Mi área** para pendientes del área y **Consulta general** para buscar expedientes. Los contadores corresponden a los registros cargados; no constituyen estadísticas institucionales completas.
5. Buscar por folio cuando se conozca. Los filtros se combinan: limpiar los anteriores si no aparece un resultado. Se muestran hasta 100 coincidencias.
6. Cerrar sesión al terminar o antes de cambiar de rol en una prueba.

Que una solicitud deje de aparecer en una bandeja después de canalizarla puede ser correcto: ahora corresponde a otra área. Consultar su historial por folio. No crear un segundo expediente para continuar el mismo trámite.

## 3. Funciones por puesto

Esta tabla describe permisos actuales; no reemplaza la asignación formal de responsabilidades que apruebe la institución.

| Rol | Funciones disponibles | Límite relevante |
|---|---|---|
| Ventanilla | Recibir solicitud, consultar ubicación, solicitar medición y adjuntar documentos. | No corrige cartografía ni acepta/rechaza documentos. |
| Dirección | Revisar la recepción y canalizar a Fundos Legales. | No equivale a autorizar un título definitivo. |
| Jefatura | Revisar y canalizar a Cartografía. | La revisión final de certificaciones aún está pendiente. |
| Cartografía y Valuación | Asignar visita, vincular predio identificado, corregir geometría, cargar plano, capturar/revisar cédula y documentos. | La vinculación exige visita y evidencia; no aprueba automáticamente toda la cartografía. |
| Topografía | Consultar visitas asignadas, registrar fecha/superficie/observaciones y evidencia. | Sólo escribe sobre visitas asignadas a su cuenta. |
| Digitalización | Cargar, consultar y revisar documentos. | No edita geometría ni aprueba valores catastrales. |
| Captura | Recibir solicitudes, altas permitidas y captura de cédula/propietarios pendiente de revisión. | No aprueba cédula ni corrige geometría; la solicitud de medición inicial corresponde a Ventanilla/Administración. |
| Caja / Recaudación | Registrar recibos y consultar pagos. | El registro no confirma validación bancaria ni habilita automáticamente etapas. |
| Área Legal | Dictamen de cuatro certificaciones/constancias y borradores disponibles. | No es dictamen de primera titulación ni aplica a la búsqueda genérica. |
| Titulación | Consultar expedientes, documentos aceptados y datos catastrales. | Emisión oficial del título todavía pendiente. |
| Informática | Consultar expedientes y datos catastrales. | No modifica ni aprueba cédula; validación formal de consistencia pendiente. |
| Consulta / Auditoría | Consultar información e historial permitido, documentos generales aceptados. | Sin escrituras operativas. |
| Administración | Gestionar usuarios y checklist; operaciones administrativas autorizadas. | No sustituye la cuenta del topógrafo asignado ni al rol Legal para dictaminar. |

La consulta general y el acceso a datos personales siguen siendo relativamente amplios para varios roles. Antes del uso institucional deben acordarse alcance por área/expediente, datos visibles y responsabilidades de revisión; ocultar un menú no basta para restringir datos.

## 4. Recepción de una solicitud desde cero

**Ventanilla → Seguimiento de trámites → Nueva solicitud de título**. También está disponible desde Inicio para los roles habilitados.

| Campo | Qué capturar | Obligatorio en la recepción |
|---|---|---|
| Nombre(s) | Sólo nombres; por ejemplo, María Elena. | Sí. |
| Apellido paterno / materno | Cada apellido en su campo. Si tiene uno solo, dejar el otro vacío. | Al menos uno. |
| Teléfono | Número para contactar a la persona. | No. |
| Correo electrónico | Correo de contacto, si cuenta con él. | No; si se captura debe tener formato de correo. |
| Domicilio para notificaciones | Lugar donde se puede contactar al solicitante. | No; puede ser diferente del terreno. |
| Municipio | Municipio donde se encuentra el terreno. | Sí. |
| Localidad o colonia | Nombre del asentamiento donde se ubica. | Sí. |
| Dirección o descripción del lugar | Calle/número o camino/kilómetro, si se conoce. | No. |
| Referencias para la visita | Indicaciones concretas para llegar: puente, camino, distancia, portón, etc. | Sí. |
| Observaciones de recepción | Motivo de solicitud y faltantes conocidos. | No. |

Pulsar **Guardar solicitud y generar folio**. Anotar el folio y comprobar nombres, ubicación e historial. La ubicación es declarada por la persona y queda pendiente de verificación. Este formulario no exige identificación, archivos, coordenadas ni clave catastral.

Ejemplo ficticio: María Elena García López, municipio Durango, localidad de prueba; referencia “Por el camino a la escuela, 200 m después del puente, junto al portón azul”. No inventar una clave ni seleccionar un predio distinto para superar el formulario.

## 5. Canalizar y registrar la visita

Abrir el mismo folio en **Solicitudes de título desde ventanilla** o en **Ubicación y visita inicial** de su ficha.

| Paso | Responsable y acción | Resultado |
|---|---|---|
| 1 | Ventanilla: **Solicitar medición**. | Pendiente de Dirección. |
| 2 | Dirección: **Canalizar a Fundos Legales**. | Pendiente de Jefatura. |
| 3 | Jefatura: **Canalizar a Cartografía**. | Pendiente de asignación. |
| 4 | Cartografía: en Medición y topografía elegir topógrafo activo y fecha compromiso; **Asignar visita**. | Visita asignada a esa persona. |
| 5 | Topógrafo asignado: **Registrar visita** con fecha, superficie positiva en m² y observaciones. | Visita registrada, pendiente de revisión cartográfica. |
| 6 | Mismo topógrafo: **Adjuntar evidencia**. | Archivo incorporado con versión e historial. |

La fecha de visita no puede ser futura. Las observaciones deben explicar cómo se identificó el terreno y qué se encontró. La superficie medida no es por sí sola una aprobación catastral.

La evidencia admite PDF, PNG o JPEG de hasta 10 MB. Comprobar que el archivo abre después de cargarlo. Una segunda carga conserva la anterior. Otro topógrafo no debe registrar esa visita.

## 6. Identificar el predio y continuar el mismo expediente

Cartografía abre **Identificación cartográfica** después de la visita y evidencia:

1. Cotejar ubicación declarada, resultado de visita y evidencia.
2. Buscar la clave del predio correspondiente. Si aún no existe, registrarlo primero en **Lotes y predios** con la clave que determine el área competente y su geometría.
3. Seleccionar el resultado correcto y explicar el cotejo en observaciones.
4. Pulsar **Vincular predio al mismo folio**. El sistema exige un polígono válido y rechaza vinculación repetida.
5. Comprobar el estado **Predio vinculado · integración cartográfica**. La visita y sus archivos permanecen disponibles; no se sobrescribe automáticamente la superficie o geometría del predio.
6. Abrir el predio vinculado dentro del expediente para continuar con plano y cédula. Si difieren superficie medida y superficie del predio, documentar y revisar la diferencia.

El fondo satelital o topográfico ayuda a orientarse; no reemplaza el levantamiento ni la validación del área. La vinculación no constituye emisión de título.

## 7. Integrar y revisar documentos

Abrir **Documentación, cédula y propietarios** dentro del expediente.

1. Consultar el checklist vigente para ese tipo de trámite.
2. Seleccionar **Requisito**: qué documento se está presentando, por ejemplo identificación. Seleccionar **Etapa** para clasificar el archivo; esta selección no cambia la etapa del expediente.
3. Elegir un PDF/PNG/JPEG de hasta 10 MB y pulsar **Adjuntar documento**.
4. Comprobar nombre, versión y estado **Pendiente de revisión**.
5. Cartografía, Digitalización o Administración revisan el contenido y usan **Aceptar**, **Rechazar** o **Pendiente**. El rechazo requiere motivo.
6. Si se corrige un documento, adjuntar una versión nueva bajo el mismo requisito; se conserva el antecedente.

Titulación y Consulta sólo reciben documentos generales aceptados. Que un documento esté aceptado no significa que todos los requisitos ni el trámite estén aprobados. El sistema no verifica automáticamente autenticidad o suficiencia jurídica. Un expediente cerrado, entregado o no procedente no permite nuevas cargas/revisiones generales.

Administración puede cambiar el checklist por tipo desde esta sección. El cambio afecta a todos los expedientes de ese tipo; debe corresponder al listado institucional validado.

## 8. Cédula, valores y propietarios

Esta sección aparece después de vincular un predio y según el rol. Captura y Cartografía pueden guardar datos; Cartografía/Administración pueden aceptarlos o rechazarlos.

| Campo | Significado |
|---|---|
| Folio de cédula | Identificador del documento catastral, si existe. No es el folio del expediente. |
| Fecha de la cédula | Fecha indicada en ese documento. |
| Valor del terreno / construcción / catastral (MXN) | Importes documentados en pesos mexicanos. Dejar vacío un dato desconocido; cero significa un valor conocido de cero. No se calcula automáticamente una valuación oficial. |
| Propietarios, uno por línea | Nombres que constan en la documentación revisada. No asumir que todo solicitante ya es propietario. |

Pulsar **Guardar cédula y propietarios** y comprobar el estado de revisión. Informática, Ventanilla y Titulación consultan estos datos sin aprobarlos. La captura no genera una cédula oficial.

## 9. Pagos y servicios

Caja abre **Pagos y servicios**, captura folio del expediente, concepto, número de recibo, importe positivo, fecha y **Referencia del comprobante**. Esta última es texto para identificar el comprobante; no sube un archivo. El archivo se integra por Documentación con un rol autorizado y un requisito configurado.

Pulsar **Registrar pago** y comprobar tabla e historial. El estado **Registrado** significa captura del recibo. No hay todavía orden de pago, saldo, exención ni bloqueo de avance condicionado al pago. Un recibo duplicado para el mismo concepto debe rechazarse.

## 10. Trámites sobre predios existentes y área Legal

Desde **Lotes y predios**, buscar y seleccionar el predio e iniciar el trámite. Este formulario anterior usa **Nombre completo del solicitante**; todavía no separa apellidos como la nueva recepción.

El campo **Tipo de identificación presentada (opcional)** pide el nombre del documento, por ejemplo “credencial para votar (INE)”. No pide indistintamente CURP, número de credencial o archivo. Si no se presenta, dejarlo vacío. La copia se adjunta posteriormente y se revisa. El ejemplo no establece qué documentos acepta legalmente la institución. Cuando hay representante, el campo de identificación del representante corresponde a esa persona; no sustituye la acreditación de su representación.

Legal puede dictaminar certificación de antecedentes, certificación de copia de título, constancia de datos de lote y constancia de trámite de título. Debe elegir procede/no procede y explicar el motivo. No se permite repetir el dictamen. Los TXT descargables son borradores, no documentos oficiales. Búsqueda de información genérica y primera titulación no usan este dictamen.

## 11. Usuarios y problemas frecuentes

Administración gestiona altas, cambios de rol y desactivaciones desde su módulo. Usar una cuenta por persona para que la auditoría identifique al responsable. Desactivar conserva los antecedentes; el sistema protege al último administrador activo.

| Situación | Acción del usuario |
|---|---|
| “Tu rol no permite esta operación” | Comprobar cuenta/rol y reportar pantalla y acción. No cambiar a una cuenta compartida para eludirlo. |
| No aparece una solicitud | Limpiar filtros, buscar folio y comprobar área/asignación. |
| No aparece el mapa, pero sí los predios | Informar a soporte qué fondo falla: Calles, Satélite o Topográfico. |
| Carga rechazada | Revisar formato, tamaño, estado del expediente y permiso/asignación. |
| Error después de guardar | Recargar y consultar el folio antes de repetir para evitar duplicados. |
| Sesión vencida | Iniciar sesión otra vez; comprobar si el último cambio se guardó. |

Reportar rol, folio de prueba, pantalla, acción, hora y mensaje. No enviar contraseñas ni documentos reales en capturas de soporte general.

## 12. Alcance pendiente y documentos relacionados

Faltan la validación integral por etapas, resolución completa de primera titulación, formatos oficiales, Consejería, RPP, entrega/acuse y cierre. También falta unificar nombres separados en formularios antiguos y acordar el catálogo preciso de identificaciones y requisitos por etapa. No dividir automáticamente los nombres históricos: puede alterar nombres compuestos o personas con un solo apellido.

Consultar [Guía de pruebas](pruebas-equipo-desde-cero.md), [Informe de pruebas](resultado-pruebas-2026-11-27.md) y [Manual de instalación](manual-instalacion.md). Las capturas de pantalla finales se incorporarán desde la versión instalada, con datos ficticios.
