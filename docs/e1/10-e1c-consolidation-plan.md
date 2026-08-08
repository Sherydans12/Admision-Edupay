# E1-C — Plan de consolidación funcional y preparación G1

## Control

| Campo | Valor |
| --- | --- |
| Etapa | E1-C — Consolidación funcional |
| Estado | `CLOSED / FUNCTIONAL SPECIFICATION APPROVED` |
| Inicio autorizado | `2026-08-08T05:45:00-04:00` |
| Cierre / aprobación G1 | `2026-08-08T06:20:00-04:00` |
| Base inicial | `main` en `168d383489dfd9d5d7a1f48a8a9e25ea330fff13` |
| Rama | `docs/e1c-g1-consolidation` |
| Commit funcional aprobado | `e233927659b0709d37de8c4b66b55439a854e0e1` |
| Dependencia | E1-B `CLOSED / OPERATIONAL BASELINE APPROVED` |
| G1 | `APPROVED / CLOSED` |
| Acta G1 | `docs/approvals/G1-functional-approval-2026-08-08.md` |
| E2 | `AUTHORIZED TO START` después de fusionar PR #4 |
| G2 | `NO APROBADA` |
| ADR-0001 | `PROPOSED` |
| Implementación | No autorizada |
| Datos reales | No autorizados |

## Objetivo

Consolidar la especificación funcional aprobada en E1-A y E1-B para producir evidencia verificable y un paquete de decisión para G1, sin introducir arquitectura ni implementación.

**Resultado:** objetivo cumplido y aprobado en G1.

## Entregables completados

- especificación funcional canónica: `11-functional-specification.md`;
- 58 criterios de aceptación: `12-acceptance-criteria.md`;
- 22 escenarios end-to-end: `13-end-to-end-scenarios.md`;
- backlog MVP con 22 P0, 6 P1 y 5 P2: `14-mvp-backlog.md`;
- diferidos y fuera de alcance: `15-deferred-and-out-of-scope.md`;
- checklist G1 `PASS_WITH_DEFERRED`: `16-g1-readiness-checklist.md`;
- trazabilidad integral actualizada: `05-g1-traceability-matrix.md`;
- acta formal G1: `docs/approvals/G1-functional-approval-2026-08-08.md`.

No se identificaron bloqueantes funcionales materiales para G1.

## Dependencias conservadas

- `PILOT_CONFIGURATION_PENDING`: valores concretos de configuración del piloto que no cambian el comportamiento funcional aprobado.
- `PRE_PILOT_LEGAL_PENDING`: C-013, retención, derechos, conservación física y responsable legal/normativo antes de datos reales/piloto productivo.
- `FUTURE_INTEGRATION_PENDING`: Q-301 a Q-309 para E7/G7.
- `OPEN_SECURITY_AND_OPERATION_QUESTIONS`: Q-201 a Q-210 para las etapas técnicas/operativas correspondientes.

Estos diferidos fueron aceptados en G1 y conservan sus compuertas futuras.

## Límites del cierre

La aprobación G1 y cierre E1-C no autorizan:

- implementación, código o scaffolding;
- dependencias de producción;
- datos reales;
- integración técnica EduPay;
- adopción automática de `ADR-0001`;
- arquitectura aprobada sin completar E2/G2.

## Siguiente etapa

E2 — Arquitectura está autorizada para iniciar después de la fusión del PR #4. Debe documentar decisiones técnicas reversibles, evaluar ADR-0001 y preparar evidencia para G2 antes de cualquier avance que el roadmap reserve a etapas posteriores.
