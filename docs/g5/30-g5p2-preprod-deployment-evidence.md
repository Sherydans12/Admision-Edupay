# G5-P2 — Evidencia de despliegue de preproducción sintética

**Fecha de verificación:** 2026-08-28  
**Estado:** `DEPLOYED / SYNTHETIC / CORE HEALTH PASS`  
**Repositorio:** `Sherydans12/Admision-Edupay`  
**Workflow:** `Deploy synthetic preproduction to Coolify`  
**Run:** [#16](https://github.com/Sherydans12/Admision-Edupay/actions/runs/33134132231)  
**Commit desplegado:** `ec8e6dc877715f7c68ad96f802c1ee2135d8bc14`

## 1. Resultado

El despliegue de la preproducción core, exclusivamente sintética y con documentos
deshabilitados, terminó correctamente en Coolify. El workflow validó el contrato,
solicitó el despliegue mediante `POST`, esperó la revisión solicitada y comprobó la
salud pública antes de finalizar en `success`.

No se usaron datos reales, documentos reales, destinatarios reales ni integración con
EduPay.

## 2. Evidencia de runtime

| Control | Resultado |
| --- | --- |
| Migrator | `exit 0` |
| API | `running / healthy` |
| Web | `running / healthy` |
| Worker | `running / healthy` |
| API `/health/live` | HTTP `200` |
| API `/health/ready` | HTTP `200` |
| Web `/` | HTTP `200` |
| CORS preflight desde el origin web | HTTP `204`, origin exacto y credenciales habilitadas |
| Ruta familiar sin sesión | HTTP `401` esperado |
| Placeholder de tenant en bundle web | Ausente |
| Documentos | Deshabilitados por configuración core |

## 3. Interpretación de los `401`

Las rutas familiares requieren una sesión autenticada y contexto de tenant. Por eso,
una navegación anónima puede mostrar el mensaje de sesión/tenant sintético y registrar
`401`. Esto no representa una caída de API ni un fallo de CORS. La prueba funcional
autenticada requiere completar el registro/verificación de una cuenta sintética y
provisionar el tenant, membership, cursos y ofertas sintéticas.

## 4. Pendientes de la siguiente compuerta

1. Configurar o confirmar el transporte de correo sintético Resend y un remitente
   permitido; no activar entrega real.
2. Registrar/verificar una cuenta sintética y ejecutar el bootstrap idempotente del
   tenant con una operación one-shot controlada (`docker compose --profile bootstrap
   run --rm tenant-bootstrap`).
3. Cargar manualmente sede, año, niveles, proceso, ofertas, cupos y calendario
   sintéticos mediante superficies tenant-scoped.
4. Ejecutar el smoke autenticado hasta `oferta aceptada / matrícula pendiente`.
5. Conservar documentos, R2, ClamAV, EduPay y datos reales fuera de esta etapa.

La producción permanece `NO-GO` hasta cerrar sus controles operativos, legales,
privacidad, backups/restore, proveedores, hardening y autorización formal del piloto.

## 5. Redeploy de la capacidad de bootstrap

**Run posterior:** [#17](https://github.com/Sherydans12/Admision-Edupay/actions/runs/33177715698)  
**Commit desplegado:** `d65549921b42b05d2cdb715c9e73f9b953b53f14`  
**Resultado:** `success`

Este redeploy incorporó el servicio `tenant-bootstrap` con perfil Compose `bootstrap`.
El servicio no se inicia en `docker compose up -d`; sólo se ejecuta mediante una
invocación one-shot explícita y con variables sintéticas temporales. La verificación
pública posterior mantuvo web `200`, API live/ready `200`, CORS preflight `204` y
rechazo `401` para rutas familiares sin sesión.
