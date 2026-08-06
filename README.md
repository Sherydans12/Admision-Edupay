# Admisión EduPay

Admisión EduPay es un portal SaaS multiempresa para gestionar procesos de admisión escolar. Permitirá a familias postular uno o más estudiantes y a las instituciones configurar, operar y auditar sus procesos por sede, año académico y curso.

La primera institución prevista es Colegio Particular Conquistadores. El producto, sus conceptos y sus límites no deben quedar acoplados a ese colegio.

## Estado actual

El proyecto se encuentra en **fundación documental y descubrimiento**. Este repositorio contiene, por ahora, solamente definiciones de alcance, requisitos iniciales, modelo conceptual, criterios de seguridad, preguntas abiertas y compuertas de aprobación.

Todavía no se ha seleccionado un stack definitivo ni se ha creado código de aplicación, esquema SQL, migraciones, contenedores, pipelines o infraestructura.

## Principios

- Multiempresa desde el diseño, con aislamiento institucional obligatorio.
- Privacidad y mínimo privilegio, especialmente para datos de menores, salud, necesidades educativas y finanzas.
- Dominios Admisión y EduPay desacoplados, integrados mediante contratos explícitos.
- Flujo configurable sobre una estructura común, trazable y auditable.
- Diferenciación entre hechos confirmados, decisiones aprobadas, supuestos y preguntas abiertas.
- Entregas pequeñas con aprobación humana antes de avanzar de etapa.
- Trazabilidad entre requisitos, decisiones, implementación futura y pruebas.
- Simplicidad operativa sin debilitar seguridad ni capacidad multiempresa.

## Estructura documental

| Documento | Propósito |
| --- | --- |
| `AGENTS.md` | Reglas obligatorias para agentes y colaboradores. |
| `docs/00-vision-scope.md` | Visión, alcance y límites iniciales. |
| `docs/01-source-analysis.md` | Evidencia disponible, extracción y vacíos de información. |
| `docs/02-admission-workflow.md` | Flujo conceptual, estados, transiciones y vistas. |
| `docs/03-functional-requirements.md` | Requisitos funcionales identificados y trazables. |
| `docs/04-non-functional-requirements.md` | Seguridad, privacidad, disponibilidad y operación. |
| `docs/05-domain-model.md` | Modelo de dominio y agregados conceptuales. |
| `docs/06-multitenancy-security.md` | Aislamiento, autorización y controles de datos sensibles. |
| `docs/07-edupay-integration-boundary.md` | Límite conceptual de integración con EduPay. |
| `docs/08-roles-permissions-draft.md` | Borrador no aprobado de roles y permisos. |
| `docs/09-open-questions.md` | Preguntas, supuestos y decisiones pendientes. |
| `docs/10-roadmap-approval-gates.md` | Etapas de trabajo y compuertas de aprobación. |
| `docs/decisions/ADR-0000-decision-process.md` | Proceso para registrar decisiones arquitectónicas. |

## Cómo continuar

1. Revisar la fuente y los vacíos indicados en `docs/01-source-analysis.md`.
2. Resolver primero las preguntas bloqueantes de `docs/09-open-questions.md`.
3. Aprobar, ajustar o rechazar las decisiones propuestas para esta etapa.
4. Registrar las decisiones aprobadas mediante ADR cuando corresponda.
5. Cerrar la compuerta G0 descrita en `docs/10-roadmap-approval-gates.md`.
6. Iniciar diseño funcional solamente después de una aprobación humana explícita.

No se debe comenzar scaffolding, seleccionar definitivamente el stack ni implementar una integración con EduPay antes de esa aprobación.
