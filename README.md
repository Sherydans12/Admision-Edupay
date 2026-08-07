# Admisión EduPay

Admisión EduPay es un portal SaaS multiempresa para gestionar procesos de admisión escolar. Permitirá a familias postular uno o más estudiantes y a las instituciones configurar, operar y auditar sus procesos por sede, año académico y curso.

La primera institución prevista es Colegio Particular Conquistadores. El producto, sus conceptos y sus límites no deben quedar acoplados a ese colegio.

## Estado actual

La **fundación documental G0 está aprobada y cerrada** sobre el commit `1d33191d7b0bb9e4d6f2c99dfa9a8baed701a379`. La aprobación fue otorgada por Nicolás Sena el `2026-08-06T14:16:00-04:00`, con Arturo Javier Galleguillos Trigo, Sostenedor de Colegio Particular Conquistadores, como representante formal institucional.

E1 — Diseño funcional está autorizada. G1 no está aprobada y conserva asuntos diferidos que deben resolverse antes de su cierre.

Esta autorización permite únicamente continuar el diseño funcional. No autoriza implementación, uso de datos reales, integración ejecutable ni selección definitiva de stack. `ADR-0001` permanece `PROPOSED`.

**E1-A — Decisiones funcionales de producto aprobadas; validación institucional pendiente** en la rama `docs/e1-functional-baseline`, mediante el PR borrador **“E1-A: Define functional baseline and decision pack”** hacia `main`. La aprobación consolidada de Nicolás Sena quedó registrada el `2026-08-06T22:09:00-04:00`; E1-B aún no inicia. Esta entrega continúa sin autorizar implementación, scaffolding, dependencias ni decisiones de arquitectura. Estado y plan: [`docs/e1/00-e1-plan-and-status.md`](docs/e1/00-e1-plan-and-status.md); acta: [`docs/approvals/E1-A-functional-decisions-2026-08-06.md`](docs/approvals/E1-A-functional-decisions-2026-08-06.md).

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
| `docs/approvals/G0-foundation-closure-2026-08-06.md` | Registro formal de aprobación y cierre de G0. |
| `docs/decisions/ADR-0000-decision-process.md` | Proceso para registrar decisiones arquitectónicas. |
| `docs/decisions/ADR-0001-stack-alignment-with-edupay.md` | Propuesta de alineación tecnológica con EduPay. |
| `docs/e1/00-e1-plan-and-status.md` | Plan, alcance, bloqueos y estado de E1-A. |

## Cómo continuar

1. Iniciar E1 únicamente como diseño funcional.
2. Resolver los asuntos diferidos a G1 registrados en `docs/09-open-questions.md`.
3. Validar el formulario, catálogo documental, reglas institucionales y casos de excepción antes de cerrar G1.
4. Designar al responsable legal/normativo antes de autorizar datos reales para el piloto.
5. Evaluar `ADR-0001` en arquitectura antes de cualquier scaffolding.

No se debe comenzar scaffolding, seleccionar definitivamente el stack, usar datos reales ni implementar una integración con EduPay por efecto del cierre de G0.
