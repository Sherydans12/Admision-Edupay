# ADR-0003: Shared-schema tenancy con defensa RLS

- **Estado:** ACCEPTED_WITH_CONDITION
- **Fecha:** 2026-08-08
- **Decisor:** Nicolás Sena
- **Compuerta:** G2 — `APPROVED / CLOSED`
- **Aprobación:** 2026-08-08 sobre `15b49e284ca642761f2df744ce73bb6a3d10e289`

## Contexto y requisitos

Admisión es SaaS multiempresa y debe negar fugas entre tenants (`AC-050`, `AC-051`). El piloto parte con una institución, pero ésta no puede ser una excepción del núcleo. Se necesitan migraciones, onboarding, reporting y costos manejables.

## Opciones consideradas

1. database-per-tenant;
2. schema-per-tenant;
3. shared database/shared schema con `tenantId`;
4. estrategia híbrida futura.

Las dos primeras ofrecen fronteras físicas mayores pero multiplican migraciones y operación desde el MVP. Shared schema concentra riesgo de consulta, pero permite defensas aplicativas y de base coherentes.

## Decisión

Usar shared database/shared schema con `tenantId` obligatorio en todo agregado tenant-owned. El tenant efectivo se resuelve server-side desde sesión/membership o elevación, nunca desde un body/query como autoridad.

Aplicar defensa en profundidad:

- servicios y repositorios tenant-aware;
- autorización recurso/tenant;
- índices y unicidad compuestos;
- referencias same-tenant;
- deny cuando no exista contexto;
- RLS en tablas tenant-owned desde primera persistencia, condicionada a un PoC de Prisma, pooling, migraciones y roles DB antes de G4;
- pruebas negativas cross-tenant obligatorias.

La decisión fue aceptada en G2 con condición obligatoria de PoC previa a G4.

## Condición obligatoria antes de G4

El PoC sintético debe demostrar:

1. request con tenant correcto;
2. job con tenant correcto;
3. ausencia de tenant context = `DENY`;
4. intento cross-tenant = `DENY`;
5. pooling sin fuga de tenant context;
6. compatibilidad de Prisma con transacciones y RLS;
7. rol de aplicación separado del rol de migraciones;
8. comportamiento fail-closed.

Si RLS no puede aplicarse con garantías, no se deshabilita silenciosamente. El diseño vuelve a revisión arquitectónica y debe aprobarse una defensa equivalente antes de continuar hacia G4.

## Consecuencias

### Positivas

- costo y operación iniciales contenidos;
- migraciones y reporting centralizados;
- RLS limita el impacto de un filtro omitido;
- ruta futura a tenants dedicados mediante ownership explícito.

### Negativas y riesgos

- un rol DB con bypass o contexto de conexión incorrecto debilita RLS;
- índices y relaciones deben incluir tenant consistentemente;
- exportación/extracción futura requiere tooling.

## Seguridad y privacidad

RLS no reemplaza autorización por persona, recurso, sensibilidad ni propósito. Los jobs, reportes, auditoría y soporte usan el mismo contexto efectivo. El Superadministrador Global no recibe lectura implícita; una SELF-ELEVATION temporal crea el único contexto excepcional aprobado para el MVP.

## Operación y costos

Se evita una base por tenant durante el piloto. Backup/restore por tenant es más complejo que restaurar toda la base; exportación o recuperación selectiva necesitará diseño posterior y autorización.

## Validación y reversibilidad

Además del PoC previo a G4, E4/E5 deben mantener pruebas negativas cross-tenant y validaciones de pooling/contexto. La estrategia puede revisarse si evidencia técnica demuestra una limitación material, pero nunca degradando silenciosamente la defensa.

## Referencias

- [`docs/e2/04-multitenancy-authorization-architecture.md`](../e2/04-multitenancy-authorization-architecture.md)
- [`docs/e2/09-testing-strategy.md`](../e2/09-testing-strategy.md)
- `E2-D-005/006` en [`docs/e2/11-e2-decision-workbook.md`](../e2/11-e2-decision-workbook.md)
- [`docs/approvals/G2-architecture-approval-2026-08-08.md`](../approvals/G2-architecture-approval-2026-08-08.md)
