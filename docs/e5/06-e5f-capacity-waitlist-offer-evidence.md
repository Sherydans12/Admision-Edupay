# E5-F — Evidencia de cupos, waitlist y oferta

## Estado de la ronda

**Estado:** `COMPLETE_WITH_COMMUNICATION_E5G`. Migration, suite funcional,
RLS y smoke fresh/incremental pasaron en GitHub Actions run `31472103030` sobre
el HEAD funcional `7c306f5`. El PR #8 se mantiene `OPEN / DRAFT / NO MERGE`.
No se solicita G5.

**Alcance:** `BL-012`, `BL-013` y `BL-014`: capacidad, reserva, lista de
espera, promoción humana, oferta versionada, aceptación/rechazo, expiración,
reapertura y retiro familiar. Sólo se usaron fixtures sintéticos.

### Clasificación de información

- **Hechos confirmados:** Admisión y EduPay son dominios desacoplados; la familia no debe recibir cantidades exactas, posición/prioridad de waitlist ni deliberación interna; una aceptación no constituye matrícula ni pago.
- **Decisiones de implementación:** reservas `ACTIVE` y `COMMITTED` consumen capacidad; `RELEASED` preserva historia sin consumir; el orden interno de waitlist es `enteredAt` + `id`; cada reapertura crea una versión nueva; la expiración se agenda por outbox.
- **Supuestos de trabajo:** vigencia por defecto de tres días hábiles, configurable entre 1 y 30 por capacidad; el calendario de desarrollo excluye sábado y domingo; la posición es una proyección interna y no una promesa.
- **Preguntas abiertas:** `Q-106` sigue `DEFERRED`; `C-013` sigue `LEGAL_VALIDATION_PENDING`; `Q-301..Q-309` siguen `FUTURE_INTEGRATION_PENDING`. No se inventó score, prioridad institucional, feriados ni política de comunicación.

## Fuentes vinculantes

Se aplicaron las fuentes canónicas declaradas en el plan E5, en particular:

- especificación funcional, criterios `AC-025..AC-027`, escenarios `E2E-010` y `E2E-011`, y backlog `BL-012..BL-014`;
- modelo lógico, arquitectura de multitenancy/autorización y reglas de concurrencia de E2;
- inventario, flujos familiares/staff, matriz de visibilidad, accesibilidad y responsive de E3;
- evidencia E5-E como upstream autorizado de `DirectionDisposition`.

## Migration 12 y sellos de base de datos

`20260811180000_e5f_capacity_waitlist_offers` agrega ocho tablas tenant-owned:

1. `admission_capacities`;
2. `admission_capacity_adjustments` append-only;
3. `seat_reservations`;
4. `waitlist_entries`;
5. `admission_offers`;
6. `admission_offer_versions` con historia enlazada;
7. `offer_acceptances` append-only;
8. `application_withdrawals` append-only.

Enums:

- `SeatReservationState`: `ACTIVE`, `COMMITTED`, `RELEASED`;
- `WaitlistEntryState`: `ACTIVE`, `PROMOTED`, `WITHDRAWN`;
- `AdmissionOfferOrigin`: `NORMAL`, `WAITLIST`;
- `AdmissionOfferLifecycle`: `ACTIVE`, `ACCEPTED`, `DECLINED`, `EXPIRED`;
- `AdmissionOfferTerminalReason`: aceptación/rechazo familiar, deadline y retiro;
- `ApplicationStatus` incorpora `WITHDRAWN`.

Las FKs compuestas enlazan tenant, aplicación y offering del mismo recurso;
las versiones anteriores pertenecen al mismo root. Checks sellan estados y
timestamps coherentes. Índices parciales impiden más de una reserva consumidora
por postulación, más de una entrada activa de waitlist y más de una versión de
oferta activa. Los guards sólo permiten transiciones terminales válidas y
rechazan update/delete de evidencia append-only.

Las ocho tablas pertenecen a `admission_migrator`, tienen RLS + FORCE RLS y una
policy para `admission_app` basada en `admission.tenant_id`. Los grants permiten
sólo `SELECT/INSERT` y, en las cinco raíces mutables, `UPDATE`; ninguna tabla
otorga `DELETE` a la aplicación.

El sello previo de `Application` se amplió sin perder evidencia: `DRAFT` no
tiene submission; todo estado posterior conserva `submittedAt` y la versión de
formulario fijada. `WITHDRAWN` no reescribe el snapshot.

## Flujos transaccionales

### Capacidad y aprobación

Staff autorizado crea una capacidad única por offering. Todo ajuste exige
`expectedVersion`, razón auditable y no puede reducir el valor bajo las reservas
`ACTIVE` + `COMMITTED`.

Al registrar `APROBADO`, una sola transacción bloquea aplicación/capacidad, verifica cupo,
crea `SeatReservation ACTIVE`, `AdmissionOffer`, versión 1 `ACTIVE`, mensaje de
expiración idempotente y auditoría. Si no queda cupo, toda la decisión revierte;
no existe decisión favorable huérfana.

### Lista de espera y promoción

`LISTA_DE_ESPERA` crea una entrada `ACTIVE` enlazada a la versión exacta de
Dirección. Staff ve orden y posición interna derivados; familia sólo recibe el
estado. La promoción exige que la entrada siga activa, sea la primera, coincida
su versión y la versión de capacidad, y exista cupo. Reserva, oferta de origen
`WAITLIST` y transición `PROMOTED` se confirman o revierten juntas.

### Oferta familiar

Aceptar exige ownership familiar y `expectedOfferVersionId`; cambia la versión
a `ACCEPTED`, crea una única aceptación y pasa la reserva a `COMMITTED`.
Reintentar la misma aceptación devuelve el resultado existente. Rechazar cambia
a `DECLINED` y libera una vez. Las carreras aceptar/rechazar y aceptar/retirar
terminan con un solo resultado durable.

El reaper procesa sólo `admission.offer.expire`. Antes del instante exacto hace
no-op; al vencer cambia a `EXPIRED` y libera una vez. Un job de una versión vieja
o terminal es no-op. Reabrir exige razón, versión esperada, oferta expirada y
capacidad disponible; crea una nueva reserva y `AdmissionOfferVersion` enlazada,
sin reactivar ni sobrescribir la versión anterior.

### Retiro

El retiro exige confirmación explícita y ownership. Es idempotente, cambia la
postulación a `WITHDRAWN`, retira waitlist activa o termina oferta activa y
libera su reserva una vez. Una oferta ya aceptada no se retira silenciosamente.
Se preservan submission, snapshots e historia; no se crea comunicación, pago,
matrícula ni handoff.

## Autorización, privacidad y UI

Permisos agregados/reutilizados: `capacity.read`, `capacity.manage`,
`waitlist.read`, `waitlist.promote`, `offer.read`, `offer.reopen`,
`application.decide`, `application.read` y `restricted.read`. Toda superficie
staff exige sesión opaca, membership activa, capacidad server-side, propósito y
scope. Las mutaciones HTTP requieren CSRF y Origin válidos; schemas Zod
`.strict()` impiden inyectar tenant, actor o estados.

La familia accede por ownership y recibe anti-enumeración `404` para recursos
ajenos. Su proyección no contiene `configuredCapacity`, `availableCount`,
`consumedCount`, `internalPosition`, prioridad, recomendación, fundamento ni
manifest interno.

La UI agrega “Resultado de admisión” para familia y “Cupos, espera y ofertas”
para staff. Incluye confirmaciones, labels, estados anunciados, focus visible,
responsive y reduced motion. La pasada única del detector de diseño no produjo
hallazgos. No hay botones de email, matrícula, pago ni handoff.

## Pruebas dirigidas

Dominio PostgreSQL:

- `CAP-01..06`: unicidad, defaults, ajuste versionado, stale y mínimo consumido;
- `RES-01..04`, `CON-01`: veinte aprobaciones compiten por el último cupo y sólo una reserva/oferta consume capacidad;
- `WAIT-01..09`: orden interno, promoción del primero, stale/idempotencia y proyección familiar sin rango;
- `OFF-01..14`, `OFF-CON-01..02`: emisión, días hábiles, outbox, aceptación/rechazo, expiración, reapertura y jobs stale;
- `WDR-01..07`: confirmación, ownership, idempotencia, waitlist/oferta y carrera aceptar/retirar;
- `E5EE-CON-02`: veinte reintentos de la misma aprobación convergen a una decisión, reserva y oferta.

Frontera HTTP real `HTTP-01..19`: sesión, membership, permisos, tenant,
ownership, CSRF, Origin, bodies estrictos, capacidad, waitlist, promoción,
proyección segura, stale, aceptación y retiro.

Worker `WRK-01..09`: tenant correcto, allowlist, exactly-once lógico, payload
inválido, backoff, máximo de intentos, `availableAt` y stop limpio.

RLS/DB `E5F-RLS-01..11` y `E5F-DB-01..03`: las ocho tablas, ausencia de
contexto, escritura cross-tenant, pooling y guards append-only/terminales.

## Validación reproducible

| Control | Resultado |
| --- | --- |
| `pnpm db:generate` / `pnpm db:migrate` | PASS en CI |
| `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm build` | PASS |
| `pnpm test` | PASS — 24 archivos, 310/310 |
| `pnpm test:rls` | PASS — 2 archivos, 30/30 |
| `pnpm e5f:migration:smoke` | PASS — `FRESH_0_TO_12`, `INCREMENTAL_11_TO_12`, `E5F_DB_SEALS` |
| `pnpm security:secrets` | PASS — 250 archivos versionados inspeccionados |
| `pnpm security:deps` | PASS — sin vulnerabilidades conocidas |
| detector UI / `git diff --check` | PASS |
| GitHub Actions | PASS — run `31472103030` |

El PostgreSQL local no pudo arrancar porque Docker Desktop/WSL no respondió;
CI ejecutó la validación completa en servicios y compose aislados. El resultado
verde de CI es la evidencia vinculante de base real para esta ronda.

## Trazabilidad y compuerta

- `BL-012`, `BL-013`, `BL-014` = `COVERED` en la porción E5-F.
- `AC-025` = `DECISION_AND_OFFER_COVERED / COMMUNICATION_E5G`.
- `AC-026` = `WAITLIST_AND_OFFER_COVERED / COMMUNICATION_E5G`.
- `AC-027` = `DECISION_COVERED / COMMUNICATION_E5G`.
- `E2E-010` = `CAPACITY_AND_OFFER_COVERED / COMMUNICATION_E5G`.
- `E2E-011` = `WAITLIST_AND_PROMOTION_COVERED / COMMUNICATION_E5G`.
- `E5-F` = `COMPLETE_WITH_COMMUNICATION_E5G`.
- `E5-G` = `NOT_STARTED`; `G5` = `NO APROBADA`.
- `Q-106` = `DEFERRED`; `C-013` = `LEGAL_VALIDATION_PENDING`;
  `Q-301..Q-309` = `FUTURE_INTEGRATION_PENDING`.

Commits lógicos de la ronda: `a54e2ba`, `b974c09`, `6516eeb` y el commit de
hardening/evidencia que sucede al HEAD funcional validado `7c306f5`.

La siguiente acción humana es revisar E5-F y decidir explícitamente si autoriza
iniciar E5-G. Esta entrega no avanza esa compuerta y no solicita G5.
