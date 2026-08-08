# E1-C — Plan de consolidación funcional y preparación G1

## Control

| Campo | Valor |
| --- | --- |
| Etapa | E1-C — Consolidación funcional |
| Estado | `IN PROGRESS / READY FOR G1 REVIEW` |
| Inicio autorizado | `2026-08-08T05:45:00-04:00` |
| Base | `main` en `168d383489dfd9d5d7a1f48a8a9e25ea330fff13` |
| Rama | `docs/e1c-g1-consolidation` |
| Dependencia | E1-B `CLOSED / OPERATIONAL BASELINE APPROVED` |
| G1 | `NO APROBADA` |
| ADR-0001 | `PROPOSED` |
| Implementación | No autorizada |
| Datos reales | No autorizados |

## Objetivo

Consolidar la especificación funcional aprobada en E1-A y E1-B para producir evidencia verificable y un paquete de decisión para G1, sin introducir arquitectura ni implementación.

## Alcance

E1-C debe:

1. consolidar una especificación funcional canónica sin contradicciones entre requisitos, journeys, casos de uso, estados y decisiones;
2. definir criterios de aceptación verificables por capacidad funcional;
3. consolidar escenarios end-to-end felices, alternos y excepcionales;
4. priorizar backlog MVP y declarar fuera de alcance de manera explícita;
5. clasificar dependencias posteriores sin convertirlas en bloqueos artificiales de G1;
6. revisar trazabilidad FR/NFR ↔ Q/D/C ↔ journeys ↔ casos de uso ↔ criterios de aceptación;
7. preparar checklist y evidencia para la aprobación humana de G1.

## Límites

E1-C no puede:

- seleccionar o adoptar stack;
- aprobar `ADR-0001`;
- definir arquitectura física o lógica definitiva;
- crear API, DTO, SQL, Prisma schema, componentes o scaffolding;
- resolver Q-301 a Q-309 como contrato técnico;
- usar datos reales;
- cerrar G1 por inferencia o por merge.

## Dependencias conservadas

- `PILOT_CONFIGURATION_PENDING`: valores concretos de configuración del piloto que no cambian el comportamiento funcional aprobado.
- `PRE_PILOT_LEGAL_PENDING`: C-013, retención, derechos, conservación física y responsable legal/normativo antes de datos reales/piloto productivo.
- `FUTURE_INTEGRATION_PENDING`: Q-301 a Q-309 para E7/G7.
- `OPEN_SECURITY_AND_OPERATION_QUESTIONS`: Q-201 a Q-210 para las etapas técnicas/operativas correspondientes.

## Entregables previstos

- especificación funcional consolidada;
- catálogo de criterios de aceptación;
- catálogo de escenarios end-to-end y excepciones;
- backlog MVP priorizado;
- matriz de fuera de alcance/deferidos;
- trazabilidad G1 actualizada;
- checklist de aprobación G1;
- borrador de acta/paquete de decisión G1, sin aprobarla automáticamente.

## Criterio de salida de E1-C

E1-C puede solicitar revisión de G1 cuando:

- no existan contradicciones funcionales materiales abiertas;
- cada capacidad MVP crítica tenga criterios de aceptación verificables;
- los escenarios principales y excepcionales estén cubiertos;
- el backlog MVP y los diferidos estén explícitos;
- la trazabilidad sea suficiente para revisar impacto y cobertura;
- los pendientes legales, técnicos y de configuración estén correctamente clasificados;
- G1 permanezca `NO APROBADA` hasta una aprobación humana explícita.
