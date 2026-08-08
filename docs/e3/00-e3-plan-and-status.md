# E3 — Plan y estado de Prototipo UX

## Control

| Campo | Valor |
| --- | --- |
| Etapa | E3 — Prototipo UX |
| Estado | `CLOSED / UX APPROVED` |
| Inicio autorizado | `2026-08-08T07:08:00-04:00` |
| Cierre aprobado | `2026-08-08T15:30:00-04:00` |
| Base | `main` en `c573dc39460620b82e8152717268bc28b4af3048` |
| Rama | `docs/e3-ux-prototype` |
| Dependencia | G2 `APPROVED / CLOSED` |
| G3 | `APPROVED / CLOSED` sobre `a659191f5b5190ddf6913b6417cdfccb7baf1a90` |
| HUX-001..HUX-005 | `RESOLVED`; HUX-005 incorpora UX-D-010 |
| E4 | `AUTHORIZED TO START` después de fusionar PR #6 |
| G4 | `NO APROBADA` |
| Scaffolding/dependencias E4 | Autorizados con datos sintéticos |
| Infraestructura local/desarrollo E4 | Autorizada según necesidad técnica |
| Infraestructura productiva | No autorizada |
| Datos reales | No autorizados |
| Integración técnica EduPay | No autorizada |

## Objetivo alcanzado

E3 validó a nivel de especificación UX que familias y personal institucional pueden comprender y ejecutar los recorridos críticos aprobados antes de construir la aplicación, reduciendo ambigüedad de navegación, contenido, estados y permisos visibles sin reabrir E1 ni modificar G2.

La etapa se mantuvo deliberadamente corta y centrada en las pantallas y estados necesarios para el recorrido P0 y la aprobación G3.

## Fuentes canónicas

- `docs/e1/11-functional-specification.md`
- `docs/e1/12-acceptance-criteria.md`
- `docs/e1/13-end-to-end-scenarios.md`
- `docs/e1/14-mvp-backlog.md`
- `docs/e2/01-architecture-overview.md`
- `docs/e2/03-logical-data-model.md`
- `docs/e2/04-multitenancy-authorization-architecture.md`
- `docs/e2/10-threat-model.md`
- `docs/approvals/G2-architecture-approval-2026-08-08.md`
- `docs/approvals/G3-ux-approval-2026-08-08.md`
- `docs/10-roadmap-approval-gates.md`
- `AGENTS.md`

## Alcance UX aprobado

### Familia

- crear/acceder a cuenta;
- seleccionar institución/proceso/oferta;
- registrar estudiante;
- completar formulario configurable;
- adjuntar documentos y corregir observaciones;
- consultar estado de postulación;
- ver cita y solicitar cambio;
- ver resultado comunicable;
- ver lista de espera sin posición numérica;
- recibir y aceptar/rechazar oferta;
- entender vencimiento de oferta;
- retiro voluntario;
- sesión expirada, errores y recuperación.

### Personal institucional

- dashboard/bandeja de trabajo;
- búsqueda y apertura de expediente;
- revisión documental;
- programación/reprogramación de actividades;
- registro simple de entrevista/evaluación;
- recomendación de Admisión;
- decisión de Dirección;
- gestión de cupos;
- lista de espera y promoción manual;
- gestión de ofertas;
- comunicaciones preparadas/fallidas;
- reportes/exportaciones según permiso;
- representación visual del flujo del caso.

### Administración/plataforma

Sólo lo mínimo necesario para validar UX de configuración institucional, permisos/accesos restringidos y SELF-ELEVATION de Superadministrador Global sin lectura ambiental del tenant.

## Principios UX aprobados

- Familia mobile-first.
- Personal desktop-first con tablet funcional.
- WCAG 2.2 AA como objetivo verificable.
- Lenguaje español claro.
- Portal como fuente oficial de estado.
- No mostrar a Familia información interna, recomendaciones, puntajes, comentarios o identidad de revisores.
- No mostrar posición numérica de lista de espera.
- No exponer cupos exactos por defecto.
- Distinguir disponibilidad categórica del proceso de una oferta de admisión emitida.
- No revelar existencia de casos/recursos ajenos.
- Confirmaciones explícitas en acciones críticas conforme HUX-005/UX-D-010.
- Fechas y vencimientos visibles con lenguaje comprensible.
- Estados vacíos, loading, error, sin permiso y sesión expirada diseñados explícitamente.

## Entregables consolidados

1. `01-information-architecture.md` — sitemap por audiencia, navegación y jerarquía.
2. `02-screen-inventory.md` — 42 pantallas P0 con actores, datos, acciones y trazabilidad.
3. `03-family-critical-flows.md` — wireflows familiares críticos.
4. `04-staff-critical-flows.md` — Secretaría, Admisión y Dirección.
5. `05-case-workspace.md` — header, stepper, tabs/secciones y visibilidad por rol.
6. `06-screen-states-and-feedback.md` — estados técnicos y de negocio.
7. `07-content-visibility-matrix.md` — visibilidad por audiencia, tenant, propósito y sensibilidad.
8. `08-accessibility-responsive.md` — WCAG 2.2 AA y responsive.
9. `09-form-patterns.md` — stepper, draft, validación, uploads y builder mínimo.
10. `10-capacity-waitlist-offer-ux.md` — disponibilidad, cupos internos, waitlist y oferta.
11. `11-session-security-ux.md` — sesión expirada, recuperación, prohibido y SELF-ELEVATION.
12. `12-prototype-board.md` — board conceptual de baja fidelidad.
13. `13-prototype-validation-scenarios.md` — 20 tareas sintéticas.
14. `14-ux-decision-workbook.md` — UX-D-001..UX-D-013 y HUX resueltas.
15. `15-g3-readiness-checklist.md` — `PASS_WITH_DEFERRED`, sin bloqueantes UX materiales.
16. `docs/approvals/G3-ux-approval-2026-08-08.md` — registro formal G3.

## Decisiones HUX cerradas

- HUX-001: IA diferenciada por audiencia.
- HUX-002: formulario stepper y workspace jerárquico.
- HUX-003: waitlist/oferta sin posición ni cupos exactos para Familia.
- HUX-004: responsive por audiencia y WCAG 2.2 AA.
- HUX-005: seguridad visible, sesión expirada, elevación explícita y UX-D-010 para confirmaciones críticas.

## Datos

E3 utilizó sólo datos sintéticos. Datos personales/documentos reales permanecen prohibidos hasta la compuerta correspondiente.

## Diferidos que no bloquean G3

- branding, logo, paleta, ilustraciones y microanimaciones;
- sistema de diseño exhaustivo;
- pantallas P1/P2 y reportes ampliados;
- copy final de marketing y textos legales;
- validación visual definitiva de contraste sobre interfaz ejecutable;
- MFA/step-up exactos;
- retención/legal C-013;
- proveedores e infraestructura productiva;
- integración técnica EduPay y Q-301..Q-309.

## Resultado G3

G3 fue aprobado explícitamente sobre el commit `a659191f5b5190ddf6913b6417cdfccb7baf1a90`, con checklist `PASS_WITH_DEFERRED` y sin bloqueantes UX materiales.

Registro: `docs/approvals/G3-ux-approval-2026-08-08.md`.

## Autorización E4

Después de fusionar PR #6 queda autorizado iniciar E4 — Fundación técnica con datos sintéticos. E4 puede crear scaffolding, dependencias, monorepo, Next.js, NestJS, Prisma/PostgreSQL de desarrollo, migraciones iniciales, pruebas, PoC tenant/RLS/Prisma, CI e infraestructura local/de desarrollo necesaria.

Esta autorización no equivale a G4 y no autoriza construcción funcional completa del MVP, datos reales, infraestructura productiva ni integración técnica EduPay.

## Siguiente compuerta

G4 — Autorización de construcción MVP. Antes de G4 debe aprobarse la PoC tenant/RLS/Prisma o una defensa equivalente mediante revisión arquitectónica si la PoC no satisface las condiciones de ADR-0003.