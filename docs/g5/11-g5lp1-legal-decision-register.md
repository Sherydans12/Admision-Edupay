# G5-LP1 — Registro de decisiones legales/privacy pendientes

## Control de alcance

| Campo | Estado |
| --- | --- |
| Paquete | `G5-LP1 / DOCUMENTARY + SYSTEM INVENTORY ONLY` |
| Resultado | `G5-EXIT-11 = BLOCKED / LEGAL_DECISIONS_REQUIRED` |
| G5 | `NO APROBADA / NOT REQUESTED` |
| Datos reales / piloto / producción | `NOT AUTHORIZED` |
| Naturaleza | Preguntas para aprobación humana; no conclusiones jurídicas |
| Fecha | `2026-08-15` |

Este registro convierte hechos observados y preguntas de los documentos G5 en decisiones
concretas. No selecciona bases jurídicas, no determina licitud, no redacta un aviso
definitivo, no asigna obligaciones de notificación y no sustituye la revisión humana con
fuentes jurídicas actualizadas.

## Canonical status and approved operational decisions

- `G5-OR1 = COMPLETE / TECHNICALLY ACCEPTED`.
- `G5-EXIT-07 = PASS_WITH_RESIDUAL`.
- `G5-EXIT-10 = BLOCKED / HUMAN_DECISION_REQUIRED`.
- `G5-EXIT-11 = BLOCKED / LEGAL_DECISIONS_REQUIRED`; LP1 no lo marca `PASS`.
- `G5-EXIT-12 = BLOCKED`; este paquete no crea autorización.
- `C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`.
- `Q-106 = DEFERRED / PILOT PRECONDITION`.
- Technical incident owner: `BaseLogic / Nicolás`.
- Recovery owner: `BaseLogic / Nicolás`.
- Monitoring model: `MANAGED_EXTERNAL`.
- Productive monitoring technology: `Grafana Cloud`.
- Primary alert destination: `EMAIL`; immediate alert destination: `TELEGRAM`.
- Productive security-event destination: `Grafana Cloud observability stack`.
- `SecurityEvent != AuditEvent`.
- Operational provider implementation: `APPROVED / IMPLEMENTATION_DEFERRED_TO_PREPROD`.
- Ninguna de esas decisiones configura proveedores ni autoriza datos reales.

## Register

`OPTIONS_IF_ALREADY_DEFINED_BY_PRODUCT` sólo enumera alternativas funcionales que el
producto ya modela. No son opciones legales ni una recomendación de cumplimiento.

| DECISION_ID | TOPIC | SYSTEM_FACT | QUESTION_REQUIRING_APPROVAL | OPTIONS_IF_ALREADY_DEFINED_BY_PRODUCT | WHO_MUST_APPROVE | BLOCKS_G5 | BLOCKS_PILOT | BLOCKS_PRODUCTION | EVIDENCE_REQUIRED | STATUS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LP-001 | Formal data controller/responsible party | El sistema separa tenant/institución, usuarios de plataforma, membership y soporte; no existe una asignación formal de responsable legal en runtime. | ¿Qué entidad o entidades asumirán formalmente la responsabilidad del tratamiento para cada finalidad y relación institucional? | El producto ya tiene boundary de tenant e institución; no define el rol jurídico. | Autoridad institucional competente + revisor legal/privacy que la institución designe | YES | YES | YES | Decisión institucional documentada; alcance por finalidad/tenant; contratos o instrumentos aplicables | OPEN / HUMAN_DECISION_REQUIRED |
| LP-002 | Applicable legal basis by purpose | El runtime tiene finalidades técnicas diferenciadas y este paquete marca `LEGAL_BASIS_STATUS = UNASSESSED`. | ¿Qué fundamento aplicará a cada finalidad, categoría y flujo, y qué restricciones derivan de esa decisión? | Formulario configurable con `purpose` y sensibilidad; no contiene una base jurídica. | Revisor legal/privacy designado por la institución y autoridad institucional | YES | YES | YES | Mapa de finalidades, categorías, actores, notice/records y fuentes jurídicas actualizadas | OPEN / HUMAN_DECISION_REQUIRED |
| LP-003 | Privacy notice / information text | El sistema muestra/proyecta datos de admisión y comunicaciones, pero no se identificó aviso legal definitivo aprobado por finalidad. | ¿Qué información debe entregarse, cuándo, a quién y mediante qué texto/canal antes de cada captura o comunicación? | Captura progresiva y campos con `purpose`; el producto no fija texto legal. | Autoridad institucional + revisor legal/privacy | YES | YES | YES | Textos aprobados, puntos de captura, actores y versiones por flujo | OPEN / HUMAN_DECISION_REQUIRED |
| LP-004 | Minor/guardian handling | Student puede ser menor; existe `FamilyProfile`, usuario adulto y asistencia con declaración/presencia/autorización, pero no `GuardianRelationship` cerrado. | ¿Cómo se determina la autoridad del adulto, qué declaración/evidencia se exige y qué límites aplican al inicio y continuidad? | Self-service familiar y assisted intake; Q-106 mantiene decisiones abiertas | Autoridad institucional + revisor legal/privacy + dueño operativo designado | YES | YES | YES | Política Q-106, evidencia aceptable, discrepancias, revisión y trazabilidad | OPEN / HUMAN_DECISION_REQUIRED |
| LP-005 | PIE/NEE/sensitive information | Form fields pueden tener sensibilidad `restricted` o `highly_restricted`; evidencia observada es dinámica y sintética; acceso restringido y familia no ve deliberación interna. | ¿Qué categorías se consideran PIE/NEE, qué captura mínima se autoriza, quién puede acceder y con qué uso/retención? | Captura progresiva, condicional y mínima; no existe catálogo legal institucional en runtime | Autoridad institucional + revisor legal/privacy + responsables funcionales autorizados | YES | YES | YES | Catálogo institucional, finalidad por campo, matriz de acceso, notice y retención aprobados | OPEN / HUMAN_DECISION_REQUIRED |
| LP-006 | Health information | No se observó modelo dedicado de historia de salud; el formulario dinámico puede representar campos sensibles si una configuración los publica. | ¿Se permitirá alguna captura de salud, con qué finalidad, mínimo, acceso, aviso y tratamiento de excepciones? | No health model específico; formularios dinámicos permiten sensibilidad, no autorización legal | Autoridad institucional + revisor legal/privacy | YES | YES | YES | Decisión explícita de inclusión/exclusión, catálogo de campos y controles de acceso | OPEN / HUMAN_DECISION_REQUIRED |
| LP-007 | Retention matrix | Varias entidades preservan historia, snapshots, versiones o auditoría; plazos legales no están definidos. | ¿Cuál es el plazo y evento de inicio por categoría, finalidad, estado y proveedor, incluyendo excepciones? | Expiry/status/versioning técnico ya existe; no equivale a retención legal | Autoridad institucional + revisor legal/privacy + owner operativo | YES | YES | YES | Matriz por categoría, eventos de inicio/fin, proveedores, backups y auditoría | OPEN / HUMAN_DECISION_REQUIRED |
| LP-008 | Deletion/anonymization/blocking | Hay cambios de estado, revocación y `deleteQuarantine`, pero no existe procedimiento general de eliminación, anonimización o bloqueo por titular. | ¿Qué acciones se habilitan, en qué casos, sobre qué copias/historiales y cómo se preserva la integridad de negocio/auditoría? | Withdrawal, revoke, replacement, archive y technical quarantine deletion ya modelados; no son un procedimiento de derechos | Autoridad institucional + revisor legal/privacy + owner técnico/operativo designado | YES | YES | YES | Reglas aprobadas por categoría, dependencias, backups, evidencia y excepciones | OPEN / HUMAN_DECISION_REQUIRED |
| LP-009 | Data subject request procedure | No existe tracker general de solicitudes; `OperationalTask` no es un registro de derechos. | ¿Cómo se reciben, autentican, clasifican, asignan, responden y registran solicitudes, incluyendo intervención manual? | Vistas familiares, corrección de borradores y reportes operativos existen; no hay flujo general | Autoridad institucional + revisor legal/privacy + responsable operativo | YES | YES | YES | Procedimiento, roles, autenticación, expediente de solicitud y registro de resolución | OPEN / HUMAN_DECISION_REQUIRED |
| LP-010 | Access/export matrix legal approval | El runtime tiene lecturas por tenant/scope/purpose, soporte elevado y CSV allowlisted; no hay exportación general de titular. | ¿Qué combinación de lectura, descarga, exportación, decisión y auditoría se autoriza por categoría y rol, y con qué límites? | Family projection, scoped staff reads, support elevation y allowlisted CSV ya existen | Autoridad institucional + revisor legal/privacy + dueños funcionales | YES | YES | YES | Matriz `docs/g5/10...`, minimización, destinatario, log y controles de elevación | OPEN / HUMAN_DECISION_REQUIRED |
| LP-011 | Physical original retention/return | Physical intake es excepcional/asistido; copia digital es el artefacto oficial del expediente; no hay regla para el original. | ¿Quién conserva, por cuánto tiempo, bajo qué custodia y cuándo/cómo devuelve o destruye el original físico? | `PHYSICAL_ORIGINAL_RETENTION = NOT_DEFINED`; `PHYSICAL_ORIGINAL_RETURN = NOT_DEFINED` | Autoridad institucional + revisor legal/privacy + owner operativo | YES | YES | YES | Política de intake físico, custodia, trazabilidad, devolución y relación con copia digital | OPEN / HUMAN_DECISION_REQUIRED |
| LP-012 | Provider/data residency rules | Desarrollo usa adapters locales/en memoria; Grafana Cloud y Telegram están aprobados para implementación futura, sin región/retención seleccionadas. | ¿Qué proveedores, regiones, transferencias, minimización, subencargados y retenciones se autorizan por categoría? | Grafana Cloud, email y Telegram sólo como modelo operativo aprobado; object storage/malware/email productivo no seleccionados | Autoridad institucional + revisor legal/privacy + owner técnico/operativo | YES | YES | YES | Due diligence/proveedor, región, categorías, payloads, retención y controles de transferencia | OPEN / HUMAN_DECISION_REQUIRED |
| LP-013 | Security incident privacy/legal escalation | Existe owner técnico y de recovery aprobados; `LEGAL_PRIVACY_INCIDENT_OWNER = NOT_ASSIGNED`; SecurityEvent es separado de AuditEvent. | ¿Quién determina impacto privacy/legal, escalamiento, comunicaciones y registro frente a un incidente? | Technical incident owner y recovery owner ya están definidos; no definen la función legal/privacy | Autoridad institucional + revisor legal/privacy; owner técnico/operativo participa | YES | YES | YES | Runbook, matriz de roles, criterios de escalamiento, canales y fuentes jurídicas actualizadas | OPEN / HUMAN_DECISION_REQUIRED |
| LP-014 | Q-106 guardian relationship policy | `EMAIL_ACCOUNT_VERIFICATION = IMPLEMENTED`; `GUARDIAN_RELATIONSHIP_VERIFICATION = NOT LEGALLY/OPERATIONALLY CLOSED`. | ¿Qué declaración hace el adulto, si basta para iniciar, cuándo se verifica la relación, qué evidencia se exige, quién revisa y qué ocurre ante discrepancia? | Self-service y assisted intake están implementados; no existe política cerrada | Autoridad institucional + revisor legal/privacy + owner operativo | YES | YES | YES | Política de relación, evidencia, revisión, discrepancia, apelación y auditoría | OPEN / HUMAN_DECISION_REQUIRED |
| LP-015 | Audit/security log retention/access | `AuditEvent` es durable en PostgreSQL; `SecurityEvent` y señales operativas no tienen sink productivo durable en la configuración actual. | ¿Qué logs se conservan, quién puede leerlos, por cuánto tiempo y cómo se compatibilizan integridad, minimización y solicitudes? | `PrismaAuditSink` actual; Grafana Cloud futuro para señales de seguridad/operación, diferido a preprod | Autoridad institucional + revisor legal/privacy + owner técnico/operativo | YES | YES | YES | Taxonomía AuditEvent/SecurityEvent, campos, acceso/elevación, retención y proveedor | OPEN / HUMAN_DECISION_REQUIRED |

## Cross-reference to Q-201..Q-210

| QUESTION | LEGAL/PRIVACY IMPACT IN LP1 | REGISTERED_DECISIONS | STATUS |
| --- | --- | --- | --- |
| Q-201 | Responsable formal, bases y transparencia | LP-001, LP-002, LP-003 | OPEN / HUMAN_DECISION_REQUIRED |
| Q-202 | Retención, eliminación, anonimización, bloqueo y logs | LP-007, LP-008, LP-015 | OPEN / HUMAN_DECISION_REQUIRED |
| Q-203 | Providers, transferencias y residencia | LP-012 | OPEN / HUMAN_DECISION_REQUIRED |
| Q-204 | MFA/controles de autenticación: asunto técnico/security pendiente; LP1 no inventa una conclusión legal | No agrega una decisión legal nueva | OPEN OUTSIDE LP1 |
| Q-205 | Escalamiento privacy/legal de incidentes | LP-013 | OPEN / HUMAN_DECISION_REQUIRED |
| Q-206 | RPO/RTO y recovery operativo; no es una decisión jurídica emitida por LP1 | No agrega una decisión legal nueva | OPEN OUTSIDE LP1 |
| Q-207 | Capacidad/volumen operativo; no es una decisión jurídica emitida por LP1 | No agrega una decisión legal nueva | OPEN OUTSIDE LP1 |
| Q-208 | Acceso, exportación y procedimiento de solicitudes | LP-009, LP-010 | OPEN / HUMAN_DECISION_REQUIRED |
| Q-209 | Dispositivo/red y controles técnicos; no es una decisión jurídica emitida por LP1 | No agrega una decisión legal nueva | OPEN OUTSIDE LP1 |
| Q-210 | Pruebas de seguridad/validación técnica; no es una decisión jurídica emitida por LP1 | No agrega una decisión legal nueva | OPEN OUTSIDE LP1 |

## C-013 and Q-106 disposition

- `C-013 = INSTITUTIONALLY_VALIDATED / LEGAL_VALIDATION_PENDING`. LP1 demuestra controles
  técnicos/funcionales observables —captura progresiva, minimización configurada,
  exclusión de income del MVP de admisiones, sensibilidad restringida, auditoría y
  ocultamiento de deliberación interna— sin afirmar cumplimiento legal.
- `Q-106 = DEFERRED / PILOT PRECONDITION`. Las dos condiciones canónicas y las preguntas
  pendientes están documentadas en el inventario; este registro no las resuelve.

## Closure conditions

LP1 queda cerrado como paquete documental cuando los documentos 09 y 10 sean revisados
contra el runtime y este registro sea entregado a los aprobadores humanos. `G5-EXIT-11`
no puede marcarse `PASS` por la sola creación de este paquete. No se modifica `C-013`, no
se crea autorización para piloto/producción y no se decide `G5-EXIT-12`.
