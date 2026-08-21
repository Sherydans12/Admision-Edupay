# G5-A — Blocker and decision register

Este registro contiene sólo items que requieren acción o una decisión humana. No autoriza
G5, datos reales, piloto, producción ni integración técnica EduPay. `UNASSIGNED` se usa
cuando las fuentes revisadas no identifican un owner suficiente.

| ID | Category | Related G5 criterion | Description | Current state | Decision/Artifact required | Owner | Can BaseLogic resolve alone? | Must involve institution? | Must involve legal/privacy owner? | Blocking G5? | Blocking pilot? | Blocking production? | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G5-DEC-001 | PRIVACY/LEGAL | G5-EXIT-11 | C-013 remains legal validation pending | Institutional validation exists; legal/normative closure absent | Dated legal/privacy decision covering basis, notices, purpose, minimization, categories and access | `UNASSIGNED` | NO | YES | YES | YES | YES | YES | `OPEN / BLOCKED` |
| G5-DEC-002 | PRIVACY/LEGAL | G5-EXIT-11 | Retention, deletion/block/anonymization, rights requests and physical document handling are unresolved | Technical history and minimization exist; policy absent | Approved retention/deletion/DSR/physical-document matrix and procedure | `UNASSIGNED` | NO | YES | YES | YES | YES | YES | `OPEN / BLOCKED` |
| G5-DEC-003 | OPERATIONS | G5-EXIT-10 | Monitoring, alerting, runbooks and incident response are not evidenced | Health/logging/development smoke exist; productive controls absent | Operational package with selected controls, alert routes, runbooks, escalation and incident owner; no provider selected in G5-A | `UNASSIGNED` | NO | YES | NO | YES | YES | YES | `OPEN / BLOCKED` |
| G5-DEC-004 | OPERATIONS/RECOVERY | G5-EXIT-07, G5-EXIT-10 | Synthetic authorized recovery exercise is closed; only preprod/productive/provider evidence remains residual | `REC-01..08 PASS`; synthetic authorized recovery exercise = `CLOSED`; recovery owner = `DECIDED` (`BaseLogic / Nicolás`) | Preprod/productive/provider recovery evidence and any corresponding authorized validation | `BaseLogic / Nicolás` | NO | YES | NO | YES (residual) | YES | YES | `OPEN / RESIDUAL` |
| G5-DEC-005 | AUTHORIZATION | G5-EXIT-12 | Real data, pilot and specific environment have no explicit dated authorization | All remain `NOT AUTHORIZED` | Separate dated human authorization naming scope, environment, data class, owner and stop conditions | `UNASSIGNED` | NO | YES | YES if real personal data is in scope | YES | YES | YES | `OPEN / BLOCKED` |
| G5-DEC-006 | FUNCTIONAL/EVIDENCE | G5-EXIT-01, G5-EXIT-02, G5-EXIT-06 | Registration/channel verification and definitive Q-106 family identity/relationship policy are not evidenced/closed | Tests use synthetic pre-authenticated primitives; exact-identifier assistance boundary only | Direct functional onboarding/verification evidence and an institutional Q-106 operating rule; no external provider assumed | `UNASSIGNED` | NO | YES | MAYBE, depending on data/policy scope | EXIT-01/02 evidence gap; not separately counted as a G5 authorization | YES | YES | `OPEN / EVIDENCE_GAP / PILOT PRECONDITION` |
| G5-DEC-007 | PROVIDER/OPERATIONS | G5-EXIT-06, G5-EXIT-09 | Object storage, malware and email productive adapters/providers remain unselected | Development filesystem/scanner/email adapters are tested and fail closed where applicable | Human provider/residency/security decision plus productive adapter validation; Q-203 remains open | `UNASSIGNED` | NO | YES | YES if residency/data processing is affected | Residual in EXIT-06/09; may block operational G5 package | YES | YES | `OPEN / DECISION REQUIRED` |
| G5-DEC-008 | SECURITY/OPERATIONS | G5-EXIT-04, G5-EXIT-10 | SecurityEventSink is separated from durable AuditEvent but productive durable sink/alerting is not closed | Explicit development/non-durable boundary; no productive monitoring claim | Decide and evidence the security-event destination, retention/access and alert path within the operations package | `UNASSIGNED` | NO | YES | MAYBE, for retention/residency | Residual in EXIT-04; blocker through EXIT-10 | YES | YES | `OPEN / DECISION REQUIRED` |
| G5-DEC-009 | INSTITUTIONAL CONFIGURATION | G5-EXIT-01, G5-EXIT-02, G5-EXIT-09 | Pilot concrete values are pending: roles/substitutes, executors, durations, capacities, catalog, texts, sender/schedule, reminder lead time, SLAs, calendar and interview rubric | Functional configuration surfaces exist; values are not fully supplied | Completed pilot configuration matrix and responsible institutional approval | `UNASSIGNED` | NO | YES | NO, except data/legal text items | NO by itself | YES | YES | `OPEN / PILOT CONFIGURATION PENDING` |

## Items explicitly excluded from this register

- `Q-301..Q-309`: remain future EduPay integration boundary; G5-A does not decide them.
- `Q-201..Q-210`: detailed status is in the readiness review; this register only carries the
  action items that affect a current gate.
- No code vulnerability is fixed here. A technical defect discovered later must be a
  separate corrective stage, classified as `EVIDENCE_GAP` or `BLOCKED`.

## Human decisions requested after G5-A

1. Assign the legal/privacy and production operational owners.
2. Decide the C-013 package and retain the supporting legal/institutional artifacts.
3. Decide whether and how Q-106 must be operationally resolved before pilot.
4. Close the operational evidence package and authorized recovery exercise.
5. Issue, only after those decisions, a separate dated authorization for real data,
   pilot and the exact environment.

## Addendum G5-BR

`G5-DEC-006` conserva la pregunta institucional sobre Q-106 y la condición de piloto.
La parte técnica de registro y verificación de canal de AC-001 ya tiene evidencia directa
en [`04-g5br-ac001-remediation-evidence.md`](04-g5br-ac001-remediation-evidence.md):
email, anti-enumeration, challenge one-time, concurrencia, auditoría minimizada y no
escalamiento tenant. Esto no resuelve identidad civil, relación guardian/estudiante ni
la autorización de piloto.

El estado humano de `G5-DEC-006` no se cierra automáticamente. La revisión puede
considerar `G5-EXIT-01/02 = PASS_WITH_RESIDUAL`, mientras `Q-106 = DEFERRED / PILOT
PRECONDITION`, `C-013 = LEGAL_VALIDATION_PENDING` y los items operacionales/autorización
permanecen abiertos.

## Addendum G5-BR2

La evidencia de `G5-BR2` cubre técnicamente la parte de recuperación de acceso de
`FR-ID-002` mediante el flujo passwordless existente. Esto no cierra `G5-DEC-006`:
`EMAIL_ACCOUNT_VERIFIED` sigue separado de identidad civil, parentesco, tutela y
facultad legal (`Q-106`).

Se agrega como residual explícito la política no definida de revocación al recuperar:
`SESSION_REVOCATION_ON_RECOVERY = POLICY_NOT_DEFINED / RESIDUAL`. No se revocan todas las
sesiones sin una decisión aprobada. El proveedor productivo, operaciones, C-013 y la
autorización de piloto permanecen abiertos.

## Addendum G5-OR1

`G5-DEC-004`: synthetic authorized recovery exercise (DB + APPROVED/QUARANTINE objects,
manifest, hashes, RLS y cleanup) = `CLOSED`; `RECOVERY_OWNER = DECIDED`
(`BaseLogic / Nicolás`). Sólo la evidencia preprod/productiva/provider queda residual.

`G5-DEC-003`: contrato de señales, evaluación determinista y runbooks quedan
`CLOSED / TECHNICAL PASS`. `PRODUCTIVE_MONITORING_PROVIDER`,
`PRODUCTIVE_ALERT_DESTINATION` e `INCIDENT_OWNER` permanecen
`HUMAN_DECISION_REQUIRED`; por ello G5-EXIT-10 no se marca cerrado.

`G5-DEC-008`: SecurityEvent continúa separado de AuditEvent. Hay candidatos sanitizados
provider-neutral, pero `SECURITY_EVENT_PRODUCTIVE_SINK = HUMAN_PROVIDER_DECISION_REQUIRED`.

## Addendum G5-LP1 — canonical operational and legal/privacy status (2026-08-15)

Este addendum actualiza aditivamente el estado posterior a G5-OR1. No cierra los items
legales ni cambia los estados históricos que no contradigan las decisiones operacionales
aprobadas más abajo.

### Operational decisions now approved

- `TECHNICAL_INCIDENT_OWNER = BaseLogic / Nicolás`.
- `RECOVERY_OWNER = BaseLogic / Nicolás`.
- `MONITORING_MODEL = MANAGED_EXTERNAL`.
- `PRODUCTIVE_MONITORING_PROVIDER = GRAFANA_CLOUD`.
- `PRODUCTIVE_ALERT_DESTINATION_PRIMARY = EMAIL`.
- `PRODUCTIVE_ALERT_DESTINATION_IMMEDIATE = TELEGRAM`.
- `SECURITY_EVENT_PRODUCTIVE_DESTINATION = GRAFANA_CLOUD OBSERVABILITY STACK`.
- `SecurityEvent != AuditEvent`.
- Implementation status: `APPROVED / IMPLEMENTATION_DEFERRED_TO_PREPROD`.

No se implementan Grafana, Telegram, email productivo, object storage productivo ni
malware provider en G5-LP1.

### Current decision states

- `G5-DEC-001` and `G5-DEC-002` remain `OPEN / BLOCKED`: the factual package is now
  available in [`09-g5lp1-data-processing-inventory.md`](09-g5lp1-data-processing-inventory.md),
  [`10-g5lp1-access-export-rights-matrix.md`](10-g5lp1-access-export-rights-matrix.md) and
  [`11-g5lp1-legal-decision-register.md`](11-g5lp1-legal-decision-register.md), but no
  legal/privacy approval has been issued.
- `G5-DEC-003` remains blocking `G5-EXIT-10`: operational technology/destinations are
  selected, while implementation, productive configuration and evidence are deferred to
  preprod; `G5-EXIT-10 = BLOCKED / HUMAN_DECISION_REQUIRED`.
- `G5-DEC-004`: synthetic authorized recovery exercise = `CLOSED`; recovery owner =
  `DECIDED` (`BaseLogic / Nicolás`); only preprod/productive/provider evidence remains
  residual.
- `G5-DEC-006` remains `OPEN / EVIDENCE_GAP / PILOT PRECONDITION`; `Q-106` is not closed.
- `G5-DEC-007` remains open for productive object storage, malware scanning and email;
  only the future monitoring/alert selections above are approved.
- `G5-DEC-008` records the separate SecurityEvent/AuditEvent boundary and future Grafana
  destination; implementation and retention/access decisions remain deferred.
- `G5-DEC-005` remains unchanged: no real-data, pilot or production authorization.

### Gate disposition

`G5-EXIT-11 = BLOCKED / LEGAL_DECISIONS_REQUIRED`; `C-013 = INSTITUTIONALLY_VALIDATED /
LEGAL_VALIDATION_PENDING`; `G5-EXIT-12 = BLOCKED` and unchanged. This register does not
mark any gate `PASS` and does not authorize G5, real data, pilot or production.

## Addendum G5-LP2 — disposition de bloqueadores (2026-08-16)

LP2 cierra la brecha de decisiones humanas de diseño, pero no cierra la validación legal
final ni la autorización. Los estados históricos de este registro se preservan; la
disposición siguiente es la lectura canónica posterior a LP2.

| Item | Disposición LP2 | Estado/implicación actual |
| --- | --- | --- |
| `G5-DEC-001` | LP-001..LP-006 definen working model de controller/processor, bases candidatas, notice, menores, PIE/NEE y health | Permanece `OPEN / BLOCKED` hasta validación jurídica final, DPA, textos y catálogos |
| `G5-DEC-002` | LP-007..LP-011 definen working policy de retención, delete/anonymize/block, solicitudes, acceso/exportación y físico | Permanece `OPEN / BLOCKED` hasta matrices numéricas, procedimientos y validación final |
| `G5-DEC-003` | Se conservan monitoring gestionado, Grafana Cloud, Email y Telegram como elecciones operativas aprobadas | `G5-EXIT-10 = BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD`; no se reabre ni implementa en LP2 |
| `G5-DEC-004` | Recovery sintético y owner siguen cerrados; LP2 no altera el residual productivo/preprod | Mantiene residual de evidencia preprod/productiva/provider |
| `G5-DEC-005` | LP2 no emite autorización | `OPEN / BLOCKED`; datos reales, piloto y producción siguen `NOT AUTHORIZED` |
| `G5-DEC-006` | LP-014 define working policy de Q-106 y separa email verificado de autoridad guardian | `Q-106 = DEFERRED / PILOT PRECONDITION`; no se marca `CLOSED` |
| `G5-DEC-007` | LP-012 define política de proveedor y validación específica; Grafana/alertas operativas permanecen diferidas | Productivo object storage, malware y email siguen no seleccionados; validación provider-specific pendiente |
| `G5-DEC-008` | LP-015 conserva `SecurityEvent != AuditEvent`, destino futuro Grafana y minimización | Retención/acceso final e implementación productiva siguen pendientes |
| `G5-DEC-009` | LP2 no modifica configuración funcional del piloto | Permanece `OPEN / PILOT CONFIGURATION PENDING` |

### Disposición de gate

`G5-LP2 = WORKING_DECISIONS_COMPLETE / FINAL_LEGAL_VALIDATION_PENDING`.
`G5-EXIT-11 = BLOCKED / FINAL_LEGAL_VALIDATION_REQUIRED`; no se marca `PASS` ni
`PASS_WITH_RESIDUAL`. `C-013` sigue `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
`G5-EXIT-12 = BLOCKED` y no existe autorización para G5, datos reales, piloto,
producción o integración técnica EduPay.

## Addendum G5-LP3 — refinamiento de bloqueadores (2026-08-16)

LP3 no reescribe los estados históricos. Registra que la revisión humana legal/privacy
cerró la brecha de diseño y convirtió el blocker legal en un paquete finito de 16
artefactos, todos todavía abiertos.

| Item | Disposición LP3 | Estado/implicación actual |
| --- | --- | --- |
| `G5-DEC-001` | LP-001, LP-002 y LP-003 soportan el modelo legal de trabajo, el framework por finalidad y los requisitos de notice | Permanece abierto por validación contractual, DPA, clasificación final y textos aprobados; cubierto por `LP3-ART-001..005` |
| `G5-DEC-002` | LP-005..LP-011 refinan categorías sensibles, salud, retención, derechos, acceso/exportación y físicos | Permanece abierto por catálogos, matriz numérica, procedimientos y aprobaciones; cubierto por `LP3-ART-006..013` |
| `G5-DEC-003` | La tecnología/destinos operativos de LP1/LP2 se mantienen aprobados con implementación diferida | `G5-EXIT-10 = BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD`; LP3 no implementa providers |
| `G5-DEC-004` | Recovery sintético y owner se mantienen cerrados; LP3 no altera residual preprod/productivo | Residual operativo/provider permanece vigente |
| `G5-DEC-005` | LP3 no emite autorización fechada | `OPEN / BLOCKED`; datos reales, piloto y producción siguen `NOT AUTHORIZED` |
| `G5-DEC-006` | LP-004/LP-014 refinan Q-106 con declaraciones explícitas y verificación antes de boundary sensible/final | `Q-106 = DEFERRED / PILOT PRECONDITION`; procedimiento final pendiente, cubierto por `LP3-ART-006` |
| `G5-DEC-007` | LP-012 soporta el framework de transferencias, sin seleccionar proveedores | Revisión por proveedor, DPA, subencargados, región, residencia y seguridad pendiente; `LP3-ART-014` |
| `G5-DEC-008` | LP-015 aprueba minimización/propósito/acceso y mantiene `AuditEvent != SecurityEvent` | Retención numérica y matriz de acceso pendientes; `LP3-ART-016` |
| `G5-DEC-009` | LP3 no modifica configuración funcional del piloto | Permanece `OPEN / PILOT CONFIGURATION PENDING` |

### Disposición de gate

`G5-LP3 = LEGAL_REVIEW_SYNTHESIS_COMPLETE / FINAL_EXTERNAL_LEGAL_VALIDATION_PENDING`.
`DESIGN_DECISION_GAP = CLOSED`; `PREPILOT_LEGAL_ARTIFACTS = OPEN`.
`G5-EXIT-11 = BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED`, sin `PASS` ni
`PASS_WITH_RESIDUAL`. `G5-EXIT-12` sigue `BLOCKED` y `G5-EXIT-10` sigue
`BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD`.

## Addendum G5-PC1 — configuración y gaps técnicos (2026-08-16)

PC1 registra ahora, por aprobación humana de esta etapa, `PC1-A = HUMAN APPROVED`,
`PC1-B = HUMAN APPROVED` y `PC1-C = HUMAN APPROVED`. El resultado documental es
`G5-PC1 = PILOT_CONFIGURATION_POLICY_DEFINED / TECHNICAL_GAP_ASSESSMENT_COMPLETE`.

La evaluación `PC1-TECH-001..015` concluye `0 IMPLEMENTED`, `8 PARTIAL` y
`7 NOT_IMPLEMENTED`. Los gaps están detallados en
[`16-g5pc1d-technical-gap-assessment.md`](16-g5pc1d-technical-gap-assessment.md),
con propuestas acotadas de remediación que no están autorizadas para ejecución en
PC1D. En particular, la evaluación confirma que el runtime no tiene autoridad Q-106,
camino adulto >=18, gates de autoridad en submit/acceptance/handoff, exclusiones de
calendario, expiración local a 23:59, reminder programado, defaults policy-level de
datos sensibles ni gate de capacidad al publicar.

`Q-106 = DEFERRED / PILOT PRECONDITION`; la policy operacional está definida, pero el
procedimiento final y `LP3-ART-006` permanecen pendientes. `LP3-ART-007` y
`LP3-ART-008` siguen abiertos; la evaluación técnica no cierra el catálogo sensible ni
la verificación de defaults deshabilitados.

El input institucional pendiente —personas primary/backup, evaluadores, capacidades,
fechas excluidas, mailbox, templates y activación de informe de personalidad— no
bloquea el desarrollo técnico, pero sí la operación piloto donde corresponda.

No se autoriza Migration 17, schema/runtime/test changes, providers, workflows ni
integración EduPay. Se mantienen `G5-EXIT-10 = BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD`,
`G5-EXIT-11 = BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED`, `G5-EXIT-12 = BLOCKED`,
`G5 = NO APROBADA / NOT REQUESTED`, y datos reales/piloto/producción
`NOT AUTHORIZED`.

## Addendum G5-PC1-R12 — disposición post-implementación (2026-08-16)

| Item | Disposición R12 | Implicación |
| --- | --- | --- |
| `G5-DEC-006` / Q-106 | Autoridad explícita por tenant/postulación, evidencia privada y gates críticos | No cierra procedimiento institucional/legal; `LP3-ART-006` sigue abierto |
| `PC1-TECH-001/002/004/005/006` | `IMPLEMENTED / PENDING_HUMAN_TECHNICAL_REVIEW` | Requieren revisión humana de evidencia técnica |
| `PC1-TECH-003` | `NOT_IMPLEMENTED / DEFERRED_TO_PC1-R4` | No hay gate genérico de datos sensibles |
| `G5-DEC-005/007` | Sin cambio | Sin datos reales, piloto, producción ni providers |

`G5-EXIT-10`, `G5-EXIT-11` y `G5-EXIT-12` continúan `BLOCKED`; G5 y la integración
técnica EduPay siguen fuera de alcance.

## Addendum G5-PC1-R12H — evidencia directa cerrada (2026-08-20)

| Item | Disposición R12H | Implicación |
| --- | --- | --- |
| Evidencia directa de autoridad (`PC1-TECH-001/002/004/005/006`) | `DIRECT_EVIDENCE_COMPLETE / 61 Integration Tests + 9 HTTP Tests PASS` | Gap de evidencia de testing directo cerrado para revisión humana |
| `PC1-TECH-003` | `NOT_IMPLEMENTED / DEFERRED_TO_PC1-R4` | Fuera de alcance en R12H |
| `PC1-TECH-007..015` | `OUT_OF_SCOPE` | Fuera de alcance en R12H |
| `Q-106` / `LP3-ART-006` | `OPEN / PILOT_PRECONDITION` | Procedimiento legal e institucional definitivo permanece abierto |
| `C-013` / `G5-EXIT-10..12` | `BLOCKED / NOT REQUESTED` | G5, datos reales, piloto, producción y EduPay permanecen `NOT AUTHORIZED` |

## Addendum G5-PC1-R4 — categorías de procesamiento sensible (2026-08-20)

| Item | Disposición R4 | Implicación |
| --- | --- | --- |
| `PC1-TECH-003` (gating tratamiento sensible) | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` | ProcessingCategory + publish/submission guards |
| `PC1-TECH-010` (health disabled by default) | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` | HEALTH category fail-closed |
| `PC1-TECH-011` (PIE/NEE disabled by default) | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` | PIE_NEE_DIAGNOSTIC category fail-closed |
| `PC1-TECH-012` (personality report) | `IMPLEMENTED / PENDING HUMAN FINAL REVIEW` | PERSONALITY_DEVELOPMENT_REPORT classification |
| Migration 18 | `AUTHORIZED / APPLIED` | `20260820090000_g5pc1r4_sensitive_processing` |
| Migration 19 | `ABSENT / NOT AUTHORIZED` | No migration adicional |
| `Q-106` / `LP3-ART-006` / `C-013` | `SIN CAMBIO` | Procedimiento legal e institucional permanece abierto |
| `G5-EXIT-10..12` / G5 | `BLOCKED / NOT REQUESTED` | Gates permanecen bloqueados |
