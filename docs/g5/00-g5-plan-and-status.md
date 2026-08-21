# G5-A — Plan y estado de revisión de readiness

## Control de entrada

| Campo | Estado verificado |
| --- | --- |
| Repositorio | `Sherydans12/Admision-Edupay` |
| Rama | `feat/e5-mvp` |
| HEAD inicial | `4b59c5ca60a61d1d448b34058f8c00952fa185b7` |
| Working tree inicial | `clean` |
| PR | `#8`, `OPEN`, `DRAFT`, `NO MERGE` |
| E5 technical reviewed HEAD | `a3286ee9e4565c33413e74fff3f30a3e325e3cd6` |
| Schema change G5-A | `NO` |
| Migration 15 | Última migration existente; intacta |
| Migration 16 | No existe |

El estado de entrada coincide con la autorización de G5-A. Este documento registra una
auditoría documental independiente; no es aprobación de G5.

## Estado de compuerta

| Elemento | Estado inicial | Estado al cierre de G5-A |
| --- | --- | --- |
| G5-A | `IN PROGRESS / PRE-PILOT READINESS REVIEW` | `COMPLETE / READINESS REVIEWED` |
| G5 | `NO APROBADA / NOT REQUESTED` | `NO APROBADA / NOT REQUESTED` |
| E5 | `COMPLETE / HUMAN REVIEW PASSED` | `COMPLETE / HUMAN REVIEW PASSED` |
| Datos reales | `NOT AUTHORIZED` | `NOT AUTHORIZED` |
| Piloto | `NOT AUTHORIZED` | `NOT AUTHORIZED` |
| Producción | `NOT AUTHORIZED` | `NOT AUTHORIZED` |
| Integración técnica EduPay | `NOT AUTHORIZED` | `NOT AUTHORIZED` |
| Readiness | En revisión | `NOT_READY_TO_REQUEST_G5` |

## Resultado

`G5_READINESS_REVIEW_COMPLETE / NOT_READY_TO_REQUEST_G5`

La recomendación se debe a tres bloqueadores explícitos y tres gaps materiales: operación
productiva incompleta (`G5-EXIT-10`), legal/privacy sin validación (`G5-EXIT-11`), falta de
autorización fechada (`G5-EXIT-12`), además de evidencia insuficiente para onboarding,
aceptación/E2E completa y recuperación autorizada (`G5-EXIT-01`, `G5-EXIT-02`,
`G5-EXIT-07`). Los criterios con deuda no bloqueante permanecen separados como
`PASS_WITH_RESIDUAL`.

## Fuentes y método

Se leyeron completas las fuentes canónicas indicadas para G5-A: alcance G4; plan y
evidencia E5-A..E5-I; paquete G5 existente; cierre humano E5; E4 completo; E2
multitenancy, archivos, concurrencia, auditoría/observabilidad/recuperación y deployment;
E3 accesibilidad; y E1 institucional, funcional, aceptación, E2E, backlog, diferidos y
configuración piloto. También se inspeccionaron los tests, smokes, workflow y migraciones
existentes. No se investigó legislación en Internet ni se emitieron conclusiones legales.

Cada criterio se clasificó exactamente como `PASS`, `PASS_WITH_RESIDUAL`, `EVIDENCE_GAP` o
`BLOCKED`. La fuerza de evidencia usa `DIRECT`, `DERIVED`, `DECLARATIVE_ONLY` o `MISSING`.
Una declaración en un documento E5 no fue aceptada por sí sola cuando no se encontró
artefacto directo o cuando el propio documento mantenía un límite abierto.

## Conteo de los 12 criterios

| Clasificación | Total |
| --- | ---: |
| `PASS` | 2 |
| `PASS_WITH_RESIDUAL` | 4 |
| `EVIDENCE_GAP` | 3 |
| `BLOCKED` | 3 |

## Compuerta siguiente

La siguiente acción humana es decidir, fuera de G5-A, cómo cerrar los items de
[`02-blocker-and-decision-register.md`](02-blocker-and-decision-register.md). G5-A no
selecciona proveedores, no asigna responsables no definidos, no resuelve C-013/Q-106 ni
Q-301..Q-309, no modifica código y no autoriza datos, piloto o producción.

## G5-BR — estado de remediación AC-001

La etapa correctiva `G5-BR` fue autorizada específicamente para `BL-002 / FR-ID-001 /
AC-001` y la entrada de `E2E-001`. Se implementó la migration 16, el recorrido público de
registro/verificación por email, el adapter de desarrollo/test, la prueba directa y la
composición start-to-boundary. La evidencia está en
[`04-g5br-ac001-remediation-evidence.md`](04-g5br-ac001-remediation-evidence.md).

Este addendum no cambia el cierre histórico de E5 ni aprueba G5. El estado actual sigue
siendo `G5 = NO APROBADA / NOT REQUESTED`, con `Q-106 = DEFERRED / PILOT PRECONDITION`,
`C-013 = LEGAL_VALIDATION_PENDING` y PR #8 `OPEN / DRAFT / NO MERGE`. La clasificación
propuesta para `G5-EXIT-01/02` es `PASS_WITH_RESIDUAL`, pendiente de revisión humana.

## G5-BR2 — recovery y prueba CI de Migration 16

La etapa acotada `G5-BR2` determina que el passwordless existente cubre directamente
`FR-ID-002`: `PATH A = RECOVERY_ALREADY_PRESENT / DIRECT_EVIDENCE_MISSING`, cerrado con
tests de servicio y boundary HTTP para cuenta `ACTIVE`, expiración, single-use, replay,
no enumeración y nueva `PlatformSession`. La evidencia está en
[`05-g5br2-recovery-and-ci-evidence.md`](05-g5br2-recovery-and-ci-evidence.md).

El workflow E4 ahora ejecuta el smoke G5-BR después de E5-I y antes del cleanup. Esto no
cambia el estado de `G5`, ni resuelve la política de revocación según riesgo, `Q-106`,
`C-013`, operaciones, autorización de piloto o EduPay.

## Addendum G5-OR1 — operational & recovery readiness

G5-OR1 agrega recovery coordinado sintético DB+objects, contrato de señales sanitizadas,
smokes reproducibles y runbooks. No introduce schema ni provider. La evidencia técnica
está en [`07-g5or-operational-recovery-evidence.md`](07-g5or-operational-recovery-evidence.md).
La propuesta es `G5-EXIT-07 = PASS_WITH_RESIDUAL`; `G5-EXIT-10` conserva
`BLOCKED / HUMAN_DECISION_REQUIRED` porque provider, destino de alertas y owner permanente
no están aprobados. `G5 = NO APROBADA / NOT REQUESTED`.

## Addendum G5-LP1 — factual privacy/legal readiness package (2026-08-15)

Este addendum es el estado canónico posterior a G5-OR1 para el paquete documental LP1.
No reabre ni modifica la evidencia histórica de etapas anteriores y no constituye una
aprobación de G5.

### Control de entrada verificado

| Control | Resultado |
| --- | --- |
| Branch | `feat/e5-mvp` |
| HEAD | `90b4a700cfa10c13b18d81a8266d6f31d4d319c5` |
| Working tree al inicio | `clean` |
| PR #8 | `OPEN / DRAFT / NO MERGE` |
| Migration 16 | `INTACT` |
| Migration 17 | `ABSENT` |

### Estado canónico

- `G5-OR1 = COMPLETE / TECHNICALLY ACCEPTED`.
- `G5-EXIT-07 = PASS_WITH_RESIDUAL`.
- `G5-EXIT-10 = BLOCKED / HUMAN_DECISION_REQUIRED`.
- `G5-EXIT-11 = BLOCKED / LEGAL_DECISIONS_REQUIRED`; LP1 no marca `PASS`.
- `G5-EXIT-12 = BLOCKED` y permanece sin autorización.
- `C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
- `Q-106 = DEFERRED / PILOT PRECONDITION`.

### Operational decisions approved, implementation deferred

Las siguientes decisiones humanas están registradas para la planificación operativa,
pero no se implementan ni configuran en G5-LP1:

- `TECHNICAL_INCIDENT_OWNER = BaseLogic / Nicolás`.
- `RECOVERY_OWNER = BaseLogic / Nicolás`.
- `MONITORING_MODEL = MANAGED_EXTERNAL`.
- `PRODUCTIVE_MONITORING_PROVIDER = GRAFANA_CLOUD`.
- `PRODUCTIVE_ALERT_DESTINATION_PRIMARY = EMAIL`.
- `PRODUCTIVE_ALERT_DESTINATION_IMMEDIATE = TELEGRAM`.
- `SECURITY_EVENT_PRODUCTIVE_DESTINATION = GRAFANA_CLOUD OBSERVABILITY STACK`.
- `SecurityEvent != AuditEvent`.
- Provider implementation status: `APPROVED / IMPLEMENTATION_DEFERRED_TO_PREPROD`.

El addendum anterior que describía estos puntos como no seleccionados queda superseded
únicamente para sus valores operacionales actuales; la implementación productiva,
región, retención y transferencia de datos siguen pendientes.

### LP1 deliverables and boundary

El paquete factual queda en:

- [`09-g5lp1-data-processing-inventory.md`](09-g5lp1-data-processing-inventory.md).
- [`10-g5lp1-access-export-rights-matrix.md`](10-g5lp1-access-export-rights-matrix.md).
- [`11-g5lp1-legal-decision-register.md`](11-g5lp1-legal-decision-register.md).

Los documentos contienen el inventario factual del runtime observado, las categorías,
finalidades, controles de menores/sensibles, acceso/exportación, retención técnica,
derechos como gap, proveedores y preguntas de decisión. No concluyen licitud, consentimiento, plazos legales,
cumplimiento ni autorización de datos.

`G5 = NO APROBADA / NOT REQUESTED`; `REAL DATA = NOT AUTHORIZED`; `PILOT = NOT
AUTHORIZED`; `PRODUCTION = NOT AUTHORIZED`.

## Addendum G5-LP2 — cierre de decisiones working (2026-08-16)

Este addendum registra la disposición posterior a LP1. No reescribe los estados históricos
de las etapas anteriores y no constituye aprobación de G5.

### Control de entrada de LP2

| Control | Resultado |
| --- | --- |
| Branch | `feat/e5-mvp` |
| HEAD inicial | `5c0edb4a5c26a596600a8ab6da79525d8d904cc8` |
| Working tree al inicio | `clean` |
| PR #8 | `OPEN / DRAFT / NO MERGE` |
| Migration 16 | `INTACT` |
| Migration 17 | `ABSENT` |

### Estado canónico LP2

- `G5-LP1 = COMPLETE / DOCUMENTARY PACKAGE ACCEPTED`.
- `G5-OR1 = COMPLETE / TECHNICALLY ACCEPTED`.
- `G5-EXIT-07 = PASS_WITH_RESIDUAL`.
- `G5-EXIT-10 = BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD`; LP2 no lo reabre.
- `G5-EXIT-11 = BLOCKED / FINAL_LEGAL_VALIDATION_REQUIRED`.
- `G5-EXIT-12 = BLOCKED`; no existe documento de autorización.
- `G5-LP2 = WORKING_DECISIONS_COMPLETE / FINAL_LEGAL_VALIDATION_PENDING`.
- `C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
- `Q-106 = DEFERRED / PILOT PRECONDITION`; working policy definida, no cerrada.
- `G5 = NO APROBADA / NOT REQUESTED`.
- `REAL DATA`, `PILOT` y `PRODUCTION` = `NOT AUTHORIZED`.
- `EDUPAY TECHNICAL INTEGRATION = NOT AUTHORIZED`.

Las decisiones LP-001..LP-015 fueron aprobadas humanamente como decisiones de trabajo en
Ronda A, B y C. Ninguna se marca `FINAL_LEGAL_APPROVED` o
`LEGAL_COMPLIANCE_CONFIRMED`. Los residuales incluyen validación final de bases y avisos,
controller/processor y DPA, Q-106, catálogo sensible y salud, retención numérica,
eliminación/anonimización/bloqueo, solicitudes de titulares, acceso/exportación,
documentos físicos, proveedores/transferencias, incidentes y logs.

### Compuerta siguiente

La siguiente acción humana es completar la validación final y aprobar los requisitos
LP2-PP-001..LP2-PP-015 antes de cualquier dato real o piloto. LP2 cierra el gap de diseño
humano, pero no el gate legal final ni la autorización G5.

## Addendum G5-LP3 — síntesis legal y artefactos prepiloto (2026-08-16)

Este addendum actualiza aditivamente el estado posterior a LP2. No reescribe LP1 ni LP2
como si hubieran contenido originalmente los refinamientos LP3 y no constituye aprobación
de G5.

### Estado canónico

- `G5-LP1 = COMPLETE / DOCUMENTARY PACKAGE ACCEPTED`.
- `G5-LP2 = COMPLETE / WORKING DECISIONS ACCEPTED`.
- `G5-OR1 = COMPLETE / TECHNICALLY ACCEPTED`.
- `G5-LP3 = LEGAL_REVIEW_SYNTHESIS_COMPLETE / FINAL_EXTERNAL_LEGAL_VALIDATION_PENDING`.
- `LP3_LEGAL_REVIEW_SYNTHESIS = COMPLETE`.
- `DESIGN_DECISION_GAP = CLOSED`.
- `PREPILOT_LEGAL_ARTIFACTS = OPEN`; existen 16 artefactos definidos, ninguno cerrado.
- `C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
- `Q-106 = DEFERRED / PILOT PRECONDITION`; policy refinada, procedimiento final pendiente.
- `G5-EXIT-07 = PASS_WITH_RESIDUAL`.
- `G5-EXIT-10 = BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD`; sin implementación LP3.
- `G5-EXIT-11 = BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED`.
- `G5-EXIT-12 = BLOCKED`.
- `G5 = NO APROBADA / NOT REQUESTED`.
- `REAL DATA`, `PILOT` y `PRODUCTION` = `NOT AUTHORIZED`.
- `EDUPAY TECHNICAL INTEGRATION = NOT AUTHORIZED`.

LP3 refina sólo las working decisions expresamente aprobadas en LP3-A y LP3-B: modelo
controller/processor, Q-106, health, base por finalidad, derechos, PIE/NEE, notice,
retención, delete/anonymize/block, acceso/exportación, físicos, proveedores, incidentes y
logs. La síntesis completa está en
[`13-g5lp3-legal-review-synthesis.md`](13-g5lp3-legal-review-synthesis.md) y el registro
finito en [`14-g5lp3-prepilot-legal-artifacts.md`](14-g5lp3-prepilot-legal-artifacts.md).

### Compuerta siguiente

La siguiente acción humana es completar y aprobar los 16 artefactos prepiloto. LP3 convierte
el blocker legal en una lista finita, pero no marca `G5-EXIT-11` como `PASS` ni autoriza
datos reales, piloto, producción o G5.

## Addendum G5-PC1 — configuración piloto y evaluación técnica (2026-08-16)

Este addendum registra la etapa documental `G5-PC1D`. No reescribe LP3 como si hubiera
contenido originalmente las decisiones PC1 y no constituye aprobación de G5.

### Estado canónico PC1

- `G5-LP3 = COMPLETE / TECHNICALLY & DOCUMENTARILY ACCEPTED` como estado canónico de
  entrada de PC1; las etiquetas históricas previas de LP3 se conservan.
- `PC1-A = HUMAN APPROVED`.
- `PC1-B = HUMAN APPROVED`.
- `PC1-C = HUMAN APPROVED`.
- `G5-PC1 = PILOT_CONFIGURATION_POLICY_DEFINED / TECHNICAL_GAP_ASSESSMENT_COMPLETE`.
- `Q-106 = DEFERRED / PILOT PRECONDITION`; policy operacional definida, procedimiento
  final pendiente.
- La evaluación técnica contiene `0 IMPLEMENTED`, `8 PARTIAL` y `7 NOT_IMPLEMENTED`
  entre `PC1-TECH-001..015`; no hay `CONFIGURATION_ONLY`, `EVIDENCE_GAP` ni
  `NOT_APPLICABLE` primarios.
- `PREPILOT_LEGAL_ARTIFACTS = OPEN — 16 / 16`; ningún artefacto se cierra por PC1.

La evidencia, límites y remediation groups están en
[`15-g5pc1-pilot-configuration-and-q106-decisions.md`](15-g5pc1-pilot-configuration-and-q106-decisions.md)
y [`16-g5pc1d-technical-gap-assessment.md`](16-g5pc1d-technical-gap-assessment.md).
No se modifican runtime, schema, migraciones, tests, dependencias, workflows ni
providers. `MIGRATION_17_AUTHORIZED = NO`.

El encabezado histórico de este documento conserva controles de entradas anteriores
(incluido el HEAD histórico y `Migration 16 = No existe`). El control runtime/git de
PC1 verificó `HEAD = 991654b4eaf518f44ce2f5d2daf2a6b979c3e3f0`, Migration 16 intacta y
Migration 17 ausente; la discrepancia queda registrada en el documento PC1 y no se
reescribe el histórico.

### Gate disposition

`C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`;
`G5-EXIT-10 = BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD`;
`G5-EXIT-11 = BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED`;
`G5-EXIT-12 = BLOCKED`; `G5 = NO APROBADA / NOT REQUESTED`; datos reales, piloto,
producción e integración técnica EduPay siguen `NOT AUTHORIZED`.

## Addendum G5-PC1-R12 — núcleo técnico de autoridad (2026-08-16)

R12 implementó autoridad explícita tenant/application-scoped, ruta adulta, historial,
evidencia privada y gates de submit/accept/handoff. La evidencia está en
[`17-g5pc1r12-authority-adult-core.md`](17-g5pc1r12-authority-adult-core.md).

- `PC1-TECH-001`, `002`, `004`, `005`, `006` = `IMPLEMENTED / PENDING_HUMAN_TECHNICAL_REVIEW`.
- `PC1-TECH-003` = `NOT_IMPLEMENTED / DEFERRED_TO_PC1-R4`; `007..015` no cambian.
- `Q-106 = TECHNICAL_CORE_IMPLEMENTED / FINAL_INSTITUTIONAL_LEGAL_PROCEDURE_PENDING / PILOT_PRECONDITION`.
- `LP3-ART-006`, `C-013`, `G5-EXIT-10`, `G5-EXIT-11` y `G5-EXIT-12` no cambian.
- G5, datos reales, piloto, producción y EduPay technical integration siguen `NOT AUTHORIZED`.

## Addendum G5-PC1-R12H — endurecimiento de evidencia directa de autoridad (2026-08-20)

R12H cierra exclusivamente el gap de evidencia directa de PC1-R12 mediante:
1. Suite de integración dedicada `packages/database/src/application-authority.integration.spec.ts` (61 pruebas aprobadas: `R12-AUTH-01..18`, máquina de estados, transición de 18 años, `R12-SUB-01..10`, `R12-OFFER-01..08`, `R12-HANDOFF-01..08` y evidencia documental).
2. Suite HTTP dedicada `apps/api/src/application-authority.http.integration.spec.ts` (9 pruebas HTTP aprobadas).
3. Smokes y RLS (`pnpm test:rls` y `pnpm g5pc1r12:migration:smoke`) verificados al 100%.
4. Migration 17 permanece inmutable; Migration 18 ausente; PC1-TECH-003 permanece `NOT_IMPLEMENTED / DEFERRED_TO_PC1-R4`; `PC1-TECH-007..015` fuera de alcance; `Q-106`, `LP3-ART-006`, `C-013`, `G5-EXIT-10..12`, G5, piloto, datos reales y EduPay permanecen sin cambio.

## Addendum G5-PC1-R4 — categorías de procesamiento sensible y fail-closed builder/documents (2026-08-20)

PC1-R4 implementa el diseño humano aprobado PC1-R4A para separar sensibilidad técnica de categoría semántica/de procesamiento:

1. **Schema (Migration 18):** enum `ProcessingCategory` (4 valores), enum `DocumentClassification` (2 valores), columna `processing_category` en `form_fields` y `document_requirement_versions`, columna `document_classification` en `document_requirement_versions`, tabla `sensitive_processing_policies` con RLS/FORCE.
2. **Política fail-closed:** `HEALTH` y `PIE_NEE_DIAGNOSTIC` deshabilitadas por defecto. Publicación denegada si categoría deshabilitada. `HIGHLY_RESTRICTED` sin categoría explícita → publicación denegada. `PERSONALITY_DEVELOPMENT_REPORT` deshabilitado por defecto.
3. **Authority ≠ processing authorization:** la autoridad R12 verificada no habilita categorías deshabilitadas.
4. **Auditoría:** enable/disable de categorías sensibles produce `AuditEvent` duradero.
5. **Suite dedicada:** `packages/database/src/sensitive-processing.integration.spec.ts` (23 pruebas: clasificación, política, builder, authority, personality, security, cross-tenant).
6. **Migration smoke:** `scripts/g5pc1r4-migration-smoke.mjs` (fresh 0→18 + incremental 17→18).

### Disposición PC1-TECH

| ID | Estado post-R4 |
| --- | --- |
| `PC1-TECH-003` | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` |
| `PC1-TECH-010` | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` |
| `PC1-TECH-011` | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` |
| `PC1-TECH-012` | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` |

### Sin cambio

- `PC1-TECH-007..009`, `013..015` fuera de alcance.
- `Q-106` sigue `TECHNICAL_CORE_IMPLEMENTED / FINAL_INSTITUTIONAL_LEGAL_PROCEDURE_PENDING / PILOT_PRECONDITION`.
- `LP3-ART-006` sigue `OPEN`.
- `C-013` sigue `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
- `G5-EXIT-10`, `G5-EXIT-11`, `G5-EXIT-12` = `BLOCKED`.
- G5, datos reales, piloto, producción y EduPay = `NOT AUTHORIZED`.
- Migration 17 inmutable; Migration 19 ausente.

## Addendum G5-PC1-R4H — cierre de evidencia requerida y UX de tratamiento sensible (2026-08-21)

G5-PC1-R4H completa la evidencia directa y la interfaz mínima autorizada:
1. **Suite PostgreSQL RLS dedicada:** `packages/database/src/sensitive-processing.rls.integration.spec.ts` (8 pruebas aprobadas: `R4-RLS-01..08`, aislamiento por tenant, denegación sin contexto, fuerza de RLS y rol `admission_app`).
2. **Suite HTTP dedicada:** `apps/api/src/sensitive-processing.http.integration.spec.ts` (12 pruebas aprobadas: `R4-HTTP-01..12`, lectura/escritura de políticas, validación de publicación fail-closed, gates de submit y envelopes de error).
3. **Suite de integración ampliada:** `packages/database/src/sensitive-processing.integration.spec.ts` (37 pruebas aprobadas: `R4-CAT-*`, `R4-POL-*`, `R4-PUB-*`, `R4-AUTH-01..07`, `R4-PER-01..06`, `R4-DOC-01..05`, `R4-SEC-01..03`).
4. **Frontend Staff/Admin y Family:**
   - Form Builder (`apps/web/app/form-workflows.tsx`): selector de `processingCategory`, avisos de política y guard fail-closed.
   - Document Requirements (`apps/web/app/document-workflows.tsx`): selectores de `processingCategory` y `documentClassification`.
   - Workspace administrativo de tratamiento sensible (`apps/web/app/sensitive-processing-workflows.tsx` y `page.tsx`).
5. **Smokes:** `pnpm g5pc1r4:migration:smoke` (Fresh 0→18 PASS, Incremental 17→18 PASS, Seals PASS). Migration 18 inalterada; Migration 19 ausente.

## Addendum G5-PC1-R4H2 — corrección de guard de captura sensible y propósito obligatorio (2026-08-21)

G5-PC1-R4H2 resuelve de manera definitiva el hallazgo de revisión humana independiente sobre la captura sensible en tiempo de ejecución:
1. **Guard central de captura sensible (`assertSensitiveProcessingAllowedForApplicationField`):**
   - Función de dominio reutilizable y centralizada invocada antes de persistir respuestas no nulas a campos con categoría `HEALTH` o `PIE_NEE_DIAGNOSTIC`.
   - Exige concurrentemente: (A) categoría sensible efectivamente habilitada para el tenant (`SensitiveProcessingValidationError("PROCESSING_CATEGORY_DISABLED")`), y (B) `ApplicationAuthority` válida y verificada para el estudiante/familia (`ApplicationAuthorityConflictError`).
   - `ORDINARY_ADMISSION` y `SUPPORT_ACCOMMODATION` preservan su comportamiento directo sin fricción.
   - En captura asistida, el operador staff no sustituye al principal familiar; la autoridad familiar sobre la postulación es evaluada estrictamente.
   - Eliminación / vaciado de respuestas (`value = null` o whitespace) permitido sin atrapar datos sensibles.
2. **Invariante de propósito obligatorio:**
   - La habilitación de `HEALTH` o `PIE_NEE_DIAGNOSTIC` exige `purpose` no nulo, no vacío y <= 200 caracteres tanto a nivel de dominio (`SensitiveProcessingService.updatePolicy`) como a nivel de API HTTP (`updatePolicySchema`).
   - La deshabilitación permite `purpose: null`.
3. **Frontend fail-closed (`apps/web/app/form-workflows.tsx`):**
   - Si una categoría sensible está deshabilitada a nivel de tenant, los campos correspondientes muestran un aviso visual informativo, quedan deshabilitados para edición y son excluidos del payload de persistencia.
4. **Evidencia automatizada directa:**
   - `packages/database/src/sensitive-processing.integration.spec.ts`: 47/47 pruebas aprobadas (`R4-AUTH-01..07` directos con comprobación en DB, `R4-ASSISTED-01`, `R4-REG-01..02`, `R4-PUR-01..05`, `R4-CLR-01`, `R4-CAT-*`, `R4-POL-*`, `R4-PUB-*`, `R4-PER-*`, `R4-DOC-*`, `R4-SEC-*`).
   - `apps/api/src/sensitive-processing.http.integration.spec.ts`: 13/13 pruebas HTTP aprobadas (`R4-HTTP-01..13`).
   - `packages/database/src/sensitive-processing.rls.integration.spec.ts`: 8/8 pruebas RLS aprobadas (`pnpm test:rls` total 55/55 pruebas).
   - `pnpm g5pc1r4:migration:smoke`: Fresh 0→18 = PASS, Incremental 17→18 = PASS, Seals = PASS.
   - `pnpm test`: 40 suites, 601/601 pruebas aprobadas.
5. **Invariantes arquitectónicas preservadas:**
   - Migration 17 inmutable.
   - Migration 18 inalterada.
   - Migration 19 ausente.
   - Sin nuevas categorías de datos.

## Addendum G5-PC1-R4H3 — UX de eliminación de respuestas sensibles deshabilitadas (2026-08-21)

G5-PC1-R4H3 cierra el micro-ajuste de UX en el flujo familiar de postulación:
1. **Comportamiento UX de campos sensibles deshabilitados:**
   - Si un campo sensible (`HEALTH` o `PIE_NEE_DIAGNOSTIC`) está deshabilitado por política institucional y **no contiene respuesta previa**: muestra únicamente el aviso de bloqueo fail-closed sin input activo.
   - Si dicho campo **contiene una respuesta previamente persistida**: muestra aviso seguro explicativo (*"Esta información fue registrada anteriormente, pero esta categoría ya no está habilitada. Debes eliminar la respuesta guardada para continuar."*) y ofrece la acción explícita *"Eliminar respuesta guardada"*.
   - **Privacidad y minimización:** no se muestra ni expone el valor sensible almacenado dentro del aviso ni en el formulario.
   - **Acción explícita:** al accionar la eliminación, envía `PUT /answers` con `value = null`, actualiza el estado local de respuestas y desbloquea el flujo de envío de postulación.
2. **Evidencia automatizada directa:**
   - Suite HTTP directa `apps/api/src/sensitive-processing.http.integration.spec.ts`: 14/14 pruebas aprobadas (incluyendo `R4-CLEAR-HTTP-01`).
   - `WEB_BEHAVIORAL_AUTOMATED_TEST = EVIDENCE_GAP / NO_EXISTING_HARNESS`.
   - `pnpm --filter @admission/web typecheck` y `pnpm --filter @admission/web build`: 100% PASS.

### Disposiciones canónicas

| ID | Estado canónico |
| --- | --- |
| `PC1-R12` | `COMPLETE / TECHNICALLY_ACCEPTED` |
| `PC1-TECH-001` | `IMPLEMENTED / TECHNICALLY_REVIEWED` |
| `PC1-TECH-002` | `IMPLEMENTED / TECHNICALLY_REVIEWED` |
| `PC1-TECH-004` | `IMPLEMENTED / TECHNICALLY_REVIEWED` |
| `PC1-TECH-005` | `IMPLEMENTED / TECHNICALLY_REVIEWED` |
| `PC1-TECH-006` | `IMPLEMENTED / TECHNICALLY_REVIEWED` |
| `Q-106` | `TECHNICAL_CORE_IMPLEMENTED / FINAL_INSTITUTIONAL_LEGAL_PROCEDURE_PENDING / PILOT_PRECONDITION` |
| `PC1-R4` | `IMPLEMENTED / DIRECT_EVIDENCE_COMPLETE / MINIMUM_UX_COMPLETE / PENDING HUMAN FINAL REVIEW` |
| `PC1-TECH-003` | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` |
| `PC1-TECH-010` | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` |
| `PC1-TECH-011` | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` |
| `PC1-TECH-012` | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` |
