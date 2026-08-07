# Catálogo de casos de uso

## Estado y reglas

Catálogo funcional consolidado. Las fichas conservan asuntos pendientes, pero reflejan las decisiones de producto aprobadas en E1-A. Los IDs son estables y no describen endpoints, pantallas, tablas ni tecnología. “Autoriza” significa evaluación conceptual por identidad, relación/membresía, rol, alcance, tenant, propósito, sensibilidad y estado. Todo caso institucional debe denegar por defecto, resolver el tenant desde el recurso y evitar revelar existencia transversal.

Clasificación usada: `PUBLIC`, `INTERNAL`, `PERSONAL`, `RESTRICTED`, `HIGHLY_RESTRICTED`. Los eventos son nombres tentativos, no contratos. Las reglas institucionales de C-009, C-011, C-013 y C-014 se leen junto con [`07-institutional-validation-baseline.md`](07-institutional-validation-baseline.md), que prevalece sobre pendientes históricos de E1-A.

## Familia e identidad

### UC-FAM-001 — Crear cuenta

- **Objetivo/actor:** crear una identidad verificable; apoderado postulante. Secundario: sistema de correo.
- **FR/preguntas:** FR-ID-001; FR-COM-003; Q-105/Q-106.
- **Precondiciones/disparador:** no requiere sesión; la persona elige registrarse. El MVP vincula una sola cuenta al adulto responsable.
- **Flujo principal:** 1) aporta canal mínimo; 2) recibe desafío; 3) verifica; 4) acepta condiciones aplicables; 5) obtiene cuenta sin membresía institucional.
- **Alternativos:** canal ya asociado produce respuesta no enumerativa y recuperación segura. **Errores:** desafío vencido/usado, abuso o canal no disponible.
- **Reglas:** mensajes uniformes; canal no es identificador público; aceptación versionada.
- **Datos leídos/modificados:** política y desafío; crea cuenta, verificación y consentimiento. **Clasificación:** `PERSONAL`.
- **Autorización/tenant:** prueba de control del canal; actor global, sin acceso a tenant por crear cuenta.
- **Auditoría/comunicaciones:** alta, verificación y fallos de seguridad; mensaje de verificación minimizado.
- **Postcondición/aceptación:** cuenta verificada y sesión según política; repetir o consultar otro canal no revela cuentas.
- **Pendientes:** verificación de identidad/relación Q-106; requisitos legales Q-201 diferidos.

### UC-FAM-002 — Recuperar acceso

- **Objetivo/actor:** recuperar cuenta sin enumeración; titular de cuenta. Secundario: correo.
- **FR/preguntas:** FR-ID-002; NFR-SEC-005/006/008; Q-181.
- **Precondiciones/disparador:** perdió acceso e inicia recuperación.
- **Flujo principal:** 1) aporta canal; 2) recibe respuesta uniforme; 3) usa prueba breve y de un uso; 4) establece nuevo medio secreto; 5) se revocan sesiones según riesgo.
- **Alternativos:** canal inexistente conserva mismo mensaje. **Errores:** token vencido/reutilizado, límite excedido o sesión riesgosa.
- **Reglas:** no exponer existencia; revocación y correlación; secretos nunca en logs.
- **Datos leídos/modificados:** estado de cuenta; desafío, credencial/sesiones. **Clasificación:** `PERSONAL/RESTRICTED`.
- **Autorización/tenant:** control del canal y desafío; sin autoridad institucional adicional.
- **Auditoría/comunicaciones:** solicitud, éxito, rechazo y revocación; aviso de seguridad.
- **Postcondición/aceptación:** acceso restaurado o respuesta segura; token no puede reutilizarse.
- **Pendientes:** MFA Q-204 diferida; remitente/proveedor Q-181/Q-404.

### UC-FAM-003 — Administrar grupo familiar

- **Objetivo/actor:** mantener adultos, relaciones y facultades; apoderado autorizado. Secundarios: otros adultos.
- **FR/preguntas:** FR-ID-003/005/006; FR-FRM-005/006; Q-104 a Q-106.
- **Precondiciones/disparador:** cuenta verificada; actor abre grupo o invita/corrige un miembro.
- **Flujo principal:** 1) consulta grupo autorizado; 2) agrega/actualiza relación; 3) declara rol titular/financiero; 4) registra evidencia requerida; 5) confirma cambio.
- **Alternativos:** una persona ocupa varios roles; invitación futura. **Errores:** conflicto de autoridad, duplicado, revocación o dato sensible injustificado.
- **Reglas:** relación declarada no concede por sí sola facultad; instantáneas enviadas no cambian; un único adulto responsable usa la cuenta; no se crean cuentas colaborativas en el MVP.
- **Datos leídos/modificados:** perfiles/relaciones globales; facultades y contacto. **Clasificación:** `PERSONAL/RESTRICTED`, finanzas `HIGHLY_RESTRICTED`.
- **Autorización/tenant:** relación familiar vigente; instituciones no consultan perfil global directamente.
- **Auditoría/comunicaciones:** alta, cambio, invitación/revocación; aviso a afectados cuando se apruebe.
- **Postcondición/aceptación:** grupo conserva autoría e historia; ningún miembro obtiene acceso implícito a casos ajenos.
- **Pendientes:** Q-105/Q-106 y reglas de conflicto.

### UC-FAM-004 — Registrar hijo

- **Objetivo/actor:** crear perfil de estudiante administrable; apoderado. Secundario: estudiante.
- **FR/preguntas:** FR-ID-004/005; Q-104/Q-106.
- **Precondiciones/disparador:** cuenta verificada; familia inicia registro.
- **Flujo principal:** 1) aporta identificación mínima; 2) declara relación/facultad; 3) revisa propósito; 4) confirma; 5) el sistema crea perfil global familiar.
- **Alternativos:** estudiante ya registrado requiere resolución segura. **Errores:** duplicado probable, falta de facultad o dato inválido.
- **Reglas:** correo confirmado, formato RUT, relación declarada y certificado de nacimiento; no emparejar automáticamente por nombre/correo/RUT; escalar dudas antes de acciones críticas; sin registros externos en E1.
- **Datos leídos/modificados:** catálogos mínimos; perfil/relación. **Clasificación:** menor `RESTRICTED`.
- **Autorización/tenant:** relación autorizada; no pertenece a tenant hasta snapshot de postulación.
- **Auditoría/comunicaciones:** creación, corrección y conflicto; confirmación sin datos excesivos.
- **Postcondición/aceptación:** estudiante seleccionable sólo por familia autorizada.
- **Pendientes:** verificación y tratamiento de duplicados Q-106.

## Postulación y acciones familiares

### UC-APP-001 — Iniciar borrador

- **Objetivo/actor:** comenzar postulación a oferta concreta; apoderado. Secundarios: estudiante y oferta.
- **FR/preguntas:** FR-APP-001 a 005; Q-101 a Q-103.
- **Precondiciones/disparador:** cuenta/relación vigentes, oferta publicada; familia elige “postular”.
- **Flujo principal:** 1) autoriza estudiante; 2) valida oferta/ventana; 3) aplica política de duplicados; 4) fija versiones; 5) crea borrador.
- **Alternativos:** reutilizar borrador existente; varias instituciones según Q-101. **Errores:** oferta cerrada, duplicado no permitido o tenant incoherente.
- **Reglas:** oferta identificada por tenant/sede/año/curso; una activa por estudiante/institución/año/curso; instituciones distintas pueden tener postulaciones independientes; crear no garantiza cupo.
- **Datos leídos/modificados:** oferta/configuración y perfiles; borrador/versiones. **Clasificación:** `RESTRICTED`.
- **Autorización/tenant:** relación con estudiante y oferta pública; borrador anclado a un solo tenant.
- **Auditoría/comunicaciones:** `ApplicationDraftCreated`; confirmación de inicio opcional.
- **Postcondición/aceptación:** un borrador inequívoco y reanudable sin mezclar tenants.
- **Pendientes:** simultaneidad/duplicado/disponibilidad Q-101 a Q-103.

### UC-APP-002 — Continuar borrador

- **Objetivo/actor:** recuperar y editar progreso; apoderado autorizado.
- **FR/preguntas:** FR-APP-005/006; FR-FRM-001/007; Q-105/Q-184.
- **Precondiciones/disparador:** borrador vigente; actor vuelve al caso.
- **Flujo principal:** 1) autoriza caso; 2) carga versión/progreso; 3) edita; 4) valida paso; 5) guarda con control de conflicto.
- **Alternativos:** otro dispositivo o adulto autorizado. **Errores:** sesión/ventana vencida, conflicto de versión, formulario incompatible.
- **Reglas:** no sobrescribir silenciosamente; versión publicada asociada no muta.
- **Datos leídos/modificados:** borrador/respuestas; respuestas parciales y marca de versión. **Clasificación:** según campo hasta `HIGHLY_RESTRICTED`.
- **Autorización/tenant:** relación y facultad de edición; tenant derivado del borrador.
- **Auditoría/comunicaciones:** guardados relevantes/conflictos; aviso de recuperación/vencimiento según política.
- **Postcondición/aceptación:** cambios persistidos o conflicto explicado sin pérdida.
- **Pendientes:** autoguardado, expiración y concurrencia Q-105/Q-184.

### UC-APP-003 — Enviar postulación

- **Objetivo/actor:** crear hito inmutable; adulto con facultad de envío.
- **FR/preguntas:** FR-APP-007/008; FR-FRM-007/011; Q-104/Q-105/Q-120.
- **Precondiciones/disparador:** borrador, oferta abierta y configuración válida; actor confirma envío.
- **Flujo principal:** 1) reautoriza; 2) valida campos, requisitos y consentimientos; 3) verifica versión/ventana/duplicado; 4) muestra resumen; 5) confirma; 6) congela snapshot; 7) emite acuse.
- **Alternativos:** requisito condicional/exento. **Errores:** archivo no seguro, dato faltante, carrera de cierre o doble envío.
- **Reglas:** idempotencia conceptual; instantánea no cambia al editar perfil; ingreso familiar no pertenece al formulario de admisión MVP; envío no garantiza vacante.
- **Datos leídos/modificados:** borrador, configuración y documentos; postulación enviada/snapshot/evento. **Clasificación:** hasta `HIGHLY_RESTRICTED`.
- **Autorización/tenant:** facultad Q-105; todas las referencias del mismo tenant.
- **Auditoría/comunicaciones:** `ApplicationSubmitted`, actor/versión/instante; acuse por correo.
- **Postcondición/aceptación:** una sola presentación confirmada y reconstruible; reintento no duplica.
- **Pendientes:** facultad y obligatoriedad por campo/documento.

### UC-APP-004 — Responder observaciones

- **Objetivo/actor:** satisfacer una acción comunicada; apoderado. Secundarios: revisor/Admisión.
- **FR/preguntas:** FR-DOC-004/005; FR-FRM-007; Q-122 a Q-124.
- **Precondiciones/disparador:** acción vigente con plazo; familia abre solicitud.
- **Flujo principal:** 1) consulta motivo comunicable; 2) corrige respuesta o sube versión; 3) valida archivo/dato; 4) confirma respuesta; 5) vuelve a revisión.
- **Alternativos:** varios requisitos o exención aprobada. **Errores:** plazo/límite vencido, archivo rechazado, acción revocada.
- **Reglas:** conservar anterior; respuesta no edita nota interna; archivo no revisable hasta seguro.
- **Datos leídos/modificados:** acción/requisito; respuesta/versión/estado. **Clasificación:** `RESTRICTED/HIGHLY_RESTRICTED`.
- **Autorización/tenant:** actor familiar del caso; requisito y postulación del mismo tenant.
- **Auditoría/comunicaciones:** `ApplicantResponseSubmitted`, nueva versión; acuse/recordatorio.
- **Postcondición/aceptación:** acción contestada una vez por versión y revisión reactivada.
- **Pendientes:** número/plazo/eliminación/manejo de archivos Q-122 a Q-124.

### UC-APP-005 — Consultar estado

- **Objetivo/actor:** ver estado comprensible y próximos pasos; apoderado autorizado.
- **FR/preguntas:** FR-COM-001; FR-AUD-003; Q-165/Q-182/Q-184.
- **Precondiciones/disparador:** postulación accesible; familia consulta.
- **Flujo principal:** 1) autoriza; 2) deriva proyección segura; 3) muestra acciones/plazos; 4) muestra historial aprobado; 5) ofrece acciones válidas.
- **Alternativos:** espera, corrección, cita, oferta o integración. **Errores:** acceso revocado, estado no mapeado o sesión vencida.
- **Reglas:** proyección coherente sin responsables/notas/puntajes; error técnico no es estado de negocio.
- **Datos leídos/modificados:** hitos/acciones; sólo registro de acceso si sensibilidad lo exige. **Clasificación:** `RESTRICTED`.
- **Autorización/tenant:** relación con caso; tenant derivado del recurso.
- **Auditoría/comunicaciones:** acceso sensible cuando aplique; ninguna comunicación automática por consulta.
- **Postcondición/aceptación:** estado y siguiente acción correctos sin información interna/terceros.
- **Pendientes:** textos, historial, espera y SLA.

### UC-ACT-001 — Confirmar cita

- **Objetivo/actor:** registrar recepción/compromiso si la política lo exige; apoderado.
- **FR/preguntas:** FR-ACT-002/003/007; Q-142/Q-143.
- **Precondiciones/disparador:** cita vigente y confirmable; familia confirma.
- **Flujo principal:** 1) autoriza caso/cita; 2) muestra datos mínimos; 3) confirma; 4) registra actor/instante; 5) actualiza próximo paso.
- **Alternativos:** confirmación no requerida. **Errores:** cita cambiada, vencida o ya confirmada.
- **Reglas:** doble confirmación idempotente; no confirma asistencia ni conclusión.
- **Datos leídos/modificados:** cita; estado de confirmación. **Clasificación:** `PERSONAL/RESTRICTED`.
- **Autorización/tenant:** relación familiar y cita del caso/tenant.
- **Auditoría/comunicaciones:** confirmación; acuse mínimo.
- **Postcondición/aceptación:** confirmación única vinculada a la versión de cita.
- **Pendientes:** si el piloto exige confirmar y hasta cuándo.

### UC-ACT-002 — Solicitar reprogramación

- **Objetivo/actor:** pedir cambio sin editar agenda; apoderado.
- **FR/preguntas:** FR-ACT-002/003; Q-142/Q-143/Q-184.
- **Precondiciones/disparador:** cita vigente y política habilita solicitud.
- **Flujo principal:** 1) autoriza; 2) explica política; 3) registra motivo mínimo/preferencias permitidas; 4) confirma; 5) crea tarea para Admisión.
- **Alternativos:** contacto asistido aprobado. **Errores:** límite/plazo excedido, cita cancelada o solicitud duplicada.
- **Reglas:** solicitud no cambia horario; minimizar motivo; no exponer agenda completa.
- **Datos leídos/modificados:** cita/política; solicitud/tarea. **Clasificación:** `RESTRICTED`.
- **Autorización/tenant:** relación familiar; tarea en tenant del caso.
- **Auditoría/comunicaciones:** solicitud y resolución; acuse/resultado.
- **Postcondición/aceptación:** solicitud trazable pendiente/aprobada/rechazada, cita anterior vigente hasta cambio.
- **Pendientes:** límites, tolerancia y autoridad Q-142.

### UC-APP-006 — Desistir

- **Objetivo/actor:** cerrar voluntariamente un caso; adulto facultado.
- **FR/preguntas:** FR-APP-009; FR-CAP-002; Q-105/Q-163/Q-167.
- **Precondiciones/disparador:** estado permite desistimiento; actor lo solicita.
- **Flujo principal:** 1) autoriza facultad; 2) explica efectos; 3) solicita confirmación; 4) registra desistimiento; 5) libera reserva/tareas según regla; 6) comunica cierre.
- **Alternativos:** personal registra con evidencia excepcional. **Errores:** aceptación/handoff concurrente, estado terminal o facultad disputada.
- **Reglas:** irreversible por flujo normal; reapertura sólo excepcional; no elimina datos.
- **Datos leídos/modificados:** caso/reserva; estado, motivo, evento y liberación. **Clasificación:** `RESTRICTED`.
- **Autorización/tenant:** facultad Q-105; tenant del caso.
- **Auditoría/comunicaciones:** `ApplicationWithdrawn`, actor/efectos; confirmación.
- **Postcondición/aceptación:** cierre y liberación coherentes una sola vez.
- **Pendientes:** quién puede desistir/reabrir y efecto durante integración.

### UC-APP-007 — Responder oferta

- **Objetivo/actor:** aceptar o rechazar una oferta si la acción se aprueba; adulto facultado.
- **FR/preguntas:** FR-COM-006; FR-CAP-002/003; Q-105/Q-163/Q-166/Q-310.
- **Precondiciones/disparador:** oferta vigente y regla exige respuesta; familia elige.
- **Flujo principal:** 1) autoriza; 2) muestra condiciones/plazo; 3) confirma aceptación/rechazo; 4) registra respuesta idempotente; 5) mantiene/libera reserva; 6) habilita siguiente paso según Q-310.
- **Alternativos:** no existe acción separada si se decide otra regla. **Errores:** oferta vencida, respuesta concurrente, múltiples ofertas o cupo inconsistente.
- **Reglas:** respuesta, decisión, pago y matrícula son hitos distintos; efectos explícitos.
- **Datos leídos/modificados:** oferta/condiciones; respuesta/reserva/evento. **Clasificación:** `RESTRICTED`.
- **Autorización/tenant:** facultad de aceptación Q-105; oferta y caso del mismo tenant.
- **Auditoría/comunicaciones:** `AdmissionOfferAccepted/Declined`; acuse y próximo paso.
- **Postcondición/aceptación:** respuesta única sobre oferta vigente, sin sobreasignar.
- **Pendientes:** uso en piloto, ofertas múltiples y Q-310.

## Configuración y operación institucional

### UC-ADM-001 — Crear oferta académica

- **Objetivo/actor:** preparar una convocatoria por sede/año/curso; administrador institucional. Secundarios: Admisión/cupos.
- **FR/preguntas:** FR-APP-001/002; FR-ADM-003; Q-101/Q-103/Q-162.
- **Precondiciones/disparador:** tenant, sede y año autorizados; preparación de convocatoria.
- **Flujo principal:** 1) selecciona contexto; 2) define curso/ventana; 3) asocia formulario/requisitos/flujo en borrador; 4) valida consistencia; 5) guarda oferta no publicada.
- **Alternativos:** clonar configuración sin respuestas/datos. **Errores:** referencias entre tenants, fechas incoherentes o configuración no publicada.
- **Reglas:** una sede en piloto, pero núcleo configurable; disponibilidad no se infiere.
- **Datos leídos/modificados:** configuración del tenant; oferta `INTERNAL`.
- **Autorización/tenant:** membresía `offering.manage` conceptual y scope; referencias del mismo tenant.
- **Auditoría/comunicaciones:** creación/cambios; ninguna comunicación familiar hasta publicación.
- **Postcondición/aceptación:** oferta borrador inequívoca por tenant/sede/año/curso.
- **Pendientes:** definición de duplicados y señal de disponibilidad.

### UC-CAP-001 — Definir cupos

- **Objetivo/actor:** registrar capacidad funcional y ajustes; responsable de cupos. Secundarios: administrador/Dirección.
- **FR/preguntas:** FR-CAP-001/002/003; Q-162/Q-163.
- **Precondiciones/disparador:** oferta existente; autoridad configura capacidad.
- **Flujo principal:** 1) abre oferta; 2) selecciona concepto de capacidad aprobado; 3) ingresa valor/vigencia/razón; 4) revisa impacto; 5) confirma.
- **Alternativos:** ajuste posterior con doble control. **Errores:** reducir bajo reservas/ofertas, valor inválido o concurrencia.
- **Reglas:** distinguir capacidad, cupo, reserva, oferta y matrícula; nunca negativos ni sobreoferta.
- **Datos leídos/modificados:** oferta/reservas; plan/ajuste de capacidad `INTERNAL`, referencias `RESTRICTED`.
- **Autorización/tenant:** permiso y scope de oferta; tenant derivado.
- **Auditoría/comunicaciones:** valor anterior/nuevo, razón/autor; alertar responsables, no familias salvo efecto aprobado.
- **Postcondición/aceptación:** capacidad vigente reconstruible y consistente con compromisos.
- **Pendientes:** concepto exacto, doble control y duración de reserva.

### UC-FRM-001 — Crear formulario

- **Objetivo/actor:** crear versión borrador mediante constructor controlado; administrador institucional. Secundarios: Admisión/revisores.
- **FR/preguntas:** FR-FRM-001/002/008 a 012; FR-ADM-004/008; Q-104/Q-108.
- **Precondiciones/disparador:** plantilla institucional y permiso de edición; nuevo proceso/cambio.
- **Flujo principal:** 1) crea versión `DRAFT`; 2) agrega secciones/campos controlados; 3) define propósito, obligatoriedad, validación, sensibilidad y audiencia; 4) configura condiciones permitidas; 5) valida.
- **Alternativos:** duplicar versión publicada como nuevo borrador. **Errores:** código/HTML activo, regla circular, campo sensible sin propósito o etiqueta ambigua.
- **Reglas:** catálogo cerrado; cada campo clasificado; publicada será inmutable.
- **Datos leídos/modificados:** catálogos/configuración; versión/secciones/campos `INTERNAL`.
- **Autorización/tenant:** `form.draft.manage` conceptual; todo componente del tenant.
- **Auditoría/comunicaciones:** cambios relevantes/versiones; revisión interna, sin familias.
- **Postcondición/aceptación:** borrador validable que no ejecuta contenido arbitrario.
- **Pendientes:** campos/obligatoriedad Q-104 y accesibilidad Q-108.

### UC-FRM-002 — Publicar formulario

- **Objetivo/actor:** hacer inmutable y disponible una versión aprobada; publicador institucional. Secundarios: administrador/Admisión/Dirección consultiva.
- **FR/preguntas:** FR-FRM-011/012; NFR-SEC-014; Q-104/Q-120.
- **Precondiciones/disparador:** versión `DRAFT` validada y permiso separado; solicitud de publicación.
- **Flujo principal:** 1) revisa diferencias; 2) verifica decisiones/campos/requisitos; 3) valida reglas/sensibilidad; 4) confirma; 5) marca `PUBLISHED`; 6) registra versión/vigencia.
- **Alternativos:** devolver a edición o archivar versión anterior para nuevas ofertas. **Errores:** aprobación faltante, dato sensible injustificado o dependencia inválida.
- **Reglas:** publicación inmutable; no modifica postulaciones previas; edición no concede publicación.
- **Datos leídos/modificados:** borrador/configuración; estado/metadata `INTERNAL`.
- **Autorización/tenant:** `form.version.publish` conceptual, tenant/scope y posible doble control.
- **Auditoría/comunicaciones:** publicador, instante, hash/diferencias conceptuales; aviso interno.
- **Postcondición/aceptación:** versión publicada recuperable y asociable, sin cambiar otra versión.
- **Pendientes:** autoridad definitiva y aprobaciones de C-013/C-011.

### UC-DOC-001 — Configurar requisitos documentales

- **Objetivo/actor:** definir requisitos por oferta, curso, periodo y condición; administrador/Admisión. Secundario: revisor.
- **FR/preguntas:** FR-DOC-001/007/008; Q-120/Q-123.
- **Precondiciones/disparador:** oferta/configuración en preparación; catálogo base disponible.
- **Flujo principal:** 1) crea versión de requisito; 2) define propósito, aplicabilidad, periodo/vigencia y obligatoriedad; 3) define formatos/límites conceptuales; 4) configura personalidad por institución/año/proceso/curso/oferta/condición; 5) define informe vigente/disponible, equivalencias y exención autorizada; 6) asigna revisor/exención; 7) valida/publica con proceso.
- **Alternativos:** equivalente documental emitido por establecimiento anterior o condición “cuando corresponda”. **Errores:** requisito sin propósito, conflicto C-011, alcance entre tenants.
- **Reglas:** no hardcode; documento completo no garantiza vacante; ficha se satisface por snapshot.
- **Datos leídos/modificados:** catálogo; requisito/versiones `INTERNAL`.
- **Autorización/tenant:** permiso de configuración/publicación; tenant/oferta coincidentes.
- **Auditoría/comunicaciones:** versión/publicación; familias ven sólo requisito aplicable.
- **Postcondición/aceptación:** catálogo puede representar curso, periodo y condición sin ambigüedad.
- **Pendientes:** catálogo concreto del piloto Q-120/C-011 y tratamiento de archivos Q-123.

### UC-DOC-002 — Revisar documento

- **Objetivo/actor:** dictaminar una versión segura; revisor documental. Secundarios: Admisión/familia.
- **FR/preguntas:** FR-DOC-003 a 006; Q-121 a Q-124.
- **Precondiciones/disparador:** archivo `READY_FOR_REVIEW`, tarea/asignación vigente.
- **Flujo principal:** 1) autoriza requisito/archivo; 2) registra acceso; 3) comprueba correspondencia/vigencia/legibilidad; 4) acepta, observa o rechaza; 5) registra motivo; 6) crea acción familiar si aplica.
- **Alternativos:** solicitar exención separada. **Errores:** cuarentena, enlace vencido, archivo cifrado, tenant/versión incorrectos.
- **Reglas:** decisión por requisito/versión; no borrar; vínculo temporal tras autorización.
- **Datos leídos/modificados:** documento `RESTRICTED/HIGHLY_RESTRICTED`; dictamen/estado.
- **Autorización/tenant:** rol, asignación, propósito y clasificación; tenant del caso.
- **Auditoría/comunicaciones:** lectura/descarga/dictamen; sólo observación accionable a familia.
- **Postcondición/aceptación:** autor/motivo/instante/versión reconstruibles y nota interna oculta.
- **Pendientes:** autoridad, correcciones y formatos Q-121 a Q-124.

### UC-DOC-003 — Eximir requisito

- **Objetivo/actor:** registrar que un requisito no se exige en un caso; autoridad de exención por definir. Secundarios: revisor/Admisión.
- **FR/preguntas:** FR-DOC-004/008; Q-121/Q-120.
- **Precondiciones/disparador:** requisito aplicable con causa excepcional; solicitud fundada.
- **Flujo principal:** 1) revisa requisito/caso; 2) verifica autoridad; 3) selecciona motivo/evidencia mínima; 4) registra actor, fecha y alcance; 5) confirma; 6) marca `EXEMPTED`; 7) conserva historia.
- **Alternativos:** exención preconfigurada por regla. **Errores:** autoexención no permitida, requisito ya resuelto o fundamento insuficiente.
- **Reglas:** exención no finge documento; no borra obligación histórica; puede requerir doble control.
- **Datos leídos/modificados:** requisito/caso; estado/motivo `RESTRICTED`.
- **Autorización/tenant:** permiso reforzado, scope/tenant y separación del revisor si se decide.
- **Auditoría/comunicaciones:** solicitud/aprobación/rechazo; informar a familia sólo si necesita saber.
- **Postcondición/aceptación:** requisito resuelto como exento con autoridad y causa verificables.
- **Pendientes:** autoridad concreta, suplencia y alcance operativo Q-121.

### UC-ACT-003 — Agendar entrevista y evaluación

- **Objetivo/actor:** crear citas institucionales; Admisión. Secundarios: entrevistador/evaluador/familia.
- **FR/preguntas:** FR-ACT-001/002/007; Q-140 a Q-143.
- **Precondiciones/disparador:** actividad aplicable según configuración versionada por tenant/proceso/oferta/curso/tipo y caso listo; colegio asigna horario.
- **Flujo principal:** 1) verifica aplicabilidad; 2) elige actividad, responsable, horario, zona/modalidad; 3) valida conflictos; 4) confirma; 5) publica cita; 6) comunica.
- **Alternativos:** reprogramar conservando anterior; repetir como nuevo intento; exención o cierre excepcional aprobados. **Errores:** sin agenda, conflicto, responsable sin scope o actividad no completable.
- **Reglas:** entrevista/evaluación separadas; conclusión distinta de asistencia; obligatoriedad configurable; excepción requiere actor, motivo y auditoría; exención/cierre no equivale a completada.
- **Datos leídos/modificados:** agenda/caso mínimo; cita/responsable `RESTRICTED`.
- **Autorización/tenant:** `interview/assessment.schedule`, scope y tenant.
- **Auditoría/comunicaciones:** creación/cambio/cancelación; correo con datos mínimos.
- **Postcondición/aceptación:** cita vigente, historia y ausencia de exposición de terceros.
- **Pendientes:** modalidad, responsables, reprogramación, tolerancia y catálogo concreto de cierre.

### UC-ACT-004 — Registrar asistencia

- **Objetivo/actor:** registrar presencia/inasistencia por actividad; entrevistador/evaluador asignado.
- **FR/preguntas:** FR-ACT-004; Q-142.
- **Precondiciones/disparador:** cita vigente; llega hora de actividad.
- **Flujo principal:** 1) autoriza actividad; 2) selecciona asistencia, inasistencia o cancelación/no completada; 3) registra instante/motivo mínimo; 4) confirma; 5) genera reprogramación o tarea según política.
- **Alternativos:** corrección controlada. **Errores:** actividad equivocada, registro duplicado o actor no asignado.
- **Reglas:** asistencia no equivale a conclusión; corrección agrega historia; actividad no completada se distingue de exenta o cerrada; cada intento conserva secuencia, fecha, responsable, estado, motivo, resultado/conclusión y relación con el intento anterior.
- **Datos leídos/modificados:** cita; asistencia/razón `RESTRICTED`.
- **Autorización/tenant:** asignación específica y tenant.
- **Auditoría/comunicaciones:** registro/corrección; aviso operativo según regla.
- **Postcondición/aceptación:** estado de asistencia inequívoco y separado del resultado.
- **Pendientes:** tolerancia, reprogramación, repetición, exención/cierre y quién corrige.

### UC-ACT-005 — Registrar conclusión

- **Objetivo/actor:** cerrar funcionalmente entrevista/evaluación; actor asignado. Secundarios: Admisión/Dirección con acceso permitido.
- **FR/preguntas:** FR-ACT-004/005; Q-144/Q-145.
- **Precondiciones/disparador:** actividad realizada; pauta aprobada y actor autorizado.
- **Flujo principal:** 1) abre pauta mínima; 2) vincula el intento y responsable; 3) registra observaciones/conclusión; 4) clasifica contenido; 5) confirma; 6) cierra versión; 7) habilita consolidación.
- **Alternativos:** borrador antes de enviar; corrección como nueva versión. **Errores:** pauta ausente, actor no asignado, dato excesivo o actividad no realizada.
- **Reglas:** mínimo necesario; no comunicar a familia por defecto; edición posterior controlada.
- **Datos leídos/modificados:** pauta/caso mínimo; conclusión `HIGHLY_RESTRICTED`.
- **Autorización/tenant:** rol, asignación, propósito, sensibilidad y tenant.
- **Auditoría/comunicaciones:** creación/acceso/corrección; aviso interno de completitud sin contenido.
- **Postcondición/aceptación:** conclusión versionada y visible sólo a roles autorizados.
- **Pendientes:** pauta, audiencia, retención y autoridad de corrección; el acceso a PIE/NEE/salud requiere propósito y rol expresamente autorizado.

### UC-ACT-006 — Gestionar excepción, repetición o cierre de actividad

- **Objetivo/actor:** registrar una excepción o nuevo intento sin reemplazar la historia; actor institucional autorizado. Secundarios: Admisión, entrevistador/evaluador, Dirección según matriz futura.
- **FR/preguntas:** FR-ACT-001/004/005; Q-140/Q-142/Q-144/Q-145; C-009.
- **Precondiciones/disparador:** actividad existente; motivo operativo; actor con autorización vigente.
- **Flujo principal:** 1) selecciona actividad e intento relacionado; 2) elige reprogramar, repetir, eximir o cerrar según la regla aplicable; 3) registra motivo, actor, fecha, alcance y resultado; 4) crea nuevo intento o estado de excepción sin borrar el anterior; 5) genera tarea/comunicación mínima; 6) audita.
- **Alternativos:** no completada → reprogramar; repetición vinculada al intento anterior; cierre del proceso/caso sólo cuando corresponda.
- **Errores:** actor no autorizado, motivo ausente, intento inexistente, cierre incompatible o tenant distinto.
- **Reglas:** exenta, cerrada, no completada y completada son estados distinguibles; ningún intento anterior se reemplaza silenciosamente.
- **Datos leídos/modificados:** actividad, intentos, motivo y estado `RESTRICTED/HIGHLY_RESTRICTED` según contenido.
- **Autorización/tenant:** `activity.exception`, `activity.reschedule`, `activity.repeat` o `activity.close`, tenant, alcance, propósito y auditoría.
- **Postcondición/aceptación:** historial completo y reconstruible; estado actual explícito; cantidades, tolerancias y autoridad concreta siguen pendientes.

### UC-DEC-001 — Emitir recomendación

- **Objetivo/actor:** someter recomendación no final; encargado de admisión. Secundarios: revisores/actividades/cupos.
- **FR/preguntas:** FR-DEC-003 a 005; Q-160/Q-161/Q-162.
- **Precondiciones/disparador:** antecedentes suficientes; recomendador autorizado inicia consolidación.
- **Flujo principal:** 1) valida completitud/exenciones; 2) consulta resumen permitido; 3) aplica pauta aprobada; 4) registra fundamento; 5) revisa; 6) envía a Dirección.
- **Alternativos:** devuelve tareas o reemplaza versión devuelta. **Errores:** conflicto, dato pendiente o acceso sensible indebido.
- **Reglas:** no decide, comunica ni reserva por sí sola; versiones inmutables tras envío.
- **Datos leídos/modificados:** antecedentes/conclusiones; recomendación `HIGHLY_RESTRICTED`.
- **Autorización/tenant:** `decision.recommend`, scope y separación D-016.
- **Auditoría/comunicaciones:** borrador/envío/reemplazo; notificación interna a Dirección.
- **Postcondición/aceptación:** recomendación enviada reconstruible, familia sin cambio de resultado.
- **Pendientes:** criterios/fundamentos Q-160.

### UC-DEC-002 — Devolver recomendación

- **Objetivo/actor:** solicitar revisión sin decidir; Dirección. Secundario: Admisión.
- **FR/preguntas:** FR-DEC-005/006; Q-160/Q-161.
- **Precondiciones/disparador:** recomendación enviada; Dirección identifica insuficiencia.
- **Flujo principal:** 1) revisa; 2) elige devolver; 3) registra justificación accionable interna; 4) confirma; 5) cierra versión; 6) crea tarea a Admisión.
- **Alternativos:** pedir aclaración incluida en devolución. **Errores:** decisión ya final, versión obsoleta o justificación vacía.
- **Reglas:** no notifica resultado; no edita recomendación; conserva historia.
- **Datos leídos/modificados:** recomendación; estado/devolución `HIGHLY_RESTRICTED`.
- **Autorización/tenant:** `decision.return`, aprobador válido y tenant.
- **Auditoría/comunicaciones:** devolución/autor/razón; aviso interno.
- **Postcondición/aceptación:** revisión reabierta con versión anterior intacta.
- **Pendientes:** pauta y plazos internos.

### UC-DEC-003 — Tomar decisión

- **Objetivo/actor:** aprobar o rechazar de forma final; Dirección. Secundarios: Admisión/cupos.
- **FR/preguntas:** FR-DEC-004/006/007; Q-160 a Q-167.
- **Precondiciones/disparador:** recomendación vigente; Dirección decide.
- **Flujo principal:** 1) autoriza; 2) revisa evidencia permitida; 3) verifica conflicto/capacidad aplicable; 4) elige aprobar/rechazar; 5) registra fundamento; 6) confirma; 7) habilita acción posterior.
- **Alternativos:** devolver mediante UC-DEC-002; favorable a espera según política. **Errores:** recomendador=aprobador no permitido, concurrencia de cupo o recomendación obsoleta.
- **Reglas:** decisión separada de recomendación/comunicación; no borra evidencia; reapertura excepcional.
- **Datos leídos/modificados:** resumen/recomendación/capacidad; decisión `HIGHLY_RESTRICTED`.
- **Autorización/tenant:** `decision.approve/reject`, autoridad/scope/tenant y D-016.
- **Auditoría/comunicaciones:** decisión y acceso; aviso interno, sin correo familiar automático.
- **Postcondición/aceptación:** una decisión final autorizada y reproducible.
- **Pendientes:** criterios, doble control, capacidad y reapertura.

### UC-COM-001 — Comunicar resultado

- **Objetivo/actor:** enviar resultado autorizado; comunicaciones/Admisión según RACI. Secundarios: Dirección, correo, familia.
- **FR/preguntas:** FR-COM-002/003/005/007; Q-180 a Q-182.
- **Precondiciones/disparador:** decisión final y resultado/cupo coherentes; responsable inicia comunicación.
- **Flujo principal:** 1) verifica decisión; 2) selecciona plantilla/version/audiencia; 3) valida variables; 4) aprueba; 5) envía; 6) registra intento/estado; 7) proyecta resultado.
- **Alternativos:** reintento/reenvío controlado. **Errores:** plantilla no aprobada, dirección inválida, fallo o decisión revocada excepcionalmente.
- **Reglas:** correo único canal inicial; enviado ≠ entregado; mínimo de datos.
- **Datos leídos/modificados:** contacto/decisión mínima; comunicación/intentos `PERSONAL/RESTRICTED`.
- **Autorización/tenant:** permisos de componer/aprobar/enviar, propósito y tenant.
- **Auditoría/comunicaciones:** intención, aprobación, envío, entrega/fallo; el mensaje es evidencia.
- **Postcondición/aceptación:** familia ve resultado correcto sólo tras autorización; fallos quedan accionables.
- **Pendientes:** plantilla, remitente, horarios, escalamiento e historial.

### UC-CAP-002 — Gestionar lista de espera

- **Objetivo/actor:** mantener ingreso, orden y cierre; responsable de cupos. Secundarios: Admisión/Dirección.
- **FR/preguntas:** FR-CAP-004/005; Q-164/Q-165.
- **Precondiciones/disparador:** política versionada; caso elegible sin oferta o revisión operativa.
- **Flujo principal:** 1) registra entrada; 2) aplica criterio aprobado; 3) resuelve empate; 4) mantiene orden/evidencia; 5) consulta capacidad; 6) cierra cuando regla indique.
- **Alternativos:** ajuste justificado o desistimiento. **Errores:** criterio ausente, alteración manual sin causa o datos cruzados.
- **Reglas:** espera no garantiza vacante; posición visible sólo si se aprueba; cambios auditados.
- **Datos leídos/modificados:** política/capacidad; entrada/orden `RESTRICTED`.
- **Autorización/tenant:** `waitlist.manage`, oferta/scope/tenant.
- **Auditoría/comunicaciones:** ingreso, orden/cambio/cierre; mensaje aprobado a afectado.
- **Postcondición/aceptación:** lista reproducible sin revelar terceros.
- **Pendientes:** prioridades, desempate, posición y cierre.

### UC-CAP-003 — Promover postulante

- **Objetivo/actor:** convertir espera en oferta con control humano; responsable de cupos. Secundarios: Admisión/Dirección/familia.
- **FR/preguntas:** FR-CAP-002 a 005; D-008; Q-163 a Q-166.
- **Precondiciones/disparador:** cupo/reserva disponible y siguiente candidato según política; operador confirma.
- **Flujo principal:** 1) valida capacidad/orden; 2) selecciona candidato; 3) muestra fundamento; 4) obtiene confirmación humana; 5) reserva; 6) emite oferta; 7) comunica.
- **Alternativos:** saltar sólo por causa aprobada y auditable. **Errores:** carrera, candidato no elegible, oferta simultánea o política vencida.
- **Reglas:** promoción no automática en piloto; reserva consistente; no alterar decisión.
- **Datos leídos/modificados:** lista/capacidad/caso; reserva/oferta/entrada `RESTRICTED`.
- **Autorización/tenant:** permiso reforzado, scope y tenant; posible doble control.
- **Auditoría/comunicaciones:** selección, confirmación, reserva/oferta; mensaje al promovido.
- **Postcondición/aceptación:** un cupo no se asigna dos veces y orden/excepción quedan explicables.
- **Pendientes:** duración, múltiples ofertas y autoridad.

### UC-CAP-004 — Emitir oferta de vacante

- **Objetivo/actor:** convertir una decisión favorable y reserva válida en una oferta comunicable; responsable de cupos/Admisión según RACI. Secundarios: Dirección, comunicaciones y familia.
- **FR/preguntas:** FR-CAP-002/003; FR-COM-005/006; Q-163/Q-166/Q-310.
- **Precondiciones/disparador:** decisión favorable final, capacidad disponible, política/vigencia aprobadas; responsable emite oferta.
- **Flujo principal:** 1) autoriza decisión/caso; 2) verifica o crea reserva consistente; 3) fija condiciones y vencimiento aprobados; 4) confirma oferta; 5) habilita comunicación; 6) espera respuesta o regla de expiración.
- **Alternativos:** oferta nacida de promoción de espera. **Errores:** cupo concurrente, decisión no final, oferta previa vigente o condiciones sin aprobar.
- **Reglas:** oferta no equivale a aceptación, pago ni matrícula; reserva se crea junto a la comunicación favorable; una unidad de capacidad no sostiene ofertas incompatibles según política.
- **Datos leídos/modificados:** decisión/capacidad/reserva; oferta/condiciones/vigencia `RESTRICTED`.
- **Autorización/tenant:** `offer.issue` conceptual, scope de oferta/tenant y separación respecto de decisión.
- **Auditoría/comunicaciones:** emisión, reserva, vencimiento/cancelación; comunicación mediante UC-COM-001.
- **Postcondición/aceptación:** oferta única, vigente y correlacionada con reserva/decisión, sin sobreoferta.
- **Pendientes:** autoridad, duración, ofertas múltiples y efecto de Q-310.

### UC-ADM-002 — Crear postulación asistida

- **Objetivo/actor:** ayudar a registrar caso si C-014 se aprueba; operador asistido. Secundario: familia.
- **FR/preguntas:** FR-APP-003/008; FR-AUD-001/004; Q-107/C-014.
- **Precondiciones/disparador:** modalidad aprobada, operador/scope vigentes y autorización familiar verificable.
- **Flujo principal:** 1) explica modalidad; 2) registra tenant, operador, rol, origen asistido, fecha/hora, adulto presente, autorización/consentimiento y acciones; 3) identifica familia/estudiante sin suplantar; 4) crea borrador con el mismo formulario versionado; 5) transcribe; 6) digitaliza documentación física excepcional al requisito correspondiente con origen conceptual `PHYSICAL_DOCUMENT`; 7) el adulto responsable revisa y autoriza envío; 8) entrega acuse/control.
- **Alternativos:** sólo apoyo, sin enviar. **Errores:** falta de consentimiento/facultad, credenciales compartidas, conflicto o dato no aportado.
- **Reglas:** nunca inventar; autoría de cada acción; operador no revisa/decide su caso.
- **Datos leídos/modificados:** evidencia y datos aportados; borrador/eventos hasta `HIGHLY_RESTRICTED`.
- **Autorización/tenant:** rol temporal, caso/tenant y propósito; sin acceso masivo.
- **Auditoría/comunicaciones:** todas las acciones asistidas; confirmación a familia.
- **Postcondición/aceptación:** postulación distinguible como asistida y control familiar demostrable.
- **Pendientes:** personal, suplencias, reglas de presencia, evidencia detallada y conservación/devolución física.

### UC-ADM-003 — Exportar reporte autorizado

- **Objetivo/actor:** obtener información mínima para propósito aprobado; administrador/Admisión autorizado. Secundarios: Dirección/soporte excepcional.
- **FR/preguntas:** FR-ADM-006; NFR-PRV-008; Q-183.
- **Precondiciones/disparador:** reporte, audiencia y columnas aprobados; actor solicita exportación.
- **Flujo principal:** 1) elige reporte/scope; 2) sistema limita tenant/columnas/filas; 3) muestra clasificación/justificación; 4) confirma; 5) genera artefacto temporal; 6) autoriza descarga; 7) registra acceso/expiración.
- **Alternativos:** reporte agregado sin identificadores. **Errores:** columnas sensibles, volumen/alcance excesivo, enlace vencido o permiso revocado.
- **Reglas:** minimizar, expirar, auditar; no incluir salud/finanzas por defecto; no revelar conteos de otro tenant.
- **Datos leídos/modificados:** datos autorizados; solicitud/artefacto/descarga `RESTRICTED/HIGHLY_RESTRICTED` según contenido.
- **Autorización/tenant:** `export.create`, propósito, scope, sensibilidad y posible aprobación adicional.
- **Auditoría/comunicaciones:** solicitud, columnas, descarga/expiración; aviso interno si reforzado.
- **Postcondición/aceptación:** exportación limitada al propósito/tenant y no utilizable tras vencimiento.
- **Pendientes:** reportes, periodicidad, audiencia y retención Q-183/Q-202 diferida.

## Integración conceptual con EduPay

### UC-INT-001 — Crear handoff

- **Objetivo/actor:** registrar intención de derivación en el momento aprobado; Admisión. Secundarios: EduPay/familia/soporte.
- **FR/preguntas:** FR-INT-001/002/005/008; Q-310 y dependencias Q-301 a Q-306.
- **Precondiciones/disparador:** decisión favorable y condición A/B/C de Q-310 satisfecha; contrato futuro vigente.
- **Flujo principal:** 1) verifica hito de negocio; 2) resuelve tenant/referencias; 3) minimiza datos; 4) crea intención/correlación/idempotencia; 5) entrega al borde; 6) registra estado técnico.
- **Alternativos:** partes ya vinculadas. **Errores:** referencia faltante, identidad conflictiva, payload incompatible o handoff previo.
- **Reglas:** sin tablas compartidas; handoff sólo después de aceptación expresa; RUT/correo no son idempotencia; entrega no es matrícula.
- **Datos leídos/modificados:** decisión/oferta/identidad mínima; intención/sync `RESTRICTED`; excluye salud, NEE, documentos y notas.
- **Autorización/tenant:** permiso `integration` conceptual; mapeo autorizado del tenant y recurso.
- **Auditoría/comunicaciones:** creación/emisión/rechazo; familia ve sólo próximo paso, no payload.
- **Postcondición/aceptación:** una intención estable por efecto lógico y estado distinguible.
- **Pendientes:** Q-310 en G1; contrato Q-301 a Q-309 posterior.

### UC-INT-002 — Consultar estado del handoff

- **Objetivo/actor:** conocer progreso técnico sin cambiar negocio; Admisión/soporte autorizado. Secundarios: EduPay.
- **FR/preguntas:** FR-INT-003/004; Q-307/Q-309 diferidas.
- **Precondiciones/disparador:** handoff existente; operador consulta caso.
- **Flujo principal:** 1) autoriza; 2) carga intención/intentos/confirmaciones; 3) muestra estado técnico sanitizado; 4) separa resultado académico; 5) indica acción válida.
- **Alternativos:** vista agregada minimizada. **Errores:** referencia desconocida, retraso o respuesta contradictoria.
- **Reglas:** `DELIVERED`/`ACKNOWLEDGED` no equivalen a `COMPLETED`/`ENROLLED`.
- **Datos leídos/modificados:** correlación/estado; no cambia negocio salvo registrar consulta sensible. **Clasificación:** `INTERNAL/RESTRICTED`.
- **Autorización/tenant:** integración/read, scope y tenant del handoff.
- **Auditoría/comunicaciones:** accesos/reconciliaciones; familia sólo ve “Preparando matrícula” o acción aprobada.
- **Postcondición/aceptación:** estado actual explicado sin exponer payload ni afirmar matrícula.
- **Pendientes:** estados/SLA/evento final Q-304/Q-307/Q-309.

### UC-INT-003 — Reintentar de forma controlada

- **Objetivo/actor:** recuperar fallo transitorio sin duplicar efectos; soporte/Admisión autorizado. Secundario: EduPay.
- **FR/preguntas:** FR-INT-002/003; NFR-REL-002; Q-307.
- **Precondiciones/disparador:** intento fallido/reintentable y límite vigente; operador o regla autorizada inicia.
- **Flujo principal:** 1) clasifica error sanitizado; 2) verifica elegibilidad/límite; 3) conserva misma clave lógica; 4) registra actor/razón; 5) reenvía; 6) actualiza estado.
- **Alternativos:** reintento programado o escalamiento manual. **Errores:** rechazo de contrato/negocio, límite agotado o payload cambió.
- **Reglas:** nunca crear nueva intención para ocultar conflicto; backoff/límite quedan para contrato.
- **Datos leídos/modificados:** estado/intentos; nuevo intento/auditoría `INTERNAL/RESTRICTED`.
- **Autorización/tenant:** `integration.retry`, tenant/scope y elevación si corresponde.
- **Auditoría/comunicaciones:** cada reintento/resultado; sin correo familiar técnico.
- **Postcondición/aceptación:** reintento correlacionado, sin efectos duplicados.
- **Pendientes:** SLA/límites/autoridad Q-307.

### UC-INT-004 — Reconciliar divergencia

- **Objetivo/actor:** resolver estados distintos entre dominios sin fusionar automáticamente; operador de integración autorizado. Secundarios: Admisión/EduPay.
- **FR/preguntas:** FR-INT-002 a 004; Q-301/Q-304/Q-307 a Q-309 diferidas.
- **Precondiciones/disparador:** comparación o incidente detecta divergencia.
- **Flujo principal:** 1) inmoviliza automatización peligrosa; 2) autoriza caso; 3) compara referencias/hechos; 4) clasifica autoridad por dominio; 5) propone corrección; 6) obtiene aprobación si aplica; 7) registra resultado.
- **Alternativos:** reenviar confirmación o corregir referencia mediante historia. **Errores:** identidad ambigua, falta de evidencia o reversión de negocio no autorizada.
- **Reglas:** EduPay autoridad académico-financiera; Admisión autoridad de postulación/cupo; sin sobreescritura silenciosa.
- **Datos leídos/modificados:** estados/referencias; resolución/eventos `RESTRICTED`.
- **Autorización/tenant:** permiso reforzado, tenant/correlación, propósito e ideal separación aprobación/ejecución.
- **Auditoría/comunicaciones:** detección, accesos, decisión/corrección; familia sólo ante cambio accionable aprobado.
- **Postcondición/aceptación:** divergencia resuelta o bloqueada con dueño, sin efectos duplicados.
- **Pendientes:** contrato, reversión, SLA y Q-309.

### UC-INT-005 — Recibir confirmación de EduPay

- **Objetivo/actor:** registrar resultado externo válido; borde de integración/EduPay. Secundarios: Admisión/familia.
- **FR/preguntas:** FR-INT-004/006/007; Q-309 diferida.
- **Precondiciones/disparador:** mensaje/respuesta autenticada y correlacionable; EduPay confirma un hecho.
- **Flujo principal:** 1) autentica/autoriza origen; 2) valida esquema/tenant/correlación; 3) deduplica; 4) clasifica confirmación; 5) registra; 6) actualiza proyección sólo si contrato lo autoriza; 7) genera acción/comunicación.
- **Alternativos:** confirmación técnica, académica o financiera separadas. **Errores:** replay, versión no soportada, tenant no coincidente o hecho contradictorio.
- **Reglas:** sólo evento definido por Q-309 podrá confirmar matrícula; portal de pagos consulta EduPay.
- **Datos leídos/modificados:** mensaje mínimo; confirmación/sync/hito `RESTRICTED`.
- **Autorización/tenant:** sistema a sistema y mapeo contractual; no confiar en tenant arbitrario del payload.
- **Auditoría/comunicaciones:** recepción/validación/duplicado/rechazo; mensaje familiar sólo con contenido aprobado.
- **Postcondición/aceptación:** confirmación válida e idempotente; una entrega técnica nunca marca matrícula.
- **Pendientes:** Q-301 a Q-309, especialmente Q-309.

## Auditoría y soporte

### UC-AUD-001 — Consultar auditoría o elevar soporte temporal

- **Objetivo/actor:** investigar acción/incidente con alcance mínimo; administrador autorizado o soporte temporal. Secundarios: superadministrador/aprobador institucional.
- **FR/preguntas:** FR-AUD-001 a 004; FR-ADM-007; NFR-SEC-012; Q-205/Q-208 diferidas.
- **Precondiciones/disparador:** propósito/ticket/incidente válido; actor solicita consulta o elevación.
- **Flujo principal:** 1) define tenant/recurso/tiempo/propósito; 2) registra motivo, alcance y categorías; 3) obtiene aprobación requerida o activa `SELF-ELEVATION` explícita del Superadministrador Global en MVP; 4) activa acceso mínimo; 5) consulta eventos/dato estrictamente necesario; 6) registra acciones; 7) expira/revoca; 8) revisa resultado.
- **Alternativos:** sólo metadatos sin elevación. **Errores:** alcance amplio, motivo ausente, ventana vencida o intento transversal.
- **Reglas:** superadministrador sin contenido implícito; `SELF-ELEVATION` no es acceso silencioso ni permanente; auditoría no guarda payload sensible completo; denegación no revela existencia.
- **Datos leídos/modificados:** eventos/metadatos y excepcionalmente dato mínimo; elevación/ticket/auditoría `INTERNAL` a `HIGHLY_RESTRICTED`.
- **Autorización/tenant:** permiso reforzado, aprobación, tenant/recurso/propósito/ventana exactos.
- **Auditoría/comunicaciones:** la propia consulta/elevación y revocación se auditan; avisos según política futura.
- **Postcondición/aceptación:** investigación trazable, elevación con actor/tenant/motivo/alcance/categorías/inicio/expiración/resultado y acceso extinguido; ningún privilegio permanente.
- **Pendientes:** procedimiento/aprobadores/retención Q-205/Q-208.

## Índice y cobertura

| Prefijo | Casos | Cobertura principal |
| --- | ---: | --- |
| `UC-FAM` | 4 | Cuenta, recuperación y grupo familiar |
| `UC-APP` | 7 | Borrador, envío, acciones, estado y oferta |
| `UC-FRM` | 2 | Construcción y publicación controlada |
| `UC-DOC` | 3 | Requisitos, revisión y exención |
| `UC-ACT` | 6 | Agenda, confirmación, asistencia, conclusión y excepciones |
| `UC-DEC` | 3 | Recomendación, devolución y decisión |
| `UC-CAP` | 4 | Capacidad, espera, promoción y oferta |
| `UC-COM` | 1 | Comunicación de resultado |
| `UC-ADM` | 3 | Oferta, asistencia y exportación |
| `UC-INT` | 5 | Handoff y resiliencia conceptual |
| `UC-AUD` | 1 | Auditoría y soporte temporal |
| **Total** | **39** | E1-B en progreso |

## Riesgos transversales pendientes

- La aceptación familiar y Q-310 cambian UC-APP-007 y UC-INT-001.
- C-013 condiciona campos, acceso, exportación y evaluación; no autoriza tratamiento legal.
- Q-121/Q-145/Q-167 deben fijar autoridades excepcionales.
- Q-162 a Q-166 deben preservar invariantes de capacidad antes de aprobar el flujo.
- Los detalles Q-201 a Q-210 y Q-301 a Q-309 no se resuelven aquí.
