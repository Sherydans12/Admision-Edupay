# G5-BR — Evidencia de remediación AC-001

## Resultado ejecutivo

Esta etapa correctiva implementa el recorrido público mínimo autorizado para `BL-002 /
FR-ID-001 / AC-001`: adulto sin cuenta → solicitud de registro → desafío por correo →
verificación → cuenta verificada → sesión segura. La evidencia se ejecuta con PostgreSQL
y Nest reales, usando únicamente identidades sintéticas y un adapter de correo de
desarrollo/test sin red ni proveedor productivo.

La implementación no aprueba G5. La compuerta continúa como `G5 = NO APROBADA /
NOT REQUESTED`. `Q-106 = DEFERRED / PILOT PRECONDITION` y `C-013 =
LEGAL_VALIDATION_PENDING`.

## Trazabilidad y alcance

| Elemento | Tratamiento |
| --- | --- |
| Fuente funcional | `UC-FAM-001`, `FR-ID-001`, `AC-001`, `E2E-001`, `BL-002` |
| Canal | `EMAIL`, con `DevelopmentIdentityEmailAdapter`; no se selecciona proveedor productivo |
| Control plane | `PlatformUser` y challenge son identidad global; el registro no requiere `TenantContext` |
| Autorización tenant | No se crea `Membership`, tenant, familia, estudiante ni permiso institucional |
| Q-106 | No se implementa identidad civil, parentesco, tutela ni facultad legal |
| Recuperación | `UC-FAM-002` sólo fue referencia; no se amplió el alcance a recuperación |
| Aceptaciones legales | No se creó subsistema ni texto legal; queda en `C-013/Q-201` |
| Proveedor | No se implementa SMTP, SMS, WhatsApp, telefonía ni OAuth |

## Modelo implementado

`PlatformUser.status` admite el estado mínimo `PENDING_VERIFICATION` además de los
estados existentes. La identidad usa `email_normalized` con unicidad durable. La
verificación exitosa fija `email_verified_at`, mueve la cuenta a `ACTIVE` y crea una
sesión usando `SessionService` existente; no se rediseñó la sesión ni su hash SHA-256.

`AccountVerificationChallenge` es una entidad global de control-plane con:

- `platform_user_id`, `purpose`, `normalized_channel_hash` y `verifier_hash`;
- `expires_at`, `consumed_at`, `superseded_at`, `attempts`, `last_attempt_at` y `created_at`;
- unicidad del verifier y un índice único parcial para un desafío activo por identidad;
- FK a `PlatformUser` con eliminación en cascada;
- grants mínimos de aplicación `SELECT/INSERT/UPDATE`, sin `DELETE` runtime;
- sin RLS tenant artificial: exigir tenant antes de registrar identidad global sería una
  mezcla incorrecta entre identidad de plataforma y autorización institucional. La
  frontera está justificada en E4 y el acceso tenant sólo aparece después de membership.

El secreto se genera con CSPRNG de 32 bytes, se entrega únicamente al adapter en memoria
de desarrollo/test y se persiste como `SHA-256(token)` en `verifier_hash`. La expiración
por defecto es de 900 segundos (`IDENTITY_VERIFICATION_TTL_SECONDS`), configurable sólo
técnicamente. El cooldown de reenvío por defecto es de 30 segundos
(`IDENTITY_REGISTRATION_COOLDOWN_SECONDS`). El consumo se realiza bajo lock transaccional
con `FOR UPDATE` y actualización condicional; un challenge consumido, expirado o
superseded no puede activar una segunda vez.

## Anti-enumeration y abuso

`POST /auth/register` usa el mismo `202`, forma de respuesta y clase de mensaje para
email nuevo, email existente, email pendiente, cooldown y reintento seguro. No devuelve
`PlatformUser.id`, estado interno, tenant, membership, nombre ni cantidad de hijos. La
normalización y la unicidad se resuelven server-side; los datos del body no pueden elegir
identidad, estado o permisos.

El endpoint no crea desafíos ilimitadamente para una identidad: el desafío anterior se
marca como superseded y existe cooldown. La respuesta no promete constant-time HTTP; se
revisó que no haya ramas estructurales de respuesta que revelen existencia. Los errores
de verificación son controlados y no incluyen token, correo completo ni estado interno.

## Boundary HTTP y UI

Se agregaron `POST /auth/register` y `POST /auth/verify` bajo el namespace existente de
auth, con schemas Zod strict. El registro y la verificación son públicos; la verificación
establece la cookie de sesión opaca con los atributos de `SessionService` existente.

La UI mínima está en `/register` y `/register/verify`: email, mensaje genérico de revisión
del correo, resultado, estados inválido/expirado/reintento, label accesible y enlace
explícito que separa `EMAIL_ACCOUNT_VERIFIED` de `GUARDIAN_RELATIONSHIP_VERIFICATION`.

## Auditoría y seguridad

Se registran solicitudes, éxito, activación y rechazos/expiración/replay con acciones
allowlisted. Email completo y token bruto no se incluyen en metadata; el identificador de
canal se minimiza mediante hash. Los eventos de seguridad de intento inválido, replay y
abuso excesivo siguen separados del `AuditEvent` durable.

Durante la integración HTTP se corrigió el camino global de `PrismaAuditSink` para usar
una inserción SQL parametrizada con `scope = PLATFORM_GLOBAL` y `tenant_id = NULL`.
Esto conserva la política RLS global y permite auditar registro antes de que exista una
membership, sin hacer pasar identidad de plataforma por autorización tenant.

## Matriz G5BR

La suite `packages/database/src/account-registration.integration.spec.ts` ejecuta con
PostgreSQL real los veinte identificadores `G5BR-ID-01..20`; todos resultaron `PASS`.
La suite `apps/api/src/account-registration.http.integration.spec.ts` ejecuta los ocho
identificadores `G5BR-HTTP-01..08`; todos resultaron `PASS`.

| Evidencia | Resultado | Nota |
| --- | --- | --- |
| `G5BR-ID-01..20` | `PASS` | Servicio real, constraints, auditoría, races y no escalamiento |
| `G5BR-HTTP-01..08` | `PASS` | Nest + PostgreSQL real, boundary público y family flow posterior |
| `AC001-DIRECT-01` | `PASS` | Alta y verify por HTTP; email existente conserva respuesta equivalente |
| `E2E-001-START-TO-BOUNDARY` | `PASS` | Verify → `/auth/csrf` → boundary existente `PUT /family/profile`; termina en handoff funcional local |
| `Q-106 separation` | `PASS` | Test explícito: email verificado no crea ni afirma relación guardian/estudiante |

`AC001-DIRECT-01` no usa seed directo para realizar el alta: parte de un email sintético,
llama al boundary público, toma el challenge del adapter de desarrollo y lo presenta al
endpoint público de verificación.

## Regresión y controles

| Control | Resultado |
| --- | --- |
| Suite general (`pnpm test`) | `451/451` tests, `34` archivos |
| Suite RLS (`pnpm test:rls`) | `46/46` tests, `5` archivos |
| `pnpm format:check` | `PASS` |
| `pnpm lint` | `PASS` |
| `pnpm typecheck` | `PASS` |
| `pnpm build` | `PASS` |
| `pnpm security:secrets` | `PASS` |
| `pnpm security:deps` | `PASS`, sin vulnerabilidades high conocidas |
| `docker compose config --quiet` | `PASS` |
| `git diff --check` | `PASS` |

## Migración y seals

Se creó exactamente una forward migration, sin editar las migrations 1..15:
`20260815090000_g5br_account_verification` (migration 16).

| Smoke | Resultado |
| --- | --- |
| `FRESH_0_TO_16` | `PASS` |
| `INCREMENTAL_15_TO_16` | `PASS` |
| `G5BR_IDENTITY_SEALS` | `PASS` — verifier hasheado, no token bruto, uniqueness, consumo, FK, grants y frontera global |
| E5-F historical smoke | `PASS` |
| E5-G historical smoke | `PASS` |
| E5-H historical smoke | `PASS` |
| E5-I historical smoke | `PASS` |

Los smokes E5-C/D/E/I fueron ajustados únicamente para seleccionar su prefijo histórico
de migrations y no tratar la migration 16 como una modificación de sus contratos.

## Clasificación de la información

### Hechos confirmados

- Existe un recorrido funcional de registro/verificación y una prueba HTTP directa.
- El challenge se almacena como hash/verifier, expira y se consume una sola vez.
- La unicidad y las carreras dependen de constraints/transacciones, no sólo de checks de aplicación.
- La cuenta no recibe membership ni acceso tenant al registrarse.
- El adapter de identidad de desarrollo no hace red ni representa un proveedor productivo.

### Decisiones aprobadas por esta etapa

- Usar email como canal MVP para AC-001.
- Mantener identidad global separada de autorización tenant.
- Reusar `SessionService` y su política existente.
- Mantener Q-106 fuera de esta implementación.

### Supuestos de trabajo

- Los valores de TTL y cooldown son defaults técnicos de development/test, no políticas
  institucionales ni SLA.
- La sesión posterior a verify es el login-equivalent permitido por la arquitectura
  existente; no se inventó una credencial adicional.
- La revisión humana aceptará la evidencia sintética antes de cualquier consideración de piloto.

### Preguntas abiertas

- Q-106: regla definitiva de identidad/relación y excepciones familiares.
- C-013: base legal, avisos, retención, eliminación, derechos y exportación.
- Proveedor productivo, monitoreo y operación de email.
- Valores concretos de piloto y autorización fechada.

## Clasificación propuesta y compuerta

| Elemento | Propuesta posterior a revisión humana |
| --- | --- |
| `G5-EXIT-01` | `PASS_WITH_RESIDUAL` por evidencia directa AC-001, con configuración/operación/legal aún abiertas |
| `G5-EXIT-02` | `PASS_WITH_RESIDUAL` por start-to-boundary de E2E-001, manteniendo el handoff local aprobado |
| `Q-106` | `DEFERRED / PILOT PRECONDITION` |
| `C-013` | `LEGAL_VALIDATION_PENDING` |
| `G5` | `NO APROBADA / NOT REQUESTED` |
| PR #8 | `OPEN / DRAFT / NO MERGE` |

La propuesta no es un cierre humano. La siguiente acción es revisar este documento, los
tests y el diff, y decidir si la evidencia satisface `G5-EXIT-01/02` sin convertirla en
aprobación de G5 ni en resolución de Q-106.

## Addendum G5-BR2 — recovery passwordless

La etapa posterior `G5-BR2` no reabre AC-001. Inspeccionó el caso alternativo de
`UC-FAM-001` y `UC-FAM-002` para una cuenta ya `ACTIVE` y confirmó que el boundary
existente también funciona como recuperación passwordless: email normalizado → respuesta
uniforme → challenge nuevo → verify one-time → nueva `PlatformSession`.

La evidencia directa está en [`05-g5br2-recovery-and-ci-evidence.md`](05-g5br2-recovery-and-ci-evidence.md):
`G5BR2-REC-01..10` y `G5BR2-HTTP-REC-01..04` pasan con PostgreSQL/Nest reales. La sesión
opaca se interpreta como el nuevo medio de acceso permitido por E4; no se crea password
ni otra credencial. Como no existe una política aprobada para revocar todas las sesiones
al recuperar, queda `SESSION_REVOCATION_ON_RECOVERY = POLICY_NOT_DEFINED / RESIDUAL`.

`FR-ID-002 = DIRECTLY_COVERED_BY_PASSWORDLESS_RECOVERY` queda propuesto, no aprobado
humanamente. `Q-106` continúa `DEFERRED / PILOT PRECONDITION`; verificar email no prueba
relación guardian. `G5` continúa `NO APROBADA / NOT REQUESTED`.
