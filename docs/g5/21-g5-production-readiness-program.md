# G5 — Programa trazable de preparación para preproducción, piloto y producción

## 1. Propósito, autoridad y límite

Este documento normaliza el estado vivo posterior a `G5-PC1-R3` y ordena el trabajo
necesario para preparar una futura solicitud de G5. Es un programa de trabajo y de
evidencia; no es una aprobación, no sustituye los registros históricos y no autoriza
por sí mismo cambios de schema, infraestructura, proveedores, datos reales, piloto o
producción.

La secuencia obligatoria continúa siendo la definida en
[`../10-roadmap-approval-gates.md`](../10-roadmap-approval-gates.md): G5 autoriza E6, el
piloto; G6 evalúa su salida. La integración técnica con EduPay permanece fuera de este
programa hasta E7/G7. No se comparten tablas ni se crea una dependencia directa entre
Admisión y EduPay.

Toda ejecución derivada de este programa debe:

- preservar aislamiento por tenant, RLS forzado, autorización por tenant/propósito/rol y
  fail-closed;
- utilizar sólo datos y personas sintéticos hasta que exista un acto humano fechado que
  autorice expresamente otra clase de datos;
- mantener secretos fuera del repositorio, imágenes, URLs, logs y documentación;
- separar los incrementos y sus pull requests por compuerta;
- registrar commit, pruebas, riesgos, excepciones, aprobadores y decisión humana;
- detenerse cuando falte una decisión institucional, legal/privacy, comercial u
  operacional que no pueda inferirse técnicamente.

## 2. Snapshot vivo de entrada

Snapshot observado al iniciar este programa; cualquier ejecución futura debe volver a
verificarlo y registrar sus diferencias.

| Control | Estado observado |
| --- | --- |
| Repositorio | `Sherydans12/Admision-Edupay` |
| Rama | `feat/e5-mvp` |
| HEAD inicial | `3e4c48264df09bf0d1baaf9114cc52775536a439` |
| Working tree al inicio de la auditoría | `clean` |
| PR | `#8`, `OPEN`, `DRAFT` |
| Check vigente del PR | `validate = FAILURE` |
| Run observado | `32542062457` |
| Falla observada | step `Prove G5-BR fresh and incremental migration upgrade` |
| Causa factual | `scripts/g5br-migration-smoke.mjs` esperaba 18 migraciones y final R4, pero el HEAD contiene 19 y final R3 |
| Migration 17 | Inmutable: `20260816070000_g5pc1r12_authority_core` |
| Migration 18 | Inmutable: `20260820090000_g5pc1r4_sensitive_processing` |
| Migration 19 | Aplicada/sellada: `20260821190000_g5pc1r3_business_calendar` |
| Migration 20 | `ABSENT / NOT AUTHORIZED` |
| G5 | `NO APROBADA / NOT REQUESTED` |
| Datos reales / piloto / producción | `NOT AUTHORIZED` |
| Integración técnica EduPay | `NOT AUTHORIZED` |

La evidencia local de R3 registra suites directas y regresión local en verde, pero no
debe presentarse como CI completa vigente mientras el check del PR permanezca rojo. La
primera salida del programa es reconciliar ambas evidencias y obtener un check verde en
el commit exacto que se someta a revisión.

## 3. Clasificación de la información

### 3.1 Hechos confirmados

1. E5 tiene cierre funcional humano histórico, y los incrementos `PC1-R12`, `PC1-R4` y
   `PC1-R3` tienen evidencia técnica aceptada/revisada.
2. `PC1-TECH-001..012`, incluyendo `003`, figuran como
   `IMPLEMENTED / TECHNICALLY_REVIEWED` en el estado canónico posterior a R3.
3. En la auditoría inicial, `PC1-TECH-013..015` permanecían parcial/no implementados y
   clasificados `P0_PREPILOT`; el addendum post-R5 al final registra su cierre técnico
   posterior autorizado.
4. El núcleo técnico de Q-106 existe, pero el procedimiento institucional/legal final y
   `LP3-ART-006` permanecen abiertos.
5. `PREPILOT_LEGAL_ARTIFACTS = OPEN`; el registro vigente contiene 16 artefactos y
   ninguno tiene cierre aprobado documentado.
6. Las implementaciones actuales de email familiar, object storage, malware scanning y
   `SecurityEventSink` son de desarrollo o no productivas.
7. La recovery sintética coordinada DB+objetos y el owner técnico de recovery tienen
   evidencia; no equivalen a backup/restore productivo ni a SLA alcanzado.
8. G5, datos reales, piloto, producción y EduPay técnico siguen expresamente no
   autorizados.

### 3.2 Decisiones aprobadas

1. ADR-0005 adopta runtime Linux containerizado para web/API/worker detrás de reverse
   proxy, con preferencia por un patrón híbrido y servicios administrados cuando sean
   aprobados.
2. ADR-0004 adopta object storage privado S3-compatible detrás de un adapter, con
   cuarentena, validación y malware scanning fail-closed; el proveedor no está elegido.
3. `MONITORING_MODEL = MANAGED_EXTERNAL` y
   `PRODUCTIVE_MONITORING_PROVIDER = GRAFANA_CLOUD` están aprobados como dirección
   operacional.
4. Email como destino primario y Telegram como destino inmediato de alertas están
   aprobados como modelo; su implementación productiva está diferida a preproducción.
5. `SecurityEvent != AuditEvent`; ambos conservan propósitos, accesos y retenciones
   diferenciados.
6. `TECHNICAL_INCIDENT_OWNER` y `RECOVERY_OWNER` se registran como
   `BaseLogic / Nicolás` para la planificación técnica. Esto no asigna el owner
   institucional/legal de incidentes privacy.
7. PC1-B aprueba como reglas configurables del piloto: 30 minutos por defecto para
   entrevista, 60 para diagnóstico, `America/Santiago`, calendario hábil con exclusiones,
   plazos de tres días hábiles, reminder, waitlist por orden de ingreso y autoridad
   verificada antes de aceptación/handoff.
8. Salud y PIE/NEE permanecen deshabilitados por defecto; cualquier excepción requiere
   propósito, alcance y aprobación aplicables.

### 3.3 Supuestos de trabajo — no aprobaciones

1. Se recomienda usar una preproducción cercana a producción con datos exclusivamente
   sintéticos antes de solicitar G5.
2. Se asume que PR #8 debe quedar verde y técnicamente aceptado antes de basar nuevos
   incrementos en él; merge, estrategia de rama y commit exactos requieren decisión del
   revisor.
3. Se asume que `PC1-R5` es el siguiente incremento técnico lógico por agrupar
   `PC1-TECH-013..015`; el nombre no lo autoriza.
4. Migration 20 podría ser necesaria para primary/backup o configuración tenant-scoped,
   pero su necesidad sólo puede cerrarse después del diseño R5 y aprobación humana.
5. RPO de una hora y RTO de cuatro horas permanecen objetivos técnicos iniciales, no
   SLA ni resultados productivos.
6. La producción inicial podría alojar el piloto E6, pero despliegue productivo, uso
   piloto y tratamiento de datos reales son autorizaciones distintas y deben declararse
   por separado.

### 3.4 Preguntas abiertas que no se deben resolver por inferencia

1. ¿Quién será el revisor legal/privacy designado y quién aprobará los 16 artefactos?
2. ¿Qué procedimiento, evidencias y responsables definitivos cerrarán Q-106?
3. ¿Cuáles serán los proveedores, regiones, subencargados, contratos/DPA, retenciones y
   mecanismos de transferencia para PostgreSQL, objetos, malware, email, monitoring y
   alertas?
4. ¿Qué presupuesto, soporte, disponibilidad y modelo on-call se aprueban?
5. ¿Qué capacidades, personas primary/backup, fechas excluidas, remitente y plantillas
   suministra la institución?
6. ¿Qué política de revocación de sesiones aplica después de recovery de cuenta?
7. ¿Qué política BYOD/red/dispositivo, MFA por rol y prueba externa se exigirá para el
   piloto?
8. ¿Cuál es el commit, ambiente, ventana, clase de datos y condición de stop que una
   futura autorización G5 cubrirá?

## 4. Normalización del estado canónico

Los documentos históricos se conservan como evidencia de su fecha. Para planificar
trabajo nuevo se aplican estas reglas de precedencia:

1. Un addendum posterior puede superseder un dato factual anterior sólo cuando lo dice
   expresamente; no reescribe la aprobación histórica.
2. `IMPLEMENTED / TECHNICALLY_REVIEWED` no significa aprobación legal, configuración
   institucional, provider readiness ni autorización operativa.
3. `HUMAN APPROVED` en PC1-C aprueba la clasificación de los valores como input
   institucional; no significa que esos valores hayan sido suministrados.
4. `TECHNICAL_CORE_IMPLEMENTED` para Q-106 convive con
   `FINAL_INSTITUTIONAL_LEGAL_PROCEDURE_PENDING / PILOT_PRECONDITION`.
5. Un PASS local no reemplaza un check CI fallido sobre el mismo HEAD.
6. El silencio, un merge, la existencia de infraestructura o un despliegue técnico no
   constituyen aprobación G5.

Snapshot canónico para este programa:

| Elemento | Estado normalizado |
| --- | --- |
| E5 | `COMPLETE / HUMAN REVIEW PASSED` histórico |
| PC1-R12 | `COMPLETE / TECHNICALLY_ACCEPTED` |
| PC1-R4 | `COMPLETE / TECHNICALLY_ACCEPTED` |
| PC1-R3 | `COMPLETE / TECHNICALLY_REVIEWED` |
| PC1-TECH-001..012 | `IMPLEMENTED / TECHNICALLY_REVIEWED` |
| PC1-TECH-013..015 | `IMPLEMENTED / TECHNICALLY_REVIEWED` post-R5 |
| Q-106 | `TECHNICAL_CORE_IMPLEMENTED / FINAL_INSTITUTIONAL_LEGAL_PROCEDURE_PENDING / PILOT_PRECONDITION` |
| C-013 | `INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING` |
| G5-EXIT-07 | `PASS_WITH_RESIDUAL` |
| G5-EXIT-10 | `BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD` |
| G5-EXIT-11 | `BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED` |
| G5-EXIT-12 | `BLOCKED / DATED_AUTHORIZATION_ABSENT` |
| G5 | `NO APROBADA / NOT REQUESTED` |

## 5. Remediación técnica PC1-R5

La siguiente tabla fue el backlog trazable de entrada. `R5-D-001..009` y Migration 20
fueron aprobadas el 2026-08-24 sólo para datos sintéticos; el cierre está registrado en
el addendum y la evidencia R5.

| ID | Estado de entrada | Invariante requerido | Evidencia mínima de salida | Decisión previa |
| --- | --- | --- | --- | --- |
| `PC1-TECH-013` | `IMPLEMENTED / TECHNICALLY_REVIEWED` | ninguna offering puede quedar publicable/abierta sin capacidad de admisión explícita aplicable; `0 != ausencia` | domain/API/UI/RLS y regresión completa | `R5-D-001..003 APPROVED` |
| `PC1-TECH-014` | `IMPLEMENTED / TECHNICALLY_REVIEWED` | defaults configurables por tenant/kind: entrevista 30 y diagnóstico 60; override explícito y validado | default, override, versionado, API/UI y aislamiento | `R5-D-004..005 APPROVED` |
| `PC1-TECH-015` | `IMPLEMENTED / TECHNICALLY_REVIEWED` | cada función crítica aplicable tiene primary y backup activos, tenant-scoped y con capability | policy, assignment, capability, histórico, RLS y API/UI | `R5-D-006..009 APPROVED` |

Antes de implementar R5 se debe producir un diseño acotado que declare:

- tablas/columnas afectadas o ausencia de cambio de schema;
- compatibilidad con migrations 17..19 y estrategia forward-only;
- comportamiento fail-closed;
- permisos/capabilities y eventos de auditoría;
- experiencia de administración y mensajes seguros;
- impacto multi-tenant y tests negativos;
- datos sintéticos de prueba;
- trabajo expresamente fuera de alcance.

## 6. Registro legal/privacy que debe cerrarse

La siguiente lista replica el conjunto finito de
[`14-g5lp3-prepilot-legal-artifacts.md`](14-g5lp3-prepilot-legal-artifacts.md). Todos los
items continúan `OPEN`; el avance técnico posterior puede aportar insumos, pero no cerrar
la aprobación legal/institucional por sí solo.

| ID | Artefacto requerido | Aprobación/owner requerido | Estado |
| --- | --- | --- | --- |
| `LP3-ART-001` | validación final controller/processor | institución + revisor legal/privacy + BaseLogic | `OPEN` |
| `LP3-ART-002` | DPA/acuerdo de tratamiento | controller/colegio + BaseLogic + revisor legal/privacy | `OPEN` |
| `LP3-ART-003` | matriz finalidad → base jurídica final | institución + revisor legal/privacy | `OPEN` |
| `LP3-ART-004` | aviso de privacidad corto | institución + revisor legal/privacy + owner operativo | `OPEN` |
| `LP3-ART-005` | política de privacidad completa y versionada | institución + revisor legal/privacy | `OPEN` |
| `LP3-ART-006` | procedimiento final Q-106/autoridad guardian | institución + owner operativo + revisor legal/privacy | `OPEN` |
| `LP3-ART-007` | catálogo aprobado de campos sensibles/PIE/NEE | institución + owners funcionales + revisor legal/privacy | `OPEN` |
| `LP3-ART-008` | verificación de health disabled-by-default y excepciones | owner técnico + institución + revisor legal/privacy cuando aplique | `OPEN`; enforcement técnico R4 disponible como insumo |
| `LP3-ART-009` | matriz numérica de retención | institución + owner operativo/técnico + revisor legal/privacy | `OPEN` |
| `LP3-ART-010` | procedimiento delete/anonymize/block/legal-hold | institución + owner operativo/técnico + revisor legal/privacy | `OPEN` |
| `LP3-ART-011` | procedimiento de derechos y canal público | controller/colegio + owner operativo + revisor legal/privacy | `OPEN` |
| `LP3-ART-012` | matriz legal final de acceso/exportación | institución + owners funcionales + revisor legal/privacy | `OPEN` |
| `LP3-ART-013` | procedimiento de originales físicos y excepción sectorial | institución + owner operativo + revisor legal/privacy | `OPEN` |
| `LP3-ART-014` | review productivo de providers/DPA/subencargados/residencia/transferencia | institución + owner técnico/operativo + revisor legal/privacy | `OPEN` |
| `LP3-ART-015` | runbook de incidente privacy | institución + BaseLogic + revisor legal/privacy | `OPEN` |
| `LP3-ART-016` | matriz de retención/acceso AuditEvent y SecurityEvent | institución + owner técnico/operativo + revisor legal/privacy | `OPEN` |

El cierre de cada artefacto debe registrar versión, owner, inputs, aprobadores, fecha,
evidencia, excepciones, dependencia técnica y relación con `G5-EXIT-11`.

## 7. Inputs institucionales prepiloto

Estos valores no se inventan ni se hardcodean. Deben ser entregados y aprobados por la
institución, y luego cargados mediante superficies tenant-scoped con auditoría.

| Input | Estado | Bloquea | Evidencia esperada |
| --- | --- | --- | --- |
| backup de entrevista | `PENDING` | operación de entrevista | persona/membership/capability y aprobación institucional |
| evaluadores diagnósticos y backups | `PENDING` | operación diagnóstica | asignación por función y aprobación institucional |
| primary y backup de Dirección | `PENDING` | decisión/aprobación aplicable | asignación, capability y segregación |
| capacidad por curso/año/oferta | `PENDING` | publicación/open y operación de cupos | matriz versionada y carga auditada |
| fechas excluidas del calendario | `PENDING` | cálculo operativo de plazos | lista institucional versionada por tenant |
| `FROM_EMAIL` productivo | `PENDING` | comunicaciones reales | buzón institucional y dominio de envío verificado |
| plantillas finales de email | `PENDING` | comunicaciones reales | textos/versiones/aprobadores y pruebas de rendering |
| activación de informe de personalidad por curso | `PENDING` | captura/requisito cuando aplique | decisión expresa, propósito, curso y aprobación legal/funcional |

No se deben registrar nombres, correos ni datos personales reales dentro de fixtures,
logs o documentos técnicos. La carga real sólo ocurre en el ambiente autorizado.

## 8. Gaps de provider y preproducción

| Área | Decisión existente | Gap antes de G5/producción | Evidencia requerida |
| --- | --- | --- | --- |
| runtime | Linux containerizado + reverse proxy | proveedor, región, topología, soporte, presupuesto, patching y rollback | arquitectura desplegada, inventario, smoke y rollback |
| PostgreSQL | servicio compatible aprobado conceptualmente | proveedor/región, cifrado, HA, backups, acceso, retención y restore | restore aislado, RLS/app role, medición y runbook |
| object storage | privado S3-compatible | proveedor, región, DPA, lifecycle, versionado, recovery y credenciales mínimas | cuarentena/aprobado, cross-tenant, restore coordinado |
| malware scanning | adapter/fail-closed | proveedor o runtime aislado, actualización de firmas, disponibilidad y alertas | archivos seguros de prueba, degradación y recuperación |
| email familiar/identidad | adapters de desarrollo | proveedor, dominio, DKIM/SPF/DMARC según diseño aprobado, bounce/failure y retención | envío controlado sintético, failure tasks, retry e idempotencia |
| Grafana Cloud | proveedor aprobado como dirección | región, retención, acceso, payload allowlist, DPA y configuración | señales sanitizadas, dashboards, alertas y acceso auditado |
| Telegram/email de alertas | canales aprobados como dirección | destinos concretos, owners, secretos, minimización y escalamiento | alerta sintética, ack/escalamiento y ausencia de contenido sensible |
| SecurityEvent | destino futuro Grafana | sink durable, acceso, retención y operación | eventos allowlisted, no confusión con AuditEvent y alertas |
| secretos | no versionar | store, rotación, revocación, break-glass y recovery | ejercicio sin exponer valores |
| red/TLS | boundary conceptual | DNS, certificados, red privada, allowlists, headers y límites | scans/configuración y smoke externo autorizado |
| multi-instancia | no demostrada | sesiones/CSRF/config compartida, migrations coordinadas y jobs singleton/lease | pruebas con más de una instancia y failover |
| backup/recovery | sintético PASS_WITH_RESIDUAL | provider, frecuencia, cifrado, retención, objetos y restore preprod | ejercicio autorizado, manifest, hashes, RLS, RPO/RTO medidos |
| operación | señales/runbook técnico base | on-call, severidades, escalamiento, mantenimiento y handoff | simulacro y aceptación operacional |
| capacidad | cifras no aprobadas | volumen, picos, sizing, límites y costos | prueba de carga con datos sintéticos y criterio aprobado |
| accesibilidad | revisión interna con residual | harness automatizado y validación interna final | reporte por flujos críticos; no llamarlo certificación externa |
| seguridad | controles y suites internas | MFA/policies, devices/red y prueba externa autorizada | threat-model delta, findings, remediación y aceptación |

## 9. Roadmap trazable y compuertas internas

Cada fase termina en una evidencia o decisión explícita. Completar una fase no autoriza
la siguiente cuando ésta requiere aprobación humana.

| Fase | Objetivo y entregables | Trazabilidad principal | Salida obligatoria | Puede iniciar sin nueva aprobación |
| --- | --- | --- | --- | --- |
| `PRG-00` | corregir smoke histórico G5-BR; reconciliar scripts de migrations; ejecutar CI completa | PR #8, migrations 16..19, G5-BR/R4/R3 | check verde en commit exacto + evidencia + revisión humana | corrección acotada sí; aceptación/merge no |
| `PRG-01` | diseñar R5 y proponer impacto Migration 20 | `PC1-TECH-013..015`, PC1-020, PC1-009..013 | diseño, matriz de tests y solicitud de autorización | sólo diseño/documentación |
| `PRG-02` | implementar R5 una vez autorizado | `PC1-TECH-013..015`, RLS, AC-050, NFR-SEC/MULTI | suites domain/API/UI/RLS, smoke fresh/incremental y revisión | no, requiere autorización R5/M20 |
| `PRG-03` | cerrar configuración institucional y Q-106 | PC1-C, Q-106, `LP3-ART-006..008` | matriz firmada/versionada y procedimiento Q-106 aprobado | preparación sin datos reales; aprobación requiere institución/legal |
| `PRG-04` | cerrar paquete legal/privacy | `LP3-ART-001..016`, C-013, `G5-EXIT-11` | 16/16 cerrados y síntesis de aprobación | no puede cerrarlo BaseLogic solo |
| `PRG-05` | seleccionar proveedores y aprobar arquitectura física | ADR-0004/0005, Q-203, `G5-DEC-007/008`, ART-014 | comparación, decisión, contratos/reviews y costos aprobados | evaluación sí; contratación/provisión requiere aprobación |
| `PRG-06` | autorizar y construir preproducción sintética | `G5-EXIT-04/06/07/09/10` | acto preprod + IaC/config + inventario, sin datos reales | no, requiere autorización preprod |
| `PRG-07` | validar operación production-like | NFR-SEC, NFR-MULTI, recovery, deployment, a11y, load | restore/rollback, alerting, seguridad, RLS y E2E sintéticos PASS | sólo dentro de preprod autorizada |
| `PRG-08` | consolidar paquete G5 | `G5-EXIT-01..12`, PR/commit, riesgos | matriz actualizada sin blockers y recomendación go/no-go | sí para consolidar; no para aprobar |
| `PRG-09` | decisión humana G5 y autorización exacta | `G5-EXIT-10..12`, C-013, Q-106 | acto fechado con environment/data/owners/window/stop | no; aprobación humana obligatoria |
| `PRG-10` | deploy y piloto E6 dentro del acto | G5, E6, runbooks, pilot config | smoke, acta go-live, monitoreo, incident log y rollback disponible | sólo después de G5 |
| `PRG-11` | evaluación G6 | evidencia E6, métricas, incidentes, deuda | decisión continuar/ajustar/pausar/revertir | no; decisión humana |
| `PRG-12` | E7/G7 sólo si se autoriza EduPay | Q-301..Q-309, contrato e integración | contrato, idempotencia, reconciliación, pruebas y G7 | fuera de alcance hasta G6/autorización E7 |

## 10. Matriz de salida G5

Antes de solicitar G5, la revisión debe actualizar los doce criterios con evidencia del
commit y ambiente exactos. Este programa enfatiza los tres blockers canónicos:

| Criterio | Estado de entrada | Condición mínima para reconsiderar | Owner/aprobación |
| --- | --- | --- | --- |
| `G5-EXIT-10` | `BLOCKED / IMPLEMENTATION_DEFERRED_TO_PREPROD` | monitoring/alerting, runbooks, incident response, owners, deployment, recovery y soporte implementados y probados en preprod autorizada | owner técnico/operativo + institución; legal/privacy en escalamiento aplicable |
| `G5-EXIT-11` | `BLOCKED / PREPILOT_LEGAL_ARTIFACTS_REQUIRED` | `LP3-ART-001..016` cerrados con evidencia y C-013 validada | institución + revisor legal/privacy + owners indicados |
| `G5-EXIT-12` | `BLOCKED / DATED_AUTHORIZATION_ABSENT` | acto humano separado y fechado que identifica commit, ambiente, datos, tenant, users, owners, vigencia, riesgos y stop/rollback | aprobadores institucionales, técnicos y legal/privacy aplicables |

Los criterios `G5-EXIT-01..09` también deben revalidarse; ningún PASS histórico se copia
automáticamente al commit candidato. En particular se deben revisar onboarding/Q-106,
documentos/proveedores, SecurityEvent, recovery, accesibilidad y comunicaciones reales.

## 11. Evidencia y pruebas obligatorias del candidato

La lista final se ajustará al diseño y proveedor aprobados, pero no puede omitir:

1. instalación congelada, formato, lint, typecheck y build;
2. suite funcional completa y E2E crítico con datos sintéticos;
3. RLS/FORCE, grants mínimos, cross-tenant read/write/search/count/export y jobs;
4. migración fresh `0 → latest` e incremental desde el release anterior;
5. rollback de aplicación sin rollback destructivo de datos;
6. backup/restore coordinado PostgreSQL + objetos con integridad, manifest y aislamiento;
7. health/readiness de web/API/worker y degradación controlada de DB/storage/scanner/email;
8. leasing, retry, idempotencia, backlog y worker restart;
9. TLS, headers, cookies, CSRF, rate limiting, sesiones y rotación/revocación de secretos;
10. logs, AuditEvent y SecurityEvent sanitizados sin datos sensibles;
11. alertas y escalamiento sintéticos end-to-end;
12. accesibilidad y responsive en flujos críticos;
13. carga/capacidad contra criterios previamente aprobados;
14. revisión de vulnerabilidades, secretos, dependencias y prueba externa cuando sea
    autorizada;
15. smoke de configuración institucional por tenant sin hardcodes de Conquistadores;
16. evidencia de que EduPay sigue desacoplado y sin integración ejecutable durante G5/E6.

Cada resultado debe registrar comando/escenario, ambiente, fecha, commit, ejecutor,
resultado, evidencia, limitación y riesgo residual. Un test no ejecutado se reporta como
tal; no se transforma en PASS.

## 12. Plantilla no aprobada — autorización PC1-R5 y Migration 20

> `DRAFT / NOT APPROVED / NO AUTHORITY UNTIL SIGNED`

```text
AUTHORIZATION_ID: <por asignar>
GATE/INCREMENT: G5-PC1-R5
DATE_AND_TIME_WITH_OFFSET: <por completar>
REPOSITORY: Sherydans12/Admision-Edupay
BASE_BRANCH: <por completar>
BASE_COMMIT: <SHA completo>
PR: <por completar>

AUTHORIZED_REQUIREMENTS:
- PC1-TECH-013: <YES/NO>
- PC1-TECH-014: <YES/NO>
- PC1-TECH-015: <YES/NO>

APPROVED_DESIGN_REFERENCE: <documento/versión>
MIGRATION_20_AUTHORIZED: <YES/NO>
MIGRATION_20_ALLOWED_SCOPE: <tablas/columnas/enums/constraints exactos o N/A>
MIGRATIONS_17_18_19_IMMUTABLE: YES
DATA_CLASS_ALLOWED: SYNTHETIC_NON_PRODUCTION_ONLY
PROVIDERS_ALLOWED: NONE, salvo autorización separada identificada
EDUPAY_TECHNICAL_INTEGRATION_ALLOWED: NO

REQUIRED_CONTROLS:
- tenantId + RLS/FORCE + grants mínimos
- autorización tenant/rol/propósito
- auditoría de cambios
- compatibilidad fresh/incremental
- pruebas domain/API/UI/RLS/concurrency/cross-tenant
- sin personas, capacidades ni secretos reales en repositorio

EXPLICITLY_OUT_OF_SCOPE: <lista cerrada>
RISKS_ACCEPTED: <lista o NONE>
STOP_CONDITIONS: <condiciones>
REVIEW_REQUIRED_BEFORE_MERGE: <roles/personas aprobadoras>

FUNCTIONAL/INSTITUTIONAL_APPROVER: <nombre/rol/firma/fecha>
TECHNICAL_APPROVER: <nombre/rol/firma/fecha>
LEGAL_PRIVACY_APPROVER_IF_APPLICABLE: <nombre/rol/firma/fecha o N/A justificado>
DECISION: <APPROVED / REJECTED / APPROVED_WITH_CONDITIONS>
```

Hasta que `DECISION` tenga valor y aprobadores verificables, R5 y Migration 20 permanecen
no autorizados.

## 13. Plantilla no aprobada — preproducción con datos sintéticos

> `DRAFT / NOT APPROVED / DOES NOT AUTHORIZE REAL DATA`

```text
AUTHORIZATION_ID: <por asignar>
DATE_AND_TIME_WITH_OFFSET: <por completar>
PURPOSE: construir y validar preproducción production-like con datos sintéticos
COMMIT/ARTIFACT_DIGEST: <SHA/digest exactos>
ENVIRONMENT_NAME_AND_ACCOUNT: <identificador exacto sin secretos>
TENANTS_ALLOWED: SYNTHETIC_ONLY
DATA_CLASS_ALLOWED: SYNTHETIC_NON_PRODUCTION_ONLY
REAL_PERSONAL_DATA_ALLOWED: NO
PILOT_OPERATION_ALLOWED: NO
PRODUCTION_GO_LIVE_ALLOWED: NO

APPROVED_PROVIDERS_AND_REGIONS:
- runtime/reverse proxy: <proveedor/región o pendiente>
- PostgreSQL: <proveedor/región o pendiente>
- object storage: <proveedor/región o pendiente>
- malware scanning: <proveedor/región o pendiente>
- family/identity email: <proveedor/región o pendiente>
- monitoring/logging: <proveedor/región o pendiente>
- alerting: <canales/destinos o pendiente>

APPROVED_COST_LIMIT_AND_PERIOD: <por completar>
NETWORK/DNS/TLS_SCOPE: <por completar>
SECRET_STORE_AND_ROTATION_OWNER: <por completar>
TECHNICAL_INCIDENT_OWNER: <por confirmar>
RECOVERY_OWNER: <por confirmar>
PRIVACY_LEGAL_INCIDENT_OWNER: <por completar o no aplica con justificación>
ACCESS_LIST_AND_EXPIRY: <usuarios/roles/fecha de expiración>

ALLOWED_ACTIONS:
- provisionar infraestructura aprobada
- desplegar artefactos aprobados
- configurar adapters con payloads sintéticos
- ejecutar pruebas, recovery y rollback autorizados

REQUIRED_EVIDENCE:
- inventario y diagrama de recursos
- IaC/config review y secretos fuera del repositorio
- tests RLS/cross-tenant
- deployment/rollback
- backup/restore DB+objects
- monitoring/alerting y runbooks
- destrucción/retención de datos sintéticos al cierre

EXPLICITLY_PROHIBITED:
- copiar datos reales
- invitar usuarios piloto reales
- activar comunicaciones a destinatarios reales
- afirmar G5 o producción aprobadas
- integrar EduPay

VALID_FROM: <fecha/hora>
VALID_UNTIL: <fecha/hora>
STOP/DECOMMISSION_CONDITIONS: <por completar>
RISKS_ACCEPTED: <lista o NONE>

INSTITUTIONAL_APPROVER: <nombre/rol/firma/fecha>
TECHNICAL/OPERATIONAL_APPROVER: <nombre/rol/firma/fecha>
LEGAL_PRIVACY_REVIEWER_FOR_PROVIDER_SCOPE: <nombre/rol/firma/fecha>
DECISION: <APPROVED / REJECTED / APPROVED_WITH_CONDITIONS>
```

Campos `pendiente` en proveedor/región que afecten datos o controles obligatorios impiden
usar esta plantilla como autorización de aprovisionamiento.

## 14. Plantilla no aprobada — G5, piloto, despliegue productivo y datos reales

> `DRAFT / NOT APPROVED / USE ONLY AFTER G5-EXIT-01..12 REVIEW`

```text
AUTHORIZATION_ID: <por asignar>
GATE: G5
DATE_AND_TIME_WITH_OFFSET: <por completar>
DECISION_SCOPE: <G5 / PILOT E6 / PRODUCTION DEPLOYMENT / REAL DATA; marcar cada uno>

G5_APPROVED: <YES/NO>
PILOT_E6_APPROVED: <YES/NO>
PRODUCTION_DEPLOYMENT_APPROVED: <YES/NO>
REAL_PERSONAL_DATA_APPROVED: <YES/NO>

REPOSITORY_COMMIT: <SHA completo>
ARTIFACT_DIGESTS: <digests inmutables>
ENVIRONMENT_NAME_ACCOUNT_REGION: <identificador exacto, sin secretos>
TENANT/INSTITUTION: <tenant exacto aprobado>
PILOT_POPULATION_AND_USER_ROLES: <alcance aprobado, sin listar datos personales aquí>
DATA_CATEGORIES_ALLOWED: <lista aprobada por referencia a catálogo versionado>
SENSITIVE_CATEGORIES_ALLOWED: <lista o NONE>
PURPOSES_ALLOWED: <lista aprobada>
DATA_CATEGORIES_EXPLICITLY_PROHIBITED: <lista>

LEGAL_PRIVACY_PACKAGE:
- LP3-ART-001..016 closure reference: <documento/versión>
- C-013 disposition: <estado y evidencia>
- Q-106 final procedure: <documento/versión>
- DPA/provider reviews: <referencias>
- notices/policies/rights channel: <referencias/versiones>
- retention/deletion/access matrices: <referencias/versiones>

OPERATIONAL_PACKAGE:
- provider/region inventory: <referencia>
- technical incident owner: <nombre/rol>
- institutional operational owner: <nombre/rol>
- privacy/legal incident owner: <nombre/rol>
- recovery owner/operator: <nombre/rol>
- support/on-call/escalation: <referencia>
- backup/restore evidence: <referencia>
- monitoring/alerting evidence: <referencia>
- deploy/rollback evidence: <referencia>
- security/accessibility/load evidence: <referencias>

INSTITUTIONAL_CONFIGURATION_VERSION:
- capacities: <referencia>
- primary/backups: <referencia>
- excluded dates/timezone: <referencia>
- sender/templates: <referencia>
- document/sensitive catalog: <referencia>

VALID_FROM: <fecha/hora con offset>
VALID_UNTIL_OR_REVIEW_DATE: <fecha/hora con offset>
GO_LIVE_WINDOW: <ventana>
ROLLBACK_TARGET: <artefacto/config>

STOP_CONDITIONS:
- suspected cross-tenant access or authorization bypass
- loss of private-document quarantine/scanning invariant
- unavailable or unverifiable backup/restore beyond approved threshold
- monitoring/alerting or incident ownership unavailable
- unapproved provider, region, data category, purpose or tenant
- material legal/privacy condition not satisfied
- <otras condiciones aprobadas>

ROLLBACK/CONTAINMENT_AUTHORITY: <rol/persona>
DATA_CONTAINMENT_AND_NOTIFICATION_PROCEDURE: <referencia>
KNOWN_RESIDUAL_RISKS_ACCEPTED: <lista y owner>
EXCEPTIONS: <lista o NONE>

INSTITUTIONAL_AUTHORITY_APPROVER: <nombre/rol/firma/fecha>
LEGAL_PRIVACY_APPROVER: <nombre/rol/firma/fecha>
TECHNICAL/OPERATIONAL_APPROVER: <nombre/rol/firma/fecha>
PRODUCT_OWNER_APPROVER: <nombre/rol/firma/fecha>
DECISION: <APPROVED / REJECTED / APPROVED_WITH_CONDITIONS>
```

Esta plantilla no se puede prellenar con `YES` por inferencia. Si cualquier aprobación,
referencia obligatoria, owner o condición material está ausente, `G5-EXIT-12` permanece
`BLOCKED`.

## 15. Go-live y operación posterior — sólo después de autorización

Si y sólo si la plantilla anterior queda aprobada, el go-live debe producir un acta
separada con:

- comparación commit/digest/config contra lo autorizado;
- resultado de migrations y smoke sin contenido personal;
- health/readiness de web/API/worker;
- prueba de login/rol/tenant con identidades operativas autorizadas;
- verificación de storage privado, scanner, email, monitoring y alertas;
- confirmación de backup anterior al cambio y rollback disponible;
- inicio de ventana de observación y responsables presentes;
- decisión `GO`, `NO_GO` o `ROLLBACK` con hora y aprobador.

Durante E6 deben registrarse incidentes, desviaciones, deuda y métricas previamente
aprobadas. G6 decide continuar, ajustar, pausar o revertir. El uso real no convierte
automáticamente el piloto en autorización de expansión multiinstitución.

## 16. EduPay y expansión expresamente fuera de alcance

Este programa conserva únicamente el handoff funcional local aprobado. No implementa
API, credenciales, payload, webhook, polling, cola externa, tabla compartida ni llamada a
EduPay.

`Q-301..Q-309` permanecen abiertos para contrato, sistema maestro, identificadores,
autenticación, versionado, idempotencia, reintentos, reconciliación, estados y SLA. Su
cierre corresponde a E7 y G7 después de la decisión G6 que autorice avanzar. La expansión
multiinstitución corresponde a E8/G8 y debe revalidar onboarding/offboarding, aislamiento,
capacidad, soporte y ausencia de reglas hardcodeadas del piloto.

## 17. Estado de salida de este documento

| Elemento | Disposición |
| --- | --- |
| Programa documental | `CREATED / READY_FOR_HUMAN_REVIEW` |
| Corrección CI | `REQUIRED / NOT CLOSED BY THIS DOCUMENT` |
| PC1-R5 | `COMPLETE / TECHNICALLY_REVIEWED / SYNTHETIC DATA ONLY` |
| Migration 20 | `CREATED / SEALED / SMOKE PASS / SYNTHETIC DATA ONLY` |
| Preproducción sintética | `AUTHORIZATION TEMPLATE ONLY / NOT AUTHORIZED` |
| LP3-ART-001..016 | `OPEN` |
| G5-EXIT-10..12 | `BLOCKED` |
| G5 / piloto / producción / datos reales | `NOT AUTHORIZED` |
| EduPay | `OUT_OF_SCOPE UNTIL E7/G7` |

La siguiente acción humana es revisar el PR R5 y, de forma separada, decidir si autoriza
una etapa de preproducción sintética. Ninguna plantilla restante cuenta como aprobación
mientras no esté completada, fechada y firmada por los roles requeridos.

## 18. Addendum de ejecución PC1-R5 (2026-08-24)

La aprobación humana `R5-D-001..009` y Migration 20 exclusivamente sintética habilitó
`PRG-02`. El incremento quedó implementado con lifecycle/capacity fail-closed, duración
tenant/kind versionada y policy primary/backup tenant-scoped. La evidencia completa está
en [`24-g5pc1r5-capacity-activity-evidence.md`](24-g5pc1r5-capacity-activity-evidence.md).

La regresión final registra 656/656 tests generales, 67/67 RLS, smoke 0→20 y 19→20,
build y controles de seguridad/operación/recovery en verde. Esto cierra `PC1-R5` dentro
del alcance sintético aprobado; no cambia `G5-EXIT-10..12`, no selecciona infraestructura
ni proveedores y no autoriza preproducción, datos reales, piloto, producción o EduPay.
