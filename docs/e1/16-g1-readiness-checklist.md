# Checklist de preparación para G1

## Resultado

| Campo | Valor |
| --- | --- |
| Resultado E1-C | `PASS_WITH_DEFERRED` |
| Estado propuesto de etapa | `IN PROGRESS / READY FOR G1 REVIEW` |
| Bloqueantes funcionales materiales | Ninguno identificado |
| G1 | `NO APROBADA`; requiere revisión y aprobación humana explícita |

`PASS_WITH_DEFERRED` significa que el comportamiento funcional está definido y verificable, mientras configuración, legal, seguridad/operación o integración técnica permanecen correctamente asignadas a hitos posteriores. No equivale a aprobación G1.

## Evaluación

| Criterio | Evidencia | Estado | Comentario |
| --- | --- | --- | --- |
| Producto, alcance y piloto | [`11-functional-specification.md`](11-functional-specification.md), secciones 1 y 4 | PASS | SaaS multiempresa; Conquistadores es piloto configurable; sede única no elimina multi-sede |
| Decisiones funcionales | [`04-functional-decision-workbook.md`](04-functional-decision-workbook.md), [`09-open-questions.md`](../09-open-questions.md) | PASS | Q-101 a Q-184 tienen posición funcional; Q-310 resuelta |
| Actores y responsabilidades | [`01-actors-and-responsibilities.md`](01-actors-and-responsibilities.md), especificación sección 2 | PASS_WITH_DEFERRED | Roles y límites definidos; personas suplentes concretas son configuración pre-piloto |
| Separación de funciones | Especificación sección 3; AC-023, AC-028 y AC-034 | PASS | Secretaría no recomienda/decide/promueve y recomendador no decide el mismo caso |
| Journeys | [`02-user-journeys.md`](02-user-journeys.md) | PASS | Recorridos familiares, institucionales y borde EduPay cubiertos |
| Casos de uso | [`03-use-case-catalog.md`](03-use-case-catalog.md) | PASS | Casos familiares, operativos, decisión, espera, exportación y soporte trazados |
| Especificación canónica | [`11-functional-specification.md`](11-functional-specification.md) | PASS | Documento autocontenido con semántica y visibilidad consolidadas |
| Criterios de aceptación | [`12-acceptance-criteria.md`](12-acceptance-criteria.md) | PASS | 58 criterios funcionales únicos cubren éxito, autorización y excepciones |
| Escenarios end-to-end | [`13-end-to-end-scenarios.md`](13-end-to-end-scenarios.md) | PASS | 22 escenarios cubren recorrido principal, alternos, fallos y seguridad |
| Backlog MVP | [`14-mvp-backlog.md`](14-mvp-backlog.md) | PASS | 22 P0, 6 P1 y 5 P2; cada P0 tiene requisitos, AC y E2E/justificación |
| Fuera de alcance y diferidos | [`15-deferred-and-out-of-scope.md`](15-deferred-and-out-of-scope.md) | PASS_WITH_DEFERRED | Configuración, legal, seguridad/operación e integración futura separados sin gate creep |
| Privacidad funcional | Especificación secciones 6, 21 y 22; AC-050 a AC-054 | PASS_WITH_DEFERRED | Minimización y permisos definidos; C-013 legal sigue obligatoria antes de datos reales |
| Roles y permisos | [`08-roles-permissions-draft.md`](../08-roles-permissions-draft.md), AC-011/016/023/028/034/052-054 | PASS | Deny-by-default, scope, propósito y elevación global explícita definidos funcionalmente |
| Multitenancy | [`06-multitenancy-security.md`](../06-multitenancy-security.md), AC-045/050/051 | PASS | Aislamiento y accesos negativos verificables; implementación técnica queda para E2+ |
| Documentos y postulación asistida | Especificación secciones 7 y 8; E2E-002 a E2E-004 | PASS_WITH_DEFERRED | Versiones, físico y autoridad definidos; conservación/devolución física queda legal/pre-piloto |
| Actividades e inasistencia | Especificación secciones 9 a 11; E2E-005 a E2E-008 | PASS_WITH_DEFERRED | Reglas y excepciones definidas; ejecutores/duración concretos son configuración |
| Recomendación y disposición | Especificación secciones 12 y 13; AC-022 a AC-028 | PASS | Recomendación, decisión y devolución son conceptos separados |
| Cupos, lista de espera y oferta | Especificación secciones 14 a 16; AC-029 a AC-039 | PASS_WITH_DEFERRED | Semántica cerrada; valores de cupo, prioridades y calendario son configuración |
| Comunicación y fallo | Especificación sección 17; AC-040 a AC-043 | PASS_WITH_DEFERRED | Email fallido no cambia negocio; textos y anticipación final quedan configurables |
| Dashboard, reporting y exportación | Especificación secciones 18 y 19; AC-044 a AC-049 | PASS_WITH_DEFERRED | Catálogo mínimo y autorizaciones definidos; columnas/textos finales se configuran |
| Borde funcional EduPay | Especificación sección 20; AC-055 a AC-057 | PASS_WITH_DEFERRED | Aceptación precede handoff; Q-301 a Q-309 permanecen para E7/G7 |
| Trazabilidad integral | [`05-g1-traceability-matrix.md`](05-g1-traceability-matrix.md) | PASS | P0 enlaza requisitos, decisiones, journeys, UC, AC, E2E y backlog |
| Límites de autorización | [`15-deferred-and-out-of-scope.md`](15-deferred-and-out-of-scope.md), [`G1-functional-approval-DRAFT.md`](../approvals/G1-functional-approval-DRAFT.md) | PASS | G1 no autoriza arquitectura, implementación, integración técnica ni datos reales |

## Conclusión

La evidencia permite solicitar revisión humana de G1. No se detectó una decisión funcional material pendiente que impida describir o verificar el comportamiento. La aprobación, devolución o solicitud de ajustes corresponde exclusivamente a las autoridades humanas indicadas en el borrador de paquete G1.
