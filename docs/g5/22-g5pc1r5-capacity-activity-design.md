# PRG-01 / G5-PC1-R5 — Diseño de capacidad y configuración de actividades

## Estado, propósito y límite de autorización

**Estado:** `APPROVED FOR IMPLEMENTATION / SYNTHETIC DATA ONLY`.

Este documento propone el diseño técnico de `PC1-R5` para cerrar:

- `PC1-TECH-013`: capacidad explícita como precondición de publicación y apertura
  operacional;
- `PC1-TECH-014`: defaults de duración de 30/60 minutos con precedencia explícita;
- `PC1-TECH-015`: configuración tenant-scoped de `1 primary + 1 backup` para las
  funciones críticas de actividad.

La aprobación humana del 2026-08-24 autoriza la implementación de `R5-D-001..009` y
Migration 20 exclusivamente con datos sintéticos. No autoriza datos reales, piloto,
producción, proveedores, infraestructura ni integración técnica EduPay.

## Clasificación de la información

### Hechos confirmados

1. `AdmissionOffering` puede crearse o actualizarse directamente con estado
   `PUBLISHED`; el runtime actual no exige una fila `AdmissionCapacity` para publicar o
   aparecer en discovery.
2. `AdmissionCapacity` ya es tenant-owned, tiene unicidad por `tenantId + offeringId`,
   permite `configuredCapacity = 0` y usa `concurrencyVersion`.
3. La ausencia de `AdmissionCapacity` sólo produce `CAPACITY_NOT_CONFIGURED` al intentar
   reservar/emitir una oferta; llega demasiado tarde para proteger la publicación.
4. `ActivityDefinitionKind` contiene exactamente `GUARDIAN_INTERVIEW` y
   `DIAGNOSTIC_EVALUATION`.
5. `ActivityDefinitionVersion.durationMinutes` es obligatorio y almacena un entero
   positivo; API y UI exigen hoy un valor explícito.
6. `ActivityAppointment.assignedUserId` registra un único ejecutor. El servicio valida
   usuario y membership activa, pero no existe una política primary/backup.
7. Los permisos actuales incluyen `activity.definition.manage`,
   `activity.definition.publish`, `activity.schedule`, `activity.perform`,
   `activity.repeat`, `activity.close` y `admission.config.manage/read`.
8. Las migraciones 17, 18 y 19 están aplicadas y deben permanecer inmutables. Migration
   20 no existe al momento de este diseño.
9. El aislamiento tenant usa contexto transaccional PostgreSQL, RLS habilitado y
   `FORCE ROW LEVEL SECURITY`; el rol `admission_app` no debe adquirir privilegios
   globales ni de bypass.
10. Sólo están autorizados datos sintéticos/non-production durante construcción y
    verificación.

### Decisiones aprobadas que condicionan el diseño

1. `PC1-020`: una oferta no debe quedar operacionalmente publicable/abierta sin
   capacidad explícita aplicable; capacidad `0` no significa capacidad indefinida.
2. `PC1-009`: entrevista de adulto responsable usa 30 minutos por defecto para la
   configuración piloto y sigue siendo configurable.
3. `PC1-010`: evaluación diagnóstica usa 60 minutos por defecto y sigue siendo
   configurable.
4. `PC1-011/012`: los ejecutores concretos se configuran; ninguna persona se hardcodea.
5. `PC1-013`: cada función/actividad crítica requiere conceptualmente una persona
   primary y otra backup antes del piloto.
6. Las capacidades concretas, personas primary/backup y evaluadores son input
   institucional prepiloto todavía pendiente.

### Supuestos de trabajo del DRAFT

Estos supuestos permiten diseñar, pero no quedan aprobados por existir en este archivo:

1. Los dos valores actuales de `ActivityDefinitionKind` son las funciones críticas que
   PC1-R5 debe cubrir inicialmente.
2. La política primary/backup puede definirse por `tenant + kind`; no se requiere aún
   una política diferente por sede, año, curso, proceso u offering.
3. Para el MVP R5, una cita nueva se asigna únicamente a la persona primary o backup de
   la política vigente. Una futura nómina ampliada de ejecutores sería otra decisión.
4. Una versión de actividad conserva una duración resuelta e inmutable aunque el
   default tenant/kind cambie después.
5. La capacidad explícita se evalúa por existencia de la fila, no por inferencia desde
   `availabilityCategory` ni por un valor sentinel.
6. Los cambios de política no reescriben citas ni versiones históricas.

### Preguntas abiertas

1. ¿La asignación de citas debe limitarse estrictamente a primary/backup, o se aprobará
   una nómina adicional de ejecutores autorizados?
2. ¿El alcance `tenant + kind` es suficiente o alguna institución necesitará política
   por sede, año, curso, proceso u offering?
3. ¿Debe existir una matriz aprobada que relacione `configuredCapacity = 0` con
   `availabilityCategory`, o R5 sólo debe exigir capacidad explícita sin derivar el
   texto público?
4. ¿Un cambio de primary/backup debe bloquearse si existen citas futuras asignadas a la
   persona removida, o basta advertencia, auditoría y reasignación operacional?
5. ¿Los defaults 30/60 serán baseline de inicialización para cualquier tenant o una
   plantilla exclusiva de la configuración Conquistadores 2027?
6. ¿Qué memberships sintéticas se usarán para aceptación técnica? Las personas reales
   permanecen fuera de este diseño.

## Opciones comparadas

### PC1-TECH-013 — Gate de capacidad

| Opción | Ventajas | Riesgos | Impacto |
| --- | --- | --- | --- |
| A. Guard en `createOffering`/`updateOffering` | Cambio pequeño; reutiliza schema | Crear `PUBLISHED` no puede preceder a capacidad porque capacity necesita offering; mantiene transición ambigua y es fácil que otro entry point omita el guard | Backend/API/tests; sin Migration 20 obligatoria |
| B. Crear siempre `DRAFT`, configurar capacidad y publicar con transición explícita | Flujo comprensible; gate central; permite readiness, concurrencia optimista y auditoría; evita estados parciales | Cambio de contrato para clientes que hoy envían `PUBLISHED`; requiere UI de publicación | Schema menor, backend, API, UI y tests |
| C. Trigger/constraint diferido PostgreSQL que impida `PUBLISHED` sin capacity | Invariante fuerte incluso ante SQL directo | Trigger relacional más difícil de mantener con RLS/Prisma; mensajes y compatibilidad operacional más complejos | Migration 20, SQL, smokes y pruebas DB adicionales |

**Recomendación:** opción B con defensa en profundidad en discovery. La escritura de
negocio usa servicios autorizados; el rol migrator continúa siendo el único que puede
realizar mantenimiento directo. No se recomienda introducir un trigger relacional en
R5 sin evidencia de que exista otro writer autorizado.

### PC1-TECH-014 — Defaults de duración

| Opción | Ventajas | Riesgos | Impacto |
| --- | --- | --- | --- |
| A. `defaultValue` sólo en frontend | Muy simple | API, jobs u otros clientes no comparten semántica; no es una regla de dominio | UI únicamente; insuficiente |
| B. Mapa 30/60 hardcodeado en servicio | Semántica uniforme y sin schema | Convierte configuración piloto en constante universal; no conserva cambios tenant-specific | Backend/API/tests |
| C. Política persistida por `tenant + kind`, inicializada desde 30/60 y override inmutable por versión | Configurable, trazable, multiempresa y consistente entre canales; la versión conserva el valor efectivo | Requiere Migration 20, CRUD, permisos, readiness y concurrencia | Schema, backend, API, UI, RLS y tests |

**Recomendación:** opción C. Los valores 30/60 son baseline de inicialización propuesto;
cada valor operativo queda persistido en la política del tenant antes de publicar o
programar. Migration 20 no crea filas ni elige valores para tenants existentes.

### PC1-TECH-015 — Primary y backup

| Opción | Ventajas | Riesgos | Impacto |
| --- | --- | --- | --- |
| A. Dos IDs nullable en `ActivityDefinition` | Implementación directa por definición | Permite estado parcial; duplica personas entre definiciones; mezcla identidad estable con contenido versionable | Schema/backend/UI/tests |
| B. Política atómica por `tenant + kind` con dos membership FKs requeridas | Un solo owner por función; tenant FK verificable; primary/backup distintos; actualización optimista y fail-closed | No cubre scopes más finos ni roster ampliado sin nueva decisión | Migration 20, backend/API/UI/RLS/tests |
| C. Tabla temporal de asignaciones N:N con roles y vigencia | Muy extensible; soporta roster, reemplazos y vigencias | Mayor complejidad de solapamientos, resolución y UI; excede la necesidad 1+1 aprobada | Migration y dominio sustancialmente mayores |

**Recomendación:** opción B para R5. La opción C sólo debe retomarse si la institución
aprueba roster o vigencia temporal como requisito real.

## Diseño recomendado

### 1. Semántica exacta de capacidad y publicación

#### Estados conceptuales de configuración

| Estado | Condición | Publicación/open | Emisión de asiento |
| --- | --- | --- | --- |
| `CAPACITY_NOT_CONFIGURED` | No existe fila `AdmissionCapacity` para la offering | **DENY** | **DENY** |
| `CAPACITY_CONFIGURED_ZERO` | Existe fila y `configuredCapacity = 0` | Puede publicar si el resto de readiness pasa | Siempre falla `NO_ADMISSION_SEAT_AVAILABLE`; nunca significa ilimitada |
| `CAPACITY_CONFIGURED_POSITIVE` | Existe fila y `configuredCapacity > 0` | Puede publicar si el resto de readiness pasa | Sujeta a reservas consumidas, locks y concurrencia existente |

Reglas exactas:

1. Crear una offering siempre produce `DRAFT`; enviar `PUBLISHED` en el create devuelve
   `OFFERING_EXPLICIT_PUBLISH_REQUIRED`.
2. El update genérico modifica configuración editable, pero no cambia lifecycle. Las
   transiciones `publish` y `close` son comandos separados.
3. `PublishAdmissionOffering` bloquea y relee offering y capacity dentro de una misma
   transacción tenant-scoped. Ausencia de capacity devuelve
   `CAPACITY_CONFIGURATION_REQUIRED` y no cambia el lifecycle.
4. `configuredCapacity = 0` satisface únicamente la precondición de configuración; no
   crea cupo, no se interpreta como `NULL`, unlimited ni unknown.
5. R5 no deriva ni corrige `availabilityCategory` desde la cifra. La familia continúa
   viendo sólo la categoría aprobada, nunca el número. Las combinaciones adicionales
   entre categoría y cifra requieren una decisión distinta.
6. `listPublicOfferings` exige defensivamente `admissionCapacity: { isNot: null }` además
   de los gates existentes. Una fila legacy inconsistente no se expone.
7. Las transiciones que abren año/proceso deben ejecutar un preflight sobre cualquier
   offering ya `PUBLISHED`; si alguna no tiene capacity, devuelven
   `PUBLISHED_OFFERING_CAPACITY_REQUIRED`.
8. No se agrega delete de capacity. Si se autoriza en el futuro, debe denegarse mientras
   la offering esté publicada o existan reservas/ofertas/historial dependiente.

#### Concurrencia de publicación

1. `AdmissionOffering` incorpora `concurrencyVersion`.
2. El comando publish requiere `expectedOfferingVersion` y devuelve
   `OFFERING_VERSION_CHANGED` ante stale write.
3. La transacción bloquea primero offering y luego capacity, en ese orden estable.
4. Dos publishes concurrentes producen un éxito y un conflicto idempotente; nunca dos
   eventos de publicación exitosos.
5. Ajustar capacity conserva su `expectedVersion` actual. Publish sólo necesita confirmar
   existencia; no promete congelar el valor numérico.

### 2. Defaults de duración y precedencia

#### Baseline propuesto

| `ActivityDefinitionKind` | Baseline de inicialización |
| --- | ---: |
| `GUARDIAN_INTERVIEW` | 30 minutos |
| `DIAGNOSTIC_EVALUATION` | 60 minutos |

La precedencia es:

```text
VERSION OVERRIDE
  > TENANT + KIND DEFAULT PERSISTED
  > APPROVED KIND BASELINE USED ONLY TO INITIALIZE THE POLICY
```

Semántica exacta:

1. La política tenant/kind siempre persiste `defaultDurationMinutes`; el runtime no
   depende de un default de UI.
2. Al crear la política, la UI/API pueden proponer 30/60 según kind. El valor se muestra,
   puede cambiarse y sólo se vuelve operativo al guardar explícitamente la política.
3. `durationMinutes` pasa a ser opcional en el comando create/update de una versión
   DRAFT:
   - presente: se valida `1..1440`, se guarda el valor y
     `durationSource = VERSION_OVERRIDE`;
   - ausente: se exige política tenant/kind, se copia su default y
     `durationSource = TENANT_KIND_DEFAULT`.
4. `ActivityDefinitionVersion.durationMinutes` continúa `NOT NULL`; una versión guarda
   el resultado resuelto y no cambia cuando cambia la política.
5. Clonar una versión copia su duración efectiva y source como base del nuevo DRAFT. Si
   el actor elimina el override, se resuelve nuevamente desde la política vigente.
6. Publicar una versión vuelve a validar que exista una política ready para su kind,
   pero no recalcula una duración ya persistida.
7. Citas y reprogramaciones copian la duración desde la versión fijada, como ocurre hoy.

### 3. Primary + backup fail-closed

#### Scope e identidad

1. Existe exactamente una `TenantActivityPolicy` por `tenantId + kind`.
2. `primaryMembershipId` y `backupMembershipId` son obligatorios y distintos.
3. Se referencian memberships, no nombres ni IDs de usuario entregados por cliente. La
   FK compuesta garantiza pertenencia al mismo tenant.
4. Para estar `READY`, ambas memberships deben estar activas en la fecha efectiva, sus
   usuarios deben estar `ACTIVE` y cada una debe tener una asignación de rol activa que
   incluya `activity.perform`.
5. Una persona identificada en otro tenant nunca satisface la política aunque se conozca
   su UUID.

#### Gates fail-closed

| Boundary | Regla |
| --- | --- |
| Publicar versión de actividad | Denegar si no existe policy ready para el kind |
| Pinning de nuevas actividades | Denegar si la versión publicada perdió readiness antes de pinning |
| Programar/reprogramar/repetir | Denegar si policy no está ready o `assignedUserId` no corresponde a primary/backup vigente |
| Registrar resultado de una cita existente | Mantener el snapshot `assignedUserId`; exigir usuario/membership/capability activa y actor asignado. Un cambio posterior de policy no reescribe la cita |
| Actualizar policy | No reescribir versiones ni citas. Informar cantidad sintética/operacional de citas futuras afectadas para reasignación |

Reason codes propuestos:

- `ACTIVITY_POLICY_REQUIRED`;
- `ACTIVITY_POLICY_EXECUTORS_MUST_DIFFER`;
- `ACTIVITY_POLICY_EXECUTOR_INACTIVE`;
- `ACTIVITY_POLICY_EXECUTOR_CAPABILITY_REQUIRED`;
- `ACTIVITY_POLICY_VERSION_CHANGED`;
- `ASSIGNED_EXECUTOR_NOT_PRIMARY_OR_BACKUP`.

## Propuesta exacta de schema

El siguiente fragmento es diseño, no una modificación aplicada:

```prisma
enum ActivityDurationSource {
  TENANT_KIND_DEFAULT
  VERSION_OVERRIDE
}

model TenantActivityPolicy {
  id                     String                 @id @default(uuid()) @db.Uuid
  tenantId               String                 @map("tenant_id") @db.Uuid
  kind                   ActivityDefinitionKind
  defaultDurationMinutes Int                    @map("default_duration_minutes")
  primaryMembershipId    String                 @map("primary_membership_id") @db.Uuid
  backupMembershipId     String                 @map("backup_membership_id") @db.Uuid
  concurrencyVersion     Int                    @default(1) @map("concurrency_version")
  createdBy              String                 @map("created_by") @db.Uuid
  updatedBy              String                 @map("updated_by") @db.Uuid
  createdAt              DateTime               @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt              DateTime               @updatedAt @map("updated_at") @db.Timestamptz(3)
  tenant                 Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  primaryMembership      Membership             @relation("ActivityPolicyPrimaryMembership", fields: [tenantId, primaryMembershipId], references: [tenantId, id], onDelete: Restrict)
  backupMembership       Membership             @relation("ActivityPolicyBackupMembership", fields: [tenantId, backupMembershipId], references: [tenantId, id], onDelete: Restrict)

  @@unique([tenantId, id])
  @@unique([tenantId, kind])
  @@index([tenantId, primaryMembershipId])
  @@index([tenantId, backupMembershipId])
  @@map("tenant_activity_policies")
}
```

Cambios relacionados:

```prisma
model AdmissionOffering {
  // campos actuales...
  concurrencyVersion Int @default(1) @map("concurrency_version")
}

model ActivityDefinitionVersion {
  // campos actuales...
  durationSource ActivityDurationSource @map("duration_source")
}
```

`Tenant` agrega `activityPolicies TenantActivityPolicy[]`. `Membership` agrega las dos
relaciones nombradas para primary y backup. No se agregan nombres, emails, cifras de
capacidad ni personas al schema.

### Constraints SQL requeridos

Migration 20 debe incluir, además de FKs/unique generados:

```sql
CHECK (default_duration_minutes BETWEEN 1 AND 1440)
CHECK (primary_membership_id <> backup_membership_id)
CHECK (concurrency_version > 0)
```

Las reglas de membership/user activo y capability no son constraints estáticos: se
validan transaccionalmente en dominio porque dependen de vigencias y role assignments.

## Alcance propuesto de Migration 20

**Nombre propuesto:**
`20260824HHMMSS_g5pc1r5_capacity_activity_policy`.

**Incluido:**

1. Crear enum `ActivityDurationSource`.
2. Agregar `admission_offerings.concurrency_version INT NOT NULL DEFAULT 1`.
3. Agregar `activity_definition_versions.duration_source`, backfill de filas existentes
   a `VERSION_OVERRIDE` —todos los entry points 17–19 exigían duración explícita— y
   dejar la columna `NOT NULL`.
4. Crear `tenant_activity_policies`, checks, FKs compuestas e índices.
5. Habilitar y forzar RLS, crear policy tenant y otorgar privilegios mínimos.
6. No modificar migrations 17, 18 o 19.

**Excluido:**

- filas de política o capacidad;
- backfill de personas, memberships, primary/backup o cifras;
- cierre/alteración automática de offerings legacy;
- cambios a `configuredCapacity` o reservas históricas;
- nuevas actividades, kind, scopes institucionales o datos reales;
- providers, monitoring, email, EduPay o infraestructura.

## RLS, FORCE y grants

Para `tenant_activity_policies`:

```sql
ALTER TABLE tenant_activity_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_activity_policies FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_activity_policies_tenant_isolation
ON tenant_activity_policies
USING (tenant_id = current_setting('admission.tenant_id', true)::uuid)
WITH CHECK (tenant_id = current_setting('admission.tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE tenant_activity_policies TO admission_app;
```

Requisitos adicionales:

1. Sin contexto tenant, SELECT devuelve cero filas y mutaciones fallan.
2. El app role no recibe `TRIGGER`, `REFERENCES`, `TRUNCATE`, ownership ni `BYPASSRLS`.
3. Las FKs primary/backup incluyen `tenant_id`; un membership de tenant B no puede
   insertarse en policy A aun si su UUID se conoce.
4. El migrator conserva DDL; no se usa como runtime.
5. `AdmissionOffering` y `ActivityDefinitionVersion` conservan sus políticas RLS
   existentes; Migration 20 no las reemplaza ni debilita.

## Capabilities y autorización

Se proponen dos capabilities específicas:

| Capability | Uso |
| --- | --- |
| `activity.policy.read` | Leer defaults, readiness y asignaciones primary/backup del tenant |
| `activity.policy.manage` | Crear/actualizar la policy con control optimista |

Reglas:

1. `activity.definition.manage/publish` no concede automáticamente policy manage.
2. `admission.config.manage` tampoco concede implícitamente los nuevos permisos; los
   role assignments deben declararlos de forma explícita.
3. Publicar una activity version continúa requiriendo
   `activity.definition.publish`; consultar readiness interno puede realizarse dentro
   del comando sin entregar policy manage.
4. Configurar/publish offering continúa usando `admission.config.manage`; leer readiness
   usa `admission.config.read`.
5. Ser primary o backup no concede permisos. La membership debe poseer
   `activity.perform` mediante RoleAssignment activo.
6. Identificadores del request son candidatos; autorización, tenant y capability se
   resuelven desde sesión, membership y datos persistidos.

## Auditoría y observabilidad

Eventos de éxito propuestos:

| Evento | Recurso | Metadata mínima |
| --- | --- | --- |
| `ADMISSION_OFFERING_PUBLISHED` | `AdmissionOffering` | `offeringVersion`, `capacityState`, `capacityVersion` |
| `TENANT_ACTIVITY_POLICY_CREATED` | `TenantActivityPolicy` | `kind`, `policyVersion`, `defaultDurationMinutes` |
| `TENANT_ACTIVITY_POLICY_UPDATED` | `TenantActivityPolicy` | `kind`, `oldVersion`, `newVersion`, campos modificados |
| `ACTIVITY_VERSION_DURATION_RESOLVED` | `ActivityDefinitionVersion` | `kind`, `durationMinutes`, `durationSource`, `policyVersion` cuando aplique |

Eventos de denegación propuestos:

- `ADMISSION_OFFERING_PUBLICATION_DENIED` con reason code, sin cifras familiares ni
  contenido sensible;
- `ACTIVITY_POLICY_MUTATION_DENIED`;
- `ACTIVITY_OPERATION_POLICY_DENIED`.

No se registran nombres, emails, documentos, resultados de actividad ni textos libres
en metadata. Actor, effective actor, tenant, purpose, correlation ID y resource ID usan
el contrato de `AuditEvent`. Las denegaciones que ocurran después de rollback deben usar
el sink duradero externo a la transacción fallida; no se declara auditado un evento que
fue revertido junto con la operación.

## Contratos API propuestos

### Capacity/readiness

| Método y ruta | Capability | Semántica |
| --- | --- | --- |
| `GET /admin/tenants/:tenantId/offerings/:offeringId/readiness` | `admission.config.read` | Devuelve lifecycle, `capacityState`, versiones y blockers canónicos |
| `POST /admin/tenants/:tenantId/offerings/:offeringId/publish` | `admission.config.manage` + CSRF | Requiere `expectedOfferingVersion`; transición DRAFT→PUBLISHED |
| `POST /admin/tenants/:tenantId/offerings/:offeringId/close` | `admission.config.manage` + CSRF | Transición explícita a CLOSED |

Create/update de offering dejan de aceptar transiciones de lifecycle. Durante una fase
de compatibilidad pueden seguir aceptando el campo `status`, pero sólo `DRAFT` o el
estado actual; solicitar `PUBLISHED` retorna `OFFERING_EXPLICIT_PUBLISH_REQUIRED`.

Respuesta readiness ilustrativa, sólo sintética:

```json
{
  "offeringId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "offeringVersion": 3,
  "capacityState": "CAPACITY_CONFIGURED_ZERO",
  "capacityVersion": 1,
  "publishable": true,
  "blockers": []
}
```

### Activity policy

| Método y ruta | Capability | Semántica |
| --- | --- | --- |
| `GET /admin/tenants/:tenantId/activity-policies` | `activity.policy.read` | Lista las policies/readiness por kind |
| `GET /admin/tenants/:tenantId/activity-policies/:kind` | `activity.policy.read` | Devuelve default, primary/backup minimizados y blockers |
| `PUT /admin/tenants/:tenantId/activity-policies/:kind` | `activity.policy.manage` + CSRF | Create/update atómico; update exige `expectedVersion` |

Body propuesto:

```json
{
  "defaultDurationMinutes": 30,
  "primaryMembershipId": "11111111-1111-4111-8111-111111111111",
  "backupMembershipId": "22222222-2222-4222-8222-222222222222",
  "expectedVersion": 2
}
```

Los IDs son sintéticos. Para create, `expectedVersion` se omite; una policy existente
produce conflicto. Para update es obligatorio.

### Activity versions y scheduling

1. `durationMinutes` se vuelve opcional en create/update DRAFT.
2. El DTO agrega `durationSource` y, sólo para staff autorizado, `policyVersion` usada.
3. Publish agrega reason codes de policy readiness.
4. Schedule/reprogram/repeat conserva `assignedUserId`, pero valida que corresponda al
   primary/backup actual bajo lock transaccional.

## UI propuesta

### Ofertas/capacidad

1. Crear offering sólo como DRAFT.
2. Mostrar tres badges inequívocos: `Sin capacidad configurada`, `Capacidad configurada:
   0` y `Capacidad configurada`.
3. No mostrar el número exacto en UI familiar; el valor numérico continúa limitado a
   staff autorizado.
4. Deshabilitar `Publicar` cuando falte capacity y presentar el blocker accionable
   “Configura una capacidad explícita; 0 es válido si esa es la decisión institucional”.
5. Antes de publicar, modal accesible con lifecycle, capacity state y conflicto de
   versión; no promete disponibilidad por inferencia.

### Políticas de actividad

1. Panel por kind con default actual, source, primary, backup, readiness y versión.
2. Selectores cargados desde memberships activas elegibles; no inputs libres de UUID en
   la experiencia final.
3. Impedir seleccionar la misma membership en ambos roles.
4. Proponer 30/60 al crear la policy, marcado como “valor inicial editable”.
5. El formulario de versión permite “Usar default institucional” o “Override para esta
   versión”; siempre muestra el valor que quedará persistido.
6. Publish y schedule muestran blockers específicos de policy, sin revelar personas de
   otro tenant.
7. Cambiar primary/backup muestra citas futuras potencialmente afectadas, exige
   confirmación y no reescribe historial automáticamente.

## Matriz de pruebas requerida

### Dominio — capacity y publicación

| ID | Caso esperado |
| --- | --- |
| `R5-CAP-01` | Crear offering con `PUBLISHED` es rechazado; queda sin fila o DRAFT según comando |
| `R5-CAP-02` | DRAFT sin capacity no puede publicarse |
| `R5-CAP-03` | Capacity 0 permite publish y conserva `CAPACITY_CONFIGURED_ZERO` |
| `R5-CAP-04` | Capacity positiva permite publish |
| `R5-CAP-05` | Capacity 0 nunca emite asiento y retorna `NO_ADMISSION_SEAT_AVAILABLE` |
| `R5-CAP-06` | Discovery excluye PUBLISHED legacy sin capacity |
| `R5-CAP-07` | Familia nunca recibe cifra exacta ni estado `NOT_CONFIGURED` interno |
| `R5-CAP-08` | expectedOfferingVersion stale produce 409 sin mutación ni audit success |
| `R5-CAP-09` | Dos publishes concurrentes: uno success, uno conflicto; un solo audit success |
| `R5-CAP-10` | Abrir año/proceso falla si una offering PUBLISHED carece de capacity |

### Dominio — duración y policy

| ID | Caso esperado |
| --- | --- |
| `R5-DUR-01` | Inicialización propuesta de entrevista = 30 |
| `R5-DUR-02` | Inicialización propuesta de diagnóstico = 60 |
| `R5-DUR-03` | Tenant default modificado se usa cuando no hay override |
| `R5-DUR-04` | Override de versión tiene precedencia |
| `R5-DUR-05` | Cambiar tenant default no cambia versión publicada ni cita existente |
| `R5-DUR-06` | Valores 0, negativos, fraccionarios o >1440 fallan |
| `R5-DUR-07` | Clonado y eliminación de override resuelven source correctamente |
| `R5-POL-01` | Primary = backup falla |
| `R5-POL-02` | Membership inactiva o futura/vencida falla readiness |
| `R5-POL-03` | Usuario inactivo falla readiness |
| `R5-POL-04` | Falta `activity.perform` falla readiness |
| `R5-POL-05` | Update con versión stale falla sin overwrite |
| `R5-POL-06` | Publish de actividad sin policy ready falla |
| `R5-POL-07` | Schedule a actor fuera de primary/backup falla |
| `R5-POL-08` | Primary y backup válidos pueden recibir nuevas citas |
| `R5-POL-09` | Cambio de policy no reescribe appointment histórico |
| `R5-POL-10` | Ejecutor snapshot aún requiere membership/capability activa al perform |

### API HTTP

| ID | Caso esperado |
| --- | --- |
| `R5-HTTP-01` | 401 sin sesión en endpoints R5 |
| `R5-HTTP-02` | 403 sin membership/capability |
| `R5-HTTP-03` | 403 por CSRF inválido en mutaciones |
| `R5-HTTP-04` | 400 para schema/body estricto inválido |
| `R5-HTTP-05` | 409 capacity/policy/offering version conflict con code estable |
| `R5-HTTP-06` | Tenant B no puede leer ni mutar offering/policy A |
| `R5-HTTP-07` | Readiness diferencia ausencia y cero |
| `R5-HTTP-08` | Activity DTO expone duration source sólo a audiencia autorizada |

### UI/browser y accesibilidad

| ID | Caso esperado |
| --- | --- |
| `R5-WEB-01` | Flujo DRAFT → capacity 0 → publish completo en navegador |
| `R5-WEB-02` | Publish bloqueado sin capacity con foco/mensaje accionable |
| `R5-WEB-03` | Staff distingue visual y semánticamente 0 de ausencia |
| `R5-WEB-04` | Familia no ve cifra exacta |
| `R5-WEB-05` | Crear policy con baseline 30/60 y modificarlo |
| `R5-WEB-06` | Primary/backup iguales se impiden y explican |
| `R5-WEB-07` | Flujo default vs override muestra valor/source resuelto |
| `R5-WEB-08` | Navegación por teclado, foco, labels, modal y live errors pasan axe/WCAG 2.2 AA |
| `R5-WEB-09` | 360/768/1280 px y zoom 200% sin pérdida de tarea |

### RLS y cross-tenant

| ID | Caso esperado |
| --- | --- |
| `R5-RLS-01` | Tenant A sólo lista sus policies |
| `R5-RLS-02` | Sin GUC tenant, SELECT = 0 rows |
| `R5-RLS-03` | INSERT con tenant ajeno falla WITH CHECK |
| `R5-RLS-04` | UPDATE/DELETE cross-tenant afecta 0 rows |
| `R5-RLS-05` | FK rechaza primary/backup membership de tenant B |
| `R5-RLS-06` | Pool reuse concurrente no filtra policy entre tenants |
| `R5-RLS-07` | `admission_app` no tiene BYPASSRLS/owner y FORCE está activo |
| `R5-RLS-08` | Grants son exactamente SELECT/INSERT/UPDATE/DELETE sobre tabla R5 |

### Migración y compatibilidad

| ID | Caso esperado |
| --- | --- |
| `R5-MIG-01` | Fresh 0→20 PASS |
| `R5-MIG-02` | Incremental 19→20 PASS |
| `R5-MIG-03` | Checksums/contenido de Migration 17, 18 y 19 intactos |
| `R5-MIG-04` | Todas las versiones legacy quedan `VERSION_OVERRIDE` sin cambiar minutos |
| `R5-MIG-05` | Offerings legacy conservan lifecycle; discovery fail-closed si falta capacity |
| `R5-MIG-06` | No se crean policies, personas, capacities ni datos institucionales |
| `R5-MIG-07` | Enum, columnas, FKs, checks, índices, RLS/FORCE/policy/grants sellados |
| `R5-MIG-08` | Migración ejecutada con dataset sintético representativo y plan de recovery |

La regresión final debe incluir `pnpm test`, `pnpm test:rls`, smoke 0→20 e incremental,
format, lint, typecheck, build, secretos y dependencias. Ningún PASS técnico autoriza
datos reales o piloto.

## Compatibilidad con migraciones 17–19 y datos existentes

1. Migration 17, 18 y 19 permanecen byte-inmutables.
2. Migration 20 es forward-only y aditiva; no inventa down migration destructiva.
3. Las versiones de actividad existentes conservan exactamente su duración y reciben
   `VERSION_OVERRIDE` porque el contrato histórico exigía valor explícito.
4. Las offerings existentes conservan estado y reciben `concurrencyVersion = 1`.
5. Una offering legacy PUBLISHED sin capacity no se autocierra ni recibe capacity 0:
   queda visible en readiness administrativo y oculta en discovery hasta decisión
   explícita.
6. Una activity version legacy publicada sin policy sigue siendo legible e histórica;
   nuevas publicaciones, pinning y scheduling quedan fail-closed hasta configurar
   primary, backup y default.
7. Las citas existentes no cambian assigned user ni duración.
8. Fixtures y pruebas se actualizan únicamente con IDs/personas/capacidades sintéticas.

## Datos sintéticos

Las pruebas deben usar al menos dos tenants sintéticos, memberships distintas y valores
de capacity como `0`, `1` y `2`. No se usarán nombres, emails, capacidades o asignaciones
reales del colegio. Los ejemplos UUID de este documento son sintéticos y no representan
usuarios existentes.

Migration 20 no contiene seed. La configuración prepiloto real sólo puede cargarse
después de aprobación institucional, legal/privacidad y autorización explícita del
ambiente y datos.

## Riesgos residuales

1. El scope tenant+kind puede resultar insuficiente si se aprueba configuración por sede
   o periodo.
2. Pair-only puede requerir evolución a roster sin que este diseño lo autorice.
3. R5 no valida coherencia entre cifra de capacity y `availabilityCategory`; esa matriz
   permanece como decisión separada.
4. Ocultar legacy inconsistente protege a familias, pero exige un dashboard/runbook para
   que operaciones lo remedie antes de abrir convocatoria.
5. Membership/capability puede cambiar después de policy; por eso readiness debe
   revalidarse en cada boundary crítico y no almacenarse como boolean confiable.
6. G5-EXIT-10..12, LP3, providers y autorización real continúan bloqueando producción
   aunque R5 se implemente y pruebe.

## Fuera de alcance

- personas, capacities o fechas reales;
- roster N:N, turnos, disponibilidad horaria o sustitución automática;
- derivar disponibilidad pública desde capacity;
- optimización automática de agenda;
- nuevas modalidades o nuevos `ActivityDefinitionKind`;
- email, SMS, WhatsApp o proveedores;
- retención legal, Q-106 final o cierre de artefactos LP3;
- integración ejecutable EduPay, tablas compartidas o dependencias directas;
- staging/production, datos reales o autorización G5.

## Bloque de decisión humana

### Aprobado para implementación con datos sintéticos

Se solicita decisión explícita sobre el siguiente paquete indivisible:

| ID | Decisión propuesta | Estado |
| --- | --- | --- |
| `R5-D-001` | Crear offering sólo DRAFT y publicar mediante comando explícito | `APPROVED` |
| `R5-D-002` | Ausencia de capacity bloquea; capacity 0 es configuración válida pero nunca unlimited | `APPROVED` |
| `R5-D-003` | No derivar `availabilityCategory` desde capacity en R5 | `APPROVED` |
| `R5-D-004` | Persistir policy por tenant+kind con default y primary/backup | `APPROVED` |
| `R5-D-005` | Precedencia override > tenant/kind default > baseline de inicialización 30/60 | `APPROVED` |
| `R5-D-006` | Limitar nuevas citas a primary/backup en el MVP R5 | `APPROVED` |
| `R5-D-007` | Agregar `activity.policy.read/manage`; primary/backup requieren `activity.perform` | `APPROVED` |
| `R5-D-008` | Compatibilidad legacy fail-closed sin backfill institucional | `APPROVED` |
| `R5-D-009` | Autorizar el scope técnico exacto de Migration 20 descrito aquí | `APPROVED` |

Resultado solicitado al aprobador:

- [x] `APPROVE R5-D-001..009 AS WRITTEN`
- [ ] `APPROVE WITH CHANGES` — adjuntar cambios por ID
- [ ] `REJECT / RETURN TO DESIGN`

| Campo | Valor a completar por aprobación humana |
| --- | --- |
| Aprobador(es) | Usuario responsable del repositorio, aprobación expresa en tarea Codex |
| Fecha y zona | `2026-08-24 / America/Santiago` |
| Commit revisado | `6b51665` |
| Excepciones/riesgos aceptados | Ninguna excepción; persisten los riesgos residuales declarados |
| `MIGRATION_20_AUTHORIZED` | `YES / SYNTHETIC DATA ONLY` |
| Implementación PRG-01/PC1-R5 | `AUTHORIZED / SYNTHETIC DATA ONLY` |

Esta aprobación desbloquea únicamente la implementación y verificación técnica de
`PC1-TECH-013..015`. `G5 = NO APROBADA / NOT REQUESTED` y datos reales, piloto,
producción, proveedores, infraestructura e integración técnica EduPay continúan
`NOT AUTHORIZED`.
