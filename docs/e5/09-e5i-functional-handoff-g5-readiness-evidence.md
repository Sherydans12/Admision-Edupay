# E5-I — Evidencia de borde funcional de handoff

## Control

| Campo | Valor |
| --- | --- |
| Base SHA | `d1cbbf5008548ac46080ae718d70f36f3e5a963d` |
| Final technical SHA | `46afcc3bd073d7d87f4a6027b882c2fcc57eaf3e` |
| Rama | `feat/e5-mvp` |
| PR | `#8 — OPEN / DRAFT / NO MERGE` |
| Schema change in this hardening | `NO` — Migration 15 permanece intacta; no existe Migration 16 |
| Migration | `packages/database/prisma/migrations/20260814090000_e5i_functional_handoff/migration.sql` |
| CI run for final technical SHA | `31831860375` |
| CI job | `validate / 94869182718 / success` |
| Datos | Sintéticos/non-production únicamente |

Este documento distingue hechos verificados, decisiones aprobadas, supuestos de
trabajo y preguntas abiertas. No es aprobación de G5.

## BL-022 — alcance implementado

Se implementó `IntegrationHandoff` como hecho durable local de Admisión. El
registro conserva únicamente `tenantId`, `applicationId`,
`offerAcceptanceId`, actor efectivo, `requestedAt` y `createdAt`. Tiene RLS,
FORCE RLS, grants append-only, FKs tenant-safe y unicidad durable por
`tenantId + offerAcceptanceId`.

La frontera HTTP mínima es:

`POST /staff/tenants/:tenantId/applications/:applicationId/handoff`

El body es estricto y vacío. El servidor resuelve application, oferta vigente,
versión vigente y aceptación; verifica submission, aceptación expresa vigente,
capability, tenant, propósito y scope. La operación es transaccional, audita la
creación con metadata minimizada y devuelve `REQUESTED` local de forma
idempotente.

La UI reutiliza las superficies de oferta existentes. Familia ve que la oferta
fue aceptada y que la aceptación no equivale a matrícula ni pago. Personal puede
registrar el handoff sólo después de aceptación y recibe el mismo aviso.

No se implementó matrícula, obligación, pago, tabla compartida, escritura en
EduPay, payload, endpoint, webhook, adapter, autenticación sistema-sistema,
retry, reconciliation ni lifecycle técnico externo.

## Application-scoped authorization hardening

El defecto corregido era una inconsistencia de scoping: `FunctionalHandoff`
validaba `offering`, `process` y `campus`, pero omitía
`application:<applicationId>`. Por ello una capability válida con scope exacto
de aplicación producía un falso `403`.

La corrección agrega `application:${application.id}` a la misma lista server-side
que ya reconoce los scopes de offering, process y campus. No cambia capability,
tenant semantics, sensitivity, aceptación, idempotencia, auditoría ni la
precondición de negocio.

| Regresión | Resultado |
| --- | --- |
| HND-25 — actor tenant normal con application exacta | `PASS` — `REQUESTED`, una fila durable |
| HND-26 — application de otro caso | `PASS` — `ForbiddenError`, cero filas |
| HND-27 — SupportElevation con application exacta | `PASS` — `REQUESTED`, una fila durable |
| HND-28 — SupportElevation con application de otro caso | `PASS` — `ForbiddenError`, cero filas |
| HND-29 — offering, process, campus y `*` | `PASS` — semántica existente preservada |
| E5I-HTTP-05 — POST real con application exacta | `PASS` — `201 REQUESTED` |
| E5I-HTTP-06 — POST real con application de otro caso | `PASS` — `403`, cero handoff |

La autorización sigue siendo exacta por aplicación; no amplía acceso entre
aplicaciones, tenants ni familias. Capability omission, family context,
Superadmin Global sin elevation y cross-tenant permanecen denegados. No se
modificó ninguna migración ni se creó una dependencia ejecutable con EduPay.

## Criterios de aceptación

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| AC-055 | `COVERED` | HND-01, HND-05..08, HND-19 |
| AC-056 | `COVERED` | HND-02..04, HND-09, HND-15, HND-18 |
| AC-057 | `COVERED_FUNCTIONAL_INVARIANT / TECHNICAL_CONTRACT_TRANSITIONS_DEFERRED_Q301_Q309` | HND-17, HND-23, migration seals y código sin estados externos |

AC-057 queda cubierto como invariante: `IntegrationHandoff` no es
`Enrollment`; no existe entidad de matrícula, obligación o pago en esta
implementación y no se afirma recepción técnica de EduPay.

## E2E

`E2E-001 = COVERED hasta functional boundary`: los slices E5-A..H aportan las
etapas previas y HND-22 verifica que la aceptación producida por el servicio de
ofertas llega al hecho local. El resultado final es aceptación más handoff
local; matrícula no presumida. No se agrega proveedor externo.

Regresiones directas del borde: E2E-012 queda representado por HND-09;
E2E-013 por HND-08; E2E-014 por HND-07; E2E-015 por HND-05.

## Seguridad, datos y auditoría

- La capability explícita es `application.handoff.request`; no se concede por
  `application.read`.
- Tenant, actor efectivo, aceptación, estado y scope no son body-controlled.
- La autorización usa capabilities, propósito, sensibilidad, tenant y scopes
  server-side; Superadmin Global requiere elevation válida.
- RLS-01..06 prueban lectura same-tenant, denegación cross-tenant, ausencia de
  contexto, reutilización pooled, separación de roles y grants append-only.
- La mutación crea `AuditEvent` en la misma transacción, separado de
  `SecurityEvent`, con referencias internas y sin respuestas, documentos,
  archivos, salud, NEE/PIE, evaluaciones, deliberaciones o finanzas.
- HND-16 prueba minimización; HND-17 prueba que no se crean efectos de
  matrícula, obligación o pago.

## Concurrencia e idempotencia

HND-04 ejecuta 20 solicitudes concurrentes válidas para la misma aceptación y
verifica exactamente una fila durable, cero duplicados y respuestas
conflict-safe/idempotentes. La unicidad local está reforzada por la base de
datos; no se implementa idempotencia externa.

## Tests E5-I

- Suite funcional PostgreSQL: 29/29 (`HND-01..HND-29`).
- Suite HTTP real Nest/PostgreSQL: 6/6 (`E5I-HTTP-05..06`, `HND-18..HND-21`).
- Suite RLS nueva: 6/6 (`RLS-01..RLS-06`).
- Suite RLS conjunta: 46/46; las 40 históricas se conservan y E5-I agrega 6.
- Suite general CI: 423/423 tests, 32 archivos.
- Migration smoke: `FRESH_0_TO_15=PASS`, `INCREMENTAL_14_TO_15=PASS`,
  `E5I_HANDOFF_SEALS=PASS`.
- Control negativo de runtime/config: `E5I_NO_EXTERNAL_INTEGRATION=PASS`.

La ejecución local de `pnpm test` agotó el timeout del runner sin aserción
fallida observable; la misma suite terminó `423/423` en el CI final del SHA
técnico. `pnpm test:rls` terminó `46/46` localmente y en CI.

## Exclusiones de integración

El control automatizado inspecciona runtime/configuración y no prohíbe la
palabra EduPay en documentación. Verifica ausencia de URL/API key, HTTP client,
webhook, IDs externos de matrícula/obligación/pago y operaciones de creación.
No hay endpoint dirigido a EduPay ni secreto/configuración EduPay en E5-I.

## Preguntas y compuertas preservadas

| Elemento | Estado |
| --- | --- |
| Q-301..Q-309 | `FUTURE_INTEGRATION_PENDING` — no se resuelven en E5-I |
| Q-310 | `APPROVED_PRODUCT / FUNCTIONALLY_RESOLVED` — aceptación expresa precede al handoff |
| Q-106 | `DEFERRED` |
| C-013 | `LEGAL_VALIDATION_PENDING` |
| Datos reales | `NOT AUTHORIZED` |
| Piloto | `NOT AUTHORIZED` |
| Producción | `NOT AUTHORIZED` |
| G5 | `NO APROBADA / NOT REQUESTED` |

### Siguiente compuerta humana

Revisión independiente de E5-I y de esta evidencia. Esa revisión no autoriza
G5, datos reales, piloto, producción ni integración técnica EduPay.
