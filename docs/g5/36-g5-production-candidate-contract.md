# G5 — Contrato de candidato productivo sintético

## 1. Propósito y límite

Este documento deja preparado un artefacto de Coolify y un workflow separado para
un **candidato productivo sintético**. No autoriza por sí solo datos reales, piloto,
correo real, documentos reales, matrícula, pago, integración con EduPay ni el cierre
legal/privacy. La aplicación puede desplegarse para validar topología y operación con
identidades `@resend.dev` únicamente cuando exista una aprobación humana específica para
esa ejecución.

La preproducción continúa usando [`compose.coolify.yaml`](../../compose.coolify.yaml) y
el workflow `Deploy synthetic preproduction to Coolify`. El candidato productivo usa
[`compose.coolify.production.yaml`](../../compose.coolify.production.yaml) y el workflow
`Deploy synthetic production candidate to Coolify`; no se deben intercambiar los dos
archivos ni sus ambientes de GitHub.

## 2. Estado de entrada

| Control | Estado |
| --- | --- |
| `main` | PR #18 integrado; último commit conocido `69077c5` al iniciar esta fase |
| Preproducción sintética | Desplegada y health pública validada por workflow |
| Documentos en preproducción | Deshabilitados (`ADMISSION_DOCUMENTS_ENABLED=false`) |
| Correo | Sintético (`EMAIL_DELIVERY_MODE=synthetic`); no hay autorización de entrega real |
| Dominios productivos | Decisión de trabajo: `admision.baselogic.cl` y `admision-api.baselogic.cl` |
| VPS | Hostinger/Coolify compartido; PostgreSQL productivo dedicado aún no provisionado |
| R2 y restore drill | Pendientes; no se reutiliza el bucket de EduPay |
| Cuota 7/8 GiB | Requisito aprobado como objetivo de producto, implementación pendiente |
| Legal/privacy y acto de piloto | Pendientes; no se infieren por un merge o un deploy técnico |

## 3. Cambios técnicos de esta fase

- Se agregó `compose.coolify.production.yaml`, con nombre de proyecto
  `admission-production`, sin `ports:` públicos y con los mismos controles de imagen,
  migración, healthcheck, `read_only`, `cap_drop` y `no-new-privileges` de preproducción.
- La bandera de documentos y el permiso de correo real son variables de entorno con
  default seguro (`false`). Activar documentos sin S3/ClamAV hace fallar el proceso de
  arranque; no se degrada silenciosamente a almacenamiento local.
- S3-compatible y ClamAV quedan cableados sólo como variables opcionales del runtime.
  El ejemplo no contiene credenciales y mantiene `S3_ALLOW_INSECURE_INTERNAL=false`.
- Se agregó `.env.coolify.production.example` con placeholders `.invalid`; nunca se
  debe copiar este archivo con sus valores de ejemplo a producción sin reemplazar cada
  variable en el almacén de secretos de Coolify.
- Se agregó `scripts/g5production-config-smoke.mjs` y el script
  `pnpm g5production:config:smoke` para validar el contrato sin secretos.
- Se agregó `.github/workflows/deploy-production-coolify.yml`. Es manual, exige la
  confirmación exacta `PRODUCTION_SYNTHETIC`, usa el environment `admission-production`,
  requiere Service Token de Cloudflare Access y verifica el SHA desplegado y los health
  URLs configurados como variables del environment.
- El contrato de dependencias mantiene overrides exactos para `fast-uri 3.1.6`,
  `qs 6.16.0` y `mysql2 3.23.1`, que eliminan las alertas conocidas de alta/moderada severidad
  reportadas por la auditoría al preparar este candidato. Estos overrides requieren
  revisión cuando Prisma publique versiones que los incorporen oficialmente.

## 4. Provisión manual en Coolify

La persona administradora debe realizar estos pasos sin pegar secretos en chat,
issues, commits o capturas:

1. Crear un proyecto/entorno exclusivo para Admisión productiva (recomendado:
   `Admission` / `admission-production`) y una aplicación Git-based desde
   `Sherydans12/Admision-Edupay`, rama `main`.
2. Seleccionar Docker Compose y el archivo exacto
   `/compose.coolify.production.yaml`. Mantener Auto Deploy desactivado hasta cerrar
   el gate de release.
3. Crear PostgreSQL **dedicado**, sin dominio y sin port mapping público, conectado a la
   red privada del stack. Usar una base distinta (`admission_production`) y los roles
   `admission_migrator` y `admission_app` con contraseñas distintas. El hostname debe
   ser el alias interno que entregue Coolify; nunca `localhost`.
4. Configurar el target del servicio `web` en el puerto interno `3000` y el de `api` en
   `3001`. No agregar `:3000` ni `:3001` a los FQDN públicos.
5. Asignar sólo estos dominios al proxy de Coolify:
   - `https://admision.baselogic.cl` → `web:3000`.
   - `https://admision-api.baselogic.cl` → `api:3001`.
   `worker`, `migrator` y PostgreSQL no reciben dominio.
6. Cargar las variables del ejemplo. Para el primer candidato conservar:
   `ADMISSION_DOCUMENTS_ENABLED=false`, `EMAIL_DELIVERY_MODE=synthetic` y
   `REAL_EMAIL_DELIVERY_AUTHORIZED=false`. Las URLs de base requieren las dos
   contraseñas codificadas como URL y el hostname privado de Coolify.
7. No ejecutar el perfil `bootstrap` como parte del deploy normal. Un bootstrap de
   tenant requiere un cambio separado, identidad aprobada y registro de auditoría.

## 5. Cloudflare y TLS

- Crear registros `A` proxied para `admision` y `admision-api` apuntando a la IP de la
  VPS, si aún no existen.
- Usar `Full (strict)` sólo después de verificar por SNI que el origen presenta un
  certificado válido para cada hostname. El certificado por defecto de Traefik no es
  evidencia suficiente.
- Mantener una regla de caché `Omitir caché` para el API. No cachear cookies, respuestas
  privadas, descargas autenticadas ni solicitudes `OPTIONS`.
- Mantener el límite del edge en al menos 10 MiB cuando se aprueben documentos. Con la
  bandera deshabilitada no se habilita todavía el flujo de archivos.
- El panel de Coolify permanece protegido por Cloudflare Access; el workflow utiliza
  `CF-Access-Client-Id` y `CF-Access-Client-Secret`, nunca un bypass.

## 6. Environment de GitHub

Crear el environment `admission-production` con protección manual y, como mínimo:

**Secrets** (valores sólo en GitHub/Coolify, nunca en el repositorio):

- `COOLIFY_DEPLOY_TOKEN` — token limitado a lectura/deploy.
- `COOLIFY_DEPLOY_WEBHOOK` — POST `/api/v1/deploy?uuid=<UUID_PRODUCTIVO>`.
- `COOLIFY_API_BASE_URL` — `https://coolify.baselogic.cl/api/v1`.
- `CF_ACCESS_CLIENT_ID` y `CF_ACCESS_CLIENT_SECRET` — Service Token de Cloudflare Access.

**Variables:**

- `PRODUCTION_API_HEALTH_URL` — `https://admision-api.baselogic.cl/health/ready`.
- `PRODUCTION_WEB_HEALTH_URL` — `https://admision.baselogic.cl/`.

El workflow no se debe ejecutar hasta confirmar en Coolify que el webhook pertenece al
recurso productivo y que el SHA que se va a desplegar corresponde a `main`.

## 7. R2, ClamAV y cuota de almacenamiento

R2 queda reservado para la preparación productiva. Antes de habilitar documentos se
requiere:

- dos buckets privados separados (cuarentena/aprobados) y un destino separado para
  dumps PostgreSQL;
- credenciales diferentes para API y worker, con permisos mínimos;
- lifecycle, versionado, retención y restore drill aprobados;
- ClamAV dedicado en red privada y prueba fail-closed;
- medición verificable de bytes y una política transaccional de aviso a 7 GiB y bloqueo
  a 8 GiB.

El adapter actual guarda `DocumentVersion.sizeBytes`, pero todavía no implementa una
fuente de uso de bucket ni una reserva atómica de cuota. Por eso esta fase **no** activa
documentos ni afirma que el límite 7/8 GiB esté operativo. Esa implementación debe ser
un incremento técnico separado con migración/tests de concurrencia, reconciliación y
restore antes de cargar cualquier documento.

## 8. Compuertas restantes

| Gate | Estado | Evidencia faltante |
| --- | --- | --- |
| Contrato Compose/workflow | `READY_FOR_REVIEW` | CI verde y revisión del PR |
| Coolify productivo | `NOT_PROVISIONED` | inventario de recursos y aislamiento privado |
| R2/ClamAV | `PENDING` | buckets, credenciales, restore y fail-closed |
| Backup PostgreSQL | `PENDING` | backup externo, retención y restore medido |
| Monitoring/alerting/on-call | `PENDING` | Grafana/alertas/runbooks y simulacro |
| Cuota 7/8 GiB | `PENDING_IMPLEMENTATION` | diseño, migración/API/UI/tests |
| Legal/privacy (`LP3-ART-001..016`) | `OPEN` | revisión institucional y legal fechada |
| Piloto/datos reales | `NOT_AUTHORIZED` | acto humano separado con tenant, commit, ventana y stop |

## 9. Validación de repositorio

En esta fase se ejecutaron `pnpm install --frozen-lockfile`, Prisma Generate, lint,
typecheck, build, `pnpm test` (53 archivos / 686 pruebas), ambos smokes de Compose,
`pnpm security:secrets`, `pnpm security:deps` y parseo YAML de los workflows. Todos
quedaron en verde; la auditoría de dependencias no reportó vulnerabilidades conocidas.
`pnpm format:check` sigue siendo una compuerta histórica no verde por archivos
preexistentes fuera de esta fase y no se reformateó masivamente el repositorio.

El único resultado que puede obtenerse con este workflow es un **candidato productivo
sintético técnicamente saludable**. No cambia las compuertas G5/E6 ni autoriza a invitar
familias, registrar alumnos reales, activar correo real o integrar EduPay.
