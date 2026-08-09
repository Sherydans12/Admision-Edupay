# E4-C — Identity, session y autorización

## Modelo horizontal

`PlatformUser`, `PlatformSession` y `Tenant` son control-plane global: identifican la
plataforma, mantienen sesiones y registran instituciones, por lo que no llevan un
`tenantId` ambiental ni usan RLS tenant. Ese acceso global de DB no implica autorización
global de casos de uso; los repositories/services exponen sólo operaciones estrechas.
`Membership`,
`RoleAssignment`, `SupportElevation` y `OutboxMessage` son tablas tenant-owned y usan
`tenantId NOT NULL`, RLS `FORCE ROW LEVEL SECURITY`, policies explícitas y grants por
migración. No se modelan postulaciones ni otros datos funcionales E5.

La sesión identifica al usuario, pero nunca concede permisos por sí sola. La autoridad
tenant se resuelve server-side con usuario autenticado, tenant candidato y membership
activa; el resultado alimenta `TenantExecutionContext` y las capacidades explícitas de
los role assignments.

## Sesión opaca

`SessionService.issueSession` genera 32 bytes con CSPRNG, devuelve únicamente el valor
raw al borde HTTP y persiste SHA-256 hexadecimal (`tokenHash`); el raw nunca se persiste
ni se registra. `resolveSession` compara en tiempo constante, verifica usuario activo,
revocación y expiraciones idle/absolute. `rotateSession`, `revokeSession` y
`revokeAllUserSessions` invalidan los verificadores anteriores y emiten eventos auditables.
Los TTL son configuración (`SESSION_IDLE_TTL_SECONDS`, `SESSION_ABSOLUTE_TTL_SECONDS`),
no una política comercial fija.

La cookie de borde es `HttpOnly`, `Path=/`, `SameSite` explícito y `Secure` fuera de
HTTP local; sólo contiene el token opaco. No contiene tenant, usuario, rol, permiso ni
datos de negocio y nunca se usa `localStorage`/`sessionStorage`.

## Autorización y SoD

`authorize` es deny-by-default y evalúa permission, tenant del recurso, scope,
sensitivity, purpose y separación de funciones. Secretaría no puede recomendar ni
decidir. Un actor que recomienda un recurso sintético no puede decidirlo. Un superadmin
global sin elevación no obtiene acceso tenant ambiental.

`PlatformExecutionContext` es tenantless y representa operaciones globales. Un superadmin
ordinario no puede ejecutar `withTenantTransaction` ni producir un `TenantExecutionContext`.
`SupportElevationService` exige actor autorizado, tenant objetivo, razón, propósito, scopes,
categorías y expiración. Produce un contexto separado, limitado al tenant y propósito,
con eventos de inicio/cierre/revocación/denegación. Expiración, cierre o revocación vuelven
a denegar; no se convierte en acceso permanente de la sesión.

La elevación se crea y resuelve mediante una transacción PostgreSQL marcada únicamente
como `TRUSTED PLATFORM OPERATION`. Esa operación instala sólo los GUC transaction-local
`admission.platform_operation`, `admission.platform_actor_id` y
`admission.platform_target_tenant_id`; nunca instala `admission.tenant_id` y no expone un
`Prisma TransactionClient`. El detalle interno sólo entrega operaciones de
`SupportElevation`. La policy platform puede administrar exclusivamente la fila propia
de `support_elevations`; memberships, roles, outbox y demás tablas tenant-owned siguen
fail-closed sin tenant context. El registro persistido se verifica por actor, tenant,
purpose, scopes, categories, estado y expiry antes de producir un contexto elevado.

## CSRF

La primitive `InMemoryCsrfService` usa secreto sincronizador hashado, permite métodos
seguros y exige para mutaciones token válido más `Origin`/`Referer` compatible. `HttpOnly`
no se considera defensa CSRF. La estrategia queda lista para conectarse al borde HTTP
cuando exista login real.
Es una foundation/dev single-process: antes de multi-instancia se requiere un secreto
compartido persistido o una estrategia stateless coherente.

## Evidencia

Los tests SES-01..SES-16, AUTH-01..AUTH-12, PLAT-01..03 y ELEV-01..08 se ejecutan con Vitest; las pruebas de
persistencia usan PostgreSQL real y fixtures sintéticos. La matriz reproducible está en
`docs/e4/06-e4-security-evidence.md`.
