# G5-P2 — Evidencia de operador sintético y recomendación

**Fecha:** 2026-09-01  
**Estado:** `PASS / SYNTHETIC / RECOMMENDATION_SUBMITTED`  
**Tenant:** `synthetic-school` (`cd565ac0-362d-5ea1-a1f5-42aa111a63a3`)  
**Application:** `4e9cce7f-5334-4485-97be-250de4428493`

## 1. Provisión de acceso

La cuenta sintética `admissions-operator@resend.dev` estaba activa y verificada antes
de la provisión. Se ejecutó la operación one-shot dentro del contenedor API desplegado,
con resultado transaccional exitoso:

- membership activa creada;
- rol `synthetic.admissions.operator` creado;
- auditoría de provisión creada;
- scope tenant `*` limitado al tenant sintético;
- permisos efectivos: `application.read`, `application.recommend` y `restricted.read`.

No se concedieron `application.decide`, `platform.support.elevate`, acceso a EduPay,
datos reales ni permisos globales.

## 2. Flujo verificado

1. El workspace de Atención dejó de mostrar un falso “sin acceso” después de que la
   interfaz comenzó a consultar `staff/tenants/:tenantId/access/me` para el tenant
   actualmente seleccionado.
2. La cuenta cargó la postulación sintética por su identificador exacto.
3. Se creó un fundamento sintético y se guardó como versión `DRAFT 1`.
4. Se confirmó el envío a Dirección; la versión quedó `SUBMITTED` e inmutable.
5. La API respondió correctamente sin nuevos `HTTP_REQUEST_FAILED` en los logs del
   contenedor durante la verificación.

## 3. Cambios desplegados

| Commit | Resultado |
| --- | --- |
| `22e1c61` | Provisionador one-shot del operador sintético |
| `9f29a00` | `restricted.read` requerido por la autorización de recomendación |
| `1856a03` | Renovación tenant-scoped de permisos en la UI |

Redeploy final validado por el workflow `Deploy synthetic preproduction to Coolify`,
run `33515880536`, con `validate-deployment` y `deploy` en `success`.

## 4. Próxima compuerta

La decisión de Dirección exige una segunda cuenta sintética, separada del recomendador,
para cumplir separación de funciones. Debe registrarse y verificarse
`admissions-director@resend.dev`; sus permisos se provisionarán en una operación
one-shot independiente y limitada. No se reutilizará `admin.synthetic` ni el operador
de recomendaciones.
