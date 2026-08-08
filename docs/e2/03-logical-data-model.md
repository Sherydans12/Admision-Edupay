# Modelo lógico de datos

## Principios

- Modelo lógico, sin SQL, Prisma ni tipos físicos.
- Toda entidad institucional tiene `tenantId` directo o ownership derivable sin ambigüedad; para el MVP se prefiere materializarlo en raíces y registros sensibles.
- Referencias institucionales deben pertenecer al mismo tenant mediante constraints conceptuales compuestos.
- Versiones publicadas, snapshots, documentos, recomendaciones y decisiones no se sobrescriben.
- Identificadores públicos no constituyen autorización.
- `OfferAcceptance != Enrollment`, `IntegrationHandoff != Enrollment` y `AdmissionCapacity != EduPay academic capacity`.

## Identidad, tenant y soporte

| Entidad/agregado | Ownership/root | Referencias y versionado | Sensibilidad | Invariantes e índices/constraints conceptuales |
| --- | --- | --- | --- | --- |
| `PlatformUser` | Global; root de identidad | credenciales, verificaciones y sesiones | Personal/restringido | email normalizado único según política; estado y verificación; nunca concede tenant por sí solo |
| `FamilyAccount` | Global familiar; root | `PlatformUser`; relaciones familiares | Restringido | una cuenta familiar activa por identidad según política; acceso institucional sólo vía snapshot/postulación |
| `Institution` | Tenant-owned; root institucional | identidad legal/operacional del colegio | Interno | identidad institucional estable; no contiene reglas específicas en código |
| `Tenant` | Root de aislamiento | `Institution`; estado y configuración de plataforma | Interno/restringido | identificador estable; suspensión impide operación sin borrar historia |
| `Campus` | Tenant-owned; root de sede | `Tenant` | Interno | nombre/código único dentro de tenant; referencias sólo mismo tenant |
| `Membership` | Tenant-owned; root de pertenencia | `PlatformUser`, `Tenant`, vigencia | Restringido | usuario+tenant+vigencia sin solapamiento inválido; pertenencia no equivale a permiso |
| `RoleAssignment` | Tenant-owned; root/child de membership | rol, scopes, vigencia, otorgante | Restringido | otorgante no delega más de su límite; roles/scopes válidos y auditados |
| `SupportElevation` | Platform-scoped con tenant objetivo; root | actor, tenant, purpose, scopes, categorías, inicio/expiración | Altamente restringido | acceso sólo dentro de ventana y alcance; `SELF-ELEVATION` explícita; nunca elevación permanente |

## Configuración académica y oferta

| Entidad/agregado | Ownership/root | Referencias y versionado | Sensibilidad | Invariantes e índices/constraints conceptuales |
| --- | --- | --- | --- | --- |
| `AcademicYear` | Tenant-owned; root | tenant, calendario/versiones | Interno | código único por tenant; estado controla nuevas ofertas |
| `CourseLevel` | Tenant-owned o catálogo referenciado | nivel/código | Interno | mapeo inequívoco por tenant; catálogo global no concede ownership |
| `AdmissionProcess` | Tenant-owned; root | año, reglas y estado | Interno | proceso único por propósito/año según configuración; publicación versionada |
| `AdmissionOffering` | Tenant-owned; root | campus, año, curso, proceso, formulario/requisitos publicados | Interno/público proyectado | combinación tenant+campus+año+curso identificable; sólo publicada/vigente recibe postulaciones |

## Familia, estudiante y postulación

| Entidad/agregado | Ownership/root | Referencias y versionado | Sensibilidad | Invariantes e índices/constraints conceptuales |
| --- | --- | --- | --- | --- |
| `Student` | Global familiar; root | `FamilyAccount`; identidad declarada | Restringido/menor | no accesible por tenant sin postulación; coincidencias no fusionan automáticamente |
| `GuardianRelationship` | Global familiar; root/child | adulto, estudiante, facultad y vigencia | Restringido | la relación declarada no sustituye verificación/autorización; historial preservado |
| `Application` | Tenant-owned; root | offering, family, student y snapshots | Restringido | duplicidad por tenant+proceso+estudiante+oferta/curso según Q-101/Q-102; estado y desistimiento versionados; no cross-tenant |
| `ApplicationSnapshot` | Tenant-owned; child inmutable de `Application` | versión de perfil, estudiante, guardianes y formulario | Restringido/altamente restringido por campo | snapshot enviado no cambia con perfil; tenant y aplicación coherentes; clasificación heredada |

## Formularios dinámicos

| Entidad/agregado | Ownership/root | Referencias y versionado | Sensibilidad | Invariantes e índices/constraints conceptuales |
| --- | --- | --- | --- | --- |
| `FormDefinition` | Tenant-owned; root | propósito y versiones | Interno | identidad estable por tenant/propósito; no contiene código arbitrario |
| `FormVersion` | Tenant-owned; child versionado | definición, estado draft/published/archived | Interno; puede definir campos sensibles | número de versión único; publicada inmutable; una versión activa por contexto |
| `FormSection` | Tenant-owned; child de versión | orden y contenido seguro | Interno | orden único dentro de versión; contenido sanitizado |
| `FormField` | Tenant-owned; child de versión | tipo, validación, clasificación, propósito y condiciones | Interno/definición sensible | clave estable dentro de versión; operadores de catálogo cerrado; no JS/HTML activo |

## Documentos

| Entidad/agregado | Ownership/root | Referencias y versionado | Sensibilidad | Invariantes e índices/constraints conceptuales |
| --- | --- | --- | --- | --- |
| `DocumentRequirement` | Tenant-owned; root | proceso/curso/oferta/condición y versiones | Interno | identidad estable por tenant y propósito |
| `DocumentRequirementVersion` | Tenant-owned; child versionado | obligatoriedad, vigencia, equivalentes, formatos | Interno | publicada inmutable; número único por requisito; aplicabilidad evaluada contra snapshot |
| `DocumentSubmission` | Tenant-owned; root por aplicación+requisito | application, requirement version y versiones de archivo | Restringido | máximo un cumplimiento activo por aplicación/requisito; exención con actor/motivo |
| `DocumentVersion` | Tenant-owned; child | object key, hash, size, MIME, origen, estado scan | Altamente restringido | clave aleatoria única; hash/metadata inmutables; sólo versión aprobada puede revisarse/descargarse |
| `DocumentReview` | Tenant-owned; root/child append-only | document version, reviewer, dictamen, motivo | Restringido/deliberación | revisor autorizado; dictamen no sobrescribe; referencia versión exacta |

## Actividades

| Entidad/agregado | Ownership/root | Referencias y versionado | Sensibilidad | Invariantes e índices/constraints conceptuales |
| --- | --- | --- | --- | --- |
| `ActivityDefinition` | Tenant-owned; root versionado | tipo, aplicabilidad, modalidad, duración y ejecutor requerido | Interno | configuración publicada versionada; obligatoriedad no hardcodeada |
| `ActivityAppointment` | Tenant-owned; root/child de actividad de aplicación | aplicación, definición, horario, lugar, asignado | Restringido | no solapamiento según regla futura; reprogramación conserva cita anterior; tenant coherente |
| `ActivityAttempt` | Tenant-owned; root/child secuencial | appointment, anterior, actor, motivo y estado | Altamente restringido | secuencia única por actividad; primer/segundo no-show no cierra automáticamente; intentos inmutables |
| `ActivityResult` | Tenant-owned; child de intento | `FAVORABLE`, `NO_FAVORABLE`, `INCONCLUSO`, comentario | Altamente restringido | resultado separado del estado y decisión; nunca visible a familia; correcciones crean versión |

## Recomendación y decisión

| Entidad/agregado | Ownership/root | Referencias y versionado | Sensibilidad | Invariantes e índices/constraints conceptuales |
| --- | --- | --- | --- | --- |
| `AdmissionRecommendation` | Tenant-owned; root por aplicación | aplicación y versiones | Altamente restringido | una versión vigente enviada; no es disposición final |
| `AdmissionRecommendationVersion` | Tenant-owned; child append-only | opción, fundamento, autor, evidencia versionada | Altamente restringido | fundamento obligatorio; autor autorizado; versiones relacionadas |
| `DirectionDecision` | Tenant-owned; root por aplicación | aplicación y versiones | Altamente restringido | decisor no puede ser recomendador del mismo caso; disposición vigente identificable |
| `DirectionDecisionVersion` | Tenant-owned; child append-only | disposición, motivo/fundamento, decisor, versión de antecedentes | Altamente restringido | semántica cerrada; `DEVUELTO_A_REVISION` no es final; anterior nunca se reemplaza |

## Capacidad, espera y oferta

| Entidad/agregado | Ownership/root | Referencias y versionado | Sensibilidad | Invariantes e índices/constraints conceptuales |
| --- | --- | --- | --- | --- |
| `AdmissionCapacity` | Tenant-owned; root por offering | valor, ajustes y versión/concurrency token | Interno | valor no negativo; reservado/aceptado no excede capacidad; distinto de capacidad EduPay |
| `SeatReservation` | Tenant-owned; root | capacity, application, offer, estado y expiración | Interno/restringido | una reserva activa por aplicación/oferta; consumo atómico; tenant/oferta/aplicación coherentes |
| `WaitlistEntry` | Tenant-owned; root | aplicación, decisión, ingreso, estado y posición interna | Restringido | una entrada activa por aplicación/oferta; no oferta inmediata; posición no visible a familia |
| `WaitlistPrioritySnapshot` | Tenant-owned; child inmutable | entrada, regla versionada, factores y desempate | Altamente restringido | captura la regla aplicada; no se recalcula silenciosamente; prioridad opcional |
| `AdmissionOffer` | Tenant-owned; root | application, reservation, origen, emisión/expiración, estado | Restringido | oferta vigente requiere reserva; origen normal/espera; expiración o desistimiento libera reserva una vez; versiones/historia |
| `OfferAcceptance` | Tenant-owned; root/child de offer | adulto autorizado, instante y versión de términos | Restringido | sólo oferta vigente; una aceptación efectiva; no equivale a enrollment ni pago |

## Comunicación, auditoría e integración

| Entidad/agregado | Ownership/root | Referencias y versionado | Sensibilidad | Invariantes e índices/constraints conceptuales |
| --- | --- | --- | --- | --- |
| `Communication` | Tenant-owned; root | purpose, audience, template version, resource, estado | Restringido | `PREPARED` antes de envío; fallo no cambia negocio; contenido mínimo |
| `CommunicationAttempt` | Tenant-owned; child append-only | communication, provider ref, attempt, result | Personal/restringido | secuencia única; `DELIVERED` sólo con evidencia; errores sanitizados |
| `AuditEvent` | Tenant-owned o platform-scoped explícito; root append-only | actor/effective actor, purpose, resource, action, result, correlation | Restringido | no update/delete ordinario; timestamp confiable; metadata sin secretos/contenido innecesario |
| `IntegrationHandoff` | Tenant-owned; root | accepted offer, idempotency identity y versión futura de contrato | Restringido | sólo después de aceptación; no es enrollment; no tablas compartidas |
| `IntegrationSyncState` | Tenant-owned; child/root técnico | handoff, estado, intentos y error sanitizado | Interno | estado técnico no modifica por sí solo matrícula; transición monotónica/compensada según contrato futuro |

## Límites de agregados y consistencia

- `Application` mantiene snapshots y estado del expediente, pero documentos, actividades, decisión, capacidad y oferta son agregados separados con referencias estables.
- `AdmissionCapacity` serializa cambios de capacidad/reserva; `AdmissionOffer` no puede crear reserva por su cuenta.
- `DirectionDecision` produce un hecho; Capacity/Waitlist reaccionan dentro de una coordinación transaccional de aplicación cuando sea necesario.
- `Communication` y `IntegrationHandoff` se crean mediante outbox después de confirmar el negocio; sus fallos no revierten la disposición.
- `AuditEvent` es evidencia transversal y se escribe en la misma transacción cuando el evento acompaña una mutación crítica.

## Índices y constraints conceptuales transversales

- Índices comienzan por `tenantId` para consultas tenant-owned y añaden estado/fecha según acceso.
- Uniqueness institucional incluye `tenantId`; no existen claves únicas globales para códigos configurables del colegio.
- Referencias críticas usan identidad compuesta tenant+id o validación equivalente para impedir relaciones cruzadas.
- Tokens de versión/concurrencia protegen agregados mutables; snapshots/versiones append-only usan secuencia única.
- Claves de idempotencia son únicas por tenant, operación y propósito; datos personales no se usan como clave.
- Búsquedas por identidad se autorizan antes de revelar coincidencias y no permiten enumeración cross-tenant.

## Decisiones diferidas

Tipos físicos, particionamiento, índices concretos, naming, estrategia de migración y schema ejecutable pertenecen a E4 después de G2. Q-301 a Q-309 siguen abiertas para el contrato EduPay.
