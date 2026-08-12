# E5 — Construcción del MVP funcional

## Control

| Campo | Valor |
| --- | --- |
| Etapa | E5 — MVP |
| Estado | `IN PROGRESS / E5-A+B+C+D+E+F+G+H COMPLETE — READY FOR E5-I REVIEW` |
| Inicio autorizado | `2026-08-08T20:25:00-04:00` |
| Base | `main` en `8990bed13622c70d42c54263f2abc45c8849fcbd` |
| Rama | `feat/e5-mvp` |
| Dependencia | G4 `APPROVED / CLOSED` |
| Alcance P0 | `BL-001..BL-022` |
| Acceptance criteria | `AC-001..AC-058` |
| E2E | `E2E-001..E2E-022` |
| Datos permitidos | Sólo sintéticos/non-production |
| Infraestructura | Sólo local/development necesaria |
| G5 | `NO APROBADA` |
| Datos reales / piloto / producción | No autorizados |
| Integración técnica EduPay | No autorizada; Q-301..Q-309 permanecen diferidas |

## Propósito

Construir el recorrido funcional mínimo aprobado para Admisión sobre la fundación E4, manteniendo aislamiento tenant, autorización deny-by-default, trazabilidad, accesibilidad y pruebas como parte de cada incremento.

E5 construye capacidades funcionales; no cambia silenciosamente las decisiones G1/G2/G3/G4 ni convierte el sistema en productivo.

## Fuentes canónicas

- `docs/e1/11-functional-specification.md`
- `docs/e1/12-acceptance-criteria.md`
- `docs/e1/13-end-to-end-scenarios.md`
- `docs/e1/14-mvp-backlog.md`
- `docs/e2/01-architecture-overview.md`
- `docs/e2/03-logical-data-model.md`
- `docs/e2/04-multitenancy-authorization-architecture.md`
- `docs/e2/05-files-security-architecture.md`
- `docs/e2/06-concurrency-and-consistency.md`
- `docs/e3/02-screen-inventory.md`
- `docs/e3/03-family-critical-flows.md`
- `docs/e3/04-staff-critical-flows.md`
- `docs/e3/05-case-workspace.md`
- `docs/e3/07-content-visibility-matrix.md`
- `docs/e3/08-accessibility-responsive.md`
- `docs/approvals/G4-mvp-construction-approval-2026-08-08.md`

## Estrategia de entrega

E5 se implementará en vertical slices pequeños. Cada incremento debe incluir schema/migration, dominio/servicio, autorización, API, UI cuando corresponda, tests y trazabilidad. Ningún incremento puede sacrificar aislamiento tenant o diferir seguridad básica para el final.

### E5-A — Intake core: configuración, familia, estudiante y postulación draft

**Estado:** `COMPLETE`.

Objetivo: conseguir el primer recorrido funcional real, todavía sin submission final ni documentos.

Cobertura principal:

- `BL-001` — aislamiento multiempresa como condición transversal;
- `BL-002` — identidad/familia y múltiples estudiantes, en la porción necesaria para intake;
- `BL-003` — oferta y disponibilidad categórica;
- `BL-005` — inicio/guardado/listado de postulación en estado draft y prevención de duplicados;
- `BL-019` — permisos mínimos necesarios para las operaciones del slice;
- `BL-020` — eventos auditables críticos del slice;
- `BL-021` — configuración mínima de sede/proceso/curso/oferta necesaria para habilitar el recorrido.

Entregable vertical esperado:

1. un administrador autorizado configura una sede/proceso/oferta sintética;
2. una familia sintética autenticada/resuelta registra uno o más estudiantes;
3. la familia consulta disponibilidad categórica;
4. inicia una postulación draft para un estudiante/oferta;
5. guarda y vuelve a consultar el draft;
6. un intento duplicate según institución/año/curso/oferta se rechaza de forma consistente;
7. otro tenant no puede observar, contar ni modificar esos datos.

**Resultado E5-A:** `COMPLETE`. La evidencia ejecutable y la tabla de
trazabilidad se encuentran en
[`01-e5a-intake-core-evidence.md`](01-e5a-intake-core-evidence.md). E5-B no se
inicia en este incremento y G5 permanece `NO APROBADA`.

Fuera de E5-A: builder completo, submission final, documentos, actividades, decisión, cupos, waitlist, oferta final, email y handoff.

### E5-B — Formulario versionado y submission

Cobertura principal: `BL-004` + cierre funcional de `BL-005`, incluyendo builder controlado, versión publicada inmutable, snapshot y envío con validaciones/duplicados.

**Estado:** `COMPLETE`. El incremento implementa definición, versionado,
builder controlado, publicación inmutable, asignación a oferta, respuestas de
borrador, revisión, submission transaccional idempotente y snapshot inmutable.
El cierre final además revalida el estado durable completo en submission,
valida operandos de condición contra su field origen, usa fechas calendario
estrictas y oculta del discovery ofertas sin una versión publicada utilizable.
La evidencia ejecutable y los límites se documentan en
[`02-e5b-form-submission-evidence.md`](02-e5b-form-submission-evidence.md).
El desistimiento de `BL-005`, documentos y postulación asistida permanecen
fuera de E5-B.

### E5-C — Documentos y postulación asistida

**Estado:** `COMPLETE_WITH_DEFERRED_Q106`.

Cobertura principal: `BL-006` y `BL-007`, incluyendo privacidad, versiones, observación/corrección, equivalencia/exención y asistencia institucional sin expediente paralelo.

El incremento implementa catálogo y requisitos versionados, fijación exacta por
postulación, carga privada, cuarentena y procesamiento asíncrono fail-closed,
revisión/observación/exención, reemplazo con historia, readiness transaccional,
snapshot v2 y postulación asistida sin suplantación ni expediente paralelo. La
evidencia, pruebas y límites se documentan en
[`03-e5c-documents-assisted-evidence.md`](03-e5c-documents-assisted-evidence.md).
`Q-106` permanece diferida: la resolución operativa se limita a identificadores
exactos y no declara una política definitiva de verificación familiar.

### E5-D — Actividades

**Estado:** `COMPLETE`.

Cobertura principal: `BL-008` y `BL-009`: agenda, reprogramación, asistencia/no-show, intentos y resultado interno separado del estado operacional.

### E5-E — Recomendación y decisión

Cobertura principal: `BL-010`, `BL-011`, SoD y workspace del expediente. Admisión recomienda; Dirección decide; recomendador no decide el mismo caso.

**Estado:** `COMPLETE_WITH_DOWNSTREAM_E5F_E5G`.

La frontera HTTP real, los negativos de permiso, la privacidad familiar, la
matriz RLS de las cuatro tablas y el smoke fresh/incremental de migration 11
pasaron en CI. `AC-022`, `AC-023`, `AC-024` y `AC-028` están `COVERED`;
Los efectos de cupo, waitlist y oferta pendientes se cerraron en E5-F. Las
comunicaciones permanecen en E5-G. G5 no se inició.

### E5-F — Cupos, waitlist y oferta

Cobertura principal: `BL-012`, `BL-013`, `BL-014`: reservas, concurrencia de último cupo, waitlist privada, promoción humana, oferta, aceptación, rechazo, expiración y liberación.

**Estado:** `COMPLETE_WITH_COMMUNICATION_E5G`.

Migration 12, dominio transaccional, API/worker/UI, concurrencia, privacidad
familiar, aislamiento de las ocho tablas y smoke fresh 0→12 / incremental
11→12 pasaron en GitHub Actions run `31472103030`. La evidencia ejecutable y
los límites se documentan en
[`06-e5f-capacity-waitlist-offer-evidence.md`](06-e5f-capacity-waitlist-offer-evidence.md).
No se iniciaron E5-G, handoff, EduPay ni G5.

### E5-G — Comunicaciones y proyecciones

**Estado:** `COMPLETE`.

Cobertura principal: `BL-015`, `BL-016`, `BL-017`: email mediante adapter seguro, portal familiar y dashboard operativo, manteniendo estado técnico separado del negocio.

Migration 13, dominio transaccional con capability checks, API HTTP,
worker outbox, portal familiar con `ForbiddenError`, dashboard aislado,
aislamiento RLS de las tablas de comunicación, y smoke fresh 0→13 /
incremental 12→13 pasaron localmente y en GitHub Actions run `31545007981`
(job `validate` / `93955501044`, conclusion `success`) sobre HEAD
`9d44a46d24fc7a791d43efd91be236d9f35568f8`. La evidencia ejecutable y los límites
se documentan en
[`07-e5g-communications-projections-evidence.md`](07-e5g-communications-projections-evidence.md).
No se iniciaron E5-H, E5-I, handoff, EduPay ni G5.

### E5-H — Reportes, configuración, permisos y auditoría de cierre

Cobertura principal: `BL-018`, cierre de `BL-019`, `BL-020`, `BL-021`, exportaciones minimizadas y trazabilidad completa.

**Estado:** `COMPLETE`.

Migration 14, catálogo cerrado de siete reportes, CSV minimizado y endurecido,
administración P0 de RoleAssignment, self-elevation reutilizada, consulta y sink
durable de auditoría, cierre de configuración y superficies accesibles pasaron
377/377 tests, 40/40 RLS y GitHub Actions run `31552081281` (job
`93976724073`, `success`). La evidencia y límites se documentan en
[`08-e5h-reports-permissions-audit-evidence.md`](08-e5h-reports-permissions-audit-evidence.md).
E5-I no se inició y G5 permanece `NO APROBADA`.

### E5-I — Borde funcional EduPay y paquete G5

Cobertura principal: `BL-022` únicamente como borde funcional posterior a aceptación. **No** crear integración técnica EduPay ni resolver `Q-301..Q-309`.

Consolidar evidencia P0/AC/E2E, seguridad, accesibilidad, concurrencia, documentos privados, recuperación, operación y riesgos para solicitar G5. C-013 y autorización de datos reales siguen siendo requisitos posteriores obligatorios.

## Reglas obligatorias de E5

- Todas las tablas tenant-owned: `tenantId NOT NULL`, RLS/FORCE RLS y grants explícitos cuando corresponda.
- Tenant efectivo siempre resuelto server-side desde sesión/membership o elevation verificada.
- Autorización deny-by-default en cada operación funcional.
- No depender de filtros ORM como única defensa tenant.
- No usar datos reales ni copiar fixtures institucionales con información personal.
- No hardcodear Colegio Conquistadores como regla de negocio.
- No exponer resultados internos, deliberaciones, posición numérica de waitlist ni cupos exactos a familia cuando la especificación lo prohíbe.
- No convertir aceptación en matrícula/pago.
- No integrar técnicamente con EduPay.
- Mantener audit/application logs/security events separados.
- Tests de happy path y negativos tenant/permission/concurrency en el mismo incremento que la funcionalidad.
- Mantener WCAG 2.2 AA y responsive aprobado cuando se agreguen pantallas.

## Criterio de avance entre incrementos

Un slice se considera `COMPLETE` sólo si:

- comportamiento implementado coincide con G1;
- UX relevante coincide con G3;
- aislamiento/autorización están probados;
- migrations funcionan desde DB limpia y como upgrade incremental cuando exista una migración nueva;
- lint/typecheck/tests/build pasan;
- no aparecen secretos ni datos reales;
- trazabilidad BL/AC/E2E queda documentada;
- CI queda verde.

## G5

G5 permanece `NO APROBADA`. E5 no autoriza piloto, producción ni datos reales. Para solicitar G5 deberán cumplirse los criterios definidos en `docs/e4/10-g4-mvp-scope-and-exit.md`, incluyendo legal/privacy C-013 y autorización explícita de datos reales/piloto.
