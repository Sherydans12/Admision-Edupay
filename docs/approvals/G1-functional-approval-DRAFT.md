# G1 — Aprobación funcional (BORRADOR)

## Control

| Campo | Valor |
| --- | --- |
| Estado | `DRAFT / NOT APPROVED` |
| Etapa evaluada | E1 — Diseño funcional |
| E1-C | `IN PROGRESS / READY FOR G1 REVIEW`, sujeto a completar esta entrega |
| PR candidato | #4 — `E1-C: Consolidate functional specification for G1` |
| Commit candidato | Pendiente de completar y fijar después de las validaciones del PR #4 |
| G1 | `NO APROBADA` |
| Aprobación humana | No registrada |

Este documento prepara el paquete de decisión. No registra aprobación, fecha ni autorización implícita.

## Alcance que se solicitaría aprobar

- alcance funcional del SaaS multiempresa y del piloto Conquistadores 2027;
- actores, responsabilidades, separación de funciones y visibilidad;
- oferta, disponibilidad, cuenta familiar, formulario, documentos y postulación asistida;
- actividades, resultados internos, recomendación y disposición de Dirección;
- cupos, lista de espera, oferta, aceptación y comunicaciones;
- dashboard, reporting, exportaciones y auditoría funcional;
- aislamiento tenant, mínimo privilegio y elevación explícita de plataforma;
- borde funcional Admisión–EduPay después de aceptación familiar expresa;
- 58 criterios de aceptación, 22 escenarios end-to-end y backlog funcional priorizado;
- clasificación de configuración, legal, seguridad/operación, integración futura y fuera de alcance.

## Decisiones principales incluidas

1. Conquistadores es piloto configurable, no tenant especial.
2. Portal es la fuente oficial y correo es el único canal automático MVP.
3. Secretaría asiste; Admisión recomienda; Dirección decide; recomendador no decide su caso.
4. Disponibilidad es categórica y no muestra cupos exactos por defecto.
5. Formulario y requisitos son configurables/versionados mediante builder controlado.
6. Captura sensible es progresiva/minimizada; ingreso familiar queda fuera del MVP de Admisión.
7. Entrevista y evaluación son obligatorias en el piloto, configurables en el núcleo y con intentos preservados.
8. `APROBADO`, `LISTA_DE_ESPERA`, `RECHAZADO` y `DEVUELTO_A_REVISION` tienen semántica separada.
9. Lista de espera no muestra posición y su promoción es manual por roles autorizados.
10. Oferta expira, libera reserva y requiere aceptación familiar expresa antes del handoff.
11. Email fallido crea tarea y no altera el estado de negocio.
12. Admisión y EduPay son dominios separados; Q-310 está resuelta y Q-301 a Q-309 diferidas.
13. Superadministrador Global no tiene lectura implícita; el MVP permite `SELF-ELEVATION` explícita y auditada.

## Evidencia para revisión

| Evidencia | Propósito |
| --- | --- |
| [`../e1/11-functional-specification.md`](../e1/11-functional-specification.md) | Especificación funcional canónica |
| [`../e1/12-acceptance-criteria.md`](../e1/12-acceptance-criteria.md) | Criterios verificables AC |
| [`../e1/13-end-to-end-scenarios.md`](../e1/13-end-to-end-scenarios.md) | Escenarios felices, alternos y excepciones |
| [`../e1/14-mvp-backlog.md`](../e1/14-mvp-backlog.md) | Priorización P0/P1/P2 |
| [`../e1/15-deferred-and-out-of-scope.md`](../e1/15-deferred-and-out-of-scope.md) | Diferidos y límites |
| [`../e1/16-g1-readiness-checklist.md`](../e1/16-g1-readiness-checklist.md) | Evaluación objetiva de readiness |
| [`../e1/05-g1-traceability-matrix.md`](../e1/05-g1-traceability-matrix.md) | Trazabilidad integral |
| [`E1-A-functional-decisions-2026-08-06.md`](E1-A-functional-decisions-2026-08-06.md) | Decisiones de producto cerradas |
| [`E1-B-functional-closure-2026-08-08.md`](E1-B-functional-closure-2026-08-08.md) | Línea base operativa aprobada |

## Riesgos y diferidos aceptables para revisión G1

- `PILOT_CONFIGURATION_PENDING`: personas/suplencias, cupos, duraciones, catálogo concreto, textos, recordatorios, calendario y SLA.
- `PRE_PILOT_LEGAL_PENDING`: C-013, responsable legal, textos, retención, derechos y documentación física antes de datos reales.
- `FUTURE_INTEGRATION_PENDING`: Q-301 a Q-309 para E7/G7.
- `OPEN_SECURITY_AND_OPERATION_QUESTIONS`: Q-201 a Q-210 para compuertas posteriores.
- `ADR-0001` permanece `PROPOSED`.

El revisor debe devolver G1 si identifica una contradicción funcional material, una capacidad P0 sin comportamiento verificable o una separación de funciones incompatible. Los diferidos correctamente clasificados no constituyen por sí solos un bloqueo de G1.

## Lo que G1 no autoriza

Una eventual aprobación G1 no autoriza:

- iniciar E2/G2 sin la autorización correspondiente;
- aprobar ADR-0001 o elegir stack;
- diseñar o implementar arquitectura, schemas, endpoints, API, Prisma, colas o deployment;
- implementar integración técnica o contrato EduPay;
- crear código, scaffolding o dependencias;
- usar datos personales o documentos reales;
- iniciar piloto productivo sin validaciones legales, de seguridad y operación exigidas.

## Texto sugerido para aprobación humana

> Apruebo G1 sobre el commit y PR identificados en este documento. La aprobación confirma el comportamiento funcional, criterios de aceptación, escenarios, backlog MVP y diferidos de E1. Esta decisión no autoriza E2/G2, arquitectura, implementación, integración técnica, uso de datos reales ni piloto productivo. Los elementos `PILOT_CONFIGURATION_PENDING`, `PRE_PILOT_LEGAL_PENDING`, `FUTURE_INTEGRATION_PENDING` y `OPEN_SECURITY_AND_OPERATION_QUESTIONS` conservan sus compuertas y responsables.

## Registro de decisión

No completar esta sección hasta recibir una aprobación humana explícita con commit definitivo, identidad autorizada y alcance inequívoco.
