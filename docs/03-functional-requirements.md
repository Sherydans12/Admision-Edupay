# Requisitos funcionales iniciales

## Uso y estados

Los requisitos provienen de `SRC-001` a `SRC-005`. Las decisiones funcionales de `SRC-004` están aprobadas por Nicolás Sena; la validación institucional y el detalle operativo definido para el piloto se registran en `docs/e1/07-institutional-validation-baseline.md`, `docs/e1/08-pilot-operational-rules.md` y `docs/e1/09-pilot-configuration-matrix.md`. Los IDs existentes se conservan para trazabilidad.

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
| FR-FRM-004 | Deben soportarse antecedentes de hogar, repitencia, PIE, especialistas y necesidades educativas cuando exista finalidad funcional. | MUST | PIE/NEE son opcionales y progresivos; se etiquetan como restringidos según sensibilidad y propósito. |
| FR-FRM-005 | Deben soportarse datos de madre, padre, apoderado titular y apoderado financiero. | MUST | Los roles familiares pueden coincidir sin duplicar o exponer información. |
| FR-FRM-006 | Deben soportarse ocupación, educación, contacto, trabajo y cargo cuando el formulario los justifique. | MUST | El ingreso familiar queda fuera del formulario de admisión MVP y sólo puede tratarse separadamente por un proceso financiero futuro. |
| FR-FRM-007 | Cambios posteriores al envío deben conservar versiones o enmiendas. | MUST | Es posible reconstruir qué información fundamentó una decisión. |
| FR-FRM-008 | Cada institución debe construir formularios mediante secciones ordenables y campos de tipos controlados. | MUST | Configura etiqueta, ayuda, obligatoriedad, validaciones, opciones y orden sin desarrollo específico. |
| FR-FRM-009 | El constructor debe soportar reglas condicionales declarativas y verificables. | MUST | Las condiciones sólo usan operadores/campos permitidos y pueden validarse antes de publicar. |
| FR-FRM-010 | Cada campo debe declarar clasificación de sensibilidad y permisos de visualización. | MUST | El acceso a una respuesta se autoriza por tenant, rol, alcance, propósito y clasificación. |
| FR-FRM-011 | Una versión de formulario sigue `DRAFT`, `PUBLISHED` y `ARCHIVED`; publicada es inmutable. | MUST | La postulación conserva un `ApplicationFormSnapshot` de la versión usada al enviarse. |
| FR-FRM-012 | El constructor no debe admitir JavaScript, HTML ejecutable ni código arbitrario. | MUST | Sólo se almacenan componentes, validaciones y reglas del catálogo permitido. |

## Documentos

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-DOC-001 | La institución debe configurar requisitos documentales por oferta o regla de curso. | MUST | Cada requisito tiene versión, vigencia y condiciones. |
| FR-DOC-002 | La familia debe cargar archivos de forma privada y conocer formatos y límites. | MUST | Un archivo no es accesible públicamente ni confiable antes de validación. |
| FR-DOC-003 | El sistema debe validar tipo, tamaño e integridad y gestionar escaneo de malware. | MUST | Archivos pendientes o fallidos quedan en cuarentena. |
| FR-DOC-004 | Un revisor autorizado debe aceptar, observar, rechazar o eximir un requisito. | MUST | Se registra autor, motivo, instante y versión revisada. |
| FR-DOC-005 | La familia debe responder observaciones con nuevas versiones. | MUST | No puede ver notas internas y la versión previa se conserva. |
| FR-DOC-006 | El acceso a un archivo debe usar autorización en cada solicitud y vínculo temporal. | MUST | El enlace no concede acceso fuera de su propósito y expiración. |
| FR-DOC-007 | Los requisitos documentales deben configurarse por institución, año, curso y versión de proceso. | MUST | Antecedentes adicionales se agregan al catálogo versionado, no como campos hardcodeados. |
| FR-DOC-008 | El catálogo debe expresar “cuando corresponda”, periodo/vigencia y condiciones. | MUST | Puede representar la diferencia entre informe condicional e informes de años específicos sin cambiar código. |

## Entrevistas y evaluaciones

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-ACT-001 | La institución debe configurar si una entrevista o evaluación aplica por nivel/oferta; el piloto exige ambas actividades. | MUST | En Conquistadores son obligatorias desde 1º básico a 4º medio; la regla se versiona por tenant/proceso/oferta/curso/tipo. |
| FR-ACT-002 | Personal autorizado debe agendar y reprogramar actividades. | MUST | La familia solicita cambio con motivo; Admisión/Secretaría asignan el nuevo horario; se conserva historial. |
| FR-ACT-003 | La familia debe ver próximos pasos y solicitar cambio cuando esté permitido. | MUST | No se exige botón de confirmación ni elección directa de horario; no accede a agenda o datos de terceros. |
| FR-ACT-004 | Deben registrarse estados operacionales, asistencia, inasistencia, reprogramación, excepción, repetición y conclusión separadamente. | MUST | La conclusión no se deduce sólo de asistencia; el cierre no ocurre automáticamente por contador. |
| FR-ACT-005 | Pautas, comentarios y resultados deben tener visibilidad restringida. | MUST | La familia sólo ve estado operativo y próximos pasos; sólo roles y propósitos autorizados acceden al contenido. |
| FR-ACT-006 | La integración futura con calendarios o videollamada queda fuera del MVP hasta validación. | LATER | Requiere contrato, privacidad y manejo de zona horaria. |
| FR-ACT-007 | La institución debe poder asignar directamente horarios de actividades. | MUST | En el piloto, sólo el colegio asigna entrevista y evaluación; cada asignación/reprogramación queda auditada. |

## Revisión, decisión, cupos y espera

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-DEC-001 | Una postulación debe asignarse a responsables y tareas. | MUST | La asignación respeta membresía, tenant y alcance. |
| FR-DEC-002 | Personal autorizado debe registrar notas internas clasificadas por visibilidad. | MUST | Nunca aparecen en la vista familiar ni exportaciones no autorizadas. |
| FR-DEC-003 | El flujo debe consolidar antecedentes para revisión final. | MUST | Requisitos faltantes o exenciones son visibles al decisor. |
| FR-DEC-004 | Decisión y aprobación deben respetar la separación de funciones configurada. | MUST | Se identifica recomendador, aprobador y fundamento permitido. |
| FR-DEC-005 | La recomendación de Admisión debe tener ciclo, versiones y auditoría propios. | MUST | Borrador, envío, devolución y reemplazo son reconstruibles y no publican resultado. |
| FR-DEC-006 | Dirección debe aprobar, rechazar o devolver a revisión con justificación. | MUST | Sólo aprobar/rechazar constituye decisión final; devolver reactiva revisión sin notificar un resultado final. |
| FR-DEC-007 | La comunicación del resultado debe ser una acción posterior autorizada. | MUST | Una recomendación o devolución nunca dispara automáticamente el resultado. |
| FR-CAP-001 | La institución debe definir cupos manuales por institución, sede, año y curso. | MUST | Responsable de Admisión y Administrador Institucional Máximo pueden ajustar; se registra actor, fecha/hora, anterior, nuevo y motivo. |
| FR-CAP-002 | El sistema debe distinguir capacidad, reserva, oferta, aceptación y matrícula. | MUST | Ningún paso consume o libera cupo por inferencia ambigua. |
| FR-CAP-003 | La asignación concurrente debe impedir sobreoferta según política. | MUST | Dos operaciones simultáneas no usan la misma unidad disponible. |
| FR-CAP-004 | La lista de espera debe operar con una política versionada y auditable. | MUST | Orden de ingreso por defecto; promoción humana por Responsable de Admisión o Administrador Máximo; nunca automática en MVP. |
| FR-CAP-005 | La posición visible y las prioridades requieren aprobación institucional. | MUST | No se expone posición ni reglas internas; prioridades concretas de Conquistadores siguen pendientes. |

## Comunicación y experiencia familiar

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-COM-001 | La familia debe ver estado comprensible, próximos pasos e historial apropiado. | MUST | La vista se deriva del estado real sin revelar información interna. |
| FR-COM-002 | La institución debe administrar plantillas versionadas por canal y propósito. | MUST | Se revisan variables para evitar fuga de datos. |
| FR-COM-003 | El sistema debe registrar intención, envío, entrega cuando sea posible y fallo. | MUST | “Enviado” no se presenta como “entregado” sin evidencia. |
| FR-COM-004 | Deben gestionarse preferencias y consentimientos cuando correspondan. | MUST | Los mensajes operacionales y promocionales no se mezclan. |
| FR-COM-005 | La comunicación de resultado debe provenir de una decisión autorizada. | MUST | No se envían resultados prematuros por cambios intermedios. |
| FR-COM-006 | El núcleo debe soportar aceptación o rechazo explícito de una oferta cuando la configuración lo exija. | MUST | La respuesta queda asociada a oferta, condiciones y plazo de 3 días hábiles en el piloto; aceptación precede al handoff. |
| FR-COM-007 | El piloto debe notificar inicialmente resultado y acciones sólo por correo. | MUST | Se registra preparación, envío, entrega cuando exista evidencia y fallo; proveedor aún no seleccionado. |
| FR-COM-008 | WhatsApp queda diferido. | LATER | Requiere análisis de costo, privacidad, consentimiento, proveedor y arquitectura. |

## Administración y configuración

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-ADM-001 | Personal autorizado debe ver dashboard, tabla y tablero por etapas. | MUST | Incluye nuevas, por revisar, correcciones venciendo, citas próximas, esperando decisión, ofertas por vencer y lista de espera; todas las consultas están restringidas a tenant y alcance. |
| FR-ADM-002 | Debe filtrar y buscar por dimensiones autorizadas sin enumeración transversal. | MUST | Resultados y conteos no filtran existencia en otro tenant. |
| FR-ADM-003 | Debe configurar sedes, años, niveles, cursos y ofertas. | MUST | Publicación y cambios sensibles tienen historial. |
| FR-ADM-004 | Debe configurar plantillas, requisitos y flujo dentro de límites de plataforma. | MUST | Versiones activas no alteran retroactivamente postulaciones. |
| FR-ADM-005 | Debe administrar membresías, roles y alcances. | MUST | Nadie puede conceder más privilegio que el propio límite delegado. |
| FR-ADM-006 | Debe exportar o reportar sólo datos y columnas autorizados. | SHOULD | Responsable de Admisión y Administrador Máximo pueden exportar dentro de tenant; Secretaría no exporta masivamente por defecto; la exportación se audita, expira y minimiza datos. |
| FR-ADM-007 | Debe existir soporte controlado de plataforma sin acceso implícito a contenido sensible. | MUST | Acceso excepcional es temporal, justificado y auditado. |
| FR-ADM-008 | La institución debe administrar formularios sólo mediante el constructor controlado. | MUST | No existe mecanismo institucional para inyectar código o HTML ejecutable. |

## Auditoría e historial

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-AUD-001 | Cambios relevantes deben producir eventos auditables. | MUST | Actor, tenant, objeto, acción, instante y correlación son reconstruibles. |
| FR-AUD-002 | Las visualizaciones de datos restringidos deben auditarse. | MUST | La consulta de salud, finanzas o documentos deja evidencia útil. |
| FR-AUD-003 | El historial visible a la familia debe ser una proyección segura. | MUST | No muestra notas, actores internos ni metadatos sensibles. |
| FR-AUD-004 | Correcciones administrativas, excepciones y cierres no deben borrar la historia. | MUST | Se registra corrección/excepción/cierre, razón, actor y relación con el dato o intento anterior. |

## Refinamientos operativos E1-B definidos para el piloto

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-DOC-009 | La documentación física aceptada excepcionalmente debe digitalizarse al requisito correspondiente. | MUST | El documento oficial registra origen conceptual `PHYSICAL_DOCUMENT`, operador y fecha; no se crea expediente paralelo. |
| FR-ACT-008 | Cada actividad debe distinguir estado operacional de resultado interno. | MUST | Estados como `PROGRAMADA`, `REALIZADA`, `REPROGRAMADA`, `EXENTA`, `NO_COMPLETADA` y `CERRADA` se separan de `FAVORABLE`, `NO_FAVORABLE` e `INCONCLUSO`. |
| FR-ACT-009 | Una evaluación debe conservar intentos y permitir repetición autorizada. | MUST | Evaluador o Responsable de Admisión inicia repetición; secuencia, responsable, motivo, resultado y relación anterior quedan reconstruibles. |
| FR-DEC-008 | La recomendación de Admisión debe usar opciones funcionales internas y fundamento obligatorio. | MUST | `RECOMENDAR_ADMISION`, `NO_RECOMENDAR_ADMISION` y `DEVOLVER_A_REVISION` son versionados/auditados y no constituyen decisión final. |
| FR-DEC-009 | La decisión de Dirección debe usar opciones finales y fundamento/motivo obligatorio según opción. | MUST | `APROBADO` crea reserva/oferta/comunicación preparada; `RECHAZADO` exige fundamento; `DEVUELTO_A_REVISION` vuelve a Admisión; no inicia directamente EduPay. |
| FR-CAP-006 | Una oferta debe expirar y liberar reserva/cupo al vencer su plazo sin respuesta. | MUST | El piloto usa 3 días hábiles para oferta normal y de espera; el caso conserva historia y no inicia handoff. |
| FR-COM-009 | Las citas deben informar acción de cambio sin exigir confirmación. | MUST | Correo incluye actividad, fecha, hora, lugar, portal y `SOLICITAR CAMBIO`; llamadas son contacto manual, no canal automático. |
| FR-ADM-009 | El dashboard debe mostrar los contadores operativos mínimos del piloto. | MUST | Se distinguen nuevas, revisión, correcciones, citas, decisión, ofertas por vencer y lista de espera, con aislamiento tenant. |

## Integración con EduPay

| ID | Requisito | Prioridad | Criterio conceptual de aceptación |
| --- | --- | --- | --- |
| FR-INT-001 | Admisión debe preparar hechos o solicitudes versionados para EduPay. | LATER | No existe escritura directa en tablas externas. |
| FR-INT-002 | Cada intercambio debe ser correlacionable e idempotente. | LATER | Reintentos no duplican matrícula u obligación. |
| FR-INT-003 | Admisión debe mostrar estado de sincronización sin confundirlo con estado de negocio. | LATER | Fallo técnico, entrega y confirmación se distinguen. |
| FR-INT-004 | La confirmación externa debe validarse antes de marcar matrícula. | LATER | Sólo un contrato aceptado actualiza el hito correspondiente. |
| FR-INT-005 | El handoff debe crear o vincular idempotentemente institución, año, curso, apoderado y estudiante en EduPay. | LATER | Usa referencias externas y contrato; RUT/correo no son claves de idempotencia. |
| FR-INT-006 | EduPay debe crear o recuperar la asociación académica antes de generar deuda anual y matrícula. | LATER | La obligación se genera sólo cuando el estudiante existe y está asociado/matriculado según reglas de EduPay. |
| FR-INT-007 | El portal de pagos existente consulta información de EduPay, no Admisión. | LATER | Admisión sólo proyecta confirmaciones recibidas mediante contrato. |
| FR-INT-008 | El momento del handoff debe ser configurable o quedar fijado por contrato aprobado. | LATER | Se resolverá si ocurre al aprobar Dirección o tras aceptación familiar explícita. |

## Trazabilidad futura

Cada historia o cambio deberá enlazar al menos un requisito. Cada requisito implementado deberá enlazar pruebas de comportamiento, autorización y aislamiento multiempresa. Los requisitos rechazados o reemplazados se conservarán con su estado, no se reciclará su identificador.
