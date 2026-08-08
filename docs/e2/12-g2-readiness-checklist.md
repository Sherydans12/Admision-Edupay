# G2 — Readiness checklist

**Estado del documento:** `READY FOR ARCHITECTURE DECISIONS`

**G2:** `NO APROBADA`

**Resultado:** `PASS_WITH_DEFERRED`

## Criterio de evaluación

- `PASS`: existe una definición suficiente y no depende de decisión pendiente relevante.
- `PASS_WITH_DEFERRED`: existe recomendación suficiente para G2; queda aprobación humana, proveedor, validación o detalle posterior correctamente acotado.
- `BLOCKED`: falta información que impide formular la arquitectura o evaluar su riesgo.

## Checklist

| Criterio | Evidencia | Estado | Comentario |
|---|---|---|---|
| Estilo arquitectónico | [01](01-architecture-overview.md), E2-D-001, ADR-0002 | `PASS_WITH_DEFERRED` | Modular monolith recomendado; requiere decisión G2 |
| Stack | [02](02-stack-evaluation.md), E2-D-002, ADR-0001 | `PASS_WITH_DEFERRED` | Alineación principal recomendada; versiones se validan antes de scaffolding |
| Estructura de repo | [02](02-stack-evaluation.md), E2-D-003 | `PASS_WITH_DEFERRED` | Monorepo independiente + pnpm; tooling ligero por aprobar |
| Modelo lógico de datos | [03](03-logical-data-model.md) | `PASS` | Agregados, ownership, sensibilidad e invariantes definidos sin schema físico |
| Estrategia tenant | [04](04-multitenancy-authorization-architecture.md), E2-D-005/006, ADR-0003 | `PASS_WITH_DEFERRED` | Shared schema + tenantId + RLS recomendado; PoC antes de G4 |
| Identidad y sesiones | [04](04-multitenancy-authorization-architecture.md), E2-D-007 | `PASS_WITH_DEFERRED` | Modelo híbrido listo para elección humana |
| Autorización y SoD | [04](04-multitenancy-authorization-architecture.md), E2-D-008 | `PASS` | Tenant/recurso/scope/sensibilidad/propósito y elevación explícita cubiertos |
| Archivos | [05](05-files-security-architecture.md), E2-D-009, ADR-0004 | `PASS_WITH_DEFERRED` | Patrón privado definido; proveedor depende de Q-203 |
| Malware | [05](05-files-security-architecture.md), E2-D-010 | `PASS_WITH_DEFERRED` | Cuarentena fail-closed; motor se elige con deployment |
| Concurrencia | [06](06-concurrency-and-consistency.md) | `PASS` | Último cupo, aceptación/expiración, waitlist y versiones resueltos conceptualmente |
| Jobs/scheduler | [06](06-concurrency-and-consistency.md), E2-D-011 | `PASS_WITH_DEFERRED` | DB-backed + outbox + worker recomendado |
| Email | [06](06-concurrency-and-consistency.md), E2-D-012 | `PASS_WITH_DEFERRED` | Estados y fallos separados; proveedor diferido |
| Auditoría | [07](07-audit-observability-recovery.md), E2-D-013 | `PASS_WITH_DEFERRED` | Modelo definido; retención depende de C-013/Q-202/Q-208 |
| Observabilidad | [07](07-audit-observability-recovery.md), E2-D-015 | `PASS_WITH_DEFERRED` | Señales/controles definidos; proveedor diferido |
| Backups/recuperación | [07](07-audit-observability-recovery.md), E2-D-016 | `PASS_WITH_DEFERRED` | Restore obligatorio; RPO/RTO propuestos requieren aprobación |
| Deployment/ambientes | [08](08-deployment-and-environments.md), E2-D-014, ADR-0005 | `PASS_WITH_DEFERRED` | Patrón híbrido recomendado; proveedor y presupuesto posteriores |
| Threat model | [10](10-threat-model.md) | `PASS_WITH_DEFERRED` | Riesgos y controles mapeados; validación E4/E5/pre-piloto |
| Testing | [09](09-testing-strategy.md), E2-D-017 | `PASS` | Capas, AC, CI y riesgos críticos cubiertos |
| Costos/capacidad | [02](02-stack-evaluation.md), [08](08-deployment-and-environments.md), Q-207 | `PASS_WITH_DEFERRED` | Drivers comparados; cotización y volumen concreto pendientes |
| Q-201..Q-210 | [11](11-e2-decision-workbook.md#q-201-a-q-210) | `PASS_WITH_DEFERRED` | Parte arquitectónica tratada; legal/operación permanece en su compuerta |
| ADR readiness | ADR-0001..ADR-0005 | `PASS_WITH_DEFERRED` | Todos propuestos/recomendados; ninguno aceptado automáticamente |
| Boundary EduPay | [01](01-architecture-overview.md), [03](03-logical-data-model.md), [06](06-concurrency-and-consistency.md) | `PASS_WITH_DEFERRED` | Q-301..309 siguen futuras; Q-310 no se reabre |
| Privacidad y datos reales | [04](04-multitenancy-authorization-architecture.md), [05](05-files-security-architecture.md), [10](10-threat-model.md) | `PASS_WITH_DEFERRED` | C-013 legal bloquea datos reales, no la propuesta G2 |
| Límites de etapa | [00](00-e2-plan-and-status.md), borrador G2 | `PASS` | Sin implementación, API, schema, dependencias, infraestructura ni datos reales |

## Decisiones humanas pendientes

Las ocho decisiones están acotadas en [Human decisions required](11-e2-decision-workbook.md#human-decisions-required). Ninguna requiere reabrir el comportamiento funcional aprobado. Su resolución es la acción humana necesaria antes de aprobar G2.

## Diferidos que no bloquean la decisión arquitectónica

- textos, retención, solicitudes de titulares y fundamento legal de `C-013`;
- proveedor/región específicos de datos, archivos, email y observabilidad;
- volúmenes concretos del piloto y cotizaciones;
- política exacta de MFA y respuesta a incidentes;
- Q-301..Q-309 y contrato técnico EduPay para E7/G7;
- implementación de PoC, scaffolding, pruebas o infraestructura, no autorizadas en E2.

## Bloqueantes arquitectónicos materiales

No se identificó un bloqueo material que impida someter las recomendaciones a decisión humana. El resultado no aprueba G2: las ADR y decisiones E2-D continúan propuestas.

## Estado recomendado de etapa

- E2: `IN PROGRESS / READY FOR ARCHITECTURE DECISIONS`.
- G2: `NO APROBADA`.
- E3, implementación, datos reales e integración técnica EduPay: `NO AUTORIZADOS`.
