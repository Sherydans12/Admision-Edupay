# G5-B — Identity / onboarding evidence closure

## Resultado de la compuerta

`PATH B = IMPLEMENTATION_GAP_AC001`

La ejecución se detiene sin implementar el feature. El inventario no encontró un
recorrido runtime de registro de adulto responsable, inicio de verificación de canal,
confirmación del canal, activación/creación de cuenta ni anti-enumeration específico
para ese registro.

Por consecuencia:

- `G5-EXIT-01 = EVIDENCE_GAP / IMPLEMENTATION_GAP_AC001`;
- `G5-EXIT-02 = EVIDENCE_GAP / IMPLEMENTATION_GAP_AC001`;
- `AC-001 = NOT_IMPLEMENTED / DIRECT_EVIDENCE_MISSING`;
- `E2E-001 = COVERED hasta functional boundary`;
- `Q-106 = DEFERRED / PILOT PRECONDITION`;
- `CHANNEL_DECISION_REQUIRED` queda abierto;
- `G5 = NO APROBADA / NOT REQUESTED`.

No se interpreta como gap que E2E-001 termine en aceptación expresa y handoff
funcional local. Matrícula y resultado técnico EduPay permanecen fuera del resultado
canónico de E2E-001.

## Hechos confirmados

### Lo que existe

1. E4 implementa identidad de control-plane y sesiones opacas para usuarios que ya
   existen: `PlatformUser`, `PlatformSession` y `SessionService`.
2. `SessionService.issueSession(userId)` verifica que el `PlatformUser` exista y esté
   activo; no registra un adulto ni verifica un canal.
3. E5-A implementa el slice autenticado de familia: `FamilyProfile`, varios `Student`,
   ownership, postulaciones y snapshot versionado de E5-B.
4. `PUT /family/profile` ejecuta `getOrCreateFamilyProfile` sólo después de resolver
   una sesión autenticada. Crear el perfil familiar no crea la cuenta ni constituye
   verificación de identidad.
5. Existen controles de anti-enumeration para recursos familiares/tenant-owned ya
   implementados, por ejemplo respuestas seguras para recursos ajenos. Esos controles
   no demuestran el comportamiento de registro de AC-001 frente a una identidad nueva
   y una identidad existente.

### Lo que no existe

No se encontró una implementación o evidencia directa para:

1. registro de un adulto responsable sin cuenta;
2. inicio de una verificación de canal;
3. token/código de confirmación asociado al canal;
4. expiración, consumo único y protección contra replay del token/código;
5. creación o activación de la cuenta como resultado de una verificación válida;
6. respuesta externa equivalente entre identidad nueva y existente para evitar
   enumeración;
7. garantía de que no exista sesión autenticada antes de verificar, ni transición
   segura al login posterior a la verificación.

## Archivos y superficies inspeccionados

### Runtime/API

- `apps/api/src/app.module.ts`: no registra `AuthController`, `OnboardingController`
  ni un servicio de registro/verificación.
- `apps/api/src/intake.controller.ts`: sólo expone `/auth/csrf` y rutas protegidas de
  familia, administración e intake; no existen `/auth/register`, `/auth/verify`,
  `/auth/login` ni equivalentes.
- `apps/api/src/request-context.service.ts`: `requireUser()` exige la cookie de sesión
  opaca y `requireFamilyContext()` exige además un usuario activo; es una frontera de
  acceso posterior al onboarding, no onboarding.
- `apps/api/src/intake.service.ts`: el perfil se crea o actualiza para el actor de una
  sesión ya resuelta.
- `apps/api/src/intake.http.integration.spec.ts`: los flujos HTTP parten de sesiones y
  datos familiares sintéticos ya preparados.
- `apps/web/app/page.tsx`: la UI carga datos con `credentials: "include"`, solicita
  `/auth/csrf` y muestra que requiere una sesión activa; no contiene registro, login ni
  verificación de canal.

### Dominio, sesión y persistencia

- `packages/database/src/session-service.ts`: emisión, resolución, rotación,
  expiración y revocación de sesiones opacas para `userId` existente.
- `packages/database/src/identity-session.integration.spec.ts`: `SES-01..16` cubre
  hash, resolución, revocación, expiración, rotación y concurrencia de sesiones; no
  cubre registro ni verificación de canal.
- `packages/database/src/identity-authorization.integration.spec.ts`: autorización,
  tenant, scope y deny-by-default; no onboarding.
- `packages/database/src/intake.ts`: `getOrCreateFamilyProfile()` requiere un
  `FamilyExecutionContext` derivado de sesión y crea sólo `FamilyProfile`.
- `packages/database/prisma/schema.prisma`: `PlatformUser` y `PlatformSession` existen,
  pero el comentario de `PlatformUser` declara explícitamente que la identidad global
  de control-plane no representa onboarding funcional. No hay entidad de challenge,
  verification attempt, channel token, activation o replay-consumption.
- `packages/database/prisma/migrations/20260808170000_e4_identity_operational_foundation/migration.sql`:
  crea usuarios, sesiones y memberships; no crea flujo de registro/verificación.
- `packages/database/prisma/migrations/`: la última migration es
  `20260814090000_e5i_functional_handoff`; no existe Migration 16 ni una migration de
  onboarding.
- `packages/database/src/testing/synthetic-tenant-fixtures.ts` y las fixtures de las
  suites E4/E5: son contextos sintéticos autenticados, no un mecanismo de registro.

## Evidencia directa de la brecha AC-001

La evidencia encontrada demuestra primitives posteriores al registro:

- `identity-session.integration.spec.ts` crea un `PlatformUser` sintético y luego
  invoca `issueSession()`.
- `apps/api/src/intake.http.integration.spec.ts` crea directamente usuarios, perfiles,
  estudiantes y sesiones sintéticas antes de ejecutar las rutas HTTP.
- `intake.ts` crea `FamilyProfile` sólo desde un actor autenticado.
- El schema no contiene una transición `UNVERIFIED -> VERIFIED/ACTIVE` ni un registro
  de intento/challenge que pueda expirar, consumirse una vez o auditarse como verificación.

Por tanto, no es válido usar `PlatformUser` creado por fixture, sesión opaca manual,
membership seeded o `FamilyProfile` creado por servicio como evidencia de:

> Given: adulto responsable sin cuenta; When: registra y verifica su canal; Then:
> obtiene una cuenta sin revelar si terceros ya existen.

## Anti-enumeration

Existe anti-enumeration para algunos recursos ya creados, pero no existe endpoint ni
servicio de registro sobre el cual comparar la respuesta para una identidad nueva y una
identidad existente. En consecuencia, no hay evidencia para `G5B-ID-06` ni
`G5B-ID-07`; tampoco existen los tests `G5B-ID-01..10` o `G5B-HTTP-01..04`.

Los tests de identidad existentes (`SES-*`, `AUTH-*`, `ELEV-*`) no deben reclasificarse
como evidencia de AC-001: prueban sesión/autorización posterior, no onboarding.

## BL-002 sin reimplementar AC-002/AC-003

La evidencia existente sí cubre el slice ya implementado de:

- acciones familiares autorizadas y ownership de estudiante/postulación;
- múltiples hijos bajo un `FamilyProfile`;
- snapshot de postulación versionado e inmutable frente a cambios posteriores.

Referencias directas:

- `packages/database/src/intake.integration.spec.ts` y
  `apps/api/src/intake.http.integration.spec.ts` para ownership familiar y aislamiento;
- `packages/database/src/forms.integration.spec.ts`, `E5B-SUB-01/02` y
  `E5B-SUB-03/04` para snapshot único e independencia frente a cambios posteriores;
- `docs/g5/01-pre-pilot-readiness-review.md`, matriz de BL-002 y AC-002/AC-003.

Esto no elimina la frontera de BL-002: su entrada AC-001 sigue sin estar implementada
ni demostrada directamente.

## Canal de identidad y Q-106

`docs/e1/11-functional-specification.md` aprueba correo como canal automático de
comunicación del MVP y deja llamadas como contacto manual; no fija inequívocamente que
el correo sea el canal de verificación de identidad de AC-001 ni define un protocolo de
registro.

Estado: `CHANNEL_DECISION_REQUIRED`.

No se selecciona SMS, WhatsApp, telefonía, proveedor externo ni proveedor productivo.
No se diseña un development adapter de verificación mientras falte la decisión del
canal aprobado.

`Q-106` permanece separado: la verificación de canal/cuenta no resuelve la política
definitiva de identidad, relación y excepciones familiares. Su estado continúa
`DEFERRED / PILOT PRECONDITION`.

## Scope mínimo de remediación futura

Una remediación posterior, con aprobación humana y decisión de canal, tendría que
definir y evidenciar como mínimo:

- registro de adulto no existente;
- inicio y confirmación del canal aprobado;
- cuenta creada/activada sólo después de verificación válida;
- respuestas anti-enumeration equivalentes para nuevo/existente;
- token/código inválido, expirado, consumido y replay;
- sesión posterior y frontera de login segura;
- tenant/family linkage derivado server-side, nunca controlado arbitrariamente por el
  body;
- protección cross-tenant y auditoría mínima sin exponer datos sensibles.

El cambio probablemente requerirá nuevas entidades/estado persistente para challenge,
expiry y consumo único, pero el schema exacto y la necesidad final de migration quedan
abiertos a diseño aprobado. No se creó migration ni se modificó el schema.

La decisión de proveedor sólo podrá evaluarse después de fijar el canal. Un adapter de
desarrollo sería una opción de evidencia sintética únicamente si el canal ya está
aprobado; no constituye selección de proveedor productivo.

## Decisiones y preguntas abiertas

| ID/tema | Estado | Motivo |
| --- | --- | --- |
| AC-001 | `IMPLEMENTATION_GAP` | No existe registro + verificación funcional real |
| Canal de identidad | `CHANNEL_DECISION_REQUIRED` | El canal de comunicación no equivale inequívocamente al canal de verificación |
| Q-106 | `DEFERRED / PILOT PRECONDITION` | Política definitiva de identidad/relación/excepciones no aprobada |
| Schema/migration | `NO CHANGE CREATED; LIKELY STRUCTURAL CHANGE` | El modelo actual no representa challenge, expiry, consumo ni activación |
| Provider productivo | `NOT SELECTED` | No se puede decidir antes del canal y de la política aplicable |
| Q-301..Q-309 | `FUTURE_INTEGRATION_PENDING` | Fuera de alcance y no tocados |
| C-013 | `LEGAL_VALIDATION_PENDING` | Fuera de alcance y no resuelto |

## Validación de esta ejecución

Esta ejecución sólo agrega este diagnóstico documental. No se agregaron tests, fixtures,
helpers runtime, endpoints, dependencias, schema ni migrations. Los datos utilizados
en la inspección fueron sintéticos/documentales; no se usaron datos reales.

Validaciones a ejecutar después de crear el documento:

- `pnpm format:check`;
- `git diff --check`.

No se ejecuta la suite runtime completa porque la decisión B exige detenerse sin
implementar el feature; los tests históricos no son evidencia AC-001.

## Compuerta y siguiente acción humana

El diagnóstico no aprueba G5 ni solicita G5. PR #8 debe permanecer `OPEN / DRAFT / NO
MERGE`. Datos reales, piloto, producción, EduPay técnico, C-013 y Q-301..Q-309 no se
inician ni se resuelven aquí.

La siguiente acción humana es aprobar una remediación específica de AC-001 y decidir
inequívocamente el canal de identidad, manteniendo separada esa decisión de Q-106.
