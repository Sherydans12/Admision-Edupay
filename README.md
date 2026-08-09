# Admisión EduPay

Admisión EduPay es un portal SaaS multiempresa para gestionar procesos de admisión escolar. Permitirá a familias postular uno o más estudiantes y a las instituciones configurar, operar y auditar sus procesos por sede, año académico y curso.

La primera institución prevista es Colegio Particular Conquistadores. El producto, sus conceptos y sus límites no deben quedar acoplados a ese colegio.

## Estado actual

La **fundación documental G0 está aprobada y cerrada** sobre el commit `1d33191d7b0bb9e4d6f2c99dfa9a8baed701a379`.

E1 — Diseño funcional está `CLOSED / FUNCTIONAL SPECIFICATION APPROVED`. G1 está `APPROVED / CLOSED` sobre `e233927659b0709d37de8c4b66b55439a854e0e1`.

E2 — Arquitectura está `CLOSED / ARCHITECTURE APPROVED`. G2 está `APPROVED / CLOSED` sobre `15b49e284ca642761f2df744ce73bb6a3d10e289`. E2-D-001..017 quedaron aprobadas. ADR-0001, ADR-0002, ADR-0004 y ADR-0005 están `ACCEPTED`; ADR-0003 está `ACCEPTED_WITH_CONDITION` y su PoC tenant/RLS/Prisma fue demostrada en E4.

La arquitectura aprobada usa modular monolith, monorepo independiente, stack TypeScript/NestJS/Next.js/React/Prisma/PostgreSQL, shared schema + `tenantId` + RLS, sesión opaca server-side para el web MVP, object storage privado S3-compatible, jobs/outbox en PostgreSQL y runtime Linux containerizado. RPO 1 hora y RTO 4 horas son objetivos técnicos iniciales, no SLA.

E3 — Prototipo UX está `CLOSED / UX APPROVED`. G3 está `APPROVED / CLOSED` sobre el commit `a659191f5b5190ddf6913b6417cdfccb7baf1a90` del PR #6. La evidencia aprobada contiene IA por audiencia, 42 pantallas conceptuales, wireflows P0, workspace de expediente, estados/feedback, visibilidad, WCAG 2.2 AA, formularios, capacidad/waitlist/oferta, sesión/SELF-ELEVATION, 20 tareas sintéticas y UX-D-001..013. HUX-001..HUX-005 quedaron ratificadas.

E4 — Fundación técnica está `CLOSED / TECHNICAL FOUNDATION APPROVED`. G4 está `APPROVED / CLOSED` sobre el commit técnico `cb5d4be14fd9149a20e1acd36b5dfad563c2836a` del PR #7, con resultado `PASS_WITH_DEFERRED` y sin bloqueantes G4 materiales. E4-A..E están `COMPLETE`; la evidencia incluye monorepo reproducible, web/API/worker, PostgreSQL/Prisma, tenant/RLS, sesiones/autorización, SELF-ELEVATION, CI, deployment smoke local/development y backup/restore sintético.

E5 — construcción del MVP funcional está **autorizada para iniciar** dentro de `BL-001..BL-022`, `AC-001..AC-058` y `E2E-001..E2E-022`, usando exclusivamente datos sintéticos/non-production e infraestructura local/development necesaria. G5 sigue `NO APROBADA`. No están autorizados datos reales, piloto, producción, secretos productivos, aceptación legal C-013 ni integración técnica con EduPay/Q-301..Q-309.

Registros formales principales:

- [`docs/approvals/E1-B-functional-closure-2026-08-08.md`](docs/approvals/E1-B-functional-closure-2026-08-08.md)
- [`docs/approvals/G1-functional-approval-2026-08-08.md`](docs/approvals/G1-functional-approval-2026-08-08.md)
- [`docs/approvals/G2-architecture-approval-2026-08-08.md`](docs/approvals/G2-architecture-approval-2026-08-08.md)
- [`docs/approvals/G3-ux-approval-2026-08-08.md`](docs/approvals/G3-ux-approval-2026-08-08.md)
- [`docs/approvals/G4-mvp-construction-approval-2026-08-08.md`](docs/approvals/G4-mvp-construction-approval-2026-08-08.md)

## Principios

- Multiempresa desde el diseño, con aislamiento institucional obligatorio.
- Privacidad y mínimo privilegio, especialmente para datos de menores, salud, necesidades educativas y finanzas.
- Dominios Admisión y EduPay desacoplados, integrados mediante contratos explícitos.
- Flujo configurable sobre una estructura común, trazable y auditable.
- Diferenciación entre hechos confirmados, decisiones aprobadas, supuestos y preguntas abiertas.
- Entregas pequeñas con aprobación humana antes de avanzar de etapa.
- Trazabilidad entre requisitos, decisiones, implementación y pruebas.
- Simplicidad operativa sin debilitar seguridad ni capacidad multiempresa.

## Estructura documental

| Documento | Propósito |
| --- | --- |
| `AGENTS.md` | Reglas obligatorias para agentes y colaboradores. |
| `docs/00-vision-scope.md` | Visión, alcance y límites iniciales. |
| `docs/01-source-analysis.md` | Evidencia disponible, extracción y vacíos de información. |
| `docs/02-admission-workflow.md` | Flujo conceptual, estados, transiciones y vistas. |
| `docs/03-functional-requirements.md` | Requisitos funcionales identificados y trazables. |
| `docs/04-non-functional-requirements.md` | Seguridad, privacidad, disponibilidad y operación. |
| `docs/05-domain-model.md` | Modelo de dominio y agregados conceptuales. |
| `docs/06-multitenancy-security.md` | Aislamiento, autorización y controles de datos sensibles. |
| `docs/07-edupay-integration-boundary.md` | Límite conceptual de integración con EduPay. |
| `docs/08-roles-permissions-draft.md` | Borrador funcional de roles y permisos. |
| `docs/09-open-questions.md` | Preguntas, supuestos y decisiones pendientes. |
| `docs/10-roadmap-approval-gates.md` | Etapas de trabajo y compuertas de aprobación. |
| `docs/11-pilot-colegio-conquistadores-2027.md` | Configuración funcional conocida del piloto 2027. |
| `docs/approvals/G0-foundation-closure-2026-08-06.md` | Registro formal de aprobación y cierre de G0. |
| `docs/approvals/E1-B-functional-closure-2026-08-08.md` | Registro formal de aprobación y cierre de E1-B. |
| `docs/approvals/G1-functional-approval-2026-08-08.md` | Registro formal de aprobación y cierre de G1. |
| `docs/approvals/G2-architecture-approval-2026-08-08.md` | Registro formal de aprobación y cierre de G2. |
| `docs/approvals/G3-ux-approval-2026-08-08.md` | Registro formal de aprobación y cierre de G3. |
| `docs/approvals/G4-mvp-construction-approval-2026-08-08.md` | Registro formal de aprobación y cierre de G4. |
| `docs/approvals/G1-functional-approval-DRAFT.md` | Borrador histórico supersedido de G1. |
| `docs/approvals/G2-architecture-approval-DRAFT.md` | Borrador histórico supersedido de G2. |
| `docs/approvals/G3-ux-approval-DRAFT.md` | Borrador histórico supersedido de G3. |
| `docs/approvals/G4-mvp-construction-approval-DRAFT.md` | Borrador histórico supersedido de G4. |
| `docs/decisions/ADR-0000-decision-process.md` | Proceso para registrar decisiones arquitectónicas. |
| `docs/decisions/ADR-0001-stack-alignment-with-edupay.md` | Stack principal alineado con EduPay — `ACCEPTED`. |
| `docs/decisions/ADR-0002-modular-monolith.md` | Modular monolith — `ACCEPTED`. |
| `docs/decisions/ADR-0003-shared-schema-tenancy-with-rls.md` | Shared-schema + RLS — `ACCEPTED_WITH_CONDITION`; PoC satisfecha en E4. |
| `docs/decisions/ADR-0004-private-object-storage.md` | Object storage privado — `ACCEPTED`. |
| `docs/decisions/ADR-0005-deployment-runtime.md` | Runtime Linux containerizado — `ACCEPTED`. |
| `docs/e1/00-e1-plan-and-status.md` | Estado final y evidencia de E1. |
| `docs/e1/11-functional-specification.md` | Especificación funcional canónica aprobada en G1. |
| `docs/e1/12-acceptance-criteria.md` | 58 criterios de aceptación funcionales verificables. |
| `docs/e1/13-end-to-end-scenarios.md` | 22 escenarios felices, alternos, excepciones y seguridad. |
| `docs/e1/14-mvp-backlog.md` | Backlog funcional MVP priorizado P0/P1/P2. |
| `docs/e1/15-deferred-and-out-of-scope.md` | Configuración, legal, seguridad/operación, integración futura y fuera de alcance. |
| `docs/e1/16-g1-readiness-checklist.md` | Checklist G1 aprobado con resultado `PASS_WITH_DEFERRED`. |
| `docs/e2/00-e2-plan-and-status.md` | Estado final y evidencia de E2. |
| `docs/e2/01-architecture-overview.md` | Arquitectura lógica, módulos, dependencias y fronteras. |
| `docs/e2/02-stack-evaluation.md` | Stack, monorepo y tooling. |
| `docs/e2/03-logical-data-model.md` | Agregados, ownership e invariantes lógicas. |
| `docs/e2/04-multitenancy-authorization-architecture.md` | Tenancy, identidad, sesiones, permisos y elevación. |
| `docs/e2/05-files-security-architecture.md` | Storage privado, cuarentena y escaneo. |
| `docs/e2/06-concurrency-and-consistency.md` | Concurrencia, jobs, outbox y email. |
| `docs/e2/07-audit-observability-recovery.md` | Auditoría, señales, backups y recuperación. |
| `docs/e2/08-deployment-and-environments.md` | Ambientes y runtime. |
| `docs/e2/09-testing-strategy.md` | Estrategia técnica de validación futura. |
| `docs/e2/10-threat-model.md` | Threat model STRIDE y riesgos residuales. |
| `docs/e2/11-e2-decision-workbook.md` | Decisiones E2-D y elecciones humanas. |
| `docs/e2/12-g2-readiness-checklist.md` | Readiness G2. |
| `docs/e3/00-e3-plan-and-status.md` | Estado final y evidencia de E3. |
| `docs/e3/01-information-architecture.md` | IA, navegación y sitemap P0. |
| `docs/e3/02-screen-inventory.md` | Inventario de 42 pantallas conceptuales. |
| `docs/e3/03-family-critical-flows.md` | Wireflows Familia. |
| `docs/e3/04-staff-critical-flows.md` | Wireflows Secretaría, Admisión y Dirección. |
| `docs/e3/05-case-workspace.md` | Workspace operacional de expediente. |
| `docs/e3/06-screen-states-and-feedback.md` | Estados técnicos y de negocio. |
| `docs/e3/07-content-visibility-matrix.md` | Matriz de contenido por rol. |
| `docs/e3/08-accessibility-responsive.md` | WCAG 2.2 AA y responsive. |
| `docs/e3/09-form-patterns.md` | Patrones de formularios y builder mínimo. |
| `docs/e3/10-capacity-waitlist-offer-ux.md` | Cupos, waitlist y oferta. |
| `docs/e3/11-session-security-ux.md` | Sesión y seguridad UX. |
| `docs/e3/12-prototype-board.md` | Board consolidado de baja fidelidad. |
| `docs/e3/13-prototype-validation-scenarios.md` | 20 tareas sintéticas de validación. |
| `docs/e3/14-ux-decision-workbook.md` | UX-D y HUX aprobadas. |
| `docs/e3/15-g3-readiness-checklist.md` | Readiness G3 con resultado `PASS_WITH_DEFERRED`. |
| `docs/e4/00-e4-plan-and-status.md` | Estado final y cierre de E4. |
| `docs/e4/07-reproducibility-and-deployment-evidence.md` | Corrida desde cero y deployment smoke local/development. |
| `docs/e4/08-recovery-evidence.md` | Backup/restore sintético y resultados REC-01..REC-08. |
| `docs/e4/09-residual-risks-and-operational-ownership.md` | Riesgos residuales, diferidos y ownership operacional. |
| `docs/e4/10-g4-mvp-scope-and-exit.md` | Alcance E5 autorizado por G4 y criterios de salida hacia G5. |
| `docs/e4/11-g4-readiness-checklist.md` | Checklist G4 con resultado `PASS_WITH_DEFERRED`. |

## Cómo continuar

1. Fusionar el PR #7 ya aprobado en G4.
2. Iniciar E5 desde `main` fusionado en una rama independiente.
3. Implementar el MVP por incrementos trazables a `BL-001..BL-022`, `AC-001..AC-058` y `E2E-001..E2E-022`.
4. Mantener datos reales, piloto, producción, secretos productivos e integración EduPay bloqueados.
5. Mantener aislamiento tenant, seguridad, accesibilidad y pruebas como parte de cada incremento, no como cierre tardío.
6. Designar al responsable legal/normativo y cerrar C-013 antes de autorizar datos reales para el piloto.

G4 autoriza construir E5 con datos sintéticos/non-production. No equivale a G5 ni autoriza producción o piloto.