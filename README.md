# Admisión EduPay

Admisión EduPay es un portal SaaS multiempresa para gestionar procesos de admisión escolar. Permitirá a familias postular uno o más estudiantes y a las instituciones configurar, operar y auditar sus procesos por sede, año académico y curso.

La primera institución prevista es Colegio Particular Conquistadores. El producto, sus conceptos y sus límites no deben quedar acoplados a ese colegio.

## Estado actual

La **fundación documental G0 está aprobada y cerrada** sobre el commit `1d33191d7b0bb9e4d6f2c99dfa9a8baed701a379`. La aprobación fue otorgada por Nicolás Sena el `2026-08-06T14:16:00-04:00`, con Arturo Javier Galleguillos Trigo, Sostenedor de Colegio Particular Conquistadores, como representante formal institucional.

E1 — Diseño funcional queda cerrado: E1-A `CLOSED / PRODUCT DECISIONS RECORDED`, E1-B `CLOSED / OPERATIONAL BASELINE APPROVED` y E1-C `CLOSED / FUNCTIONAL SPECIFICATION APPROVED`. G1 está `APPROVED / CLOSED` sobre el commit funcional `e233927659b0709d37de8c4b66b55439a854e0e1` del PR #4.

E2 — Arquitectura está autorizada para iniciar después de la fusión del PR #4. G2 continúa `NO APROBADA`. Esta autorización permite diseñar y decidir arquitectura, pero no autoriza implementación, scaffolding, dependencias, datos reales ni integración técnica con EduPay. `ADR-0001` permanece `PROPOSED` hasta su evaluación en E2.

Los registros formales principales son [`docs/approvals/E1-B-functional-closure-2026-08-08.md`](docs/approvals/E1-B-functional-closure-2026-08-08.md) y [`docs/approvals/G1-functional-approval-2026-08-08.md`](docs/approvals/G1-functional-approval-2026-08-08.md).

## Principios

- Multiempresa desde el diseño, con aislamiento institucional obligatorio.
- Privacidad y mínimo privilegio, especialmente para datos de menores, salud, necesidades educativas y finanzas.
- Dominios Admisión y EduPay desacoplados, integrados mediante contratos explícitos.
- Flujo configurable sobre una estructura común, trazable y auditable.
- Diferenciación entre hechos confirmados, decisiones aprobadas, supuestos y preguntas abiertas.
- Entregas pequeñas con aprobación humana antes de avanzar de etapa.
- Trazabilidad entre requisitos, decisiones, implementación futura y pruebas.
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
| `docs/08-roles-permissions-draft.md` | Borrador funcional de roles y permisos para refinamiento arquitectónico. |
| `docs/09-open-questions.md` | Preguntas, supuestos y decisiones pendientes. |
| `docs/10-roadmap-approval-gates.md` | Etapas de trabajo y compuertas de aprobación. |
| `docs/11-pilot-colegio-conquistadores-2027.md` | Configuración funcional conocida del piloto 2027. |
| `docs/approvals/G0-foundation-closure-2026-08-06.md` | Registro formal de aprobación y cierre de G0. |
| `docs/approvals/E1-B-functional-closure-2026-08-08.md` | Registro formal de aprobación y cierre de E1-B. |
| `docs/approvals/G1-functional-approval-2026-08-08.md` | Registro formal de aprobación y cierre de G1. |
| `docs/approvals/G1-functional-approval-DRAFT.md` | Borrador histórico supersedido del paquete G1. |
| `docs/decisions/ADR-0000-decision-process.md` | Proceso para registrar decisiones arquitectónicas. |
| `docs/decisions/ADR-0001-stack-alignment-with-edupay.md` | Propuesta de alineación tecnológica con EduPay; se evalúa en E2. |
| `docs/e1/00-e1-plan-and-status.md` | Estado final y evidencia de E1. |
| `docs/e1/07-institutional-validation-baseline.md` | Validaciones institucionales y reglas operativas de E1-B. |
| `docs/e1/08-pilot-operational-rules.md` | Reglas operativas funcionales canónicas del piloto. |
| `docs/e1/09-pilot-configuration-matrix.md` | Matriz de parámetros y configuración funcional del piloto. |
| `docs/e1/11-functional-specification.md` | Especificación funcional canónica aprobada en G1. |
| `docs/e1/12-acceptance-criteria.md` | 58 criterios de aceptación funcionales verificables. |
| `docs/e1/13-end-to-end-scenarios.md` | 22 escenarios felices, alternos, excepciones y seguridad. |
| `docs/e1/14-mvp-backlog.md` | Backlog funcional MVP priorizado P0/P1/P2. |
| `docs/e1/15-deferred-and-out-of-scope.md` | Configuración, legal, seguridad/operación, integración futura y fuera de alcance. |
| `docs/e1/16-g1-readiness-checklist.md` | Checklist G1 aprobado con resultado `PASS_WITH_DEFERRED`. |

## Cómo continuar

1. Fusionar el PR #4 con el registro administrativo de cierre E1-C/G1.
2. Iniciar E2 únicamente como arquitectura y decisiones técnicas documentadas.
3. Evaluar `ADR-0001`, tenancy, identidad/autorización, persistencia, archivos, auditoría, observabilidad, despliegue y seguridad antes de solicitar G2.
4. Mantener implementación y datos reales bloqueados hasta las compuertas posteriores correspondientes.
5. Designar al responsable legal/normativo antes de autorizar datos reales para el piloto.

La aprobación G1 no autoriza código ni integración técnica con EduPay. E2 debe producir la evidencia necesaria para una futura aprobación G2.
