# G5-PC1-R3 — Evidencia de implementación del calendario laboral institucional, plazos y recordatorios

## Control de entrada y salida

| Campo | Estado verificado |
| --- | --- |
| Repositorio | `Sherydans12/Admision-Edupay` |
| Rama | `feat/e5-mvp` |
| PR | `#8`, `OPEN`, `DRAFT`, `NO MERGE` |
| Migration 17 | `20260816070000_g5pc1r12_authority_core` (IMMUTABLE) |
| Migration 18 | `20260820090000_g5pc1r4_sensitive_processing` (IMMUTABLE) |
| Migration 19 | `20260821190000_g5pc1r3_business_calendar` (APLICADA Y SELLADA) |
| Migration 20 | Ausente / No autorizada |
| Cobertura técnica | `PC1-TECH-007`, `PC1-TECH-008`, `PC1-TECH-009` |

---

## 1. Resumen ejecutivo

Se implementó de manera completa y desacoplada el soporte de calendario laboral institucional por tenant, cálculo de plazos hábiles con vencimiento al final del día local (23:59:59.999), programación y procesamiento de recordatorios de oferta un día hábil antes a las 10:00:00.000 local, API REST administrativa, aislamiento estricto mediante PostgreSQL Row-Level Security (RLS), interfaz de administración y suite exhaustiva de pruebas unitarias, de integración, RLS y HTTP.

---

## 2. Trazabilidad de requisitos y decisiones de diseño (R3-001..R3-013)

| Identificador | Requisito / Decisión congelada | Implementación técnica | Verificación |
| --- | --- | --- | --- |
| `R3-001` | Calendario laboral persistido y tenant-scoped | Tablas `tenant_business_calendars` y `business_calendar_excluded_dates` con clave foránea en cascada a `tenants(id)`. | `R3-CAL-07`, `R3-RLS-01..08` |
| `R3-002` | Zona horaria IANA canónica; rechazo de offsets fijos | Validación estricta con `Intl.DateTimeFormat` y denegación explícita de `UTC-3`, `GMT-4`, `+03:00`, `-04:00` y formatos ambiguos. | `R3-CAL-01`, `R3-CAL-02`, `R3-HTTP-03` |
| `R3-003` | Semana laboral Lunes–Viernes en MVP | Funciones `isBusinessDate`, `addBusinessDaysAfter`, `previousBusinessDate` tratan sábado (6) y domingo (0) como no hábiles. | `R3-CAL-03`, `R3-DL-03` |
| `R3-004` | Fechas excluidas configurables por tenant | Entidad `BusinessCalendarExcludedDate` con fecha `@db.Date`, razón explicativa, creador y unicidad `(tenant_id, calendar_date)`. | `R3-CAL-08`, `R3-HTTP-06..08` |
| `R3-005` | Sin API externa de feriados ni seeding automático | Cero dependencias de red externa, sin llamadas a APIs de terceros y sin inserciones automáticas de feriados en migraciones. | `G5PC1R3_SEALS` en smoke script |
| `R3-006` | El día de emisión nunca cuenta como día hábil 1 | `addBusinessDaysAfter` comienza el cómputo en el día civil inmediatamente posterior al día local de emisión. | `R3-CAL-05`, `R3-DL-01..04` |
| `R3-007` | Expiración al final del día hábil local (23:59:59.999) | `calculateBusinessDeadline` calcula el instante exacto correspondiente a las 23:59:59.999 de la zona IANA del tenant. | `R3-DL-01..04`, `R3-DST-01..02`, `R3-OFFER-01` |
| `R3-008` | Motor único para ofertas y subsanaciones documentales | `CapacityOfferService` y `DocumentService` invocan las funciones del motor de calendario para calcular plazos. | `R3-OFFER-01`, `documents.integration.spec.ts` |
| `R3-009` | Recordatorio de oferta 1 día hábil antes a las 10:00:00 local | `calculateOfferReminderAt` calcula las 10:00:00.000 del día hábil inmediatamente anterior a la expiración. | `R3-REM-01..04`, `R3-WORK-01..06` |
| `R3-010` | Inmutabilidad de plazos emitidos | Las ofertas y revisiones ya registradas conservan sus marcas temporales; cambios posteriores en el calendario no mutan plazos pasados. | `capacity-offer.integration.spec.ts` |
| `R3-011` | Programación vía outbox PostgreSQL existente | `reserveAndIssue` y `reopenOffer` encolan `admission.offer.reminder.prepare` en la tabla `outbox_messages` con `availableAt = reminderAt`. | `R3-OFFER-01`, `R3-WORK-01..06` |
| `R3-012` | Nueva versión de oferta recibe nuevos plazos y recordatorio | `reopenOffer` genera `OfferVersion N+1` con nuevo `issuedAt`, nuevo `expiresAt` y nuevo recordatorio programado. | `R3-OFFER-02` |
| `R3-013` | Migration 19 acotada exclusivamente a R3 | DDL contiene únicamente las dos tablas de calendario, sus índices, políticas RLS y grants para `admission_app`. | `g5pc1r3:migration:smoke` |

---

## 3. Componentes implementados

### 3.1 Base de datos y migración 19 (`packages/database`)
- **Migración 19 (`20260821190000_g5pc1r3_business_calendar/migration.sql`):**
  - Creación de tabla `tenant_business_calendars` con RLS habilitado y forzado (`FORCE ROW LEVEL SECURITY`).
  - Creación de tabla `business_calendar_excluded_dates` con RLS habilitado y forzado (`FORCE ROW LEVEL SECURITY`).
  - Políticas de aislamiento por tenant (`WHERE tenant_id = current_setting('admission.tenant_id', true)::uuid`).
  - Concesión de privilegios `SELECT, INSERT, UPDATE, DELETE` al rol `admission_app`.
- **Errores de dominio (`packages/database/src/domain-errors.ts`):**
  - `BusinessCalendarConflictError` (409)
  - `BusinessCalendarValidationError` (400)
  - `BusinessCalendarNotConfiguredError` (409 / fail-closed)
  - `InvalidBusinessTimezoneError` (400)
- **Motor de calendario laboral (`packages/database/src/business-calendar.ts`):**
  - `validateIanaTimeZone`, `assertValidIanaTimeZone`
  - `getLocalDate`, `isBusinessDate`, `addBusinessDaysAfter`, `previousBusinessDate`, `civilDateTimeToInstant`
  - `calculateBusinessDeadline` (23:59:59.999 local)
  - `calculateOfferReminderAt` (10:00:00.000 local 1 día hábil antes; retorna `null` si `reminderAt <= issuedAt`)
  - `formatLocalizedDeadline` (formato legible en español `DD-MM-YYYY a las HH:mm`)
  - `BusinessCalendarService` con métodos de consulta, actualización optimista (`concurrencyVersion`), adición y remoción de fechas excluidas con eventos de auditoría (`BUSINESS_CALENDAR_CONFIGURED`, `BUSINESS_CALENDAR_EXCLUDED_DATE_ADDED`, `BUSINESS_CALENDAR_EXCLUDED_DATE_REMOVED`).

### 3.2 Integración en dominios operativos
- **Ofertas de admisión (`packages/database/src/capacity-offer.ts`):**
  - `reserveAndIssue` y `reopenOffer` resuelven el calendario del tenant de manera fail-closed.
  - Calculan `expiresAt` con `calculateBusinessDeadline(issuedAt, offerValidityBusinessDays, calendar)`.
  - Calculan `reminderAt` con `calculateOfferReminderAt(issuedAt, expiresAt, calendar)`.
  - Encolan mensaje en outbox para `admission.offer.expire` (`availableAt = expiresAt`).
  - Encolan mensaje en outbox para `admission.offer.reminder.prepare` (`availableAt = reminderAt`) si no fue suprimido.
- **Observaciones documentales (`packages/database/src/documents.ts`):**
  - `observeDocument` resuelve el calendario del tenant y calcula `correctionDueAt` a las 23:59:59.999 local del último día hábil.
- **Comunicaciones (`packages/database/src/communications.ts`):**
  - Plantillas de oferta, recordatorio de oferta y subsanación documental formatean el plazo en horario local legible (ej. `27-08-2026 a las 23:59`).

### 3.3 Worker de recordatorios de oferta (`apps/worker`)
- **`OfferReminderWorker` (`apps/worker/src/worker.ts`):**
  - Consume el topic `admission.offer.reminder.prepare` mediante el servicio de outbox transaccional.
  - Invoca `prepareOfferReminderCommunication` bajo el contexto seguro del tenant.
  - Manejo de reintentos exponenciales con jitter y clasificación de errores permanentes (`INVALID_OFFER_REMINDER_JOB_PAYLOAD`).
  - Integrado en `apps/worker/src/main.ts` con parada ordenada (`graceful shutdown`).

### 3.4 API REST y Filtro de Errores (`apps/api`)
- **Controlador (`apps/api/src/business-calendar.controller.ts`):**
  - `GET /admin/tenants/:tenantId/business-calendar` (requiere `admission.config.read`)
  - `POST /admin/tenants/:tenantId/business-calendar` (requiere `admission.config.manage`, protección CSRF, control de concurrencia optimista)
  - `GET /admin/tenants/:tenantId/business-calendar/excluded-dates` (requiere `admission.config.read`)
  - `POST /admin/tenants/:tenantId/business-calendar/excluded-dates` (requiere `admission.config.manage`, protección CSRF, validación Zod)
  - `DELETE /admin/tenants/:tenantId/business-calendar/excluded-dates/:excludedDateId` (requiere `admission.config.manage`, protección CSRF)
- **Filtro de excepciones (`apps/api/src/error.filter.ts`):**
  - Mapeo estructurado para `BusinessCalendarConflictError`, `BusinessCalendarValidationError`, `BusinessCalendarNotConfiguredError`, `InvalidBusinessTimezoneError`.

### 3.5 Interfaz de administración web (`apps/web`)
- **Componente (`apps/web/app/business-calendar-workflows.tsx`):**
  - Pestaña de administración del calendario laboral institucional.
  - Visualización y cambio de zona horaria con prevención de colisiones de versión.
  - Listado, alta y eliminación de fechas excluidas / feriados institucionales con feedback contextual y CSRF automático.
  - Integrado en `apps/web/app/page.tsx`.

---

## 4. Resultados de validación y pruebas ejecutadas

### 4.1 Prueba de migración (`pnpm g5pc1r3:migration:smoke`)
- `FRESH_0_TO_19 = PASS`
- `INCREMENTAL_18_TO_19 = PASS`
- `G5PC1R3_SEALS = PASS` (verificación de tablas, tipos, forzado de RLS, grants y ausencia de seeding de feriados).

### 4.2 Pruebas de integración de dominio (`packages/database/src/business-calendar.integration.spec.ts`)
- **21 / 21 pruebas aprobadas (100% PASS):**
  - `R3-CAL-01`: Aceptación de zonas IANA estándar (`America/Santiago`, `UTC`, `America/New_York`, `Europe/Madrid`).
  - `R3-CAL-02`: Denegación de offsets fijos (`UTC-3`, `GMT-4`, `+03:00`, `-04:00`, etc.).
  - `R3-CAL-03`: Validación de semana laboral Lunes a Viernes.
  - `R3-CAL-04`: Exclusión de fechas no laborales configuradas.
  - `R3-CAL-05`: Garantía de que el día de emisión nunca cuenta como día 1.
  - `R3-CAL-06`: Búsqueda del día hábil anterior más próximo para recordatorios.
  - `R3-CAL-07`: CRUD de configuración de calendario con control de concurrencia optimista.
  - `R3-CAL-08`: CRUD de fechas excluidas y rechazo de duplicados.
  - `R3-CAL-09`: Emisión de eventos de auditoría para mutaciones de calendario y feriados.
  - `R3-CAL-10`: Comportamiento fail-closed ante ausencia de calendario configurado.
  - `R3-DL-01..04`: Cálculo de plazo de 3 días hábiles terminando a las 23:59:59.999 local cruzando fines de semana y feriados.
  - `R3-DST-01..02`: Correcta conversión en horario de invierno (UTC-4) y verano (UTC-3) para `America/Santiago`.
  - `R3-REM-01..04`: Cálculo de recordatorio a las 10:00:00.000 local 1 día hábil antes y supresión si la vigencia es menor a 1 día hábil.
  - `R3-REM-05`: Formato de texto de plazos en español (`DD-MM-YYYY a las HH:mm`).
  - `R3-OFFER-01..03`: Emisión de oferta y disposición aprobada encolando vencimiento y recordatorio en outbox.
  - `R3-REM-05..07`: Preparación idempotente de comunicaciones de recordatorio de oferta.

### 4.3 Pruebas de aislamiento RLS (`packages/database/src/business-calendar.rls.integration.spec.ts`)
- **8 / 8 pruebas aprobadas (100% PASS):**
  - `R3-RLS-01`: Tenant A lee únicamente su propio calendario y fechas excluidas.
  - `R3-RLS-02`: Ausencia de contexto de tenant devuelve conjunto vacío.
  - `R3-RLS-03`: Consulta cross-tenant devuelve conjunto vacío.
  - `R3-RLS-04`: Inserción cross-tenant es bloqueada por RLS.
  - `R3-RLS-05`: Actualización cross-tenant no afecta filas (0 rows updated).
  - `R3-RLS-06`: Eliminación cross-tenant no afecta filas (0 rows deleted).
  - `R3-RLS-07`: Conexión de pool reutilizada concurrentemente no filtra contexto entre tenants.
  - `R3-RLS-08`: Separación de roles de base de datos (`admission_app` vs `admission_migrator`) y `FORCE ROW LEVEL SECURITY` activo en ambas tablas.

### 4.4 Pruebas del Worker (`apps/worker/src/offer-reminder-worker.integration.spec.ts`)
- **5 / 5 pruebas aprobadas (100% PASS):**
  - `R3-WORK-01 & R3-WORK-02`: Procesa mensaje disponible, prepara comunicación y marca outbox como `SENT`.
  - `R3-WORK-03`: Ignora mensajes con `availableAt` en el futuro.
  - `R3-WORK-04`: Falla de inmediato ante payloads permanentemente malformados (`FAILED`).
  - `R3-WORK-05`: Reencola con backoff ante fallas transitorias (`PENDING`).
  - `R3-WORK-06`: Respeta estrictamente los límites del tenant al procesar.

### 4.5 Pruebas HTTP de API REST (`apps/api/src/business-calendar.http.integration.spec.ts`)
- **10 / 10 pruebas aprobadas (100% PASS):**
  - `R3-HTTP-01`: Requiere autenticación (401 sin sesión).
  - `R3-HTTP-02`: Requiere pertenencia activa (403 sin membresía).
  - `R3-HTTP-03`: Rechaza zonas horarias inválidas u offsets fijos con 400.
  - `R3-HTTP-04`: Detecta conflicto de versión en actualización de calendario con 409.
  - `R3-HTTP-05`: Actualiza zona horaria con versión concurrente válida (200).
  - `R3-HTTP-06`: Registra fecha excluida válida (201).
  - `R3-HTTP-07`: Rechaza duplicación de fecha excluida en el mismo tenant con 409.
  - `R3-HTTP-08`: Elimina fecha excluida existente (200).
  - `R3-HTTP-09`: Protege mutaciones contra CSRF (403 sin token o header inválido).
  - `R3-HTTP-10`: Aislamiento multi-tenant: Sesión de Tenant B no puede leer ni modificar Tenant A (403).

### 4.6 Suite completa de regresión
- `pnpm test`: **43 archivos de prueba, 638 pruebas ejecutadas, 638 pasadas (0 fallas, 0 omitidas)**.
- `pnpm test:rls`: **7 archivos de prueba RLS, 63 pruebas ejecutadas, 63 pasadas (100% PASS)**.
- `pnpm format:check`: **Prettier OK (0 discrepancias de formato)**.
- `pnpm lint`: **ESLint OK (0 errores, 0 advertencias)**.
- `pnpm typecheck`: **TypeScript OK (0 errores en los 4 proyectos del workspace)**.
- `pnpm build`: **Build OK (packages/database, apps/web, apps/api, apps/worker)**.
- `pnpm security:secrets`: **OK (350 archivos inspeccionados, 0 secretos)**.
- `pnpm security:deps`: **OK (0 vulnerabilidades de severidad alta o crítica)**.

---

## 5. Trabajo expresamente fuera de alcance

1. **PC1-TECH-013..015:** No incluidos en este incremento.
2. **Migration 20:** No autorizada ni creada.
3. **Proveedores de correo reales:** El sistema utiliza el adaptador de comunicaciones outbox seguro; no se configuraron credenciales ni proveedores SMTP externos.
4. **Feriados automáticos / APIs externas:** No se agregaron scrapers ni llamadas de red externas para poblar feriados chilenos automáticamente.
5. **Integración con EduPay:** Los dominios de Admisión y EduPay permanecen estrictamente desacoplados.

---

## 6. Estado de compuerta y siguiente acción humana

- **Estado:** Implementación técnica de `G5-PC1-R3` (`PC1-TECH-007`, `PC1-TECH-008`, `PC1-TECH-009`) finalizada con éxito y lista para revisión técnica humana.
- **Siguiente acción humana:** Revisar los cambios en el PR `#8`, verificar la suite de pruebas y evaluar la autorización para el siguiente incremento técnico.
