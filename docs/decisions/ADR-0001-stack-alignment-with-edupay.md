# ADR-0001: Alineación del stack con EduPay

- **Estado:** PROPOSED / RECOMMENDED_FOR_G2
- **Fecha:** 2026-08-06
- **Decisor propuesto:** Nicolás Sena
- **Compuerta objetivo:** G2 — arquitectura, antes de scaffolding
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

## Recomendación

Adoptar la **Opción A: utilizar el mismo stack principal de EduPay** para reducir fragmentación operativa y reutilizar conocimientos, contratos y validaciones, siempre que la etapa de arquitectura confirme que satisface seguridad, multitenancy, archivos, auditoría, rendimiento y operación.

Esta recomendación no está aprobada y no autoriza instalar dependencias ni iniciar scaffolding.

## Evidencia E2

La evaluación comparativa de E2 en [`docs/e2/02-stack-evaluation.md`](../e2/02-stack-evaluation.md) confirma que la alineación principal reduce curva y fragmentación sin exigir compartir repositorio, base de datos, tablas, sesiones ni ciclo de despliegue con EduPay.

E2 recomienda mantener NestJS 11, TypeScript, Prisma 7, Next.js 16, React 19, PostgreSQL 15 y OpenAPI 3 como referencia inicial, verificando compatibilidad y mantenimiento antes de instalar cualquier dependencia. La alineación no incluye adoptar cPanel/Passenger: el runtime de Admisión debe satisfacer workers, scheduler, archivos privados, antivirus, observabilidad y recuperación conforme a ADR-0005.

Por esta evidencia el ADR queda listo para decisión humana en G2, pero continúa `PROPOSED`.

## Decisiones fuera del alcance de esta ADR

Esta ADR decide únicamente alineación de stack. E2 formuló recomendaciones separadas para algunos puntos, que siguen `PROPOSED` hasta G2:

- monorepo, workspaces y paquetes permitidos: `E2-D-003`;
- arquitectura de archivos: ADR-0004; proveedor aún diferido;
- correo y jobs: `E2-D-011/012`; proveedores aún diferidos;
- mecanismo definitivo de integración;
- deployment y uso de cPanel/Passenger: ADR-0005;
- arquitectura física multiempresa: ADR-0003;
- identidad y estrategia de sesión: `E2-D-007`;
- CI/CD ejecutable e infraestructura, fuera de E2.

Docker Compose figura únicamente como práctica local vigente de EduPay; no se crea ni adopta en esta etapa.

## Condiciones para aceptar

1. Confirmar compatibilidad de versiones y mantenimiento.
2. Evaluar restricciones de cPanel/Passenger frente a trabajos asíncronos, archivos y escalabilidad.
3. Definir estrategia de tenancy y probar defensas en profundidad.
4. Modelar amenazas, sesiones, autorización y auditoría.
5. Evaluar operación, observabilidad, backups y recuperación.
6. Comparar costos y reversibilidad con al menos una alternativa.
7. Validar contrato de integración sin compartir tablas.
8. Registrar decisiones diferidas en ADR separados cuando corresponda.

## Seguridad, privacidad y multitenancy

Compartir stack no comparte contexto de seguridad. Admisión debe implementar autorización por tenant/recurso/propósito, datos sensibles, archivos privados, auditoría de lecturas y separación de dominios. Prisma/PostgreSQL o Passport JWT, si se adoptan, no resuelven por sí solos aislamiento ni sesiones seguras.

## Validación y reversibilidad

El análisis arquitectónico autorizado está consolidado en E2 sin datos reales. Antes del primer esquema persistente deberán validarse compatibilidad de versiones, RLS/pooling, sesiones y runtime según las ADR relacionadas. La decisión puede revisarse antes de scaffolding o contrato público; después, el costo de reversión aumenta significativamente.

## Consecuencias si se acepta

- El equipo priorizará convenciones compatibles con EduPay.
- Cada reutilización deberá mantener límites de dominio.
- El despliegue y la integración seguirán necesitando ADR propios.
- Las versiones exactas se validarán en el momento de fundación técnica; no se instalan por este documento.

## Referencias

- `SRC-005` en `docs/01-source-analysis.md`.
- D-007, D-010 y Q-401 en `docs/09-open-questions.md`.
- `docs/07-edupay-integration-boundary.md`.
- `docs/06-multitenancy-security.md`.
- `docs/e2/02-stack-evaluation.md`.
- `docs/e2/11-e2-decision-workbook.md` (`E2-D-002`).
