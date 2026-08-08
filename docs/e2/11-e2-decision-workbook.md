# E2 — Decision workbook

**Estado:** `PROPOSED / READY FOR HUMAN DECISIONS`

**Compuerta:** G2 `NO APROBADA`

**Regla:** ninguna recomendación de este documento equivale a `ACCEPTED`.

## Convenciones

| Estado | Significado |
|---|---|
| `PROPOSED` | Alternativa documentada, aún no recomendada formalmente para G2 |
| `RECOMMENDED_FOR_G2` | Existe recomendación concreta lista para decisión humana |
| `DEFERRED` | Puede cerrarse en una etapa posterior sin bloquear G2 |
| `BLOCKED` | Falta información que impide formular una recomendación responsable |

## Resumen

| ID | Decisión | Recomendación | Estado |
|---|---|---|---|
| E2-D-001 | Estilo arquitectónico | Modular monolith | `RECOMMENDED_FOR_G2` |
| E2-D-002 | Stack principal | Alineación principal con EduPay | `RECOMMENDED_FOR_G2` |
| E2-D-003 | Repositorio/tooling | Monorepo Admisión con pnpm workspaces | `RECOMMENDED_FOR_G2` |
| E2-D-004 | Base transaccional | PostgreSQL 15 compatible | `RECOMMENDED_FOR_G2` |
| E2-D-005 | Estrategia tenant | Shared database/shared schema + tenantId | `RECOMMENDED_FOR_G2` |
| E2-D-006 | RLS | Defensa adicional desde primera persistencia, validada por PoC | `RECOMMENDED_FOR_G2` |
| E2-D-007 | Identidad/sesión | Identidad común + sesión híbrida con refresh rotatorio | `RECOMMENDED_FOR_G2` |
| E2-D-008 | Autorización | RBAC + tenant/recurso/scope/sensibilidad/propósito | `RECOMMENDED_FOR_G2` |
| E2-D-009 | Archivos | Object storage privado S3-compatible | `RECOMMENDED_FOR_G2` |
| E2-D-010 | Malware | Cuarentena + escaneo fail-closed | `RECOMMENDED_FOR_G2` |
| E2-D-011 | Jobs | PostgreSQL-backed jobs + outbox + worker | `RECOMMENDED_FOR_G2` |
| E2-D-012 | Email | Adaptador de proveedor + reintentos; estado separado | `RECOMMENDED_FOR_G2` |
| E2-D-013 | Auditoría | AuditEvent append-only conceptual, separado de logs | `RECOMMENDED_FOR_G2` |
| E2-D-014 | Deployment | Runtime Linux containerizado + servicios administrados selectivos | `RECOMMENDED_FOR_G2` |
| E2-D-015 | Observabilidad | Logs estructurados, métricas, errores y security events separados | `RECOMMENDED_FOR_G2` |
| E2-D-016 | Backup/recuperación | Backup coordinado y restore probado; RPO/RTO propuestos | `RECOMMENDED_FOR_G2` |
| E2-D-017 | Testing | Pirámide con DB real, seguridad y E2E P0 | `RECOMMENDED_FOR_G2` |

## Decisiones detalladas

### E2-D-001 — Estilo arquitectónico

- **Problema:** separar responsabilidades sin sobredimensionar operación.
- **Opciones:** modular monolith; microservices; monolito sin módulos estrictos.
- **Recomendación:** modular monolith con web, API y worker desplegables, módulos internos y ownership explícito.
- **Motivo:** cubre consistencia, equipo y MVP; conserva fronteras extraíbles.
- **Riesgos:** acoplamiento interno si no se fiscalizan imports y datos.
- **Reversibilidad:** media; módulos pueden extraerse por evidencia.
- **Costo:** bajo-medio frente a microservicios.
- **Dependencias:** E2-D-003, E2-D-011, ADR-0002.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-002 — Stack principal

- **Problema:** equilibrar velocidad, seguridad e integración futura.
- **Opciones:** alineación principal; parcial; stack independiente.
- **Recomendación:** NestJS 11/TypeScript/Prisma 7, Next.js 16/React 19 y PostgreSQL 15, validando versiones al fundar E3/E4.
- **Motivo:** experiencia y lenguaje compartidos sin compartir dominio ni datos.
- **Riesgos:** heredar restricciones o confundir Passport con sesión completa.
- **Reversibilidad:** alta antes de scaffolding, baja después.
- **Costo:** menor curva inicial; operación propia de Admisión.
- **Dependencias:** ADR-0001, E2-D-007 y E2-D-014.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-003 — Repositorio y workspaces

- **Problema:** coordinar web, API, worker y contratos sin crear dependencias cíclicas.
- **Opciones:** monorepo; multirepo; compartir repo con EduPay.
- **Recomendación:** monorepo independiente de EduPay, pnpm workspaces y Turborepo ligero sólo si aporta caché/orquestación; no Nx inicialmente.
- **Motivo:** cambios atómicos y reglas de imports con bajo overhead.
- **Riesgos:** `shared` convertido en dominio común indiscriminado.
- **Reversibilidad:** media-alta.
- **Costo:** bajo; una cadena de CI.
- **Dependencias:** E2-D-001 y E2-D-002.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-004 — Base transaccional

- **Problema:** consistencia de cupos, versiones, auditoría y jobs.
- **Opciones:** PostgreSQL; otra base relacional; persistencia políglota inicial.
- **Recomendación:** PostgreSQL 15 o versión compatible aprobada.
- **Motivo:** transacciones, constraints, locks y posible RLS satisfacen riesgos centrales.
- **Riesgos:** dependencia crítica y necesidad de operación/backup.
- **Reversibilidad:** baja después del modelo físico.
- **Costo:** conocido; administrado aumenta costo y reduce carga operativa.
- **Dependencias:** E2-D-005, E2-D-006, E2-D-011 y E2-D-016.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-005 — Estrategia multiempresa

- **Problema:** aislar tenants sin multiplicar operación del MVP.
- **Opciones:** database-per-tenant; schema-per-tenant; shared schema + tenantId; híbrido.
- **Recomendación:** shared database/shared schema con `tenantId` obligatorio y ruta futura a aislamiento dedicado.
- **Motivo:** onboarding, migraciones y reporting operables con defensa en profundidad.
- **Riesgos:** una omisión de filtro puede filtrar datos si fallan las demás defensas.
- **Reversibilidad:** media; extracción futura requiere tooling.
- **Costo:** menor en MVP.
- **Dependencias:** E2-D-004, E2-D-006, AC-050/051.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-006 — PostgreSQL Row Level Security

- **Problema:** añadir defensa ante consultas sin filtro tenant.
- **Opciones:** sólo aplicación; RLS obligatoria; RLS selectiva/posterior.
- **Recomendación:** RLS para tablas tenant-owned desde la primera persistencia, condicionada a un PoC de contexto, pooling, migraciones y Prisma antes de G4.
- **Motivo:** reduce impacto de un error de aplicación.
- **Riesgos:** falso sentido de seguridad, bypass por rol y contexto filtrado entre conexiones.
- **Reversibilidad:** media.
- **Costo:** medio en diseño/testing.
- **Dependencias:** E2-D-004/005 y estrategia de sesiones DB.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-007 — Identidad y sesiones

- **Problema:** servir familias, personal y plataforma con revocación segura.
- **Opciones:** JWT bearer/refresh cliente; sesión server-side; híbrido cookie + refresh opaco.
- **Recomendación:** identidad global común, memberships tenant; access token corto en cookie HttpOnly y refresh opaco rotatorio, hasheado y revocable.
- **Motivo:** combina autorización local verificable con revocación y detección de reuso.
- **Riesgos:** CSRF y complejidad de rotación; deben diseñarse explícitamente.
- **Reversibilidad:** media antes de contratos públicos.
- **Costo:** medio.
- **Dependencias:** E2-D-008, Q-204 y threat model.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-008 — Autorización y separación de funciones

- **Problema:** un rol aislado no expresa tenant, sensibilidad ni propósito.
- **Opciones:** RBAC simple; ABAC completo; combinación de capacidades y atributos.
- **Recomendación:** deny-by-default con RBAC/capacidades más tenant, recurso, scope, sensibilidad, propósito y reglas de separación.
- **Motivo:** refleja la especificación funcional y SELF-ELEVATION.
- **Riesgos:** matriz compleja y drift entre interfaz/API.
- **Reversibilidad:** media.
- **Costo:** medio-alto en pruebas.
- **Dependencias:** AC-023/028/050..054, E2-D-005/007.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-009 — Almacenamiento de archivos

- **Problema:** documentos sensibles no caben de forma segura en filesystem efímero/público.
- **Opciones:** filesystem local; object storage S3-compatible; servicio documental administrado.
- **Recomendación:** object storage privado S3-compatible, proveedor diferido.
- **Motivo:** claves aleatorias, URLs controladas, versionado y escalado independiente.
- **Riesgos:** proveedor, residencia, costo y URLs filtradas.
- **Reversibilidad:** media mediante adaptador e inventario.
- **Costo:** variable por almacenamiento/egress.
- **Dependencias:** Q-203, E2-D-010/014/016, ADR-0004.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-010 — Pipeline antimalware

- **Problema:** una carga no confiable puede dañar usuarios y operación.
- **Opciones:** sin escaneo; motor aislado autogestionado; servicio administrado.
- **Recomendación:** cuarentena y validación antes de escaneo fail-closed; motor concreto después de evaluar deployment/proveedor.
- **Motivo:** ningún archivo queda disponible antes de aprobarse.
- **Riesgos:** falsos positivos, archivos protegidos y motor caído.
- **Reversibilidad:** alta tras una interfaz estable.
- **Costo:** medio, dependiente de volumen.
- **Dependencias:** E2-D-009/011/014, Q-207.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-011 — Jobs, scheduler y outbox

- **Problema:** email, expiraciones y escaneo necesitan ejecución durable.
- **Opciones:** proceso simple; Redis/BullMQ; jobs PostgreSQL; cron únicamente.
- **Recomendación:** jobs PostgreSQL + outbox transaccional + worker separado; cron sólo dispara scheduler; Redis diferido.
- **Motivo:** mínima infraestructura con consistencia y reintento auditable.
- **Riesgos:** presión sobre DB y claims mal diseñados.
- **Reversibilidad:** alta si existe interfaz de queue.
- **Costo:** bajo-medio.
- **Dependencias:** E2-D-004/012/014.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-012 — Email

- **Problema:** enviar y observar email sin acoplar estado de negocio al proveedor.
- **Opciones:** SMTP directo; API administrada; adaptador intercambiable.
- **Recomendación:** adaptador con proveedor por decidir, outbox/jobs, idempotencia y estados `PREPARED/SENT/DELIVERED/FAILED`.
- **Motivo:** fallo de email no altera decisión (`AC-045`).
- **Riesgos:** entregabilidad, callbacks falsos y costo.
- **Reversibilidad:** alta.
- **Costo:** por volumen/proveedor.
- **Dependencias:** E2-D-011, Q-203/207.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-013 — Auditoría

- **Problema:** demostrar acciones sensibles sin convertir logs en repositorio de datos.
- **Opciones:** logs técnicos; tabla/event stream de auditoría; servicio externo.
- **Recomendación:** `AuditEvent` append-only conceptual, tenant-aware, con actor/effective actor/purpose/correlation y metadatos allowlisted.
- **Motivo:** trazabilidad institucional y de soporte separada del diagnóstico.
- **Riesgos:** volumen, acceso abusivo y retención legal pendiente.
- **Reversibilidad:** baja para formato histórico; exportable por adaptador.
- **Costo:** medio.
- **Dependencias:** C-013, Q-201/202/208, E2-D-008/016.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-014 — Deployment/runtime

- **Problema:** soportar SSR, API, worker, scheduler y antivirus de forma operable.
- **Opciones:** cPanel/Passenger; VPS Linux; plataforma administrada; híbrido.
- **Recomendación:** runtime Linux containerizado con reverse proxy y servicios administrados selectivos; no asumir cPanel productivo.
- **Motivo:** procesos persistentes, portabilidad y controles operativos.
- **Riesgos:** capacidad DevOps y costo del proveedor.
- **Reversibilidad:** media si artefactos y storage son portables.
- **Costo:** medio, pendiente de cotización.
- **Dependencias:** E2-D-009..012/015/016, ADR-0005.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-015 — Observabilidad

- **Problema:** detectar fallos sin exponer datos personales.
- **Opciones:** logs locales; stack autogestionado; servicios administrados.
- **Recomendación:** contrato de señales estructuradas y sanitizadas, proveedor diferido.
- **Motivo:** logs, auditoría, security events y métricas tienen propósitos distintos.
- **Riesgos:** costo, ruido, residencia y datos en errores.
- **Reversibilidad:** alta con estándares/adaptadores.
- **Costo:** variable.
- **Dependencias:** Q-203/205/206, E2-D-014.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-016 — Backups y recuperación

- **Problema:** recuperar base y objetos de forma coherente.
- **Opciones:** backup básico del hosting; servicios administrados; estrategia coordinada propia.
- **Recomendación:** backups cifrados y restore probado; propuesta inicial RPO 1 h/RTO 4 h sujeta a aprobación.
- **Motivo:** un backup no probado no es control de recuperación.
- **Riesgos:** costo, desalineación DB/objetos y retención legal.
- **Reversibilidad:** media.
- **Costo:** medio según objetivos.
- **Dependencias:** Q-202/206, E2-D-009/014.
- **Estado:** `RECOMMENDED_FOR_G2`.

### E2-D-017 — Testing

- **Problema:** verificar comportamiento, aislamiento y fallos antes del piloto.
- **Opciones:** foco unit; pirámide integrada; E2E predominante.
- **Recomendación:** pirámide con unit/integration/API/UI, PostgreSQL real, E2E P0 y suites de seguridad/concurrencia/restore.
- **Motivo:** mocks no demuestran RLS, constraints, carreras ni pipeline de archivos.
- **Riesgos:** tiempo y flakiness si ambientes no son reproducibles.
- **Reversibilidad:** alta; la cobertura crece por riesgo.
- **Costo:** medio-alto, indispensable.
- **Dependencias:** AC-001..057 y E2-D-001..016.
- **Estado:** `RECOMMENDED_FOR_G2`.

## Q-201 a Q-210

Estas preguntas continúan abiertas. E2 puede preparar controles y opciones, pero no inventa decisiones legales, institucionales u operativas.

| ID | Decidible en arquitectura | Requiere autoridad externa | Recomendación | Estado | Compuerta final |
|---|---|---|---|---|---|
| Q-201 | Minimización, consent/version references y purpose enforcement | Jurisdicción, base y textos: responsable legal/institución | Diseñar capacidad sin fijar fundamento | `BLOCKED` en parte legal; arquitectura `PROPOSED` | Legal pre-datos-reales |
| Q-202 | Versionado, lifecycle hooks, borrado/anonimización ejecutable | Matriz por dato/resultado y obligaciones | No fijar plazos; impedir borrado silencioso | `BLOCKED` en política legal | Legal pre-piloto |
| Q-203 | Adaptadores, cifrado, portabilidad y controles de proveedor | Regiones/proveedores permitidos y contrato | S3-compatible/proveedores evaluables | `DEFERRED` | Selección/procurement pre-infra |
| Q-204 | Capacidad MFA/step-up y factores soportables | Política exacta por rol/acción | MFA al menos Admin Máximo/Superadmin como recomendación; política por aprobar | `RECOMMENDED_FOR_G2` parcial | Seguridad pre-piloto |
| Q-205 | Audit/security events, runbooks y canales | Roles de incidente y plazos de notificación | Diseñar detección y evidencia; no inventar notificación | `DEFERRED` | Operación/legal pre-piloto |
| Q-206 | Arquitectura de backup, health y degradación | RPO/RTO/SLA/mantenimiento aprobados | RPO 1 h/RTO 4 h como propuesta | `RECOMMENDED_FOR_G2` parcial | G2/operación |
| Q-207 | Escalado modular, límites y pruebas de carga | Volumen y picos del piloto | Medir antes de dimensionar; evitar Redis prematuro | `DEFERRED` | Configuración/capacidad pre-piloto |
| Q-208 | Auditoría/exportación y workflow de titulares | Forma legal, plazos y responsable | Mantener evidencia y permisos; política legal pendiente | `BLOCKED` en parte legal | Legal pre-datos-reales |
| Q-209 | Sesión, TLS, CSP y mínimos de cliente | Política BYOD/red/dispositivos institucionales | Documentar baseline y validar dispositivos reales | `DEFERRED` | Operación pre-piloto |
| Q-210 | Threat model, suites y hardening | Necesidad/proveedor de prueba externa y aceptación de riesgo | Revisión externa proporcional antes del piloto | `RECOMMENDED_FOR_G2` parcial | Seguridad pre-piloto |

Ningún `BLOCKED` legal de esta tabla impide formular la arquitectura de G2; sí impide autorizar datos reales o piloto productivo cuando corresponda.

## Integración EduPay diferida

`Q-301..Q-309` permanecen `FUTURE_INTEGRATION_PENDING` para E7/G7. E2 sólo preserva el boundary: aceptación expresa antes del handoff, dominios y tablas separados, idempotencia futura y estados técnicos distintos de matrícula. `Q-310` sigue `APPROVED_PRODUCT / FUNCTIONALLY_RESOLVED`.

## Human decisions required

### HD-01 — Estilo arquitectónico

- **Opción recomendada:** modular monolith.
- **Alternativa principal:** microservicios desde el inicio.
- **Impacto:** la alternativa aumenta despliegues, observabilidad y consistencia distribuida sin necesidad demostrada.
- **Recomendación concreta:** aprobar E2-D-001 y ADR-0002.

### HD-02 — Stack y repositorio

- **Opción recomendada:** alineación principal TypeScript/EduPay en monorepo independiente con pnpm workspaces.
- **Alternativa principal:** alineación parcial o multirepo.
- **Impacto:** define curva del equipo, contratos y costo de reversión antes de scaffolding.
- **Recomendación concreta:** aprobar E2-D-002/003 y ADR-0001; validar versiones en E3/E4.

### HD-03 — Tenancy y RLS

- **Opción recomendada:** shared schema + tenantId + RLS desde primera persistencia, condicionada a PoC.
- **Alternativa principal:** aislamiento sólo aplicativo o schema-per-tenant.
- **Impacto:** cambia migraciones, repositorios, pruebas y riesgo cross-tenant.
- **Recomendación concreta:** aprobar E2-D-005/006 y ADR-0003.

### HD-04 — Sesiones

- **Opción recomendada:** access corto en cookie HttpOnly + refresh opaco rotatorio/revocable.
- **Alternativa principal:** sesiones totalmente server-side.
- **Impacto:** afecta CSRF, revocación, escalado y contratos de autenticación.
- **Recomendación concreta:** aprobar E2-D-007 y exigir PoC de rotación/reuse detection.

### HD-05 — Archivos y malware

- **Opción recomendada:** object storage privado S3-compatible + cuarentena/escaneo fail-closed.
- **Alternativa principal:** servicio documental administrado integral.
- **Impacto:** seguridad, residencia, costos, backups y operación.
- **Recomendación concreta:** aprobar patrón E2-D-009/010 y ADR-0004; diferir proveedor hasta Q-203/procurement.

### HD-06 — Jobs y email

- **Opción recomendada:** jobs/outbox PostgreSQL con worker; proveedor de email por adaptador.
- **Alternativa principal:** Redis/BullMQ desde el MVP.
- **Impacto:** infraestructura, retries, expiraciones y supervisión.
- **Recomendación concreta:** aprobar E2-D-011/012; introducir Redis sólo por evidencia de carga.

### HD-07 — Deployment

- **Opción recomendada:** runtime Linux containerizado + PostgreSQL/object storage administrados cuando sea viable.
- **Alternativa principal:** cPanel/Passenger.
- **Impacto:** capacidad de workers, antivirus, rollback, observabilidad y costo operativo.
- **Recomendación concreta:** aprobar E2-D-014 y ADR-0005; solicitar comparación comercial antes de aprovisionar.

### HD-08 — Recuperación

- **Opción recomendada:** objetivo inicial RPO 1 h/RTO 4 h con restore probado.
- **Alternativa principal:** objetivos más relajados para reducir costo.
- **Impacto:** backup, proveedor, presupuesto y continuidad durante convocatoria.
- **Recomendación concreta:** aprobar o ajustar explícitamente los objetivos; no tratarlos como SLA contractual.
