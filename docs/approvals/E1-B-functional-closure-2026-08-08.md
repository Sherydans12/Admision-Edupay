# E1-B — Registro formal de cierre funcional institucional

## Control

| Campo | Valor |
| --- | --- |
| Entrega | E1-B — Especificación funcional institucional |
| Estado | `CLOSED / OPERATIONAL BASELINE APPROVED` |
| Fecha de aprobación | `2026-08-08T05:45:00-04:00` |
| Commit revisado y aprobado | `b39150aaf933eda10a3030b9f2d69c6957df8449` |
| PR | `#3 — E1-B: Record institutional rules and operational baseline` |
| Aprobador funcional | Nicolás Sena |
| Compuerta G1 | `NO APROBADA` |
| E1-C | Autorizada para iniciar después de la fusión de PR #3 |
| ADR-0001 | `PROPOSED` |
| Datos reales | No autorizados |
| Implementación | No autorizada |

## Aprobación humana explícita

Se registra la siguiente aprobación:

> Apruebo el cierre de E1-B sobre el commit `b39150aaf933eda10a3030b9f2d69c6957df8449` y autorizo registrar su cierre y fusionar el PR #3. G1 continúa NO APROBADA y autorizo iniciar E1-C después de la fusión.

## Alcance aprobado

El cierre de E1-B confirma que la línea base operativa funcional del piloto está suficientemente definida para pasar a consolidación E1-C. Quedan aprobados y trazados, entre otros, los actores y responsabilidades, separación Admisión/Dirección, postulación asistida, gestión documental, actividades obligatorias configurables, cupos, reservas, ofertas, lista de espera, plazos, comunicaciones, reportes, exportaciones y el borde funcional con EduPay.

Q-310 queda `APPROVED_PRODUCT / FUNCTIONALLY_RESOLVED`: el handoff a EduPay sólo ocurre después de aceptación familiar expresa de una oferta vigente.

No se identifica una decisión funcional bloqueante restante para E1-B.

## Pendientes que no reabren E1-B

### `PILOT_CONFIGURATION_PENDING`

- suplentes y delegaciones concretas;
- ejecutores concretos de entrevista/evaluación;
- duración exacta de actividades;
- valores concretos de cupos;
- catálogo concreto de informe de personalidad;
- prioridades concretas y desempates de lista de espera;
- textos finales de comunicaciones;
- anticipación exacta de recordatorios;
- SLA numéricos;
- nombres finales de plantillas.

### `PRE_PILOT_LEGAL_PENDING`

C-013 conserva `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`. La validación legal, retención, eliminación/anonimización, atención de derechos y conservación/devolución física deben resolverse antes de usar datos reales o autorizar el piloto productivo.

### `FUTURE_INTEGRATION_PENDING`

Q-301 a Q-309 permanecen abiertas para E7/G7. Su resolución contractual no es requisito de cierre de E1-B ni de aprobación funcional G1.

## Efecto del cierre

- E1-A permanece `CLOSED / PRODUCT DECISIONS RECORDED`.
- E1-B pasa a `CLOSED / OPERATIONAL BASELINE APPROVED`.
- E1-C queda autorizada para iniciar después de la fusión del PR #3.
- G1 permanece `NO APROBADA` y requiere consolidación E1-C, criterios de aceptación, escenarios felices/alternos/excepciones, backlog MVP priorizado y aprobación humana explícita.
- E2/G2 permanecen no autorizadas.
- `ADR-0001` permanece `PROPOSED`.
- No se autoriza código, scaffolding, arquitectura, API, dependencias, integración ejecutable ni datos reales.

## Evidencia

La aprobación se aplica al contenido exacto del commit `b39150aaf933eda10a3030b9f2d69c6957df8449`. Cualquier cambio funcional sustantivo posterior requiere trazabilidad y revisión correspondiente.
