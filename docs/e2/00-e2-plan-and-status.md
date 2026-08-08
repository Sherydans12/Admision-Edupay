# E2 — Plan y estado de arquitectura

## Control

| Campo | Valor |
| --- | --- |
| Etapa | E2 — Arquitectura |
| Estado | `CLOSED / ARCHITECTURE APPROVED` |
| Inicio autorizado | `2026-08-08T06:20:00-04:00` |
| Cierre aprobado | `2026-08-08T07:08:00-04:00` |
| Commit arquitectónico aprobado | `15b49e284ca642761f2df744ce73bb6a3d10e289` |
| Rama | `docs/e2-architecture` |
| Dependencia | G1 `APPROVED / CLOSED` |
| G2 | `APPROVED / CLOSED` |
| ADR-0001 | `ACCEPTED` |
| ADR-0002 | `ACCEPTED` |
| ADR-0003 | `ACCEPTED_WITH_CONDITION` |
| ADR-0004 | `ACCEPTED` |
| ADR-0005 | `ACCEPTED` |
| E3 | `AUTHORIZED TO START` después de fusionar PR #5 |
| Implementación | No autorizada |
| Datos reales | No autorizados |
| Integración técnica EduPay | No autorizada |

Registro formal: `docs/approvals/G2-architecture-approval-2026-08-08.md`.

## Objetivo

Convertir la especificación funcional aprobada en una arquitectura segura, reversible y suficientemente concreta para decidir G2, sin crear todavía código de producción.

## Resultado aprobado

G2 aceptó E2-D-001 a E2-D-017 y la dirección arquitectónica consolidada:

1. modular monolith con web, API y worker separables;
2. stack TypeScript/NestJS/Next.js/React/Prisma/PostgreSQL alineado con EduPay sin compartir dominio, datos ni sesiones;
3. monorepo independiente con pnpm workspaces y Turborepo opcional por evidencia;
4. PostgreSQL como base transaccional;
5. shared database/shared schema con `tenantId` obligatorio;
6. RLS como defensa adicional con PoC sintética obligatoria antes de G4;
7. identidad global + memberships tenant + sesión opaca server-side para web MVP;
8. autorización deny-by-default por tenant, recurso, scope, sensibilidad, propósito y separación de funciones;
9. SELF-ELEVATION explícita, temporal y auditable;
10. object storage privado S3-compatible, cuarentena y malware scanning fail-closed;
11. versionado/inmutabilidad de formularios, snapshots, documentos, recomendaciones y decisiones;
12. transacciones, locks, constraints, idempotencia y control optimista para consistencia;
13. PostgreSQL-backed jobs + outbox + worker, sin Redis/BullMQ inicial;
14. email por adaptador, separado del estado de negocio;
15. auditoría separada de logs, eventos de seguridad y métricas;
16. runtime Linux containerizado con servicios administrados selectivos;
17. RPO 1 h/RTO 4 h como objetivos técnicos iniciales, no SLA;
18. estrategia de pruebas con DB real, aislamiento tenant, seguridad, concurrencia y E2E;
19. threat model STRIDE y controles residuales;
20. boundary EduPay preservado sin resolver Q-301 a Q-309.

## Condición obligatoria antes de G4

La PoC de tenant/RLS/Prisma debe demostrar:

1. request con tenant correcto;
2. job con tenant correcto;
3. ausencia de tenant context = `DENY`;
4. intento cross-tenant = `DENY`;
5. pooling sin fuga de tenant context;
6. Prisma compatible con transacciones y RLS;
7. rol de aplicación separado del rol de migraciones;
8. comportamiento fail-closed.

Si falla, RLS no se deshabilita silenciosamente: se requiere revisión arquitectónica y aprobación de una defensa equivalente antes de G4.

## Q-201 a Q-210

La parte arquitectónica quedó tratada al nivel requerido para G2. Los componentes legales, institucionales u operativos conservan sus compuertas:

- Q-201/Q-202/Q-208 y C-013 antes de datos reales/piloto productivo;
- Q-203 con selección de proveedores/regiones;
- Q-204 con política exacta de MFA;
- Q-205 con operación e incidentes;
- Q-206 con revalidación de RPO/RTO y proveedor;
- Q-207 con volumen/capacidad;
- Q-209 con dispositivos/red institucional;
- Q-210 con validaciones de seguridad pre-piloto.

Q-301 a Q-309 siguen `FUTURE_INTEGRATION_PENDING` para E7/G7. Q-310 continúa `APPROVED_PRODUCT / FUNCTIONALLY_RESOLVED`.

## Entregables cerrados

- `01-architecture-overview.md`
- `02-stack-evaluation.md`
- `03-logical-data-model.md`
- `04-multitenancy-authorization-architecture.md`
- `05-files-security-architecture.md`
- `06-concurrency-and-consistency.md`
- `07-audit-observability-recovery.md`
- `08-deployment-and-environments.md`
- `09-testing-strategy.md`
- `10-threat-model.md`
- `11-e2-decision-workbook.md`
- `12-g2-readiness-checklist.md`
- ADR-0001..ADR-0005
- `docs/approvals/G2-architecture-approval-2026-08-08.md`

## Límites preservados

El cierre E2/G2 no autoriza:

- scaffolding o código;
- dependencias de aplicación;
- migraciones o schema ejecutable;
- infraestructura productiva;
- datos reales;
- integración ejecutable con EduPay.

## Siguiente etapa

E3 — Prototipo UX queda autorizada después de la fusión del PR #5. E3 debe validar arquitectura de información, pantallas, estados, comprensión, accesibilidad y recorridos críticos usando únicamente datos sintéticos. G3 permanece `NO APROBADA` hasta decisión humana explícita.
