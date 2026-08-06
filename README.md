# Admisión EduPay

Admisión EduPay es un portal SaaS multiempresa para gestionar procesos de admisión escolar. Permitirá a familias postular uno o más estudiantes y a las instituciones configurar, operar y auditar sus procesos por sede, año académico y curso.

La primera institución prevista es Colegio Particular Conquistadores. El producto, sus conceptos y sus límites no deben quedar acoplados a ese colegio.

## Estado actual

El proyecto se encuentra en **fundación documental y descubrimiento**. La documentación ya incorpora el proceso y la ficha institucional del piloto 2027, decisiones funcionales del propietario y el stack vigente de EduPay como fuentes autorizadas.

Las decisiones G0 `D-001` a `D-010` están aprobadas. G0 todavía no se considera cerrada porque faltan la designación del representante formal del colegio y validaciones institucionales expresamente registradas.

Existe una preferencia documentada, aún no aprobada, por alinear el stack con EduPay. Todavía no se ha seleccionado un stack definitivo ni se ha creado código de aplicación, esquema SQL, migraciones, contenedores, pipelines o infraestructura.

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
| `docs/11-pilot-colegio-conquistadores-2027.md` | Configuración funcional conocida del piloto 2027. |
| `docs/decisions/ADR-0000-decision-process.md` | Proceso para registrar decisiones arquitectónicas. |
| `docs/decisions/ADR-0001-stack-alignment-with-edupay.md` | Propuesta de alineación tecnológica con EduPay. |

## Cómo continuar

1. Revisar las fuentes y diferencias indicadas en `docs/01-source-analysis.md`.
2. Validar con Admisión y/o Dirección las contradicciones institucionales pendientes.
3. Designar al representante formal del colegio para las compuertas y al responsable legal antes del piloto.
4. Resolver las preguntas bloqueantes restantes de `docs/09-open-questions.md`.
5. Cerrar G0 mediante aprobación humana explícita y registro del commit aprobado.
6. Iniciar diseño funcional; la propuesta de stack se evaluará mediante `ADR-0001` en arquitectura, antes de scaffolding.

No se debe comenzar scaffolding, seleccionar definitivamente el stack ni implementar una integración con EduPay antes de esa aprobación.
