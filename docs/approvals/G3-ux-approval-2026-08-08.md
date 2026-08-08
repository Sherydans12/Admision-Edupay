# G3 — Registro formal de aprobación UX

## Control

| Campo | Valor |
| --- | --- |
| Compuerta | G3 — Validación UX |
| Estado | `APPROVED / CLOSED` |
| Fecha de aprobación | `2026-08-08T15:30:00-04:00` |
| Commit UX revisado y aprobado | `a659191f5b5190ddf6913b6417cdfccb7baf1a90` |
| PR | `#6 — E3: Prototype UX and G3 preparation` |
| Aprobador | Nicolás Sena |
| E3 | `CLOSED / UX APPROVED` |
| E4 | `AUTHORIZED TO START` después de la fusión del PR #6 |
| G4 | `NO APROBADA` |
| Datos reales | No autorizados |
| Infraestructura productiva | No autorizada |
| Integración técnica EduPay | No autorizada |

## Aprobación humana explícita

Se registra la siguiente aprobación:

> Apruebo G3 sobre el commit `a659191f5b5190ddf6913b6417cdfccb7baf1a90` del PR #6. Ratifico HUX-001 a HUX-005, incluyendo UX-D-010 dentro de HUX-005, y apruebo la evidencia UX de E3 con sus diferidos documentados. Autorizo cerrar E3, registrar y cerrar G3, fusionar el PR #6 e iniciar E4 — Fundación técnica. Esta aprobación autoriza el trabajo técnico propio de E4 con datos sintéticos —incluyendo scaffolding, dependencias, monorepo, Next.js, NestJS, Prisma/PostgreSQL de desarrollo, pruebas e infraestructura local/de desarrollo necesaria— pero no autoriza G4, construcción funcional del MVP, datos reales, infraestructura productiva ni integración técnica con EduPay.

## Evidencia UX aprobada

G3 aprueba la evidencia E3 consolidada en `docs/e3/01..15`, incluyendo:

- arquitectura de información diferenciada para Familia, Personal y Administración mínima;
- inventario de 42 pantallas conceptuales: 18 Familia, 18 Personal y 6 Administración;
- cobertura P0 `BL-001..BL-022` y trazabilidad con AC/E2E;
- wireflows familiares e institucionales;
- workspace de expediente con header, stepper y tabs/secciones;
- separación entre estados técnicos y estados de negocio;
- matriz de contenido y visibilidad por rol, tenant, sensibilidad y propósito;
- responsive Familia mobile-first y Personal desktop-first/tablet funcional;
- WCAG 2.2 AA como criterio verificable;
- patrones de formularios, documentos, correcciones y builder mínimo;
- UX de cupos, lista de espera, oferta, vencimiento y aceptación;
- sesión expirada, recuperación, prohibido y SELF-ELEVATION;
- board consolidado de baja fidelidad;
- 20 tareas sintéticas de validación;
- UX-D-001..UX-D-013 como baseline UX aprobada;
- checklist G3 `PASS_WITH_DEFERRED`, sin bloqueantes UX materiales.

## Decisiones HUX ratificadas

- **HUX-001:** IA diferenciada para Familia, Personal y Administración mínima.
- **HUX-002:** formulario stepper y workspace con header + stepper + tabs/secciones.
- **HUX-003:** waitlist y oferta sin posición ni cupos exactos para Familia.
- **HUX-004:** Familia mobile-first, Personal desktop-first/tablet funcional y WCAG 2.2 AA.
- **HUX-005:** feedback seguro, sesión expirada, elevación visible y temporal, incorporando UX-D-010 para confirmaciones críticas.

UX-D-010 exige confirmación apropiada como mínimo para:

- envío final de postulación;
- retiro/desistimiento;
- aceptación o rechazo de oferta;
- promoción/ofrecimiento manual desde lista de espera;
- disposición institucional;
- inicio de SELF-ELEVATION.

La confirmación debe explicar la acción y sus consecuencias relevantes sin convertir interacciones ordinarias en diálogos innecesarios.

## Límites de contenido y seguridad UX aprobados

- Familia no ve resultados internos, puntajes, recomendaciones, comentarios internos, identidad de revisores, posición de lista de espera ni cupos exactos.
- La disponibilidad categórica del proceso no se presenta como una oferta de admisión emitida.
- Secretaría no recomienda, decide, modifica cupos ni promueve lista de espera.
- Admisión recomienda y Dirección decide; el recomendador no decide el mismo caso.
- Superadministrador Global sin elevación no ve contenido tenant.
- SELF-ELEVATION debe ser explícita, temporal, visible, acotada y auditable.
- La aceptación de una oferta no equivale a matrícula ni pago.
- Admisión y EduPay permanecen desacoplados.

## Diferidos aceptados

No bloquean G3 y permanecen para etapas posteriores:

- branding, logo, paleta, ilustraciones y microanimaciones;
- sistema de diseño exhaustivo;
- páginas P1/P2 y reportes ampliados;
- copy final de marketing y textos legales;
- validación visual definitiva de contraste sobre interfaz ejecutable;
- política exacta de MFA/step-up;
- C-013, retención y validaciones legales antes de datos reales;
- proveedores, regiones, procurement e infraestructura productiva;
- integración técnica EduPay y Q-301..Q-309.

## Efecto de la aprobación

- E3 pasa a `CLOSED / UX APPROVED`.
- G3 pasa a `APPROVED / CLOSED`.
- E4 — Fundación técnica queda autorizada para iniciar después de fusionar el PR #6.
- G4 permanece `NO APROBADA`.

Dentro de E4 quedan autorizados, exclusivamente con datos sintéticos y conforme a G1/G2/G3:

- scaffolding técnico;
- instalación y fijación de dependencias;
- creación del monorepo y workspaces;
- Next.js, NestJS y estructura worker;
- Prisma y PostgreSQL de desarrollo;
- migraciones y esquemas iniciales de fundación técnica;
- pruebas automatizadas;
- PoC tenant/RLS/Prisma obligatoria;
- Docker/Compose u otra infraestructura local/de desarrollo necesaria;
- CI y herramientas de calidad/seguridad de desarrollo;
- observabilidad y manejo de errores base de desarrollo.

## Límites explícitos

G3 y la autorización de E4 no autorizan:

- G4 ni construcción funcional completa del MVP;
- datos personales o documentos reales;
- piloto productivo;
- infraestructura productiva;
- secretos productivos;
- integración técnica con EduPay;
- resolver Q-301..Q-309;
- relajar las condiciones de ADR-0003 o saltar el PoC tenant/RLS/Prisma.

## Condición heredada de G2

Antes de G4 debe existir PoC sintética tenant/RLS/Prisma que demuestre las ocho condiciones aprobadas en G2. Si falla, RLS no se deshabilita silenciosamente: corresponde revisión arquitectónica y aprobación de una defensa equivalente antes de G4.

## Inmutabilidad de la evidencia aprobada

La aprobación G3 aplica al contenido exacto del commit `a659191f5b5190ddf6913b6417cdfccb7baf1a90`. Los commits administrativos posteriores del PR #6 pueden registrar esta aprobación, actualizar estados y referencias sin modificar sustantivamente la UX aprobada. Cualquier cambio UX sustantivo posterior debe quedar trazado y revisado según su impacto.