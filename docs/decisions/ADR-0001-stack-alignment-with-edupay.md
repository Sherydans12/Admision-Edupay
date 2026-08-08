# ADR-0001: Alineación del stack con EduPay

- **Estado:** ACCEPTED
- **Fecha:** 2026-08-06
- **Decisor:** Nicolás Sena
- **Compuerta:** G2 — `APPROVED / CLOSED`
- **Aprobación:** 2026-08-08 sobre `15b49e284ca642761f2df744ce73bb6a3d10e289`
- **Fuente:** SRC-005

## Contexto

EduPay ya opera con un stack conocido y Admisión deberá integrarse con ese dominio. Compartir conocimientos, convenciones y herramientas puede reducir fragmentación, pero copiar decisiones sin evaluar sus restricciones podría trasladar deuda o acoplar innecesariamente el producto.

### Stack vigente de EduPay

| Área | Tecnología |
| --- | --- |
| Backend | NestJS 11, TypeScript, Prisma 7, Passport JWT |
| Frontend | Next.js 16 App Router, React 19, Tailwind CSS, Zod 4, React Hook Form |
| Datos | PostgreSQL 15 |
| API/documentación | Swagger / OpenAPI 3.0 en `/api/docs` |
| Despliegue | cPanel / Passenger como Node.js App |
| Desarrollo local | Docker Compose para PostgreSQL |

## Fuerzas

- Capacidad del equipo y reutilización de conocimiento.
- Coherencia de contratos, validaciones y lenguaje TypeScript.
- Operación y soporte simplificados.
- Necesidades específicas de aislamiento multiempresa, archivos privados, auditoría y trabajos asíncronos.
- Capacidad real del entorno de despliegue.
- Independencia de dominios y ciclos de evolución.
- Seguridad, mantenibilidad, costos y reversibilidad.

## Opciones consideradas

### Opción A — Alinear el stack principal

Usar las mismas tecnologías principales de backend, frontend y datos, después de verificar versiones y restricciones.

**Ventajas:** menor curva de aprendizaje, convenciones compartidas, potencial reutilización de contratos y validaciones, menor diversidad operativa.

**Riesgos:** heredar limitaciones de despliegue, confundir alineación tecnológica con acoplamiento de repositorios o bases, y omitir evaluación de necesidades nuevas.

### Opción B — Stack independiente

Elegir tecnologías sólo por necesidades de Admisión.

**Ventajas:** libertad de optimización y oportunidad de corregir limitaciones actuales.

**Riesgos:** mayor fragmentación, operación duplicada, contratos más difíciles de compartir y mayor costo cognitivo.

### Opción C — Alineación parcial

Compartir lenguaje/contratos o algunas capas, pero divergir en componentes justificados.

**Ventajas:** equilibrio entre coherencia y adecuación.

**Riesgos:** frontera más compleja, tooling duplicado y riesgo de divergencia gradual sin gobernanza.

## Decisión

Se adopta la **Opción A: utilizar el mismo stack principal de EduPay** para reducir fragmentación operativa y reutilizar conocimientos, contratos y validaciones, manteniendo dominios, repositorios, datos y sesiones independientes.

La decisión fue aceptada en G2. No implica adoptar cPanel/Passenger ni autoriza por sí sola scaffolding, dependencias o implementación fuera de las compuertas posteriores.

## Evidencia E2

La evaluación comparativa de E2 en [`docs/e2/02-stack-evaluation.md`](../e2/02-stack-evaluation.md) confirma que la alineación principal reduce curva y fragmentación sin exigir compartir repositorio, base de datos, tablas, sesiones ni ciclo de despliegue con EduPay.

E2 mantiene NestJS 11, TypeScript, Prisma 7, Next.js 16, React 19, PostgreSQL 15 y OpenAPI 3 como referencia inicial, verificando compatibilidad y mantenimiento antes de instalar dependencias. La alineación no incluye adoptar cPanel/Passenger: el runtime de Admisión debe satisfacer workers, scheduler, archivos privados, antivirus, observabilidad y recuperación conforme a ADR-0005.

## Decisiones fuera del alcance de esta ADR

Esta ADR decide únicamente alineación de stack. Las decisiones complementarias se registran separadamente:

- monorepo, workspaces y paquetes permitidos: `E2-D-003`;
- arquitectura de archivos: ADR-0004; proveedor aún diferido;
- correo y jobs: `E2-D-011/012`; proveedores aún diferidos;
- mecanismo definitivo de integración EduPay: diferido a E7/G7;
- deployment y uso de cPanel/Passenger: ADR-0005;
- arquitectura física multiempresa: ADR-0003;
- identidad y estrategia de sesión: `E2-D-007`;
- CI/CD ejecutable e infraestructura: fuera de E2.

Docker Compose figura únicamente como práctica local vigente de EduPay; su uso en Admisión debe concretarse en la fundación técnica conforme a las decisiones aprobadas.

## Condiciones aceptadas

1. Confirmar compatibilidad de versiones y mantenimiento antes del scaffolding definitivo.
2. No heredar cPanel/Passenger por similitud tecnológica; aplicar ADR-0005.
3. Mantener estrategia de tenancy y defensas en profundidad de ADR-0003.
4. Mantener sesiones, autorización y auditoría como diseños explícitos independientes del framework.
5. Validar operación, observabilidad, backups y recuperación en las compuertas técnicas correspondientes.
6. Mantener costos y reversibilidad visibles antes de aprovisionamiento.
7. Mantener integración EduPay sin tablas compartidas y con contrato técnico diferido a E7/G7.
8. Registrar cambios arquitectónicos posteriores mediante ADR y revisión de impacto.

## Seguridad, privacidad y multitenancy

Compartir stack no comparte contexto de seguridad. Admisión debe implementar autorización por tenant/recurso/propósito, datos sensibles, archivos privados, auditoría de lecturas y separación de dominios. Prisma/PostgreSQL o Passport no resuelven por sí solos aislamiento ni sesiones seguras.

## Validación y reversibilidad

Antes del primer esquema persistente deberán validarse compatibilidad de versiones, RLS/pooling, sesiones y runtime según las ADR relacionadas. El PoC obligatorio de tenant/RLS/Prisma definido en ADR-0003 debe cumplirse antes de G4. Cambios posteriores al scaffolding o contratos públicos aumentan significativamente el costo de reversión.

## Consecuencias de la decisión

- El equipo priorizará convenciones compatibles con EduPay.
- Cada reutilización deberá mantener límites de dominio.
- El despliegue y la integración conservan decisiones propias.
- Las versiones exactas se validarán en el momento de fundación técnica.

## Referencias

- `SRC-005` en `docs/01-source-analysis.md`.
- D-007, D-010 y Q-401 en `docs/09-open-questions.md`.
- `docs/07-edupay-integration-boundary.md`.
- `docs/06-multitenancy-security.md`.
- `docs/e2/02-stack-evaluation.md`.
- `docs/e2/11-e2-decision-workbook.md` (`E2-D-002`).
- `docs/approvals/G2-architecture-approval-2026-08-08.md`.
