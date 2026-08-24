# G5-LP3 — Síntesis de revisión legal/privacy

## 1. Alcance y boundary de la revisión

| Campo | Estado |
| --- | --- |
| Paquete | `G5-LP3 / DOCUMENTARY ONLY` |
| Entrada LP1 | `COMPLETE / DOCUMENTARY PACKAGE ACCEPTED` |
| Entrada LP2 | `COMPLETE / WORKING DECISIONS ACCEPTED` |
| G5-OR1 | `COMPLETE / TECHNICALLY ACCEPTED` |
| Resultado LP3 | `LEGAL_REVIEW_SYNTHESIS_COMPLETE / FINAL_EXTERNAL_LEGAL_VALIDATION_PENDING` |
| C-013 | `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING` |
| Q-106 | `DEFERRED / PILOT PRECONDITION`; `WORKING_POLICY = DEFINED` |
| G5-EXIT-07 | `PASS_WITH_RESIDUAL` |
| G5-EXIT-10 | `BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD` |
| G5-EXIT-11 | `BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED` |
| G5-EXIT-12 | `BLOCKED` |
| G5 | `NO APROBADA / NOT REQUESTED` |
| Datos reales / piloto / producción | `NOT AUTHORIZED` |
| Integración técnica EduPay | `NOT AUTHORIZED` |
| Fecha de registro | `2026-08-16` |

LP3 registra resultados de revisión humana aprobados en LP3-A y LP3-B. La revisión se
realiza sobre LP1, LP2, el inventario factual del runtime y las fuentes institucionales
leídas para esta etapa. No es investigación jurídica, no cita legislación externa, no
interpreta autónomamente normas y no emite certificación de cumplimiento.

La clasificación documental distingue:

- `CURRENT_RUNTIME_IMPLEMENTATION`: hecho técnico observado; no se modifica en LP3.
- `LP2_WORKING_DECISION`: decisión de trabajo histórica, conservada salvo refinamiento
  explícito.
- `LP3_HUMAN_REVIEW_RESULT`: refinamiento humano aprobado en esta etapa.
- `FINAL_EXTERNAL_LEGAL_VALIDATION_PENDING`: instrumento, texto, matriz o procedimiento
  que todavía requiere validación externa/institucional final.

LP3 cierra el gap de decisiones de diseño humano, pero no cierra el gate legal externo ni
autoriza G5.

## 2. Aprobaciones humanas LP3-A / LP3-B

### 2.1 LP3-A — refinamientos aprobados

#### LP-001 — Controller / processor

**New state:** `LEGAL_MODEL_SUPPORTED / CONTRACTUAL_VALIDATION_PENDING`.

Se mantiene la asignación de trabajo:

- Colegio Conquistadores = `CONTROLLER / RESPONSABLE` para el tratamiento de admisión de
  su tenant.
- SENAS Tecnologías SpA / BaseLogic = `PROCESSOR / ENCARGADO TECNOLÓGICO` para el
  tratamiento realizado por cuenta del colegio.

Permanecen pendientes la validación contractual/legal final, el DPA, el alcance exacto por
finalidad, las instrucciones del processor, los subencargados, la devolución o eliminación
al terminar y la separación del tratamiento comercial/administrativo propio de BaseLogic.

#### LP-004 / LP-014 / Q-106 — autoridad del adulto

La policy existente se refina. La verificación de cuenta de email cubre sólo el registro
de cuenta. Antes de recolectar datos específicos del niño/estudiante, el adulto debe
declarar explícitamente:

- categoría de relación;
- base de autoridad/cuidado;
- autoridad para iniciar el procesamiento o la postulación.

Se mantiene:

`EMAIL_ACCOUNT_VERIFIED != GUARDIAN_AUTHORITY_VERIFIED`.

Antes de recolectar datos sensibles o de ejecutar el envío final/boundary institucional,
la autoridad de guardian/cuidado debe satisfacer el procedimiento institucional aprobado.
La verificación es inmediata cuando existe discrepancia, otro adulto cuestiona la
autoridad, la revisión institucional la requiere, se procesará información sensible o
existe inconsistencia documental.

LP3 no inventa documentos aceptables ni el rol revisor.

`Q-106 = DEFERRED / PILOT PRECONDITION`.

`LP3_REFINED_POLICY = DEFINED` y `FINAL_Q106_PROCEDURE = PENDING`.

#### LP-006 — Health data

La policy LP2 de excepción amplia queda superseded sólo en el punto expresamente refinado:

- `HEALTH_COLLECTION_IN_ADMISSION_PILOT = DISABLED_BY_DEFAULT`.
- `GENERAL HEALTH HISTORY = NOT COLLECTED`.
- La necesidad operacional por sí sola no habilita la captura.
- Sólo puede habilitarse una excepción si la validación legal final identifica autorización
  expresa aplicable al dato, finalidad y caso concretos.
- Sin esa aprobación, el campo permanece deshabilitado.

LP3 no implementa campos ni settings.

#### LP-002 — Legal basis

**New state:** `LEGAL_FRAMEWORK_SUPPORTED / PURPOSE_BY_PURPOSE_FINAL_CLASSIFICATION_PENDING`.

No se aprueba consentimiento genérico para todo el tratamiento. Cada finalidad requiere
clasificación final independiente. Los candidatos LP2 siguen siendo candidatos: no se
promueven a base final las categorías precontractual, contractual, consentimiento,
obligación legal o interés legítimo.

#### LP-009 — Rights procedure

**New state:** `LEGAL_PROCEDURE_REQUIREMENTS_IDENTIFIED / FINAL_OPERATIONAL_PROCEDURE_PENDING`.

Se mantiene el enfoque MVP manual, controlado y auditado. LP3 no requiere un módulo de
software. La solicitud de privacidad debe permanecer diferenciada de una solicitud normal
de soporte.

### 2.2 LP3-B — refinamientos aprobados

#### LP-005 — PIE / NEE

**New state:** `WORKING_DECISION_REFINED / SENSITIVE_FIELD_CATALOG_PENDING`.

- `PIE_NEE_DIAGNOSIS_COLLECTION = DISABLED_BY_DEFAULT`.
- `GENERAL_MEDICAL_CLINICAL_DOCUMENTS = NOT_REQUESTED`.

Puede considerarse conceptualmente sólo información funcional sobre una necesidad de apoyo
o la adecuación requerida para entrevista/evaluación, en el mínimo necesario para ejecutar
la adecuación. Por defecto no se solicitan diagnóstico, historia clínica, tratamiento,
medicación, certificado médico ni detalle clínico. Si un campo revela salud, aplica LP-006.
PIE/NEE nunca es criterio general de elegibilidad ni factor automatizado de admisión.

#### LP-003 — Privacy notice

**New state:** `LEGAL_REQUIREMENTS_IDENTIFIED / FINAL_TEXT_AND_APPROVAL_PENDING`.

El modelo mantiene:

`SHORT_COLLECTION_NOTICE + FULL_VERSIONED_PRIVACY_NOTICE`.

Conceptualmente, el aviso corto incluye controller/responsable, finalidad principal, enlace
a la política, contacto/canal de privacidad y aviso sobre datos de menores cuando
corresponda. La política completa deberá contener la información final aprobada por la
validación legal/privacy.

Se mantiene `NOTICE_ACKNOWLEDGED != CONSENT_GRANTED`. Si finalmente se requiere
consentimiento, será separado, afirmativo, específico por finalidad, versionado y
demostrable. LP3 no publica el texto final.

#### LP-007 — Retention

**New state:** `LEGAL_RETENTION_PRINCIPLE_CONFIRMED / NUMERIC_MATRIX_PREPILOT_REQUIRED`.

Se mantienen `RETENTION_MODEL = PURPOSE_AND_EVENT_DRIVEN` e
`INDEFINITE_RETENTION = PROHIBITED_BY PRODUCT POLICY`.

La matriz final de cada categoría debe definir trigger de retención, duración numérica,
disposición, excepción/legal hold y owner responsable. LP3 no inventa períodos numéricos.

#### LP-008 / LP-009 / LP-010 — derechos, acceso y exportación

Estados canónicos refinados:

- LP-008 = `LEGAL_CONCEPT_MODEL_SUPPORTED / IMPLEMENTATION_PROCEDURE_PENDING`.
- LP-009 = `LEGAL_PROCEDURE_REQUIREMENTS_IDENTIFIED / FINAL_OPERATIONAL_PROCEDURE_PENDING`.
- LP-010 = `CONTROLLED_ACCESS_EXPORT_MODEL_APPROVED / FINAL_LEGAL_MATRIX_APPROVAL_PENDING`.

El MVP puede operar inicialmente solicitudes de privacidad de forma manual, controlada y
auditada. El expediente conceptual debe contener solicitante, verificación de identidad/
autoridad, tipo, alcance, `receivedAt`, vencimiento aplicable, acción/decisión, respuesta,
prueba de entrega y `closedAt`. LP3 no crea schema.

#### LP-011 — Physical documents

**New state:** `PRODUCT_POLICY_APPROVED / SECTORAL_EXCEPTION_CHECK_PENDING`.

La copia digital es el artefacto oficial de admisión. El original físico es una entrada
excepcional y temporal; la disposición por defecto es
`RETURN AFTER DIGITIZATION / VERIFICATION`. No existe archivo físico indefinido por
defecto. Si un documento específico demuestra estar sujeto a una retención sectorial,
debe documentarse una excepción explícita. LP3 no inventa esos documentos.

#### LP-012 — Providers / transfers

**New state:** `TRANSFER_FRAMEWORK_SUPPORTED / PROVIDER_SPECIFIC_REVIEW_PENDING`.

Se conserva la arquitectura aprobada: Grafana Cloud como tecnología de monitorización
seleccionada con implementación diferida a preproducción, y Email + Telegram como modelo
de alertas con implementación diferida a preproducción.

Continúan pendientes la región y retención de Grafana, object storage productivo,
malware scanner productivo, proveedor de email productivo para comunicaciones, DPA y
subencargados, categorías, transferencia/residencia, eliminación específica y revisión de
seguridad de cada proveedor. LP3 no selecciona proveedores.

#### LP-013 — Privacy incident

**New state:** `LEGAL_INCIDENT_REQUIREMENTS_IDENTIFIED / FINAL_RUNBOOK_APPROVAL_PENDING`.

Se mantiene:

- `TECHNICAL_INCIDENT_OWNER = BaseLogic / Nicolás`.
- `RECOVERY_OWNER = BaseLogic / Nicolás`.
- `PRIVACY_INCIDENT_OWNER = Colegio / Institutional Maximum Admin` hasta designar owner
  privacy/legal dedicado.

BaseLogic detecta, contiene, preserva evidencia técnica, recupera y escala los hechos al
controller sin demora injustificada. Colegio/controller evalúa impacto privacy, determina
aplicabilidad legal/regulatoria con el revisor y realiza comunicaciones institucionales,
regulatorias o a titulares cuando corresponda.

El registro conceptual del incidente incluye naturaleza, `detectedAt`, sistemas afectados,
categorías afectadas, sujetos aproximados, impacto, contención, recuperación,
notificaciones, evidencia y cierre. LP3 no inventa una regla estatutaria de 72h, 24h ni
otro plazo.

#### LP-015 — Audit / Security logs

**New state:** `PURPOSE_MINIMIZATION_ACCESS_MODEL_APPROVED / NUMERIC_RETENTION_PENDING`.

Se mantiene:

`AuditEvent != SecurityEvent`.

`AuditEvent` es historial durable de accountability/negocio/seguridad y `SecurityEvent` es
señal de detección, alerta o incidente. Nunca se registran tokens de sesión crudos,
credenciales/contraseñas, challenges, authorization headers, documentos crudos,
respuestas irrestrictas, datos innecesarios de menores, contenido de salud/diagnóstico o
datos PIE/NEE innecesarios.

El acceso requiere mínimo privilegio, finalidad y auditoría/elevación cuando corresponda.
La retención numérica continúa vinculada a LP-007.

## 3. Refinamientos frente a LP2

LP3 modifica sólo las working decisions expresamente refinadas. La siguiente tabla conserva
la trazabilidad de estado y evita reescribir LP2 como si originalmente hubiera contenido la
formulación LP3.

| LP | Estado/working statement LP2 histórico | Refinamiento LP3 |
| --- | --- | --- |
| LP-001 | Working allocation aprobada | Se convierte en `LEGAL_MODEL_SUPPORTED / CONTRACTUAL_VALIDATION_PENDING`; contrato, DPA e instrucciones siguen abiertos |
| LP-002 | Candidatos de base por finalidad | Framework soportado; clasificación final por finalidad aún pendiente; ningún candidato se promueve |
| LP-003 | Aviso corto/completo versionado | Se agregan contenidos conceptuales mínimos y se mantiene texto/aprobación final pendiente |
| LP-004 | Dos niveles de inicio y boundary | Declaraciones explícitas antes de datos específicos del niño y procedimiento antes de sensible/final |
| LP-005 | PIE/NEE opcional y restringido | Diagnóstico/clinical collection deshabilitada por defecto; sólo apoyo funcional mínimo |
| LP-006 | Excepción por necesidad operacional aprobada | Salud deshabilitada por defecto; necesidad operacional sola no habilita excepción |
| LP-007 | Retención por propósito/evento | Principio confirmado; matriz numérica prepiloto obligatoria con trigger, duración, disposición, hold y owner |
| LP-008 | Modelo conceptual delete/anonymize/block | Modelo soportado; procedimiento de implementación pendiente |
| LP-009 | Procedimiento manual/controlado/auditado | Requisitos legales identificados; procedimiento operativo final pendiente y separado de soporte |
| LP-010 | Acceso/export controlado | Modelo aprobado; matriz legal final pendiente |
| LP-011 | Físico excepcional y devolución por defecto | Policy de producto aprobada; verificación de excepciones sectoriales pendiente |
| LP-012 | Framework de proveedores y transferencias | Framework soportado; revisión específica por proveedor pendiente |
| LP-013 | Split técnico/controller/privacy | Requisitos de incidente identificados; runbook final pendiente |
| LP-014 | Policy Q-106 definida | Policy refinada; procedimiento final pendiente |
| LP-015 | Minimización y separación de eventos | Modelo de propósito/acceso aprobado; retención numérica pendiente |

Las partes de LP2 no expresamente refinadas permanecen como antecedentes históricos y no se
reinterpretan como decisiones nuevas.

## 4. Estado canónico LP-001..LP-015 después de LP3

| ID | Estado LP3 |
| --- | --- |
| LP-001 | `LEGAL_MODEL_SUPPORTED / CONTRACTUAL_VALIDATION_PENDING` |
| LP-002 | `LEGAL_FRAMEWORK_SUPPORTED / PURPOSE_BY_PURPOSE_FINAL_CLASSIFICATION_PENDING` |
| LP-003 | `LEGAL_REQUIREMENTS_IDENTIFIED / FINAL_TEXT_AND_APPROVAL_PENDING` |
| LP-004 | `WORKING_DECISION_REFINED / FINAL_Q106_PROCEDURE_PENDING` |
| LP-005 | `WORKING_DECISION_REFINED / SENSITIVE_FIELD_CATALOG_PENDING` |
| LP-006 | `WORKING_DECISION_REVISED / HEALTH_COLLECTION_DISABLED_BY_DEFAULT` |
| LP-007 | `LEGAL_RETENTION_PRINCIPLE_CONFIRMED / NUMERIC_MATRIX_PREPILOT_REQUIRED` |
| LP-008 | `LEGAL_CONCEPT_MODEL_SUPPORTED / IMPLEMENTATION_PROCEDURE_PENDING` |
| LP-009 | `LEGAL_PROCEDURE_REQUIREMENTS_IDENTIFIED / FINAL_OPERATIONAL_PROCEDURE_PENDING` |
| LP-010 | `CONTROLLED_ACCESS_EXPORT_MODEL_APPROVED / FINAL_LEGAL_MATRIX_APPROVAL_PENDING` |
| LP-011 | `PRODUCT_POLICY_APPROVED / SECTORAL_EXCEPTION_CHECK_PENDING` |
| LP-012 | `TRANSFER_FRAMEWORK_SUPPORTED / PROVIDER_SPECIFIC_REVIEW_PENDING` |
| LP-013 | `LEGAL_INCIDENT_REQUIREMENTS_IDENTIFIED / FINAL_RUNBOOK_APPROVAL_PENDING` |
| LP-014 | `WORKING_DECISION_REFINED / FINAL_Q106_PROCEDURE_PENDING` |
| LP-015 | `PURPOSE_MINIMIZATION_ACCESS_MODEL_APPROVED / NUMERIC_RETENTION_PENDING` |

Ningún estado de esta tabla equivale a aprobación legal externa final o certificación de
cumplimiento.

## 5. Superseded statements de LP2

Las siguientes formulaciones de LP2 dejan de ser el estado vigente únicamente en el punto
refinado por LP3:

1. La excepción de LP-006 basada en necesidad operacional ya no basta: la captura de salud
   queda deshabilitada por defecto y requiere autorización legal final expresa para el caso
   concreto.
2. La formulación de LP-004/LP-014 que permitía iniciar sin evidencia jurídica completa se
   complementa y restringe con declaraciones explícitas antes de datos específicos del
   niño y verificación antes del boundary sensible/final. No se inventan documentos ni
   revisores.
3. La captura PIE/NEE de LP-005 se restringe a apoyo funcional mínimo; diagnóstico y
   documentos clínicos no se solicitan por defecto.
4. LP-001 deja de describirse sólo como working allocation y pasa a un modelo legal
   soportado pendiente de validación contractual.

El resto de LP2 conserva su valor histórico y se expresa en LP3 con el estado refinado
correspondiente. Ninguna modificación autoriza implementación.

## 6. Validación restante

El cierre requiere completar los 16 artefactos del registro
[`14-g5lp3-prepilot-legal-artifacts.md`](14-g5lp3-prepilot-legal-artifacts.md): modelo
controller/processor, DPA, matriz de base por finalidad, aviso corto, política completa,
Q-106, catálogo sensible, verificación de health disabled-by-default, retención numérica,
delete/anonymize/block/legal hold, derechos/canal, acceso/exportación, originales físicos,
proveedores/transferencias, incidentes y logs.

Todos permanecen abiertos hasta que exista el owner, insumos, aprobaciones y evidencia
definidos en ese registro. LP3 no determina plazos legales, documentos aceptables,
proveedores, bases finales ni texto público final.

## 7. Impacto en compuertas

| Elemento | Estado LP3 |
| --- | --- |
| `G5-LP3` | `LEGAL_REVIEW_SYNTHESIS_COMPLETE / FINAL_EXTERNAL_LEGAL_VALIDATION_PENDING` |
| `LP3_LEGAL_REVIEW_SYNTHESIS` | `COMPLETE` |
| `DESIGN_DECISION_GAP` | `CLOSED` |
| `PREPILOT_LEGAL_ARTIFACTS` | `OPEN` |
| `C-013` | `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`; síntesis LP3 completa, artefactos prepiloto abiertos |
| `Q-106` | `DEFERRED / PILOT PRECONDITION`; policy refinada, procedimiento final pendiente |
| `G5-EXIT-10` | `BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD` |
| `G5-EXIT-11` | `BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED` |
| `G5-EXIT-12` | `BLOCKED` |
| `G5` | `NO APROBADA / NOT REQUESTED` |

LP3 convierte el blocker legal abierto en una lista finita de artefactos y validaciones,
pero no marca `G5-EXIT-11` como `PASS` ni `PASS_WITH_RESIDUAL`.

## 8. No autorizaciones explícitas

LP3 no autoriza:

- runtime, Prisma schema, migraciones, controllers, services, permisos, tests, scripts,
  workflows, dependencias, variables de entorno ni provider integrations;
- configuración o implementación de Grafana Cloud, Email, Telegram, object storage o
  malware scanner;
- selección de documentos aceptables o reviewer para Q-106;
- habilitación de health, PIE/NEE diagnóstico/clínico o campos sensibles;
- una base legal final, aviso público final, DPA suficiente o procedimiento final;
- datos reales, piloto, producción, EduPay técnico o G5.

Admisión y EduPay permanecen desacoplados. LP3 no cambia schema, Migration 16, ni crea
Migration 17.
