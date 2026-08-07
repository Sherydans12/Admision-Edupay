# E1-B — Reglas operativas funcionales del piloto

## Control y alcance

| Campo | Valor |
| --- | --- |
| Etapa | E1-B — Especificación funcional institucional |
| Estado | `IN PROGRESS / OPERATIONAL BASELINE DEFINED` |
| Piloto | Colegio Particular Conquistadores — Admisión 2027 |
| Fuente | Decisiones operativas confirmadas después de `e9039867e0b2e42782a238bc9edb4052ac6c5fdb` |
| Naturaleza | Reglas funcionales; no es configuración técnica, API, esquema ni base de datos |

Este documento consolida los detalles operativos definidos para el piloto. `DEFINED_FOR_PILOT` significa que existe un valor o regla inicial del piloto; no implica que el parámetro deje de ser configurable en el núcleo, que se haya cerrado G1 o que se autorice implementación.

La configuración debe ser por tenant, proceso/año, oferta, curso/nivel, actividad o condición cuando corresponda. Ninguna regla se implementa por nombre, dominio, correo o identificador de Conquistadores.

## Responsables y separación de funciones

### Responsables registrados

| Capacidad | Responsable o alcance confirmado | Límites y pendientes |
| --- | --- | --- |
| Administrador Institucional Máximo | Arturo Javier Galleguillos Trigo, Sostenedor | Máxima autoridad administrativa del tenant; no es Dirección; sólo actúa dentro de su tenant |
| Responsable operativo de Admisión | Roxana Henríquez | Revisa, recomienda, gestiona cupos/lista de espera y prepara/confirma comunicaciones; no toma la decisión final |
| Secretaría | Función operativa institucional | Asiste postulaciones, carga/digitaliza documentos y gestiona agenda; no recomienda, decide, modifica cupos, promueve ni exporta masivamente por defecto |
| Dirección | Director/a o persona con capacidad Dirección | Ejecuta la decisión final; identidad, suplencias y delegaciones concretas siguen pendientes |
| Entrevista del apoderado | Ejecutor configurable por institución/oferta/actividad | No se fija un cargo concreto del piloto |
| Evaluación diagnóstica | Evaluador configurable por institución/oferta/actividad | No se fija un cargo concreto del piloto |

### Reglas de separación

- Las suplencias son obligatorias conceptualmente para Responsable de Admisión, evaluador y Dirección; no se inventan nombres.
- La persona que emite la recomendación de un caso no puede ejecutar la decisión final de ese mismo caso.
- Admisión puede consultar actividades, resultados internos y comentarios internos autorizados, según permisos y propósito.
- Dirección puede consultar antecedentes permitidos, actividades, resultados internos, comentarios autorizados y recomendación.
- Secretaría puede realizar postulación asistida, digitalizar/cargar documentos, corregir datos administrativos dentro de sus permisos y asignar/reprogramar citas.
- Secretaría nunca obtiene por defecto capacidad de recomendar, aprobar/rechazar, modificar cupos, promover lista de espera o exportar masivamente.
- Agenda puede ser gestionada por Responsable de Admisión y Secretaría.
- La capacidad de administrar/promover cupos y lista de espera corresponde a Responsable de Admisión y Administrador Institucional Máximo. Dirección puede recibirla mediante configuración institucional. Secretaría no la recibe por defecto.

## Cupos, reservas y ofertas

- El colegio define manualmente un número de cupos de admisión por curso y año académico.
- El valor es configurable y se mantiene separado de capacidad académica total, matrícula vigente y EduPay.
- Responsable de Admisión puede aumentar o disminuir cupos directamente, sin aprobación previa de Dirección o Sostenedor. El Administrador Institucional Máximo también puede modificarlos.
- Toda modificación conserva conceptualmente actor, fecha/hora, valor anterior, valor nuevo y motivo/comentario cuando corresponda.
- Una decisión de Dirección `APROBADO` dispara reserva de cupo, creación/emisión de oferta, preparación de comunicación y el plazo de aceptación. No dispara directamente el handoff a EduPay.
- La oferta normal y la oferta proveniente de lista de espera usan el mismo plazo inicial: 3 días hábiles.

## Plazos y expiración

### Aceptación de oferta

El valor inicial del piloto es `3 días hábiles`, configurable por institución/proceso. La familia ve estado de oferta, fecha y hora exactas de vencimiento, acción para aceptar y tiempo restante cuando corresponda. El personal ve fecha de emisión, vencimiento, estado, tiempo restante y origen: oferta normal o promoción desde lista de espera.

El cálculo de día hábil dependerá de un calendario institucional configurable en una evolución futura; no se define su implementación en E1-B.

### Expiración

Si transcurren 3 días hábiles sin respuesta:

- la oferta expira automáticamente;
- se libera la reserva/cupo;
- el caso conserva historial;
- la oferta queda diferenciada como expirada;
- no se inicia handoff a EduPay;
- puede existir reapertura manual excepcional.

La reapertura requiere actor autorizado, motivo y auditoría. No se define todavía un cargo único para cada tipo de reapertura.

### Corrección documental

El valor inicial es `3 días hábiles`, configurable por institución/proceso. Una solicitud de corrección identifica exactamente el requisito o documento afectado, aparece en el portal, se notifica por correo y muestra fecha/hora límite. El vencimiento no produce rechazo automático por sí solo; se aplican las reglas humanas aprobadas.

## Entrevistas y evaluación diagnóstica

### Configuración y modalidad

- Entrevista del apoderado y evaluación diagnóstica son obligatorias para todos los postulantes del piloto desde 1º básico a 4º medio.
- La obligatoriedad se configura por tenant, proceso/año, oferta, curso/nivel y tipo de actividad; no se hardcodea.
- En el MVP de Conquistadores ambas actividades son presenciales en el colegio.
- Modalidad remota queda como capacidad conceptual configurable para evolución futura; no se integra videollamada en el MVP.
- La duración es configurable por tipo de actividad; no se fija una cantidad concreta de minutos.
- El ejecutor de entrevista y el evaluador diagnóstico son configurables; no se fija todavía un cargo concreto.

### Citas, cambios e inasistencias

- No se exige botón `Confirmar asistencia`; la cita queda informada.
- La familia puede usar `SOLICITAR CAMBIO` desde el portal, debe indicar motivo y no elige directamente el nuevo horario.
- Admisión o Secretaría asignan el nuevo horario.
- El correo de programación o reprogramación incluye tipo de actividad, fecha, hora, lugar, acceso al portal e indicación para solicitar cambio.
- El colegio puede llamar manualmente al apoderado. La llamada no es canal automático ni agrega SMS, WhatsApp o telefonía integrada; puede registrarse como contacto manual.
- El expediente deja disponibles para personal autorizado el teléfono y correo del apoderado responsable.
- El valor inicial es de 2 reprogramaciones normales y 15 minutos de tolerancia; ambos son configurables.
- No se crea un workflow especial obligatorio de aprobación para una reprogramación adicional. Personal operacional autorizado puede gestionar excepciones directamente, conservando auditoría.
- La primera inasistencia no cierra automáticamente la postulación y debe poder reprogramarse o revisarse.
- Ante una segunda inasistencia injustificada, Responsable de Admisión o Dirección puede cerrar manualmente el caso. El cierre nunca ocurre automáticamente sólo por contador.

### Intentos, excepciones y resultados

- Evaluador o Responsable de Admisión puede iniciar una repetición de evaluación.
- Cada intento conserva secuencia, fecha, responsable, estado, motivo de repetición, resultado/conclusión y relación con el intento anterior.
- Nunca se sobrescribe silenciosamente un intento o resultado anterior.
- Estados operacionales conceptuales: `PENDIENTE`, `PROGRAMADA`, `REALIZADA`, `REPROGRAMADA`, `INASISTENCIA`, `EXENTA`, `NO_COMPLETADA`, `CERRADA`.
- Resultados internos de entrevista y evaluación: `FAVORABLE`, `NO_FAVORABLE`, `INCONCLUSO`.
- El resultado interno no es la decisión final de admisión.
- El comentario interno es opcional y permanece restringido.
- La familia sólo ve estado operativo y próximos pasos; no ve resultado, comentario, puntaje, conclusión ni recomendación.
- Eximir, cerrar o marcar no completada requiere conservar motivo, actor y auditoría, distinguiendo estos estados de una actividad realizada.

### Formularios de actividad

- Cada institución puede construir/configurar preguntas de entrevista mediante el constructor controlado aprobado: tipos controlados, validación, versionado, sensibilidad y permisos; sin JavaScript ni HTML arbitrario.
- Las preguntas pueden variar por tenant, proceso, curso, oferta y versión.
- Para el MVP no se exige una pauta diagnóstica avanzada: resultado simple y comentario interno opcional son suficientes.
- La capacidad futura de preguntas/campos configurables del evaluador queda registrada como requerimiento evolutivo y no bloquea el MVP.

## Recomendación y decisión final

### Recomendación de Admisión

Responsable de Admisión puede consultar documentos permitidos, entrevista, evaluación, resultados internos, comentarios internos autorizados y antecedentes relevantes del expediente.

Opciones funcionales:

- `RECOMENDAR_ADMISION`;
- `NO_RECOMENDAR_ADMISION`;
- `DEVOLVER_A_REVISION`.

El fundamento o comentario es obligatorio en las tres opciones. La recomendación es interna, versionada y auditable; no se muestra a la familia ni constituye decisión final.

### Decisión de Dirección

Dirección accede a antecedentes permitidos, actividades, resultados internos, comentarios autorizados y recomendación. Opciones:

- `APROBADO`;
- `RECHAZADO`;
- `DEVUELTO_A_REVISION`.

Sólo una identidad con capacidad Dirección puede ejecutar la decisión final. Se registra explícitamente quién actuó, rol, tenant, fecha/hora, decisión, fundamento, versión de antecedentes y decisión anterior cuando corresponda. Una decisión anterior nunca se cambia silenciosamente.

- `RECHAZADO` exige fundamento obligatorio.
- `DEVUELTO_A_REVISION` exige motivo obligatorio, vuelve a Responsable de Admisión y permite completar/corregir antecedentes antes de un nuevo envío a Dirección.
- `APROBADO` dispara reserva, oferta, comunicación preparada y plazo de 3 días hábiles. No inicia directamente handoff a EduPay.
- El handoff a EduPay sólo ocurre después de aceptación familiar expresa, conforme a Q-310.

## Lista de espera

- El proceso puede seguir aceptando postulaciones aunque no exista cupo inmediato.
- Un postulante admisible puede quedar en `LISTA_DE_ESPERA` sin recibir oferta inmediata.
- `APROBADO` y `LISTA_DE_ESPERA` son conceptos distintos.
- Sin reglas adicionales, el orden por defecto es el ingreso a la lista de espera.
- El orden es interno: no se muestra al apoderado ni se exporta públicamente.
- La institución puede configurar prioridades. No se inventan prioridades concretas de Conquistadores.
- Toda prioridad futura debe ser explícita, versionada y auditable, con desempate definido antes de producción.
- La promoción nunca es automática en el MVP. Responsable de Admisión o Administrador Institucional Máximo ejecuta una acción equivalente a `PROMOVER / OFRECER VACANTE`; Secretaría no puede promover.
- Una oferta de espera usa 3 días hábiles, muestra origen `LISTA_DE_ESPERA`, y al expirar libera cupo, conserva historial y sale de esa oferta/lista por defecto. La reapertura es manual, excepcional, autorizada y auditada.

## Comunicaciones

- Postulación enviada: correo automático con confirmación, identificador/número de postulación y acceso al portal.
- Corrección: portal y correo con requisito, instrucciones, plazo y fecha/hora límite.
- Cita: correo automático al programar/reprogramar con fecha, hora, lugar, actividad, acceso al portal y opción de solicitar cambio.
- Resultado final: no se envía automáticamente sólo porque Dirección ejecutó una decisión.
- Flujo: decisión de Dirección → mensaje `PREPARED` → Responsable de Admisión revisa/confirma → envío.
- Estados de comunicación: `PREPARED`, `SENT`, `DELIVERED` sólo con evidencia y `FAILED`.
- Oferta: correo al emitirla y recordatorio automático antes del vencimiento. La anticipación exacta del recordatorio queda configurable y pendiente.
- Llamadas manuales pueden registrarse como contacto, sin convertirse en canal automático.

## Operación, dashboard y flujo

El dashboard de Admisión debe mostrar funcionalmente contadores para nuevas, por revisar, correcciones venciendo, citas próximas, esperando decisión, ofertas por vencer y lista de espera. No se define UI concreta.

```mermaid
flowchart LR
    A["Postulación"] --> B["Documentos"]
    B --> C["Entrevista"]
    C --> D["Evaluación"]
    D --> E["Revisión Admisión"]
    E --> F["Dirección"]
    F --> G["Oferta / Lista de espera"]
    G --> H["Aceptación"]
    H --> I["EduPay"]
```

La vista interna permite entender estado actual, etapas completadas y próxima acción esperada. La vista familiar se limita a postulación enviada, revisión, actividades, resultado y formalización; no muestra deliberaciones ni etapas internas no comunicables.

## Gestión documental

La ficha de postulación permite a personal autorizado ver requisitos, estados, documentos, versiones, correcciones y excepciones. Responsable de Admisión y Administrador Institucional Máximo pueden crear/configurar requisitos por tenant, proceso, curso, oferta y condición, incluyendo obligatoriedad, opcionalidad, equivalentes y vigencia.

Secretaría puede recibir, cargar, digitalizar y marcar recepción administrativa. No realiza validación definitiva por defecto. La validación definitiva corresponde a Responsable de Admisión o revisor autorizado.

Estados funcionales documentales: `PENDIENTE`, `CARGADO`, `EN_REVISION`, `ACEPTADO`, `OBSERVADO`, `REEMPLAZADO`, `EXENTO`. Las versiones se conservan y nunca se borran silenciosamente.

La documentación física aceptada excepcionalmente se digitaliza al requisito correspondiente, queda en el expediente oficial con origen conceptual `PHYSICAL_DOCUMENT`, y no crea expediente paralelo. Conservación o devolución física queda pendiente institucional/legal.

## Reportes y exportaciones

El catálogo MVP debe contemplar postulaciones por curso y estado, nuevas, pendientes de revisión/corrección, entrevistas y evaluaciones pendientes, aprobadas, rechazadas, lista de espera, cupos disponibles/reservados, ofertas pendientes/próximas a vencer y, en el futuro, estado de handoff a EduPay.

Los reportes pueden mostrar requisito, estado, existencia de documento e incidencias. No adjuntan automáticamente archivos sensibles en Excel/CSV. La descarga masiva de archivos es una capacidad distinta y más restringida.

Responsable de Admisión y Administrador Institucional Máximo pueden exportar dentro de su tenant sujeto a rol, propósito, columnas mínimas y auditoría. Secretaría sólo tiene consulta operativa y no exportación masiva por defecto. Datos altamente restringidos no se exportan por defecto.

## SLA y documentación futura

Los objetivos de revisión, decisión, asignación de citas y respuesta son configurables; no se fijan valores adicionales. El sistema debe poder identificar casos atrasados, resaltarlos y generar alertas/tareas operativas.

Los únicos valores temporales concretos definidos para el piloto son aceptación de oferta 3 días hábiles, corrección documental 3 días hábiles, 2 reprogramaciones normales y tolerancia de 15 minutos.

Se registra como entregable futuro la elaboración de manuales sencillos para familias y personal del colegio después de diseñar/implementar la interfaz. No se crea todavía el manual definitivo.

## Protección de datos documentales

No se incorporan datos personales de postulantes o familias, documentos reales de admisión ni datos sensibles reales. Sólo se registran nombres/cargos institucionales expresamente confirmados cuando son necesarios para definir responsabilidades.

PIE/NEE y salud mantienen acceso restringido por propósito, rol y auditoría. El ingreso familiar no forma parte del formulario de admisión MVP ni del análisis académico; un proceso financiero separado requeriría reglas propias y validación posterior.

## Límites

Este documento no define UI, calendarios técnicos, API, tablas, esquema físico, arquitectura, dependencias, integración ejecutable, firma criptográfica, retención legal ni datos reales. E1-B permanece en progreso y G1 continúa `NO APROBADA`.
