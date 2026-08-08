# G1 — Registro formal de aprobación funcional

## Control

| Campo | Valor |
| --- | --- |
| Compuerta | G1 — Aprobación funcional |
| Estado | `APPROVED / CLOSED` |
| Fecha de aprobación | `2026-08-08T06:20:00-04:00` |
| Commit funcional revisado y aprobado | `e233927659b0709d37de8c4b66b55439a854e0e1` |
| PR | `#4 — E1-C: Consolidate functional specification for G1` |
| Aprobador funcional | Nicolás Sena |
| E1-C | `CLOSED / FUNCTIONAL SPECIFICATION APPROVED` |
| E2 | `AUTHORIZED TO START` después de la fusión del PR #4 |
| G2 | `NO APROBADA` |
| ADR-0001 | `PROPOSED` |
| Implementación | No autorizada |
| Datos reales | No autorizados |
| Integración técnica EduPay | No autorizada |

## Aprobación humana explícita

Se registra la siguiente aprobación:

> Apruebo G1 sobre el commit `e233927659b0709d37de8c4b66b55439a854e0e1` del PR #4. Apruebo el comportamiento funcional, los criterios de aceptación, los escenarios E2E, el backlog MVP y los diferidos definidos en E1. Autorizo cerrar E1-C, registrar la aprobación G1 y fusionar el PR #4. Autorizo iniciar E2 — Arquitectura después de la fusión. Esta aprobación no autoriza todavía implementación, datos reales ni integración técnica con EduPay.

## Alcance aprobado

G1 aprueba la especificación funcional consolidada de E1, incluyendo:

- alcance funcional del SaaS multiempresa y del piloto Conquistadores 2027;
- actores, responsabilidades, separación de funciones y visibilidad;
- oferta, disponibilidad, familia, formulario, documentos y postulación asistida;
- actividades, resultados internos, recomendación de Admisión y disposición de Dirección;
- cupos, reservas, lista de espera, oferta, aceptación y comunicaciones;
- dashboard, reporting, exportaciones y auditoría funcional;
- aislamiento tenant, mínimo privilegio, sensibilidad/propósito y elevación explícita de plataforma;
- borde funcional Admisión–EduPay posterior a aceptación familiar expresa;
- 58 criterios de aceptación funcionales;
- 22 escenarios end-to-end;
- backlog funcional con 22 P0, 6 P1 y 5 P2;
- clasificación de configuración, legal, seguridad/operación, integración futura y fuera de alcance.

El checklist G1 queda aceptado con resultado `PASS_WITH_DEFERRED`, sin bloqueantes funcionales materiales identificados.

## Evidencia aprobada

- `docs/e1/11-functional-specification.md`
- `docs/e1/12-acceptance-criteria.md`
- `docs/e1/13-end-to-end-scenarios.md`
- `docs/e1/14-mvp-backlog.md`
- `docs/e1/15-deferred-and-out-of-scope.md`
- `docs/e1/16-g1-readiness-checklist.md`
- `docs/e1/05-g1-traceability-matrix.md`
- `docs/approvals/E1-A-functional-decisions-2026-08-06.md`
- `docs/approvals/E1-B-functional-closure-2026-08-08.md`

## Diferidos aceptados

Los siguientes elementos permanecen abiertos en sus compuertas y no reabren G1:

- `PILOT_CONFIGURATION_PENDING`;
- `PRE_PILOT_LEGAL_PENDING`, incluida C-013 antes de datos reales/piloto productivo;
- `FUTURE_INTEGRATION_PENDING`, Q-301 a Q-309 para E7/G7;
- `OPEN_SECURITY_AND_OPERATION_QUESTIONS`, Q-201 a Q-210 para las etapas técnicas/operativas correspondientes;
- `ADR-0001` continúa `PROPOSED` hasta decisión arquitectónica.

## Efecto de la aprobación

- E1-A permanece `CLOSED / PRODUCT DECISIONS RECORDED`.
- E1-B permanece `CLOSED / OPERATIONAL BASELINE APPROVED`.
- E1-C pasa a `CLOSED / FUNCTIONAL SPECIFICATION APPROVED`.
- G1 pasa a `APPROVED / CLOSED`.
- E2 — Arquitectura queda autorizada para iniciar después de fusionar el PR #4.
- G2 permanece `NO APROBADA`.

## Límites explícitos

Esta aprobación no autoriza:

- código, scaffolding ni dependencias;
- implementación productiva;
- datos personales o documentos reales;
- integración técnica con EduPay;
- selección definitiva de stack por inferencia;
- aprobar `ADR-0001` sin su evaluación arquitectónica;
- schemas, endpoints, API, Prisma, colas, deployment o infraestructura productiva antes de las decisiones de E2/G2 correspondientes.

E2 puede estudiar y decidir arquitectura dentro de su alcance autorizado. La implementación continúa bloqueada hasta las compuertas posteriores del roadmap.

## Inmutabilidad de la evidencia aprobada

La aprobación funcional se aplica al contenido exacto del commit `e233927659b0709d37de8c4b66b55439a854e0e1`. Los commits administrativos posteriores en el PR #4 pueden registrar cierre, estado y referencias sin modificar el comportamiento funcional aprobado. Cualquier cambio funcional sustantivo posterior requiere trazabilidad y revisión de impacto.
