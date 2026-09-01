# G5-P2 — Evidencia sintética de extremo a extremo

**Fecha:** 2026-09-01  
**Estado:** `PASS / SYNTHETIC / LOCAL_HANDOFF_REQUESTED`  
**Tenant:** `synthetic-school` (`cd565ac0-362d-5ea1-a1f5-42aa111a63a3`)  
**Application:** `4e9cce7f-5334-4485-97be-250de4428493`

## Recorrido confirmado

Se ejecutó con cuentas sintéticas y sin documentos reales:

1. La familia registró estudiante, autoridad y postulación.
2. La autoridad familiar fue verificada.
3. La postulación quedó `SUBMITTED` con snapshot inmutable.
4. Atención creó y envió a Dirección una recomendación `SUBMITTED` con opción
   `RECOMENDAR_ADMISION`.
5. Dirección registró la versión V1 con disposición `APROBADO`.
6. La operación atómica creó una reserva de cupo `ACTIVE` y una oferta.
7. La familia aceptó expresamente la oferta vigente.
8. Dirección registró el `IntegrationHandoff` local.

## Estado de persistencia

| Hecho | Estado |
| --- | --- |
| Application | `SUBMITTED` |
| Recommendation version 1 | `SUBMITTED` |
| Direction decision version 1 | `APROBADO` |
| Seat reservation | `ACTIVE` |
| Admission offer version 1 | `ACTIVE` |
| Offer acceptance | registrado |
| IntegrationHandoff | `REQUESTED` por Dirección |
| Documentos | fuera del recorrido sintético (`ADMISSION_DOCUMENTS_ENABLED=false`) |

La oferta tiene una expiración calculada por calendario laboral y conserva el
vínculo con su reserva. No se modificaron estados mediante SQL manual.

## Sesión y estabilidad web

El commit `fb9ac81` limita el refresco silencioso de sesión al recuperar el foco
de la ventana y evita reemplazar la vista por “Comprobando sesión” durante una
actualización en segundo plano. El despliegue Coolify `33519318374` terminó con
validación y health checks exitosos. La vista de Dirección permaneció con sesión
activa y sin errores de consola durante la observación posterior.

## Límite funcional alcanzado

La aceptación fue ejecutada por la familia y el handoff fue solicitado por
Dirección desde **Atención → Cupos, espera y ofertas**. La base confirmó un único
`OfferAcceptance` y un único `IntegrationHandoff` vinculado a la misma oferta y
postulación. No se insertaron ni alteraron estos registros mediante SQL manual.

`IntegrationHandoff = REQUESTED` sólo representa una solicitud local de
integración futura: no es matrícula, pago ni conexión técnica con EduPay.

## Límites

- Sólo datos, identidades y correos sintéticos.
- No se habilita producción ni piloto con datos reales.
- No se importan estudiantes/apoderados desde EduPay.
- No se cargan documentos ni se activa almacenamiento productivo.
- La infraestructura y secretos productivos (R2, backups y políticas finales de
  retención) siguen pendientes de la compuerta de preparación productiva.
