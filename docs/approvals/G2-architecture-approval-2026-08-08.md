# G2 — Registro formal de aprobación arquitectónica

## Control

| Campo | Valor |
| --- | --- |
| Compuerta | G2 — Aprobación arquitectónica |
| Estado | `APPROVED / CLOSED` |
| Fecha de aprobación | `2026-08-08T07:08:00-04:00` |
| Commit arquitectónico revisado y aprobado | `15b49e284ca642761f2df744ce73bb6a3d10e289` |
| PR | `#5 — E2: Architecture design and G2 preparation` |
| Aprobador | Nicolás Sena |
| E2 | `CLOSED / ARCHITECTURE APPROVED` |
| E3 | `AUTHORIZED TO START` después de la fusión del PR #5 |
| G3 | `NO APROBADA` |
| ADR-0001 | `ACCEPTED` |
| ADR-0002 | `ACCEPTED` |
| ADR-0003 | `ACCEPTED_WITH_CONDITION` |
| ADR-0004 | `ACCEPTED` |
| ADR-0005 | `ACCEPTED` |
| Implementación | No autorizada |
| Scaffolding/dependencias | No autorizados |
| Infraestructura | No autorizada |
| Datos reales | No autorizados |
| Integración técnica EduPay | No autorizada |

## Aprobación humana explícita

Se registra la siguiente aprobación:

> Apruebo G2 sobre el commit `15b49e284ca642761f2df744ce73bb6a3d10e289` del PR #5. Apruebo las decisiones arquitectónicas E2-D-001 a E2-D-017 y acepto ADR-0001 a ADR-0005 con las condiciones y diferidos documentados. Mantengo obligatorio el PoC de tenant/RLS/Prisma antes de G4, con revisión arquitectónica si no cumple las condiciones definidas. Apruebo la sesión web MVP mediante sesión opaca server-side y RPO 1 hora / RTO 4 horas como objetivos técnicos iniciales, no SLA contractual. Autorizo cerrar E2, registrar y cerrar G2, fusionar el PR #5 e iniciar E3 — Prototipo UX. Esta aprobación no autoriza todavía código, scaffolding, infraestructura, datos reales ni integración técnica con EduPay.

## Decisiones arquitectónicas aprobadas

G2 acepta E2-D-001 a E2-D-017 como dirección arquitectónica vigente, incluyendo:

- modular monolith con fronteras internas explícitas y procesos web/API/worker separables;
- alineación principal de stack con EduPay sin compartir dominio, repositorio, base, tablas ni sesiones;
- monorepo independiente con pnpm workspaces y Turborepo opcional basado en evidencia;
- PostgreSQL como base transaccional;
- shared database/shared schema con `tenantId` obligatorio y defensa en profundidad;
- PostgreSQL RLS para datos tenant-owned, sujeto al PoC obligatorio previo a G4;
- identidad global con memberships tenant;
- sesión web MVP mediante identificador opaco server-side en cookie HttpOnly/Secure/SameSite;
- autorización deny-by-default por capacidad, tenant, recurso, scope, sensibilidad, propósito y separación de funciones;
- SELF-ELEVATION explícita, temporal y auditable para Superadministrador Global;
- object storage privado S3-compatible, proveedor neutral, con cuarentena y escaneo antimalware fail-closed;
- transacciones, locking focalizado, constraints, idempotencia y control optimista para invariantes críticas;
- PostgreSQL-backed jobs + outbox transaccional + worker, sin Redis/BullMQ inicial;
- proveedor de email detrás de adaptador, con estados técnicos separados del negocio;
- auditoría separada de application logs, security events y métricas;
- runtime Linux containerizado con reverse proxy y servicios administrados selectivos cuando convenga;
- RPO 1 hora y RTO 4 horas como objetivos técnicos iniciales, no SLA;
- testing con PostgreSQL real, aislamiento tenant, seguridad, concurrencia, archivos, jobs y E2E P0.

## ADR aceptadas

- `ADR-0001` — Alineación principal de stack con EduPay: `ACCEPTED`.
- `ADR-0002` — Modular monolith: `ACCEPTED`.
- `ADR-0003` — Shared-schema tenancy con RLS: `ACCEPTED_WITH_CONDITION`.
- `ADR-0004` — Object storage privado S3-compatible: `ACCEPTED`.
- `ADR-0005` — Runtime Linux containerizado/híbrido: `ACCEPTED`.

## Condición obligatoria ADR-0003 / HD-03

Antes de G4 debe existir una PoC sintética de tenant/RLS/Prisma que demuestre:

1. request con tenant correcto;
2. job con tenant correcto;
3. ausencia de tenant context = `DENY`;
4. intento cross-tenant = `DENY`;
5. pooling sin fuga de tenant context;
6. compatibilidad de Prisma con transacciones y RLS;
7. rol de aplicación separado del rol de migraciones;
8. comportamiento fail-closed.

Si la PoC falla, RLS no puede deshabilitarse silenciosamente. La arquitectura debe volver a revisión y aprobar una defensa equivalente antes de continuar hacia G4.

## Sesión web MVP aprobada

La sesión del navegador será server-side y opaca:

- cookie `HttpOnly`;
- `Secure` en HTTPS;
- política `SameSite` apropiada;
- identificador aleatorio de alta entropía;
- registro server-side revocable, preferentemente persistiendo hash/verificador;
- expiración por inactividad y absoluta;
- rotación del identificador después de login, cambios sensibles o elevación;
- revocación por logout, recuperación, cambio de credenciales o riesgo.

La sesión identifica, pero no autoriza. Tenant, membership, permiso, recurso, scope, sensibilidad, propósito y separación de funciones se resuelven server-side en cada operación. JWT queda disponible únicamente para clientes futuros si una etapa posterior lo justifica.

## Recuperación

RPO inicial de 1 hora y RTO inicial de 4 horas quedan aceptados como `INITIAL TECHNICAL TARGETS`.

No constituyen:

- SLA contractual;
- compromiso comercial;
- garantía legal;
- compromiso de disponibilidad.

Deben revalidarse con proveedor, volumen, costo y operación reales antes del aprovisionamiento productivo.

## Diferidos aceptados

Permanecen abiertos y no reabren G2:

- `C-013 / LEGAL_VALIDATION_PENDING` y Q-201/Q-202/Q-208 antes de datos reales/piloto productivo;
- proveedores, regiones, residencia, contratos y procurement;
- volúmenes concretos y dimensionamiento Q-207;
- política exacta de MFA Q-204;
- responsables y procedimientos de incidentes Q-205;
- Q-301 a Q-309 para E7/G7;
- selección concreta de proveedor de email, storage, observabilidad, base administrada y runtime;
- infraestructura ejecutable y secretos;
- PoC y validaciones técnicas previstas para etapas posteriores.

Q-310 permanece `APPROVED_PRODUCT / FUNCTIONALLY_RESOLVED`.

## Efecto de la aprobación

- E2 pasa a `CLOSED / ARCHITECTURE APPROVED`.
- G2 pasa a `APPROVED / CLOSED`.
- ADR-0001..ADR-0005 pasan a los estados aceptados indicados en esta acta.
- E3 — Prototipo UX queda autorizado para iniciar después de fusionar el PR #5.
- G3 permanece `NO APROBADA`.

## Límites explícitos

Esta aprobación no autoriza:

- código ni scaffolding;
- instalación de dependencias;
- `package.json`, Prisma schema, SQL, migraciones o endpoints ejecutables;
- infraestructura, Docker o aprovisionamiento productivo;
- secretos o cuentas cloud;
- datos personales/documentos reales;
- piloto productivo;
- integración técnica con EduPay;
- resolver Q-301 a Q-309;
- omitir las validaciones legales o de seguridad pendientes.

E3 puede diseñar y validar UX con datos sintéticos conforme a la arquitectura aprobada. La implementación permanece bloqueada hasta las compuertas posteriores del roadmap.

## Inmutabilidad de la evidencia aprobada

La aprobación arquitectónica se aplica al contenido exacto del commit `15b49e284ca642761f2df744ce73bb6a3d10e289`. Los commits administrativos posteriores del PR #5 pueden registrar esta aprobación, actualizar estados y referencias, o alinear las ADR sin modificar la arquitectura aprobada. Cualquier cambio arquitectónico sustantivo posterior requiere ADR y revisión de impacto.
