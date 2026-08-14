# E5-I — Evidencia de borde funcional de handoff

## Control

| Campo | Valor |
| --- | --- |
| Base SHA | `a1dc99e2b3c8c999f29e09b9a818183eb359c62f` |
| Final SHA | `c8fa6cadec7155393afc77aa91a78d5aae0f3239` |
| Rama | `feat/e5-mvp` |
| PR | `#8 — OPEN / DRAFT / NO MERGE` |
| Schema change | `YES` |
| Migration | `packages/database/prisma/migrations/20260814090000_e5i_functional_handoff/migration.sql` |
| CI run | `31773421598` |
| CI job | `validate / 94683807800 / success` |
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

- Suite funcional PostgreSQL: 24/24 (`HND-01..HND-24`).
- Suite HTTP real Nest/PostgreSQL: 4/4 (`HND-18..HND-21`).
- Suite RLS nueva: 6/6 (`RLS-01..RLS-06`).
- Suite RLS conjunta: 46/46; las 40 históricas se conservan y E5-I agrega 6.
- Migration smoke: `FRESH_0_TO_15=PASS`, `INCREMENTAL_14_TO_15=PASS`,
  `E5I_HANDOFF_SEALS=PASS`.
- Control negativo de runtime/config: `E5I_NO_EXTERNAL_INTEGRATION=PASS`.

La ejecución local de `pnpm test` fue intentada con ventana ampliada y agotó
el timeout del runner sin conclusión ni aserción fallida observable; por ello no
se declara PASS local de la suite general. `pnpm test:rls` sí terminó 46/46.

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
