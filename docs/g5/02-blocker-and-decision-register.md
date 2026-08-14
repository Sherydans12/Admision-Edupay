# G5-A — Blocker and decision register

Este registro contiene sólo items que requieren acción o una decisión humana. No autoriza
G5, datos reales, piloto, producción ni integración técnica EduPay. `UNASSIGNED` se usa
cuando las fuentes revisadas no identifican un owner suficiente.

| ID | Category | Related G5 criterion | Description | Current state | Decision/Artifact required | Owner | Can BaseLogic resolve alone? | Must involve institution? | Must involve legal/privacy owner? | Blocking G5? | Blocking pilot? | Blocking production? | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G5-DEC-001 | PRIVACY/LEGAL | G5-EXIT-11 | C-013 remains legal validation pending | Institutional validation exists; legal/normative closure absent | Dated legal/privacy decision covering basis, notices, purpose, minimization, categories and access | `UNASSIGNED` | NO | YES | YES | YES | YES | YES | `OPEN / BLOCKED` |
| G5-DEC-002 | PRIVACY/LEGAL | G5-EXIT-11 | Retention, deletion/block/anonymization, rights requests and physical document handling are unresolved | Technical history and minimization exist; policy absent | Approved retention/deletion/DSR/physical-document matrix and procedure | `UNASSIGNED` | NO | YES | YES | YES | YES | YES | `OPEN / BLOCKED` |
| G5-DEC-003 | OPERATIONS | G5-EXIT-10 | Monitoring, alerting, runbooks and incident response are not evidenced | Health/logging/development smoke exist; productive controls absent | Operational package with selected controls, alert routes, runbooks, escalation and incident owner; no provider selected in G5-A | `UNASSIGNED` | NO | YES | NO | YES | YES | YES | `OPEN / BLOCKED` |
| G5-DEC-004 | OPERATIONS/RECOVERY | G5-EXIT-07, G5-EXIT-10 | Recovery evidence is synthetic and not tied to an authorized operation or confirmed owner | `REC-01..08 PASS`; no authorized exercise/owner | Dated authorized recovery exercise, result, runbook, scope, owner and object-storage recovery evidence where applicable | `UNASSIGNED` | NO | YES | NO | YES (evidence gap) | YES | YES | `OPEN / EVIDENCE_GAP` |
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
