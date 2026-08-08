# ADR-0003: Shared-schema tenancy con defensa RLS

- **Estado:** PROPOSED / RECOMMENDED_FOR_G2
- **Fecha:** 2026-08-08
- **Decisores propuestos:** Nicolás Sena y responsables de arquitectura/seguridad
- **Compuerta:** G2

## Contexto y requisitos

Admisión es SaaS multiempresa y debe negar fugas entre tenants (`AC-050`, `AC-051`). El piloto parte con una institución, pero ésta no puede ser una excepción del núcleo. Se necesitan migraciones, onboarding, reporting y costos manejables.

## Opciones consideradas

1. database-per-tenant;
2. schema-per-tenant;
3. shared database/shared schema con `tenantId`;
4. estrategia híbrida futura.

Las dos primeras ofrecen fronteras físicas mayores pero multiplican migraciones y operación desde el MVP. Shared schema concentra riesgo de consulta, pero permite defensas aplicativas y de base coherentes.

## Decisión propuesta

Usar shared database/shared schema con `tenantId` obligatorio en todo agregado tenant-owned. El tenant efectivo se resuelve server-side desde sesión/membership o elevación, nunca desde un body/query como autoridad.

Aplicar defensa en profundidad:

- servicios y repositorios tenant-aware;
- autorización recurso/tenant;
- índices y unicidad compuestos;
- referencias same-tenant;
- deny cuando no exista contexto;
- RLS en tablas tenant-owned desde primera persistencia, condicionada a un PoC de Prisma, pooling, migraciones y roles DB antes de G4;
- pruebas negativas cross-tenant obligatorias.

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

El PoC previo a G4 debe demostrar fail-closed sin contexto, ausencia de fuga en pooling, rol de migración separado, transacciones y tests cross-tenant. Si RLS no puede aplicarse con garantías, G4 deberá volver a decidir antes de persistir datos.

## Referencias

- [`docs/e2/04-multitenancy-authorization-architecture.md`](../e2/04-multitenancy-authorization-architecture.md)
- [`docs/e2/09-testing-strategy.md`](../e2/09-testing-strategy.md)
- `E2-D-005/006` en [`docs/e2/11-e2-decision-workbook.md`](../e2/11-e2-decision-workbook.md)
