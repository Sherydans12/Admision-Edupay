# G5-R6 — Registro de decisiones de hardening y preparación operativa

**Fecha:** 2026-08-24

**Estado:** `APPROVED / PARTIAL_EXECUTION / PREPRODUCTION_NO-GO`

**Fuente:** aprobación humana posterior a la auditoría read-only de la VPS
**Datos autorizados:** exclusivamente sintéticos

## 1. Hechos confirmados

- La VPS Hostinger está compartida con otras aplicaciones y administrada mediante
  Coolify 4.1.2.
- La auditoría read-only terminó sin reinicios, modificaciones, eliminaciones ni
  recreaciones.
- Se observaron puertos administrativos públicos, `root/password` habilitado,
  firewall de entrada insuficiente, ausencia de swap, unidades fallidas y ausencia de
  evidencia de backup externo/restore drill para Admisión.
- El repositorio permanece limpio en `main`, commit `dd8b7658f201e66c1c7a56b3cd41744682c27599`.
- Admisión y EduPay continúan desacoplados. El servicio `edupay-backup.service` no se
  modifica como parte de esta etapa.

## 2. Decisiones aprobadas R6-HARD

| ID | Decisión | Estado operativo |
| --- | --- | --- |
| `R6-HARD-001` | Mantener el proyecto Admisión aislado de las redes y recursos EduPay | `APPROVED / VERIFIED` |
| `R6-HARD-002` | Deshabilitar el dashboard/API de Traefik y realtime expuestos públicamente | `APPROVED / EXECUTED` |
| `R6-HARD-003` | Proteger el panel Coolify con Cloudflare Access | `APPROVED / EXECUTED` |
| `R6-HARD-004` | No cambiar por ahora el acceso SSH: root/password queda habilitado como excepción temporal | `APPROVED TEMPORARY EXCEPTION` |
| `R6-HARD-005` | No crear ahora un usuario SSH alternativo ni imponer llave-only/VPN/allowlist para SSH | `DEFERRED TO POSTPRODUCTION` |
| `R6-HARD-006` | Ejecutar actualizaciones del host y reinicio controlado en horario nocturno | `DEFERRED TO POSTPRODUCTION` |
| `R6-HARD-007` | Ventana operativa preferida: 21:00–07:00, zona local `America/Santiago` | `DEFERRED WITH R6-HARD-006` |
| `R6-HARD-008` | Configurar swap, límites de recursos y capacidad dedicada después de medir el host | `PARTIAL / SWAP 4 GiB EXECUTED` |
| `R6-HARD-009` | Configurar R2 privado, backups externos y restore drill sintético con la política propuesta | `DEFERRED TO PRODUCTION READINESS` |
| `R6-HARD-010` | Diagnosticar `edupay-backup.service` únicamente en read-only; no modificar EduPay | `APPROVED / READ-ONLY COMPLETED` |

La aprobación de `R6-HARD-004` y `R6-HARD-005` no equivale a aceptar SSH inseguro para
producción. Es una excepción temporal que mantiene el estado `NO-GO` hasta una decisión
posterior de postproducción.

## 3. Política R2 reservada para preparación de producción

R2 no se configura ni se crea como dependencia de preproducción sintética. La siguiente
política queda reservada para la preparación de producción, fuera del repositorio y sin
persistir credenciales:

- PostgreSQL: backup completo semanal, diferencial diario y WAL continuo.
- Retención inicial: 14 diarios, 8 semanales y 6 mensuales.
- Buckets/áreas privadas separadas para cuarentena, aprobados y dumps PostgreSQL.
- Credenciales distintas para API y worker.
- Versionado y lifecycle sujetos a revisión antes de datos reales.
- Restore en una base desechable, smoke sintético y reconciliación de registros/objetos.
- RPO técnico objetivo: `<= 1 hora`; el RTO se mide, no se presume como SLA.

## 4. Ejecución autorizada, en orden

La ejecución requiere acceso administrativo seguro al panel Coolify y una ventana
nocturna. No se deben introducir secretos en Git, issues, logs ni capturas.

1. Configurar Cloudflare Access para el panel Coolify y verificar que el acceso HTTPS
   administrativo funciona antes de cerrar la exposición pública equivalente.
2. Deshabilitar dashboard/API de Traefik y realtime, verificando que las aplicaciones
   existentes y Coolify continúan operativos.
3. Revisar y corregir firewall para conservar únicamente HTTP/HTTPS públicos y las
   rutas administrativas autorizadas; no modificar la política de autenticación SSH
   aprobada en `R6-HARD-004`.
4. Diferir a postproducción el parcheo del host, Docker/containerd y el reinicio
   controlado. Esta decisión prioriza estabilidad inmediata en la VPS compartida.
5. Configurar swap de 4 GiB (ejecutado); medir build y arranque antes de definir límites
   de CPU/memoria y capacidad dedicada para `admission-preprod`.
6. Crear PostgreSQL dedicado para preproducción; reservar ClamAV, redes y credenciales
   de objetos separadas para la preparación productiva.
7. Reservar R2, backups y restore drill para la preparación de producción; no crear
   buckets, URLs ni credenciales R2 durante preproducción sintética.
8. Configurar DNS/TLS, Resend sintético y Cloudflare Access.
9. Ejecutar el smoke de despliegue y rollback sin datos reales.

## 5. Bloqueadores que permanecen

- `P0-SSH-ROOT-PASSWORD`: root/password sigue habilitado por decisión explícita.
- La auditoría no demostró todavía TLS válido para todos los FQDN de preproducción.
- La capacidad durante el build core, cuatro servicios y PostgreSQL aún no está medida;
  la preparación productiva añadirá la medición de ClamAV y storage.
- R2, buckets, URLs y restore drill quedan diferidos a preparación de producción y no
  bloquean por sí mismos la preproducción sintética bajo esta decisión explícita.
- El timer Certbot heredado quedó deshabilitado después de confirmar que su único
  certificado estaba expirado y no tenía referencias activas; cualquier renovación
  futura requiere una decisión de producción.
- `edupay-backup.service` queda fuera de alcance de modificación y sólo admite lectura.
- Legal/privacy, piloto real, producción, DAST/pentest e integración API EduPay siguen
  fuera de autorización.

## 6. Compuerta siguiente

El siguiente paso humano es revisar la compuerta de preproducción con la excepción
explícita de mantenimiento Docker/R2. `R6-HARD-006` y `R6-HARD-007` se ejecutarán en
postproducción. `R6-HARD-009` se ejecutará antes de producción, con buckets privados,
credenciales separadas y restore drill. La preproducción sintética continúa `NO-GO`
por `P0-SSH-ROOT-PASSWORD` y por la capacidad/recursos dedicados aún no desplegados.

## 7. Addendum de ejecución — 2026-08-25

- DNS proxied y Cloudflare Access quedaron configurados para `coolify.baselogic.cl`.
- Traefik ya no publica dashboard/API ni el puerto `8080`; realtime no publica `6001`
  ni `6002`; Coolify no publica su puerto directo `8000`.
- UFW quedó activo con entrada limitada a SSH temporal, HTTP y HTTPS/HTTP3.
- Se configuró y validó un swap persistente de 4 GiB; no se aplicaron límites arbitrarios
  a EduPay.
- Coolify, Traefik, realtime, Docker y los sitios existentes se verificaron healthy.
- No se actualizaron Docker/containerd/Compose ni se reinició el host por decisión de
  estabilidad inmediata. No se creó snapshot porque no habrá parcheo en esta etapa.
- No se crearon buckets, URLs ni credenciales R2; el bucket existente de EduPay no se
  reutiliza.
- `edupay-backup.service` permaneció en diagnóstico read-only y Admisión continúa sin
  contenedores, redes ni datos desplegados.

## 8. Decisión posterior — preproducción core sin documentos (2026-08-25)

La autoridad del producto seleccionó la opción 1 para el inicio de preproducción:

- flujo permitido: registro, formularios, ofertas, aceptación y comunicaciones
  sintéticas;
- documentos, S3/R2, ClamAV, buckets, URLs y credenciales de objetos: fuera de alcance;
- `ADMISSION_DOCUMENTS_ENABLED=false` fijo en API y worker;
- rutas documentales: `403` fail-closed;
- worker: no crea adaptadores S3/ClamAV ni procesa jobs documentales;
- habilitación de documentos: sólo en preparación productiva, con R2 privado, revisión
  legal/proveedor, backups y restore drill.

Esta decisión reduce el consumo de recursos y evita provisionar storage o antivirus en la
VPS compartida durante la primera validación. No modifica el P0 SSH ni convierte la
preproducción en `GO`.
