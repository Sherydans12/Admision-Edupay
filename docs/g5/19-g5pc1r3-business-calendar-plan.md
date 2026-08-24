# G5-PC1-R3 — Plan de calendario laboral institucional, plazos y recordatorios

## Control de entrada

| Campo | Estado verificado |
| --- | --- |
| Repositorio | `Sherydans12/Admision-Edupay` |
| Rama | `feat/e5-mvp` |
| HEAD inicial | `4bc7b9f5bc83a000643c5a6c3b9d550877700c02` |
| Working tree inicial | `clean` |
| PR | `#8`, `OPEN`, `DRAFT`, `NO MERGE` |
| Migration 17 | `20260816070000_g5pc1r12_authority_core` (IMMUTABLE) |
| Migration 18 | `20260820090000_g5pc1r4_sensitive_processing` (IMMUTABLE) |
| Migration 19 | Ausente al ingreso / Autorizada exclusivamente para R3 |
| Migration 20 | Ausente / No autorizada |

## Clasificación de la información

- **Decisión aprobada:** Decisiones humanas congeladas R3-001..R3-013 y PC1-B (PC1-014..PC1-018).
- **Hecho confirmado:** Comportamiento observado en runtime (PostgreSQL, Prisma, outbox, workers, controllers, web).
- **Supuesto de trabajo:** Ninguno que contradiga las decisiones congeladas.
- **Pregunta abierta:** Ninguna para el núcleo técnico R3; los feriados reales y mailbox productivo permanecen como inputs institucionales prepiloto.

## Estado canónico y alcance autorizado

- **PC1-R12:** `COMPLETE / TECHNICALLY_ACCEPTED`
- **PC1-R4:** `COMPLETE / TECHNICALLY_ACCEPTED`
- **PC1-TECH-001..006:** `IMPLEMENTED / TECHNICALLY_REVIEWED`
- **PC1-TECH-010..012:** `IMPLEMENTED / TECHNICALLY_REVIEWED`
- **PC1-TECH-007 (Business Calendar):** `PARTIAL / R3 TARGET`
- **PC1-TECH-008 (Offer & Document Deadlines 3-day / 23:59):** `PARTIAL / R3 TARGET`
- **PC1-TECH-009 (Offer Reminder 1-day before at 10:00):** `PARTIAL / R3 TARGET`
- **Fuera de alcance:** PC1-TECH-013..015, Migration 20, providers productivos, producción, piloto, datos reales, integración EduPay, G5 approval.

---

## 1. Mapeo de runtime actual

### 1.1 Ofertas y plazos actuales (`packages/database/src/capacity-offer.ts`)
- Utiliza `DevelopmentBusinessCalendar.addBusinessDays(issuedAt, days)` con cálculo ingenuo en UTC (lunes a viernes, sin feriados ni exclusiones).
- Conserva la hora exacta de emisión (no normaliza a las 23:59:59.999 de la zona institucional).
- Encola el outbox `admission.offer.expire` con el `expiresAt` resultante.
- No programa recordatorios automáticos en el outbox al emitir la oferta.

### 1.2 Subsanación de documentos (`packages/database/src/documents.ts`)
- En `observeDocument`: calcula `correctionDueAt = this.calendar.addBusinessDays(now, requirementVersion.correctionWindowBusinessDays)`.
- Persiste `correctionDueAt` en `DocumentReview` y `DocumentSubmission` (ambas tablas ya disponen de la columna `correction_due_at timestamptz(3)`).
- No normaliza a fin de día local (23:59:59.999) ni aplica fechas excluidas o zona IANA.

### 1.3 Comunicaciones y recordatorios (`packages/database/src/communications.ts`)
- Dispone de `prepareOfferReminderCommunication(params)` idempotente para ofertas `ACTIVE` y vigentes.
- Falta el encolado en outbox al emitir la oferta y el worker que procese la preparación en el momento objetivo (1 día hábil antes a las 10:00 local).
- El cuerpo de las comunicaciones utiliza `.toISOString()` en lugar de texto localizado en hora institucional.

### 1.4 Outbox y Workers (`packages/database/src/outbox.ts` y `apps/worker/src/worker.ts`)
- Outbox transaccional PostgreSQL existente con `claimNext`, leasing, retry exponencial y `availableAt`.
- Topics existentes: `admission.offer.expire`, `admission.communication.send`, `document.process`.
- Topic a incorporar para R3: `admission.offer.reminder.prepare`.

---

## 2. Decisiones de diseño R3 (Human Approved / Frozen)

- **R3-001:** El calendario laboral está persistido y es estrictamente tenant-scoped.
- **R3-002:** La zona horaria es un identificador IANA válido (ej. `America/Santiago`). No se hardcodea la zona de Conquistadores en la lógica de producto.
- **R3-003:** Semana laboral MVP: Lunes a Viernes. Sin patrón de fin de semana configurable en R3.
- **R3-004:** Fechas excluidas explícitamente configurables por tenant (feriados, cierres institucionales, excepciones).
- **R3-005:** Sin API externa de feriados.
- **R3-006:** El día de emisión/creación NUNCA cuenta como día hábil 1.
- **R3-007:** Los plazos expiran al final del último día hábil a las 23:59:59.999 en la hora local del tenant.
- **R3-008:** El mismo motor de calendario se reutiliza para ofertas de admisión y observaciones documentales.
- **R3-009:** Recordatorio de oferta: un día hábil antes de la expiración a las 10:00:00.000 hora local del tenant.
- **R3-010:** Plazos emitidos son inmutables. Cambios posteriores en el calendario no mutan plazos pasados.
- **R3-011:** Programación de recordatorios reutiliza el outbox PostgreSQL existente (`admission.offer.reminder.prepare`).
- **R3-012:** Toda nueva versión de oferta (`OfferVersion N+1`) recibe nuevo `issuedAt`, nuevo `expiresAt` y nueva programación de recordatorio.
- **R3-013:** Migration 19 se limita a la persistencia del calendario y fechas excluidas.

---

## 3. Schema y DDL propuesto (Migration 19)

### 3.1 Modelo Prisma
```prisma
model TenantBusinessCalendar {
  id                 String                       @id @default(uuid()) @db.Uuid
  tenantId           String                       @unique @map("tenant_id") @db.Uuid
  timezone           String                       @db.VarChar(80)
  concurrencyVersion Int                          @default(1) @map("concurrency_version")
  createdAt          DateTime                     @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt          DateTime                     @updatedAt @map("updated_at") @db.Timestamptz(3)
  tenant             Tenant                       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  excludedDates      BusinessCalendarExcludedDate[]

  @@map("tenant_business_calendars")
}

model BusinessCalendarExcludedDate {
  id           String                 @id @default(uuid()) @db.Uuid
  tenantId     String                 @map("tenant_id") @db.Uuid
  calendarDate DateTime               @map("calendar_date") @db.Date
  reason       String                 @db.VarChar(200)
  createdBy    String                 @map("created_by") @db.Uuid
  createdAt    DateTime               @default(now()) @map("created_at") @db.Timestamptz(3)
  tenant       Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  calendar     TenantBusinessCalendar @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
  creator      PlatformUser           @relation("ExcludedDateCreator", fields: [createdBy], references: [id], onDelete: Restrict)

  @@unique([tenantId, calendarDate])
  @@index([tenantId, calendarDate])
  @@map("business_calendar_excluded_dates")
}
```

### 3.2 SQL DDL (Migration 19: `20260821190000_g5pc1r3_business_calendar`)
- Creación de tablas `tenant_business_calendars` y `business_calendar_excluded_dates`.
- `calendar_date` es tipo `DATE` de PostgreSQL.
- Restricción `UNIQUE(tenant_id, calendar_date)`.
- `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY` en ambas tablas.
- Políticas RLS: `tenant_id = admission_current_tenant_id()`.
- Grants a `admission_app` (SELECT, INSERT, UPDATE, DELETE) y `admission_migration` (ALL).
- Sin rows automáticas de calendario ni feriados precargados (Fail-closed).

---

## 4. Motor de fechas civiles y zona horaria

### 4.1 Abstracción de dominio (`packages/database/src/business-calendar.ts`)
- **Validación de zona IANA:** Verificación estricta mediante `Intl.DateTimeFormat(undefined, { timeZone })` y rechazo de offsets manuales (`UTC-3`, `GMT-4`, `+03:00`).
- **Conversión de instante a fecha civil local:** `getLocalDate(instant: Date, timeZone: string): string` (retorna `YYYY-MM-DD`).
- **Comprobación de día hábil:** `isBusinessDate(dateStr: string, excludedDates: Set<string>): boolean` (Lunes a Viernes y no presente en excludedDates).
- **Cálculo de días hábiles posteriores:** `addBusinessDaysAfter(startDateStr: string, count: number, excludedDates: Set<string>): string`. El día de inicio nunca cuenta como día 1.
- **Día hábil anterior:** `previousBusinessDate(dateStr: string, excludedDates: Set<string>): string`.
- **Conversión de fecha civil + hora local a instante UTC:** `civilDateTimeToInstant(dateStr: string, hour: number, minute: number, second: number, ms: number, timeZone: string): Date`. Maneja transiciones DST de forma exacta y falla cerrado ante tiempos inexistentes o ambiguos.
- **Cálculo de expiración (23:59:59.999):** `calculateOfferDeadline(issuedAt: Date, businessDays: number, calendar: TenantCalendarConfig, excludedDates: Set<string>): Date`.
- **Cálculo de recordatorio (10:00:00.000 día hábil previo):** `calculateOfferReminderAt(issuedAt: Date, expiresAt: Date, calendar: TenantCalendarConfig, excludedDates: Set<string>): Date | null`. Si `reminderAt <= issuedAt`, retorna `null`.

---

## 5. Integración de flujos operativos

### 5.1 Emisión de Ofertas (`capacity-offer.ts`)
- Resuelve el calendario del tenant. Si no está configurado, lanza `BusinessCalendarNotConfiguredError` (`BUSINESS_CALENDAR_NOT_CONFIGURED`).
- Aplica cálculo en:
  - Dirección `APROBADO` (`applyDirectionDispositionEffects`);
  - Promoción de lista de espera (`promoteWaitlistEntry`);
  - Reapertura de oferta (`reopenOffer`);
- Encola `admission.offer.expire` para `expiresAt`.
- Si `reminderAt` es válido (> `issuedAt`), encola `admission.offer.reminder.prepare` en outbox con `availableAt = reminderAt` e `idempotencyKey = offer-reminder-prepare:${offerVersionId}`.

### 5.2 Reapertura de Oferta (`reopenOffer`)
- Crea `OfferVersion N+1` con nuevo `issuedAt`, nuevo `expiresAt` y nueva programación de recordatorio según el calendario vigente al momento de reapertura.
- La versión previa permanece inmutable.

### 5.3 Subsanación documental (`documents.ts`)
- En `observeDocument`: resuelve calendario del tenant y calcula `correctionDueAt` a las 23:59:59.999 local del último día hábil.
- Persiste `correctionDueAt` en `DocumentReview` y `DocumentSubmission`.
- No requiere columnas adicionales ni cambios de schema en documentos (TECH-008 cerrado).

### 5.4 Worker de Recordatorios (`apps/worker/src/worker.ts`)
- Procesa el topic `admission.offer.reminder.prepare`.
- Ejecuta `prepareOfferReminderCommunication` bajo el contexto del tenant.
- Respeta la supresión existente: si la versión ya no es `ACTIVE` o ya no es la actual, no genera comunicación.
- Idempotencia preservada.

---

## 6. API Administrativa y UX

### 6.1 Endpoints REST (`/api/v1/admin/tenants/:tenantId/business-calendar`)
- `GET /api/v1/admin/tenants/:tenantId/business-calendar`: Requiere `admission.config.read`.
- `POST /api/v1/admin/tenants/:tenantId/business-calendar`: Configura/actualiza zona horaria. Requiere `admission.config.manage` y `expectedVersion`.
- `GET /api/v1/admin/tenants/:tenantId/business-calendar/excluded-dates`: Requiere `admission.config.read`.
- `POST /api/v1/admin/tenants/:tenantId/business-calendar/excluded-dates`: Agrega fecha excluida (`YYYY-MM-DD`, `reason`). Requiere `admission.config.manage`.
- `DELETE /api/v1/admin/tenants/:tenantId/business-calendar/excluded-dates/:excludedDateId`: Elimina fecha excluida. Requiere `admission.config.manage`.

### 6.2 Auditoría
Eventos de auditoría registrados:
- `BUSINESS_CALENDAR_CONFIGURED`
- `BUSINESS_CALENDAR_TIMEZONE_UPDATED`
- `BUSINESS_CALENDAR_EXCLUDED_DATE_ADDED`
- `BUSINESS_CALENDAR_EXCLUDED_DATE_REMOVED`

### 6.3 Interfaz de Usuario (Staff/Admin y Familia)
- **Admin:** Panel de configuración de calendario institucional en `apps/web/app/business-calendar-workflows.tsx` con zona IANA, listado de fechas excluidas, adición y eliminación.
- **Familia / Comunicaciones:** Presentación de fechas límite en formato de hora institucional (`25-08-2026 a las 23:59`) en lugar de strings UTC ISO crudos.

---

## 7. Matriz de Pruebas Directas

1. **Calendario y Fechas (`R3-CAL-01..10`):** Lunes-Viernes hábil, fin de semana no hábil, fechas excluidas, aislamiento tenant, fail-closed por calendario ausente, zona horaria inválida, control de concurrencia y auditoría.
2. **Plazos y Expiración (`R3-DL-01..07`):** Viernes + 3 días -> Miércoles 23:59:59.999 local; lunes excluido -> Jueves 23:59:59.999; día de emisión excluido; sábado de emisión; inmutabilidad de plazos históricos ante cambios posteriores.
3. **Cambio de Hora / DST (`R3-DST-01..04`):** Verificación de redondeo y consistencia en transiciones de horario de invierno/verano en `America/Santiago`.
4. **Ofertas (`R3-OFFER-01..10`):** Emisión denegada sin calendario, emisión con calendario, expiración a 3 días, outbox de expiración, lista de espera, aprobación de Dirección, reapertura de oferta y conservación de capacidades.
5. **Cálculo de Recordatorios (`R3-REM-01..07`):** Día hábil previo a las 10:00 local, saltos de días excluidos, expiración en lunes -> viernes previo 10:00, supresión si reminderAt <= issuedAt, idempotencia y reaperturas.
6. **Worker de Recordatorios (`R3-WORK-01..08`):** Ejecución de outbox, creación de Communication, no duplicación, supresión ante oferta aceptada/declinada/expirada/obsoleta y nueva versión.
7. **Subsanación Documental (`R3-DOC-01..06`):** Observación viernes -> miércoles 23:59, lunes excluido -> jueves 23:59, mismo calendario que ofertas, aislamiento tenant, inmutabilidad y texto en comunicación.
8. **Seguridad y RLS (`R3-RLS-01..08`):** Lectura propia, denegación sin contexto, denegación cross-tenant lectura/actualización/inserción/borrado, limpieza en pool y denegación support ambient.
9. **HTTP Integration (`R3-HTTP-01..10`):** Pruebas de boundary completas para todos los endpoints administrativos y emisión de ofertas con validación de envelope de error y correlación.
10. **Smoke de Migración:** `pnpm g5pc1r3:migration:smoke` (Fresh 0→19, Incremental 18→19, sellos de migraciones 17 y 18).
