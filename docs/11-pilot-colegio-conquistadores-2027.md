# Piloto Colegio Particular Conquistadores — Admisión 2027

## Estado y fuentes

- **Institución:** Colegio Particular Conquistadores.
- **Año académico:** 2027.
- **Fuentes:** `SRC-002`, `SRC-003` y `SRC-004`.
- **Propietario funcional/técnico:** Nicolás Sena.
- **Representante formal institucional:** Arturo Javier Galleguillos Trigo, Sostenedor.
- **Validación institucional:** Arturo Javier Galleguillos Trigo, con participación de Admisión y/o Dirección.
- **Estado:** G0 cerrada; E1-B `IN PROGRESS / READY FOR CLOSURE REVIEW`; G1 no aprobada.

La línea base institucional de E1-B está registrada en [`e1/07-institutional-validation-baseline.md`](e1/07-institutional-validation-baseline.md). Las reglas del piloto se expresan como configuración versionada; no se incorporan condiciones hardcodeadas por institución.

El detalle operativo canónico está en [`e1/08-pilot-operational-rules.md`](e1/08-pilot-operational-rules.md) y la matriz de parámetros en [`e1/09-pilot-configuration-matrix.md`](e1/09-pilot-configuration-matrix.md).

Este documento contiene reglas del piloto para configurar sobre el núcleo multiempresa. Ninguna regla debe transformarse en una condición hardcodeada por nombre, ID o dominio de correo de la institución.

## Configuración conocida

| Dimensión | Configuración del piloto |
| --- | --- |
| Institución | Colegio Particular Conquistadores |
| Sedes | Una sede |
| Año | 2027 |
| Cobertura | Primero básico a cuarto medio |
| Cuenta familiar | Puede gestionar varios hijos |
| Entrevista apoderado | Obligatoria; presencial; horario asignado por el colegio |
| Evaluación estudiante | Diagnóstica, obligatoria y presencial; horario asignado por el colegio |
| Plazo de aceptación | 3 días hábiles; configurable |
| Plazo de corrección | 3 días hábiles; configurable |
| Reprogramaciones normales | 2; configurable |
| Tolerancia | 15 minutos; configurable |
| Resultados internos | `FAVORABLE`, `NO_FAVORABLE`, `INCONCLUSO`; comentario opcional |
| Oferta desde espera | 3 días hábiles; promoción nunca automática |
| Recomendación | Admisión |
| Disposición final | Dirección: `APROBADO`, `LISTA_DE_ESPERA`, `RECHAZADO` o `DEVUELTO_A_REVISION` |
| Canal inicial | Correo |
| WhatsApp | Diferido |
| Pago matrícula | Externo a Admisión, mediante portal que consulta EduPay |

La obligatoriedad de entrevista y evaluación diagnóstica está validada institucionalmente para todos los cursos del piloto. La configuración inicial la marca obligatoria; excepciones, reprogramación, repetición y cierre mantienen historia, motivo y auditoría. No se exige botón de confirmación de asistencia; la familia solicita cambio desde el portal.

## Flujo obligatorio conocido

1. Borrador.
2. Postulación enviada.
3. Recepción y revisión documental.
4. Solicitud y respuesta de correcciones cuando corresponda.
5. Entrevista presencial del apoderado, con horario asignado por el colegio.
6. Evaluación diagnóstica presencial obligatoria del estudiante, con horario asignado por el colegio.
7. Revisión consolidada.
8. Recomendación de Admisión.
9. Disposición final de Dirección: `APROBADO`, `LISTA_DE_ESPERA`, `RECHAZADO` o `DEVUELTO_A_REVISION`, con fundamento/motivo según opción.
10. Si es `APROBADO`, comunicación de oferta; si es `LISTA_DE_ESPERA`, comunicación del estado general sin oferta ni plazo de aceptación.
11. Dirección `APROBADO` → reserva de cupo → emisión de oferta → comunicación preparada → aceptación familiar dentro de 3 días hábiles.
12. Handoff controlado hacia EduPay.
13. Creación o vinculación del estudiante/apoderado y asociación académica en EduPay.
14. Generación de deuda anual y concepto de matrícula en EduPay.
15. Pago mediante el portal de pagos existente, que consulta EduPay.
16. Confirmación, desistimiento, vencimiento o cierre.

### Reglas de recomendación y decisión

- La recomendación tiene versiones, autor, fundamento permitido, fecha y ciclo propio.
- Enviar una recomendación no publica automáticamente el resultado.
- Dirección puede aprobar, rechazar o devolver a revisión con justificación.
- Una devolución conserva la recomendación anterior y reabre la revisión consolidada.
- Sólo una decisión final autorizada permite comunicar un resultado.
- La familia ve una proyección simple; no accede a recomendaciones, notas, puntajes ni deliberaciones.

## Roles participantes

| Rol | Responsabilidad en el piloto | Límite |
| --- | --- | --- |
| Apoderado postulante | Gestiona hijos, formulario, documentos, correcciones y acciones propias | Sólo postulaciones familiares autorizadas |
| Responsable de Admisión — Roxana Henríquez | Revisa según permisos, observa, agenda, consolida, recomienda, administra cupos/espera y prepara/confirma comunicaciones | No toma decisión final; no revela resultados internos a la familia |
| Secretaría | Postulación asistida; carga/digitalización documental; correcciones administrativas; asignación/reprogramación de citas | No recomienda, decide, modifica cupos, promueve ni exporta masivamente por defecto |
| Entrevistador/evaluador | Ejecuta actividad asignada y registra conclusión restringida | Sólo casos y datos necesarios |
| Dirección | Aprueba, pone en lista de espera, rechaza o devuelve con justificación | No altera evidencia ni recomendación histórica |
| Administrador institucional | Configura oferta, formularios, requisitos, membresías y permisos delegados | Tenant y alcance institucional; no es automáticamente Administrador Institucional Máximo |
| Administrador Institucional Máximo — Arturo Javier Galleguillos Trigo, Sostenedor | Administra o supervisa todas las categorías funcionales de su tenant cuando su función lo requiere; puede modificar cupos y promover | Sólo su tenant; permiso, propósito y auditoría; no es Dirección |
| Superadministrador Global | Opera plataforma; para contenido institucional usa elevación explícita | Ningún acceso de lectura implícito; `SELF-ELEVATION` explícita y auditada en MVP |
| Nicolás Sena | Propiedad funcional/técnica e integración EduPay | No reemplaza validación institucional/legal requerida |
| Arturo Javier Galleguillos Trigo, Sostenedor | Representación formal institucional para proceso y reglas del piloto | Asuntos diferidos conservan sus hitos de G1/piloto |

Las personas suplentes, los ejecutores de entrevista/evaluación y las delegaciones adicionales siguen pendientes.

## Formulario inicial

El constructor controlado debe representar, sin código arbitrario:

### Estudiante y postulación

- nombre completo;
- curso al que postula;
- RUT y fecha de nacimiento;
- domicilio;
- colegio de procedencia;
- motivo de postulación.

### Hogar y antecedentes

- personas con quienes vive;
- cantidad de integrantes del hogar;
- repitencia;
- PIE/NEE sólo de forma opcional y progresiva cuando permitan preparar apoyos o adecuaciones justificadas;
- salud/tratamientos sólo ante necesidad funcional concreta, con mínimo detalle;
- ingreso familiar fuera del formulario MVP y del análisis académico; proceso financiero separado si corresponde.

### Adultos responsables

- datos de madre y padre;
- RUT, nacionalidad, nivel educacional, ocupación y contacto;
- apoderado titular cuando no sea madre o padre;
- apoderado financiero;
- lugar de trabajo y cargo;
- no incluir ingreso mensual del hogar en el formulario de admisión MVP.

### Clasificación

- Identificación de estudiante y adultos: `RESTRICTED`.
- Datos de menores y documentos: `RESTRICTED`.
- Salud, PIE/NEE y tratamientos: `HIGHLY_RESTRICTED`.
- Ingreso familiar y datos financieros: `HIGHLY_RESTRICTED`.

La clasificación no justifica por sí sola la captura. El colegio y el responsable legal deben validar propósito, obligatoriedad, acceso y retención, especialmente por `C-013`.

## Documentos iniciales

| Documento/requisito | Fuente | Condición pendiente |
| --- | --- | --- |
| Certificado de nacimiento | SRC-002/SRC-003 | Formato y vigencia |
| Certificado anual de estudios o informe de notas vigente | SRC-002/SRC-003 | Curso/año aplicable |
| Informe de personalidad o desarrollo personal | SRC-002 | Configurable por curso/nivel, oferta y condición; último vigente/disponible o equivalente |
| Exención de informe de personalidad | Validación C-011 | Autorizada, con requisito, actor, motivo, fecha, alcance y auditoría |
| Informe de notas parciales | SRC-003 | Periodo y aplicabilidad |
| Ficha completa | SRC-002/SRC-003 | Se satisface mediante snapshot enviado |
| Antecedentes adicionales | SRC-002 | Catálogo versionado; no hardcodear |

La documentación completa no garantiza vacante. Admisión depende también de requisitos y cupos.

## Documentos institucionales y consentimientos

El proceso requiere publicar o poner a disposición, en versiones trazables:

- Proyecto Educativo Institucional;
- Reglamento Interno;
- protocolos aplicables;
- información de aranceles 2027;
- condiciones de postulación y formalización.

Debe definirse cuáles requieren aceptación expresa, cuál es el texto/versionado válido y cómo se conserva evidencia.

## Notificaciones

- Correo es el único canal inicial aprobado.
- Resultado, solicitudes de corrección, citas y acciones se notifican según plantillas versionadas.
- “Enviado” y “entregado” se distinguen.
- Remitente, proveedor, horarios, reintentos y escalamiento están pendientes.
- WhatsApp no forma parte del piloto inicial hasta evaluación de costos, privacidad y arquitectura.

## Formalización y EduPay

`SRC-002` indica que no formalizar dentro del plazo implica desistimiento salvo autorización y que el pago de matrícula asegura el cupo. En el diseño desacoplado:

- Admisión conserva decisión y cupo de admisión;
- EduPay conserva asociación académica, matrícula y obligaciones;
- el pago ocurre fuera de Admisión;
- el portal de pagos consulta EduPay;
- una entrega técnica del handoff no equivale a matrícula;
- Q-309 debe definir estado pre-pago y evento de confirmación;
- Q-310 está `APPROVED_PRODUCT / FUNCTIONALLY_RESOLVED`: el handoff sigue a la aceptación familiar expresa de una oferta vigente.

## Diferencias respecto del núcleo configurable

| Núcleo | Configuración del piloto |
| --- | --- |
| Varias sedes por tenant | Una sede |
| Cobertura configurable | Primero básico a cuarto medio |
| Actividades configurables | Entrevista y evaluación obligatorias |
| Origen de horario configurable | Colegio asigna directamente |
| Recomendador/aprobador configurables | Admisión recomienda; Dirección decide |
| Canales configurables | Sólo correo inicialmente |
| Aceptación de oferta configurable | Acción expresa; en este piloto precede al handoff |
| Requisitos versionados | Catálogo inicial de SRC-002/SRC-003 |
| Integraciones por contrato | Handoff futuro a EduPay |

Estas diferencias deben representarse mediante configuración y versiones, nunca mediante condicionales del tipo “si la institución es Conquistadores”.

## Reglas operativas definidas en E1-B

- Responsable de Admisión y Administrador Institucional Máximo pueden modificar cupos directamente; toda modificación conserva actor, fecha/hora, valor anterior, valor nuevo y motivo/comentario cuando corresponda.
- Ante vencimiento de una oferta sin respuesta, la oferta expira, libera reserva/cupo, conserva historial y no inicia handoff a EduPay. La reapertura es manual, excepcional, autorizada y auditada.
- La primera inasistencia no cierra; ante una segunda injustificada, Responsable de Admisión o Dirección puede cerrar manualmente. Nunca se cierra automáticamente sólo por contador.
- La lista de espera usa orden de ingreso por defecto, no expone posición y no se promueve automáticamente. `LISTA_DE_ESPERA` no crea oferta, plazo de aceptación ni handoff; Secretaría no promueve.
- La recomendación usa opciones internas con fundamento obligatorio; Dirección usa `APROBADO`, `LISTA_DE_ESPERA`, `RECHAZADO` y `DEVUELTO_A_REVISION`. `APROBADO` crea reserva/oferta/comunicación y plazo de aceptación; la aceptación familiar expresa sigue siendo condición previa al handoff.
- Si la admisibilidad ya fue decidida, promover desde `LISTA_DE_ESPERA` no requiere nueva decisión de Dirección: Responsable de Admisión o Administrador Institucional Máximo crea reserva/oferta e inicia los mismos 3 días hábiles, con historial y auditoría.

## Estado de contradicciones en E1-B

| ID | Estado | Hito |
| --- | --- | --- |
| C-009 | INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING | Obligatoria para todos; configuración versionada, excepciones, reprogramación, repetición y cierre auditados |
| C-010 | RESUELTA | Etapa 4 corresponde a “Revisión de antecedentes”; no altera el flujo |
| C-011 | INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING | Catálogo concreto del piloto por curso/nivel, condición, vigencia y equivalencia |
| C-013 | INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING | Fundamento normativo, textos, retención, eliminación/anonimización y titulares antes de datos reales/piloto productivo; no bloquea E1-B/G1 |
| C-014 | INSTITUTIONALLY_VALIDATED / OPERATIONAL_DETAIL_PENDING | Personal, suplencias, evidencias y detalle de documentación física |

## Decisiones pendientes

1. Nombres de suplentes y ejecutores concretos de entrevista/evaluación.
2. Duración concreta de actividades y pauta diagnóstica avanzada.
3. Catálogo concreto y equivalentes del informe de personalidad.
4. Prioridades concretas de Conquistadores y desempate.
5. Plantillas finales, recordatorio de oferta y SLA adicionales.
6. `PILOT_CONFIGURATION_PENDING`: suplentes, ejecutores, duración, catálogo de personalidad, prioridades, plantillas y SLA.
7. `PRE_PILOT_LEGAL_PENDING`: validación legal de C-013, retención, eliminación/anonimización, titulares y conservación/devolución física.
8. `FUTURE_INTEGRATION_PENDING`: estado pre-pago y evento de matrícula de EduPay (Q-301 a Q-309).
9. Responsable legal/normativo antes de autorizar datos reales/piloto productivo.

## Regla de no acoplamiento

Las pruebas futuras deben demostrar la misma capacidad con al menos dos tenants sintéticos y configuraciones distintas. El nombre del colegio no puede determinar flujo, formulario, permisos, documentos, cupos, canal ni integración.
