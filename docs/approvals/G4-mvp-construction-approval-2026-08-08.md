# G4 — Aprobación de construcción MVP

## Estado

**`APPROVED / CLOSED`**

## Identificación

| Campo | Valor |
| --- | --- |
| Compuerta | G4 — Autorización de construcción MVP |
| Aprobación | `2026-08-08T20:25:00-04:00` |
| Aprobador | Nicolás Sena |
| PR | #7 — `E4: Establish technical foundation and G4 readiness` |
| Rama | `feat/e4-technical-foundation` |
| Commit técnico aprobado | `cb5d4be14fd9149a20e1acd36b5dfad563c2836a` |
| Resultado readiness | `PASS_WITH_DEFERRED` |
| BLOCKING_G4 | Ninguno material identificado |
| E4-A | `COMPLETE` |
| E4-B | `COMPLETE` |
| E4-C | `COMPLETE` |
| E4-D | `COMPLETE` |
| E4-E | `COMPLETE` |
| E4 | `CLOSED / TECHNICAL FOUNDATION APPROVED` |
| G4 | `APPROVED / CLOSED` |
| Etapa autorizada | E5 — construcción del MVP funcional |

## Evidencia técnica aceptada

La aprobación se emite sobre la fundación técnica consolidada en el commit indicado. La evidencia incluye:

- monorepo pnpm reproducible con web Next.js, API NestJS, worker y paquete Prisma/PostgreSQL;
- PostgreSQL `15.14` y Prisma `7.9.1`;
- sesión opaca server-side, tenant resolution y autorización deny-by-default;
- separación `PlatformExecutionContext` / `TenantExecutionContext`;
- SELF-ELEVATION temporal, limitada y revalidada desde persistencia;
- RLS/FORCE RLS para tablas tenant-owned y frontera platform restringida;
- lifecycle de sesiones transaccional y concurrency-safe;
- auditoría/security sinks explícitos;
- `SES-01..SES-16`, `AUTH-01..AUTH-12`, `PLAT-01..PLAT-03`, `ELEV-01..ELEV-08`, `AUD-01..AUD-05`, `TRUST-01..TRUST-08` y `POC-01..POC-08`: `PASS`;
- `pnpm test`: `62/62 PASS`;
- `pnpm test:rls`: `8/8 PASS`;
- fresh migrations: `3/3 PASS`;
- secret scan final: `180` archivos tracked inspeccionados, `PASS`;
- dependency audit: sin vulnerabilidades conocidas en nivel high;
- workflow final observado sobre el commit aprobado: run `31284276761`, job `validate`, `PASS`;
- deployment smoke local/development: API live/ready 200, web 200, worker persistente y SIGTERM limpio;
- recovery smoke sintético: `REC-01..REC-08 PASS`, restore aislado y RLS revalidada;
- tiempo de recovery observado: `31.807 s`, sólo como evidencia local/development.

RPO `1 hora` y RTO `4 horas` permanecen objetivos técnicos iniciales y no SLA contractual ni evidencia productiva.

## Alcance autorizado para E5

G4 autoriza iniciar E5 y construir el MVP funcional dentro del alcance aprobado:

- `BL-001..BL-022`;
- `AC-001..AC-058`;
- `E2E-001..E2E-022`.

E5 puede incluir schemas/migrations funcionales de Admisión, API y UI funcionales, worker/jobs funcionales, adapters seguros de almacenamiento/documentos y pruebas funcionales, de aislamiento, seguridad, concurrencia, accesibilidad y recuperación necesarias para demostrar los criterios de salida.

Durante E5 sólo se permiten datos sintéticos/non-production e infraestructura local/development necesaria.

## Exclusiones y condiciones vigentes

Esta aprobación **no** autoriza:

- datos reales de estudiantes, familias, trabajadores o instituciones;
- piloto o producción;
- secretos productivos;
- aceptación legal de `C-013`;
- integración técnica con EduPay;
- resolución de `Q-301..Q-309`;
- G5 ni autorización de piloto.

Permanecen diferidos para E5/G5/production readiness según corresponda:

- implementación funcional completa P0 y su evidencia;
- workflow documental privado y proveedor real de object storage/malware;
- proveedor de email;
- sinks durables productivos;
- estrategia CSRF multi-instancia;
- secretos/TLS/reverse proxy/monitoring/alerting productivos;
- backup provider, retención y revalidación RPO/RTO;
- ownership legal/productivo e incident response productivo;
- autorización legal/privacy y de datos reales.

## Criterios de salida hacia G5

Solicitar G5 requerirá evidencia de P0 implementado, criterios de aceptación críticos, aislamiento multiempresa, seguridad, concurrencia, documentos privados, comunicaciones, accesibilidad, backup/restore, operación y legal/privacy, además de autorización explícita para datos reales y piloto.

## Texto de aprobación recibido

> Apruebo G4 sobre el commit `cb5d4be14fd9149a20e1acd36b5dfad563c2836a` del PR #7. Apruebo E4-A, E4-B, E4-C, E4-D y E4-E con resultado `PASS_WITH_DEFERRED`, sin bloqueantes G4 materiales. Autorizo cerrar E4, registrar y cerrar G4, fusionar el PR #7 e iniciar E5 — construcción del MVP funcional dentro del alcance `BL-001..BL-022`, `AC-001..AC-058` y `E2E-001..E2E-022`, utilizando exclusivamente datos sintéticos/non-production e infraestructura local/development necesaria. Mantengo vigentes los diferidos y criterios de salida para G5. Esta aprobación no autoriza datos reales, piloto, producción, secretos productivos, aceptación legal C-013, integración técnica con EduPay ni resolución de Q-301..Q-309, ni constituye aprobación de G5.

## Cierre

Con esta decisión:

- E4 queda `CLOSED / TECHNICAL FOUNDATION APPROVED`;
- G4 queda `APPROVED / CLOSED`;
- E5 queda autorizada para iniciar dentro de los límites anteriores;
- el PR #7 puede fusionarse;
- los diferidos de G5, producción, legal/privacy y EduPay permanecen vigentes.