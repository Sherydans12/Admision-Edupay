# E3 — Plan y estado de Prototipo UX

## Control

| Campo | Valor |
| --- | --- |
| Etapa | E3 — Prototipo UX |
| Estado | `IN PROGRESS / READY FOR G3 REVIEW` |
| Inicio autorizado | `2026-08-08T07:08:00-04:00` |
| Base | `main` en `c573dc39460620b82e8152717268bc28b4af3048` |
| Rama | `docs/e3-ux-prototype` |
| Dependencia | G2 `APPROVED / CLOSED` |
| G3 | `NO APROBADA` |
| HUX-001..HUX-005 | `RESOLVED` sobre evidencia UX `046385b7cb552685a856ae8f5a8973def97c09f3` |
| Implementación | No autorizada |
| Scaffolding/dependencias | No autorizados |
| Infraestructura | No autorizada |
| Datos reales | No autorizados |

## Objetivo

Validar que familias y personal institucional puedan comprender y ejecutar los recorridos críticos aprobados antes de construir la aplicación. E3 debe reducir ambigüedad de navegación, contenido, estados y permisos visibles sin reabrir E1 ni modificar la arquitectura aprobada en G2.

La etapa se mantendrá deliberadamente corta: sólo se diseñan y validan las pantallas y estados necesarios para el recorrido P0 y la aprobación G3.

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
- `docs/10-roadmap-approval-gates.md`
- `AGENTS.md`

## Alcance E3

E3 produce evidencia UX suficiente para los recorridos críticos de:

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

Sólo lo mínimo necesario para validar UX de:

- configuración institucional visible;
- permisos y accesos restringidos;
- sesión/elevación de Superadministrador Global sin acceso ambiental al tenant.

No se diseña todavía un panel exhaustivo de plataforma si no es P0.

## Principios UX obligatorios

- Mobile-first para familia.
- Desktop-first adaptable para operación institucional.
- WCAG 2.2 AA como objetivo.
- Lenguaje español claro.
- Portal como fuente oficial de estado.
- No mostrar información interna, recomendaciones, puntajes, comentarios o identidad de revisores a familia.
- No mostrar posición numérica de lista de espera.
- No exponer cupos exactos por defecto.
- Distinguir disponibilidad categórica del proceso de una oferta de admisión emitida.
- No revelar existencia de casos/recursos ajenos.
- Confirmaciones explícitas en acciones irreversibles, sensibles o relevantes conforme HUX-005/UX-D-010.
- Fechas y vencimientos visibles con lenguaje comprensible.
- Estados vacíos, loading, error, sin permiso y sesión expirada diseñados explícitamente.

## Entregables consolidados

1. `01-information-architecture.md`
   - sitemap por audiencia;
   - navegación principal;
   - jerarquía de expediente;
   - rutas conceptuales, no rutas técnicas.

2. `02-screen-inventory.md`
   - catálogo de pantallas P0;
   - actor;
   - propósito;
   - datos visibles;
   - acciones;
   - AC/E2E relacionados.

3. `03-family-critical-flows.md`
   - wireflows de los recorridos familiares críticos.

4. `04-staff-critical-flows.md`
   - wireflows de Admisión, Secretaría, Dirección y roles autorizados.

5. `05-case-workspace.md`
   - header, stepper y tabs/secciones;
   - acciones y visibilidad por rol.

6. `06-screen-states-and-feedback.md`
   - loading;
   - empty;
   - validation;
   - error;
   - forbidden;
   - expired session;
   - pending async operation;
   - success/confirmation.

7. `07-content-visibility-matrix.md`
   - qué ve familia;
   - qué ve Secretaría;
   - qué ve Admisión;
   - qué ve Dirección;
   - qué permanece restringido.

8. `08-accessibility-responsive.md`
   - WCAG 2.2 AA;
   - teclado;
   - foco;
   - labels;
   - contraste como requisito de diseño;
   - errores accesibles;
   - touch targets;
   - responsive.

9. `09-form-patterns.md`
   - formulario por pasos, draft, validación, uploads y builder mínimo.

10. `10-capacity-waitlist-offer-ux.md`
    - categorías familiares, cupos internos, waitlist, oferta y vencimiento.

11. `11-session-security-ux.md`
    - sesión expirada, recuperación, prohibido y SELF-ELEVATION.

12. `12-prototype-board.md`
    - board navegable conceptual de baja fidelidad.

13. `13-prototype-validation-scenarios.md`
   - tareas de usabilidad con datos sintéticos;
   - expected outcome;
   - severidad de hallazgos.

14. `14-ux-decision-workbook.md`
    - UX-D-001..UX-D-013 y estado de HUX-001..HUX-005.

15. `15-g3-readiness-checklist.md`
   - `PASS`, `PASS_WITH_DEFERRED`, `BLOCKED`.

16. `docs/approvals/G3-ux-approval-DRAFT.md`
    - borrador sin aprobación automática.

## Prototipo

El prototipo se representa mediante wireframes/documentación visual de baja o media fidelidad. No debe confundirse con código productivo.

Se priorizan primero las pantallas P0 y los estados que cambian decisiones o acceso. La identidad visual final, branding avanzado, animaciones y sistema de diseño exhaustivo no bloquean G3.

## Datos

Sólo datos sintéticos.

No usar:

- postulantes reales;
- RUT reales;
- documentos reales;
- emails/teléfonos reales de familias;
- antecedentes de salud/PIE/NEE reales.

Los nombres de responsables institucionales ya aprobados pueden mantenerse únicamente en documentación de roles cuando sea necesario; los prototipos deben preferir identidades sintéticas.

## Fuera de alcance

E3 no autoriza:

- código o scaffolding;
- Next.js/NestJS;
- componentes React;
- CSS/Tailwind ejecutable;
- Prisma/SQL;
- Docker;
- infraestructura;
- cuentas/proveedores;
- integración EduPay;
- datos reales.

## Criterio de salida hacia G3

E3 puede solicitar G3 cuando:

- todos los recorridos P0 críticos tengan pantalla/estado identificable;
- familia pueda completar el recorrido principal sin depender de información interna;
- personal pueda distinguir claramente recomendación de decisión;
- lista de espera, disponibilidad, cupos y oferta no induzcan a error;
- sesión expirada, errores y falta de permisos estén diseñados;
- la matriz de visibilidad coincida con E1/G1;
- WCAG 2.2 AA esté incorporado como criterio verificable;
- no se exponga información de otro tenant o caso;
- exista checklist G3 sin bloqueantes UX severos;
- HUX-001..HUX-005 estén resueltas;
- G3 permanezca `NO APROBADA` hasta decisión humana explícita.

## Estado de consolidación

- 42 pantallas conceptuales: 18 Familia, 18 Personal y 6 Administración mínima.
- 18 wireflows Familia, wireflows por rol para Personal y board consolidado.
- 20 tareas sintéticas listas para validación humana.
- 13 decisiones UX recomendadas.
- HUX-001..HUX-005 resueltas; HUX-005 incorpora UX-D-010 como confirmación apropiada para acciones críticas.
- Copy de disponibilidad ajustado para no confundir estado del proceso con oferta emitida.
- Checklist G3 `PASS_WITH_DEFERRED`, sin bloqueante UX material identificado.
- E3 queda `READY FOR G3 REVIEW`; G3 continúa `NO APROBADA`.

## Estrategia para reducir tiempo hasta código

E3 no desarrollará un sistema de diseño completo ni prototipos de todas las capacidades P1/P2. La prioridad es cerrar navegación, flujos, pantallas P0, estados de error/seguridad y contenido visible. Los refinamientos visuales no críticos pueden continuar durante E4/E5 sin cambiar comportamiento aprobado.

## Siguiente compuerta

G3 — Validación UX. Una eventual aprobación G3 autorizará E4 — Fundación técnica conforme al roadmap; hasta entonces código y scaffolding continúan bloqueados.