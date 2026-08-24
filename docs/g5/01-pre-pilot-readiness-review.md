# G5-A — Pre-pilot readiness review

## Executive result

`G5_READINESS_REVIEW_COMPLETE / NOT_READY_TO_REQUEST_G5`

Esta revisión no aprueba G5, piloto, datos reales, producción ni integración técnica
EduPay. El cierre E5 permanece histórico: `COMPLETE / HUMAN REVIEW PASSED`.

La evidencia técnica/funcional acumulada es fuerte para la mayoría de los controles de
Admisión, pero no demuestra onboarding/verificación familiar como recorrido funcional
completo, no contiene evidencia de una operación autorizada de recovery y mantiene
abiertos monitoring/alerting/runbooks/incident response productivos, C-013 y la
autorización explícita y fechada del uso previsto.

## Scope y hechos de entrada

- HEAD inicial: `4b59c5ca60a61d1d448b34058f8c00952fa185b7`.
- Rama: `feat/e5-mvp`; working tree inicial limpio.
- PR #8: `OPEN / DRAFT / NO MERGE`.
- Sólo documentación de `docs/g5/**` se crea en G5-A.
- No se modifican `apps/**`, `packages/**`, Prisma schema, migrations, workflows, tests,
  runtime, configuración técnica, dependencias, endpoints, permisos, RLS ni
  `IntegrationHandoff`.
- Migration 15 continúa siendo la última y no existe Migration 16.
- Todos los artefactos E5 revisados declaran datos sintéticos/non-production.

## Fuentes y fuerza de evidencia

Fuentes primarias revisadas: [`docs/e4/10-g4-mvp-scope-and-exit.md`](../e4/10-g4-mvp-scope-and-exit.md),
[`docs/e5/00-e5-plan-and-status.md`](../e5/00-e5-plan-and-status.md),
[`docs/e5/01-e5a-intake-core-evidence.md`](../e5/01-e5a-intake-core-evidence.md) a
[`docs/e5/09-e5i-functional-handoff-g5-readiness-evidence.md`](../e5/09-e5i-functional-handoff-g5-readiness-evidence.md),
[`docs/e5/10-g5-readiness-package.md`](../e5/10-g5-readiness-package.md), y
[`docs/approvals/E5-mvp-functional-closure-2026-08-14.md`](../approvals/E5-mvp-functional-closure-2026-08-14.md).

También se contrastaron E4 completo, E2 `04`/`05`/`06`/`07`/`08`, E3 `08`, y E1
`07`/`08`/`09`/`11`/`12`/`13`/`14`/`15`, además de los tests y scripts versionados.

`DIRECT` significa que un test, run o documento operativo demuestra el control; `DERIVED`
significa que la conclusión resulta de varios artefactos directos; `DECLARATIVE_ONLY`
significa que sólo se encontró una afirmación; `MISSING` significa que no se encontró
evidencia. La clasificación del criterio puede ser un gap aunque otras subpartes tengan
evidencia directa.

## Matriz principal de los 12 criterios

| Criterion | Classification | Evidence strength | Key evidence | Residual/blocker | Required next action |
| --- | --- | --- | --- | --- | --- |
| G5-EXIT-01 | `EVIDENCE_GAP` | `DERIVED` | BL matrix below; E5-A..I; CI final `31832339969` | BL-002 onboarding/verification is only synthetic pre-authenticated context; BL-021 pilot values incomplete | Provide direct evidence for the functional account/verification boundary and close applicable pilot configuration |
| G5-EXIT-02 | `EVIDENCE_GAP` | `DERIVED` | AC matrix and E2E matrix below; suites 423/423 | AC-001 is not directly evidenced; E2E-001 ends at local functional handoff boundary | Execute/review the missing functional identity evidence and explicitly accept the E2E boundary |
| G5-EXIT-03 | `PASS` | `DERIVED` | API/worker/document/query/count/export map below; RLS 46/46 | No separate full-text search feature exists; implemented queries/reports are mapped | Preserve the mapped negative tests in future changes |
| G5-EXIT-04 | `PASS_WITH_RESIDUAL` | `DERIVED` | E4 `SES`/`AUTH`/`ELEV`/`AUD`; E5 HTTP/RLS; E5-H audit | Durable AuditEvent exists; SecurityEventSink remains non-durable in development and productive monitoring is not closed | Close productive security-event sink/monitoring under operations gate; do not conflate it with AuditEvent |
| G5-EXIT-05 | `PASS` | `DERIVED` | Session, capacity, offer, job, document and HND-04 map below | External idempotency/reconciliation is intentionally outside Q-301..Q-309 | Preserve DB constraints, locks, fencing and negative concurrency suites |
| G5-EXIT-06 | `PASS_WITH_RESIDUAL` | `DIRECT` | E5-C HTTP/RLS/storage/smoke and E5C-CON/LEASE tests | Storage and malware adapters are development-only; Q-106 remains unresolved for assisted identity/relationship policy | Define the approved pre-pilot provider/policy boundary and close Q-106 before pilot |
| G5-EXIT-07 | `EVIDENCE_GAP` | `DIRECT` | E4 `REC-01..REC-08`, local recovery smoke | Synthetic logical recovery passed, but no authorized operational execution, production object-storage recovery or confirmed owner is evidenced | Produce an authorized recovery exercise, runbook, outcome and owner; keep RPO/RTO as targets, not SLA |
| G5-EXIT-08 | `PASS_WITH_RESIDUAL` | `DERIVED` | E3 checklist; E5 UI snapshots, DOM review and detector `[]` | Design/manual review is evidenced; no dedicated automated WCAG suite or certification is reported | Complete the approved internal accessibility review and retain its result; do not call it certification |
| G5-EXIT-09 | `PASS_WITH_RESIDUAL` | `DIRECT` | E5-G communication tests and worker tests; failure invariant tests | State machine, retry, reminder and failure task use DevelopmentEmailAdapter; productive provider/final templates remain open | Close provider/configuration before pilot; preserve business-state invariant |
| G5-EXIT-10 | `BLOCKED` | `DERIVED` | E4 health/logging/deploy smoke; E4/E5 operational limits | Monitoring, alerting, runbooks, production ownership and incident response are not demonstrated | Human/operations owner must approve the operational package and evidence |
| G5-EXIT-11 | `BLOCKED` | `MISSING` | C-013 status and E1 legal checklist | Legal/normative owner, basis, notices, retention, deletion, rights and legal access/export validation remain open | Obtain the exact human/legal inputs listed below; G5-A does not resolve them |
| G5-EXIT-12 | `BLOCKED` | `MISSING` | E5/G4/CI statuses explicitly say NOT AUTHORIZED | No dated act authorizes real data, pilot or a specific environment | Create a separate dated authorization after the prior blockers are closed; do not create it here |

## G5-EXIT-01 — P0 and BL-001..BL-022

The table is a summarized audit, not a re-opening of each slice. `COVERED_WITH_BOUNDARY`
means the functional part is evidenced but a documented boundary remains. `NOT_PROVEN`
would mean no adequate evidence was found; no BL required that classification after the
review, but BL-002 and BL-021 retain boundaries that make the criterion an evidence gap.

| BL | Status | Evidence slice | Boundary/residual |
| --- | --- | --- | --- |
| BL-001 | `COVERED` | E4 POC-01..08; E5-A..I tenant/RLS suites; E5-H reports/export | Direct API, worker, document, query, count and export mapping below |
| BL-002 | `COVERED_WITH_BOUNDARY` | E5-A family/student/application ownership; E5-B snapshots; E4 opaque sessions | Functional tests start from synthetic authenticated primitives; registration, channel verification and Q-106 identity/relationship policy are not directly demonstrated |
| BL-003 | `COVERED` | E5-A offering validity/category tests and HTTP suite | Numeric capacity remains internal by design |
| BL-004 | `COVERED` | E5-B forms, version pinning, integrity tests and HTTP suite | Institutional purpose/catalog decisions remain subject to C-013/Q-104 |
| BL-005 | `COVERED` | E5-A/B submission/idempotency; E5-F withdrawal | Account onboarding is the BL-002 boundary, not the application state machine |
| BL-006 | `COVERED` | E5-C file, review, replacement, readiness and download suites | Productive provider/lifecycle remains open |
| BL-007 | `COVERED_WITH_BOUNDARY` | E5-C assistance and physical-document suites | Q-106 exact-identifier resolution is not a definitive verification policy |
| BL-008 | `COVERED` | E5-D activity/appointment/HTTP/RLS suites | Concrete pilot executors and duration remain configuration pending |
| BL-009 | `COVERED` | E5-D no-show, repeat, close, result and fencing suites | A later role-assignment refinement is recorded as non-blocking debt in E5-D |
| BL-010 | `COVERED` | E5-E recommendation versions and SoD tests | No invented score/ranking/algorithm |
| BL-011 | `COVERED` | E5-E direction versions and downstream effects | Communication downstream is E5-G |
| BL-012 | `COVERED` | E5-F capacity/reservation/concurrency suites | Numeric pilot capacities remain unconfigured |
| BL-013 | `COVERED` | E5-F waitlist order/promotion/privacy suites | Priority/tiebreaker configuration remains open if used |
| BL-014 | `COVERED` | E5-F offer/accept/decline/expiry/reopen/withdraw suites | Calendar is development Monday-Friday only |
| BL-015 | `COVERED_WITH_BOUNDARY` | E5-G lifecycle/worker/failure/retry/reminder tests | Development email adapter; productive provider and final institutional templates are not selected |
| BL-016 | `COVERED` | E5-G family projection and E5-A..I family HTTP tests | Family-safe projections omit internal deliberation and counts |
| BL-017 | `COVERED` | E5-G dashboard tests and wrong-tenant HTTP test | Operational alerting is outside this functional coverage |
| BL-018 | `COVERED` | E5-H allowlisted reports, CSV, HTTP and RLS suites | Legal export/rights validation remains C-013/Q-208 |
| BL-019 | `COVERED` | E4 authorization; E5-H RoleAssignment/elevation/negative tests | MFA policy Q-204 remains open |
| BL-020 | `COVERED` | E4 audit/security boundary; E5-H durable audit and pagination tests | SecurityEventSink productive durability/monitoring remains open |
| BL-021 | `COVERED_WITH_BOUNDARY` | E5-A/H configuration surfaces and E5-H matrix | Pilot-specific values, final texts, calendar, executors and roles are not fully populated |
| BL-022 | `COVERED_WITH_BOUNDARY` | E5-I HND-01..29, HTTP, RLS, 20-way idempotency and no-external-integration control | Functional handoff only; no technical EduPay integration, payload, webhook, retry or reconciliation |

## G5-EXIT-02 — AC-001..AC-058

| ID | Status | Evidence slice | Boundary/residual |
| --- | --- | --- | --- |
| AC-001 | `EVIDENCE_GAP` | E4 session primitives only | No direct registration/channel-verification flow; synthetic users are created by test primitives |
| AC-002 | `COVERED` | E5-A/B family ownership and anti-enumeration | Applies to implemented authenticated family context |
| AC-003 | `COVERED` | E5-A/B multi-student ownership and immutable snapshot tests | — |
| AC-004 | `COVERED` | E5-A validity/discovery tests | — |
| AC-005 | `COVERED` | E5-A categorical availability assertions | Exact capacity is intentionally not projected |
| AC-006 | `COVERED` | E5-A draft-start and warning behavior | — |
| AC-007 | `COVERED` | E5-B version pinning/integrity tests | — |
| AC-008 | `COVERED` | E5-B controlled optional/sensitive fields and submission tests | Legal purpose matrix remains C-013/Q-104 |
| AC-009 | `COVERED` | E5-B active-content rejection tests | — |
| AC-010 | `COVERED` | E5-C file lifecycle tests | — |
| AC-011 | `COVERED` | E5-C role/permission and HTTP tests | — |
| AC-012 | `COVERED_WITH_BOUNDARY` | E5-C due-date/readiness tests | Development business calendar; institutional holidays pending |
| AC-013 | `COVERED` | E5-C replacement/equivalence/exemption/history tests | Retention/deletion policy remains open |
| AC-014 | `COVERED_WITH_Q106_DEFERRED` | E5-C assisted session/snapshot tests | Exact identity/relationship verification policy not closed |
| AC-015 | `COVERED` | E5-C PHYSICAL_DOCUMENT pipeline tests | Physical paper retention/return remains legal/institutional pending |
| AC-016 | `COVERED` | E5-C no-elevation assistance tests | — |
| AC-017 | `COVERED_WITH_PILOT_CONFIGURATION` | E5-D appointment HTTP/UI tests | Concrete executors and duration remain TBD |
| AC-018 | `COVERED` | E5-D stale/current reschedule tests | — |
| AC-019 | `COVERED` | E5-D no-show tests | — |
| AC-020 | `COVERED` | E5-D manual close/result tests | — |
| AC-021 | `COVERED` | E5-D repeat/attempt/history tests | — |
| AC-022 | `COVERED` | E5-E recommendation tests | — |
| AC-023 | `COVERED` | E5-E capability denial/HTTP tests | — |
| AC-024 | `COVERED` | E5-E versioned correction/history tests | — |
| AC-025 | `COVERED` | E5-E/F downstream reserve/offer plus E5-G communication tests | — |
| AC-026 | `COVERED` | E5-E/F waitlist and safe family projection | — |
| AC-027 | `COVERED` | E5-E decision and E5-G communication projection | — |
| AC-028 | `COVERED` | E5-E SoD and permission-denial tests | — |
| AC-029 | `COVERED_WITH_PILOT_CONFIGURATION` | E5-F capacity create/read tests | Numeric course/year values are not registered |
| AC-030 | `COVERED` | E5-F versioned adjustment/audit tests | — |
| AC-031 | `COVERED` | E5-F last-seat concurrency tests | Durable DB invariant, not Promise.all alone |
| AC-032 | `COVERED_WITH_PILOT_CONFIGURATION` | E5-F default internal order/privacy tests | Special priorities/tiebreaker remain unconfigured |
| AC-033 | `COVERED` | E5-F manual promotion tests | — |
| AC-034 | `COVERED` | E5-F denial/HTTP tests | — |
| AC-035 | `COVERED` | E5-F expiry/release/history tests | — |
| AC-036 | `COVERED` | E5-F family offer projection tests | — |
| AC-037 | `COVERED` | E5-F expiry worker tests | Development calendar boundary |
| AC-038 | `COVERED` | E5-F acceptance/idempotency tests | Enables local functional handoff only |
| AC-039 | `COVERED` | E5-F reopen/version tests | — |
| AC-040 | `COVERED` | E5-G PREPARED/confirmation tests | Final institutional message remains configuration pending |
| AC-041 | `COVERED` | E5-G SENT/DELIVERED/FAILED lifecycle tests | Development email adapter |
| AC-042 | `COVERED` | E5-G failure task/business-state invariant tests | Productive provider remains open |
| AC-043 | `COVERED_WITH_PILOT_CONFIGURATION` | E5-G reminder and manual-contact tests | Exact lead time/template/sender pending |
| AC-044 | `COVERED` | E5-G dashboard metrics tests | — |
| AC-045 | `COVERED` | E5-G dashboard wrong-tenant and E5-H query tests | — |
| AC-046 | `COVERED` | E5-G projection/flow tests | — |
| AC-047 | `COVERED` | E5-H report/export/audit tests | Legal export validation remains open |
| AC-048 | `COVERED` | E5-H Secretary denial and zero-artifact tests | — |
| AC-049 | `COVERED` | E5-H allowlist/sensitivity/CSV tests | — |
| AC-050 | `COVERED` | E4 POC and E5-A..I API/RLS/HTTP negatives | Mapped by domain in G5-EXIT-03 |
| AC-051 | `COVERED` | E5-A/B family anti-enumeration tests | — |
| AC-052 | `COVERED` | E5-C/D/H sensitivity denial and audit tests | — |
| AC-053 | `COVERED` | E4/E5-H global superadmin without elevation tests | — |
| AC-054 | `COVERED` | E4/E5-H self-elevation scope/expiry/audit tests | — |
| AC-055 | `COVERED` | E5-I HND-01, HND-05..08, HND-19 | Local handoff boundary |
| AC-056 | `COVERED` | E5-I HND-02..04, HND-09, HND-15, HND-18 | No shared tables or technical provider |
| AC-057 | `COVERED_FUNCTIONAL_INVARIANT / TECHNICAL_CONTRACT_TRANSITIONS_DEFERRED_Q301_Q309` | E5-I HND-17/HND-23, migration seals and no-external-integration control | Q-301..Q-309 are future integration boundary, not automatically G5 blockers |
| AC-058 | `COVERED` | E5-F withdrawal/idempotency/release tests | — |

## E2E-001..E2E-022

| ID | Status | Evidence slice | Boundary/residual |
| --- | --- | --- | --- |
| E2E-001 | `COVERED hasta functional boundary` | E5-A..H plus E5-I HND-22 and handoff suites | Ends at local `IntegrationHandoff`; no matrícula/EduPay technical outcome presumed |
| E2E-002 | `COVERED` | E5-C observation/correction/history tests | — |
| E2E-003 | `COVERED` | E5-C replacement/equivalence/exemption tests | Retention/legal policy open |
| E2E-004 | `COVERED_WITH_Q106_DEFERRED` | E5-C assisted/physical-document tests | Exact identity/relationship verification policy open |
| E2E-005 | `COVERED` | E5-D appointment/reschedule HTTP tests | Pilot executor/duration config pending |
| E2E-006 | `COVERED` | E5-D first no-show tests | — |
| E2E-007 | `COVERED` | E5-D second no-show manual close tests | — |
| E2E-008 | `COVERED` | E5-D inconclusive/repeat tests | — |
| E2E-009 | `COVERED` | E5-E return-to-review/version tests | — |
| E2E-010 | `COVERED` | E5-E decision/E5-G communication tests | Final text/provider pending |
| E2E-011 | `COVERED` | E5-E/F waitlist/privacy tests | Priority config pending if used |
| E2E-012 | `COVERED` | E5-F promotion/acceptance plus E5-I regression | Local handoff boundary |
| E2E-013 | `COVERED` | E5-F waitlist offer expiry tests | — |
| E2E-014 | `COVERED` | E5-F withdrawal tests and E5-I HND-09 | — |
| E2E-015 | `COVERED` | E5-F normal offer expiry tests | — |
| E2E-016 | `COVERED` | E5-F reopen/version tests | — |
| E2E-017 | `COVERED_WITH_RESIDUAL` | E5-G failure/task/retry tests | Development email adapter; productive delivery not shown |
| E2E-018 | `COVERED` | E4/E5 RLS and HTTP cross-tenant tests | — |
| E2E-019 | `COVERED` | E4/E5 sensitivity tests | — |
| E2E-020 | `COVERED` | E4/E5 self-elevation tests | Productive security monitoring remains open |
| E2E-021 | `COVERED` | E5-H export minimization/audit tests | Legal export validation remains open |
| E2E-022 | `COVERED` | E5-H Secretary export denial tests | — |

## G5-EXIT-03 — Tenancy evidence map

| Control | Direct evidence | DB invariant | Service/API invariant | Evidence strength |
| --- | --- | --- | --- | --- |
| API isolation | E5-A/B/C/D/E/F/G/H/I real HTTP negatives: wrong membership, family, scope, capability, tenant and anti-enumeration | RLS/FORCE RLS and tenant-safe FKs | Tenant/resource resolved server-side; body/header tenant is not authority | `DIRECT` |
| Worker isolation | E4 POC-02; E5-C document worker; E5-F offer expiry worker; E5-G communication worker | Tenant-owned outbox/job rows and RLS | Worker claims topic/message and runs under owner tenant context | `DIRECT` |
| Document isolation | E5C-TEN-01..08, E5C-HTTP-02/12/18, document RLS | Tenant-safe composite FKs and RLS | Resource scopes derive from persisted application/offering/process/campus | `DIRECT` |
| Search/query isolation | E5-H report filter ownership, audit scope pagination, `E5H-HTTP-07`, `E5H-AUD-PAGE-05..08` | Query resources are tenant-bound before selection | Filters and audit scopes are checked server-side; no free-text global search is implemented | `DIRECT` |
| Count isolation | E5-G dashboard wrong-tenant tests; E5-H tenant-scoped report queries | RLS on source tables | Dashboard aggregates are calculated in tenant context | `DIRECT` |
| Export isolation | E5-H `E5H-HTTP-07`, report/RLS suites and AC-050 negatives | RLS and resource ownership checks | Allowlisted reports, tenant/scope filters, no arbitrary SQL/columns | `DIRECT` |
| Pooling/no context leak | E4 POC-05; E5-H RLS-06; E5-C/E5-D pooled context tests | Transaction-local GUC plus FORCE RLS | Context is required and cleared at transaction boundary | `DIRECT` |
| Cross-tenant insert/update denial | E4 POC-04; E5-C DB seals; E5-F RLS; E5-H RLS-02/04; E5-I RLS-01..06 | `WITH CHECK`, composite FKs, append-only grants | Wrong tenant/scope/capability produces deny/404/409 without business row | `DIRECT` |

**Conclusión:** `G5-EXIT-03 = PASS`. La cifra RLS `46/46` se usa como evidencia
conjunta, no como sustituto del mapa por dominio.

## G5-EXIT-04 — Seguridad

| Control | Evidence | Result |
| --- | --- | --- |
| Deny-by-default and permission catalog | E4 AUTH-01..06/10; E5-H permission catalog and negative HTTP | Direct pass |
| Server-side scopes/purpose/sensitivity | E4 AUTH-02..06; E5-C AUTH-01..10; E5-H report/audit scopes | Direct pass |
| Session lifecycle | E4 SES-01..16; E5 HTTP suites use opaque cookie sessions | Direct pass |
| CSRF and Origin/Referer | E4 SES-12; E5-A/B/D/E/F/G/H/I HTTP negative tests | Direct pass in development topology; multi-instance strategy is deferred |
| SELF-ELEVATION | E4 ELEV-01..08/PLAT-01..03/TRUST-01..08; E5-H HTTP-17/18 | Direct pass, tenant/scope/expiry limited |
| Durable AuditEvent | E5-H `PrismaAuditSink`, migration 14, append-only and pagination tests | Direct pass; separate from security sink |
| SecurityEventSink | E4 explicit constructor/sink boundary and awaited failures | Residual: development/non-durable sink; no productive monitoring claim |

`AuditEvent` durable y `SecurityEventSink` no son equivalentes. El sink de seguridad
productivo, alerting y monitoring pertenecen principalmente a `G5-EXIT-10`; su ausencia
no se convierte aquí en una afirmación de seguridad productiva.

## G5-EXIT-05 — Concurrency / consistency

| Domain | DB invariant | Service invariant | Direct tests/evidence |
| --- | --- | --- | --- |
| Sessions | Successor uniqueness and row-lock lifecycle | Rotation/revoke/resolve are transactional and old token becomes invalid | `SES-13..16`, `AUD-01..05` |
| Capacity last seat | Capacity/reservation uniqueness and transaction locks | Recalculate available capacity while locked; second approval conflicts | E5-F `RES-01..04`, `CON-01`, `E5EE-CON-02`, 20-way last-seat test |
| Offers accept/decline/withdraw/reopen | Expected version, terminal guards, unique acceptance/reservation | State transition is checked inside transaction; stale/terminal jobs no-op | E5-F `OFF-01..14`, `OFF-CON-01..02`, `WDR-01..07`, HTTP-01..19 |
| Jobs lease/reclaim/dedupe | Lease timestamps, attempts, idempotency key and terminal state | `FOR UPDATE SKIP LOCKED`, stale worker fencing, bounded retry/backoff | E5-C `E5C-LEASE-01..09`, E5-F `WRK-01..09`, E5-G worker `WRK-05..07` |
| Documents/review fencing | Tenant-safe version FKs and append-only reviews | `expectedDocumentVersionId` and row lock reject stale review | E5-C `E5C-CON-01..06`, `E5C-DB-01..03`, HTTP-15..18 |
| Handoff idempotency | Unique `tenantId + offerAcceptanceId` | Repeated valid requests converge to one local row | E5-I `HND-04`, `HND-18`, 20 concurrent requests |

The concurrency conclusions rely on database locks, constraints, leases and transactional
state assertions. `Promise.all` is only the request generator; it is not treated as the
durable guarantee.

## G5-EXIT-06 — Document security and Q-106

| Control | Evidence | Classification |
| --- | --- | --- |
| Private storage and quarantine | E5C-STO-01..06, E5C-SMOKE-01, HTTP-06/07; private filesystem adapter | Direct for development; productive object-storage provider missing |
| Upload authorization | E5C-AUTH, E5C-HTTP-01..04/13/14 | Direct |
| File versioning/history | E5C-REP, E5C-DB and submission tests | Direct |
| Sensitivity and permissions | E5C-AUTH-01..10; restricted list/read/review tests | Direct |
| Quarantine and malware adapter | Magic bytes, allowlist, scanner markers, `BLOCKED_*`, fail-closed transitions | Direct for development adapter only |
| Fail-closed behavior | E5C-WRK, E5C-LEASE, E5C-HTTP-05/06 and terminal monotonicity | Direct |
| Download/read authorization | READY-only, approved private area, permission/scope/purpose, audit and safe headers | Direct |

`Q-106 = RESIDUAL / PILOT PRECONDITION`: E5-C deliberately supports only narrow exact
identifier resolution and does not declare the definitive family identity/relationship and
exception policy. It is not a reason to erase the direct document-security evidence, but
it must be resolved before real-data or pilot operation. The productive storage/scanner
provider is a separate operational/provider decision; no provider is selected here.

## G5-EXIT-07 — Backup, restore and recovery

| Control | Evidence | Finding |
| --- | --- | --- |
| Backup | `pnpm e4:recovery:smoke`; `REC-01` logical `pg_dump` | Direct synthetic development evidence |
| Restore | `REC-02..04` into isolated PostgreSQL recovery base | Direct synthetic development evidence |
| Isolation after restore | `REC-05..07` role, RLS and no-context checks | Direct |
| Procedure | E4 recovery script and [`docs/e4/08-recovery-evidence.md`](../e4/08-recovery-evidence.md) | Documented, but not an approved production runbook |
| Outcome | `REC-01..08 = PASS`, observed `31.807 s` | Direct; not an RTO/SLA result |
| Authorized operation | No dated operational authorization or owner for a production-like exercise found | Missing; material evidence gap |
| Object storage recovery | E2 requirement remains conceptual; E5 uses development adapter | Missing for productive document bytes |

RPO 1h/RTO 4h remain initial technical targets, not contractual SLAs. The correct result
is `EVIDENCE_GAP`, not a production recovery claim.

## G5-EXIT-08 — Accessibility and responsive

| Evidence type | Evidence found | Finding |
| --- | --- | --- |
| Design-reviewed | E3 `08-accessibility-responsive.md`, E3 flows/checklist | WCAG 2.2 AA is a design target/checklist, not certification |
| Automated-tested | No dedicated automated accessibility runner/report is recorded | Residual evidence gap for automation, not a claim of failure |
| Manually-reviewed | E5-B desktop `1280×800` and mobile `390×844`; E5-H desktop/mobile review and detector `[]`; UI labels/focus/ARIA/reflow assertions | Direct internal review evidence |
| Responsive | Mobile and desktop snapshots/DOM evidence in E5 slices | Direct for reviewed surfaces; not a universal certification |

`G5-EXIT-08 = PASS_WITH_RESIDUAL`. The review must be described as internal design/manual
conformance evidence; it must not be called WCAG 2.2 AA certified.

## G5-EXIT-09 — Communications

| Control | Direct evidence | Business-state check |
| --- | --- | --- |
| PREPARED / human confirmation | E5-G `E5G-COM-01..05` and communication integration tests | No auto-send before confirmation |
| SENT / DELIVERED / FAILED | E5-G `E5G-COM-06..09`; delivery evidence required | SENT is not presented as DELIVERED |
| Failure task | E5G-COM-10..13 and `COMMUNICATION_FAILED` task | Direction remains `APROBADO`; offer remains `ACTIVE` |
| Retry/backoff | Communication worker `WRK-05..07`; E5-C lease patterns | Failure is technical, not an admission transition |
| Reminder | `E5G-REM-01..04`; active offer prepares reminder | ACCEPTED/WITHDRAWN suppress stale reminder |
| Stale no-op | Offer/retry/reminder service state checks and E5-F stale worker tests | No offer/reservation/waitlist/handoff mutation from stale reminder |
| Provider boundary | `DevelopmentEmailAdapter` only; no productive provider selected | Productive email and final institutional templates are pending |

`G5-EXIT-09 = PASS_WITH_RESIDUAL`. No productive provider is inferred from a green CI
run.

## G5-EXIT-10 — Operations submatrix

| Control | Implemented | Tested | Documented | Owner | Production-ready | G5 impact |
| --- | --- | --- | --- | --- | --- | --- |
| Liveness/health | Yes: `/health/live` | E4 deploy smoke and health specs | Yes | Technical owner from approved source | No, development only | Residual |
| Readiness/DB dependency | Yes: `/health/ready` with app role | E4 deploy smoke | Yes | Technical owner from approved source | No productive topology evidence | Residual |
| Structured/sanitized logging | Yes | Operational foundation tests and E5 regressions | Yes | Technical owner from approved source | Partial; destination/retention not selected | Residual |
| Audit signal | Yes: durable `AuditEvent` | E5-H audit/RLS/pagination tests | Yes | Institutional/technical reader not fully assigned | No legal retention/export closure | Residual / C-013 link |
| Security event signal | Boundary exists; productive durable sink absent | E4 sink contract tests | Yes, explicitly deferred | `UNASSIGNED` for productive security owner | No | Blocker through operations |
| Monitoring/metrics | Conceptual metric list only | No productive monitoring run found | E2 design only | `UNASSIGNED` | No | Blocker |
| Alerting | No selected or tested production alert channel | No | E2 design only | `UNASSIGNED` | No | Blocker |
| Runbooks | Recovery script/procedure exists; no approved incident/on-call runbook | No approved runbook exercise | Partial | `UNASSIGNED` | No | Blocker |
| Operational ownership | Technical development roles are traced; production/legal owner absent | No production handoff | Partial | `UNASSIGNED` for production | No | Blocker |
| Incident response | No approved response, notification or escalation procedure; Q-205 open | No | E4/E2 state the gap | `UNASSIGNED` | No | Blocker |
| Deployment smoke | Development compose smoke: API/web/worker/PostgreSQL and SIGTERM | `PASS` in E4; CI validates migrations/build | Yes | Technical owner from approved source | No production deployment | Residual |
| Recovery ownership | Synthetic recovery passed; owner/authorized operation absent | `REC-01..08` only | Partial | `UNASSIGNED` | No | Evidence gap and operations blocker |

`health` and `readiness` are not accepted as evidence of monitoring or alerting. The
criterion remains `BLOCKED` until the missing operational controls are decided, owned,
runbooked and evidenced at the appropriate gate.

## G5-EXIT-11 — Legal/privacy checklist

`C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.

No legal conclusion is emitted. The following exact human/legal inputs remain required
before this criterion can be considered for `PASS`:

| Required input | Current state | Required evidence owner |
| --- | --- | --- |
| Formal legal/normative owner | Not identified in reviewed closure | `UNASSIGNED` |
| Jurisdiction and legal basis/fundamento | Open Q-201 | `UNASSIGNED` |
| Applicable privacy notices and texts | Open; no final wording | `UNASSIGNED` |
| Purpose matrix by data/category/stage | Technical purpose fields exist; legal validation absent | `UNASSIGNED` |
| Data-minimization confirmation | Functional minimization is implemented; legal confirmation absent | `UNASSIGNED` |
| Retention matrix | Open Q-202; no legal periods | `UNASSIGNED` |
| Deletion/block/anonymization policy | Open; no policy | `UNASSIGNED` |
| Data-subject request procedure | Open Q-208; no procedure | `UNASSIGNED` |
| Legal validation of role/access matrix | Technical matrix exists; legal review absent | `UNASSIGNED` |
| Legal validation of exports | Technical allowlist exists; legal review absent | `UNASSIGNED` |
| Sensitive-data categories and handling | Functional categories exist; legal classification absent | `UNASSIGNED` |
| Consent/notice wording where applicable | Not approved | `UNASSIGNED` |
| Physical document retention/return | Explicitly pending | `UNASSIGNED` |

`G5-EXIT-11 = BLOCKED`. G5-A does not decide the legal basis, retain/delete data, or
approve wording.

## G5-EXIT-12 — Real data / pilot / environment authorization

The review found no separate dated act that authorizes all of the following:

| Authorization target | Evidence found | Result |
| --- | --- | --- |
| Real data | E4/E5/G5 documents explicitly say `NOT AUTHORIZED` | Missing |
| Pilot | E4/E5/G5 documents explicitly say `NOT AUTHORIZED` | Missing |
| Specific environment | Development is the only exercised environment; no pilot environment authorization | Missing |
| G5 approval/request | No G5 act; PR is still draft | Missing |

E5 completion, G4, institutional validation, E5 closure, CI success or PR approval are
not authorization. A future artifact sufficient for this criterion must be a separately
dated human decision naming issuer, tenant/scope, data class, pilot purpose, environment,
validity window, operational owner, rollback/stop conditions and legal/privacy approval
where applicable. G5-A must not create it.

## Pilot configuration pending

The following matrix separates pilot configuration from G5 gate criteria. `YES` means the
parameter applies to the described pilot; `TBD` means applicability itself is not yet
confirmed. `MUST_HAVE_BEFORE_G5` is `NO` unless the item is required to substantiate one
of the 12 exit criteria; `MUST_HAVE_BEFORE_PILOT` reflects the operational baseline.

| Configuration | Applies to pilot | Status | Owner | Must have before G5 | Must have before pilot | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Suplentes/delegaciones concretas | YES | `PENDING` | `UNASSIGNED` | NO | YES | Rules require separation; names/assignments are not registered |
| Ejecutor de entrevista | YES | `PENDING` | `UNASSIGNED` | NO | YES | Configurable by institution/offer/activity |
| Evaluador diagnóstico | YES | `PENDING` | `UNASSIGNED` | NO | YES | Configurable by institution/offer/activity |
| Duración por actividad | YES | `PENDING` | `UNASSIGNED` | NO | YES | No concrete minutes approved |
| Cupos numéricos por curso/año | YES | `PENDING` | `UNASSIGNED` | NO | YES | Capacity mechanics pass; values are not registered |
| Catálogo informe de personalidad | YES | `PENDING` | `UNASSIGNED` | NO | YES | Course/condition/equivalence/validity still open |
| Prioridades/desempates waitlist | TBD | `PENDING_IF_USED` | `UNASSIGNED` | NO | YES IF USED | Default order is entry; no special priority is approved |
| Textos de disponibilidad/waitlist | YES | `PENDING` | `UNASSIGNED` | NO | YES | Final institutional wording not approved |
| Plantillas email finales | YES | `PENDING` | `UNASSIGNED` | NO | YES | Lifecycle is tested; final content/version remains open |
| Remitente/horario email | YES | `PENDING` | `UNASSIGNED` | NO | YES | No productive sender/provider selected |
| Lead time de recordatorio de oferta | YES | `PENDING` | `UNASSIGNED` | NO | YES | Reminder behavior exists; anticipation is not defined |
| SLA operativos | YES | `PENDING` | `UNASSIGNED` | NO | YES | Review/appointment/decision values not fixed |
| Calendario institucional de días hábiles | YES | `PENDING` | `UNASSIGNED` | NO | YES | Development calendar is Monday-Friday only |
| Pauta de entrevista | YES | `PENDING` | `UNASSIGNED` | NO | YES | Controlled builder exists; concrete pilot rubric is not supplied |

These items do not silently become G5 blockers. They are pilot prerequisites unless their
finalization is needed to substantiate an exit criterion.

## Q-201..Q-210 — Open security/operation questions

| ID | Current status | Covered by implemented control? | Still requires decision? | G5 blocker? | Pilot blocker? | Future evolution? |
| --- | --- | --- | --- | --- | --- | --- |
| Q-201 | `OPEN / LEGAL_VALIDATION_PENDING` | Partial: purpose/minimization controls only | YES | YES via EXIT-11 | YES | YES |
| Q-202 | `OPEN / LEGAL_VALIDATION_PENDING` | Partial: no destructive policy; technical history retained | YES | YES via EXIT-11 | YES | YES |
| Q-203 | `OPEN / PROVIDER_RESIDENCY_PENDING` | Partial: private adapter boundary and no real provider | YES | YES via EXIT-06/10 operational boundary | YES | YES |
| Q-204 | `OPEN / MFA_POLICY_PENDING` | Partial: session/permission/elevation controls exist | YES | NO by itself; security control is residual | TBD/YES if policy requires it | YES |
| Q-205 | `OPEN / INCIDENT_OWNER_PENDING` | No productive incident/notification process | YES | YES via EXIT-10 | YES | YES |
| Q-206 | `OPEN / RPO_RTO_AVAILABILITY_PENDING` | Partial: synthetic recovery and initial targets | YES | YES via EXIT-07/10 evidence | YES | YES |
| Q-207 | `OPEN / VOLUME_CAPACITY_PENDING` | No load/peak evidence; functional limits exist | YES | NO by itself | YES before operating at pilot scale | YES |
| Q-208 | `OPEN / LEGAL_EXPORT_RIGHTS_PENDING` | Partial: technical audit/export minimization | YES | YES via EXIT-11 | YES | YES |
| Q-209 | `OPEN / STAFF_DEVICE_NETWORK_PENDING` | No institutional device/network validation | YES | NO by itself | YES | YES |
| Q-210 | `OPEN / EXTERNAL_SECURITY_TESTING_PENDING` | Internal negative tests exist; no external assessment | YES | NO by itself unless a human gate requires it | YES/TBD | YES |

No question is resolved in this review.

## Q-106 status

`Q-106 = DEFERRED; RESIDUAL / PILOT PRECONDITION.`

The implemented exact-identifier boundary is tested and fail-closed, but the definitive
verification of RUT, birth information, relationship and family exceptions is not
approved. This is not silently treated as solved and is not converted into a technical
provider decision.

## Q-301..Q-309 boundary

All remain `FUTURE_INTEGRATION_PENDING`. They are not automatically G5 blockers because
G5-EXIT-01/02 preserve BL-022 and AC-057 as a functional local boundary. They remain
outside pilot authorization unless a future decision explicitly expands the pilot to
technical EduPay integration.

| ID | Boundary preserved |
| --- | --- |
| Q-301 | External master system and identifiers |
| Q-302 | Contractual event/condition that starts technical handoff |
| Q-303 | Command/event/operation with EduPay |
| Q-304 | Contractual enrollment lifecycle |
| Q-305 | Minimum payload and transfer purpose |
| Q-306 | Interface, authentication, versioning and limits |
| Q-307 | SLA, retries, reconciliation and support |
| Q-308 | Expired offer/withdrawal after technical handoff |
| Q-309 | EduPay pre-payment state and enrollment-completed event |

## Risk summary

The detailed register is in [`02-blocker-and-decision-register.md`](02-blocker-and-decision-register.md).

| Risk class | Highest residuals | Gate impact |
| --- | --- | --- |
| Technical | Synthetic authenticated boundary; development storage/scanner/email adapters; non-durable productive security sink | EXIT-01/02/04/06/09 residual or evidence gap |
| Operational | No production monitoring, alerting, runbooks, incident owner or authorized recovery exercise | EXIT-07 evidence gap; EXIT-10 blocker |
| Privacy/legal | C-013, legal basis, retention, deletion, rights and legal export/access review | EXIT-11 blocker |
| Institutional/configuration | Pilot values and roles not populated; no explicit real-data/pilot/environment act | Pilot prerequisites; EXIT-12 blocker |

## Decision recommendation

Do not request or approve G5 from this review. First obtain human decisions/evidence for
the blocker register, then run a new review or approval gate with the resulting artifacts.
No remediation is started by G5-A.

## Addendum G5-BR — evidencia posterior de AC-001

El diagnóstico histórico de G5-B se remedia en la etapa acotada `G5-BR`; no se elimina
ni se reinterpreta como evidencia previa. La nueva evidencia directa está en
[`04-g5br-ac001-remediation-evidence.md`](04-g5br-ac001-remediation-evidence.md).

`AC-001`, `BL-002` y el inicio de `E2E-001` ahora tienen recorrido público real con
PostgreSQL/Nest, email de desarrollo/test, anti-enumeration, challenge hash/expiración/
consumo único, races y no creación de membership. La verificación de email sólo prueba
control del canal: no prueba identidad civil, parentesco, tutela ni facultad legal.

La propuesta de esta evidencia es reclasificar sólo `G5-EXIT-01/02` a
`PASS_WITH_RESIDUAL`, después de revisión humana. No se altera aquí `G5-EXIT-07`,
`G5-EXIT-10`, `G5-EXIT-11` ni `G5-EXIT-12`, y no se solicita G5.

## Addendum G5-BR2 — recovery passwordless y CI

`G5-BR2` inspeccionó `FR-ID-002`, `UC-FAM-001/002`, E4 session semantics y el runtime
actual. La evidencia directa permite proponer `FR-ID-002 =
DIRECTLY_COVERED_BY_PASSWORDLESS_RECOVERY`: una cuenta `ACTIVE` usa el mismo boundary
anti-enumerativo, recibe un challenge nuevo, lo consume una vez y obtiene una sesión
opaca válida. `SESSION_REVOCATION_ON_RECOVERY` queda `POLICY_NOT_DEFINED / RESIDUAL`
porque las fuentes exigen revocar según riesgo, pero no aprueban una regla para revocar
todas las sesiones.

Los cuatro tests HTTP y diez tests de servicio G5-BR2 pasan con PostgreSQL/Nest reales.
El smoke de Migration 16 también quedó agregado al workflow real, sin editar Migration 16
ni crear Migration 17. La clasificación propuesta para `G5-EXIT-01/02` permanece
`PASS_WITH_RESIDUAL`; `G5` continúa `NO APROBADA / NOT REQUESTED`.
