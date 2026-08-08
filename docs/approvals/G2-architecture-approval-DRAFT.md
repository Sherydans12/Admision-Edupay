# G2 — Architecture approval

**Estado:** `DRAFT / NOT APPROVED`

**Fecha de aprobación:** no asignada

**Autoridad:** pendiente de decisión humana

**PR:** #5 — `E2: Architecture design and G2 preparation`

**Commit de evidencia:** head del PR #5 después del commit de esta corrección

## Propósito del borrador

Preparar el paquete que permitiría decidir G2. Este archivo no registra aprobación, no autoriza E3 ni implementación y no cambia el estado de ninguna ADR a `ACCEPTED`.

## Alcance que se pediría aprobar

- modular monolith con módulos internos y procesos web/API/worker;
- alineación principal de stack con EduPay sin compartir repositorio, base, tablas ni sesiones;
- monorepo independiente con workspaces y paquetes compartidos limitados;
- PostgreSQL como fuente transaccional;
- shared database/shared schema con tenantId obligatorio y RLS sujeto a PoC;
- identidad común, memberships tenant y opaque server-side session revocable;
- autorización por capacidad, tenant, recurso, scope, sensibilidad, propósito y separación de funciones;
- object storage privado con cuarentena y escaneo antimalware fail-closed;
- transacciones, locks, constraints e idempotencia para cupos/ofertas/espera;
- jobs/outbox PostgreSQL y worker separado;
- auditoría separada de logs, security events y métricas;
- runtime Linux containerizado con servicios administrados selectivos;
- estrategia de testing y threat model.

## Decisiones humanas registradas

Nicolás Sena registró las ocho elecciones humanas del workbook: HD-01 `RESOLVED`, HD-02 `RESOLVED`, HD-03 `RESOLVED_WITH_CONDITION`, HD-04 `RESOLVED_WITH_MODIFICATION`, HD-05 `RESOLVED`, HD-06 `RESOLVED`, HD-07 `RESOLVED` y HD-08 `RESOLVED_AS_TECHNICAL_TARGET`.

HD-03 exige PoC sintética antes de G4 para request/job con tenant correcto, ausencia de contexto = `DENY`, cross-tenant = `DENY`, pooling seguro, Prisma con transacciones/RLS, roles DB separados y fail-closed. HD-04 selecciona sesión opaca server-side para el web MVP. HD-08 registra RPO 1 hora y RTO 4 horas como objetivos técnicos iniciales, no SLA.

## Decisiones y ADR propuestas

| Evidencia | Estado en este borrador |
|---|---|
| E2-D-001..E2-D-017 | `RECOMMENDED_FOR_G2` |
| ADR-0001 — stack | `PROPOSED / RECOMMENDED_FOR_G2` |
| ADR-0002 — modular monolith | `PROPOSED / RECOMMENDED_FOR_G2` |
| ADR-0003 — tenancy/RLS | `PROPOSED / RECOMMENDED_FOR_G2` |
| ADR-0004 — archivos privados | `PROPOSED / RECOMMENDED_FOR_G2` |
| ADR-0005 — deployment/runtime | `PROPOSED / RECOMMENDED_FOR_G2` |

La eventual aprobación humana debe indicar cuáles decisiones/ADR acepta, ajusta o devuelve. El mero merge documental no sustituye esa declaración.

## Evidencia

- [Arquitectura lógica](../e2/01-architecture-overview.md)
- [Evaluación de stack y repo](../e2/02-stack-evaluation.md)
- [Modelo lógico de datos](../e2/03-logical-data-model.md)
- [Multitenancy, identidad y autorización](../e2/04-multitenancy-authorization-architecture.md)
- [Archivos y seguridad](../e2/05-files-security-architecture.md)
- [Concurrencia, jobs y email](../e2/06-concurrency-and-consistency.md)
- [Auditoría, observabilidad y recuperación](../e2/07-audit-observability-recovery.md)
- [Deployment y ambientes](../e2/08-deployment-and-environments.md)
- [Testing](../e2/09-testing-strategy.md)
- [Threat model](../e2/10-threat-model.md)
- [Decision workbook](../e2/11-e2-decision-workbook.md)
- [Checklist G2](../e2/12-g2-readiness-checklist.md)

## Riesgos y diferidos

- `C-013 / LEGAL_VALIDATION_PENDING`, retención y solicitudes de titulares deben cerrarse antes de datos reales/piloto productivo.
- Q-201..Q-210 conservan componentes legales u operativos en sus compuertas.
- Q-301..Q-309 siguen `FUTURE_INTEGRATION_PENDING`; no existe contrato técnico EduPay.
- Proveedores, residencia, presupuesto y volúmenes concretos aún deben validarse.
- PoC RLS/Prisma/pooling, infraestructura no aprovisionada y targets operativos requieren validación práctica en etapas posteriores.
- SELF-ELEVATION conserva riesgo concentrado; se recomiendan alertas y evolución a doble control para categorías altamente restringidas.

## Lo que G2 aprobaría

G2 aprobaría la dirección arquitectónica y autorizaría continuar a la siguiente etapa que el roadmap habilite expresamente, usando las decisiones/ADR aceptadas como restricciones. También aprobaría los diferidos y condiciones indicados, sin declararlos resueltos.

## Lo que G2 NO autoriza

- código, scaffolding o instalación de dependencias;
- schemas, SQL, migraciones, endpoints o contrato API definitivo;
- infraestructura, cuentas cloud, secretos o deployment;
- datos reales o piloto productivo;
- integración técnica con EduPay;
- resolver Q-301..Q-309;
- afirmar matrícula a partir de aceptación o handoff;
- conclusión legal sobre C-013;
- iniciar una etapa no autorizada explícitamente por el roadmap y la aprobación humana.

## Condiciones sugeridas

1. Ejecutar PoC sintética de RLS/Prisma/pooling antes de G4.
2. Validar la implementación de sesión server-side y CSRF antes de exponer autenticación.
3. Cotizar deployment, storage y recuperación antes de aprovisionar.
4. Cerrar política legal/retención antes de datos reales.
5. Mantener la integración EduPay para E7/G7.

## Texto sugerido de aprobación humana

> Apruebo G2 para Admisión EduPay sobre el commit y PR identificados en esta acta. Acepto las decisiones E2-D y ADR que se enumeren expresamente en la versión final, junto con sus condiciones y diferidos. Esta aprobación autoriza únicamente la siguiente etapa indicada por el roadmap; no autoriza implementación, infraestructura, datos reales ni integración técnica con EduPay. C-013 y las validaciones legales permanecen obligatorias antes de datos reales, y Q-301 a Q-309 siguen diferidas a E7/G7.

## Registro de decisión

Pendiente. No completar hasta recibir aprobación humana explícita con commit, fecha, autoridad, decisiones aceptadas y siguiente etapa autorizada.
