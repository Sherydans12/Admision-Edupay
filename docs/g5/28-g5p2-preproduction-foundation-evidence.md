# G5-P2 — Evidencia de foundation para preproducción sintética

**Fecha:** 2026-08-24

**Estado:** `IMPLEMENTED / TECHNICALLY_REVIEWED / PREPRODUCTION_DEPLOYMENT_PENDING`

**Datos autorizados:** exclusivamente sintéticos
**Migración autorizada:** `21` (`20260824190000_g5p2_email_delivery_controls`)

## 1. Resultado

Quedó preparada una candidata desplegable en Coolify para validar el flujo completo de
Admisión con datos y destinatarios sintéticos. La entrega no habilita el piloto ni el
tratamiento de datos personales reales.

La foundation incluye:

- imágenes productivas no-root para web, API, worker y migrator;
- Compose sin puertos de host, con migración one-shot, health checks y servicios privados;
- despliegue manual protegido mediante GitHub Environment;
- almacenamiento S3 compatible, cuarentena, promoción y análisis ClamAV fail-closed;
- transporte Resend con modos `disabled`, `synthetic` y `live`, manteniendo `live`
  bloqueado por una autorización separada;
- procesamiento efectivo del outbox de comunicaciones;
- webhook Resend verificado sobre bytes crudos, ventana temporal, tipos permitidos e
  idempotencia;
- supresión de rebotes y complaints mediante HMAC tenant-bound, sin persistir el correo;
- CSRF HMAC sin estado para múltiples instancias;
- alta inicial de tenant y administrador idempotente, auditable y con privilegio mínimo;
- runbooks de despliegue, recuperación, onboarding y handoff manual.

## 2. Migración 21

La migración es aditiva, forward-only y no contiene seeds. Crea:

- `communication_webhook_events`, append-only, con FK tenant-compuesta al intento;
- `communication_suppressions`, append-only, con hash HMAC versionado y FK
  tenant-compuesta al evento;
- unicidad del evento del proveedor y de la referencia de envío;
- ownership `admission_migrator`, grants mínimos y RLS `ENABLE + FORCE`.

No se almacenan payloads de webhook, headers, firmas, destinatarios, asunto ni cuerpo en
las tablas nuevas. Las migraciones 17–20 permanecen inmutables.

## 3. Frontera con EduPay

El piloto termina en `oferta aceptada / matrícula pendiente`. La matrícula en EduPay es
un procedimiento manual controlado y fuera del runtime de Admisión. No existe importación
de padrón, llamada API, webhook, tabla compartida, credencial ni payload EduPay. La
integración técnica continúa diferida a E7/G7 y requiere una decisión independiente.

## 4. Validación ejecutada

| Control | Resultado |
| --- | --- |
| Migración fresh `0→21` | `PASS` |
| Migración incremental `20→21` | `PASS` |
| Sellos M21, cero seeds y checksums 17–20 | `PASS` |
| Suite funcional sin RLS | `48 suites / 665 tests PASS` |
| Suite RLS completa | `9 suites / 74 tests PASS` |
| Pruebas focales runtime/webhook/bootstrap/RLS | `18 / 18 PASS` |
| Lint | `PASS` |
| Typecheck | `PASS`, 4 proyectos |
| Build | `PASS`, database/web/API/worker |
| Coolify config smoke | `PASS` |
| E4 deployment smoke | `PASS` |
| Imágenes productivas | `PASS`, 4/4 |
| Secret scan | `PASS`, 393 archivos rastreados y no rastreados |
| Dependency audit | `PASS`, sin vulnerabilidades high/critical |
| `git diff --check` | `PASS` |

## 5. Decisiones y supuestos

- La VPS existente y Coolify son la plataforma seleccionada para preproducción.
- Cloudflare gestiona DNS/TLS y R2 será el destino externo del respaldo exclusivo del
  proyecto.
- Los cinco hostnames aprobados se configuran en Cloudflare/Coolify, no se hardcodean en
  imágenes ni código.
- El tenant inicial, cursos, cupos, proceso y calendario se configuran manualmente.
- Las familias ingresarán sus propios datos sólo después de aprobar legalmente el piloto.
- Los eventos `email.bounced` y `email.complained` suprimen nuevos envíos únicamente en el
  tenant correspondiente; levantar una supresión requiere un diseño futuro auditable.

## 6. Bloqueos antes de cualquier dato real

1. Completar `LP3-ART-001..016`, incluyendo contratos/DPA, retención, derechos, incidentes,
   transferencias y validación de roles.
2. Mantener salud/NEE deshabilitado hasta revisión jurídica específica. La Ley 21.719 se
   publicó el 2024-12-13 y entra en vigencia el 2026-12-01; hasta entonces también debe
   observarse el régimen vigente de la Ley 19.628.
3. Asegurar el panel de Coolify con TLS y un segundo control de acceso antes de operar con
   datos reales.
4. Ejecutar auditoría SSH read-only de capacidad, puertos, firewall, Docker, discos y
   convivencia con aplicaciones existentes.
5. Configurar y demostrar restore de PostgreSQL y objetos desde R2.
6. Configurar DNS/TLS, Resend, recursos privados y secrets únicamente en los gestores
   correspondientes.
7. Ejecutar smoke end-to-end sintético desplegado y aprobar formalmente el piloto.
8. Ejecutar DAST/pentest en la compuerta posterior acordada.

## 7. Compuerta

`P2 — PREPRODUCTION SYNTHETIC` queda técnicamente implementada pero no desplegada. La
siguiente acción humana es revisar el PR, proporcionar un canal seguro de acceso SSH para
la auditoría read-only y autorizar el despliegue sintético cuando el inventario de la VPS
confirme que no existe conflicto de recursos.
