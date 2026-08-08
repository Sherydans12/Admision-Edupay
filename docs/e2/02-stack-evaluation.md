# Evaluación de stack y estructura de repositorio

## Estado

| Campo | Valor |
| --- | --- |
| Decisión | `PROPOSED / RECOMMENDED_FOR_G2` |
| ADR relacionada | ADR-0001 |
| Implementación | No autorizada |

## Opciones

### A. Alineación principal con EduPay

- Backend: NestJS 11, TypeScript, Prisma 7, Passport como integración de estrategias.
- Frontend: Next.js 16 App Router, React 19, Tailwind, Zod 4 y React Hook Form.
- Datos: PostgreSQL 15.
- Contratos: OpenAPI 3 para interfaces HTTP futuras.

No implica compartir repositorio, base, autenticación, sesiones ni tablas con EduPay. Tampoco obliga a usar cPanel/Passenger.

### B. Alineación parcial

Mantener TypeScript, contratos y PostgreSQL, pero cambiar framework backend, ORM o frontend cuando exista evidencia de una ventaja material.

### C. Stack independiente

Seleccionar lenguaje, frameworks y datos sin buscar alineación con EduPay.

## Comparación

Escala: 1 desfavorable, 3 neutral, 5 favorable. Los puntajes son análisis E2, no aprobación.

| Criterio | A principal | B parcial | C independiente | Observación |
| --- | ---: | ---: | ---: | --- |
| Velocidad inicial | 5 | 4 | 2 | Conocimiento y convenciones existentes favorecen A |
| Experiencia/reutilización | 5 | 4 | 2 | Reutilización sólo de paquetes neutrales y contratos versionados |
| Seguridad | 4 | 4 | 3 | Depende del diseño; Passport JWT no resuelve sesiones ni autorización |
| Multitenancy | 4 | 4 | 3 | PostgreSQL/Prisma permiten estrategia propuesta, con validación RLS necesaria |
| Librerías | 5 | 5 | 3 | Ecosistema Node/TypeScript cubre web, validación, archivos y testing |
| Jobs asíncronos | 4 | 4 | 4 | Requiere worker; no depende de Nest por sí solo |
| Archivos | 4 | 4 | 4 | SDK S3-compatible y streaming disponibles |
| Testing | 5 | 4 | 3 | Ecosistema maduro; selección concreta queda E4 |
| Observabilidad | 4 | 4 | 4 | OpenTelemetry/logging estructurado disponibles |
| Deployment | 3 | 4 | 4 | A es adecuado en contenedores; cPanel limita workers/SSR/AV |
| Costos de equipo | 5 | 4 | 2 | Menor diversidad con A |
| Reversibilidad | 4 | 4 | 3 | Contratos, adapters y módulos reducen lock-in |
| Integración futura EduPay | 5 | 4 | 2 | Tipos y herramientas coherentes, sin acoplar dominios |

## Recomendación

Recomendar **Alineación principal con EduPay**, con dos límites:

1. la topología de despliegue se decide por necesidades de Admisión, no por herencia de cPanel;
2. sesiones, tenancy, autorización, jobs, archivos y auditoría se diseñan explícitamente; no se copian por similitud tecnológica.

### Stack recomendado para decisión G2

| Área | Propuesta | Condición |
| --- | --- | --- |
| Lenguaje | TypeScript | Configuración estricta futura; contratos explícitos |
| API/aplicación | NestJS 11 | Monolito modular; adapters para externos |
| Web | Next.js 16 App Router + React 19 | SSR/BFF sólo si respeta frontera API y autorización server-side |
| Validación UI/contratos | Zod 4 + React Hook Form | No reemplaza validación de servidor |
| Estilos | Tailwind | Decisión reversible de UI, sin impacto de dominio |
| Persistencia | PostgreSQL 15 + Prisma 7 | RLS/transactions/concurrencia requieren prueba técnica en E4 |
| Documentación HTTP | OpenAPI 3 | No define todavía endpoints ni contrato EduPay |
| Autenticación | Passport como adapter | Sesión opaca server-side y autorización son diseños separados |

## Repositorio

### Monorepo vs multirepo

| Criterio | Monorepo | Multirepo |
| --- | --- | --- |
| Cambios web/API/contratos | Atómicos | Coordinación y versionado externo |
| Reglas de importación | Centralizables | Aislamiento fuerte por repositorio |
| CI y releases | Un grafo, múltiples artefactos | Pipelines independientes |
| Complejidad inicial | Moderada | Mayor para un solo equipo |
| Extracción futura | Posible con límites de paquete | Natural, pero prematura |

**Recomendación:** monorepo de Admisión, separado del repositorio EduPay.

### Gestor y workspaces

Recomendar **pnpm workspaces** por instalación eficiente, lockfile único y límites claros. Recomendar **Turborepo** sólo como coordinador liviano de tareas/caché cuando E4 cree más de un artefacto; no usar Nx inicialmente porque su modelo/generadores añaden una capa de gobernanza que no se justifica para el tamaño conocido.

La adopción de pnpm/Turborepo permanece propuesta; no se crea `package.json` ni configuración.

### Estructura conceptual

```text
apps/
  api/
  web/
  worker/
packages/
  contracts/
  validation/
  config/
  eslint-config/
  typescript-config/
```

`contracts` contiene tipos/esquemas de intercambio internos y API pública versionada, nunca entidades ORM. `validation` sólo contiene validaciones puras compartibles; reglas de negocio permanecen en el módulo dueño. `config` expone lectura tipada, no secretos.

## Reglas de importación propuestas

- `apps/web` puede importar contratos, validaciones seguras y config pública; no dominio, persistencia ni secretos.
- `apps/api` y `apps/worker` consumen módulos de aplicación compartidos por composición, sin importar implementaciones de otro contexto por ruta interna.
- Los módulos de dominio no importan web, transporte, Prisma ni proveedores.
- `packages/contracts` no depende de aplicaciones ni de ORM.
- No se comparte código de negocio con EduPay por copia o importación directa; un paquete común futuro requeriría ownership y versionado independientes.
- Los imports entre módulos se controlan por entrypoints públicos y reglas estáticas futuras.

## Riesgos y validación requerida

- Confirmar compatibilidad real de Prisma 7 con RLS y pooling antes de persistencia.
- Confirmar soporte de Next.js 16/NestJS 11 en runtime objetivo.
- Verificar mantenimiento y seguridad de versiones al iniciar E4, sin instalar ahora.
- Comparar costo operativo del deployment recomendado frente a cPanel y plataforma administrada.

ADR-0001 puede pasar a `PROPOSED / RECOMMENDED_FOR_G2`, pero sólo aprobación humana G2 puede aceptarla.
