# Requisitos funcionales iniciales

## Uso y estados

Los requisitos de este documento son candidatos extraídos de la fuente inicial. Su estado es `PROPUESTO` salvo indicación contraria. Deben validarse con propietarios funcionales antes del diseño detallado.

Prioridad provisional:

- **MUST:** necesario para la primera capacidad operativa segura.
- **SHOULD:** importante, pero puede planificarse tras validar el MVP.
- **LATER:** previsto explícitamente para una evolución posterior.

La prioridad no autoriza implementación.

## Identidad y grupo familiar

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-ID-001 | Una persona debe poder crear y verificar una cuenta de postulante. | MUST | La identidad queda vinculada a un canal verificado sin revelar si otros datos existen. |
| FR-ID-002 | Una persona debe recuperar el acceso de forma segura. | MUST | El flujo expira, es de un solo uso y no permite enumerar cuentas. |
| FR-ID-003 | El postulante debe administrar información del grupo familiar. | MUST | Sólo miembros autorizados pueden verla o cambiarla; se conserva evidencia relevante. |
| FR-ID-004 | Una cuenta debe registrar uno o más estudiantes relacionados. | MUST | La relación y facultad para postular se declaran y quedan trazables. |
| FR-ID-005 | Los datos reutilizables deben distinguirse de la instantánea enviada a cada institución. | MUST | Cambiar el perfil no altera silenciosamente una postulación ya enviada. |
| FR-ID-006 | La futura participación de más de un adulto autorizado debe evaluarse. | SHOULD | Requiere reglas de invitación, revocación y conflicto aún no definidas. |

## Oferta y postulación

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-APP-001 | La familia debe consultar ofertas habilitadas por institución, sede, año y curso. | MUST | Sólo se muestran ofertas publicadas y vigentes según la política institucional. |
| FR-APP-002 | La institución debe definir qué señal de disponibilidad muestra. | MUST | La interfaz no infiere ni expone cupos exactos sin configuración autorizada. |
| FR-APP-003 | La familia debe crear una postulación para un estudiante y una oferta concreta. | MUST | La oferta y su configuración quedan identificadas y versionadas. |
| FR-APP-004 | Debe controlarse si se permiten postulaciones simultáneas o duplicadas. | MUST | Una política aprobada determina los casos permitidos. |
| FR-APP-005 | El formulario debe dividirse en pasos y permitir borrador. | MUST | La familia puede retomar sin perder datos confirmados. |
| FR-APP-006 | El producto debe soportar guardado explícito y evaluar guardado automático. | MUST | Fallas de red o concurrencia no sobrescriben cambios sin aviso. |
| FR-APP-007 | Antes del envío se deben validar campos, requisitos y consentimientos aplicables. | MUST | Los errores indican una acción segura y comprensible. |
| FR-APP-008 | El envío debe crear un hito inmutable y un acuse de recibo. | MUST | Se registran versión, actor, instante y configuración aplicable. |
| FR-APP-009 | La familia debe desistir según reglas y conocer sus efectos. | MUST | Se confirma la acción y se actualizan cupos o tareas de forma auditable. |

## Formulario y datos

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-FRM-001 | La institución debe configurar plantillas versionadas de formulario. | MUST | Una postulación conserva la versión con que fue enviada. |
| FR-FRM-002 | La plantilla debe expresar obligatoriedad, tipo, validación y propósito de cada campo. | MUST | El render y la validación usan una definición coherente. |
| FR-FRM-003 | Deben soportarse inicialmente datos del estudiante, domicilio, procedencia y motivo de postulación. | MUST | El detalle final se valida con el colegio. |
| FR-FRM-004 | Deben soportarse antecedentes de hogar, repitencia, PIE, especialistas y necesidades educativas. | MUST | Se etiquetan como restringidos según sensibilidad y propósito. |
| FR-FRM-005 | Deben soportarse datos de madre, padre, apoderado titular y apoderado financiero. | MUST | Los roles familiares pueden coincidir sin duplicar o exponer información. |
| FR-FRM-006 | Deben soportarse ocupación, educación, contacto, trabajo, cargo e ingreso del hogar. | MUST | La visibilidad financiera se limita por permiso y propósito. |
| FR-FRM-007 | Cambios posteriores al envío deben conservar versiones o enmiendas. | MUST | Es posible reconstruir qué información fundamentó una decisión. |

## Documentos

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-DOC-001 | La institución debe configurar requisitos documentales por oferta o regla de curso. | MUST | Cada requisito tiene versión, vigencia y condiciones. |
| FR-DOC-002 | La familia debe cargar archivos de forma privada y conocer formatos y límites. | MUST | Un archivo no es accesible públicamente ni confiable antes de validación. |
| FR-DOC-003 | El sistema debe validar tipo, tamaño e integridad y gestionar escaneo de malware. | MUST | Archivos pendientes o fallidos quedan en cuarentena. |
| FR-DOC-004 | Un revisor autorizado debe aceptar, observar, rechazar o eximir un requisito. | MUST | Se registra autor, motivo, instante y versión revisada. |
| FR-DOC-005 | La familia debe responder observaciones con nuevas versiones. | MUST | No puede ver notas internas y la versión previa se conserva. |
| FR-DOC-006 | El acceso a un archivo debe usar autorización en cada solicitud y vínculo temporal. | MUST | El enlace no concede acceso fuera de su propósito y expiración. |

## Entrevistas y evaluaciones

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-ACT-001 | La institución debe configurar si una entrevista o evaluación aplica por nivel/oferta. | MUST | Una omisión por regla queda registrada. |
| FR-ACT-002 | Personal autorizado debe proponer, agendar, confirmar y reprogramar actividades. | MUST | Se conserva historial de horarios, zona horaria y responsables. |
| FR-ACT-003 | La familia debe ver próximos pasos y confirmar o solicitar cambio cuando esté permitido. | MUST | No accede a agenda o datos de terceros. |
| FR-ACT-004 | Deben registrarse asistencia, inasistencia, cancelación y conclusión separadamente. | MUST | La conclusión no se deduce sólo de la asistencia. |
| FR-ACT-005 | Pautas, notas y resultados deben tener visibilidad restringida. | MUST | Sólo roles y propósitos autorizados acceden al contenido. |
| FR-ACT-006 | La integración futura con calendarios o videollamada queda fuera del MVP hasta validación. | LATER | Requiere contrato, privacidad y manejo de zona horaria. |

## Revisión, decisión, cupos y espera

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-DEC-001 | Una postulación debe asignarse a responsables y tareas. | MUST | La asignación respeta membresía, tenant y alcance. |
| FR-DEC-002 | Personal autorizado debe registrar notas internas clasificadas por visibilidad. | MUST | Nunca aparecen en la vista familiar ni exportaciones no autorizadas. |
| FR-DEC-003 | El flujo debe consolidar antecedentes para revisión final. | MUST | Requisitos faltantes o exenciones son visibles al decisor. |
| FR-DEC-004 | Decisión y aprobación deben respetar la separación de funciones configurada. | MUST | Se identifica recomendador, aprobador y fundamento permitido. |
| FR-CAP-001 | La institución debe definir cupos por institución, sede, año y curso. | MUST | Los ajustes tienen vigencia, razón y autor. |
| FR-CAP-002 | El sistema debe distinguir capacidad, reserva, oferta, aceptación y matrícula. | MUST | Ningún paso consume o libera cupo por inferencia ambigua. |
| FR-CAP-003 | La asignación concurrente debe impedir sobreoferta según política. | MUST | Dos operaciones simultáneas no usan la misma unidad disponible. |
| FR-CAP-004 | La lista de espera debe operar con una política versionada y auditable. | MUST | Ingreso, orden, promoción y cierre son reproducibles. |
| FR-CAP-005 | La posición visible y las prioridades requieren aprobación institucional. | MUST | No se exponen reglas ni datos de terceros por defecto. |

## Comunicación y experiencia familiar

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-COM-001 | La familia debe ver estado comprensible, próximos pasos e historial apropiado. | MUST | La vista se deriva del estado real sin revelar información interna. |
| FR-COM-002 | La institución debe administrar plantillas versionadas por canal y propósito. | MUST | Se revisan variables para evitar fuga de datos. |
| FR-COM-003 | El sistema debe registrar intención, envío, entrega cuando sea posible y fallo. | MUST | “Enviado” no se presenta como “entregado” sin evidencia. |
| FR-COM-004 | Deben gestionarse preferencias y consentimientos cuando correspondan. | MUST | Los mensajes operacionales y promocionales no se mezclan. |
| FR-COM-005 | La comunicación de resultado debe provenir de una decisión autorizada. | MUST | No se envían resultados prematuros por cambios intermedios. |
| FR-COM-006 | La familia debe aceptar o rechazar una oferta vigente. | MUST | La respuesta queda firmemente asociada a oferta, condiciones y plazo. |

## Administración y configuración

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-ADM-001 | Personal autorizado debe ver dashboard, tabla y tablero por etapas. | MUST | Todas las consultas están restringidas a tenant y alcance. |
| FR-ADM-002 | Debe filtrar y buscar por dimensiones autorizadas sin enumeración transversal. | MUST | Resultados y conteos no filtran existencia en otro tenant. |
| FR-ADM-003 | Debe configurar sedes, años, niveles, cursos y ofertas. | MUST | Publicación y cambios sensibles tienen historial. |
| FR-ADM-004 | Debe configurar plantillas, requisitos y flujo dentro de límites de plataforma. | MUST | Versiones activas no alteran retroactivamente postulaciones. |
| FR-ADM-005 | Debe administrar membresías, roles y alcances. | MUST | Nadie puede conceder más privilegio que el propio límite delegado. |
| FR-ADM-006 | Debe exportar o reportar sólo datos y columnas autorizados. | SHOULD | La exportación se audita, expira y minimiza datos. |
| FR-ADM-007 | Debe existir soporte controlado de plataforma sin acceso implícito a contenido sensible. | MUST | Acceso excepcional es temporal, justificado y auditado. |

## Auditoría e historial

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-AUD-001 | Cambios relevantes deben producir eventos auditables. | MUST | Actor, tenant, objeto, acción, instante y correlación son reconstruibles. |
| FR-AUD-002 | Las visualizaciones de datos restringidos deben auditarse. | MUST | La consulta de salud, finanzas o documentos deja evidencia útil. |
| FR-AUD-003 | El historial visible a la familia debe ser una proyección segura. | MUST | No muestra notas, actores internos ni metadatos sensibles. |
| FR-AUD-004 | Correcciones administrativas no deben borrar la historia. | MUST | Se registra corrección, razón y relación con el dato anterior. |

## Integración con EduPay

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-INT-001 | Admisión debe preparar hechos o solicitudes versionados para EduPay. | LATER | No existe escritura directa en tablas externas. |
| FR-INT-002 | Cada intercambio debe ser correlacionable e idempotente. | LATER | Reintentos no duplican matrícula u obligación. |
| FR-INT-003 | Admisión debe mostrar estado de sincronización sin confundirlo con estado de negocio. | LATER | Fallo técnico, entrega y confirmación se distinguen. |
| FR-INT-004 | La confirmación externa debe validarse antes de marcar matrícula. | LATER | Sólo un contrato aceptado actualiza el hito correspondiente. |

## Trazabilidad futura

Cada historia o cambio deberá enlazar al menos un requisito. Cada requisito implementado deberá enlazar pruebas de comportamiento, autorización y aislamiento multiempresa. Los requisitos rechazados o reemplazados se conservarán con su estado, no se reciclará su identificador.
