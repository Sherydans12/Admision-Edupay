# E5-A — Evidencia de Intake core

## Control de alcance

| Campo | Resultado |
| --- | --- |
| Estado | `COMPLETE` |
| Rama | `feat/e5-mvp` |
| HEAD de entrada | `d1362d979e7780171312c96907614d9ae25ddf9a` |
| Compuerta | G4 `APPROVED / CLOSED`; G5 `NO APROBADA` |
| Datos | Sólo sintéticos/non-production |
| Producción/piloto | No autorizados |
| EduPay | Sin llamadas ni tablas compartidas |
| Q-301..Q-309 | No resueltas |
| Siguiente etapa | E5-B, requiere revisión/aprobación humana separada |

## Hechos, decisiones y supuestos

- **Hecho confirmado:** E4 entrega `PlatformUser`, `PlatformSession`, `Tenant`, `Membership`, `RoleAssignment`, contexto tenant transaccional y sesión opaca server-side.
- **Decisión aprobada aplicada:** `FamilyProfile` y `Student` son globales/family-owned; `Campus`, `AcademicYear`, `CourseLevel`, `AdmissionProcess`, `AdmissionOffering`, `Application` y `AuditEvent` son tenant-owned.
- **Decisión aprobada aplicada:** la proyección familiar de disponibilidad sólo devuelve la categoría pública; no devuelve capacidad, reserva o conteos.
- **Supuesto de trabajo:** la familia selecciona un tenant activo para descubrir ofertas públicas; la selección sólo particiona la consulta pública. La autorización de postulaciones y estudiantes se verifica por ownership server-side, no por el `tenantId` del cliente.
- **Pregunta abierta preservada:** login/verificación completos, retención/eliminación, textos legales/C-013 y política MFA no se resuelven en E5-A.

## Trazabilidad implementada

| Requirement | Implementation | Tests | Status |
| --- | --- | --- | --- |
| BL-001 | `tenantId` NOT NULL en todas las tablas tenant-owned; RLS + FORCE RLS; contexto transaccional; DTO y repositorio tenant-aware | `E5A-TEN-01..04`, `pnpm test:rls` `8/8`; `E4 POC-01..08` | PARTIAL / CROSS-CUTTING |
| BL-002 | Perfil familiar global vinculado a `PlatformUser`; múltiples `Student`; ownership por `familyProfileId` | `E5A-TEN-05`; pruebas de creación/listado/edición | PARTIAL — intake only |
| BL-003 | Configuración `Campus → AcademicYear → AdmissionProcess → AdmissionOffering`; oferta publicada y disponibilidad categórica | Proyección categórica; RLS config; `AC-004..AC-006` cubiertos en el slice | PARTIAL |
| BL-005 | Crear, listar, recuperar y guardar `Application` en único estado `DRAFT`; sin submission/snapshot final | `E5A-CON-01`; `Application` service tests | PARTIAL — draft only |
| BL-019 | Catálogo explícito: `admission.config.read`, `admission.config.manage`, `family.profile.read/write`, `student.read/write`, `offering.public.read`, `application.create/read/write` | Authorization foundation E4 + service authorization tests | PARTIAL — slice permissions |
| BL-020 | `AuditEvent` append-only tenant-owned; eventos de configuración, estudiante, draft y duplicate denial; metadata allowlisted | Audit assertions in E5-A integration suite | PARTIAL — slice events |
| BL-021 | CRUD mínimo de campus, año, curso, proceso y oferta; sin builder completo | Configuration service/integration coverage | PARTIAL |

No se declaran completos BL-004, BL-006..BL-018 ni BL-022. E5-A tampoco implementa `SUBMITTED`, snapshot inmutable de submission, documentos, agenda, diagnóstico, recomendación, decisión, cupos/reservas, waitlist, oferta de admisión, emails, reportes o handoff EduPay.

## Acceptance criteria y E2E trazados

| Fuente | Cobertura E5-A | Estado |
| --- | --- | --- |
| AC-002, AC-003, AC-051 | Perfil/estudiante/postulación propios; ownership familiar; múltiples estudiantes | PARTIAL / covered for implemented resources |
| AC-004, AC-005, AC-006 | Oferta publicada por tenant/sede/año/curso y categorías `POSTULATIONS_OPEN`, `LIMITED_CAPACITY`, `WAITLIST`, `PROCESS_CLOSED`; advertencia sin promesa | COVERED for availability projection and draft start |
| AC-050 | RLS y tenant authorization deny-by-default | COVERED for E5-A tables and operations |
| AC-007..AC-009, AC-010..AC-049, AC-052..AC-058 | Se mantienen fuera de E5-A salvo el texto de DRAFT/alcance cuando corresponde | DEFERRED |
| E2E-001 | Sólo tramo familia → oferta → DRAFT → guardar/recuperar; no envío ni etapas posteriores | PARTIAL |
| E2E-018 | Acceso cross-tenant a configuración y recursos de intake | PARTIAL / covered for E5-A resources |

## Modelo y tenancy

| Entity | Classification | Ownership/control |
| --- | --- | --- |
| `PlatformUser`, `FamilyProfile`, `Student` | GLOBAL / CONTROL-PLANE / global family-owned | `FamilyProfile.userId` y `Student.familyProfileId`; no se agrega `tenantId` artificial |
| `Campus`, `AcademicYear`, `CourseLevel`, `AdmissionProcess`, `AdmissionOffering` | TENANT-OWNED | `tenantId NOT NULL`, same-tenant composite foreign keys, RLS/FORCE RLS, explicit grants |
| `Application` | TENANT-OWNED | `tenantId`, offering/process/year same tenant, family/student ownership server-side, RLS/FORCE RLS |
| `AuditEvent` | TENANT-OWNED | `tenantId`, append-only grants (`SELECT, INSERT`), RLS/FORCE RLS |

La elección de `AdmissionOffering` conserva el concepto canónico de E2 y evita crear variantes paralelas de `CourseOffering`. `AcademicYear` y `CourseLevel` se materializan porque E2 los define como configuración tenant-owned necesaria para sostener las relaciones y la clave de duplicidad. No se creó `User`, `AuthUser` ni `Account` paralelo.

## Migration, RLS y grants

- Nueva migration forward: `packages/database/prisma/migrations/20260808200000_e5a_intake_core/migration.sql`.
- Fresh: `pnpm db:reset` + `pnpm db:migrate` aplicó `4/4` migrations, incluyendo E5-A.
- Incremental: base local temporal con las `3` migrations E4 aplicadas por Prisma; segundo `prisma migrate deploy` aplicó sólo `20260808200000_e5a_intake_core` correctamente. La base temporal fue eliminada.
- Todas las tablas tenant-owned E5-A tienen `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, policy `USING` y `WITH CHECK` sobre `admission.tenant_id`.
- Los grants son explícitos: no se usan `ALTER DEFAULT PRIVILEGES`; el runtime no recibe `DELETE` sobre aplicaciones/auditoría ni `UPDATE/DELETE` sobre auditoría.
- Ownership de estructura queda en `admission_migrator`; runtime `admission_app` mantiene `NOSUPERUSER`, `NOBYPASSRLS`.

## API y autorización

La API NestJS valida DTOs con Zod, usa allowlists `.strict()`, resuelve la sesión opaca desde `admission_session`, exige CSRF + Origin/Referer en mutaciones y nunca usa `X-User-Id`, `X-Tenant-Id` o `X-Role` como autoridad.

### Familia

- `GET /family/tenants/:tenantId/profile`
- `PUT /family/tenants/:tenantId/profile`
- `GET /family/tenants/:tenantId/students`
- `POST /family/tenants/:tenantId/students`
- `PATCH /family/tenants/:tenantId/students/:studentId`
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

## Invariant de duplicidad y concurrencia

La base aplica un índice único parcial:

`tenantId + academicYearId + processId + studentId + offeringId WHERE status = DRAFT`.

La oferta se resuelve server-side y la familia sólo puede crear el draft para su propio estudiante. `E5A-CON-01` ejecuta 20 intentos concurrentes sin locks en memoria: resultado observado `1` éxito, `19` `409/conflict` y exactamente `1` Application DRAFT activa.

## Auditoría

Los eventos de éxito se registran dentro de la transacción de negocio; la denegación por unique conflict se registra en una transacción de seguimiento después del rollback del intento fallido. Todos conservan actor/effective actor, tenant, purpose, correlation y metadata mínima:

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

## UI y accesibilidad

La UI Next 16 implementa sólo:

- inicio familiar;
- estudiantes, alta mínima y selección;
- ofertas/disponibilidad categórica;
- iniciar borrador, consultar/listar y guardar DRAFT;
- configuración administrativa mínima para sede, año, curso, proceso y oferta.

Incluye labels asociados, headings, skip link, foco visible, navegación por teclado, estados loading/empty/error, `aria-live`, touch targets, reflujo mobile-first, advertencias textuales sin depender del color y `prefers-reduced-motion`. No se inventa branding final. La pantalla no importa Prisma ni contiene lógica de negocio; las mutaciones pasan por API.

## Validaciones ejecutadas

| Check | Resultado |
| --- | --- |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — `68/68`, `11` test files |
| `pnpm test:rls` | PASS — `8/8` |
| E5-A integration suite | PASS — `6/6` |
| `pnpm build` | PASS — worker, web, database, API |
| `pnpm security:secrets` | PASS — `182` tracked files |
| `pnpm security:deps` | PASS — no known high vulnerabilities |
| `docker compose config` | PASS |
| `git diff --check` | PASS; sólo warnings CRLF de Windows |
| E4 deploy smoke | PASS — `pnpm e4:deploy:smoke`; build, migrator, API, web y worker readiness verificados |

## Seguridad, datos y fuera de alcance

Se confirmó que no se agregaron RUT reales, emails reales, documentos reales, secretos, credenciales de integración ni llamadas EduPay. Los ejemplos usan `example.invalid`, identificadores sintéticos y textos sintéticos.

Fuera de alcance explícito: builder/formulario publicado, submission final, snapshot inmutable de submission, documentos, agenda, entrevista, diagnóstico, recomendación, decisión Dirección, cupos/reservas, waitlist operacional, oferta de admisión, emails, reportes, handoff EduPay y Q-301..Q-309.

## Compuerta

E5-A queda `COMPLETE` con el alcance parcial descrito. E5 permanece `IN PROGRESS / E5-A COMPLETE`. G5 permanece `NO APROBADA`. La siguiente acción humana es revisar este slice y decidir si autoriza iniciar E5-B; no se solicita merge ni producción desde este documento.
