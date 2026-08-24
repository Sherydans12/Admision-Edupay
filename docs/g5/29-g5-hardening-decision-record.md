# G5-R6 — Registro de decisiones de hardening y preparación operativa

**Fecha:** 2026-08-24  
**Estado:** `APPROVED / EXECUTION_PENDING / PREPRODUCTION_NO-GO`  
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
- El repositorio permanece limpio en `main`, commit `3cc52b2`.
- Admisión y EduPay continúan desacoplados. El servicio `edupay-backup.service` no se
  modifica como parte de esta etapa.

## 2. Decisiones aprobadas R6-HARD

| ID | Decisión | Estado operativo |
| --- | --- | --- |
| `R6-HARD-001` | Mantener el proyecto Admisión aislado de las redes y recursos EduPay | `APPROVED` |
| `R6-HARD-002` | Deshabilitar el dashboard/API de Traefik y realtime expuestos públicamente | `APPROVED / EXECUTION_PENDING` |
| `R6-HARD-003` | Proteger el panel Coolify con Cloudflare Access | `APPROVED / EXECUTION_PENDING` |
| `R6-HARD-004` | No cambiar por ahora el acceso SSH: root/password queda habilitado como excepción temporal | `APPROVED TEMPORARY EXCEPTION` |
| `R6-HARD-005` | No crear ahora un usuario SSH alternativo ni imponer llave-only/VPN/allowlist para SSH | `DEFERRED TO POSTPRODUCTION` |
| `R6-HARD-006` | Ejecutar actualizaciones del host y reinicio controlado en horario nocturno | `APPROVED` |
| `R6-HARD-007` | Ventana operativa preferida: 21:00–07:00, zona local `America/Santiago` | `APPROVED / SCHEDULING REQUIRED` |
| `R6-HARD-008` | Configurar swap, límites de recursos y capacidad dedicada después de medir el host | `APPROVED / EXECUTION_PENDING` |
| `R6-HARD-009` | Configurar R2 privado, backups externos y restore drill sintético con la política propuesta | `APPROVED / EXECUTION_PENDING` |
| `R6-HARD-010` | Diagnosticar `edupay-backup.service` únicamente en read-only; no modificar EduPay | `APPROVED / READ-ONLY` |

La aprobación de `R6-HARD-004` y `R6-HARD-005` no equivale a aceptar SSH inseguro para
producción. Es una excepción temporal que mantiene el estado `NO-GO` hasta una decisión
posterior de postproducción.

## 3. Política R2 aprobada para la siguiente ejecución

La configuración de R2 se realizará fuera del repositorio y sin persistir credenciales:

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
4. En la ventana 21:00–07:00, parchear el host, Docker/containerd y reiniciar con
   comprobación de acceso y servicios existentes.
5. Configurar swap y límites de CPU/memoria; medir build y arranque del stack antes de
   crear el environment `admission-preprod`.
6. Crear PostgreSQL y ClamAV dedicados, redes privadas y credenciales separadas.
7. Configurar R2, backups y restore drill sintético.
8. Configurar DNS/TLS, Resend sintético y Cloudflare Access.
9. Ejecutar el smoke de despliegue y rollback sin datos reales.

## 5. Bloqueadores que permanecen

- `P0-SSH-ROOT-PASSWORD`: root/password sigue habilitado por decisión explícita.
- La auditoría no demostró todavía TLS válido para todos los FQDN de preproducción.
- La capacidad durante build + cuatro servicios + PostgreSQL + ClamAV aún no está
  medida.
- R2 y restore drill aún no están ejecutados.
- `certbot.service` continúa requiriendo diagnóstico/corrección.
- `edupay-backup.service` queda fuera de alcance de modificación y sólo admite lectura.
- Legal/privacy, piloto real, producción, DAST/pentest e integración API EduPay siguen
  fuera de autorización.

## 6. Compuerta siguiente

El siguiente paso humano es proporcionar una ventana nocturna concreta y habilitar el
acceso administrativo a Cloudflare/Coolify para ejecutar `R6-HARD-002`, `003`, `006`,
`008` y `009`. La preproducción sintética sólo podrá pasar a `GO` cuando los P0/P1
restantes tengan evidencia de cierre o una aprobación explícita de excepción para el
ambiente correspondiente.
