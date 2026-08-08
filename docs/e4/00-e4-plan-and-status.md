# E4 — Fundación técnica

## Control

| Campo | Valor |
| --- | --- |
| Etapa | E4 — Fundación técnica |
| Estado | `IN PROGRESS / FOUNDATION AND RLS POC COMPLETE` |
| Inicio autorizado | `2026-08-08T15:30:00-04:00` |
| Base | `main` en `6b2549333e25b65a44c97423a718b70a8d38937f` |
| Rama | `feat/e4-technical-foundation` |
| Dependencia | G3 `APPROVED / CLOSED` |
| G4 | `NO APROBADA` |
| Datos permitidos | Sólo sintéticos |
| Infraestructura productiva | No autorizada |
| Integración técnica EduPay | No autorizada |

## Estado de incrementos

| Incremento | Estado | Evidencia |
| --- | --- | --- |
| E4-A — Repository and toolchain foundation | `COMPLETE` | Monorepo pnpm instalable, lintable, typecheckable, testeable y compilable; web/API/worker separados |
| E4-B — PostgreSQL, Prisma y PoC tenant/RLS | `COMPLETE` | PostgreSQL 15.14 real, migración Prisma 7.9.1 y `POC-01..POC-08` con 8/8 tests `PASS` |
| E4-C — Identity/session/authorization foundation | `NOT_STARTED` | Fuera del alcance de esta entrega |
| E4-D — Operational foundation | `NOT_STARTED` | Sólo CI mínima estrictamente necesaria para validar E4-A/B; el resto está diferido |
| E4-E — G4 readiness | `NOT_STARTED` | G4 permanece `NO APROBADA` |

La evidencia reproducible de E4-A y E4-B está en `docs/e4/01-local-development.md`,
`docs/e4/02-tenant-rls-poc.md` y `docs/e4/03-technical-baseline.md`. Completar estos
incrementos no autoriza avanzar E4-C/E4-D ni solicitar, aprobar o sustituir G4.

## Objetivo

Crear una base técnica mínima, segura, testeable y reversible que permita solicitar G4 sin implementar todavía el recorrido funcional completo del MVP.

E4 sí autoriza código de fundación, scaffolding, dependencias, schemas/migraciones iniciales, pruebas, CI e infraestructura local/de desarrollo. E4 no autoriza construir silenciosamente funcionalidades de negocio completas que corresponden a E5.

## Arquitectura aprobada que E4 debe materializar

- modular monolith;
- monorepo independiente de EduPay;
- TypeScript;
- Next.js para web;
- NestJS para API;
- worker separado;
- pnpm workspaces;
- Turborepo sólo si aporta valor real y bajo overhead;
- PostgreSQL;
- Prisma;
- shared schema con `tenantId` obligatorio para datos tenant-owned;
- RLS como defensa adicional condicionada a PoC antes de G4;
- opaque server-side sessions para web MVP;
- autorización deny-by-default;
- jobs/outbox PostgreSQL;
- object storage y malware detrás de contratos/adapters, sin proveedor productivo todavía;
- runtime Linux containerizado como dirección productiva futura, sin aprovisionar producción en E4.

## Orden de trabajo

### E4-A — Repository and toolchain foundation

Objetivo: tener monorepo instalable, compilable, lintable y testeable.

Entregables esperados:

- `package.json` raíz;
- `pnpm-workspace.yaml`;
- lockfile;
- configuración TypeScript común;
- ESLint/Prettier o herramientas equivalentes;
- `apps/web` Next.js;
- `apps/api` NestJS;
- `apps/worker` Node/Nest ligero según decisión de implementación;
- paquetes compartidos estrictamente técnicos;
- scripts raíz;
- `.env.example` sin secretos;
- `.gitignore`;
- README de desarrollo;
- checks de build/lint/typecheck/test.

No crear todavía módulos funcionales completos de Admisión.

### E4-B — PostgreSQL, Prisma y PoC tenant/RLS

Objetivo: resolver la condición crítica de ADR-0003 antes de G4.

Debe usar únicamente datos sintéticos y demostrar las ocho condiciones aprobadas:

1. request con tenant correcto;
2. job con tenant correcto;
3. ausencia de tenant context = DENY;
4. intento cross-tenant = DENY;
5. pooling sin fuga de tenant context;
6. Prisma compatible con transacciones + RLS;
7. rol aplicación separado de rol migraciones;
8. fail-closed.

La PoC debe ser reproducible por tests/instrucciones. Si falla, no se elimina RLS silenciosamente.

### E4-C — Identity/session/authorization foundation

Objetivo: crear sólo la infraestructura horizontal necesaria.

Incluye:

- identidad técnica mínima;
- opaque server-side session;
- cookies HttpOnly/Secure/SameSite configurables por ambiente;
- session rotation/revocation foundation;
- tenant context server-side;
- membership/capability primitives;
- authorization deny-by-default;
- separación entre sesión e autorización;
- soporte conceptual/técnico para SELF-ELEVATION sin acceso ambiental.

No requiere todavía flujos UI completos de registro/recuperación del MVP.

### E4-D — Operational foundation

Incluye:

- structured logging sanitizado;
- correlation IDs;
- manejo global de errores;
- health/readiness;
- audit event foundation;
- PostgreSQL-backed job/outbox primitives;
- adapters vacíos/fakes para email/storage/malware;
- CI;
- escaneo básico de secretos/dependencias;
- tests de aislamiento y autorización.

### E4-E — G4 readiness

Preparar evidencia objetiva:

- builds reproducibles;
- tests verdes;
- PoC RLS aprobada;
- aislamiento tenant probado;
- sesión/authz base probada;
- migraciones reproducibles;
- rollback local/de desarrollo demostrado cuando corresponda;
- documentación de setup;
- dependencias y riesgos conocidos;
- checklist y borrador G4.

## Reglas de implementación

- No usar datos reales.
- No introducir secretos en Git.
- No conectar servicios productivos.
- No crear integración técnica con EduPay.
- No resolver Q-301..Q-309.
- No tratar aceptación como matrícula/pago.
- No hardcodear Colegio Conquistadores como tenant especial.
- No omitir `tenantId` en datos tenant-owned.
- No confiar en tenant proveniente del body/query para autorización.
- No usar JWT de navegador como sesión MVP.
- No deshabilitar RLS silenciosamente para hacer pasar tests.
- No construir módulos de negocio P0 completos antes de G4 salvo el mínimo estrictamente necesario para demostrar la fundación técnica.

## Datos sintéticos

Fixtures y tests deben usar identificadores, correos y personas claramente sintéticos. No copiar RUT, documentos, emails o antecedentes reales.

## Criterios para solicitar G4

E4 puede solicitar G4 cuando:

- toolchain y monorepo sean reproducibles;
- web/API/worker compilen y ejecuten en desarrollo;
- PostgreSQL/Prisma estén configurados con migraciones reproducibles;
- PoC tenant/RLS/Prisma cumpla las ocho condiciones o exista revisión arquitectónica equivalente;
- tests negativos cross-tenant pasen;
- sesión/autorización base sea deny-by-default y testeable;
- no existan secretos ni datos reales;
- CI y checks de calidad/seguridad base pasen;
- documentación permita levantar el entorno desde cero;
- exista checklist G4 sin bloqueantes críticos no aceptados.

## Límites de G4

G4 es la compuerta que autorizará, si se aprueba, la construcción funcional del MVP en E5. El avance técnico de E4 no sustituye esa aprobación.

## Próximo incremento

Comenzar por E4-A y E4-B en una primera entrega técnica controlada: scaffolding reproducible + PostgreSQL/Prisma + PoC tenant/RLS. Después revisar evidencia antes de expandir a E4-C/D.
