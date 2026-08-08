# G3 — Aprobación UX — DRAFT

## Estado

`DRAFT / NOT APPROVED`

Este documento es un paquete de revisión humana. No registra aprobación, no autoriza implementación y no cambia el estado de G3.

## Control

| Campo | Valor |
| --- | --- |
| Compuerta | G3 — Validación UX |
| Etapa | E3 — Prototipo UX |
| Rama | `docs/e3-ux-prototype` |
| Head de inicio de E3 | `55d40766a72feab8bbf0799c46c0cb28cd5f77ff` |
| Commit UX consolidado revisado para HUX | `046385b7cb552685a856ae8f5a8973def97c09f3` |
| Base main | `c573dc39460620b82e8152717268bc28b4af3048` |
| Estado E3 | `IN PROGRESS / READY FOR G3 REVIEW` |
| Estado G3 | `NO APROBADA` |
| Estado E4 | `NO AUTORIZADA` |
| Implementación/scaffolding | `NO AUTORIZADOS` |
| Datos reales | `NO AUTORIZADOS` |
| HUX-001..HUX-005 | Resueltas; pendiente aprobación formal G3 |
| Aprobador G3 | Pendiente de decisión humana |
| Fecha G3 | Pendiente |

Los commits posteriores a `046385b7cb552685a856ae8f5a8973def97c09f3` que registran HUX, incorporan UX-D-010 en HUX-005, corrigen el copy de disponibilidad y actualizan estados son ajustes autorizados de cierre de E3; no constituyen aprobación G3.

## Evidencia

- [01-information-architecture.md](../e3/01-information-architecture.md): IA, menús, sitemap y cobertura P0.
- [02-screen-inventory.md](../e3/02-screen-inventory.md): 42 pantallas conceptuales con AC/E2E y permisos.
- [03-family-critical-flows.md](../e3/03-family-critical-flows.md): 18 wireflows familiares.
- [04-staff-critical-flows.md](../e3/04-staff-critical-flows.md): Secretaría, Admisión y Dirección.
- [05-case-workspace.md](../e3/05-case-workspace.md): workspace con stepper y tabs/secciones.
- [06-screen-states-and-feedback.md](../e3/06-screen-states-and-feedback.md): feedback técnico/negocio.
- [07-content-visibility-matrix.md](../e3/07-content-visibility-matrix.md): 8 audiencias y categorías restringidas.
- [08-accessibility-responsive.md](../e3/08-accessibility-responsive.md): mobile/desktop y WCAG 2.2 AA.
- [09-form-patterns.md](../e3/09-form-patterns.md): formularios, uploads, draft y builder mínimo.
- [10-capacity-waitlist-offer-ux.md](../e3/10-capacity-waitlist-offer-ux.md): cupos, waitlist, ofertas y vencimiento.
- [11-session-security-ux.md](../e3/11-session-security-ux.md): sesión expirada, recuperación, prohibido y elevación.
- [12-prototype-board.md](../e3/12-prototype-board.md): board navegable de baja fidelidad y copy de disponibilidad separado de oferta emitida.
- [13-prototype-validation-scenarios.md](../e3/13-prototype-validation-scenarios.md): 20 tareas sintéticas.
- [14-ux-decision-workbook.md](../e3/14-ux-decision-workbook.md): 13 UX-D y HUX-001..HUX-005 resueltas.
- [15-g3-readiness-checklist.md](../e3/15-g3-readiness-checklist.md): `PASS_WITH_DEFERRED`, sin bloqueante UX material identificado y `READY FOR G3 REVIEW`.

## Cobertura P0

Las 22 capacidades BL-001..BL-022 están trazadas en la IA, inventario, wireflows, workspace, board o checklist. En particular:

- identidad, aislamiento y roles: BL-001, BL-002, BL-019, BL-020;
- oferta, formulario y postulación: BL-003..BL-005, BL-021;
- documentos y asistencia: BL-006..BL-007;
- actividades e intentos: BL-008..BL-009;
- recomendación y decisión: BL-010..BL-011;
- cupos, waitlist, oferta y aceptación: BL-012..BL-014;
- comunicación y portal: BL-015..BL-016;
- dashboard/reportes y borde funcional: BL-017..BL-018, BL-022.

## UX decisions y decisiones humanas

UX-D-001..UX-D-013 permanecen `RECOMMENDED_FOR_G3` hasta la aprobación formal de la compuerta. Las decisiones humanas previas a G3 quedaron resueltas:

1. **HUX-001 `RESOLVED`:** IA diferenciada por audiencia.
2. **HUX-002 `RESOLVED`:** formulario stepper y workspace jerárquico.
3. **HUX-003 `RESOLVED`:** waitlist y oferta sin posición/cupos exactos para Familia.
4. **HUX-004 `RESOLVED`:** Familia mobile first, Personal desktop first/tablet y WCAG 2.2 AA.
5. **HUX-005 `RESOLVED_WITH_CLARIFICATION`:** seguridad visible, feedback, sesión expirada, elevación explícita y UX-D-010 como confirmación apropiada para acciones críticas.

HUX-005 cubre como mínimo confirmación para envío final, retiro/desistimiento, aceptación o rechazo de oferta, promoción/ofrecimiento desde lista de espera, disposición institucional y SELF-ELEVATION. Esto no implica confirmar cada interacción ordinaria.

## Diferidos aceptables

- branding, logo, paleta, ilustraciones, microanimaciones y sistema de diseño exhaustivo;
- páginas P1/P2 y reportes ampliados;
- copy final de marketing y textos legales;
- detalles de MFA/step-up, proveedores, infraestructura, retención y operación;
- implementación, PoC tenant/RLS/Prisma y pruebas técnicas posteriores;
- integración técnica EduPay y Q-301..Q-309.

## Riesgos residuales

| Riesgo | Control UX | Seguimiento |
| --- | --- | --- |
| Familia interpreta postular como vacante | Categorías, advertencia y confirmación | Validar tarea 1 |
| Familia confunde disponibilidad con oferta emitida | Copy explícito `Disponibilidad del proceso` y pantalla de oferta separada | Revisión G3 |
| Familia interpreta waitlist como posición | Mensaje general sin número/prioridad | Validar tarea 5 |
| Oferta expira sin comprensión | Fecha/hora absoluta, contador y consecuencias | Validar tarea 6/14 |
| Recomendación se confunde con decisión | Menús, stepper, permisos y copy separados | Validar tareas 12/15 |
| Acción crítica se ejecuta accidentalmente | Confirmación apropiada UX-D-010/HUX-005 | Validar recorridos aplicables |
| Secretaría escala permisos | Flujo asistido sin acciones de decisión | Validar tareas 7/19 |
| Fallo técnico altera negocio | Estados técnicos separados | Validar tarea 14 y E2E-017 |
| Elevación se normaliza | Indicador persistente, alcance, confirmación y salida | Validar tarea 20 |
| Sensibilidad se filtra por sección | Matriz por rol/purpose/category | Validar tareas 18/20 |

## Lo que una eventual aprobación G3 autorizaría

- Cerrar E3 respecto de la evidencia UX aprobada.
- Iniciar E4 — Fundación técnica conforme al roadmap y G2.
- Traducir los patrones aprobados a especificaciones técnicas posteriores sin cambiar silenciosamente permisos, estados, separación de funciones o límites de contenido.
- Preparar criterios de aceptación, accesibilidad y seguridad para etapas autorizadas.

## Lo que G3 no autorizaría

- Construcción del MVP o autorización G4.
- Datos personales/documentos reales o piloto productivo.
- Integración técnica con EduPay o resolver Q-301..Q-309.
- Exponer a Familia resultados internos, posición waitlist, cupos exactos o identidad de revisores.
- Permitir que Secretaría recomiende/decida, que recomendador decida o que Superadmin lea sin elevación.
- Reabrir E1 o modificar la arquitectura aprobada en G2.

Nota de roadmap: la aprobación de G3 habilita E4 — Fundación técnica; E4 es la etapa donde se podrá autorizar trabajo técnico conforme a su alcance y donde G4 seguirá siendo la compuerta posterior para autorizar construcción del MVP.

## Texto sugerido de aprobación

> Apruebo G3 sobre la evidencia UX consolidada de E3 revisada en el commit `[COMMIT REVISADO]` y ratifico las decisiones HUX-001 a HUX-005 ya registradas, incluyendo UX-D-010 dentro de HUX-005. Confirmo que la navegación, pantallas P0, recorridos críticos, estados, permisos/visibilidad, responsive, WCAG 2.2 AA, oferta, lista de espera, recomendación/decisión y seguridad UX son suficientes para avanzar a E4 conforme al roadmap. Esta aprobación no autoriza G4, construcción del MVP, datos reales, infraestructura productiva, integración técnica con EduPay ni cambios en G1/G2.

## Firma humana pendiente

| Campo | Completar por autoridad humana |
| --- | --- |
| Decisión | `APPROVED`, `APPROVED_WITH_CONDITIONS` o `RETURNED` |
| Revisor/a | Pendiente |
| Fecha/hora | Pendiente |
| Commit revisado | Pendiente |
| Condiciones/acciones | Pendiente |