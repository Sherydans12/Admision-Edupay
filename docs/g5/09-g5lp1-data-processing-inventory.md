# G5-LP1 — Inventario factual de tratamiento de datos

## Control, alcance y método

| Campo | Estado |
| --- | --- |
| Paquete | `G5-LP1 / DOCUMENTARY + SYSTEM INVENTORY ONLY` |
| Resultado | `G5-EXIT-11 = BLOCKED / LEGAL_DECISIONS_REQUIRED` |
| G5 | `NO APROBADA / NOT REQUESTED` |
| Datos reales | `NOT AUTHORIZED` |
| Piloto | `NOT AUTHORIZED` |
| Producción | `NOT AUTHORIZED` |
| Naturaleza | Inventario factual; no emite conclusiones jurídicas |
| Fecha de revisión | `2026-08-15` |

Este documento describe lo que el runtime actual puede almacenar, procesar, proyectar,
auditar o enviar mediante sus adapters de desarrollo/CI. No determina responsable legal,
base jurídica, consentimiento, plazo legal, cumplimiento ni aplicabilidad de derechos.

### Clasificación de evidencia

- **Hecho confirmado:** observado en `schema.prisma`, servicios, controladores, adapters,
  pruebas o documentación que describe el runtime actual.
- **Decisión aprobada:** decisión humana registrada para G5-OR1, sin implementación
  productiva en esta etapa.
- **Supuesto de trabajo:** agrupación documental necesaria para describir un flujo; no
  agrega una entidad ni un dato al producto.
- **Pregunta abierta:** punto que requiere decisión institucional, legal/privacy u
  operacional.

Runtime prevalece sobre una descripción conceptual cuando difieren. En particular, no se
inventarían `GuardianRelationship`, identificadores civiles, fecha de nacimiento, un
modelo de salud, `WaitlistPrioritySnapshot` o `IntegrationSyncState`: no están presentes
como entidades del schema actual. El formulario dinámico sí permite campos con sensibilidad
`restricted` o `highly_restricted`; la evidencia de PIE/NEE se limita a campos sintéticos
de pruebas y configuración dinámica, no a un catálogo institucional real.

## Fuentes revisadas

### Fuentes funcionales e institucionales

- `docs/e1/07-institutional-validation-baseline.md`
- `docs/e1/08-pilot-operational-rules.md`
- `docs/e1/09-pilot-configuration-matrix.md`
- `docs/e1/11-functional-specification.md`
- `docs/e1/12-acceptance-criteria.md`
- `docs/e1/15-deferred-and-out-of-scope.md`

### Fuentes de arquitectura y readiness

- `docs/e2/03-logical-data-model.md`
- `docs/e2/04-multitenancy-authorization-architecture.md` (equivalente factual de la
  ruta solicitada `docs/e2/03-authorization-model.md`, que no existe)
- `docs/e2/05-files-security-architecture.md` (equivalente factual de la ruta solicitada
  `docs/e2/04-data-storage-and-files.md`, que no existe)
- `docs/e2/07-audit-observability-recovery.md`
- `docs/e2/08-deployment-and-environments.md`
- `docs/e2/10-threat-model.md`
- `docs/g5/00-g5-plan-and-status.md`
- `docs/g5/01-pre-pilot-readiness-review.md`
- `docs/g5/02-blocker-and-decision-register.md`
- `docs/g5/06-g5or-operational-recovery-plan.md`
- `docs/g5/08-g5or-incident-and-recovery-runbook.md`

### Runtime y schema

- `packages/database/prisma/schema.prisma`
- `packages/database/src/permission-catalog.ts`
- `packages/database/src/authorization.ts`
- `packages/database/src/account-registration.ts`
- `packages/database/src/session-service.ts`
- `packages/database/src/intake.ts`
- `packages/database/src/forms.ts`
- `packages/database/src/documents.ts`
- `packages/database/src/assistance.ts`
- `packages/database/src/activities.ts`
- `packages/database/src/recommendation.ts`
- `packages/database/src/capacity-offer.ts`
- `packages/database/src/communications.ts`
- `packages/database/src/family-projection.ts`
- `packages/database/src/reporting.ts`
- `packages/database/src/functional-handoff.ts`
- `packages/database/src/dashboard.ts`
- `packages/database/src/audit.ts`
- `packages/database/src/security-events.ts`
- `packages/database/src/operational-signals.ts`
- `packages/database/src/operational-adapters.ts`
- `packages/database/src/email-adapter.ts`
- `packages/database/src/identity-email-adapter.ts`
- `packages/database/src/structured-logger.ts`
- `apps/api/src/request-context.service.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/*controller.ts` y servicios API correspondientes

## Inventario por dato

Los campos de ejemplo son nombres reales del schema/runtime o una descripción directa del
payload dinámico observado. `EXPORTABLE` describe el comportamiento técnico actual, no una
conclusión sobre el derecho legal a exportar.

| DATA_ID | DOMAIN | DATA_CATEGORY | EXAMPLE_FIELDS | PERSON_CONCERNED | MINOR_DATA | SENSITIVE_OR_HIGHLY_RESTRICTED | COLLECTION_SOURCE | FUNCTIONAL_PURPOSE | MANDATORY_OR_OPTIONAL | VISIBILITY | AUTHORIZED_ROLES | AUDITED_ACCESS | EXPORTABLE | CURRENT_STORAGE | CURRENT_RETENTION_RULE | CURRENT_DELETION_RULE | CURRENT_ANONYMIZATION_RULE | CURRENT_DATA_SUBJECT_RIGHTS_SUPPORT | EXTERNAL_PROVIDER_OR_TRANSFER | OPEN_DECISION | SOURCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DPI-001 | Platform identity | Platform identity and account status | `emailNormalized`, `status`, `emailVerifiedAt`, timestamps | Adult responsible or staff/platform user | NO | YES — restricted | `/auth/register`, `/auth/verify`, identity service | Account access and account lifecycle | Registration channel required; other profile data not present | Identity service; not exposed as a general family/staff listing | Authenticated account owner; platform identity service; support only through approved elevation where applicable | YES — registration/activation events; ordinary profile read not exposed | NO — no subject export route | PostgreSQL `platform_users` | `NOT_DEFINED`; status transitions and verification timestamps are technical state | No subject deletion endpoint observed; relational cascade exists in schema but is not a user-facing policy | `NOT_DEFINED` | PARTIAL — account can be activated and session issued; no formal rights request workflow | Development identity email adapter only; no productive provider | Formal responsible party, notice and account data policy | `schema.prisma` `PlatformUser`; `account-registration.ts`; `identity.controller.ts` |
| DPI-002 | Platform identity | Verification challenges | `normalizedChannelHash`, `verifierHash`, `purpose`, `expiresAt`, `consumedAt`, `supersededAt`, `attempts` | Adult responsible or staff/platform user attempting registration | NO | YES — security-restricted; raw challenge is not persisted | Registration request and email challenge flow | Verify control of an email channel | Conditional on account registration | Not returned to family/staff; raw challenge delivered only by identity adapter | Identity service; account owner receives only the challenge channel | YES — success, replay, expiry and rejected attempts are recorded; security sink is non-durable in current API wiring | NO | PostgreSQL `account_verification_challenges`; raw challenge only in development adapter memory/tests | Technical `expiresAt`, one-time consumption and supersession; no cleanup period defined | No purge job or rights deletion route observed | `NOT_DEFINED` | NOT_IMPLEMENTED as a formal request workflow | Development identity email adapter; no network delivery | Challenge cleanup, security-log retention and provider policy | `schema.prisma` `AccountVerificationChallenge`; `account-registration.ts`; `identity-email-adapter.ts` |
| DPI-003 | Platform identity | Session metadata | `tokenHash`, `issuedAt`, `lastSeenAt`, `idleExpiresAt`, `absoluteExpiresAt`, `revokedAt`, `rotatedFromSessionId` | Adult responsible or staff/platform user | NO | YES — security-restricted | Login/verification and authenticated requests | Maintain authenticated account access | Conditional after verification | Raw cookie/token is not returned by data APIs; server-side session resolution only | Session service; account owner through session actions | YES — issue, rotate and revoke events; no general session-history UI | NO | PostgreSQL `platform_sessions`; raw token only in HttpOnly cookie at runtime | Technical idle/absolute expiry and revocation; legal retention `NOT_DEFINED` | No user-facing purge route; no session purge policy observed | `NOT_DEFINED` | PARTIAL — logout/revocation is technical, not a rights procedure | No external provider | Session retention and recovery revocation policy | `schema.prisma` `PlatformSession`; `session-service.ts`; `request-context.service.ts` |
| DPI-004 | Platform / tenant | Memberships and role assignments | `tenantId`, `userId`, `status`, `roleKey`, `permissions`, `scopes`, `startsAt`, `endsAt` | Staff/platform user; institution as tenant context | NO | YES — restricted | Institutional access administration | Grant scoped tenant capabilities | Conditional by institutional administration | Tenant administration and access service; not family projection | Explicit assignment capabilities; Institutional Admin/Maximum Admin only if configured; platform support via elevation for tenant content | YES — create/update/revoke actions write `AuditEvent` | NO — no general export route | PostgreSQL `memberships`, `role_assignments` | `NOT_DEFINED`; vigency/status fields are technical | Revoke changes status/end date; hard deletion policy `NOT_DEFINED` | `NOT_DEFINED` | NOT_IMPLEMENTED as a subject-rights workflow | No external provider | Role governance, access review and legal access approval | `schema.prisma`; `access-admin.ts`; `reporting-admin.controller.ts` |
| DPI-005 | Family | Family profile and responsible adult contact channel | `FamilyProfile.displayName`; linked `PlatformUser.emailNormalized`; no phone field observed | Adult responsible | NO | YES — restricted | Family profile endpoint; account registration email | Identify the family account and contact channel | Profile display name optional/managed; email required for account channel | Family owner; staff only through an application/assistance context where exposed | Family user; staff with explicit application/assistance permissions; support elevation only within scope | NO for ordinary family self-read; YES for assisted changes/audit events | NO — no family self-export route | PostgreSQL `family_profiles` plus `platform_users` | `NOT_DEFINED`; profile updates preserve current row only | Update is supported; deletion/blocking request procedure absent | `NOT_DEFINED` | PARTIAL — read/write self-service, no formal request tracking | Development identity/communication adapters may receive email in synthetic flows | Phone, civil identifiers, notice and guardian policy | `schema.prisma` `FamilyProfile`/`PlatformUser`; `intake.ts`; `request-context.service.ts` |
| DPI-006 | Family / Admission | Student identity and course-related context | `givenName`, `familyName`; course comes from `AdmissionOffering.courseLevelId`; no RUT or birth date field observed | Student; normally a minor in the admission journey | YES | YES — restricted; highly restricted status is field-dependent, not fixed in model | Family student endpoints and application selection | Identify the student and relate an application to an offering/course | Name required for student creation; course context required by application | Family owner; authorized tenant application context; family projection exposes given name and course label | Family user; staff with application scope; support elevation only if explicitly scoped | NO for family self-read; YES for restricted staff actions where audit path exists | PARTIAL — staff reports include student name columns; no subject export route | PostgreSQL `students`, `applications`, `admission_offerings` | `NOT_DEFINED`; snapshots/history preserve application facts | Update student is supported; no deletion request route; application withdrawal is a business state, not erasure | `NOT_DEFINED` | PARTIAL — family can correct profile/student data before/around application; no formal request workflow | No provider; may be included in future email content only through communications | Minor/guardian handling, identifiers, birth data and correction/deletion policy | `schema.prisma`; `intake.ts`; `family-projection.ts`; `reporting.ts` |
| DPI-007 | Admission | Offering, process, year, campus and course metadata | `code`, `name`, `title`, `status`, `opensAt`, `closesAt`, `availabilityCategory` | Institution/tenant; indirectly family and student | YES — course context can identify a minor | INTERNAL; public subset is projected | Institutional configuration and public offering discovery | Publish and select an admission process/offering | Configuration-dependent | Public family projection exposes only approved offering/category; staff sees tenant scope | Public offering read; configured institutional staff; support elevation for scoped tenant content | YES for configuration mutations; public discovery read not treated as audited subject access | PARTIAL — appears in allowlisted operational reports, not a general public export | PostgreSQL tenant-owned configuration tables | `NOT_DEFINED`; published/versioned state is business history | Status changes/archival only; no deletion/erasure policy | `NOT_DEFINED` | NOT_IMPLEMENTED as a subject-rights workflow | No provider | Institutional configuration, public text and legal transparency | `schema.prisma` `Campus`/`AcademicYear`/`CourseLevel`/`AdmissionProcess`/`AdmissionOffering`; `intake.ts` |
| DPI-008 | Admission | Application metadata, status, origin and history | `status`, `draftData`, `submittedAt`, `origin`, `assistanceSessionId`, pin timestamps | Family, student and responsible adult; institution as tenant | YES | YES — restricted; field-level sensitivity comes from snapshot/form data | Family self-service or assisted portal submission | Manage an admissions application and its lifecycle | Draft fields progressive; submission requires configured applicable data | Family projection exposes safe status/history; staff sees authorized tenant/scope; internal facts remain restricted | Family owner; Secretariat/Admissions staff per permissions; support elevation only scoped | YES for submissions, assistance and state-changing actions; ordinary family projection read is not uniformly audited | PARTIAL — allowlisted staff reports; no family rights export | PostgreSQL `applications` | `NOT_DEFINED`; withdrawal/versions preserve business history | Withdrawal/status transition available; no erasure/blocking policy | `NOT_DEFINED` | PARTIAL — family read/write/submit and withdraw; no formal request tracking | No provider; fields may reach communication payload only by purpose-specific communication | Purpose, lawful handling, retention, deletion and export review | `schema.prisma` `Application`; `intake.ts`; `forms.ts`; `capacity-offer.ts` |
| DPI-009 | Admission | Form definitions, versions and field configuration | `purpose`, `versionNumber`, `label`, `type`, `required`, `sensitivity`, `purpose`, conditions/options | Institution; may describe fields about families/students | YES — form can target a minor | YES when field configuration is restricted/highly restricted | Institutional form builder | Define progressive, controlled, purpose-tagged capture | Optional or required per published configuration | Staff configurator; family sees only published form content in own application | Form read/manage/publish permissions; family sees published own form | YES for publish/configuration mutations; no general audit read for family | NO — no form-definition export endpoint | PostgreSQL `form_definitions`, `form_versions`, `form_sections`, `form_fields` | `NOT_DEFINED`; published versions immutable and archive state exists | Draft/archive state changes only; no policy for deleting definitions | `NOT_DEFINED` | NOT_IMPLEMENTED as a subject-rights workflow | No provider | Institutional form catalogue, notices and field governance | `schema.prisma`; `forms.ts`; `form.controller.ts`; `form-schemas.ts` |
| DPI-010 | Admission | Ordinary form answers and application snapshot | `ApplicationDraftAnswer.value`; `ApplicationSnapshot.payload`, `schemaVersion`, `submittedAt` | Family and student; may include responsible adult answers | YES | Field-dependent: `internal`, `restricted` or `highly_restricted` from published field | Family/assisted form completion and submission | Capture admission inputs progressively and pin submitted facts | Per field configuration; optional unless published as required | Family sees/edits own draft; authorized staff sees application context; snapshot is immutable | Family owner; assisted operator only during valid assistance; staff by application/form permissions | YES for submission/assistance and critical mutations; field reads are not uniformly audited | PARTIAL — staff reports exclude raw answers; no subject export route | PostgreSQL `application_draft_answers`, `application_snapshots` | `NOT_DEFINED`; snapshot is immutable history, not a legal archive | Draft update and new versioned application behavior; no erasure policy | `NOT_DEFINED` | PARTIAL — correction through draft/profile flows; no formal request tracking | No provider by default; selected communication payloads may contain minimized values | Field purpose, retention and rights by category | `schema.prisma`; `forms.ts`; `family-projection.ts`; `forms.integration.spec.ts` |
| DPI-011 | C-013 | PIE/NEE and support-related form answers | Synthetic examples `needs_support`, `support_detail`, `optional_nee_support`; conditional answers | Student/minor and family | YES | YES — `highly_restricted` in observed synthetic fixture | Dynamic form fields; progressive conditional capture | Prepare support, accommodation or justified need | Optional/progressive in observed fixture; no general eligibility requirement encoded | Family can provide its own form answer; general staff access is denied unless explicit sensitivity capability; family projection omits internal results/deliberation | Family owner for own answers; evaluator/professional or explicitly authorized role; Institutional Maximum Admin when configured; support elevation only scoped | YES for critical restricted mutations/administrative access paths; not every family self-read | NO — reports do not include raw sensitive answers | PostgreSQL `form_fields`, `application_draft_answers`, `application_snapshots` | `NOT_DEFINED`; field/version history is technical | No specific deletion/blocking/anonymization workflow | `NOT_DEFINED` | PARTIAL — field correction via form flow; formal request workflow absent | No provider by default; future observability must be minimized and sanitized | C-013 legal validation, category-specific access, retention and rights procedure | `docs/e1/07-institutional-validation-baseline.md`; `forms.integration.spec.ts`; `forms.ts`; `authorization.ts` |
| DPI-012 | Documents | Document requirement catalogue and applicability | `purpose`, `required`, `sensitivity`, `allowsEquivalent`, `validityRule`, `maxAgeDays`, `correctionWindowBusinessDays` | Student/family; institution configures requirements | YES | YES when requirement sensitivity is restricted/highly restricted | Institutional document configuration | Define what evidence is required and how it is reviewed | Per published requirement; required/optional configurable | Family sees applicable requirement/status; staff sees catalogue in tenant scope | Admissions/authorized reviewer; Institutional Maximum Admin if configured; Secretariat can read/manage only if explicit permissions | YES for publish/review/exemption/configuration mutations; family projection read not uniformly audited | NO — no requirement-catalogue subject export | PostgreSQL `document_requirements`, `document_requirement_versions` | `NOT_DEFINED`; published/archived versions are technical history | Archive/version state only; no policy for deleting requirement history | `NOT_DEFINED` | NOT_IMPLEMENTED as a subject-rights workflow | No provider | Pilot document catalogue, equivalents and legal retention | `schema.prisma`; `documents.ts`; `document.controller.ts` |
| DPI-013 | Documents | Document submission metadata and review status | `status`, `currentDocumentVersionId`, `correctionDueAt`, `verdict`, `reason`, `actorId` | Student/minor and family | YES | YES — restricted; reviews/deliberation may be highly restricted | Family upload, assisted upload and staff review | Verify, observe, exempt or correct a requirement | Per requirement; review decision requires authorized actor | Family sees requirement/status/observation reason/action; internal technical metadata is omitted | Family owner for own upload/status; Secretariat for receipt/upload; Admissions/reviewer for definitive review; support elevation scoped | YES for upload/review/replacement/exemption and restricted access; family status read is not uniformly audited | PARTIAL — allowlisted reports expose statuses, not review contents/files | PostgreSQL `document_submissions`, `document_reviews` | `NOT_DEFINED`; review rows append-only and history preserved | No user-facing deletion; replacement/exemption changes business state and preserves history | `NOT_DEFINED` | PARTIAL — correction/replacement supported; formal request workflow absent | No provider in current API; email may carry correction notice | Review authority, retention, physical originals and rights | `schema.prisma`; `documents.ts`; `family-projection.ts`; `document.controller.ts` |
| DPI-014 | Documents | Document bytes, versions, hashes, quarantine and malware state | `quarantineObjectKey`, `approvedObjectKey`, `sha256`, `sizeBytes`, `declaredMime`, `detectedMime`, `technicalStatus`, `scanStatus`, `origin`, scan versions | Student/minor and family | YES | YES — highly restricted | Self-service/assisted/physical-document digital upload | Store and safely review required evidence | Optional/required by requirement configuration | Family can access own approved document through authorized path; quarantine/technical data hidden; staff download is permissioned | Family owner for own upload/read; Secretariat upload/receipt; Admissions/reviewer read/download/review; support elevation scoped | YES for upload, read/download, scan, review and replacement paths where audit is implemented | NO — reports exclude bytes and highly restricted fields | PostgreSQL metadata plus `InMemoryObjectStorage` or `LocalDevelopmentObjectStorage` in development/CI; no productive object provider selected | `NOT_DEFINED`; quarantine cleanup is not legally configured; approved/replaced versions preserve history | Technical `deleteQuarantine` exists for cleanup; no general bytes deletion policy or subject erasure route | `NOT_DEFINED` | PARTIAL — self-service upload/replacement; no formal access/deletion request workflow | Development/CI synthetic-memory or local-development storage; synthetic malware scanner; no productive provider | Object storage provider, malware provider, residency, retention and physical handling | `schema.prisma` `DocumentVersion`; `documents.ts`; `operational-adapters.ts`; `docs/e2/05-files-security-architecture.md` |
| DPI-015 | Assisted intake | Assisted application and authorization evidence | `operatorUserId`, `operatorRoleSnapshot`, `familyProfileId`, `adultResponsibleUserId`, `adultPresentConfirmed`, `authorizationConfirmed`, `authorizationMethod`, `startedAt`, `endedAt`, `correlationId` | Adult responsible, student/minor and operator | YES | YES — restricted; authorization evidence is operationally sensitive | In-person assisted portal flow | Record that a staff operator assisted while the adult was present | Optional; only for exceptional assisted intake | Staff with assistance scope; family does not receive operator workspace; application records origin `ASSISTED` | Secretariat/Admissions with `application.assist`; no privilege escalation from assistance; support elevation only scoped | YES — session start/close, assisted actions and physical-document origin are auditable | NO — no assistance-evidence export route | PostgreSQL `assistance_sessions` plus linked application/document rows | `NOT_DEFINED`; closed session remains recorded | Session close is supported; no deletion/blocking/anonymization policy | `NOT_DEFINED` | NOT_IMPLEMENTED as a formal request workflow | No provider; email may be used for resulting communication | Q-106 adult/guardian relationship policy and authorization evidence | `schema.prisma`; `assistance.ts`; `docs/e1/07-institutional-validation-baseline.md` |
| DPI-016 | Activity | Activity definitions, appointments and reschedule requests | `kind`, `required`, `modality`, `durationMinutes`, `scheduledStartAt`, `location`, `assignedUserId`, `reason`, appointment status | Student/minor, adult responsible and assigned staff | YES | YES — appointments restricted; definition may be internal | Institutional configuration, staff scheduling, family change request | Schedule interview and diagnostic activity | Requiredness/configuration-dependent; family request optional | Family sees type/date/time/location/status; staff sees appointment/configuration scope | Family may request change; Admissions/Secretariat may schedule/reprogram; evaluator/authorized staff assigned activity | YES for scheduling/reprogramming/access where audit path exists; family appointment read not uniformly audited | PARTIAL — activity appointments may appear in allowlisted reports; no subject export | PostgreSQL `activity_definitions`, versions, `application_activities`, `activity_appointments`, `activity_reschedule_requests` | `NOT_DEFINED`; prior appointments retained when reprogrammed | New appointment/status transition; no erasure policy | `NOT_DEFINED` | PARTIAL — family can request change; no formal request tracking beyond domain request row | Development email adapter for schedule/reprogram notices; no productive provider | Concrete executors, duration, calendar and activity privacy/legal handling | `schema.prisma`; `activities.ts`; `activity.controller.ts`; `docs/e1/08-pilot-operational-rules.md` |
| DPI-017 | Activity | Activity attempts, no-shows and diagnostic/interview results | `operationalOutcome`, `noShowJustified`, `result`, `comment`, `recordedBy`, sequence/history | Student/minor and evaluator/interviewer | YES | YES — highly restricted | Staff activity execution | Record operational outcome and internal evaluation result | Activity-specific; result/comment optional according to runtime input | Staff with `ACTIVITY_RESULT_READ`/restricted access; family projection omits result, comment and scores | Evaluator/authorized performer; Admissions may read/coordinate; Direction may read permitted results; family cannot read internal result | YES for restricted result read/mutation and closure paths | NO — reports do not export comments/results | PostgreSQL `activity_attempts`, `activity_results` | `NOT_DEFINED`; attempts/results append-only/versioned | New attempt/result version; no deletion/anonymization workflow | `NOT_DEFINED` | NOT_IMPLEMENTED as a formal request workflow | No provider by default; only appointment communications leave runtime | Result visibility, sensitive-data handling, retention and rights | `schema.prisma`; `activities.ts`; `family-projection.ts`; `activity.http.integration.spec.ts` |
| DPI-018 | Admission | Admission recommendation | `option`, `foundation`, `createdBy`, `submittedBy`, `evidenceManifest`, version fields | Student/minor and family; admissions staff as actor | YES | YES — highly restricted/internal deliberation | Admissions workspace | Internal recommendation to Direction | Required when recommendation is created/submitted | Admissions/Direction according to capability; family never sees recommendation/foundation | Admissions responsible with `application.recommend`; Direction read as permitted; support elevation scoped | YES — version creation/submission and reads on restricted path | NO — excluded from reports and family projection | PostgreSQL `admission_recommendations`, `admission_recommendation_versions` | `NOT_DEFINED`; append-only version history | New version/correction; no deletion policy | `NOT_DEFINED` | NOT_IMPLEMENTED as a formal request workflow | No provider by default; communicable result uses separate communication projection | Legal validation of internal deliberation access/export/retention | `schema.prisma`; `recommendation.ts`; `family-projection.ts` |
| DPI-019 | Admission | Direction decision | `disposition`, `foundation`, `reason`, `decidedBy`, `decidedAt`, `evidenceManifest`, versions | Student/minor and family; Direction actor | YES | YES — highly restricted/internal | Direction workspace | Final institutional disposition or return to review | Required decision action; disposition-specific reasons | Direction and authorized staff; family sees only communicable result after projection rules; internal foundation hidden | Direction with `application.decide`; Admissions reads; support elevation scoped | YES — decision versions and downstream effects | NO — report exports include disposition/date only, not foundation/evidence | PostgreSQL `direction_decisions`, `direction_decision_versions` | `NOT_DEFINED`; prior decisions retained as history | New version/return to review; no erasure/anonymization policy | `NOT_DEFINED` | NOT_IMPLEMENTED as a formal request workflow | Communication adapter may receive minimized communicable content | Legal approval of decision access, notice, retention and export | `schema.prisma`; `recommendation.ts`; `communications.ts`; `family-projection.ts` |
| DPI-020 | Capacity / offers | Capacity, reservations, waitlist, offers and acceptance | `configuredCapacity`, reservation state/timestamps, `enteredAt`, `origin`, `lifecycle`, `expiresAt`, `actorId`, `acceptedAt` | Student/minor and family; institution operations | YES | YES — restricted/internal; waitlist order and numeric capacity internal | Institutional configuration, Direction effects, family offer action | Manage capacity, waiting state, offers and explicit acceptance | Capacity/offer rules configurable; acceptance explicit | Family sees category, general waitlist state, offer origin/status/expiry and acceptance; no numeric capacity/position/priorities | Admissions/Institutional Maximum Admin as configured; Direction decides; family accepts/declines/withdraws own offer; support elevation scoped | YES — capacity changes, promotions, offers, expiry, acceptance and withdrawal are audited | PARTIAL — allowlisted operational reports expose selected status/timing fields; no subject export | PostgreSQL `admission_capacities`, adjustments, reservations, waitlist, offers, acceptances, withdrawals | `NOT_DEFINED`; technical expiry releases reservation and preserves history | Technical release/expiry/withdrawal/reopen transitions; no erasure policy | `NOT_DEFINED` | PARTIAL — family self-service acceptance/withdrawal; no formal request tracking | Development email adapter for offer/reminder/status messages; no productive provider | Legal status of capacity/waitlist/offer data, retention and export | `schema.prisma`; `capacity-offer.ts`; `family-projection.ts`; `docs/e1/08-pilot-operational-rules.md` |
| DPI-021 | Communications | Communications, delivery attempts and manual contact records | `purpose`, `audience`, `recipientEmail`, `subject`, `body`, `payloadSnapshot`, provider reference/status, `purpose`, `outcome`, `notes` | Adult responsible/family, student indirectly, staff actor | YES | YES — restricted; body/payload may contain personal data | Business events, staff confirmation, manual calls | Notify family and record operational contact | Event/configuration-dependent; manual contact optional | Family sees sent/delivered safe history; staff sees authorized communication workspace; failed details sanitized | Admissions/Secretariat for operational actions; confirmation/retry/manual contact permissions; family reads own projection | YES — prepare/confirm/send/retry/manual contact and delivery evidence | NO — no communication-content export route | PostgreSQL `communications`, attempts, `manual_contacts`, tasks | `NOT_DEFINED`; failed/sent history preserved, no legal period | Retry/status/task resolution only; no content deletion policy | `NOT_DEFINED` | PARTIAL — family receives messages; no formal access/deletion/objection workflow | `DevelopmentEmailAdapter` / `DevelopmentIdentityEmailAdapter` only; current productive email provider `NOT_SELECTED` | Provider, message minimization, notice text, retention and rights | `schema.prisma`; `communications.ts`; `email-adapter.ts`; `identity-email-adapter.ts` |
| DPI-022 | Audit | Audit events | `actorId`, `effectiveActorId`, `tenantId`, `action`, `purpose`, `resourceType`, `resourceId`, `result`, `reasonCode`, `correlationId`, sanitized metadata | Family, student, staff, institution and platform actors as subjects of activity | YES — event metadata is restricted; raw sensitive payloads excluded by sanitizer | Business mutations, restricted reads, elevation, export and security-relevant actions | Evidence of actions, access, changes and outcomes | System-generated for covered actions; not a user-provided form field | Authorized institutional audit readers; platform content audit requires elevation; family does not have audit console | `audit.read` plus tenant/scope/purpose; support elevation for tenant content; no family audit access | YES by design for covered operations; coverage is action-specific, not every read | PARTIAL — audit read API returns filtered events to authorized staff; no subject export workflow | PostgreSQL `audit_events`, append-oriented service/sink | `NOT_DEFINED`; append-only application behavior is not a legal retention period | No ordinary update/delete route observed; legal deletion/blocking unresolved | `NOT_DEFINED` | PARTIAL — technical audit access for authorized staff, no formal request handling | Current sink `PrismaAuditSink` in PostgreSQL; no external provider in current API | Audit retention/integrity/access and legal rights interaction | `schema.prisma` `AuditEvent`; `audit.ts`; `access-admin.ts`; `reporting-admin.controller.ts` |
| DPI-023 | Security | Security events | `code`, `correlationId`, `occurredAt`, `result`, opaque subject/tenant identifiers | Family, student, staff or platform actor implicated in a security event | YES — may relate to a minor indirectly; payload is minimized | YES — security-restricted | Authorization denial, verification failure, support-elevation denial | Detect abuse/control failures separately from audit history | Event-driven when covered condition occurs | Not visible to family or ordinary staff; restricted operational/security audience | Security/technical operator through approved operational channel; current runtime does not expose a durable read API | NO in current production wiring — sink interface exists, current API injects `NoopSecurityEventSink`; tests use in-memory sink | NO | In-memory/no-op sink in current runtime; candidate signals are process data | `NOT_DEFINED`; no durable current sink | No deletion route because current sink is non-durable/no-op in API | `NOT_DEFINED` | NOT_IMPLEMENTED | Future approved Grafana Cloud observability stack; implementation deferred to preprod | Provider, region, retention, legal/privacy incident owner and access | `security-events.ts`; `app.module.ts`; `operational-signals.ts`; `docs/g5/06-g5or-operational-recovery-plan.md` |
| DPI-024 | Operations | Operational logs, metrics and signal candidates | Structured log fields, event code, level, result, timestamp, correlation ID; signal ID/severity/sanitized dimensions | Staff/platform actors and tenant operations; may correlate to a person | YES — only indirect/minimized correlation should be used | YES — operationally restricted; sanitizer redacts sensitive keys | API/worker/logger, health/readiness, outbox/storage/scanner/email/recovery signals | Diagnose service health and trigger operational response | System-generated | Technical operators; no family/staff content console | Technical operation; future managed monitoring access by approved provider; no tenant content access by default | NO for durable audit equivalence; structured logger is stdout/process output and signal candidates are not a productive page | NO — no operational export route | Process stdout/console and in-memory candidates in current development/CI; no productive sink selected | `NOT_DEFINED`; no current durable retention configuration | Process lifecycle/host log handling only; no application deletion policy | `NOT_DEFINED` | NOT_IMPLEMENTED | Approved future Grafana Cloud; email primary and Telegram immediate alert destinations; implementation deferred to preprod | Region, retention, minimization, provider transfer and incident escalation | `structured-logger.ts`; `operational-signals.ts`; `apps/api/src/health.controller.ts`; G5-OR docs |
| DPI-025 | Support | Support elevation records | `tenantId`, `actorUserId`, `reason`, `purpose`, `scopes`, `categories`, `startedAt`, `expiresAt`, `closedAt`, `revokedAt` | Platform support operator and institution/tenant content affected by elevation | YES if scoped content concerns a student/minor | YES — highly restricted | Explicit platform support elevation request | Time-bound support access to tenant content | Exceptional, not default | Only platform support workflow and audit; tenant content is visible only within verified elevation scope | Global Superadmin may initiate own elevation when platform capability exists; elevated context remains tenant/scope/category/purpose/expiry limited | YES — start, close, revoke and denied attempts are audited/security-signaled | NO — no general export route | PostgreSQL `support_elevations` | `NOT_DEFINED`; expiry/close/revoke are technical controls | Close/revoke state transition; no legal deletion policy | `NOT_DEFINED` | NOT_IMPLEMENTED as a formal rights workflow | Current DB only; future observability receives sanitized operational/security signals, not content by default | Legal/privacy incident ownership, access review and retention | `schema.prisma`; `support-elevation.ts`; `support-elevation-transaction.ts`; `authorization.ts` |
| DPI-026 | Reporting | Reports and CSV exports | Report key, allowlisted columns/filters, tenant/scope, row count, generated CSV, audit metadata | Family/student and institution | YES | YES when rows include restricted names/statuses; highly restricted fields excluded by catalog | Authorized staff reporting route | Operational reporting and controlled export | On-demand, permission-dependent | Staff with report access; family has no report console | `report.read`/`report.export`, tenant/scope/purpose; Institutional Maximum Admin or Admissions only if configured | YES — export request/result/columns/scope are audited; CSV response is private/no-store | YES — technical staff export is implemented; subject-specific portability is not | Generated in memory and returned as private CSV HTTP response; no report artifact table | `NOT_DEFINED`; no stored report retention policy | No stored report deletion needed in current route; downloaded copies are outside runtime control | `NOT_DEFINED` | PARTIAL — operational export exists; no subject request tracking or scoped subject export | No provider; future storage/email transfer not selected | Legal validation of columns, recipients, export rights, retention and download controls | `reporting.ts`; `reporting-admin.controller.ts`; `docs/e1/11-functional-specification.md` |
| DPI-027 | Functional handoff | Functional handoff to future EduPay boundary | `offerAcceptanceId`, `requestedByActorId`, `requestedAt`, local status `REQUESTED` | Student/minor, family and institution | YES | YES — restricted | Explicit request after accepted offer | Record local handoff intent without claiming enrollment/payment | Conditional after explicit offer acceptance | Family sees acceptance/next steps, not technical sync details; staff sees local boundary if authorized | Authorized admissions/handoff capability; family and platform Superadmin without elevation denied for tenant content | YES — handoff request and idempotent local fact are audited | NO — no handoff export route | PostgreSQL `integration_handoffs`; no shared tables with EduPay | `NOT_DEFINED`; local fact/history persists; Q-301..Q-309 future contract | No technical provider delete/update policy beyond local boundary | `NOT_DEFINED` | NOT_IMPLEMENTED as a formal rights workflow | No external integration/provider; Q-301..Q-309 remain deferred | Payload, purpose, transfer, residency, contract and enrollment distinction | `schema.prisma` `IntegrationHandoff`; `functional-handoff.ts`; `docs/e1/11-functional-specification.md` |

## Categorías revisadas y no inventariadas

| Solicitud conceptual | Resultado factual del runtime |
| --- | --- |
| Guardian relationship / civil identifiers | No existe entidad `GuardianRelationship`, RUT, tutela, parentesco verificado ni fecha de nacimiento en el schema actual. `adultResponsibleUserId` y `adultPresentConfirmed` documentan la operación asistida, no cierran Q-106. |
| Health-related data | No existe modelo ni campo de salud dedicado observado. El formulario genérico puede representar un campo con sensibilidad y propósito, pero no se observó una categoría de salud configurada en runtime/pruebas; por eso no se crea una fila DPI separada. |
| Family phone | No existe campo de teléfono en `PlatformUser`, `FamilyProfile` ni `AssistanceSession`; la documentación funcional lo menciona como disponible, pero el runtime prevalente no lo implementa. |
| Family income | Excluido del MVP de Admisión; no existe campo/modelo implementado. No se inventa una categoría financiera. |
| Waitlist priority snapshot | La espera implementada conserva `enteredAt`, estado y promoción; no existe `WaitlistPrioritySnapshot` en el schema actual. |
| Integration sync state | Existe `IntegrationHandoff` local, pero no `IntegrationSyncState` ni proveedor EduPay. Q-301..Q-309 permanecen diferidos. |
| Physical original | El runtime almacena la copia digital y su origen `PHYSICAL_DOCUMENT`; no almacena el papel original ni su devolución. Ver sección específica más abajo. |

## MINORS_AND_SENSITIVE_DATA

Esta sección demuestra controles funcionales/técnicos. No afirma cumplimiento legal.

### A. Datos ordinarios del estudiante

El runtime actual implementa nombre y apellido en `Student`, y contexto académico por
oferta/curso en `Application`/`AdmissionOffering`. La familia sólo obtiene estudiantes y
postulaciones de su propio perfil; tenant, ownership y permisos se validan server-side.
No se encontraron RUT ni fecha de nacimiento, por lo que no se documentan como datos
recogidos.

Controles observados: captura progresiva, snapshot inmutable de postulación, denegación
cross-tenant, proyección familiar segura y reportes allowlisted.

### B. PIE/NEE

El constructor de formularios admite condiciones, `required`, `purpose` y sensibilidad.
La evidencia sintética crea `optional_nee_support` y `support_detail` como campos
opcionales/condicionales `highly_restricted`. El resultado técnico observado es:

- progressive capture: condición y opcionalidad en el formulario;
- minimal collection: sólo se persiste el valor del campo publicado;
- acceso restringido: autorización por sensibilidad/permisos/tenant/purpose;
- auditoría: acciones administrativas y mutaciones críticas generan `AuditEvent`;
- no exposición por defecto: la proyección familiar no incluye deliberaciones ni
  resultados internos.

La implementación no define por sí sola qué profesional puede acceder ni qué política
legal corresponde.

### C. Salud

No se observa un modelo o campo de salud dedicado en el runtime actual. El sistema no
implementa una historia clínica general por defecto. El formulario genérico tiene capacidad
técnica de configurar un campo sensible con finalidad declarada, pero la configuración
concreta, el mínimo detalle, los roles autorizados, la retención y las solicitudes de
titulares requieren decisión humana. Esta ausencia de una categoría fija no debe leerse
como autorización para agregarla.

### D. Resultado diagnóstico/evaluación

`ActivityDefinitionKind` implementa `GUARDIAN_INTERVIEW` y `DIAGNOSTIC_EVALUATION`.
`ActivityAttempt` conserva secuencia/no-show/resultado operativo y `ActivityResult`
conserva `FAVORABLE`, `NO_FAVORABLE`, `INCONCLUSO` y comentario interno. La proyección
familiar expone actividad/agenda/estado operativo, pero omite resultado, comentario,
puntaje y conclusión. Lecturas de resultados requieren `ACTIVITY_RESULT_READ` o una
capacidad equivalente con sensibilidad permitida.

### E. Información interna de admisión

Recomendaciones, fundamentos, decisiones, evidencia, posición interna de espera, cupos
numéricos y deliberaciones se almacenan o calculan como información interna restringida.
La familia recibe sólo estados/resultados comunicables y oferta/aceptación según el flujo.
La separación de funciones y la auditoría de acciones críticas están implementadas; la
aprobación legal de la matriz final sigue abierta.

### Controles comprobados y límites

| Control solicitado | Hecho técnico observado | Límite actual |
| --- | --- | --- |
| Progressive capture | Formularios versionados, campos condicionales y respuestas parciales | La finalidad concreta la configura el tenant; no hay validación legal |
| Minimal collection | Sin ingreso familiar en MVP; sin modelo de salud dedicado; respuestas sólo de campos publicados | No existe decisión legal por categoría |
| Restricted/highly restricted access | Sensitivity + permission + scope + purpose + tenant en autorización | Los roles se asignan por permisos; no hay catálogo de roles semántico cerrado |
| Audit | `AuditEvent` durable para operaciones cubiertas; metadatos sanitizados | No toda lectura de familia se audita; SecurityEvent actual no es durable |
| Family isolation | Ownership familiar, tenant context, RLS y proyecciones seguras | Requiere regresión continua |
| Family does not see internal deliberation/scores | Proyección omite recomendación, fundamentos, resultados y puntajes internos | No es una conclusión jurídica |
| No broad health history by default | No existe modelo/campo fijo de historia clínica; formulario genérico requiere configuración | Cualquier futura configuración requiere decisión humana |

## Q-106 — Boundary de identidad familiar y relación

`Q-106 = DEFERRED / PILOT PRECONDITION`.

| Boundary | Estado factual |
| --- | --- |
| `EMAIL_ACCOUNT_VERIFICATION` | `IMPLEMENTED`: registro público, challenge hash/one-time/expiry/attempts, anti-enumeration y emisión de sesión opaca. El flujo prueba control del canal de email, no identidad civil ni relación. |
| `GUARDIAN_RELATIONSHIP_VERIFICATION` | `NOT LEGALLY/OPERATIONALLY CLOSED`: el runtime usa ownership familiar y, en asistencia, adulto presente/autorización registrada; no existe verificación definitiva de parentesco, tutela o facultad. |

Decisiones humanas concretas aún requeridas:

1. qué declaración realiza el adulto responsable;
2. si esa declaración basta para iniciar una postulación;
3. cuándo debe verificarse la relación antes de continuar;
4. qué evidencia se exige y cómo se valida;
5. quién puede revisarla y con qué alcance;
6. qué ocurre ante discrepancia, falta de evidencia o conflicto entre adultos;
7. cómo se registra la resolución sin transformar un identificador en autorización.

Esta sección no resuelve ninguna de esas preguntas.

## Physical documents

| Elemento | Estado real |
| --- | --- |
| Portal | `OFFICIAL_SOURCE` de la postulación y del expediente digital |
| Physical documents | `EXCEPTIONAL_ASSISTED_INTAKE`; el origen puede registrarse como `PHYSICAL_DOCUMENT` |
| Digital copy | `OFFICIAL_EXPEDIENTE_ARTIFACT`; `DocumentVersion` conserva metadata, hash cuando existe, versión y estado de scan |
| `PHYSICAL_ORIGINAL_RETENTION` | `NOT_DEFINED` |
| `PHYSICAL_ORIGINAL_RETURN` | `NOT_DEFINED` |
| Expediente paralelo de papel | No se implementa en el runtime; la copia digital se asocia al requisito oficial |

## PURPOSE_MAP

La siguiente matriz describe finalidades funcionales observadas. `SECONDARY_USE_ALLOWED?`
no es una autorización: queda `UNASSESSED` porque no existe una decisión institucional y
legal explícita en las fuentes revisadas.

| PURPOSE_ID | DESCRIPTION | DATA_CATEGORIES_USED | ACTORS | INPUTS | OUTPUTS | SECONDARY_USE_ALLOWED? | CURRENT_SOURCE | LEGAL_BASIS_STATUS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-001 | Account access | DPI-001, DPI-002, DPI-003 | Family user, staff, platform identity service | Email channel, verification challenge, session action | Verified account/session | `UNASSESSED` | `account-registration.ts`; `session-service.ts` | `UNASSESSED` |
| P-002 | Family/student management | DPI-005, DPI-006 | Family user, assisted operator, authorized staff | Family profile, student identity, ownership context | Family/student record and projection | `UNASSESSED` | `intake.ts`; `family-projection.ts` | `UNASSESSED` |
| P-003 | Admissions application | DPI-006, DPI-007, DPI-008 | Family user, Secretariat, Admissions | Offering selection, draft application, student context | Application lifecycle and status | `UNASSESSED` | `intake.ts`; `schema.prisma` | `UNASSESSED` |
| P-004 | Progressive form capture | DPI-009, DPI-010, DPI-011 | Family user, assisted operator, authorized admissions staff | Published fields, conditional answers, draft/snapshot | Draft answers and submitted snapshot | `UNASSESSED` | `forms.ts`; `form-schemas.ts` | `UNASSESSED` |
| P-005 | Document verification | DPI-012, DPI-013, DPI-014, DPI-015 | Family user, Secretariat, Admissions/reviewer | Requirement, upload, metadata, scan/review state | Requirement status, observation or verdict | `UNASSESSED` | `documents.ts`; `document.controller.ts` | `UNASSESSED` |
| P-006 | Interview/activity scheduling and execution | DPI-016, DPI-017 | Family user, Secretariat, Admissions, Evaluator | Activity configuration, appointment request, attempt/result | Appointment, outcome and activity result | `UNASSESSED` | `activities.ts`; `activity.controller.ts` | `UNASSESSED` |
| P-007 | Admission recommendation | DPI-017, DPI-018 | Evaluator, Admissions responsible, Direction | Activity evidence, recommendation foundation and version | Internal recommendation | `UNASSESSED` | `recommendation.ts`; `family-projection.ts` | `UNASSESSED` |
| P-008 | Final admission decision | DPI-018, DPI-019 | Direction, Admissions responsible | Recommendation, evidence manifest, disposition | Direction decision and communicable projection | `UNASSESSED` | `recommendation.ts`; `family-projection.ts` | `UNASSESSED` |
| P-009 | Capacity/waitlist/offer | DPI-007, DPI-008, DPI-020 | Admissions, Direction, Institutional Admin, Family user | Capacity configuration, decision effect, offer action | Reservation, waitlist state, offer and acceptance | `UNASSESSED` | `capacity-offer.ts`; `family-projection.ts` | `UNASSESSED` |
| P-010 | Communications | DPI-008, DPI-019, DPI-020, DPI-021 | Family user, Secretariat, Admissions, communication adapter | Communicable status, recipient channel, message purpose | Communication, delivery attempt or manual contact | `UNASSESSED` | `communications.ts`; `email-adapter.ts` | `UNASSESSED` |
| P-011 | Security/audit/operations | DPI-001, DPI-002, DPI-003, DPI-004, DPI-022, DPI-023, DPI-024, DPI-025 | Platform operators, tenant audit readers, support operator | Action context, purpose, scope, correlation, signal | Audit event, security signal, operational log | `UNASSESSED` | `audit.ts`; `security-events.ts`; `operational-signals.ts` | `UNASSESSED` |
| P-012 | Support | DPI-004, DPI-022, DPI-023, DPI-025 plus scoped tenant category | Platform support, tenant operator | Explicit elevation, tenant, purpose, scope, expiry | Time-bound support context and audited action | `UNASSESSED` | `support-elevation.ts`; `authorization.ts` | `UNASSESSED` |
| P-013 | Reporting/export | DPI-006, DPI-007, DPI-008, DPI-013, DPI-016, DPI-019, DPI-020, DPI-022 | Admissions, Direction, Institutional Admin, support via elevation | Allowlisted report key, filters, tenant/scope, purpose | Private CSV response and audit evidence | `UNASSESSED` | `reporting.ts`; `reporting-admin.controller.ts` | `UNASSESSED` |
| P-014 | Functional handoff | DPI-020, DPI-027 | Admissions responsible, institution | Accepted offer and explicit handoff request | Local `IntegrationHandoff` fact | `UNASSESSED` | `functional-handoff.ts`; `schema.prisma` | `UNASSESSED` |

## DATA SUBJECT RIGHTS GAP

Este inventario separa capacidades de producto de un procedimiento formal de solicitudes.
`LEGAL_APPLICABILITY_UNASSESSED` se usa en todas las filas deliberadamente.

| RIGHT | TECHNICALLY_SUPPORTED | MANUAL_ACTIONS_NOW | EVIDENCE | LEGAL_APPLICABILITY |
| --- | --- | --- | --- | --- |
| Access | PARTIAL | Identificar tenant, propósito, alcance y datos; reunir vistas/filas autorizadas; revisar exposición de contenido interno | Family projections, scoped reads, audit/report reads; no endpoint general de solicitud | `LEGAL_APPLICABILITY_UNASSESSED` |
| Correction | PARTIAL | Usar las rutas de edición disponibles o evaluar corrección fuera de las rutas existentes; registrar decisión y alcance | Family/student/draft update, document replacement, versioned recommendation/decision changes | `LEGAL_APPLICABILITY_UNASSESSED` |
| Deletion | NOT_IMPLEMENTED | Evaluación manual de solicitud, dependencias, historial y eventual acción administrativa; no hay flujo general | No subject deletion endpoint; technical cascades are not a rights procedure | `LEGAL_APPLICABILITY_UNASSESSED` |
| Blocking/restriction | NOT_IMPLEMENTED | Determinar qué suspensión o limitación corresponde y cómo preservar integridad de historial | Account/session revocation and business statuses are not a general restriction request flow | `LEGAL_APPLICABILITY_UNASSESSED` |
| Portability/export where applicable | PARTIAL | Generar o revisar datos por titular fuera del reporte operativo; validar columnas, destinatario, minimización y descarga | Allowlisted staff CSV exists; no subject-scoped export workflow | `LEGAL_APPLICABILITY_UNASSESSED` |
| Opposition/objection where applicable | NOT_IMPLEMENTED | Recibir, clasificar, resolver y registrar manualmente; no route/tracker observed | No general objection/opposition endpoint | `LEGAL_APPLICABILITY_UNASSESSED` |
| Request tracking | NOT_IMPLEMENTED | Crear expediente/control externo, asignar responsable, registrar fechas y resolución | `OperationalTask` tracks operational work, not data-subject requests | `LEGAL_APPLICABILITY_UNASSESSED` |

No se determina cuáles derechos aplican, quién debe responder, plazos ni excepciones.

## Síntesis de decisiones aún abiertas

El inventario deja sin resolver, entre otros: responsable formal, base por finalidad,
avisos, tratamiento de menores, PIE/NEE/salud, retención, eliminación/anonimización/
bloqueo, procedimiento de derechos, acceso/exportación, originales físicos, proveedores,
residencia, incidentes privacy/legal y Q-106. Esos puntos se convierten en preguntas
concretas en `docs/g5/11-g5lp1-legal-decision-register.md`.

## RETENTION_DECISION_MATRIX

La tabla distingue el comportamiento técnico y la preservación de historia de negocio o
integridad de auditoría de una obligación legal de conservar. `LEGAL_RETENTION_DECISION`
es `NOT_DEFINED` en todas las categorías porque no existe aprobación legal previa en las
fuentes revisadas.

| DATA_ID | DATA_CATEGORY | CURRENT_TECHNICAL_BEHAVIOR | CURRENT_DELETION_CAPABILITY | CURRENT_ARCHIVE_BEHAVIOR | CURRENT_IMMUTABILITY_REQUIREMENT | LEGAL_RETENTION_DECISION | PROPOSED_DECISION_OWNER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DPI-001 | Platform identity/status | Status and verification timestamps update | No subject deletion route observed | Status history is relational state, not legal archive | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-002 | Verification challenges | Expiry, one-time consumption and supersession | No purge job or request route | Consumed/expired row may remain | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-003 | Session metadata | Idle/absolute expiry, rotation and revocation | No user purge route | Session row supports security history | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-004 | Memberships/roles | Status/end-date/revocation changes | No hard-delete policy | Assignment history remains in relational records | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-005 | Family profile/contact | Profile values can be updated | No formal subject deletion route | No separate archive model observed | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-006 | Student identity/course context | Student/application relationships and updates | No subject deletion route | Application facts may preserve course context | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-007 | Offering/process metadata | Publish/archive/status transitions | No subject deletion policy; configuration archive exists | Published versions/status history retained technically | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-008 | Application/status/history | Draft updates, submission, withdrawal and status transitions | No erasure/blocking route | Snapshots/history preserve business facts | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-009 | Form definitions | Versioning, publish and archive states | No deletion policy for definitions/history | Published versions retained technically | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-010 | Ordinary answers/snapshot | Draft updates; submitted snapshot is immutable | No subject erasure route | Snapshot preserves submitted business history | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-011 | PIE/NEE answers | Dynamic field/version state; no special purge workflow | No category-specific deletion/blocking route | Versioned answer/snapshot history may remain | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-012 | Document requirements | Publish/archive/version state | No requirement-history deletion policy | Requirement versions archived technically | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-013 | Document submission/review | Replacement, review, verdict and correction state | No subject deletion route | Review/history rows preserve process facts | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-014 | Document bytes/versions/scan | Quarantine/approval/replacement; technical quarantine delete exists | `deleteQuarantine` only; no general erasure policy | Approved/replaced versions and metadata remain | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-015 | Assisted intake evidence | Session close and linked records persist | No request deletion route | Closed assistance session preserves operational evidence | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-016 | Activities/appointments | Scheduling, reprogramming and request status changes | No erasure policy | Prior appointments/requests remain as process history | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-017 | Attempts/results/diagnostic | Attempts and results are versioned/append-oriented | No deletion/anonymization workflow | Result history preserved technically | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-018 | Recommendation | Version creation/submission; no in-place destructive history | No deletion route | Recommendation versions preserve deliberation history | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-019 | Direction decision | Versioned decisions and return-to-review transitions | No deletion/anonymization workflow | Decision history preserved technically | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-020 | Capacity/waitlist/offer | Expiry/release/withdrawal/reopen transitions | No erasure policy | Reservation/waitlist/offer history persists | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-021 | Communications/contact | Delivery/retry/task status and manual contact rows persist | No content deletion policy | Communication history retained in current database behavior | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-022 | Audit events | Append-oriented durable `AuditEvent` sink | No ordinary update/delete route observed | Audit history remains queryable to authorized readers | `AUDIT_INTEGRITY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-023 | Security events | Current API uses in-memory/no-op sink; no durable archive | No durable application deletion route | Process/in-memory lifetime only in current wiring | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-024 | Operational logs/signals | Stdout/process output and in-memory candidates in development/CI | Host/process handling only | No application archive selected | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-025 | Support elevation | Expiry, close and revoke state changes | No legal deletion policy | Elevation/audit evidence remains technically | `AUDIT_INTEGRITY` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-026 | Reports/CSV | Generated in memory and returned `private/no-store` | No stored artifact deletion needed in current route | Downloaded copies are outside runtime control | `NOT_DEFINED` | `NOT_DEFINED` | `NOT_ASSIGNED` |
| DPI-027 | Functional handoff | Local handoff request/status is idempotent local fact | No provider or subject deletion route | Local history persists; future boundary deferred | `BUSINESS_HISTORY` | `NOT_DEFINED` | `NOT_ASSIGNED` |

No se convierten `BUSINESS_HISTORY` o `AUDIT_INTEGRITY` en una obligación legal de
retención. Los plazos, excepciones, eliminación, anonimización y bloqueo requieren una
decisión separada.

## PROVIDER_AND_DATA_RESIDENCY_INVENTORY

### CURRENT DEVELOPMENT / CI

| COMPONENT | CURRENT_STATUS | DATA_CATEGORIES_HANDLED | PII / SENSITIVE EXPOSURE | RESIDENCY | RETENTION |
| --- | --- | --- | --- | --- | --- |
| Prisma/PostgreSQL application persistence | Implemented for current development/CI runtime | DPI-001 through DPI-027 according to schema models; DPI-023/DPI-024 are not durably persisted by current API wiring | Depends on category and field sensitivity | `NOT_SELECTED` for productive residency | `NOT_DEFINED` |
| `InMemoryObjectStorage` | Implemented adapter for development/tests | DPI-014 document bytes/versions | Synthetic only in allowed tests; real data not authorized | Process/test memory | Process/test lifetime; no policy |
| `LocalDevelopmentObjectStorage` | Development-only adapter; forbidden in production | DPI-014 document bytes/versions | Could handle document bytes if used; real data not authorized | Local development filesystem | Technical cleanup only; no policy |
| `SyntheticDevelopmentMalwareScanner` / `NoopMalwareScanner` | Development/CI adapters; productive scanner not selected | DPI-014 scan metadata and document bytes as input | Potentially handles document bytes; synthetic-only constraints apply | Development/CI environment | `NOT_DEFINED` |
| `DevelopmentEmailAdapter` / `DevelopmentIdentityEmailAdapter` | Development-only; no productive email provider | DPI-001, DPI-002, DPI-016, DPI-020, DPI-021 | Synthetic recipients/content only; no real data authorized | In-memory/local development delivery | In-memory capture/log lifecycle; no productive retention |
| `NoopSecurityEventSink` / in-memory security sink | Current API wiring/tests | DPI-023 security events | Sanitized/minimized event payloads; no durable production sink | Process/test memory | Process/test lifetime; no policy |
| Structured logger / process signals | Current development/CI output | DPI-024 and sanitized operational metadata | Redaction/sanitization observed; no raw document/form/health/PIE/NEE payloads by logger contract | Process stdout/host handling | `NOT_DEFINED` |

These adapters are evidence of current development/CI behavior, not approval for real data
or productive operation. The productive provider for email, object storage and malware
scanning is not selected in the current evidence.

### APPROVED FUTURE PRODUCTIVE COMPONENTS

| COMPONENT | STATUS | DATA_CATEGORIES_POTENTIALLY_SENT | PII_REQUIRED? | SENSITIVE_DATA_REQUIRED? | MINIMIZATION_AVAILABLE? | RESIDENCY_DECISION | RETENTION_DECISION |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grafana Cloud observability stack | `APPROVED / IMPLEMENTATION_DEFERRED_TO_PREPROD` | DPI-023, DPI-024 and sanitized operational/security signal metadata | `NO BY DESIGN`; must be validated before implementation | `NO BY DESIGN`; raw content is not approved for transfer | `YES` — signal allowlist, redaction and opaque identifiers are available in design | Grafana region `NOT_SELECTED` | Grafana retention `NOT_SELECTED / MUST ALIGN WITH PRIVACY DECISION` |
| Telegram immediate alert channel | `APPROVED / IMPLEMENTATION_DEFERRED_TO_PREPROD` | Minimized DPI-024 operational alert metadata; potentially DPI-023 alert code/correlation | `NO BY DESIGN`; no tenant content approved | `NO BY DESIGN`; no document/form/health/PIE/NEE content approved | `YES` — alert templates and sanitized fields | `NOT_SELECTED` | `NOT_SELECTED / MUST ALIGN WITH PRIVACY DECISION` |
| Email primary alert destination | Alert model approved; implementation deferred with monitoring model | Minimized DPI-024 operational alert metadata; potentially DPI-023 alert code/correlation | `NO BY DESIGN`; productive email provider not selected | `NO BY DESIGN` | `YES` — templates and allowlisted fields | Provider/residency `NOT_SELECTED` | `NOT_SELECTED / MUST ALIGN WITH PRIVACY DECISION` |
| Productive object storage | `NOT_SELECTED` | DPI-014 document bytes, versions and scan metadata | `YES — potentially` | `YES — potentially`, depending on documents | `TO_BE_DEFINED` | `NOT_SELECTED` | `NOT_SELECTED` |
| Productive malware provider | `NOT_SELECTED` | DPI-014 document bytes or scan material, depending on provider contract | `YES — potentially` | `YES — potentially` | `TO_BE_DEFINED` | `NOT_SELECTED` | `NOT_SELECTED` |
| Productive email provider for family communications | `NOT_SELECTED` | DPI-021 communications and selected DPI-008/DPI-019/DPI-020 projections | `YES — potentially` | `TO_BE_DEFINED` by message category; no sensitive content is approved here | `TO_BE_DEFINED` | `NOT_SELECTED` | `NOT_SELECTED` |

Operational selections are not provider configuration or a legal transfer decision. No
Grafana, Telegram, email, object-storage or malware integration is implemented by G5-LP1.

## INCIDENT_SECURITY_AND_OPERATIONAL_OWNERSHIP

| ITEM | CURRENT_CANONICAL_STATUS | LIMIT |
| --- | --- | --- |
| Technical incident owner | `BaseLogic / Nicolás` — approved | Technical operational ownership only; no legal/privacy conclusion |
| Recovery owner | `BaseLogic / Nicolás` — approved | Recovery execution ownership only; no legal/privacy conclusion |
| Monitoring model | `MANAGED_EXTERNAL`; Grafana Cloud selected | Implementation deferred to preprod |
| Alert model | Email primary; Telegram immediate — approved | Productive provider/configuration not implemented |
| Security event destination | Grafana Cloud observability stack — approved | SecurityEvent is separate from AuditEvent; implementation deferred to preprod |
| Legal/privacy incident owner | `NOT_ASSIGNED` | No notification duty, recipient, deadline or escalation rule is inferred |

`SecurityEvent != AuditEvent`: the former is an operational/security detection channel;
the latter is the durable application audit record observed in the current PostgreSQL
sink. This distinction does not assign legal responsibility or establish an incident
notification procedure.
