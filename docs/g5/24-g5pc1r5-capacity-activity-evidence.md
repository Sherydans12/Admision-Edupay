# G5-PC1-R5 — Evidencia de capacidad y configuración de actividades

**Fecha de cierre técnico:** 2026-08-24

**Incremento:** `PC1-R5` (`PC1-TECH-013`, `PC1-TECH-014`, `PC1-TECH-015`)

**Decisiones:** `R5-D-001..009`

**Datos usados:** exclusivamente sintéticos

**Disposición:** `COMPLETE / TECHNICALLY_REVIEWED`

## 1. Fuente autorizada y límites

La aprobación humana recibida el 2026-08-24 autorizó `R5-D-001..009` y Migration 20
exclusivamente con datos sintéticos. El contrato aprobado está versionado en
[`22-g5pc1r5-capacity-activity-design.md`](22-g5pc1r5-capacity-activity-design.md).

Esta entrega no autoriza ni ejecuta preproducción, piloto, datos personales reales,
producción, proveedores productivos, pentest/DAST ni integración técnica con EduPay.
`G5` continúa `NO APROBADA / NOT REQUESTED`.

## 2. Resultado por requisito

| ID | Resultado técnico | Evidencia principal |
| --- | --- | --- |
| `PC1-TECH-013` | La oferta nace sólo `DRAFT`; publicar/cerrar exige comando explícito y versión esperada. Ausencia de capacidad bloquea; cero es configuración válida, nunca ilimitada. Discovery y creación de postulaciones fallan de forma cerrada ante ofertas legacy sin capacidad. | `intake.ts`, suites de intake/capacity/API y UI staff/familia |
| `PC1-TECH-014` | Política por `tenant + kind` con baseline de inicialización entrevista 30 y diagnóstico 60. La duración efectiva resuelve `VERSION_OVERRIDE > TENANT_POLICY_DEFAULT`; el valor queda fijado en la versión y el histórico no se reescribe. | `activity-policy.ts`, `activities.ts`, Migration 20 y suites R5-DUR |
| `PC1-TECH-015` | Cada política exige primary y backup diferentes, activos, del mismo tenant y con `activity.perform`. Publicación, pinning, agenda, reprogramación, repetición y resultado aplican guards fail-closed. | `activity-policy.ts`, `activities.ts`, suites R5-POL/HTTP/RLS |

## 3. Migration 20

Artefacto:
`packages/database/prisma/migrations/20260824130000_g5pc1r5_capacity_activity_policy/migration.sql`.

- agrega `ActivityDurationSource`, `admission_offerings.concurrency_version`,
  `activity_definition_versions.duration_source` y `tenant_activity_policies`;
- aplica checks de duración `1..1440`, versión positiva y ejecutores distintos;
- usa FKs tenant-scoped, incluidas las membresías primary/backup compuestas;
- habilita y fuerza RLS, con `USING`/`WITH CHECK` por tenant y grants CRUD exactos para
  `admission_app`;
- extiende el guard de historia inmutable y migra versiones legacy a
  `VERSION_OVERRIDE` sin cambiar minutos;
- no contiene seed, `INSERT`, `COPY`, personas, capacities ni configuración
  institucional;
- Migration 17, 18 y 19 conservan contenido/checksum; Migration 21 no existe ni está
  autorizada.

El smoke reforzado comprobó fresh `0→20`, incremental `19→20`, backfill legacy,
constraints, FKs, índices, trigger histórico, RLS/FORCE, grants y ausencia de seed.

## 4. Superficies implementadas

### Dominio y persistencia

- lifecycle explícito y readiness de offerings en `packages/database/src/intake.ts`;
- concurrencia optimista de offering y orden de locks compatible con capacity;
- política/duración/readiness en `packages/database/src/activity-policy.ts`;
- guards de policy, ejecutor y duración histórica en
  `packages/database/src/activities.ts`;
- asignar form version incrementa la versión de offering;
- nuevos permisos `activity.policy.read` y `activity.policy.manage`.

### API

- `GET .../offerings/:offeringId/readiness`;
- `POST .../offerings/:offeringId/publish` y `/close`;
- listado, lectura y actualización optimista de políticas por kind;
- proyección minimizada de ejecutores elegibles: `membershipId` y `roleKeys`;
- schemas estrictos, CSRF, autorización tenant/capability y códigos de conflicto
  estables.

### Web

- staff distingue capacidad ausente, cero y positiva y confirma publish/close;
- familia no recibe ni muestra capacidad exacta;
- cards de política para entrevista/diagnóstico con baseline 30/60, primary/backup,
  readiness, blockers y concurrencia;
- creación de versión distingue default de policy y override explícito.

La revisión manual de estructura se ejecutó en escritorio y viewport `360x800`: sin
overflow horizontal, controles inspeccionados de al menos 44 px, inputs con label y sin
exposición de capacidad exacta en la vista familiar. La API no estaba levantada durante
esa inspección visual; los flujos funcionales se validaron por HTTP. `axe`, matriz
`768/1280` y zoom 200% quedan como evidencia no ejecutada y no se declaran `PASS`.

## 5. Validación ejecutada

| Control | Resultado |
| --- | --- |
| `pnpm g5pc1r5:migration:smoke` | `PASS`: fresh 0→20, incremental 19→20 y seals |
| Suites focales intake/capacity | `25/25` y `9/9 PASS` |
| Suites focales application authority + forms | `111/111 PASS` antes de regresión completa |
| Suites focales activity policy/activities | `30/30 PASS` |
| HTTP activity + intake | `7/7` y `41/41 PASS` |
| `pnpm test` | `44 archivos, 656/656 PASS` |
| `pnpm test:rls` | `8 suites, 67/67 PASS` |
| `pnpm format:check` | `PASS` |
| `pnpm lint` | `PASS`, 0 errores y 0 warnings |
| `pnpm typecheck` | `PASS`, 4 proyectos |
| `pnpm build` | `PASS`, database/web/API/worker; web prerenderiza 5 páginas |
| `pnpm security:secrets` | `PASS`, 366 archivos versionados inspeccionados |
| `pnpm security:deps` | `PASS`, sin vulnerabilidades conocidas high/critical |
| `pnpm e5i:boundary:check` | `E5I_NO_EXTERNAL_INTEGRATION=PASS` |
| `pnpm g5or:operations:smoke` | `G5OR-OPS-01..14 PASS` |
| `pnpm g5or:recovery:smoke` | `G5OR-REC-01..15 PASS`, 20 migraciones, entorno sintético limpiado |
| Prisma validate + diff check focal | `PASS` |

La primera regresión documental reveló fixtures legacy `PUBLISHED` sin capacity. Se
agregó capacidad sintética explícita a esos fixtures; no se relajó el comportamiento
fail-closed. La suite documental quedó `56/56 PASS` y luego la regresión global pasó.

Las advertencias `pg` sobre `client.query()` concurrente ya existentes no produjeron
fallos. Se registran como deuda de actualización del driver/fixtures, no como aprobación
de uso productivo.

## 6. Clasificación y riesgos residuales

| Clasificación | Elemento |
| --- | --- |
| Hecho confirmado | Código, Migration 20 y pruebas anteriores existen en esta rama y usan datos sintéticos. |
| Decisión aprobada | `R5-D-001..009` y Migration 20 dentro del alcance exacto del diseño. |
| Supuesto de trabajo aprobado para R5 | Alcance inicial de policy por `tenant + kind`, sin campus/proceso/level. |
| Pregunta abierta | Selección de plataforma, proveedores productivos, preproducción, observabilidad real, destinos de alertas, procedimientos legales y autorización fechada de piloto/producción. |

Riesgos que permanecen:

1. los controles estáticos no sustituyen pentest, DAST ni revisión de infraestructura;
2. el smoke de recovery local/CI no demuestra RTO/RPO ni restore productivo;
3. monitoring provider y alert destination productivos siguen `REQUIRED_NOT_SELECTED`;
4. la policy `tenant + kind` requeriría nueva decisión/migración para scopes más finos;
5. no se implementó un denial sink durable nuevo dentro de R5;
6. los artefactos legales/prepiloto y `G5-EXIT-10..12` continúan abiertos/bloqueados.

## 7. Compuerta y siguiente acción humana

`PC1-R5` queda `COMPLETE / TECHNICALLY_REVIEWED` en el alcance sintético aprobado.
Esto no equivale a aprobación G5 ni a autorización de despliegue. La siguiente decisión
humana debe revisar el PR R5 y, por separado, autorizar o rechazar una etapa de
preproducción sintética con plataforma, presupuesto, propietarios, proveedores,
observabilidad, rollback y criterios de salida explícitos.
