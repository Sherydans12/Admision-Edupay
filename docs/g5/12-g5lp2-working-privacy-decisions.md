# G5-LP2 — Decisiones working de privacidad/legal

## 1. Alcance y boundary

| Campo | Estado |
| --- | --- |
| Paquete | `G5-LP2 / DOCUMENTARY ONLY` |
| Entrada | `G5-LP1 = COMPLETE / DOCUMENTARY PACKAGE ACCEPTED` |
| Resultado LP2 | `WORKING_DECISIONS_COMPLETE / FINAL_LEGAL_VALIDATION_PENDING` |
| G5-OR1 | `COMPLETE / TECHNICALLY ACCEPTED` |
| G5-EXIT-07 | `PASS_WITH_RESIDUAL` |
| G5-EXIT-10 | `BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD` |
| G5-EXIT-11 | `BLOCKED / FINAL_LEGAL_VALIDATION_REQUIRED` |
| G5-EXIT-12 | `BLOCKED` |
| G5 | `NO APROBADA / NOT REQUESTED` |
| Datos reales / piloto / producción | `NOT AUTHORIZED` |
| Integración técnica EduPay | `NOT AUTHORIZED` |
| Fecha de registro | `2026-08-16` |

Este documento registra las decisiones humanas aprobadas en la revisión posterior a LP1,
organizadas en Ronda A, Ronda B y Ronda C. Son decisiones de trabajo para cerrar el gap de
diseño humano y derivar condiciones de prepiloto/preproducción. No son revisión jurídica,
investigación legal, opinión de cumplimiento ni autorización operativa.

Se mantienen separados los siguientes estados:

- `WORKING_DECISION_APPROVED`: decisión humana aprobada como política de trabajo, pendiente
  de validación jurídica/normativa final cuando se indique.
- `PARTIAL_WORKING_DECISION_APPROVED`: decisión humana aprobada con un residual explícito.
- `FINAL_LEGAL_VALIDATION_PENDING`: la clasificación, texto, plazo, contrato o procedimiento
  final todavía debe ser validado por la institución y el revisor legal/privacy designado.
- `CURRENT_RUNTIME_IMPLEMENTATION`: hecho técnico del repositorio; no se modifica ni se
  infiere a partir de una decisión de trabajo.

Ninguna decisión LP-001..LP-015 se marca `FINAL_LEGAL_APPROVED` o
`LEGAL_COMPLIANCE_CONFIRMED`.

## 2. Declaración de aprobación humana

La Ronda A, la Ronda B y la Ronda C fueron aprobadas por revisión humana posterior a LP1.
Esta entrega registra esa aprobación humana como `WORKING_DECISION_APPROVED` o
`PARTIAL_WORKING_DECISION_APPROVED`, según el residual expresamente conservado. La
aprobación no sustituye la validación jurídica final, no convierte un candidato en base
jurídica definitiva y no autoriza datos reales, piloto, producción, G5 ni EduPay.

La referencia institucional de C-013 permanece:
`INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.

## 3. Ronda A — decisiones aprobadas

### LP-001 — Responsable / encargado

**Status:** `WORKING_DECISION_APPROVED`.

**Working model aprobado:**

- Colegio Conquistadores = `CONTROLLER / RESPONSABLE` para los datos del proceso de
  admisión de su tenant, porque determina finalidades institucionales, requisitos,
  evaluación, decisión y actores autorizados.
- SENAS Tecnologías SpA / BaseLogic = `PROCESSOR / ENCARGADO TECNOLÓGICO` para el
  tratamiento de datos de admisión realizado por cuenta del colegio.

Quedan pendientes la validación jurídica final, el contrato/DPA, el alcance exacto por
finalidad, los subencargados, la devolución o supresión al terminar y la separación de
tratamientos propios comerciales/administrativos de BaseLogic respecto del expediente de
admisión. No se afirma que BaseLogic nunca pueda ser responsable independiente: esos
tratamientos propios quedan fuera del expediente de admisión y requieren análisis
separado.

### LP-004 — Menores / autoridad del adulto

**Status:** `WORKING_DECISION_APPROVED`.

Se aprueba un modelo de dos niveles:

1. **Level 1 — Start application:** el adulto dispone de una cuenta de email verificada,
   declara su relación con el estudiante y declara su autoridad para iniciar la
   postulación. No se exige por defecto evidencia jurídica completa antes de permitir
   iniciar toda postulación.
2. **Level 2 — Before sensitive / final boundary:** la relación y la autoridad se validan
   conforme a la política institucional antes del boundary definido y siempre en casos de
   discrepancia o riesgo.

Debe mantenerse explícitamente:

`EMAIL_ACCOUNT_VERIFIED != GUARDIAN_AUTHORITY_VERIFIED`.

### LP-005 — PIE / NEE

**Status:** `WORKING_DECISION_APPROVED`.

La política de trabajo es: no existe un requisito general de elegibilidad ni un criterio
automático de admisión; la captura es progresiva y condicional; se recopila el mínimo dato
necesario con finalidad funcional explícita; el acceso es `HIGHLY_RESTRICTED`, auditable y
no queda expuesto en general al personal de Admisión; la familia nunca ve deliberación
interna.

LP2 no crea un catálogo legal definitivo de PIE/NEE.

### LP-006 — Health

**Status:** `WORKING_DECISION_APPROVED`.

La política del piloto es `NO GENERAL HEALTH COLLECTION`. Sólo podrá existir captura
excepcional cuando haya una necesidad operacional concreta, aprobación previa, necesidad
para seguridad/adaptación/actividad, mínimo dato posible, acceso `HIGHLY_RESTRICTED` y
finalidad explícita. No se habilita una historia clínica general.

## 4. Q-106 / LP-014

**LP-014 Status:** `WORKING_DECISION_APPROVED`.

**Q-106 canonical status:** `DEFERRED / PILOT PRECONDITION`.

La working policy aprobada es:

1. El adulto inicia con email verificado.
2. Declara la relación con el estudiante.
3. Declara su autoridad.
4. La validación de relación/autoridad ocurre antes del boundary institucional sensible o
   final.
5. La validación es inmediatamente obligatoria cuando existe discrepancia, otro adulto
   cuestiona la autoridad, los datos sensibles la requieren, la revisión institucional la
   requiere o la evidencia documental presenta una inconsistencia.
6. El revisor y la evidencia aceptable quedan sujetos a validación institucional/jurídica
   final.

El estado de implementación de la verificación de cuenta de email permanece
`IMPLEMENTED`; no se transforma en verificación de autoridad. No se hardcodean documentos
específicos no aprobados y Q-106 no se marca `CLOSED`.

`WORKING_POLICY = DEFINED IN G5-LP2` y
`FINAL_INSTITUTIONAL_LEGAL_VALIDATION = PENDING`.

## 5. Ronda B — decisiones aprobadas

### LP-002 — Legal basis by purpose

**Status:** `WORKING_DECISION_APPROVED / FINAL_LEGAL_CLASSIFICATION_PENDING`.

No se aprueba un consentimiento genérico para todo. Cada finalidad debe tener evaluación
independiente de base, evidencia de la decisión y restricciones específicas. La
clasificación de trabajo candidata es:

| Finalidad | Clasificación candidata de trabajo |
| --- | --- |
| `ADMISSION_CORE_ORDINARY_DATA` | Candidato a necesidad precontractual/contractual, sujeto a validación final y reglas específicas para menores |
| `CHILD_DATA_REQUIRING_SPECIAL_AUTHORITY` | Autoridad parental/tutor o autorización aplicable, sujeta a validación final |
| `SENSITIVE_DATA` | Análisis especial de tratamiento de datos sensibles; no queda cubierto automáticamente por un consentimiento genérico de admisión |
| `SECURITY / AUDIT` | Evaluación de base separada |
| `MARKETING` | Fuera de alcance del MVP de admisión |

Estas clasificaciones son candidatas de trabajo y no bases jurídicas finales.

### LP-003 — Privacy notice

**Status:** `WORKING_DECISION_APPROVED`.

El diseño aprobado contempla un aviso corto antes de la captura inicial y un aviso de
privacidad completo siempre accesible. Ambos deben estar versionados. Cuando el
consentimiento sea jurídicamente requerido, será una acción afirmativa separada. No se
iguala `NOTICE_ACKNOWLEDGED` con `CONSENT_GRANTED`.

La evidencia conceptual esperada distingue, cuando corresponda, versión del aviso,
momento mostrado y actor, de finalidad de consentimiento, versión de consentimiento,
momento otorgado y actor. Esto no diseña schema ni implica que el runtime actual lo
implemente.

### LP-007 — Retention

**Status:** `PARTIAL_WORKING_DECISION_APPROVED`.

Se aprueba `RETENTION_MODEL = PURPOSE_AND_EVENT_DRIVEN` e
`INDEFINITE_RETENTION = PROHIBITED_BY PRODUCT POLICY`. Al terminar la finalidad, la regla
de trabajo es eliminar o anonimizar, salvo que un fundamento documentado requiera
preservación.

Los períodos numéricos quedan `FINAL_LEGAL_VALIDATION_PENDING`. LP2 no inventa 30 días,
1 año, 5 años ni otro plazo.

### LP-008 — Delete / anonymize / block

**Status:** `WORKING_DECISION_APPROVED`.

Se distinguen conceptualmente `DELETE`, `ANONYMIZE`, `BLOCK`, `ARCHIVE` y `LEGAL_HOLD`.
`ARCHIVE != DELETE`. `BLOCK` suspende o restringe el tratamiento y no es sinónimo de
eliminación. `LEGAL_HOLD` es una preservación excepcional y documentada, no retención
indefinida normal. LP2 no implementa estos procedimientos.

### LP-009 — Data subject request procedure

**Status:** `WORKING_DECISION_APPROVED`.

El modelo inicial es `MANUAL / CONTROLLED / AUDITED`; no se exige construir un módulo
completo antes del piloto. El procedimiento conceptual debe registrar canal, solicitante,
verificación de identidad/autoridad, tipo, alcance, `receivedAt`, vencimiento aplicable,
decisión, acciones, prueba de respuesta y `closedAt`. Podrá definirse más adelante un
email o formulario web dedicado; LP2 no selecciona la dirección pública final.

### LP-010 — Access / export

**Status:** `WORKING_DECISION_APPROVED`.

- El acceso familiar normal ocurre en el portal.
- Una solicitud formal de acceso usa un export controlado.
- La portabilidad sólo se trata si el análisis jurídico final determina que aplica.
- Los datos de terceros se revisan y redactan cuando sea necesario.
- Los datos `HIGHLY_RESTRICTED` no tienen exportación masiva irrestricta por defecto.
- La exportación de personal requiere allowlist, finalidad y auditoría.
- El Superadmin de plataforma requiere elevación explícita de tenant.

La matriz 10 mantiene el comportamiento técnico observado y no se interpreta como permiso
legal definitivo.

## 6. Ronda C — decisiones aprobadas

### LP-011 — Physical documents

**Status:** `WORKING_DECISION_APPROVED / SECTORAL_VALIDATION_PENDING`.

`PHYSICAL_DOCUMENT = EXCEPTIONAL INPUT CHANNEL` y la copia digital es el registro oficial
de admisión. La disposición por defecto del original es
`RETURN AFTER DIGITIZATION / VERIFICATION`. Si la custodia temporal es operacionalmente
necesaria, debe existir recibo, operador responsable, custodia segura, `receivedAt`,
`dispositionDueAt`, `returnedOrDestroyedAt` y trazabilidad. La retención física indefinida
no está permitida por política de producto. Permanece pendiente validar el requisito
sectorial/institucional específico antes de la política final.

### LP-012 — Providers / residency / transfers

**Status:** `WORKING_DECISION_APPROVED / PROVIDER-SPECIFIC_VALIDATION_PENDING`.

No existe requisito de residencia exclusiva en Chile para todo el producto. Los
proveedores internacionales sólo podrán usarse tras aprobación controlada. El registro de
cada proveedor debe cubrir identidad, finalidad, categorías, región, subencargados,
mecanismo de transferencia, DPA/acuerdo de tratamiento, retención, devolución/supresión,
controles de seguridad, ruta de incidentes y minimización.

Decisiones actuales:

- Grafana Cloud: tecnología aprobada, implementación diferida a preproducción.
- Email + Telegram: modelo de alertas aprobado, implementación diferida a preproducción.
- Región y retención de Grafana Cloud: no seleccionadas.
- Object storage productivo: no seleccionado.
- Malware provider productivo: no seleccionado.
- Proveedor de email productivo de comunicaciones: `NOT_SELECTED` en el estado factual del
  repositorio; no se inventa un proveedor.

La observabilidad no debe enviar documentos, respuestas irrestrictas, datos de salud,
PIE/NEE, tokens/challenges ni PII salvo que sea técnicamente necesaria y explícitamente
aprobada. Las alertas deben usar datos minimizados y sanitizados.

### LP-013 — Privacy incident responsibility

**Status:** `WORKING_DECISION_APPROVED`.

- `TECHNICAL_INCIDENT_OWNER = BaseLogic / Nicolás`.
- `RECOVERY_OWNER = BaseLogic / Nicolás`.
- `PRIVACY_INCIDENT_OWNER = Colegio / Institutional Maximum Admin` hasta que se designe un
  owner privacy/legal dedicado.

BaseLogic detecta, contiene, preserva evidencia técnica, recupera y reporta hechos del
incidente al controller. El colegio/controller evalúa impacto privacy, autoriza el
escalamiento institucional/legal y realiza comunicaciones que resulten aplicables después
de la determinación jurídica correspondiente. El revisor legal/privacy asesora sobre
aplicabilidad, contenido y escalamiento.

Este documento no inventa plazos estatutarios ni menciona 72 horas, 24 horas u otro plazo.
El procedimiento final de incidentes queda pendiente.

### LP-015 — Audit / security logs

**Status:** `PARTIAL_WORKING_DECISION_APPROVED`.

`AuditEvent != SecurityEvent`.

- `AuditEvent` es historial durable de accountability, negocio y seguridad.
- `SecurityEvent` es señal de detección, alerta o incidente.
- El destino futuro de `SecurityEvent` es el stack de observabilidad de Grafana Cloud.
- Nunca deben registrarse tokens de sesión crudos, challenges, contraseñas/credenciales,
  headers de autorización, documentos crudos, respuestas de formulario irrestrictas ni
  contenido innecesario de salud/PIE/NEE.
- El acceso requiere finalidad y rol autorizado, con auditoría/elevación cuando
  corresponda.

La retención numérica de `AuditEvent` y `SecurityEvent` queda pendiente de la matriz final
de retención y acceso.

## 7. Tabla resumen LP-001..LP-015

| ID | Status canónico LP2 |
| --- | --- |
| LP-001 | `WORKING_DECISION_APPROVED` |
| LP-002 | `WORKING_DECISION_APPROVED / FINAL_LEGAL_CLASSIFICATION_PENDING` |
| LP-003 | `WORKING_DECISION_APPROVED` |
| LP-004 | `WORKING_DECISION_APPROVED` |
| LP-005 | `WORKING_DECISION_APPROVED` |
| LP-006 | `WORKING_DECISION_APPROVED` |
| LP-007 | `PARTIAL_WORKING_DECISION_APPROVED` |
| LP-008 | `WORKING_DECISION_APPROVED` |
| LP-009 | `WORKING_DECISION_APPROVED` |
| LP-010 | `WORKING_DECISION_APPROVED` |
| LP-011 | `WORKING_DECISION_APPROVED / SECTORAL_VALIDATION_PENDING` |
| LP-012 | `WORKING_DECISION_APPROVED / PROVIDER-SPECIFIC_VALIDATION_PENDING` |
| LP-013 | `WORKING_DECISION_APPROVED` |
| LP-014 | `WORKING_DECISION_APPROVED` |
| LP-015 | `PARTIAL_WORKING_DECISION_APPROVED` |

Ningún ID tiene estado `FINAL_LEGAL_APPROVED`.

## 8. Remaining final-validation items

Permanecen abiertos, como mínimo:

- validación legal final de la relación controller/processor y su alcance por finalidad;
- contrato/DPA y tratamiento de subencargados;
- mapa final de base por finalidad y reglas específicas para menores;
- avisos corto/completo y consentimientos separados cuando correspondan;
- procedimiento institucional/legal de autoridad del adulto y Q-106;
- catálogo aprobado de PIE/NEE y campos sensibles;
- política o catálogo aprobado para cualquier captura excepcional de salud;
- matriz numérica de retención por propósito, evento, categoría, proveedor y logs;
- procedimiento de eliminación, anonimización, bloqueo, archivo y legal hold;
- procedimiento y canal final para solicitudes de titulares;
- aprobación final de acceso, exportación y portabilidad cuando aplique;
- procedimiento institucional para originales físicos y validación sectorial;
- validación por proveedor de región, transferencia, subencargados, DPA, retención y
  eliminación/devolución;
- procedimiento final de incidentes privacy/security y confirmación del owner;
- matriz final de acceso y retención de `AuditEvent`/`SecurityEvent`.

## 9. Requisitos de prepiloto / preproducción derivados

Los siguientes requisitos deben cumplirse antes de datos reales o piloto productivo. Son
condiciones documentales y de aprobación; no constituyen implementación de esta etapa.

| ID | Requisito |
| --- | --- |
| LP2-PP-001 | Validación legal final del modelo controller/processor por finalidad y tenant. |
| LP2-PP-002 | DPA/acuerdo de tratamiento aprobado, incluyendo alcance, subencargados, devolución/supresión y controles aplicables. |
| LP2-PP-003 | Mapa final de base por finalidad, categorías, actores y restricciones. |
| LP2-PP-004 | Aviso corto y aviso completo aprobados y versionados; consentimiento separado cuando corresponda. |
| LP2-PP-005 | Procedimiento operativo aprobado para autoridad/relación del adulto y Q-106, con discrepancias, evidencia, revisión y auditoría. |
| LP2-PP-006 | Catálogo aprobado de campos PIE/NEE/sensibles, finalidades, mínimo dato, roles, acceso y retención. |
| LP2-PP-007 | Captura de salud deshabilitada por defecto o catálogo excepcional explícitamente aprobado. |
| LP2-PP-008 | Matriz numérica de retención aprobada por propósito, evento, categoría, proveedor y excepción. |
| LP2-PP-009 | Procedimiento aprobado para delete, anonymize, block, archive y legal hold. |
| LP2-PP-010 | Procedimiento y canal aprobado para solicitudes de titulares, con verificación, alcance, decisión, respuesta y cierre. |
| LP2-PP-011 | Aprobación legal/institucional de acceso, exportación, terceros, datos altamente restringidos y portabilidad cuando aplique. |
| LP2-PP-012 | Procedimiento aprobado para original físico, custodia temporal, devolución/destrucción y trazabilidad. |
| LP2-PP-013 | Aprobación por proveedor productivo de residencia, transferencias, subencargados, DPA, minimización, seguridad, retención y devolución/supresión. |
| LP2-PP-014 | Procedimiento de incidente privacy/security aprobado y owner institucional confirmado. |
| LP2-PP-015 | Matriz final de acceso y retención de `AuditEvent` y `SecurityEvent`, con destino productivo y minimización aprobados. |

## 10. No autorizaciones y boundary técnico

Esta etapa no autoriza:

- schema, tablas, migraciones, rutas, cambios de permisos, workflows, dependencias,
  variables de entorno o integraciones;
- implementación de Grafana Cloud, Email, Telegram, object storage o malware provider;
- selección de región/retención productiva no aprobada;
- datos personales reales, documentos reales, piloto o producción;
- integración técnica o contractual con EduPay;
- una afirmación de cumplimiento, licitud, base jurídica final, suficiencia de DPA o
  cierre legal de C-013/Q-106;
- una aprobación de G5.

Admisión y EduPay permanecen como dominios desacoplados. No se comparten tablas ni se
introducen dependencias directas. La diferencia entre `POLICY_WORKING_DECISION` y
`CURRENT_RUNTIME_IMPLEMENTATION` es obligatoria: LP2 no convierte valores
`NOT_DEFINED` técnicos en valores ficticios.

## 11. Disposición de compuertas

| Elemento | Estado al cierre de LP2 |
| --- | --- |
| `G5-LP2` | `WORKING_DECISIONS_COMPLETE / FINAL_LEGAL_VALIDATION_PENDING` |
| `C-013` | `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`; working policy definida, validación final pendiente |
| `Q-106` | `DEFERRED / PILOT PRECONDITION`; working policy definida, no cerrado |
| `G5-EXIT-10` | `BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD`; no se reabre LP2 |
| `G5-EXIT-11` | `BLOCKED / FINAL_LEGAL_VALIDATION_REQUIRED`; no `PASS` ni `PASS_WITH_RESIDUAL` |
| `G5-EXIT-12` | `BLOCKED`; no documento de autorización |
| `G5` | `NO APROBADA / NOT REQUESTED` |
| `REAL DATA` | `NOT AUTHORIZED` |
| `PILOT` | `NOT AUTHORIZED` |
| `PRODUCTION` | `NOT AUTHORIZED` |
| `EDUPAY TECHNICAL INTEGRATION` | `NOT AUTHORIZED` |

La siguiente acción humana es completar la validación legal/normativa final, aprobar los
instrumentos y procedimientos LP2-PP-001..015 y emitir, sólo en una etapa posterior y de
forma separada, cualquier autorización explícita para datos reales, piloto o producción.

## Addendum G5-LP3 — refinement disposition (2026-08-16)

Este addendum preserva LP2 como registro histórico y documenta únicamente los refinamientos
humanos aprobados en LP3-A y LP3-B. No reescribe las decisiones LP2 como si hubieran tenido
desde el inicio los estados LP3. La síntesis canónica está en
[`13-g5lp3-legal-review-synthesis.md`](13-g5lp3-legal-review-synthesis.md) y el registro
finito de cierre en [`14-g5lp3-prepilot-legal-artifacts.md`](14-g5lp3-prepilot-legal-artifacts.md).

| LP | LP2 histórico preservado | Refinamiento LP3 | Estado LP3 |
| --- | --- | --- | --- |
| LP-001 | Working allocation controller/processor | Modelo legal soportado; validación contractual, DPA, instrucciones y subencargados pendientes | `LEGAL_MODEL_SUPPORTED / CONTRACTUAL_VALIDATION_PENDING` |
| LP-002 | Candidatos de base por finalidad | Framework soportado; clasificación final independiente por finalidad pendiente; candidatos no promovidos | `LEGAL_FRAMEWORK_SUPPORTED / PURPOSE_BY_PURPOSE_FINAL_CLASSIFICATION_PENDING` |
| LP-003 | Aviso corto/completo versionado | Requisitos mínimos del aviso corto y consentimiento separado afirmativo/versionado cuando corresponda | `LEGAL_REQUIREMENTS_IDENTIFIED / FINAL_TEXT_AND_APPROVAL_PENDING` |
| LP-004 | Modelo de dos niveles y email distinto de autoridad | Declaraciones explícitas antes de datos específicos del niño y procedimiento antes de sensible/final | `WORKING_DECISION_REFINED / FINAL_Q106_PROCEDURE_PENDING` |
| LP-005 | PIE/NEE opcional, progresivo y restringido | Diagnóstico/clinical collection disabled-by-default; sólo apoyo funcional mínimo | `WORKING_DECISION_REFINED / SENSITIVE_FIELD_CATALOG_PENDING` |
| LP-006 | No health general con excepción operacional | Salud disabled-by-default; necesidad operacional sola no habilita excepción | `WORKING_DECISION_REVISED / HEALTH_COLLECTION_DISABLED_BY_DEFAULT` |
| LP-007 | Retención por propósito/evento sin períodos numéricos | Principio confirmado; matriz con trigger, duración, disposición, hold y owner obligatoria | `LEGAL_RETENTION_PRINCIPLE_CONFIRMED / NUMERIC_MATRIX_PREPILOT_REQUIRED` |
| LP-008 | Distinción delete/anonymize/block/archive/legal hold | Modelo legal soportado; procedimiento pendiente | `LEGAL_CONCEPT_MODEL_SUPPORTED / IMPLEMENTATION_PROCEDURE_PENDING` |
| LP-009 | Procedimiento manual/controlado/auditado | Requisitos identificados; procedimiento final y separación de soporte pendientes | `LEGAL_PROCEDURE_REQUIREMENTS_IDENTIFIED / FINAL_OPERATIONAL_PROCEDURE_PENDING` |
| LP-010 | Acceso/export controlado | Modelo aprobado; matriz legal final pendiente | `CONTROLLED_ACCESS_EXPORT_MODEL_APPROVED / FINAL_LEGAL_MATRIX_APPROVAL_PENDING` |
| LP-011 | Físico excepcional, digital oficial, devolución por defecto | Policy de producto aprobada; verificación de excepción sectorial pendiente | `PRODUCT_POLICY_APPROVED / SECTORAL_EXCEPTION_CHECK_PENDING` |
| LP-012 | Framework provider/transfer, sin selección final | Framework soportado; review específico por proveedor pendiente | `TRANSFER_FRAMEWORK_SUPPORTED / PROVIDER_SPECIFIC_REVIEW_PENDING` |
| LP-013 | Split técnico/controller/privacy | Requisitos de incidente identificados; runbook y owner final pendientes | `LEGAL_INCIDENT_REQUIREMENTS_IDENTIFIED / FINAL_RUNBOOK_APPROVAL_PENDING` |
| LP-014 | Working policy Q-106 definida | Policy refinada; procedimiento final pendiente | `WORKING_DECISION_REFINED / FINAL_Q106_PROCEDURE_PENDING` |
| LP-015 | Minimización, separación AuditEvent/SecurityEvent | Propósito/acceso aprobados; retención numérica pendiente | `PURPOSE_MINIMIZATION_ACCESS_MODEL_APPROVED / NUMERIC_RETENTION_PENDING` |

### Estado global posterior a LP3

`G5-LP3 = LEGAL_REVIEW_SYNTHESIS_COMPLETE / FINAL_EXTERNAL_LEGAL_VALIDATION_PENDING`.
`DESIGN_DECISION_GAP = CLOSED`; `PREPILOT_LEGAL_ARTIFACTS = OPEN`.
`G5-EXIT-11 = BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED`.
`C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING` y
`Q-106 = DEFERRED / PILOT PRECONDITION`. LP2 no autoriza implementación, datos reales,
piloto, producción, EduPay ni G5.
