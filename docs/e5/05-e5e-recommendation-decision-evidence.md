# E5-E — Evidencia de recomendación y disposición

## Estado de la ronda

**Estado:** implementación E5-E realizada; validación PostgreSQL/CI pendiente por
indisponibilidad del motor Docker local. No se solicita G5.

**Alcance:** `BL-010` Recomendación de Admisión y `BL-011` Disposición de
Dirección. Se mantienen Admisión y EduPay desacoplados. Todos los ejemplos y
fixtures son sintéticos y locales.

### Clasificación de información

- **Hechos confirmados:** las fuentes vinculantes definen las opciones y disposiciones canónicas, la separación de funciones, la privacidad familiar y el orden de los slices.
- **Decisiones de implementación:** cuatro tablas tenant-owned, versión DRAFT/SUBMITTED para recomendación, historia append-only para decisión, punteros de versión vigente y locks por `Application`.
- **Supuestos de trabajo:** `currentVersionId` representa la última recomendación enviada; una corrección DRAFT posterior a `DEVUELTO_A_REVISION` no mueve ese puntero hasta su nuevo submit; `ANTECEDENTS_REQUIRE_REVIEW` es sólo warning.
- **Preguntas abiertas:** `Q-106` continúa diferida; `C-013` requiere validación legal; `Q-301..Q-309` siguen pendientes de integración futura. No se inventó algoritmo de suficiencia, score, ranking ni prioridad.

## Fuentes vinculantes

Se revisaron las secciones solicitadas de:

- `docs/e1/11-functional-specification.md`, secciones 12 y 13;
- `docs/e1/12-acceptance-criteria.md`, `AC-022..AC-028`;
- `docs/e1/13-end-to-end-scenarios.md`, `E2E-001`, `E2E-009..E2E-011`;
- `docs/e1/14-mvp-backlog.md`, `BL-010`, `BL-011`, soporte `BL-019`, `BL-020`;
- `docs/e2/03-logical-data-model.md`, `AdmissionRecommendation*`, `DirectionDecision*`;
- `docs/e2/04-multitenancy-authorization-architecture.md` y `docs/e2/06-concurrency-and-consistency.md`;
- `docs/e3/02-screen-inventory.md`, `SCR-STAFF-011`, `SCR-STAFF-012`;
- `docs/e3/04-staff-critical-flows.md`, A5 y D1..D4;
- `docs/e3/05-case-workspace.md`, `docs/e3/07-content-visibility-matrix.md`, `docs/e3/08-accessibility-responsive.md`;
- `docs/e5/00-e5-plan-and-status.md` y `docs/e5/04-e5d-activities-evidence.md`.

## Modelo y persistencia

Se agregan en la migration 11 `20260811090000_e5e_recommendation_decision`:

- `AdmissionRecommendation`: root estable, único por `Application`.
- `AdmissionRecommendationVersion`: `option`, `foundation`, `DRAFT/SUBMITTED`, `createdBy`, `submittedBy`, timestamps, `previousVersionId` y manifest de evidencia.
- `DirectionDecision`: root estable, único por `Application`.
- `DirectionDecisionVersion`: `recommendationVersionId`, disposición, fundamento/motivo, decisor, timestamp, predecesora y manifest.

Enums exactos:

- Recomendación: `RECOMENDAR_ADMISION`, `NO_RECOMENDAR_ADMISION`, `DEVOLVER_A_REVISION`.
- Dirección: `APROBADO`, `LISTA_DE_ESPERA`, `RECHAZADO`, `DEVUELTO_A_REVISION`.
- Lifecycle de recomendación: `DRAFT`, `SUBMITTED`.

Las versiones enviadas no se actualizan ni eliminan por el rol de aplicación;
el manifest queda sellado al submit. La versión DRAFT puede editarse. La historia
usa FK tenant-safe, FK same-root, FK same-application, anti-self checks y
unicidad de número de versión.

## Fundamento, readiness y manifest

El fundamento de recomendación siempre es obligatorio. `RECHAZADO` exige
fundamento; `DEVUELTO_A_REVISION` exige motivo. `APROBADO` y `LISTA_DE_ESPERA`
admiten comentario interno opcional. Los textos se recortan, limitan y rechazan
si contienen HTML activo, handlers o `javascript:`.

El readiness muestra únicamente el contexto mínimo: postulación enviada,
estado documental y estado operacional de actividades. `ANTECEDENTS_REQUIRE_REVIEW`
no bloquea ni decide automáticamente.

El `evidenceManifest` conserva referencias, no expediente:
`applicationSnapshotId`, IDs de evidencia documental, actividades, intentos y
resultados cuando el permiso sensible lo permite, más la versión de recomendación
usada por Dirección. No copia archivos, contenido, comentarios ni datos PIE/NEE
o de salud.

## Autorización, sensibilidad y SoD

Se reutilizan `application.recommend`, `application.decide` y `restricted.read`.
Cada lectura/escritura exige permiso, tenant, scope derivado de `Application`
(`application`, `offering`, `process`, `campus`), sensibilidad
`highly_restricted`, propósito y, cuando aplica, elevación válida.

La separación compara `effectiveActorId ?? actorId` contra
`RecommendationVersion.submittedBy`; no usa nombres, correo ni rol textual.
La misma identidad recibe `403` y no se inserta ninguna fila de decisión.
Secretary no recibe las capacidades por configuración de código.

La lectura de `ActivityResult` se evalúa aparte con `activity.result.read` y
sensibilidad elevada. Sin ese permiso la UI muestra `Información restringida no
disponible` sin romper el workflow; además, los `activityResultIds` se omiten de
los manifiestos históricos devueltos a ese actor.

## Flujos y cross-slice

### Admisión

`Application SUBMITTED` → DRAFT → selección canónica + fundamento → submit →
versión `SUBMITTED` inmutable. El reintento devuelve la misma versión y no duplica
historia. Una corrección después de devolución crea V2 y conserva V1.

### Dirección

La operación exige `expectedRecommendationVersionId`, bloquea el caso, valida la
versión enviada vigente y registra una nueva versión append-only. Una versión
stale devuelve `409 RECOMMENDATION_VERSION_CHANGED`.

- `APROBADO`: persiste el hecho favorable; no crea reserva, oferta, deadline, comunicación ni handoff.
- `LISTA_DE_ESPERA`: persiste la disposición; no crea `WaitlistEntry`, posición, prioridad, reserva u oferta.
- `RECHAZADO`: persiste la disposición con fundamento; comunicación queda E5-G.
- `DEVUELTO_A_REVISION`: persiste motivo, no es definitiva y habilita una recomendación posterior.

No se agregan endpoints familiares para recomendación, fundamento, decisión,
motivo, resultados internos ni historia.

## HTTP y UI

Superficies staff implementadas:

- `GET /staff/tenants/:tenantId/applications/:applicationId/recommendation-workspace`
- `GET /staff/tenants/:tenantId/applications/:applicationId/recommendations`
- `POST /staff/tenants/:tenantId/applications/:applicationId/recommendations/drafts`
- `PATCH /staff/tenants/:tenantId/recommendation-versions/:versionId`
- `POST /staff/tenants/:tenantId/recommendation-versions/:versionId/submit`
- `GET /staff/tenants/:tenantId/applications/:applicationId/direction-workspace`
- `POST /staff/tenants/:tenantId/applications/:applicationId/direction-decisions`

Los schemas Zod son `.strict()` y no aceptan tenant, actor, rol, scope,
`submittedBy` ni `decidedBy` desde el body. Las mutaciones exigen CSRF.

`SCR-STAFF-011` muestra “Recomendación interna”, las tres opciones exactas,
textarea obligatorio, guardar borrador, enviar a Dirección, confirmación e
historia autorizada. `SCR-STAFF-012` muestra resumen mínimo, recomendación
enviada, cuatro opciones exactas, efectos previos a confirmar e historia. No
existen botones de email, matrícula ni handoff.

Se conserva WCAG 2.2 AA: labels, fieldset/radio semantics, focus visible,
`aria-live`, estados de carga/conflicto, errores de textarea, confirmación con
foco inicial, responsive D1/T1 y no dependencia de color único.

## Pruebas y validación

IDs dirigidos implementados en `recommendation.integration.spec.ts`:

- `E5EE-REC-01..08`: submission requerida, DRAFT, opciones, submit idempotente, historial e inmutabilidad.
- `E5EE-DEC-01..08`: devolución, V2, stale, rechazo y disposición sin efectos downstream.
- `E5EE-SOD-01`: mismo effective actor denegado sin filas.
- `E5EE-PRIV-01..06`: la superficie de familia no obtiene campos ni endpoints internos.
- `E5EE-CON-02`: 20 decisiones concurrentes → una versión final.

Smoke reproducible agregado: `pnpm e5e:migration:smoke`, que verifica fresh
0→11, incremental 10→11, tablas, enums, RLS/FORCE, triggers append-only y
constraints tenant-safe.

Validaciones ejecutadas en esta ronda:

| Control | Resultado |
| --- | --- |
| `pnpm db:generate` | PASS |
| Prisma schema validate | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm format:check` | PASS |
| `git diff --check` | PASS |
| `pnpm e5e:migration:smoke` | PENDIENTE: Docker/daemon PostgreSQL no disponible |
| `pnpm test` / `pnpm test:rls` | PENDIENTE: requieren PostgreSQL local |
| `pnpm build` | PASS |
| `pnpm security:secrets` | PASS; 229 archivos versionados inspeccionados |
| `pnpm security:deps` | PASS; sin vulnerabilidades conocidas de severidad alta |
| `docker compose config` | PASS |
| smokes anteriores y CI | PENDIENTE de ejecución final |

No se declaran cifras de regresión ni CI verde sin ejecutarlas en este entorno.

## Trazabilidad y compuerta

- `BL-010` → recommendation root/version, A5, `SCR-STAFF-011`.
- `BL-011` → decision root/version, D1..D4, `SCR-STAFF-012`.
- `AC-022` = `COVERED`.
- `AC-023` = `COVERED`.
- `AC-024` = `COVERED`.
- `AC-025` = `PARTIAL / DOWNSTREAM_E5F_E5G`.
- `AC-026` = `PARTIAL / DOWNSTREAM_E5F`.
- `AC-027` = `COVERED` para la decisión; comunicación posterior.
- `AC-028` = `COVERED`.
- `E2E-009` = `COVERED` en recomendación V1, devolución, V2 y decisión contra V2.
- `E2E-010` = `DECISION_COVERED / COMMUNICATION_E5G`.
- `E2E-011` = `DECISION_COVERED / WAITLIST_E5F`.
- `E5-F` = `NOT_STARTED`; `G5` = `NO APROBADA`.
- `Q-106` = `DEFERRED`; `C-013` = `LEGAL_VALIDATION_PENDING`;
  `Q-301..Q-309` = `FUTURE_INTEGRATION_PENDING`.

La siguiente acción humana es habilitar PostgreSQL/Docker local o CI y ejecutar
la matriz completa antes de cambiar E5-E a `COMPLETE_WITH_DOWNSTREAM_E5F_E5G`.
