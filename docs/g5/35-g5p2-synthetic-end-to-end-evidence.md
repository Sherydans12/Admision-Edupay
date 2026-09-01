# G5-P2 — Evidencia sintética de extremo a extremo

**Fecha:** 2026-09-01  
**Estado:** `PASS / SYNTHETIC / OFFER_ACTIVE_AWAITING_FAMILY_ACCEPTANCE`  
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

## Estado de persistencia

| Hecho | Estado |
| --- | --- |
| Application | `SUBMITTED` |
| Recommendation version 1 | `SUBMITTED` |
| Direction decision version 1 | `APROBADO` |
| Seat reservation | `ACTIVE` |
| Admission offer version 1 | `ACTIVE` |
| Offer acceptance | pendiente de acción de la familia |
| Documentos | fuera del recorrido sintético (`ADMISSION_DOCUMENTS_ENABLED=false`) |

La oferta tiene una expiración calculada por calendario laboral y conserva el
vínculo con su reserva. No se modificaron estados mediante SQL manual.

## Sesión y estabilidad web

El commit `fb9ac81` limita el refresco silencioso de sesión al recuperar el foco
de la ventana y evita reemplazar la vista por “Comprobando sesión” durante una
actualización en segundo plano. El despliegue Coolify `33519318374` terminó con
validación y health checks exitosos. La vista de Dirección permaneció con sesión
activa y sin errores de consola durante la observación posterior.

## Siguiente operación manual

Cerrar la sesión de Dirección desde el botón visible y entrar con la cuenta
familiar sintética autorizada. En **Familia → Mis postulaciones**, abrir la
postulación y aceptar la oferta activa. Esa aceptación debe ser ejecutada por la
familia; no se debe insertar ni alterar el registro directamente en la base.

Después de la aceptación se verificará el `OfferAcceptance`, la transición de la
reserva y el `IntegrationHandoff` local. Este último sólo representa una solicitud
de integración futura: no es matrícula, pago ni conexión técnica con EduPay.

## Límites

- Sólo datos, identidades y correos sintéticos.
- No se habilita producción ni piloto con datos reales.
- No se importan estudiantes/apoderados desde EduPay.
- No se cargan documentos ni se activa almacenamiento productivo.
- La infraestructura y secretos productivos (R2, backups y políticas finales de
  retención) siguen pendientes de la compuerta de preparación productiva.
