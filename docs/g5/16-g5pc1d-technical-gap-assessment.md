# G5-PC1D — Evaluación técnica de gaps del piloto y Q-106

## Resultado y método

`G5-PC1D = PILOT_CONFIGURATION_POLICY_DEFINED / TECHNICAL_GAP_ASSESSMENT_COMPLETE`.

La evaluación inspeccionó el runtime real, Prisma/migraciones, API, web, servicios de
dominio, autorización/RLS, configuración y tests existentes. Las decisiones aprobadas
se encuentran en [`15-g5pc1-pilot-configuration-and-q106-decisions.md`](15-g5pc1-pilot-configuration-and-q106-decisions.md).

No se implementó ninguna remediación. No se modificaron schema, migraciones, código,
tests, dependencias, workflows ni providers. `MIGRATION_17_AUTHORIZED = NO`.

Los estados y fuerzas de evidencia usan exactamente el vocabulario autorizado:

- Estado: `IMPLEMENTED`, `PARTIAL`, `NOT_IMPLEMENTED`, `CONFIGURATION_ONLY`,
  `EVIDENCE_GAP`, `NOT_APPLICABLE`.
- Evidencia: `DIRECT_RUNTIME`, `DIRECT_TEST`, `INDIRECT`, `DOCUMENT_ONLY`, `NONE`.

`IMPLEMENTED` exige evidencia runtime/test directa; una decisión documental sola no
se clasifica como implementada.

## Matriz ejecutiva

| ID | STATUS | EVIDENCE_STRENGTH | PRIORITY |
| --- | --- | --- | --- |
| `PC1-TECH-001` | `NOT_IMPLEMENTED` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-002` | `NOT_IMPLEMENTED` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-003` | `NOT_IMPLEMENTED` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-004` | `NOT_IMPLEMENTED` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-005` | `NOT_IMPLEMENTED` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-006` | `NOT_IMPLEMENTED` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-007` | `PARTIAL` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-008` | `PARTIAL` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-009` | `PARTIAL` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-010` | `PARTIAL` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-011` | `PARTIAL` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-012` | `PARTIAL` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-013` | `NOT_IMPLEMENTED` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-014` | `PARTIAL` | `DIRECT_RUNTIME` | `P0_PREPILOT` |
| `PC1-TECH-015` | `PARTIAL` | `DIRECT_RUNTIME` | `P0_PREPILOT` |

### Conteo por estado

| Estado | Total |
| --- | ---: |
| `IMPLEMENTED` | 0 |
| `PARTIAL` | 8 |
| `NOT_IMPLEMENTED` | 7 |
| `CONFIGURATION_ONLY` | 0 |
| `EVIDENCE_GAP` | 0 |
| `NOT_APPLICABLE` | 0 |

Los quince items afectan la corrección o el boundary de operación piloto; por eso los
no implementados/parciales se priorizan `P0_PREPILOT`. Esto no autoriza el piloto.

## Detalle por item

### PC1-TECH-001 — Modelo de autoridad Q-106

**Estado:** `NOT_IMPLEMENTED` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/prisma/schema.prisma` contiene
  `PlatformUser.emailVerifiedAt`, `FamilyProfile`, `Student`, `Application` y
  `AssistanceSession`, pero no relationship, authority basis, authority status,
  evidence, reviewer, review timestamp, reason ni version/history de autoridad.
  `packages/database/src/account-registration.ts` sólo verifica el email/cuenta.
  `packages/database/src/assistance.ts` y `AssistanceSession` registran presencia y
  autorización operativa de flujo asistido, no autoridad Q-106.
- **Comportamiento:** no existen conceptos persistentes o derivados equivalentes a
  `AUTHORITY_DECLARED`, `AUTHORITY_VERIFIED` o `AUTHORITY_DISPUTED`; tampoco el
  vocabulario aprobado de relationship/basis.
- **Tests:** account-registration cubre challenge/email verification; forms/assistance
  cubren autorización asistida. No hay test directo de Q-106, evidencia, revisión,
  disputa, historial o cross-tenant authority.
- **Boundary y tenant/authz:** la cuenta activa habilita contextos familiares y
  permisos de aplicación, pero no una autorización separada por estudiante/tenant.
  Cualquier futura autoridad debe estar tenant-scoped, purpose-scoped, role/capability
  controlled y protegida por RLS.
- **Datos sensibles:** la ausencia de autoridad separada permite confundir una señal de
  cuenta con autorización sobre datos de menores o altamente restringidos.
- **Impacto:** schema `YES`; Migration 17 probablemente `YES`; backend `YES`;
  frontend `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** diseñar y aprobar el modelo tenant-bound de relación, base,
  estados, evidencia, revisión, razón e historial, más contratos y controles. No se
  implementa en PC1D.

### PC1-TECH-002 — Gating de final submission

**Estado:** `NOT_IMPLEMENTED` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/src/forms.ts`,
  `submitApplication`/`submitApplicationCore`, valida ownership familiar,
  permisos `application.submit`, respuestas, documentos y actividades antes de
  `Application.status = SUBMITTED`. `apps/api/src/form.controller.ts` expone el
  endpoint familiar.
- **Comportamiento:** no consulta authority status, evidence, reviewer ni adult-student
  authority. Una familia con cuenta activa puede alcanzar submit si satisface las
  validaciones actuales.
- **Tests:** `packages/database/src/forms.integration.spec.ts` y tests HTTP prueban
  readiness, snapshot, ownership y envío normal; no hay rechazo por autoridad no
  verificada/disputada.
- **Boundary y tenant/authz:** el boundary actual es cuenta/contexto familiar y
  `application.submit`; no hay permiso separado para authority declaration/review.
- **Datos sensibles:** el submit fija un snapshot y puede incluir campos
  `restricted`/`highly_restricted` sin gating Q-106.
- **Impacto:** schema `YES/UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`;
  frontend `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** aplicar precondición de autoridad verificada para menores y
  ruta propia de adulto >=18 en todos los entry points, incluida ruta asistida.

### PC1-TECH-003 — Gating de tratamiento sensible

**Estado:** `NOT_IMPLEMENTED` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/src/forms.ts` permite `internal`,
  `restricted` y `highly_restricted`; autorización usa permisos, purpose y
  sensitivity. No existe guard Q-106 para tratamiento sensible no verificado.
- **Comportamiento:** `FormField.sensitivity` y requisitos documentales controlan
  sensibilidad técnica, no relación/base/estado de autoridad.
- **Tests:** `forms.integration.spec.ts` tiene el campo sintético
  `optional_nee_support` con sensibilidad alta y controles genéricos; no prueba
  `UNVERIFIED AUTHORITY + SENSITIVE PROCESSING = BLOCK`.
- **Boundary y tenant/authz:** protección actual por permiso/scope/purpose dentro del
  tenant; no por autoridad sobre el estudiante.
- **Datos sensibles:** afecta datos de menores y categorías `highly_restricted`.
- **Impacto:** schema `YES/UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`;
  frontend `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** definir enforcement antes de lecturas/escrituras sensibles y
  cubrir forms, documents, activities y rutas asistidas.

### PC1-TECH-004 — Camino de estudiante adulto >=18

**Estado:** `NOT_IMPLEMENTED` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `Student` no tiene `dateOfBirth`, edad derivada, actor owner
  ni authority subject. `FamilyProfile` y `Application.familyProfileId` modelan
  familia/postulación, no estudiante adulto como sujeto autorizado.
- **Comportamiento:** no se distingue menor versus adulto; no existe self-authorization,
  submit propio, aceptación propia ni handoff propio.
- **Tests:** fixtures de intake/forms usan estudiantes sintéticos ligados a familia;
  no hay test de `STUDENT_AGE >= 18`.
- **Boundary y tenant/authz:** no hay actor/subject adulto; un responsable o miembro
  familiar no prueba autoridad propia del estudiante.
- **Datos sensibles:** una extensión debe evitar que `RESPONSIBLE_ADULT` reemplace al
  estudiante adulto.
- **Impacto:** schema `YES/UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`;
  frontend `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** resolver edad desde fuente aprobada, representar subject/actor
  adulto y aplicar la regla en datos, submit, offer acceptance y handoff. La decisión
  de almacenar DOB queda fuera de PC1D.

### PC1-TECH-005 — Authority check en offer acceptance

**Estado:** `NOT_IMPLEMENTED` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/src/capacity-offer.ts`,
  `acceptOffer`/`respondToOffer`, valida pertenencia familiar, oferta activa/no
  expirada y reserva; crea `OfferAcceptance.actorId` con actor familiar. El modelo
  `OfferAcceptance` no relaciona autoridad verificada ni estudiante adulto.
- **Comportamiento:** un adulto familiar activo puede aceptar si pasa ownership y
  estado de oferta; no se impone titular verificado ni self-authority >=18.
- **Tests:** `capacity-offer.integration.spec.ts` y HTTP prueban reserva, expiración,
  aceptación/declinación e idempotencia; no hay test de adulto disputado/no verificado.
- **Boundary y tenant/authz:** endpoint/web es familiar y usa actor/tenant; falta
  precondición de authority por aplicación/estudiante.
- **Datos sensibles:** aceptación produce consecuencia operacional y no debe originarse
  en contacto no verificado.
- **Impacto:** schema `YES/UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`;
  frontend `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** centralizar check de autoridad menor y self-authority adulto,
  incluida disputa e idempotencia.

### PC1-TECH-006 — Authority/adult check en handoff

**Estado:** `NOT_IMPLEMENTED` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/src/functional-handoff.ts`,
  `requestFunctionalHandoff`, exige `SUBMITTED`, oferta aceptada, permiso
  `application.handoff.request` y contexto staff; crea `IntegrationHandoff`.
  `apps/api/src/functional-handoff.controller.ts` expone el boundary staff.
- **Comportamiento:** no consulta autoridad verificada, adulto estudiante ni identidad
  del aceptante; permite handoff tras submit/acceptance existentes.
- **Tests:** functional-handoff tests cubren estados, permisos, tenant/RLS y aceptación;
  no cubren autoridad disputada/no verificada ni adulto >=18.
- **Boundary y tenant/authz:** hay tenant/RLS y permiso staff, pero falta vínculo entre
  handoff y subject autorizado. El modelo local no prueba integración externa EduPay.
- **Datos sensibles:** handoff es transición operativa y debe bloquearse sin autoridad.
- **Impacto:** schema `YES/UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`;
  frontend `NO/YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** exigir `VERIFIED` o actor adulto propio antes de crear
  handoff y rechazar disputa/no verificación.

### PC1-TECH-007 — Business calendar

**Estado:** `PARTIAL` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/src/documents.ts` exporta
  `BusinessCalendar` y `DevelopmentBusinessCalendar.addBusinessDays`; salta
  sábado/domingo con `setUTCDate`. No hay exclusiones, `America/Santiago` ni DST.
- **Comportamiento:** weekdays-only implementado; cierres/feriados configurables no.
  Conserva la hora del `Date` de entrada.
- **Tests:** `capacity-offer.integration.spec.ts` y `documents.integration.spec.ts`
  ejercitan fechas sintéticas; no hay excluded dates, DST ni presentación local.
- **Boundary y tenant/authz:** calendario global/development, no tenant-configured;
  futuro calendario institucional debe aislarse por tenant y auditarse.
- **Datos sensibles:** errores de plazo afectan ofertas/correcciones.
- **Impacto:** schema `UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`; frontend
  `YES`; API `YES`; tests `YES`; configuración sola `NO` para exclusiones runtime.
- **Remediación mínima:** calendario tenant/configurable, zona explícita y pruebas de
  fin de semana, exclusión y DST.

### PC1-TECH-008 — Tres días hábiles y expiración 23:59

**Estado:** `PARTIAL` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/src/capacity-offer.ts` usa
  `DEFAULT_OFFER_VALIDITY_BUSINESS_DAYS = 3` y calcula
  `expiresAt = calendar.addBusinessDays(input.issuedAt, days)`. Document correction
  en `packages/database/src/documents.ts` reutiliza el concepto.
- **Comportamiento:** no cuenta emisión como día 1 al sumar días, pero conserva hora de
  emisión; no normaliza a 23:59 de `America/Santiago` ni usa exclusiones. Viernes a
  las 15:00 no queda automáticamente miércoles 23:59 local.
- **Tests:** capacity/documents cubren suma y expiración; no hay test de hora local,
  exclusión y DST.
- **Boundary y tenant/authz:** `offerValidityBusinessDays` es capacidad; zona y corte
  no están persistidos/configurados.
- **Datos sensibles:** expiración incorrecta afecta integridad de postulaciones y
  comunicaciones.
- **Impacto:** schema `YES/UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`;
  frontend `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** usar next-business-day, resolver `America/Santiago`,
  normalizar day 3 a 23:59 local y reutilizar semántica en correcciones.

### PC1-TECH-009 — Reminder un día hábil antes

**Estado:** `PARTIAL` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/src/communications.ts` tiene
  `prepareOfferReminderCommunication` y `CommunicationPurpose.OFFER_REMINDER`; crea
  comunicación preparada e idempotente para oferta activa. No calcula lead time,
  ventana 10:00 ni zona local.
- **Comportamiento:** hay preparación/supresión, no scheduler/worker que dispare una
  jornada hábil antes. `Communication` no persiste sender, `scheduledAt` ni target
  time; el worker actual procesa documentos y expiración.
- **Tests:** `communications.integration.spec.ts` cubre preparación y supresión para
  oferta aceptada/retirada; no prueba lead time, calendario, zona, 10:00 o entrega.
- **Boundary y tenant/authz:** preparación tenant-scoped con destinatario familiar;
  futura programación debe conservar tenant/purpose y no agregar WhatsApp/SMS.
- **Datos sensibles:** destinatario y cuerpo son datos personales; provider productivo
  y mailbox no se seleccionan en PC1.
- **Impacto:** schema `YES/UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`;
  frontend `NO/YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** reutilizar calendario/expiresAt, calcular lead, ejecutar
  ventana configurada y probar idempotencia.

### PC1-TECH-010 — Health disabled by default

**Estado:** `PARTIAL` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** no hay modelo/catálogo de salud dedicado. El builder de
  `FormField` en `packages/database/src/forms.ts` permite sensibilidad/purpose; la
  web (`apps/web/app/form-workflows.tsx`) lo expone. No hay catálogo de salud
  deshabilitado por policy.
- **Comportamiento:** la ausencia de campo dedicado no impide crear campo genérico
  sensible. No es cumplimiento `disabled-by-default` policy-level.
- **Tests:** no hay test de rechazo de health fields, catálogo default o excepción.
- **Boundary y tenant/authz:** builder requiere permiso admin tenant, pero no capability
  específica de salud ni aprobación excepcional.
- **Datos sensibles:** salud de menores requiere minimización y bloqueo por defecto;
  `highly_restricted` no sustituye la regla.
- **Impacto:** schema `UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`; frontend
  `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** deny-by-default policy-level y excepción auditada; no se
  activan campos en PC1D.

### PC1-TECH-011 — PIE/NEE diagnosis/clinical disabled by default

**Estado:** `PARTIAL` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** no hay modelo/catálogo PIE/NEE. `forms.integration.spec.ts`
  contiene fixture sintético `optional_nee_support` de alta sensibilidad y el builder
  permite campos arbitrarios. No hay guard que distinga diagnóstico clínico.
- **Comportamiento:** se puede representar PIE/NEE por metadata genérica, pero no se
  impone que permanezca disabled-by-default.
- **Tests:** el fixture prueba capacidad genérica; no prueba prohibición, activation,
  propósito mínimo o excepción auditada.
- **Boundary y tenant/authz:** permisos admin y sensitivity no bastan; faltan
  capability/purpose y revisión excepcional tenant-scoped.
- **Datos sensibles:** puede involucrar salud/necesidades educativas de menores.
- **Impacto:** schema `UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`; frontend
  `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** catálogo explícito deny-by-default, activation gate,
  propósito, rol y audit trail.

### PC1-TECH-012 — Personality report disabled/configurable by course

**Estado:** `PARTIAL` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `DocumentRequirement`/`DocumentRequirementVersion` en
  `schema.prisma` soportan code, purpose, required, sensitivity, condiciones y scope
  por año/proceso/curso/oferta. `DocumentService` crea/publica requisitos y
  `pinDocumentRequirements` fija versiones. No existe `DOC-03` ni activation flag.
- **Comportamiento:** scope por curso permitiría configurar un requisito y, si no se
  publica ninguno, no hay requisito; el catálogo genérico permite crear/publicar sin
  policy específica de disabled default. Configurabilidad no es compliance.
- **Tests:** documents tests cubren versionado, scope y pinning; no prueban default
  disabled, activación aprobada ni excepción auditada.
- **Boundary y tenant/authz:** configuración tiene permisos admin y tenant scope;
  falta restricción de catálogo/purpose y aprobación específica.
- **Datos sensibles:** informe de personalidad/desarrollo puede ser sensible; no debe
  activarse por etiqueta libre ni confundirse con health.
- **Impacto:** schema `UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`; frontend
  `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** catálogo `DOC-03`, default disabled, activation por curso
  con audit/version y propósito.

### PC1-TECH-013 — Capacidad como precondición de publicación/open

**Estado:** `NOT_IMPLEMENTED` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/src/intake.ts` permite `AdmissionOffering`
  `PUBLISHED`; `listPublicOfferings` filtra status/año/proceso/form/disponibilidad.
  No exige `AdmissionCapacity`. `capacity-offer.ts` lanza
  `CAPACITY_NOT_CONFIGURED` sólo durante reserva/issuance.
- **Comportamiento:** una offering puede aparecer públicamente sin capacity. La
  capacidad es obligatoria al crear offer de decisión aprobada, no al abrir/publicar.
  `configuredCapacity = 0` se acepta y es distinto de ausencia.
- **Tests:** intake/HTTP prueban publicación/discovery; capacity prueba error al emitir;
  no existe test que intente publicar sin capacidad y espere rechazo.
- **Boundary y tenant/authz:** objetos y servicios son tenant/RLS scoped; falta
  invariación entre offering pública y capacity explícita.
- **Datos sensibles:** discovery puede exponer una oferta abierta sin capacidad; el
  impacto principal es integridad operativa.
- **Impacto:** schema `NO/UNKNOWN`; Migration 17 `NO/UNKNOWN`; backend `YES`;
  frontend `NO/YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** bloquear publicación/discovery operacional sin row explícita,
  distinguiendo ausencia de `0`, con cobertura de create/update/open y RLS.

### PC1-TECH-014 — Defaults de duración de actividades

**Estado:** `PARTIAL` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `packages/database/src/activities.ts` exige
  `durationMinutes` 1..1440; no deriva default por `ActivityDefinition.kind`.
  `apps/api/src/activity-schemas.ts` exige el número y
  `apps/web/app/activity-workflows.tsx` muestra input requerido.
- **Comportamiento:** duración es configurable/persistida; no hay default técnico de
  30 para entrevista ni 60 para diagnóstico. Fixtures usan valores explícitos distintos.
- **Tests:** activities integration/hardening/HTTP cubren validación, publicación y
  schedule con duración explícita; no prueban defaults aprobados.
- **Boundary y tenant/authz:** versiones son tenant-scoped y requieren permisos de
  gestión; falta defaults por institución/año.
- **Datos sensibles:** actividades/resultados pueden ser restringidos; el default
  incorrecto afecta operación.
- **Impacto:** schema `NO` si sólo default service/config; Migration 17 `NO/UNKNOWN`;
  backend `YES`; frontend `YES`; API `YES`; tests `YES`; configuración sola `PARTIAL`.
- **Remediación mínima:** defaults por kind/tenant, override explícito y pruebas 30/60.

### PC1-TECH-015 — Executor primary/backup

**Estado:** `PARTIAL` · **Evidencia:** `DIRECT_RUNTIME` · **Prioridad:** `P0_PREPILOT`.

- **Runtime observado:** `ActivityAppointment.assignedUserId` y
  `ActivityService.assertAssignedExecutor` exigen usuario activo con membership
  activa. Los IDs llegan por API; no hay nombres de Roxana, Arturo u otra persona
  hardcodeados. No existe backup assignment ni regla que impida operar sin executor.
- **Comportamiento:** executor concreto es configurable y se valida membership para
  operar/registrar resultado; no hay `primary + backup` por función crítica.
- **Tests:** activities integration/hardening/HTTP prueban assigned user, usuario
  incorrecto, membership y resultados; no prueban backup, failover o assignments
  institucionales completos.
- **Boundary y tenant/authz:** control tenant/membership directo; falta assignment
  policy con capability, primary, backup, escalamiento y auditoría.
- **Datos sensibles:** resultados pueden ser `highly_restricted`; sólo ejecutores
  autorizados deben operar y registrar.
- **Impacto:** schema `YES/UNKNOWN`; Migration 17 `UNKNOWN`; backend `YES`;
  frontend `YES`; API `YES`; tests `YES`; configuración sola `NO`.
- **Remediación mínima:** modelo/configuración tenant-scoped de función, capability,
  primary y backup; bloquear scheduling/operación cuando falte mínimo aprobado.

## Evaluación Q-106 específica

| Concepto requerido | Hallazgo runtime |
| --- | --- |
| `ACCOUNT_VERIFIED` | Existe como `PlatformUser.emailVerifiedAt`/estado activo después del challenge; es verificación de cuenta, no autoridad |
| `AUTHORITY_DECLARED` | No existe |
| `AUTHORITY_VERIFIED` | No existe |
| `AUTHORITY_DISPUTED` | No existe |
| Relationship | No existe en `FamilyProfile`, `Student` ni `Application` |
| Authority basis | No existe |
| Evidencia | No existe modelo/campo Q-106; asistencia registra evidencia operativa distinta |
| Reviewer/fecha/decisión/razón | No existe para autoridad; `AuditEvent` genérico no sustituye el modelo |
| Version/history | No existe para autoridad |
| Tenant isolation | La base general usa tenant contexts/RLS, pero no hay recurso authority que aislar |
| Audit | Existe `AuditEvent` genérico; no hay eventos/metadata de decisión Q-106 |
| Submit/sensitive/offer/handoff gates | No están vinculados a autoridad |

Conclusión: Q-106 tiene policy operacional definida en PC1/LP3, pero permanece
`DEFERRED / PILOT PRECONDITION`; implementación y procedimiento final siguen pendientes.

## Evaluación adulto >=18 específica

El runtime tiene `Student.givenName`/`familyName`, pero no DOB/edad, authority owner ni
actor propio. No se probó distinción menor/adulto, autorización de datos propios,
submit propio, acceptance propio ni handoff propio. Por tanto `PC1-TECH-004` es
`NOT_IMPLEMENTED`, no soporte inferido por la mera existencia de `Student`.

## Límites de configuración institucional

Configuración/input puede suplir valores concretos de duración, personas, capacidad,
fechas excluidas, mailbox, templates y activación de reportes sólo después de que
exista capacidad técnica de enforcearlos. No suple gaps de autoridad, adulto, gating,
calendar semantics, sensitive defaults, publication precondition ni auditoría.

## Remediation groups propuestos — sin implementación

| Grupo | TECH IDs | Módulos probables | Schema impact | Migration likely | Backend | Frontend | Tests | Dependencia institucional | Dependencia legal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PC1-R1 — Authority/Q-106 core` | 001, 002, 003 | `schema.prisma`; account-registration; forms; documents; activities; authz/context; audit; API | `YES/UNKNOWN` | `LIKELY YES/UNKNOWN` | `YES` | `YES` | `YES` | Procedimiento final, roles/capacidades y evidencia | `LP3-ART-006`, C-013 y validación legal |
| `PC1-R2 — Adult student >=18` | 004, 005, 006 | `schema.prisma`; intake/forms; capacity-offer; functional-handoff; API/web | `YES/UNKNOWN` | `LIKELY YES/UNKNOWN` | `YES` | `YES` | `YES` | Regla para contacto responsable y fuente de edad | `LP3-ART-006` y validación de menores |
| `PC1-R3 — Calendar, expiry and reminder` | 007, 008, 009 | documents; capacity-offer; communications; workers/outbox; config | `YES/UNKNOWN` | `UNKNOWN` | `YES` | `NO/YES` | `YES` | Fechas excluidas, mailbox, templates y ventana | Artefactos de notice/comunicaciones si aplica |
| `PC1-R4 — Sensitive/default catalogs` | 010, 011, 012 | forms/documents, builder web, catalog/config, audit | `UNKNOWN` | `UNKNOWN` | `YES` | `YES` | `YES` | Catálogo, activación por curso y excepciones | `LP3-ART-007/008`, C-013 |
| `PC1-R5 — Capacity and activity configuration` | 013, 014, 015 | intake; capacity-offer; activities; API/web; assignment config | `NO/UNKNOWN` | `NO/UNKNOWN` | `YES` | `YES` | `YES` | Capacidades, duraciones, primary/backups, evaluadores | Legal sólo si cambia sensibilidad |

Estas agrupaciones son propuestas para una etapa posterior; no autorizan implementación
ni Migration 17.

## Migration and scope decision

| Campo | Estado |
| --- | --- |
| Migration 16 | `INTACT` |
| Migration 17 | `ABSENT` |
| `MIGRATION_17_AUTHORIZED` | `NO` |
| `SCHEMA_REMEDIATION_REQUIRED` | `YES` para Q-106/adulto; `UNKNOWN` para calendario/catalogos/assignments hasta diseño; no se modifica schema |
| Runtime changes | `NONE` |
| Test changes | `NONE` |
| Provider/EduPay integration | `NONE`; no autorizado |

## Gate disposition

- `C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
- `Q-106 = DEFERRED / PILOT PRECONDITION`.
- `G5-EXIT-10 = BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD`.
- `G5-EXIT-11 = BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED`.
- `G5-EXIT-12 = BLOCKED`.
- `G5 = NO APROBADA / NOT REQUESTED`.
- `REAL DATA = NOT AUTHORIZED`.
- `PILOT = NOT AUTHORIZED`.
- `PRODUCTION = NOT AUTHORIZED`.

## Fuera de alcance y preguntas abiertas

No se eligieron documentos exactos para autoridad, proveedor/dirección de email,
feriados concretos, personas reales, capacidades, templates ni activación de DOC-03.
No se implementó ningún grupo `PC1-R*`. La siguiente acción humana es aprobar el
procedimiento/legal artifacts y, en una etapa separada, autorizar una remediación
técnica acotada.

## Addendum post-R12 — disposición factual (2026-08-16)

Este addendum conserva el assessment PC1D histórico y registra la implementación posterior
autorizada, con evidencia en [`17-g5pc1r12-authority-adult-core.md`](17-g5pc1r12-authority-adult-core.md).

| TECH | Estado post-R12 |
| --- | --- |
| `PC1-TECH-001`, `002`, `004`, `005`, `006` | `IMPLEMENTED / TECHNICALLY_REVIEWED` |
| `PC1-TECH-003` | `NOT_IMPLEMENTED / DEFERRED_TO_PC1-R4` |
| `PC1-TECH-007..015` | Sin cambio respecto de PC1D |

Migration 17 se limita a DOB nullable y autoridad/history/evidence con RLS; no introduce
backfill, gate sensible genérico, calendario, providers ni EduPay. `Q-106` no se cierra:
queda `TECHNICAL_CORE_IMPLEMENTED / FINAL_INSTITUTIONAL_LEGAL_PROCEDURE_PENDING /
PILOT_PRECONDITION`. `LP3-ART-006`, `C-013`, los exits y prohibiciones originales continúan.

## Addendum post-R3 — disposición factual (2026-08-21)

Este addendum registra la implementación de los grupos R4 y R3 autorizados, con evidencia en [`18-g5pc1r4-sensitive-processing-plan.md`](18-g5pc1r4-sensitive-processing-plan.md) y [`20-g5pc1r3-business-calendar-evidence.md`](20-g5pc1r3-business-calendar-evidence.md).

| TECH | Estado post-R3 | Evidencia / Observaciones |
| --- | --- | --- |
| `PC1-TECH-001`..`006` | `IMPLEMENTED / TECHNICALLY_REVIEWED` | Migration 17 (`g5pc1r12_authority_core`) + suite de integración y RLS |
| `PC1-TECH-003`, `010`, `011`, `012` | `IMPLEMENTED / TECHNICALLY_REVIEWED` | Migration 18 (`g5pc1r4_sensitive_processing`) + guards centrales + suite directa |
| `PC1-TECH-007` (Business calendar per tenant) | `IMPLEMENTED / TECHNICALLY_REVIEWED` | Migration 19 (`g5pc1r3_business_calendar`) + motor de calendario + RLS + API + UI |
| `PC1-TECH-008` (3-business-day offer & doc deadlines at 23:59) | `IMPLEMENTED / TECHNICALLY_REVIEWED` | Motor de cálculo civil + normalización 23:59:59.999 local en ofertas y subsanaciones |
| `PC1-TECH-009` (Offer reminder 1-day prior at 10:00 local) | `IMPLEMENTED / TECHNICALLY_REVIEWED` | Cálculo a las 10:00:00.000 local + outbox topic + OfferReminderWorker |
| `PC1-TECH-013`..`015` | `PARTIAL / NOT_IMPLEMENTED` | Fuera de alcance en R3; pendientes para etapas posteriores |

Migration 19 acotada estrictamente a `tenant_business_calendars` y `business_calendar_excluded_dates`.
Migration 20 ausente y no autorizada.
G5, datos reales, piloto, producción y EduPay permanecen `NOT AUTHORIZED`.

