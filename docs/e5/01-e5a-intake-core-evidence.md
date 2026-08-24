# E5-A — Evidencia de Intake core

## Control de alcance

| Campo | Resultado |
| --- | --- |
| Estado | `COMPLETE` |
| Rama | `feat/e5-mvp` |
| HEAD de entrada | `d03e686f0b1d0c433aee197fbd91ce92037746c7` |
| Compuerta | G4 `APPROVED / CLOSED`; G5 `NO APROBADA` |
| Datos | Sólo sintéticos/non-production |
| Producción/piloto | No autorizados |
| EduPay | Sin llamadas ni tablas compartidas |
| Q-301..Q-309 | No resueltas |
| Siguiente etapa | E5-B, requiere revisión/aprobación humana separada |

## Hechos, decisiones y supuestos

- **Hecho confirmado:** E4 entrega `PlatformUser`, `PlatformSession`, `Tenant`, `Membership`, `RoleAssignment`, contexto tenant transaccional y sesión opaca server-side.
- **Decisión aprobada aplicada:** `FamilyProfile` y `Student` son globales/family-owned; `Campus`, `AcademicYear`, `CourseLevel`, `AdmissionProcess`, `AdmissionOffering` y `Application` son tenant-owned. `AuditEvent` mantiene eventos tenant-owned y una variante platform-scoped explícita para los eventos globales allowlisted.
- **Decisión aprobada aplicada:** la proyección familiar de disponibilidad sólo devuelve la categoría pública; no devuelve capacidad, reserva o conteos.
- **Decisión de hardening aplicada:** la familia usa `FamilyExecutionContext`, derivado de sesión válida y relación `FamilyProfile`, sin `tenantId`. Las rutas globales de perfil/estudiantes no aceptan autoridad tenant. El tenant candidato sólo particiona el descubrimiento público mediante `public_admission`; para crear una postulación, el tenant efectivo se deriva de la oferta publicada verificada.
- **Decisión de hardening aplicada:** `AuditEvent` usa `scope=TENANT` con `tenantId` obligatorio para configuración/postulaciones y `scope=PLATFORM_GLOBAL` con `tenantId=NULL` sólo para `FAMILY_PROFILE_*` y `STUDENT_*`, insertable por una frontera transaccional estrecha.
- **Pregunta abierta preservada:** login/verificación completos, retención/eliminación, textos legales/C-013 y política MFA no se resuelven en E5-A.

## Trazabilidad implementada

| Requirement | Implementation | Tests | Status |
| --- | --- | --- | --- |
| BL-001 | `tenantId` NOT NULL en todas las tablas tenant-owned; RLS + FORCE RLS; contexto transaccional; DTO y repositorio tenant-aware | `E5A-TEN-01..04`, `pnpm test:rls` `8/8`; `E4 POC-01..08` | PARTIAL / CROSS-CUTTING |
| BL-002 | Perfil familiar global vinculado a `PlatformUser`; múltiples `Student`; ownership por `familyProfileId` | `E5A-TEN-05`; pruebas de creación/listado/edición | PARTIAL — intake only |
| BL-003 | Configuración `Campus → AcademicYear → AdmissionProcess → AdmissionOffering`; oferta publicada, vigente y disponibilidad categórica | Proyección categórica; predicado de vigencia; RLS config; `E5A-VIG-01..10` | PARTIAL |
| BL-005 | Crear, listar, recuperar y guardar `Application` en único estado `DRAFT`; sin submission/snapshot final | `E5A-CON-01`; `Application` service tests | PARTIAL — draft only |
| BL-019 | Catálogo explícito: `admission.config.read`, `admission.config.manage`, `family.profile.read/write`, `student.read/write`, `offering.public.read`, `application.create/read/write` | Authorization foundation E4 + service authorization tests | PARTIAL — slice permissions |
| BL-020 | `AuditEvent` append-only con scope tenant o platform/global explícito; eventos de configuración y postulación quedan tenant-owned; perfil/estudiante global no se asignan artificialmente a un tenant | `E5A-AUD-01..05`; audit assertions in E5-A integration and HTTP suites | PARTIAL — slice events |
| BL-021 | CRUD mínimo de campus, año, curso, proceso y oferta; sin builder completo | Configuration service/integration coverage | PARTIAL |

No se declaran completos BL-004, BL-006..BL-018 ni BL-022. E5-A tampoco implementa `SUBMITTED`, snapshot inmutable de submission, documentos, agenda, diagnóstico, recomendación, decisión, cupos/reservas, waitlist, oferta de admisión, emails, reportes o handoff EduPay.

## Acceptance criteria y E2E trazados

| Fuente | Cobertura E5-A | Estado |
| --- | --- | --- |
| AC-002, AC-003, AC-051 | Perfil/estudiante/postulación propios; ownership familiar; múltiples estudiantes | PARTIAL / covered for implemented resources |
| AC-004, AC-005, AC-006 | Oferta publicada y vigente por tenant/sede/año/curso; categorías `POSTULATIONS_OPEN`, `LIMITED_CAPACITY`, `WAITLIST`, `PROCESS_CLOSED`; advertencia sin promesa | COVERED — `E5A-VIG-01..10`, categorical DTO assertions and draft-start tests |
| AC-050 | RLS y tenant authorization deny-by-default | COVERED for E5-A tables and operations |
| AC-007..AC-009, AC-010..AC-049, AC-052..AC-058 | Se mantienen fuera de E5-A salvo el texto de DRAFT/alcance cuando corresponde | DEFERRED |
| E2E-001 | Sólo tramo familia → oferta → DRAFT → guardar/recuperar; no envío ni etapas posteriores | PARTIAL |
| E2E-018 | Acceso cross-tenant a configuración y recursos de intake | PARTIAL / covered for E5-A resources |

## Vigencia de AdmissionOffering

La única regla de vigencia estructural se implementa en
`isAdmissionOfferingCurrent(offering, now)` y exige simultáneamente:

```text
offering.status = PUBLISHED
process.status = PUBLISHED
academicYear.status = OPEN
opensAt IS NULL OR opensAt <= now
closesAt IS NULL OR closesAt > now
```

`opensAt` es inclusivo: `now == opensAt` mantiene vigente la convocatoria.
`closesAt` es exclusivo: `now == closesAt` la hace no vigente. El reloj se
inyecta en discovery y creación de draft para que las reglas sean
deterministas en pruebas.

La familia sólo descubre ofertas que cumplen todo el predicado. Una oferta
estructuralmente vigente con `availabilityCategory=PROCESS_CLOSED` sigue
siendo proyectable como `Proceso cerrado`, pero no permite iniciar un draft.
`POSTULATIONS_OPEN`, `LIMITED_CAPACITY` y `WAITLIST` permiten iniciar el draft
en E5-A; `WAITLIST` no crea todavía una `WaitlistEntry` y ninguna categoría
expone cupos exactos. Años `DRAFT`/`CLOSED`, procesos `DRAFT`/`CLOSED` y
ventanas futuras/vencidas quedan fuera de discovery y no aceptan nuevos
drafts. Crear o actualizar un proceso con `opensAt >= closesAt` retorna
`IntakeValidationError` y la API lo proyecta como HTTP 400.

Esta corrección es sólo de dominio/servicio/tests: no agrega migration ni
modifica migrations publicadas.

## Modelo y tenancy

| Entity | Classification | Ownership/control |
| --- | --- | --- |
| `PlatformUser`, `FamilyProfile`, `Student` | GLOBAL / CONTROL-PLANE / global family-owned | `FamilyProfile.userId` y `Student.familyProfileId`; no se agrega `tenantId` artificial |
| `Campus`, `AcademicYear`, `CourseLevel`, `AdmissionProcess`, `AdmissionOffering` | TENANT-OWNED | `tenantId NOT NULL`, same-tenant composite foreign keys, RLS/FORCE RLS, explicit grants |
| `Application` | TENANT-OWNED | `tenantId`, offering/process/year same tenant, family/student ownership server-side, RLS/FORCE RLS |
| `AuditEvent` | MIXED: TENANT-OWNED o PLATFORM-SCOPED explícito | `scope=TENANT` exige `tenantId` y RLS tenant; `scope=PLATFORM_GLOBAL` exige `tenantId=NULL`, acción allowlisted y primitive transaccional global; no existe lectura runtime cross-tenant |

La elección de `AdmissionOffering` conserva el concepto canónico de E2 y evita crear variantes paralelas de `CourseOffering`. `AcademicYear` y `CourseLevel` se materializan porque E2 los define como configuración tenant-owned necesaria para sostener las relaciones y la clave de duplicidad. No se creó `User`, `AuthUser` ni `Account` paralelo.

## Migration, RLS y grants

- Nueva migration forward de hardening: `packages/database/prisma/migrations/20260809090000_e5a_review_hardening/migration.sql`. No se modificó `20260808200000_e5a_intake_core`.
- Fresh: `pnpm db:reset` + `pnpm db:migrate` aplica `5/5` migrations, incluyendo E5-A y el hardening.
- Incremental: base con las `3` migrations E4 y `20260808200000_e5a_intake_core`; la migración de hardening se aplica como único forward upgrade posterior.
- Todas las tablas tenant-owned E5-A tienen `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, policy `USING` y `WITH CHECK` sobre `admission.tenant_id`.
- `audit_events` conserva grants explícitos; el runtime sólo puede insertar globales cuando la transacción fija `admission.audit_scope=platform_global`, y el rol de migración sólo puede leer filas `PLATFORM_GLOBAL` para evidencia. No existe permiso runtime para leer auditoría global.
- Los demás grants son explícitos: no se usan `ALTER DEFAULT PRIVILEGES`; el runtime no recibe `DELETE` sobre aplicaciones/auditoría ni `UPDATE/DELETE` sobre auditoría.
- Ownership de estructura queda en `admission_migrator`; runtime `admission_app` mantiene `NOSUPERUSER`, `NOBYPASSRLS`.

## API y autorización

La API NestJS valida DTOs con Zod, usa allowlists `.strict()`, resuelve la sesión opaca desde `admission_session`, exige CSRF más `Origin` y/o `Referer` en mutaciones y nunca usa `X-User-Id`, `X-Tenant-Id` o `X-Role` como autoridad.

`FamilyExecutionContext` contiene actor, actor efectivo, correlación, propósito,
origen y capacidades familiares. No contiene `tenantId`, membership
institucional ni permisos de admisión. `resolvePublicAdmissionContext` sólo
expone `offering.public.read` para el tenant activo seleccionado y la
proyección pública; `listPublicOfferings` aplica además el predicado de
vigencia. Por tanto, el tenant de la URL sólo particiona el descubrimiento
público. El contexto de `Application` se construye después de verificar la
relación familia/estudiante y de resolver la oferta vigente: el tenant efectivo
proviene de la oferta, no de la URL.

### Familia global y descubrimiento

- `GET /family/profile`
- `PUT /family/profile`
- `GET /family/students`
- `POST /family/students`
- `PATCH /family/students/:studentId`
- `GET /family/tenants/:tenantId/offerings`
- `POST /family/tenants/:tenantId/applications`
- `GET /family/tenants/:tenantId/applications`
- `GET /family/tenants/:tenantId/applications/:applicationId`
- `PATCH /family/tenants/:tenantId/applications/:applicationId/draft`

### Administración mínima

- `GET /admin/tenants/:tenantId/configuration`
- `POST/PATCH /admin/tenants/:tenantId/campuses`
- `POST /admin/tenants/:tenantId/academic-years`
- `POST /admin/tenants/:tenantId/course-levels`
- `POST/PATCH /admin/tenants/:tenantId/processes`
- `POST/PATCH /admin/tenants/:tenantId/offerings`
- `GET /auth/csrf`

Errores públicos conservan 401/403/404/409/400, `correlationId` y mensaje genérico; ownership ajeno se proyecta como inexistente y no enumera recursos.

## Invariantes relacionales, duplicidad y concurrencia

La migration de hardening agrega claves únicas compuestas y foreign keys
compuestas para impedir mezclar `academicYear`, `process` y `offering`:

- `AdmissionOffering.(tenantId, processId, academicYearId)` referencia al
  proceso del mismo tenant y año.
- `Application.(tenantId, offeringId, processId, academicYearId)` referencia a
  la misma oferta, proceso y año.

El servicio valida además las relaciones antes de persistir y convierte una
inconsistencia en error seguro, no en un HTTP 500. `E5A-INV-01` rechaza
process/year incompatibles, `E5A-INV-02` confirma el rechazo de una combinación
raw/runtime incompatible en DB y `E5A-INV-03` confirma que la combinación válida
continúa funcionando.

La base aplica un índice único parcial:

`tenantId + academicYearId + processId + studentId + offeringId WHERE status = DRAFT`.

La oferta se resuelve server-side y la familia sólo puede crear el draft para su propio estudiante. `E5A-CON-01` ejecuta 20 intentos concurrentes sin locks en memoria: resultado observado `1` éxito, `19` `409/conflict` y exactamente `1` Application DRAFT activa.

## Auditoría

Los eventos de configuración y postulación se registran dentro de la
transacción tenant-owned; la denegación por unique conflict se registra en una
transacción de seguimiento después del rollback del intento fallido. Los
eventos de perfil/estudiante global usan `withPlatformAuditTransaction`, una
frontera allowlisted que fija `admission.audit_scope=platform_global` y deriva
actor/effective actor del `FamilyExecutionContext`. No aceptan tenant de cliente
y no habilitan lectura de auditoría tenant.

- `ADMISSION_CAMPUS_CREATED/UPDATED`;
- `ADMISSION_ACADEMIC_YEAR_CREATED`;
- `ADMISSION_COURSE_LEVEL_CREATED`;
- `ADMISSION_PROCESS_CREATED/UPDATED`;
- `ADMISSION_OFFERING_CREATED/UPDATED`;
- `STUDENT_CREATED/UPDATED`;
- `APPLICATION_DRAFT_CREATED`;
- `APPLICATION_DRAFT_UPDATED`;
- `APPLICATION_DRAFT_DUPLICATE_DENIED`.

No se guarda el payload completo del draft ni se audita cada keystroke.
La composición persistente de auditoría de sesiones/security events de E4
continúa diferida: `SessionService` conserva los sinks explícitos de E4 y esta
ronda no los declara persistentes.

## UI y accesibilidad

La UI Next 16 implementa sólo:

- inicio familiar;
- estudiantes, alta mínima y selección;
- ofertas/disponibilidad categórica;
- iniciar borrador, consultar/listar y guardar DRAFT;
- configuración administrativa mínima para sede, año, curso, proceso y oferta.

Incluye labels asociados, headings, skip link, foco visible, navegación por teclado, estados loading/empty/error, `aria-live`, touch targets, reflujo mobile-first, advertencias textuales sin depender del color y `prefers-reduced-motion`. No se inventa branding final. La pantalla no importa Prisma ni contiene lógica de negocio; las mutaciones pasan por API.

## Evidencia de hardening de revisión

| Requirement | Implementation | Tests | Status |
| --- | --- | --- | --- |
| E5A-INV-01 | Validación service y FK compuesta process/year | `E5A-INV-01` | PASS |
| E5A-INV-02 | FK compuesta offering/process/year en `Application` | `E5A-INV-02` | PASS |
| E5A-INV-03 | Oferta válida conserva el flujo de draft | `E5A-INV-03` | PASS |
| E5A-VIG-01..10 | Predicate único de vigencia, ventanas inclusiva/exclusiva, estados de proceso/año y gating por categoría | `packages/database/src/intake.integration.spec.ts` | PASS — 10/10 |
| E5A-HTTP-01..12 | NestJS real en puerto efímero + cookie de sesión opaca + `fetch` nativo | `apps/api/src/intake.http.integration.spec.ts` | PASS — 12/12 |
| E5A-HTTP-13 | Proceso publicado vencido no permite iniciar un draft por HTTP | `apps/api/src/intake.http.integration.spec.ts` | PASS |
| E5A-AUD-01..05 | Eventos globales platform-scoped y eventos tenant-scoped separados por RLS | `packages/database/src/intake.integration.spec.ts` y suite HTTP | PASS |
| E5A-TEN-01..06 | RLS tenant, contextos ausentes, pooling y ownership de recurso | `pnpm test:rls` + E5-A integration | PASS |
| E5A-CON-01 | Índice único de draft activo; sin locks en memoria | 20 intentos concurrentes | PASS — 1 éxito, 19 conflictos |

La suite HTTP no usa `X-User-Id`, `X-Tenant-Id` ni `X-Role`; las sesiones y
relaciones sintéticas se crean mediante primitives internas de test.

## Validaciones ejecutadas

| Check | Resultado |
| --- | --- |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm db:generate` | PASS |
| Fresh migration (`pnpm db:reset` + `pnpm db:migrate`) | PASS — 5/5 |
| Incremental migration (E4 + E5-A original → hardening) | PASS — validación previa; esta ronda no agrega migration |
| `pnpm test` | PASS — 95/95, 12 test files |
| `pnpm test:rls` | PASS — 8/8 |
| E5-A integration suite | PASS — 20/20 |
| E5-A HTTP integration suite | PASS — 13/13 |
| `pnpm build` | PASS — worker, web, database, API |
| `pnpm security:secrets` | PASS — `193` tracked files |
| `pnpm security:deps` | PASS — no known high vulnerabilities |
| `docker compose config` | PASS |
| `git diff --check` | PASS; sólo warnings CRLF de Windows |
| E4 deploy smoke | PASS — `pnpm e4:deploy:smoke`; build, migrator, API, web y worker readiness verificados |

## Seguridad, datos y fuera de alcance

Se confirmó que no se agregaron RUT reales, emails reales, documentos reales, secretos, credenciales de integración ni llamadas EduPay. Los ejemplos usan `example.invalid`, identificadores sintéticos y textos sintéticos.

Fuera de alcance explícito: builder/formulario publicado, submission final, snapshot inmutable de submission, documentos, agenda, entrevista, diagnóstico, recomendación, decisión Dirección, cupos/reservas, waitlist operacional, oferta de admisión, emails, reportes, handoff EduPay y Q-301..Q-309.

## Compuerta

E5-A queda `COMPLETE` con el alcance parcial descrito. E5 permanece `IN
PROGRESS / E5-A COMPLETE`, E5-B `NOT_STARTED` y G5 `NO APROBADA`. No se
solicita merge, producción ni integración EduPay desde este documento.
